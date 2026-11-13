import json
from datetime import timedelta

import pytest
from sqlalchemy import event, func, insert, select

from app.api import learning
from app.db.base import (
    RoadmapAssessmentSession,
    RoadmapQuestionAttempt,
    RoadmapTopicProgress,
    User,
    utc_now,
)
from app.db.session import SessionLocal, engine
from app.services.curriculum import curriculum, questions_for


def start(client):
    slug = "calculus"
    topic = curriculum()[slug]["lessons"][0]["topic_slug"]
    response = client.post(
        f"/api/roadmaps/{slug}/assessments", json={"mode": "practice", "topic_slug": topic}
    )
    assert response.status_code == 201
    return response.json(), questions_for(slug)


def hint(client, session, question_id, index=1):
    return client.post(
        f"/api/roadmaps/assessments/{session['id']}/questions/{question_id}/hints",
        json={"index": index},
    )


def answers(session, bank, wrong_ids=()):
    result = []
    for public in session["questions"]:
        question = bank[public["id"]]
        answer = question["answer"]
        if question["id"] in wrong_ids:
            if question["kind"] == "number":
                answer += 20
            elif question["kind"] == "choice":
                answer = next(choice for choice in question["choices"] if choice != answer)
            elif question["kind"] == "vector":
                answer = [value + 20 for value in answer]
            else:
                raise AssertionError("Add an explicit wrong-answer rule for this question kind")
        result.append({"question_id": question["id"], "answer": answer})
    return result


def submit(client, session, bank, wrong_ids=(), seconds=0):
    return client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={"answers": answers(session, bank, wrong_ids), "time_spent_seconds": seconds},
    )


def test_hints_are_private_until_sequential_reveal_and_recover_only_revealed_prefix(client):
    session, bank = start(client)
    target = session["questions"][0]["id"]
    assert session["hint_usage"] == {}
    assert all(
        question["hints"] == [] and question["hint_count"] >= 2 for question in session["questions"]
    )
    assert hint(client, session, target, 2).status_code == 409
    first = hint(client, session, target)
    assert first.status_code == 200
    assert first.json()["hints"] == bank[target]["hints"][:1]
    duplicate = hint(client, session, target)
    assert duplicate.json() == first.json()
    with SessionLocal() as db:
        assert db.get(RoadmapAssessmentSession, session["id"]).hint_revision == 1
    recovered = client.get(f"/api/roadmaps/assessments/{session['id']}").json()
    public = next(question for question in recovered["questions"] if question["id"] == target)
    assert public["hints"] == bank[target]["hints"][:1]
    second = hint(client, session, target, 2)
    assert second.json()["hints"] == bank[target]["hints"][:2]
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 0
        assert db.scalar(select(func.count()).select_from(RoadmapTopicProgress)) == 0


@pytest.mark.parametrize("index", [0, -1, 65, True, 1.0])
def test_hint_indices_are_bounded_strict_integers(client, index):
    session, _ = start(client)
    assert hint(client, session, session["questions"][0]["id"], index).status_code == 422


def test_membership_exam_expiry_ownership_and_completed_guards_prevent_hint_mutation(client):
    session, bank = start(client)
    target = session["questions"][0]["id"]
    reserved = next(question_id for question_id, question in bank.items() if question["exam"])
    assert hint(client, session, reserved).status_code == 404
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        row.mode = "exam"
        db.commit()
    assert hint(client, session, target).status_code == 409
    recovered = client.get(f"/api/roadmaps/assessments/{session['id']}").json()
    assert all(
        question["hints"] == [] and question["hint_count"] == 0
        for question in recovered["questions"]
    )
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        row.mode = "practice"
        row.expires_at = utc_now() - timedelta(seconds=1)
        db.commit()
    assert hint(client, session, target).status_code == 410
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        row.expires_at = utc_now() + timedelta(hours=1)
        other = User(name="Other learner")
        db.add(other)
        db.flush()
        row.user_id = other.id
        db.commit()
    assert hint(client, session, target).status_code == 404
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        row.user_id = 1
        row.completed_at = utc_now()
        row.result = {"score": 100}
        db.commit()
    assert hint(client, session, target).status_code == 409
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        assert row.hint_usage == {}
        assert row.hint_revision == 0


@pytest.mark.parametrize("hinted_questions,expected", [(0, 100), (2, 75), (8, 0)])
def test_independent_score_counts_correct_questions_without_hints(
    client, hinted_questions, expected
):
    session, bank = start(client)
    for question in session["questions"][:hinted_questions]:
        assert hint(client, session, question["id"]).status_code == 200
    response = submit(client, session, bank)
    assert response.status_code == 200
    result = response.json()
    assert result["score"] == 100
    assert result["independent_score"] == expected
    assert result["independent_passed"] is (expected >= 75)
    assert result["assistance"] == ("assisted" if hinted_questions else "independent")
    assert result["progress"]["independent_score"] == expected
    assert sum(item["hints_used"] > 0 for item in result["feedback"]) == hinted_questions
    with SessionLocal() as db:
        rows = list(db.scalars(select(RoadmapQuestionAttempt)))
        assert sum(row.hints_used > 0 for row in rows) == hinted_questions


def test_two_hints_on_one_correct_question_deduct_one_question_not_two(client):
    session, bank = start(client)
    target = session["questions"][0]["id"]
    assert hint(client, session, target, 1).status_code == 200
    assert hint(client, session, target, 2).status_code == 200
    result = submit(client, session, bank).json()
    assert result["hints_used"] == 2
    assert result["independent_score"] == 88


def test_hints_on_wrong_question_do_not_deduct_independent_credit_twice(client):
    session, bank = start(client)
    target = next(
        question["id"] for question in session["questions"] if question["kind"] == "number"
    )
    assert hint(client, session, target).status_code == 200
    result = submit(client, session, bank, [target]).json()
    assert result["score"] == result["independent_score"] == 88
    assert (
        next(item for item in result["feedback"] if item["question_id"] == target)["assistance"]
        == "assisted"
    )


def test_legacy_unknown_hint_usage_is_not_backfilled_as_independent(client):
    session, bank = start(client)
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        row.hint_usage = None
        db.commit()
    target = session["questions"][0]["id"]
    assert hint(client, session, target).status_code == 409
    result = submit(client, session, bank).json()
    assert result["score"] == 100
    assert result["assistance"] == "untracked"
    assert result["independent_score"] is None
    assert result["independent_passed"] is None
    assert result["progress"]["independent_score"] is None
    assert all(
        item["assistance"] == "untracked" and item["hints_used"] is None
        for item in result["feedback"]
    )
    with SessionLocal() as db:
        assert all(row.hints_used is None for row in db.scalars(select(RoadmapQuestionAttempt)))


def test_draft_saves_cannot_erase_revealed_hint_evidence(client):
    session, _ = start(client)
    url = f"/api/roadmaps/assessments/{session['id']}/draft"
    assert client.put(url, json={"answers": [], "revision": 1}).status_code == 200
    target = session["questions"][0]["id"]
    assert hint(client, session, target).status_code == 200
    assert client.put(url, json={"answers": [], "revision": 2}).status_code == 200
    assert client.put(url, json={"answers": [], "revision": 0}).status_code == 409
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        assert row.hint_usage == {target: 1}
        assert row.hint_revision == 1


def test_client_cannot_claim_independent_scores_or_override_hint_usage(client):
    session, bank = start(client)
    target = session["questions"][0]["id"]
    assert hint(client, session, target).status_code == 200
    body = {"answers": answers(session, bank), "hint_usage": {}, "independent_score": 100}
    assert (
        client.post(f"/api/roadmaps/assessments/{session['id']}/submit", json=body).status_code
        == 422
    )
    assert (
        client.put(
            f"/api/roadmaps/assessments/{session['id']}/draft",
            json={"answers": [], "hint_usage": {}, "revision": 1},
        ).status_code
        == 422
    )
    topic = curriculum()["calculus"]["lessons"][0]["topic_slug"]
    assert (
        client.patch(
            f"/api/roadmaps/calculus/topics/{topic}",
            json={"status": "in_progress", "independent_score": 100},
        ).status_code
        == 422
    )
    assert submit(client, session, bank).json()["independent_score"] == 88


def test_hint_committing_after_submit_read_forces_retry_without_false_independent_evidence(
    client, monkeypatch
):
    session, bank = start(client)
    target = session["questions"][0]["id"]
    original = learning.grade
    fired = False

    def reveal_during_grading(question, answer):
        nonlocal fired
        if not fired:
            fired = True
            with SessionLocal() as db:
                row = db.get(RoadmapAssessmentSession, session["id"])
                row.hint_usage = {target: 1}
                row.hint_revision += 1
                db.commit()
        return original(question, answer)

    monkeypatch.setattr(learning, "grade", reveal_during_grading)
    raced = submit(client, session, bank)
    assert raced.status_code == 409
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 0
        assert db.scalar(select(func.count()).select_from(RoadmapTopicProgress)) == 0
    monkeypatch.setattr(learning, "grade", original)
    retried = submit(client, session, bank)
    assert retried.status_code == 200
    assert retried.json()["assistance"] == "assisted"
    assert retried.json()["independent_score"] == 88


@pytest.mark.parametrize("same_question", [False, True])
def test_hint_cas_merges_other_question_and_duplicate_requests_without_losing_counts(
    client, monkeypatch, same_question
):
    session, _ = start(client)
    target = session["questions"][0]["id"]
    other = target if same_question else session["questions"][1]["id"]
    original = learning.update
    fired = False

    def competing_update(model):
        nonlocal fired
        if model is RoadmapAssessmentSession and not fired:
            fired = True
            with SessionLocal() as db:
                row = db.get(RoadmapAssessmentSession, session["id"])
                row.hint_usage = {other: 1}
                row.hint_revision = 1
                db.commit()
        return original(model)

    monkeypatch.setattr(learning, "update", competing_update)
    response = hint(client, session, target)
    assert response.status_code == 200
    expected = {other: 1, target: 1}
    assert response.json()["hint_usage"] == expected
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        assert row.hint_usage == expected
        assert row.hint_revision == (1 if same_question else 2)


def test_final_submission_winning_race_prevents_hint_text_from_being_returned(client, monkeypatch):
    session, bank = start(client)
    target = session["questions"][0]["id"]
    original = learning.update
    fired = False

    def complete_before_reveal(model):
        nonlocal fired
        if model is RoadmapAssessmentSession and not fired:
            fired = True
            with SessionLocal() as db:
                row = db.get(RoadmapAssessmentSession, session["id"])
                row.completed_at = utc_now()
                row.result = {"score": 100}
                db.commit()
        return original(model)

    monkeypatch.setattr(learning, "update", complete_before_reveal)
    response = hint(client, session, target)
    assert response.status_code == 409
    assert bank[target]["hints"][0] not in response.text
    with SessionLocal() as db:
        assert db.get(RoadmapAssessmentSession, session["id"]).hint_usage == {}


def test_overlapping_different_sessions_cannot_lower_best_scores_or_lose_counts_and_time(client):
    stale, bank = start(client)
    winner, _ = start(client)
    topic = curriculum()["calculus"]["lessons"][0]["topic_slug"]
    with SessionLocal() as db:
        db.add(
            RoadmapTopicProgress(
                user_id=1,
                roadmap_slug="calculus",
                topic_slug=topic,
                mastery_version=1,
                quiz_score=0,
                quiz_attempts=0,
                independent_score=0,
                time_spent_seconds=10,
                status="in_progress",
            )
        )
        db.commit()
    fired = False

    def complete_winner_behind_stale_orm(
        connection, cursor, statement, parameters, context, executemany
    ):
        nonlocal fired
        if fired or not statement.lower().startswith("update roadmap_topic_progress"):
            return
        fired = True
        # Simulate another session completing after the stale request loaded
        # history and progress, immediately before its atomic progress UPDATE.
        now = utc_now()
        connection.exec_driver_sql(
            "UPDATE roadmap_topic_progress SET quiz_score=100, independent_score=100, "
            "quiz_attempts=quiz_attempts+1, time_spent_seconds=time_spent_seconds+60, "
            "status='completed', completed_at=? WHERE user_id=1 AND topic_slug=?",
            (now, topic),
        )
        connection.exec_driver_sql(
            "UPDATE roadmap_assessment_sessions SET result=?,completed_at=? WHERE id=?",
            (
                json.dumps({"score": 100, "passed": True, "independent_score": 100}),
                now,
                winner["id"],
            ),
        )
        connection.execute(
            insert(RoadmapQuestionAttempt),
            [
                {
                    "user_id": 1,
                    "session_id": winner["id"],
                    "roadmap_slug": "calculus",
                    "topic_slug": topic,
                    "question_id": question["id"],
                    "concept": bank[question["id"]]["concept"],
                    "answer": bank[question["id"]]["answer"],
                    "correct": True,
                    "hints_used": 0,
                    "created_at": now,
                }
                for question in winner["questions"]
            ],
        )

    event.listen(engine, "before_cursor_execute", complete_winner_behind_stale_orm)
    try:
        response = submit(
            client, stale, bank, [question["id"] for question in stale["questions"]], seconds=40
        )
    finally:
        event.remove(engine, "before_cursor_execute", complete_winner_behind_stale_orm)
    assert fired
    assert response.status_code == 200
    assert response.json()["score"] == response.json()["independent_score"] == 0
    saved = response.json()["progress"]
    assert saved["quiz_score"] == saved["independent_score"] == 100
    assert saved["quiz_attempts"] == 2
    assert saved["time_spent_seconds"] == 110
    assert saved["status"] == "completed"
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 16


def test_best_independent_score_and_result_metadata_survive_later_assisted_attempt(client):
    clean, bank = start(client)
    first = submit(client, clean, bank).json()
    assisted, _ = start(client)
    for question in assisted["questions"]:
        hint(client, assisted, question["id"])
    second = submit(client, assisted, bank).json()
    assert second["independent_score"] == 0
    assert second["progress"]["independent_score"] == 100
    assert client.get(f"/api/roadmaps/assessments/{clean['id']}").json()["result"] == first
    assert submit(client, clean, bank).json() == first
