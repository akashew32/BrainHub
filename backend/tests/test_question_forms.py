"""Family coverage, physical-form recall, old evidence and frozen recovery."""

import copy
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.api import learning
from app.db.base import RoadmapAssessmentSession, User
from app.db.session import SessionLocal
from app.services import question_forms, study
from app.services.assessment_sessions import freeze_questions, semantic_fingerprint
from app.services.curriculum import curriculum, grade, public_lesson, public_question, questions_for
from app.services.exam_readiness import _current_set
from app.services.practice_selection import choose_practice_forms
from app.services.question_forms import family_id, practice_families, unique_families

NOW = datetime(2026, 7, 1, 12)
SLUGS = sorted(curriculum())


def test_distinct_concurrent_starts_serialize_family_selection(client, monkeypatch):
    monkeypatch.setattr(learning, "utc_now", lambda: NOW)
    client.get("/api/stats")
    topic = curriculum()["linear-algebra"]["lessons"][0]["topic_slug"]

    def start(_):
        return client.post(
            "/api/roadmaps/linear-algebra/assessments",
            json={"mode": "practice", "topic_slug": topic, "request_id": str(uuid4())},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(start, range(2)))
    assert all(item.status_code == 201 for item in responses), [item.text for item in responses]
    assignments = [
        {q["family_id"]: q["id"] for q in item.json()["questions"]} for item in responses
    ]
    assert assignments[0].keys() == assignments[1].keys()
    assert sum(assignments[0][key] != assignments[1][key] for key in assignments[0]) == 4


@pytest.mark.parametrize("slug", SLUGS)
def test_registered_forms_preserve_core_bank_and_public_counts_without_keys(slug):
    data = curriculum()[slug]
    bank = questions_for(slug)
    assert len(bank) == 84
    assert sum(item["exam"] for item in bank.values()) == 12
    assert len(practice_families(bank)) == 48
    for lesson in data["lessons"]:
        pools = practice_families(bank, topic_slug=lesson["topic_slug"])
        assert len(pools) == 8 and sorted(map(len, pools.values())) == [1] * 4 + [2] * 4
        public = public_lesson(slug, lesson)
        assert (
            public["question_count"],
            public["practice_count"],
            public["practice_form_count"],
            public["alternate_form_count"],
        ) == (10, 8, 12, 4)
    for question in bank.values():
        # Contract checks complement independently derived mathematical tests.
        assert grade(question, question["answer"]) == (True, None)
        public = public_question(question)
        assert not {
            "answer",
            "solution",
            "exam",
            "proof_dependencies",
            "proof_rationales",
            "tolerance",
        }.intersection(public)
        assert public["hints"] == [] and public["family_id"] == family_id(question)


@pytest.mark.parametrize("slug", SLUGS)
def test_repeated_full_sets_use_alternates_and_all_six_still_qualify(client, monkeypatch, slug):
    monkeypatch.setattr(learning, "utc_now", lambda: NOW)
    bank = questions_for(slug)
    for lesson in curriculum()[slug]["lessons"]:
        scope = {"mode": "practice", "topic_slug": lesson["topic_slug"]}
        first = client.post(f"/api/roadmaps/{slug}/assessments", json=scope)
        assert first.status_code == 201, first.text
        second = client.post(f"/api/roadmaps/{slug}/assessments", json=scope)
        assert second.status_code == 201, second.text
        old = {item["family_id"]: item["id"] for item in first.json()["questions"]}
        new = {item["family_id"]: item["id"] for item in second.json()["questions"]}
        assert old.keys() == new.keys() and len(new) == 8
        assert sum(old[key] != new[key] for key in old) == 4
        for key in old:
            if len(practice_families(bank)[key]) > 1:
                assert old[key] != new[key]
        answers = [{"question_id": qid, "answer": bank[qid]["answer"]} for qid in new.values()]
        result = client.post(
            f"/api/roadmaps/assessments/{second.json()['id']}/submit", json={"answers": answers}
        )
        assert result.status_code == 200, result.text
        assert result.json()["independent_score"] == 100
        assert {item["family_id"] for item in result.json()["feedback"]} == set(new)
    readiness = client.get(f"/api/roadmaps/{slug}/exam-readiness").json()
    assert readiness["eligible"] and readiness["ready_lessons"] == 6
    exam = client.post(f"/api/roadmaps/{slug}/assessments", json={"mode": "exam"})
    assert exam.status_code == 201, exam.text
    assert len(exam.json()["questions"]) == 12
    assert all(bank[item["id"]]["exam"] for item in exam.json()["questions"])


def test_eight_answers_cannot_replace_one_family_with_its_sibling():
    bank = questions_for("linear-algebra")
    lesson = curriculum()["linear-algebra"]["lessons"][0]
    expected = {q["id"] for q in lesson["questions"] if not q["exam"]}
    ids = list(expected)
    parent = next(qid for qid in ids if qid + "--alt-01" in bank)
    victim = next(qid for qid in ids if qid != parent)
    ids[ids.index(victim)] = parent + "--alt-01"
    session = SimpleNamespace(
        question_ids=ids,
        hint_usage={},
        question_snapshot=freeze_questions([bank[qid] for qid in ids], mode="practice"),
    )
    attempts = [
        SimpleNamespace(
            question_id=qid, topic_slug=lesson["topic_slug"], correct=True, hints_used=0
        )
        for qid in ids
    ]
    assert _current_set(session, attempts, bank, lesson["topic_slug"], expected) is None


def test_semantic_family_defaults_preserve_old_snapshots_but_detect_remapping():
    question = next(iter(questions_for("calculus").values()))
    old = {key: value for key, value in question.items() if key != "family_id"}
    assert semantic_fingerprint(old) == semantic_fingerprint(question)
    assert semantic_fingerprint(
        {**question, "family_id": "different-skill"}
    ) != semantic_fingerprint(question)


def test_latest_form_selection_is_owned_time_bounded_and_ties_are_deterministic(client):
    client.get("/api/stats")
    bank = questions_for("calculus")
    parent = next(qid for qid in bank if qid + "--alt-01" in bank)
    alt = parent + "--alt-01"
    with SessionLocal() as db:
        other = User(name="Another profile")
        db.add(other)
        db.flush()
        for sid, owner, assigned, started in [
            ("a", 1, alt, NOW),
            ("z", 1, parent, NOW),
            ("zz", other.id, alt, NOW),
            ("future", 1, alt, NOW + timedelta(seconds=1)),
        ]:
            db.add(
                RoadmapAssessmentSession(
                    id=sid,
                    user_id=owner,
                    roadmap_slug="calculus",
                    mode="practice",
                    question_ids=[assigned],
                    started_at=started,
                    expires_at=started + timedelta(hours=2),
                )
            )
        db.commit()
        assert choose_practice_forms(db, 1, "calculus", [parent], bank, now=NOW) == [alt]
        assert choose_practice_forms(
            db, 1, "calculus", [parent], bank, now=NOW - timedelta(seconds=1)
        ) == [parent]


@pytest.mark.parametrize("slug", SLUGS)
def test_diagnostic_repeats_keep_six_balanced_distinct_skill_samples(client, monkeypatch, slug):
    monkeypatch.setattr(learning, "utc_now", lambda: NOW)
    first = client.post(f"/api/roadmaps/{slug}/assessments", json={"mode": "diagnostic"}).json()
    second = client.post(f"/api/roadmaps/{slug}/assessments", json={"mode": "diagnostic"}).json()
    for session in (first, second):
        assert len({q["family_id"] for q in session["questions"]}) == 12
        for lesson in curriculum()[slug]["lessons"]:
            sample = [q for q in session["questions"] if q["topic_slug"] == lesson["topic_slug"]]
            assert sorted(q["difficulty"] for q in sample) == ["core", "foundation"]
            assert all(q["hint_count"] == 0 and q["hints"] == [] for q in sample)


def test_unique_recall_keeps_first_physical_form_and_never_swaps_answers():
    bank = questions_for("probability")
    parent = next(qid for qid in bank if qid + "--alt-01" in bank)
    alt = parent + "--alt-01"
    assert unique_families([alt, parent, alt, "removed"], bank) == [alt]
    assert unique_families([parent, alt], bank) == [parent]


def test_study_candidate_sets_deduplicate_siblings_and_keep_unseen_skills_first(client):
    client.get("/api/stats")
    bank = questions_for("probability")
    with SessionLocal() as db:
        candidates, counts = study._candidates(db, 1, "probability", now=NOW)
    assert len(candidates) == counts["unseen"] == 48
    assert len({family_id(bank[item["question_id"]]) for item in candidates}) == 48
    assert all(item["question_id"] == family_id(bank[item["question_id"]]) for item in candidates)


def test_review_and_study_deduplicate_skills_without_clearing_the_other_forms_due_recall(
    client, monkeypatch
):
    monkeypatch.setattr(learning, "utc_now", lambda: NOW)
    slug = "probability"
    topic = curriculum()[slug]["lessons"][0]["topic_slug"]
    bank = questions_for(slug)
    parent = next(
        qid
        for qid, q in bank.items()
        if q["topic_slug"] == topic and q["kind"] == "number" and qid + "--alt-01" in bank
    )
    for _ in range(2):
        session = client.post(
            f"/api/roadmaps/{slug}/assessments", json={"mode": "practice", "topic_slug": topic}
        ).json()
        answers = [
            {
                "question_id": q["id"],
                "answer": bank[q["id"]]["answer"] + 1
                if q["family_id"] == parent
                else bank[q["id"]]["answer"],
            }
            for q in session["questions"]
        ]
        result = client.post(
            f"/api/roadmaps/assessments/{session['id']}/submit", json={"answers": answers}
        )
        assert result.status_code == 200 and result.json()["correct"] == 7
    plan = client.get("/api/roadmaps/review-plan").json()
    due_ids = {item["question_id"] for item in plan["items"] if item["roadmap_slug"] == slug}
    assert due_ids == {parent, parent + "--alt-01"}
    with SessionLocal() as db:
        candidates, _ = study._candidates(db, 1, slug, now=NOW)
        assert len({family_id(bank[item["question_id"]]) for item in candidates}) == len(candidates)
        assert candidates[0]["code"] == "due" and candidates[0]["question_id"] in due_ids
        assert all(family_id(bank[item["question_id"]]) != parent for item in candidates[1:])
    review = client.post(f"/api/roadmaps/{slug}/assessments", json={"mode": "review"}).json()
    assert len(review["questions"]) == 1
    qid = review["questions"][0]["id"]
    assert qid in due_ids
    result = client.post(
        f"/api/roadmaps/assessments/{review['id']}/submit",
        json={"answers": [{"question_id": qid, "answer": bank[qid]["answer"]}]},
    )
    assert result.status_code == 200
    remaining = client.get("/api/roadmaps/review-plan").json()
    assert {
        item["question_id"] for item in remaining["items"] if item["roadmap_slug"] == slug
    } == due_ids - {qid}


@pytest.mark.parametrize(
    "mutation", ["private", "boolean", "huge", "parent", "exam", "duplicate", "hints", "version"]
)
def test_bad_form_definitions_fail_closed_before_assignment(monkeypatch, mutation):
    original = question_forms._read_forms
    data = copy.deepcopy(original(question_forms.FORMS_ROOT / "calculus.json", 0, 0))
    form = data["forms"][0]
    if mutation == "private":
        form["verification_secret"] = "must never become public"
    elif mutation == "boolean":
        form["answer"] = True
    elif mutation == "huge":
        form["answer"] = 10**1000
    elif mutation == "parent":
        form["family_id"] = "missing"
    elif mutation == "exam":
        form["exam"] = True
    elif mutation == "duplicate":
        data["forms"][1] = copy.deepcopy(form)
    elif mutation == "hints":
        form["hints"] = ["Only one"]
    elif mutation == "version":
        data["version"] = True
    monkeypatch.setattr(question_forms, "_read_forms", lambda *args: data)
    with pytest.raises(Exception) as error:
        questions_for("calculus")
    assert error.value.status_code == 503
    assert "verification_secret" not in str(error.value)


@pytest.mark.parametrize("mode", ["practice", "diagnostic", "study"])
def test_invalid_current_bank_preserves_frozen_recovery_hint_grade_and_start_replay(
    client, monkeypatch, mode
):
    monkeypatch.setattr(learning, "utc_now", lambda: NOW)
    slug = "probability"
    topic = curriculum()[slug]["lessons"][0]["topic_slug"]
    scope = {
        "mode": mode,
        "topic_slug": topic if mode == "practice" else None,
        "request_id": str(uuid4()),
    }
    bank = questions_for(slug)
    started = client.post(f"/api/roadmaps/{slug}/assessments", json=scope).json()
    monkeypatch.setattr(question_forms, "_read_forms", lambda *args: {"invalid": True})
    assert (
        client.post(
            f"/api/roadmaps/{slug}/assessments", json={**scope, "request_id": str(uuid4())}
        ).status_code
        == 503
    )
    replay = client.post(f"/api/roadmaps/{slug}/assessments", json=scope)
    assert replay.status_code == 200 and replay.json()["id"] == started["id"]
    recovered = client.get(f"/api/roadmaps/assessments/{started['id']}")
    assert recovered.status_code == 200 and recovered.json()["questions"] == started["questions"]
    qid = started["questions"][0]["id"]
    hint = client.post(
        f"/api/roadmaps/assessments/{started['id']}/questions/{qid}/hints",
        json={"index": 1},
    )
    assert hint.status_code == (409 if mode == "diagnostic" else 200), hint.text
    answers = [
        {"question_id": item["id"], "answer": bank[item["id"]]["answer"]}
        for item in started["questions"]
    ]
    result = client.post(
        f"/api/roadmaps/assessments/{started['id']}/submit", json={"answers": answers}
    )
    assert result.status_code == 200 and result.json()["score"] == 100
    if mode == "diagnostic":
        assert all(
            item["study_url"] is None for item in result.json()["diagnostic_summary"]["topics"]
        )
    assert (
        client.get(f"/api/roadmaps/assessments/{started['id']}").json()["result"] == result.json()
    )
    assert "verification_secret" not in json.dumps(result.json())
    history = client.get("/api/roadmaps/assessment-sessions")
    assert history.status_code == 200
    saved = next(item for item in history.json()["items"] if item["id"] == started["id"])
    assert saved["open_url"] and saved["result_available"] and saved["study_url"] is None
    notebook = client.get("/api/roadmaps/notebook")
    assert notebook.status_code == 200
    if mode != "diagnostic":
        row = next(item for item in notebook.json()["items"] if item["question_id"] == qid)
        assert row["prompt"] == bank[qid]["prompt"] and row["practice_url"] is None


def test_one_unavailable_subject_cannot_block_other_subjects_history_and_notebook(
    client, monkeypatch
):
    monkeypatch.setattr(learning, "utc_now", lambda: NOW)
    topic = curriculum()["probability"]["lessons"][0]["topic_slug"]
    started = client.post(
        "/api/roadmaps/probability/assessments", json={"mode": "practice", "topic_slug": topic}
    ).json()
    bank = questions_for("probability")
    qid = started["questions"][0]["id"]
    assert (
        client.post(
            f"/api/roadmaps/assessments/{started['id']}/questions/{qid}/hints", json={"index": 1}
        ).status_code
        == 200
    )
    answers = [
        {"question_id": item["id"], "answer": bank[item["id"]]["answer"]}
        for item in started["questions"]
    ]
    assert (
        client.post(
            f"/api/roadmaps/assessments/{started['id']}/submit", json={"answers": answers}
        ).status_code
        == 200
    )
    reader = question_forms._read_forms
    monkeypatch.setattr(
        question_forms,
        "_read_forms",
        lambda path, *args: {} if path.stem == "calculus" else reader(path, *args),
    )
    history = client.get("/api/roadmaps/assessment-sessions")
    assert history.status_code == 200 and history.json()["items"][0]["study_url"]
    notebook = client.get("/api/roadmaps/notebook")
    assert notebook.status_code == 200 and notebook.json()["items"][0]["practice_url"]
