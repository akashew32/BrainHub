"""Owned bounded session discovery, safe summaries and live lifecycle filters."""

import base64
import copy
import json
from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.api import learning, learning_dashboard
from app.db.base import RoadmapAssessmentSession, RoadmapQuestionAttempt, RoadmapTopicProgress, User
from app.db.session import SessionLocal
from app.services.assessment_sessions import freeze_questions
from app.services.curriculum import curriculum, questions_for

NOW = datetime(2026, 4, 1, 12)
BASE = "/api/roadmaps/assessment-sessions"


def initialize(client, monkeypatch):
    monkeypatch.setattr(learning_dashboard, "utc_now", lambda: NOW)
    monkeypatch.setattr(learning, "utc_now", lambda: NOW)
    client.get("/api/stats")


def seed(
    db,
    *,
    identifier=None,
    started=NOW,
    expiry=None,
    owner=1,
    mode="practice",
    slug="calculus",
    completed=False,
    frozen=True,
    draft=None,
):
    question = next(iter(questions_for("calculus").values()))
    identifier = identifier or str(uuid4())
    result = (
        {
            "session_id": identifier,
            "mode": mode,
            "score": 100,
            "passed": True,
            "independent_score": 100,
            "independent_passed": True,
            "assistance": "independent",
            "correct": 1,
            "total": 1,
            "progress": None,
            "feedback": [
                {
                    "question_id": question["id"],
                    "prompt": question["prompt"],
                    "concept": question["concept"],
                    "solution": question["solution"],
                    "topic_slug": question["topic_slug"],
                    "submitted_answer": question["answer"],
                    "expected_answer": question["answer"],
                    "correct": True,
                }
            ],
        }
        if completed
        else None
    )
    row = RoadmapAssessmentSession(
        id=identifier,
        user_id=owner,
        roadmap_slug=slug,
        topic_slug=question["topic_slug"] if mode == "practice" else None,
        stage_index=0,
        mode=mode,
        question_ids=[question["id"]],
        question_snapshot=freeze_questions([question], mode=mode) if frozen else None,
        hint_usage={},
        started_at=started,
        expires_at=expiry or NOW + timedelta(hours=2),
        completed_at=NOW - timedelta(minutes=1) if completed else None,
        result=result,
        draft=draft or {},
    )
    db.add(row)
    return row


def page(client, **query):
    response = client.get(BASE, params=query)
    assert response.status_code == 200, response.text
    return response.json()


def decode(cursor):
    return json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))


def encode(data):
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")


def test_all_subjects_are_discoverable_and_new_start_records_request_timestamp_and_stage(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    ids = []
    for slug, data in curriculum().items():
        response = client.post(
            f"/api/roadmaps/{slug}/assessments",
            json={"mode": "practice", "topic_slug": data["lessons"][0]["topic_slug"]},
        )
        assert response.status_code == 201
        result = response.json()
        assert result["stage_index"] == data["stage_index"] == 0
        ids.append(result["id"])
    listing = page(client)
    assert {item["id"] for item in listing["items"]} == set(ids)
    assert len({item["roadmap_slug"] for item in listing["items"]}) == 5
    assert listing["generated_at"] == NOW.isoformat() + "Z"
    assert all(item["started_at"] == NOW.isoformat() + "Z" for item in listing["items"])
    assert all(
        item["state"] == "active" and item["open_url"] and item["study_url"]
        for item in listing["items"]
    )


def test_owned_summaries_only_and_empty_history_is_explicit(client, monkeypatch):
    initialize(client, monkeypatch)
    assert page(client) == {"generated_at": NOW.isoformat() + "Z", "items": [], "next_cursor": None}
    with SessionLocal() as db:
        other = User(name="Other learner")
        db.add(other)
        db.flush()
        owned = seed(db)
        foreign = seed(db, owner=other.id, completed=True)
        owned_id, foreign_id = owned.id, foreign.id
        db.commit()
    result = page(client)
    assert [item["id"] for item in result["items"]] == [owned_id]
    assert foreign_id not in json.dumps(result)
    assert client.get(BASE).headers["cache-control"] == "private, no-store"
    assert (
        client.get(f"/api/roadmaps/assessments/{owned_id}").headers["cache-control"]
        == "private, no-store"
    )


def test_tied_timestamps_use_uuid_keyset_without_duplicates_and_new_starts_stay_out_of_old_pages(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    ids = [f"00000000-0000-4000-8000-{index:012d}" for index in range(1, 6)]
    with SessionLocal() as db:
        for identifier in ids:
            seed(db, identifier=identifier)
        db.commit()
    first = page(client, limit=2)
    assert [item["id"] for item in first["items"]] == ids[::-1][:2]
    with SessionLocal() as db:
        seed(db, started=NOW + timedelta(microseconds=1))
        db.commit()
    monkeypatch.setattr(learning_dashboard, "utc_now", lambda: NOW + timedelta(seconds=1))
    found = [item["id"] for item in first["items"]]
    cursor = first["next_cursor"]
    while cursor:
        current = page(client, limit=2, cursor=cursor)
        found.extend(item["id"] for item in current["items"])
        cursor = current["next_cursor"]
    assert found == ids[::-1] and len(set(found)) == 5


@pytest.mark.parametrize(
    "query",
    [
        {"state": "unknown"},
        {"mode": "other"},
        {"limit": 0},
        {"limit": 51},
        {"roadmap_slug": ""},
        {"roadmap_slug": "x" * 81},
        {"cursor": ""},
        {"cursor": "x" * 1025},
        {"cursor": "not-base64"},
    ],
)
def test_invalid_query_and_cursor_bounds_are_422(client, monkeypatch, query):
    initialize(client, monkeypatch)
    assert client.get(BASE, params=query).status_code == 422


@pytest.mark.parametrize(
    "mutation",
    [
        {"v": True},
        {"user": 2},
        {"last_id": "not-a-uuid"},
        {"last_at": "0001-01-01T00:00:00+23:59"},
        {"last_at": "9999-12-31T23:59:59-23:59"},
        {"last_at": "2026-04-02T12:00:00Z"},
        {"as_of": "2026-04-02T12:00:00Z"},
        {"extra": True},
    ],
)
def test_cursor_rejects_wrong_owner_types_uuid_future_and_overflow_timestamps(
    client, monkeypatch, mutation
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        seed(db)
        seed(db)
        db.commit()
    raw = decode(page(client, limit=1)["next_cursor"])
    assert (
        client.get(BASE, params={"limit": 1, "cursor": encode({**raw, **mutation})}).status_code
        == 422
    )


@pytest.mark.parametrize(
    "query", [{"state": "active"}, {"mode": "exam"}, {"roadmap_slug": "probability"}]
)
def test_cursors_are_bound_to_all_filters(client, monkeypatch, query):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        seed(db)
        seed(db)
        db.commit()
    cursor = page(client, limit=1)["next_cursor"]
    assert client.get(BASE, params={"cursor": cursor, **query}).status_code == 422


def test_mode_subject_and_live_state_filters_match_recovery_at_exact_deadline(client, monkeypatch):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        active = seed(db, expiry=NOW + timedelta(microseconds=1))
        expired = seed(db, mode="review", expiry=NOW)
        completed = seed(db, mode="exam", slug="probability", completed=True, expiry=NOW)
        active_id, expired_id, completed_id = active.id, expired.id, completed.id
        db.commit()
    assert [item["id"] for item in page(client, state="active")["items"]] == [active_id]
    assert [item["id"] for item in page(client, state="expired")["items"]] == [expired_id]
    assert [
        item["id"]
        for item in page(client, state="completed", mode="exam", roadmap_slug="probability")[
            "items"
        ]
    ] == [completed_id]
    assert page(client, roadmap_slug="missing")["items"] == []
    later = NOW + timedelta(microseconds=1)
    monkeypatch.setattr(learning_dashboard, "utc_now", lambda: later)
    monkeypatch.setattr(learning, "utc_now", lambda: later)
    assert page(client, state="active")["items"] == []
    summary = next(
        item for item in page(client, state="expired")["items"] if item["id"] == active_id
    )
    recovered = client.get(f"/api/roadmaps/assessments/{active_id}").json()
    assert summary["state"] == recovered["state"] == "expired"
    assert summary["questions_available"] and summary["open_url"]


def test_live_completion_can_remove_a_session_from_an_active_page_without_corrupting_cursor(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        for index in range(1, 4):
            seed(db, identifier=f"00000000-0000-4000-8000-{index:012d}")
        db.commit()
    first = page(client, state="active", limit=1)
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, "00000000-0000-4000-8000-000000000002")
        row.result = {"closed": True}
        row.completed_at = NOW
        db.commit()
    second = page(client, state="active", limit=1, cursor=first["next_cursor"])
    assert [item["id"] for item in second["items"]] == ["00000000-0000-4000-8000-000000000001"]


def test_archived_frozen_and_completed_legacy_are_openable_but_missing_open_legacy_is_not(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        frozen = seed(db, slug="archived-subject")
        legacy_completed = seed(db, slug="archived-subject", frozen=False, completed=True)
        legacy_open = seed(db, slug="archived-subject", frozen=False)
        frozen_id, closed_id, open_id = frozen.id, legacy_completed.id, legacy_open.id
        db.commit()
    listing = {item["id"]: item for item in page(client, roadmap_slug="archived-subject")["items"]}
    assert listing[frozen_id]["questions_available"] and listing[frozen_id]["open_url"]
    assert (
        not listing[closed_id]["questions_available"]
        and listing[closed_id]["result_available"]
        and listing[closed_id]["open_url"]
    )
    assert not listing[open_id]["questions_available"] and listing[open_id]["open_url"] is None
    assert all(item["study_url"] is None for item in listing.values())
    recovered = client.get(f"/api/roadmaps/assessments/{closed_id}")
    assert recovered.status_code == 200 and recovered.json()["questions"] == []


@pytest.mark.parametrize(
    "mutation",
    [
        {"assistance": []},
        {"assistance": {}},
        {"correct": 0},
        {"score": True},
        {"independent_score": 101},
        {"feedback": []},
    ],
)
def test_malformed_completed_result_never_advertises_a_score_or_openable_resource(
    client, monkeypatch, mutation
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        row = seed(db, completed=True)
        row.result = {**row.result, **mutation}
        identifier = row.id
        db.commit()
    summary = next(item for item in page(client)["items"] if item["id"] == identifier)
    assert summary["result_summary"] is None and not summary["result_available"]
    assert summary["open_url"] is None


def test_missing_feedback_fields_and_corrupt_snapshot_fail_closed_without_losing_other_rows(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        malformed = seed(db, completed=True)
        result = copy.deepcopy(malformed.result)
        del result["feedback"][0]["solution"]
        malformed.result = result
        corrupt = seed(db)
        corrupt.question_snapshot = {"version": 99}
        valid = seed(db)
        bad_id, corrupt_id, valid_id = malformed.id, corrupt.id, valid.id
        db.commit()
    rows = {item["id"]: item for item in page(client)["items"]}
    assert rows[bad_id]["result_summary"] is None and rows[bad_id]["open_url"] is None
    assert not rows[corrupt_id]["questions_available"] and rows[corrupt_id]["open_url"] is None
    assert rows[valid_id]["open_url"]


def test_summary_whitelist_counts_saved_entries_without_leaking_or_mutating_any_learning_data(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    question = next(iter(questions_for("calculus").values()))
    draft = {
        "revision": 9,
        "time_spent_seconds": 77,
        "answers": [
            {"question_id": question["id"], "answer": "PRIVATE-DRAFT"},
            {"question_id": question["id"], "answer": "duplicate"},
            {"question_id": "foreign", "answer": "ignored"},
        ],
    }
    with SessionLocal() as db:
        open_row = seed(db, draft=draft)
        open_row.hint_usage = {question["id"]: 1}
        closed = seed(db, completed=True)
        closed.result = {**closed.result, "private_extra": "PRIVATE-RESULT"}
        open_id, closed_id = open_row.id, closed.id
        db.add(
            RoadmapTopicProgress(
                user_id=1,
                roadmap_slug="calculus",
                topic_slug=question["topic_slug"],
                quiz_score=100,
                independent_score=100,
                mastery_version=0,
            )
        )
        db.commit()
    result = page(client)
    rows = {item["id"]: item for item in result["items"]}
    assert rows[open_id]["saved_entries"] == 1 and rows[open_id]["result_summary"] is None
    assert rows[closed_id]["result_summary"] == {
        "score": 100,
        "independent_score": 100,
        "correct": 1,
        "total": 1,
        "passed": True,
        "assistance": "independent",
    }
    serialized = json.dumps(result)
    assert all(
        value not in serialized
        for value in [
            question["id"],
            question["prompt"],
            question["solution"],
            "PRIVATE-DRAFT",
            "PRIVATE-RESULT",
            "proof_dependencies",
            "question_snapshot",
            "hint_usage",
            "expected_answer",
            "submitted_answer",
        ]
    )
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, open_id)
        assert row.draft == draft and row.hint_usage == {question["id"]: 1}
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 0
        progress = db.scalar(select(RoadmapTopicProgress))
        assert progress.mastery_version == 0 and progress.quiz_attempts == 0
