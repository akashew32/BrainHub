from datetime import timedelta

import pytest
from sqlalchemy import func, select

from app.db.base import (
    RoadmapAssessmentSession,
    RoadmapQuestionAttempt,
    RoadmapTopicProgress,
    User,
    utc_now,
)
from app.db.session import SessionLocal
from app.services.curriculum import curriculum, questions_for


def start_practice(client, slug="calculus"):
    topic = curriculum()[slug]["lessons"][0]["topic_slug"]
    response = client.post(
        f"/api/roadmaps/{slug}/assessments", json={"mode": "practice", "topic_slug": topic}
    )
    assert response.status_code == 201
    return response.json()


def test_partial_draft_survives_recovery_without_grading_or_progress(client):
    session = start_practice(client)
    assert session["draft"] == {"answers": [], "time_spent_seconds": 0, "revision": 0}
    question_id = session["questions"][0]["id"]
    # A partial numeric string is valuable work in progress, even though it is
    # not yet a valid final mathematical answer.
    draft = {
        "answers": [{"question_id": question_id, "answer": "-"}],
        "time_spent_seconds": 37,
        "revision": 1,
    }
    saved = client.put(f"/api/roadmaps/assessments/{session['id']}/draft", json=draft)
    assert saved.status_code == 200
    assert saved.json()["draft"] == draft
    recovered = client.get(f"/api/roadmaps/assessments/{session['id']}")
    assert recovered.status_code == 200
    assert recovered.json()["draft"] == draft
    assert [question["id"] for question in recovered.json()["questions"]] == [
        question["id"] for question in session["questions"]
    ]
    assert "result" not in recovered.json()
    assert all(
        "answer" not in question and "solution" not in question
        for question in recovered.json()["questions"]
    )
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 0
        assert db.scalar(select(func.count()).select_from(RoadmapTopicProgress)) == 0
        assert db.get(RoadmapAssessmentSession, session["id"]).draft == draft


def test_newer_draft_rejects_late_older_save_and_idempotent_retry_is_safe(client):
    session = start_practice(client)
    url = f"/api/roadmaps/assessments/{session['id']}/draft"
    first_id = session["questions"][0]["id"]
    newest = {
        "answers": [{"question_id": first_id, "answer": "3/4"}],
        "time_spent_seconds": 55,
        "revision": 2,
    }
    assert client.put(url, json=newest).status_code == 200
    assert client.put(url, json=newest).json()["draft"] == newest
    stale = {**newest, "answers": [{"question_id": first_id, "answer": "1/4"}], "revision": 1}
    assert client.put(url, json=stale).status_code == 409
    assert client.put(url, json={**stale, "revision": 2}).status_code == 409
    assert client.get(url.removesuffix("/draft")).json()["draft"] == newest


def test_empty_newer_draft_clears_answers_but_saved_time_does_not_regress(client):
    session = start_practice(client)
    url = f"/api/roadmaps/assessments/{session['id']}/draft"
    draft = {
        "answers": [{"question_id": session["questions"][0]["id"], "answer": [1, 2]}],
        "time_spent_seconds": 50,
        "revision": 1,
    }
    assert client.put(url, json=draft).status_code == 200
    cleared = client.put(url, json={"answers": [], "time_spent_seconds": 12, "revision": 2})
    assert cleared.status_code == 200
    assert cleared.json()["draft"] == {
        "answers": [],
        "time_spent_seconds": 50,
        "revision": 2,
    }


@pytest.mark.parametrize(
    "invalid",
    [
        {"answers": [{"question_id": "unrelated", "answer": 1}]},
        {"answers": [], "score": 100},
        {"answers": [], "revision": -1},
        {"answers": [], "time_spent_seconds": 7201},
        {"answers": [{"question_id": "placeholder", "answer": 1, "correct": True}]},
        {"answers": [{"question_id": "placeholder", "answer": {"code": "ignored"}}]},
    ],
)
def test_draft_rejects_unknown_fields_unrelated_ids_and_unbounded_data(client, invalid):
    session = start_practice(client)
    response = client.put(f"/api/roadmaps/assessments/{session['id']}/draft", json=invalid)
    assert response.status_code == 422
    assert client.get(f"/api/roadmaps/assessments/{session['id']}").json()["draft"]["answers"] == []


def test_duplicate_question_ids_are_rejected_without_changing_draft(client):
    session = start_practice(client)
    answer = {"question_id": session["questions"][0]["id"], "answer": "1/2"}
    response = client.put(
        f"/api/roadmaps/assessments/{session['id']}/draft",
        json={"answers": [answer, answer], "revision": 1},
    )
    assert response.status_code == 422
    assert client.get(f"/api/roadmaps/assessments/{session['id']}").json()["draft"]["answers"] == []


def test_expired_unfinished_session_cannot_be_recovered_or_changed(client):
    session = start_practice(client)
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        row.expires_at = utc_now() - timedelta(seconds=1)
        db.commit()
    url = f"/api/roadmaps/assessments/{session['id']}"
    assert client.get(url).status_code == 410
    assert client.put(f"{url}/draft", json={"answers": [], "revision": 1}).status_code == 410


def test_recovery_and_drafts_do_not_expose_another_users_assessment(client):
    session = start_practice(client)
    with SessionLocal() as db:
        other = User(name="Other learner")
        db.add(other)
        db.flush()
        row = db.get(RoadmapAssessmentSession, session["id"])
        row.user_id = other.id
        db.commit()
    url = f"/api/roadmaps/assessments/{session['id']}"
    assert client.get(url).status_code == 404
    assert client.put(f"{url}/draft", json={"answers": [], "revision": 1}).status_code == 404


def test_completed_session_recovers_result_but_rejects_draft_writes(client):
    session = start_practice(client)
    bank = questions_for(session["roadmap_slug"])
    response = client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={
            "answers": [
                {"question_id": question["id"], "answer": bank[question["id"]]["answer"]}
                for question in session["questions"]
            ]
        },
    )
    assert response.status_code == 200
    result = response.json()
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        row.expires_at = utc_now() - timedelta(days=1)
        db.commit()
    url = f"/api/roadmaps/assessments/{session['id']}"
    recovered = client.get(url)
    assert recovered.status_code == 200
    assert recovered.json()["result"] == result
    assert client.put(f"{url}/draft", json={"answers": [], "revision": 3}).status_code == 409
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 8


def test_recovered_exam_never_discloses_hints_or_unsubmitted_solutions(client):
    session = start_practice(client)
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        row.mode = "exam"
        db.commit()
    recovered = client.get(f"/api/roadmaps/assessments/{session['id']}").json()
    assert all(question["hints"] == [] for question in recovered["questions"])
    assert all(
        not {"answer", "solution", "accepted_orders"}.intersection(question)
        for question in recovered["questions"]
    )
