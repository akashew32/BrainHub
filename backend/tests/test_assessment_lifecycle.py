"""Assessment assignment stability, lifecycle and idempotent start integration."""

import copy
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.api import learning
from app.db.base import RoadmapAssessmentSession, RoadmapQuestionAttempt, User
from app.db.session import SessionLocal
from app.services import exam_readiness
from app.services.curriculum import curriculum, questions_for

NOW = datetime(2026, 3, 1, 12)
SLUG = "calculus"


def start(client, monkeypatch, *, request_id=None, index=0, **options):
    monkeypatch.setattr(learning, "utc_now", lambda: NOW)
    topic = curriculum()[SLUG]["lessons"][index]["topic_slug"]
    payload = {"mode": "practice", "topic_slug": topic, **options}
    if request_id is not None:
        payload["request_id"] = request_id
    response = client.post(f"/api/roadmaps/{SLUG}/assessments", json=payload)
    assert response.status_code == 201, response.text
    return response.json(), payload


def answers(session, bank=None):
    bank = questions_for(SLUG) if bank is None else bank
    return [
        {"question_id": item["id"], "answer": bank[item["id"]]["answer"]}
        for item in session["questions"]
    ]


def submit(client, session, bank=None):
    return client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={"answers": answers(session, bank)},
    )


def test_start_request_replays_same_assignment_deadline_and_choice_presentation(
    client, monkeypatch
):
    token = str(uuid4())
    session, payload = start(client, monkeypatch, request_id=token)
    assert session["request_id"] == token
    assert session["state"] == "active" and session["questions_available"]
    assert session["server_now"] == NOW.isoformat() + "Z"
    assert session["expires_in_seconds"] == 7200
    replay = client.post(f"/api/roadmaps/{SLUG}/assessments", json=payload)
    assert replay.status_code == 200 and replay.json() == session
    assert client.get(f"/api/roadmaps/assessments/{session['id']}").json() == session
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        assert row.question_snapshot["version"] == 1
        assert len(row.question_snapshot["questions"]) == 8
        assert db.scalar(select(func.count()).select_from(RoadmapAssessmentSession)) == 1
    for question in session["questions"]:
        assert not {
            "answer",
            "solution",
            "proof_dependencies",
            "proof_rationales",
            "fingerprint",
            "definition",
        }.intersection(question)


@pytest.mark.parametrize(
    "change", [{"mode": "exam"}, {"stage_index": 1}, {"topic_slug": "another-topic"}]
)
def test_reused_request_context_conflicts_before_new_gates(client, monkeypatch, change):
    _, payload = start(client, monkeypatch, request_id=str(uuid4()))
    response = client.post(f"/api/roadmaps/{SLUG}/assessments", json={**payload, **change})
    assert response.status_code == 409
    assert "different assessment" in response.json()["detail"]
    assert client.post("/api/roadmaps/missing/assessments", json=payload).status_code == 409


@pytest.mark.parametrize("request_id", ["not-a-uuid", 7, True, ""])
def test_request_id_requires_uuid(client, monkeypatch, request_id):
    monkeypatch.setattr(learning, "utc_now", lambda: NOW)
    response = client.post(f"/api/roadmaps/{SLUG}/assessments", json={"request_id": request_id})
    assert response.status_code == 422


def test_request_ids_are_scoped_to_owner_and_unowned_session_stays_private(client, monkeypatch):
    token = str(uuid4())
    session, payload = start(client, monkeypatch, request_id=token)
    with SessionLocal() as db:
        other = User(name="Other")
        db.add(other)
        db.flush()
        db.get(RoadmapAssessmentSession, session["id"]).user_id = other.id
        db.commit()
    assert client.get(f"/api/roadmaps/assessments/{session['id']}").status_code == 404
    fresh = client.post(f"/api/roadmaps/{SLUG}/assessments", json=payload)
    assert fresh.status_code == 201 and fresh.json()["id"] != session["id"]


def test_frozen_keys_prompts_hints_and_choices_survive_current_bank_edit_and_removal(
    client, monkeypatch
):
    original = copy.deepcopy(questions_for(SLUG))
    session, payload = start(client, monkeypatch, request_id=str(uuid4()))
    first = session["questions"][0]["id"]
    edited = copy.deepcopy(original)
    edited[first]["prompt"] = "A replacement question"
    edited[first]["answer"] = "A replacement answer"
    edited[first]["hints"] = ["A replacement hint"]
    monkeypatch.setattr(learning, "questions_for", lambda _: edited)
    recovered = client.get(f"/api/roadmaps/assessments/{session['id']}").json()
    assert recovered["questions"] == session["questions"]
    hinted = client.post(
        f"/api/roadmaps/assessments/{session['id']}/questions/{first}/hints", json={"index": 1}
    )
    assert hinted.status_code == 200
    assert hinted.json()["hints"] == original[first]["hints"][:1]
    monkeypatch.setattr(learning, "questions_for", lambda _: {})
    monkeypatch.setattr(learning, "curriculum", lambda: {})
    replay = client.post(f"/api/roadmaps/{SLUG}/assessments", json=payload)
    assert replay.status_code == 200
    result = submit(client, session, original)
    assert result.status_code == 200 and result.json()["score"] == 100
    assert (
        next(item for item in result.json()["feedback"] if item["question_id"] == first)["prompt"]
        == original[first]["prompt"]
    )
    recovered = client.get(f"/api/roadmaps/assessments/{session['id']}").json()
    assert recovered["result"] == result.json() and recovered["state"] == "completed"


def test_deadline_equality_is_readonly_for_every_write_and_replay_never_allocates(
    client, monkeypatch
):
    session, payload = start(client, monkeypatch, request_id=str(uuid4()))
    first = session["questions"][0]["id"]
    deadline = NOW + timedelta(hours=2)
    monkeypatch.setattr(learning, "utc_now", lambda: deadline - timedelta(microseconds=1))
    almost = client.get(f"/api/roadmaps/assessments/{session['id']}").json()
    assert almost["state"] == "active" and 0 < almost["expires_in_seconds"] < 1
    monkeypatch.setattr(learning, "utc_now", lambda: deadline)
    url = f"/api/roadmaps/assessments/{session['id']}"
    expired = client.get(url)
    assert expired.status_code == 200
    assert expired.json()["state"] == "expired" and expired.json()["expires_in_seconds"] == 0
    assert client.put(url + "/draft", json={"revision": 1}).status_code == 410
    assert client.post(url + f"/questions/{first}/hints", json={"index": 1}).status_code == 410
    assert submit(client, session).status_code == 410
    replay = client.post(f"/api/roadmaps/{SLUG}/assessments", json=payload)
    assert replay.status_code == 200 and replay.json()["id"] == session["id"]
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapAssessmentSession)) == 1
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 0


def test_completed_legacy_archived_result_recovers_without_question_membership(client, monkeypatch):
    session, payload = start(client, monkeypatch, request_id=str(uuid4()))
    result = submit(client, session).json()
    with SessionLocal() as db:
        db.get(RoadmapAssessmentSession, session["id"]).question_snapshot = None
        db.commit()
    monkeypatch.setattr(learning, "questions_for", lambda _: {})
    monkeypatch.setattr(learning, "curriculum", lambda: {})
    recovered = client.get(f"/api/roadmaps/assessments/{session['id']}")
    assert recovered.status_code == 200
    assert recovered.json()["questions"] == [] and not recovered.json()["questions_available"]
    assert recovered.json()["state"] == "completed" and recovered.json()["result"] == result
    assert client.post(f"/api/roadmaps/{SLUG}/assessments", json=payload).json()["result"] == result
    assert submit(client, session).json() == result


def test_legacy_open_current_assignment_still_works_and_missing_bank_fails_closed(
    client, monkeypatch
):
    bank = questions_for(SLUG)
    session, _ = start(client, monkeypatch)
    with SessionLocal() as db:
        db.get(RoadmapAssessmentSession, session["id"]).question_snapshot = None
        db.commit()
    url = f"/api/roadmaps/assessments/{session['id']}"
    assert client.get(url).status_code == 200
    monkeypatch.setattr(learning, "questions_for", lambda _: {})
    assert client.get(url).status_code == 409
    assert submit(client, session, bank).status_code == 409
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 0
    monkeypatch.setattr(learning, "questions_for", lambda _: bank)
    assert submit(client, session, bank).json()["score"] == 100


def test_readiness_rejects_changed_math_but_preserves_editorial_and_compatible_legacy_work(
    client, monkeypatch
):
    session, _ = start(client, monkeypatch)
    assert submit(client, session).status_code == 200
    url = f"/api/roadmaps/{SLUG}/exam-readiness"
    assert client.get(url).json()["lessons"][0]["status"] == "ready"
    edited = copy.deepcopy(curriculum())
    edited[SLUG]["lessons"][0]["questions"][0]["solution"] += " Additional editorial explanation."
    monkeypatch.setattr(exam_readiness, "curriculum", lambda: edited)
    assert client.get(url).json()["lessons"][0]["status"] == "ready"
    edited[SLUG]["lessons"][0]["questions"][0]["prompt"] += " Changed mathematical requirement."
    assert client.get(url).json()["lessons"][0]["status"] == "outdated"
    monkeypatch.setattr(exam_readiness, "curriculum", curriculum)
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        row.question_snapshot = None
        db.commit()
    assert client.get(url).json()["lessons"][0]["status"] == "ready"
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        row.result = {**row.result, "feedback": []}
        db.commit()
    assert client.get(url).json()["lessons"][0]["status"] == "outdated"


def test_concurrent_same_token_can_only_create_one_session_and_retry_resolves_it(
    client, monkeypatch
):
    monkeypatch.setattr(learning, "utc_now", lambda: NOW)
    client.get("/api/stats")
    payload = {
        "mode": "practice",
        "topic_slug": curriculum()[SLUG]["lessons"][0]["topic_slug"],
        "request_id": str(uuid4()),
    }

    def request():
        return client.post(f"/api/roadmaps/{SLUG}/assessments", json=payload)

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _: request(), range(2)))
    assert all(item.status_code in {200, 201, 409} for item in responses)
    replay = request()
    assert replay.status_code == 200
    winner_id = replay.json()["id"]
    assert all(item.json()["id"] == winner_id for item in responses if item.status_code != 409)
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapAssessmentSession)) == 1
