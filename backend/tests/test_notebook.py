import base64
import json
from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.api import learning
from app.api import notebook as notebook_api
from app.db.base import RoadmapAssessmentSession, RoadmapQuestionAttempt, RoadmapQuestionNote, User
from app.db.session import SessionLocal
from app.services import notebook
from app.services.curriculum import questions_for

NOW = datetime(2026, 2, 1, 12)


def freeze(monkeypatch):
    monkeypatch.setattr(notebook_api, "utc_now", lambda: NOW)
    monkeypatch.setattr(learning, "utc_now", lambda: NOW)


def seed(
    db,
    *,
    slug="calculus",
    qid="q",
    at=None,
    correct=False,
    hints=0,
    user=1,
    owner=None,
    prompt="Historical prompt",
    expected="historical-key",
    topic="old-topic",
    concept="Concept",
    feedback=True,
    completed=True,
):
    at = at or NOW - timedelta(days=1)
    snapshot = {
        "question_id": qid,
        "correct": correct,
        "prompt": prompt,
        "topic_slug": topic,
        "lesson_title": "Snapshot lesson",
        "concept": concept,
        "submitted_answer": "submitted-work",
        "expected_answer": expected,
        "solution": "Historical worked solution.",
    }
    session = RoadmapAssessmentSession(
        id=str(uuid4()),
        user_id=owner or user,
        roadmap_slug=slug,
        topic_slug=topic,
        mode="practice",
        question_ids=[qid],
        hint_usage=None if hints is None else ({qid: hints} if hints else {}),
        completed_at=at if completed else None,
        expires_at=at + timedelta(hours=2),
        result={
            "score": 100 if correct else 0,
            "passed": correct,
            "feedback": [snapshot] if feedback else [],
        },
    )
    db.add(session)
    db.flush()
    attempt = RoadmapQuestionAttempt(
        user_id=user,
        session_id=session.id,
        roadmap_slug=slug,
        topic_slug=topic,
        question_id=qid,
        concept=concept,
        answer="submitted-work",
        correct=correct,
        hints_used=hints,
        created_at=at,
    )
    db.add(attempt)
    db.flush()
    return attempt, session


def initialize(client, monkeypatch):
    freeze(monkeypatch)
    client.get("/api/stats")


def test_snapshot_history_survives_resolution_and_archiving_without_current_answer_fallback(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    qid = next(iter(questions_for("calculus")))
    with SessionLocal() as db:
        seed(db, qid=qid, at=NOW - timedelta(days=2))
        seed(db, qid=qid, at=NOW - timedelta(days=1), correct=True)
        seed(db, qid="independent-only", correct=True)
        db.commit()
    entries = client.get("/api/roadmaps/notebook").json()["items"]
    assert len(entries) == 1
    assert entries[0]["status"] == "resolved"
    assert not entries[0]["archived"] and entries[0]["practice_url"]
    monkeypatch.setattr(notebook, "questions_for", lambda _slug: {})
    detail = client.get(f"/api/roadmaps/notebook/calculus/{qid}").json()
    assert detail["entry"]["archived"] and detail["entry"]["practice_url"] is None
    assert detail["entry"]["prompt"] == "Historical prompt"
    assert all(item["expected_answer"] == "historical-key" for item in detail["history"]["items"])
    assert detail["entry"]["incorrect_attempts"] == 1
    assert client.get("/api/roadmaps/notebook?state=unresolved").json()["items"] == []
    assert len(client.get("/api/roadmaps/notebook?state=resolved").json()["items"]) == 1
    assert client.get("/api/roadmaps/notebook/calculus/independent-only").status_code == 404
    assert (
        client.put(
            "/api/roadmaps/notebook/calculus/independent-only/note",
            json={"text": "No entry", "revision": 0},
        ).status_code
        == 404
    )


def test_membership_includes_assisted_and_untracked_correct_work_and_composite_subject_identity(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        seed(db, slug="calculus", qid="shared", correct=True, hints=1)
        seed(db, slug="probability", qid="shared", correct=True, hints=None)
        db.commit()
    entries = client.get("/api/roadmaps/notebook").json()["items"]
    assert {(item["roadmap_slug"], item["latest_outcome"]) for item in entries} == {
        ("calculus", "assisted"),
        ("probability", "untracked"),
    }
    assert all(item["status"] == "unresolved" for item in entries)
    assert len(client.get("/api/roadmaps/notebook?roadmap_slug=probability").json()["items"]) == 1


def test_only_owned_completed_matching_feedback_snapshots_are_readable(client, monkeypatch):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        other = User(name="Other learner")
        db.add(other)
        db.flush()
        seed(db, qid="other-owner", owner=other.id, prompt="Other user's secret")
        seed(db, qid="other-user", user=other.id, prompt="Other user's secret")
        seed(db, qid="open", completed=False)
        seed(db, qid="missing-snapshot", feedback=False)
        _, mismatched = seed(db, qid="wrong-snapshot")
        mismatched.result = {"feedback": [{"question_id": "different-qid"}]}
        _, duplicate = seed(db, qid="ambiguous")
        duplicate.result = {"feedback": duplicate.result["feedback"] * 2}
        _, wrong_subject = seed(db, qid="wrong-subject")
        wrong_subject.roadmap_slug = "probability"
        seed(db, qid="owned")
        db.commit()
    listed = client.get("/api/roadmaps/notebook").json()
    assert [item["question_id"] for item in listed["items"]] == ["owned"]
    assert "Other user's secret" not in str(listed)
    for qid in [
        "other-owner",
        "other-user",
        "open",
        "missing-snapshot",
        "wrong-snapshot",
        "ambiguous",
        "wrong-subject",
    ]:
        assert client.get(f"/api/roadmaps/notebook/calculus/{qid}").status_code == 404
    assert client.get("/api/roadmaps/concept-performance").json()["totals"]["answers"] == 1


def test_list_keyset_is_time_then_id_and_watermark_freezes_new_or_backdated_attempts(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        # Deliberately insert chronological newest first, making its ID lowest.
        seed(db, qid="newest", at=NOW - timedelta(days=1))
        seed(db, qid="oldest", at=NOW - timedelta(days=3))
        seed(db, qid="middle", at=NOW - timedelta(days=2))
        db.commit()
    first = client.get("/api/roadmaps/notebook?state=unresolved&limit=1").json()
    assert first["items"][0]["question_id"] == "newest"
    with SessionLocal() as db:
        seed(db, qid="backdated-new-id", at=NOW - timedelta(days=4))
        seed(db, qid="oldest", correct=True, at=NOW)
        db.commit()
    second = client.get(
        "/api/roadmaps/notebook",
        params={"state": "unresolved", "limit": 1, "cursor": first["next_cursor"]},
    ).json()
    third = client.get(
        "/api/roadmaps/notebook",
        params={"state": "unresolved", "limit": 1, "cursor": second["next_cursor"]},
    ).json()
    assert [second["items"][0]["question_id"], third["items"][0]["question_id"]] == [
        "middle",
        "oldest",
    ]
    assert (
        first["snapshot_max_attempt_id"]
        == second["snapshot_max_attempt_id"]
        == third["snapshot_max_attempt_id"]
    )
    assert third["next_cursor"] is None


def test_detail_history_cursor_preserves_timestamp_id_order_and_snapshot_boundary(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        seed(db, at=NOW - timedelta(days=1))
        seed(db, at=NOW - timedelta(days=3))
        seed(db, at=NOW - timedelta(days=2))
        db.commit()
    first = client.get("/api/roadmaps/notebook/calculus/q?limit=1").json()
    with SessionLocal() as db:
        seed(db, at=NOW, correct=True)
        db.commit()
    second = client.get(
        "/api/roadmaps/notebook/calculus/q",
        params={"limit": 1, "cursor": first["history"]["next_cursor"]},
    ).json()
    assert (
        second["history"]["items"][0]["created_at"] == (NOW - timedelta(days=2)).isoformat() + "Z"
    )
    assert second["entry"]["attempts"] == 3 and second["entry"]["status"] == "unresolved"


def test_cursors_reject_filter_owner_kind_and_overflow_timestamp_tampering(client, monkeypatch):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        seed(db, qid="a")
        seed(db, qid="b")
        db.commit()
    cursor = client.get("/api/roadmaps/notebook?state=unresolved&limit=1").json()["next_cursor"]
    assert (
        client.get("/api/roadmaps/notebook", params={"cursor": cursor, "state": "all"}).status_code
        == 422
    )
    assert (
        client.get("/api/roadmaps/notebook/calculus/a", params={"cursor": cursor}).status_code
        == 422
    )
    decoded = json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))
    for changes in [
        {"user": 2},
        {"last_at": "0001-01-01T00:00:00+23:59"},
        {"last_at": "9999-12-31T23:59:59-23:59"},
        {"max_id": True},
    ]:
        tampered = (
            base64.urlsafe_b64encode(json.dumps({**decoded, **changes}).encode())
            .decode()
            .rstrip("=")
        )
        assert (
            client.get(
                "/api/roadmaps/notebook", params={"state": "unresolved", "cursor": tampered}
            ).status_code
            == 422
        )
    assert client.get("/api/roadmaps/notebook?limit=51").status_code == 422
    assert client.get("/api/roadmaps/notebook?cursor=%%%bad").status_code == 422


def test_note_cas_idempotency_conflicts_and_empty_clear_preserve_learning_evidence(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    qid = next(iter(questions_for("calculus")))
    with SessionLocal() as db:
        seed(db, qid=qid)
        db.commit()
    before = client.get("/api/roadmaps/review-plan").json()
    assert before["summary"]["due"] == 1
    detail_url = f"/api/roadmaps/notebook/calculus/{qid}"
    url = detail_url + "/note"
    assert client.get(detail_url).json()["note"]["revision"] == 0
    first = client.put(url, json={"text": "My reasoning\n$x^2$", "revision": 0}).json()
    assert first["revision"] == 1
    assert client.put(url, json={"text": first["text"], "revision": 0}).json() == first
    second = client.put(url, json={"text": "Revised reasoning", "revision": 1}).json()
    assert second["revision"] == 2
    assert client.put(url, json={"text": "Stale unsaved draft", "revision": 1}).status_code == 409
    assert client.get(detail_url).json()["note"] == second
    cleared = client.put(url, json={"text": "", "revision": 2}).json()
    assert cleared["revision"] == 3 and cleared["text"] == ""
    assert not client.get("/api/roadmaps/notebook").json()["items"][0]["has_note"]
    assert client.get("/api/roadmaps/review-plan").json() == before
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 1


@pytest.mark.parametrize(
    "body",
    [
        {"text": "x" * 4001, "revision": 0},
        {"text": "a\x00b", "revision": 0},
        {"text": "x", "revision": True},
        {"text": "x", "revision": -1},
        {"text": "x", "revision": 0, "user_id": 2},
    ],
)
def test_note_validation_rejects_oversize_nul_and_client_ownership_or_revision_overrides(
    client, monkeypatch, body
):
    initialize(client, monkeypatch)
    assert client.put("/api/roadmaps/notebook/calculus/q/note", json=body).status_code == 422


@pytest.mark.parametrize("same", [True, False])
def test_concurrent_initial_note_creation_is_idempotent_or_conflicts_without_overwriting(
    client, monkeypatch, same
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        seed(db)
        db.commit()
    original = Session.commit
    fired = False

    def competing_create(db):
        nonlocal fired
        if not fired and any(isinstance(row, RoadmapQuestionNote) for row in db.new):
            fired = True
            with SessionLocal() as winner:
                winner.add(
                    RoadmapQuestionNote(
                        user_id=1,
                        roadmap_slug="calculus",
                        question_id="q",
                        text="mine" if same else "other",
                        revision=1,
                        created_at=NOW,
                        updated_at=NOW,
                    )
                )
                original(winner)
        return original(db)

    monkeypatch.setattr(Session, "commit", competing_create)
    response = client.put(
        "/api/roadmaps/notebook/calculus/q/note", json={"text": "mine", "revision": 0}
    )
    assert response.status_code == (200 if same else 409)
    saved = client.get("/api/roadmaps/notebook/calculus/q").json()["note"]
    assert saved["text"] == ("mine" if same else "other") and saved["revision"] == 1


def test_note_update_cas_loses_safely_and_busy_write_returns_conflict(client, monkeypatch):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        seed(db)
        db.commit()
    client.put("/api/roadmaps/notebook/calculus/q/note", json={"text": "original", "revision": 0})
    original = notebook.update
    fired = False

    def competing_update(model):
        nonlocal fired
        if not fired:
            fired = True
            with SessionLocal() as db:
                row = db.scalars(select(RoadmapQuestionNote)).one()
                row.text, row.revision = "other device", 2
                db.commit()
        return original(model)

    monkeypatch.setattr(notebook, "update", competing_update)
    assert (
        client.put(
            "/api/roadmaps/notebook/calculus/q/note",
            json={"text": "unsaved local draft", "revision": 1},
        ).status_code
        == 409
    )
    assert client.get("/api/roadmaps/notebook/calculus/q").json()["note"]["text"] == "other device"

    def busy(*args, **kwargs):
        raise OperationalError("write", {}, RuntimeError("database locked"))

    monkeypatch.setattr(notebook, "_save_note", busy)
    assert (
        client.put(
            "/api/roadmaps/notebook/calculus/q/note", json={"text": "still local", "revision": 2}
        ).status_code
        == 409
    )


def test_performance_buckets_include_incorrect_answers_and_group_same_concepts_by_topic(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        for index, (correct, hints) in enumerate(
            [(True, 0), (False, 0), (True, 1), (False, 1), (True, None), (False, None)]
        ):
            seed(
                db,
                qid=f"q{index}",
                correct=correct,
                hints=hints,
                topic="one" if index < 4 else "two",
                concept="Same concept",
            )
        seed(db, qid="too-old", at=NOW - timedelta(days=40))
        seed(db, qid="future", at=NOW + timedelta(days=1))
        seed(db, qid="missing-feedback", feedback=False)
        db.commit()
    response = client.get("/api/roadmaps/concept-performance?days=14").json()
    totals = response["totals"]
    assert totals["answers"] == 6 and totals["correct"] == totals["incorrect"] == 3
    assert totals["accuracy"] == 50 and totals["questions_seen"] == 6
    for bucket in ["independent", "assisted", "untracked"]:
        assert totals[bucket] == {"answers": 2, "correct": 1, "accuracy": 50}
    assert {
        (item["roadmap_slug"], item["topic_slug"], item["concept"]) for item in response["concepts"]
    } == {("calculus", "one", "Same concept"), ("calculus", "two", "Same concept")}
    assert len(response["trend"]) == 14
    assert sum(item["answers"] for item in response["trend"]) == 6
    assert response["trend"][-1]["accuracy"] is None
    assert "historical-key" not in str(response) and "Historical worked solution" not in str(
        response
    )
    empty = client.get("/api/roadmaps/concept-performance?roadmap_slug=probability").json()
    assert empty["totals"]["answers"] == 0 and empty["totals"]["accuracy"] is None
    assert all(item["answers"] == 0 for item in empty["trend"])
    assert client.get("/api/roadmaps/concept-performance?days=13").status_code == 422
    assert client.get("/api/roadmaps/concept-performance?days=366").status_code == 422
