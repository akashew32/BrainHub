"""Balanced diagnostic samples remain distinct from mastery and stage exams."""

import copy
import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from app.api import learning, learning_dashboard, notebook
from app.db.base import RoadmapAssessmentSession, RoadmapQuestionAttempt, RoadmapTopicProgress, User
from app.db.session import SessionLocal
from app.services import diagnostics
from app.services.assessment_hints import hints_allowed
from app.services.curriculum import curriculum, questions_for

NOW = datetime(2026, 5, 1, 12)
SLUGS = ["calculus", "linear-algebra", "probability", "real-analysis", "discrete-math"]


def initialize(monkeypatch):
    for module in (learning, learning_dashboard, notebook):
        monkeypatch.setattr(module, "utc_now", lambda: NOW)


def start(client, monkeypatch, slug="calculus", **extra):
    initialize(monkeypatch)
    payload = {"mode": "diagnostic", **extra}
    response = client.post(f"/api/roadmaps/{slug}/assessments", json=payload)
    assert response.status_code == 201, response.text
    return response.json(), payload


def answers(session, bank=None):
    bank = bank or questions_for(session["roadmap_slug"])
    return [
        {"question_id": item["id"], "answer": bank[item["id"]]["answer"]}
        for item in session["questions"]
    ]


def submit(client, session, entries=None):
    return client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={"answers": answers(session) if entries is None else entries},
    )


def wrong_answer(question):
    kind = question["kind"]
    expected = copy.deepcopy(question["answer"])
    if kind == "number":
        return expected + 100
    if kind == "vector":
        expected[0] += 100
        return expected
    if kind == "matrix":
        expected[0][0] += 100
        return expected
    if kind == "choice":
        return next(choice for choice in question["choices"] if choice != expected)
    # Put an explicit prerequisite after the step which requires it.
    before, after = question["proof_dependencies"][0]
    return [after, before, *[step for step in expected if step not in {before, after}]]


@pytest.mark.parametrize("slug", SLUGS)
def test_all_five_samples_are_balanced_practice_only_private_and_hint_free(
    client, monkeypatch, slug
):
    session, _ = start(client, monkeypatch, slug)
    assert session["mode"] == "diagnostic" and session["topic_slug"] is None
    assert session["state"] == "active" and len(session["questions"]) == 12
    ids = [item["id"] for item in session["questions"]]
    assert len(set(ids)) == 12
    bank = questions_for(slug)
    assert all(not bank[question_id]["exam"] for question_id in ids)
    assert Counter(bank[question_id]["topic_slug"] for question_id in ids) == {
        lesson["topic_slug"]: 2 for lesson in curriculum()[slug]["lessons"]
    }
    assert Counter(bank[question_id]["difficulty"] for question_id in ids) == {
        "foundation": 6,
        "core": 6,
    }
    assert all(item["hints"] == [] and item["hint_count"] == 0 for item in session["questions"])
    assert "result" not in session and "diagnostic_summary" not in session
    for item in session["questions"]:
        assert not {
            "answer",
            "solution",
            "proof_dependencies",
            "proof_rationales",
            "accepted_orders",
            "exam",
        }.intersection(item)
    serialized = json.dumps(session)
    for question in bank.values():
        if question["exam"]:
            assert question["id"] not in serialized and question["prompt"] not in serialized
    question_id = ids[0]
    hint = client.post(
        f"/api/roadmaps/assessments/{session['id']}/questions/{question_id}/hints",
        json={"index": 1},
    )
    assert hint.status_code == 409 and "do not provide hints" in hint.json()["detail"]
    recovered = client.get(f"/api/roadmaps/assessments/{session['id']}").json()
    assert recovered["questions"] == session["questions"]
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        assert row.hint_usage == {} and row.hint_revision == 0
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 0


@pytest.mark.parametrize("slug", SLUGS)
def test_perfect_diagnostic_records_evidence_but_grants_no_progress_readiness_or_exam_credit(
    client, monkeypatch, slug
):
    session, _ = start(client, monkeypatch, slug)
    response = submit(client, session)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["correct"] == result["total"] == 12 and result["score"] == 100
    assert result["passed"] and result["progress"] is None
    summary = result["diagnostic_summary"]
    assert summary["version"] == 1 and "does not establish mastery" in summary["notice"]
    assert len(summary["topics"]) == 6
    assert all(
        item["correct"] == item["total"] == 2 and item["priority"] == "verify" and item["study_url"]
        for item in summary["topics"]
    )
    assert summary["recommended_topics"] == [item["topic_slug"] for item in summary["topics"]]
    readiness = client.get(f"/api/roadmaps/{slug}/exam-readiness").json()
    assert not readiness["eligible"] and readiness["ready_lessons"] == 0
    assert all(item["completed_attempts"] == 0 for item in readiness["lessons"])
    assert (
        client.post(f"/api/roadmaps/{slug}/assessments", json={"mode": "exam"}).status_code == 409
    )
    stats = client.get("/api/roadmaps/learning-stats").json()
    assert stats["answers"] == stats["correct"] == 12 and stats["exams"] == []
    plan = client.get("/api/roadmaps/review-plan").json()
    assert plan["summary"]["tracked"] == plan["summary"]["scheduled"] == 12
    assert plan["summary"]["reviewed_today"] == plan["summary"]["independent_today"] == 0
    performance = client.get("/api/roadmaps/concept-performance?days=14").json()
    assert performance["totals"]["answers"] == performance["totals"]["independent"]["answers"] == 12
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapTopicProgress)) == 0
        rows = list(db.scalars(select(RoadmapQuestionAttempt)))
        assert len(rows) == 12 and all(row.correct and row.hints_used == 0 for row in rows)


def test_topic_guidance_reports_two_sample_counts_and_wrong_samples_feed_notebook_and_review(
    client, monkeypatch
):
    session, _ = start(client, monkeypatch)
    bank = questions_for("calculus")
    by_topic = defaultdict(list)
    for question in session["questions"]:
        by_topic[question["topic_slug"]].append(question["id"])
    ordered = sorted(by_topic)
    wrong = {*by_topic[ordered[0]], by_topic[ordered[1]][0]}
    entries = [
        {
            "question_id": item["id"],
            "answer": wrong_answer(bank[item["id"]])
            if item["id"] in wrong
            else bank[item["id"]]["answer"],
        }
        for item in session["questions"]
    ]
    result = submit(client, session, entries).json()
    assert result["correct"] == 9 and result["score"] == 75
    topics = result["diagnostic_summary"]["topics"]
    assert [(item["correct"], item["priority"]) for item in topics] == [
        (0, "start_here"),
        (1, "review"),
        (2, "verify"),
        (2, "verify"),
        (2, "verify"),
        (2, "verify"),
    ]
    assert all(item["total"] == 2 and "practice set" in item["guidance"] for item in topics)
    assert result["diagnostic_summary"]["recommended_topics"][:2] == ordered[:2]
    plan = client.get("/api/roadmaps/review-plan").json()
    assert plan["summary"]["due"] == 3 and plan["summary"]["scheduled"] == 9
    assert {item["question_id"] for item in plan["items"]} == wrong
    notes = client.get("/api/roadmaps/notebook").json()
    assert {item["question_id"] for item in notes["items"]} == wrong
    assert all(item["status"] == "unresolved" for item in notes["items"])


def test_diagnostic_replay_normalizes_ignored_topic_and_preserves_frozen_archived_math(
    client, monkeypatch
):
    bank = copy.deepcopy(questions_for("calculus"))
    token = str(uuid4())
    session, payload = start(client, monkeypatch, request_id=token, topic_slug="ignored-context")
    replay = client.post(
        "/api/roadmaps/calculus/assessments", json={"mode": "diagnostic", "request_id": token}
    )
    assert replay.status_code == 200 and replay.json() == session
    changed_mode = client.post(
        "/api/roadmaps/calculus/assessments", json={**payload, "mode": "exam"}
    )
    assert changed_mode.status_code == 409
    monkeypatch.setattr(learning, "questions_for", lambda _: {})
    monkeypatch.setattr(learning, "curriculum", lambda: {})
    monkeypatch.setattr(diagnostics, "questions_for", lambda _: {})
    assert (
        client.post("/api/roadmaps/calculus/assessments", json=payload).json()["id"]
        == session["id"]
    )
    entries = answers(session, bank)
    completed = submit(client, session, entries)
    assert completed.status_code == 200 and completed.json()["score"] == 100
    assert all(
        item["study_url"] is None for item in completed.json()["diagnostic_summary"]["topics"]
    )
    recovered = client.get(f"/api/roadmaps/assessments/{session['id']}").json()
    assert recovered["mode"] == "diagnostic" and recovered["result"] == completed.json()
    assert (
        client.post("/api/roadmaps/calculus/assessments", json=payload).json()["result"]
        == completed.json()
    )
    assert submit(client, session, entries).json() == completed.json()
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 12
        assert db.scalar(select(func.count()).select_from(RoadmapAssessmentSession)) == 1


def test_changed_sample_math_disables_stale_study_links_but_editorial_change_does_not(
    client, monkeypatch
):
    session, _ = start(client, monkeypatch)
    original = copy.deepcopy(questions_for("calculus"))
    changed = copy.deepcopy(original)
    first, second = session["questions"][:2]
    changed[first["id"]]["prompt"] += " Changed requirement."
    changed[second["id"]]["solution"] += " Editorial clarification."
    monkeypatch.setattr(diagnostics, "questions_for", lambda _: changed)
    result = submit(client, session, answers(session, original)).json()
    rows = {item["topic_slug"]: item for item in result["diagnostic_summary"]["topics"]}
    assert rows[first["topic_slug"]]["study_url"] is None
    assert all(item["study_url"] for topic, item in rows.items() if topic != first["topic_slug"])


def test_completed_diagnostic_projects_archived_navigation_without_rewriting_saved_result(
    client, monkeypatch
):
    session, payload = start(client, monkeypatch, request_id=str(uuid4()))
    entries = answers(session)
    response = submit(client, session, entries)
    assert response.status_code == 200
    original = response.json()
    assert all(item["study_url"] for item in original["diagnostic_summary"]["topics"])
    url = f"/api/roadmaps/assessments/{session['id']}"
    assert client.get(url).json()["result"] == original
    assert submit(client, session, entries).json() == original
    with SessionLocal() as db:
        stored = copy.deepcopy(db.get(RoadmapAssessmentSession, session["id"]).result)
    monkeypatch.setattr(learning, "questions_for", lambda _: {})
    recovered = client.get(url).json()["result"]
    repeated = submit(client, session, entries).json()
    replay = client.post("/api/roadmaps/calculus/assessments", json=payload).json()["result"]
    expected = copy.deepcopy(original)
    for topic in expected["diagnostic_summary"]["topics"]:
        topic["study_url"] = None
    assert recovered == repeated == replay == expected
    with SessionLocal() as db:
        assert db.get(RoadmapAssessmentSession, session["id"]).result == stored == original
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 12


def test_completed_diagnostic_projection_keeps_editorial_links_and_removes_changed_math_links(
    client, monkeypatch
):
    session, _ = start(client, monkeypatch)
    original = submit(client, session).json()
    changed = copy.deepcopy(questions_for("calculus"))
    first = session["questions"][0]
    changed[first["id"]]["solution"] += " Editorial explanation."
    monkeypatch.setattr(learning, "questions_for", lambda _: changed)
    url = f"/api/roadmaps/assessments/{session['id']}"
    assert client.get(url).json()["result"] == original
    changed[first["id"]]["prompt"] += " Different mathematics."
    result = client.get(url).json()["result"]
    assert all(
        (topic["study_url"] is None) == (topic["topic_slug"] == first["topic_slug"])
        for topic in result["diagnostic_summary"]["topics"]
    )
    with SessionLocal() as db:
        assert db.get(RoadmapAssessmentSession, session["id"]).result == original


def test_diagnostic_draft_and_expired_readonly_recovery_preserve_work_without_evidence(
    client, monkeypatch
):
    session, payload = start(client, monkeypatch, request_id=str(uuid4()))
    url = f"/api/roadmaps/assessments/{session['id']}"
    draft = {
        "revision": 1,
        "time_spent_seconds": 29,
        "answers": [{"question_id": session["questions"][0]["id"], "answer": "1/"}],
    }
    saved = client.put(url + "/draft", json=draft)
    assert saved.status_code == 200 and saved.json()["draft"] == draft
    monkeypatch.setattr(learning, "utc_now", lambda: NOW + timedelta(hours=2))
    expired = client.get(url)
    assert expired.status_code == 200 and expired.json()["state"] == "expired"
    assert expired.json()["draft"] == draft
    assert client.put(url + "/draft", json={**draft, "revision": 2}).status_code == 410
    assert submit(client, session).status_code == 410
    assert (
        client.post("/api/roadmaps/calculus/assessments", json=payload).json()["id"]
        == session["id"]
    )
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 0
        assert db.scalar(select(func.count()).select_from(RoadmapTopicProgress)) == 0


def test_owned_history_filters_diagnostics_and_never_leaks_diagnostic_feedback(client, monkeypatch):
    session, _ = start(client, monkeypatch)
    result = submit(client, session).json()
    response = client.get("/api/roadmaps/assessment-sessions?mode=diagnostic&state=completed")
    assert response.status_code == 200
    listing = response.json()
    assert len(listing["items"]) == 1 and listing["items"][0]["id"] == session["id"]
    assert listing["items"][0]["result_summary"]["score"] == result["score"] == 100
    assert "diagnostic_summary" not in json.dumps(listing)
    assert all(question["id"] not in json.dumps(listing) for question in session["questions"])
    with SessionLocal() as db:
        other = User(name="Other")
        db.add(other)
        db.flush()
        db.get(RoadmapAssessmentSession, session["id"]).user_id = other.id
        db.commit()
    assert client.get("/api/roadmaps/assessment-sessions?mode=diagnostic").json()["items"] == []
    assert client.get(f"/api/roadmaps/assessments/{session['id']}").status_code == 404


@pytest.mark.parametrize(
    "change",
    [
        "missing_lesson",
        "missing_foundation",
        "reserved_core",
        "duplicate_topic",
        "duplicate_id",
        "bad_question",
    ],
)
def test_invalid_pools_fail_clearly_without_allocating_a_partial_diagnostic(
    client, monkeypatch, change
):
    initialize(monkeypatch)
    data = copy.deepcopy(curriculum())
    lessons = data["calculus"]["lessons"]
    if change == "missing_lesson":
        lessons.pop()
    elif change == "missing_foundation":
        for question in lessons[0]["questions"]:
            question["difficulty"] = "core"
    elif change == "reserved_core":
        for question in lessons[0]["questions"]:
            if question["difficulty"] == "core":
                question["exam"] = True
    elif change == "duplicate_topic":
        lessons[1]["topic_slug"] = lessons[0]["topic_slug"]
    elif change == "duplicate_id":
        lessons[1]["questions"][0]["id"] = lessons[0]["questions"][0]["id"]
    else:
        lessons[0]["questions"][0] = None
    monkeypatch.setattr(learning, "curriculum", lambda: data)
    response = client.post("/api/roadmaps/calculus/assessments", json={"mode": "diagnostic"})
    assert response.status_code == 409 and "balanced diagnostic" in response.json()["detail"]
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapAssessmentSession)) == 0


@pytest.mark.parametrize(
    "mode,allowed",
    [
        ("practice", True),
        ("review", True),
        ("exam", False),
        ("diagnostic", False),
        ("unknown", False),
    ],
)
def test_shared_hint_policy_preserves_existing_modes_and_fails_closed(mode, allowed):
    assert hints_allowed(mode) is allowed


def test_balanced_selector_never_uses_reserved_fallback_when_practice_pool_is_missing():
    data = copy.deepcopy(curriculum()["calculus"])
    data["lessons"][0]["questions"] = [
        question for question in data["lessons"][0]["questions"] if question["exam"]
    ]
    with pytest.raises(HTTPException, match="balanced diagnostic") as error:
        diagnostics.select_diagnostic_questions(data)
    assert error.value.status_code == 409
