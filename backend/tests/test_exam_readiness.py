import json
from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from app.api import learning
from app.db.base import RoadmapAssessmentSession, RoadmapQuestionAttempt, RoadmapTopicProgress, User
from app.db.session import SessionLocal
from app.services.curriculum import curriculum, questions_for

NOW = datetime(2026, 2, 1, 12)


def initialize(client, monkeypatch):
    monkeypatch.setattr(learning, "utc_now", lambda: NOW)
    client.get("/api/stats")


def seed_set(
    db,
    *,
    slug="calculus",
    index=0,
    correct=None,
    hints=None,
    legacy=False,
    mode="practice",
    owner=1,
    row_user=1,
    rows=8,
    duplicate=False,
    foreign_id=False,
    wrong_topic=False,
    result=True,
    completed=True,
    stage=0,
):
    lesson = curriculum()[slug]["lessons"][index]
    questions = [item for item in lesson["questions"] if not item["exam"]]
    ids = [item["id"] for item in questions]
    header = list(ids)
    if duplicate:
        header[-1] = header[0]
    if foreign_id:
        header[-1] = next(item["id"] for item in lesson["questions"] if item["exam"])
    correct = set(range(8)) if correct is None else set(correct)
    hints = [0] * 8 if hints is None else hints
    usage = {
        ids[position]: count
        for position, count in enumerate(hints)
        if type(count) is int and count > 0
    }
    session = RoadmapAssessmentSession(
        id=str(uuid4()),
        user_id=owner,
        roadmap_slug=slug,
        topic_slug=lesson["topic_slug"],
        stage_index=stage,
        mode=mode,
        question_ids=header,
        hint_usage=None if legacy else usage,
        expires_at=NOW - timedelta(hours=1),
        completed_at=NOW - timedelta(days=1) if completed else None,
        result={
            "score": 100,
            "passed": True,
            "independent_score": 100,
            "independent_passed": True,
            "feedback": [
                {
                    "question_id": item["id"],
                    "prompt": item["prompt"],
                    "submitted_answer": item["answer"],
                    "expected_answer": item["answer"],
                }
                for item in questions
            ],
        }
        if result
        else None,
    )
    db.add(session)
    db.flush()
    for position, question in enumerate(questions[:rows]):
        db.add(
            RoadmapQuestionAttempt(
                user_id=row_user,
                session_id=session.id,
                roadmap_slug=slug,
                topic_slug="wrong-topic" if wrong_topic and position == 0 else lesson["topic_slug"],
                question_id=question["id"],
                concept=question["concept"],
                answer=question["answer"],
                correct=position in correct,
                hints_used=hints[position],
                created_at=NOW - timedelta(days=1),
            )
        )
    return session


def checklist(client, slug="calculus"):
    response = client.get(f"/api/roadmaps/{slug}/exam-readiness")
    assert response.status_code == 200
    return response.json()


@pytest.mark.parametrize(
    "slug", ["calculus", "linear-algebra", "probability", "real-analysis", "discrete-math"]
)
def test_all_five_blueprints_are_balanced_private_and_initially_not_ready(
    client, monkeypatch, slug
):
    initialize(client, monkeypatch)
    result = checklist(client, slug)
    assert (
        not result["eligible"] and result["ready_lessons"] == 0 and result["required_lessons"] == 6
    )
    assert all(
        item["practice_count"] == 8 and item["exam_count"] == 2 for item in result["lessons"]
    )
    assert all(
        item["status"] == "practice_needed" and item["best_score"] is None
        for item in result["lessons"]
    )
    blueprint = result["blueprint"]
    assert (
        blueprint["total_questions"]
        == sum(blueprint["kinds"].values())
        == sum(blueprint["difficulties"].values())
        == 12
    )
    assert not blueprint["hints_allowed"]
    serialized = json.dumps(result)
    for lesson in curriculum()[slug]["lessons"]:
        for question in lesson["questions"]:
            if question["exam"]:
                assert question["id"] not in serialized
                assert question["prompt"] not in serialized
    assert not {
        "answer",
        "solution",
        "hints",
        "choices",
        "proof_dependencies",
        "proof_rationales",
    }.intersection(blueprint)


def test_forged_progress_and_result_flags_without_saved_complete_answers_do_not_unlock(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        for index, lesson in enumerate(curriculum()["calculus"]["lessons"]):
            db.add(
                RoadmapTopicProgress(
                    user_id=1,
                    roadmap_slug="calculus",
                    topic_slug=lesson["topic_slug"],
                    mastery_version=1,
                    status="completed",
                    quiz_score=100,
                    independent_score=100,
                )
            )
            seed_set(db, index=index, rows=0)
        db.commit()
    result = checklist(client)
    assert not result["eligible"]
    assert all(
        item["status"] == "outdated" and item["best_independent_score"] is None
        for item in result["lessons"]
    )
    denied = client.post("/api/roadmaps/calculus/assessments", json={"mode": "exam"})
    assert denied.status_code == 409
    assert "75% independently correct" in denied.json()["detail"]


@pytest.mark.parametrize(
    "options",
    [
        {"rows": 7},
        {"duplicate": True},
        {"foreign_id": True},
        {"wrong_topic": True},
        {"row_user": 2},
    ],
)
def test_missing_duplicate_or_wrong_membership_answer_records_fail_closed(
    client, monkeypatch, options
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        db.add(User(id=2, name="Other user"))
        seed_set(db, **options)
        db.commit()
    lesson = checklist(client)["lessons"][0]
    assert lesson["status"] == "outdated"
    assert lesson["best_score"] is lesson["best_independent_score"] is None
    assert lesson["outdated_attempts"] == 1


@pytest.mark.parametrize(
    "options",
    [
        {"mode": "review"},
        {"mode": "exam"},
        {"completed": False},
        {"result": False},
        {"owner": 2},
        {"stage": 9},
    ],
)
def test_reviews_exams_incomplete_expired_or_unowned_sessions_do_not_grant_readiness(
    client, monkeypatch, options
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        db.add(User(id=2, name="Other user"))
        seed_set(db, **options)
        db.commit()
    lesson = checklist(client)["lessons"][0]
    assert lesson["status"] == "practice_needed"
    assert lesson["completed_attempts"] == 0


def test_correctness_is_recomputed_per_complete_set_not_from_result_flags_or_cherrypicked_answers(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        seed_set(db, correct=[0, 1, 2, 3])
        seed_set(db, correct=[4, 5, 6, 7])
        db.commit()
    lesson = checklist(client)["lessons"][0]
    assert lesson["best_score"] == lesson["best_independent_score"] == 50
    assert lesson["status"] == "practice_needed"


@pytest.mark.parametrize(
    "correct,hints,expected,status",
    [
        (range(8), [1, 1, 1, 0, 0, 0, 0, 0], 62, "independent_needed"),
        (range(8), [1, 1, 0, 0, 0, 0, 0, 0], 75, "ready"),
        (range(6), [0] * 8, 75, "ready"),
        (range(5), [0] * 8, 62, "practice_needed"),
        (range(8), [1] * 8, 0, "independent_needed"),
    ],
)
def test_six_unhinted_correct_answers_qualify_but_five_do_not(
    client, monkeypatch, correct, hints, expected, status
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        seed_set(db, correct=correct, hints=hints)
        db.commit()
    lesson = checklist(client)["lessons"][0]
    assert lesson["best_independent_score"] == expected
    assert lesson["status"] == status


def test_legacy_unknown_hint_usage_and_inconsistent_hint_records_are_untracked(client, monkeypatch):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        seed_set(db, legacy=True)
        inconsistent = seed_set(db, index=1)
        inconsistent.hint_usage = {inconsistent.question_ids[0]: 1}
        db.commit()
    result = checklist(client)
    for lesson in result["lessons"][:2]:
        assert lesson["best_score"] == 100
        assert lesson["best_independent_score"] is None
        assert lesson["status"] == "untracked" and lesson["untracked_attempts"] == 1


def test_best_qualifying_set_is_preserved_after_a_later_failed_attempt(client, monkeypatch):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        seed_set(db, correct=range(6))
        failed = seed_set(db, correct=[])
        failed.completed_at = NOW
        db.commit()
    lesson = checklist(client)["lessons"][0]
    assert lesson["best_score"] == lesson["best_independent_score"] == 75
    assert lesson["completed_attempts"] == 2 and lesson["status"] == "ready"
    assert lesson["last_attempt_at"] == NOW.isoformat() + "Z"


def test_all_six_lessons_require_a_qualifying_set_even_when_five_are_ready(client, monkeypatch):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        for index in range(5):
            seed_set(db, index=index)
        db.commit()
    assert checklist(client)["ready_lessons"] == 5
    assert (
        client.post("/api/roadmaps/calculus/assessments", json={"mode": "exam"}).status_code == 409
    )
    with SessionLocal() as db:
        seed_set(db, index=5, correct=range(6))
        db.commit()
    assert checklist(client)["eligible"]
    assert (
        client.post("/api/roadmaps/calculus/assessments", json={"mode": "exam"}).status_code == 201
    )


def test_actual_saved_practice_and_hint_flows_unlock_exam_with_six_independent_seventy_five_scores(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    slug = "probability"
    bank = questions_for(slug)
    for lesson in curriculum()[slug]["lessons"]:
        response = client.post(
            f"/api/roadmaps/{slug}/assessments",
            json={"mode": "practice", "topic_slug": lesson["topic_slug"]},
        )
        assert response.status_code == 201
        session = response.json()
        for question in session["questions"][:2]:
            assert (
                client.post(
                    f"/api/roadmaps/assessments/{session['id']}/questions/{question['id']}/hints",
                    json={"index": 1},
                ).status_code
                == 200
            )
        result = client.post(
            f"/api/roadmaps/assessments/{session['id']}/submit",
            json={
                "answers": [
                    {"question_id": question["id"], "answer": bank[question["id"]]["answer"]}
                    for question in session["questions"]
                ]
            },
        )
        assert result.status_code == 200
        assert result.json()["score"] == 100 and result.json()["independent_score"] == 75
    readiness = checklist(client, slug)
    assert readiness["eligible"] and readiness["ready_lessons"] == 6
    assert all(
        item["best_score"] == 100 and item["best_independent_score"] == 75
        for item in readiness["lessons"]
    )
    exam = client.post(f"/api/roadmaps/{slug}/assessments", json={"mode": "exam"})
    assert exam.status_code == 201 and len(exam.json()["questions"]) == 12


def test_already_created_exam_can_be_recovered_and_submitted_without_new_prerequisites(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    slug = "calculus"
    bank = questions_for(slug)
    reserved = [qid for qid, question in bank.items() if question["exam"]]
    with SessionLocal() as db:
        session = RoadmapAssessmentSession(
            id=str(uuid4()),
            user_id=1,
            roadmap_slug=slug,
            mode="exam",
            question_ids=reserved,
            hint_usage={},
            expires_at=NOW + timedelta(hours=1),
        )
        db.add(session)
        db.commit()
        session_id = session.id
    assert not checklist(client)["eligible"]
    recovered = client.get(f"/api/roadmaps/assessments/{session_id}")
    assert recovered.status_code == 200
    result = client.post(
        f"/api/roadmaps/assessments/{session_id}/submit",
        json={"answers": [{"question_id": qid, "answer": bank[qid]["answer"]} for qid in reserved]},
    )
    assert result.status_code == 200 and result.json()["score"] == 100
    assert client.get(f"/api/roadmaps/assessments/{session_id}").json()["result"] == result.json()


def test_unknown_roadmaps_and_unreleased_stages_return_clear_errors(client, monkeypatch):
    initialize(client, monkeypatch)
    assert client.get("/api/roadmaps/unknown/exam-readiness").status_code == 404
    assert client.get("/api/roadmaps/calculus/exam-readiness?stage_index=1").status_code == 404
    assert client.get("/api/roadmaps/calculus/exam-readiness?stage_index=10").status_code == 422
