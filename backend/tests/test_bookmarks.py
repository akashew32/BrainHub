"""Bookmark ownership, durable removals, strict inputs and overlapping-write regressions."""

from datetime import UTC, datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.api import bookmarks as bookmark_api
from app.db.base import (
    RoadmapAssessmentSession,
    RoadmapBookmark,
    RoadmapQuestionAttempt,
    RoadmapQuestionNote,
    RoadmapTopicProgress,
    StudyPreferences,
    User,
)
from app.db.session import SessionLocal
from app.services import bookmarks
from app.services.roadmaps import ROADMAP_TOPICS

NOW = datetime(2026, 11, 13, 6, 30, 0, 123456)
ROADMAP = "real-analysis"
TOPIC = "propositions-quantifiers-and-negation"
URL = f"/api/roadmaps/bookmarks/{ROADMAP}/{TOPIC}"
LIST_URL = "/api/roadmaps/bookmarks"


def initialize(client, monkeypatch):
    monkeypatch.setattr(bookmark_api, "utc_now", lambda: NOW)
    response = client.get(LIST_URL)
    assert response.status_code == 200
    return response.json()


def put(client, bookmarked, revision, *, url=URL):
    return client.put(url, json={"bookmarked": bookmarked, "revision": revision})


def owned_save(db, owner, bookmarked, revision, *, roadmap=ROADMAP, topic=TOPIC, now=NOW):
    return bookmarks.save_bookmark(
        db, owner, roadmap, topic, bookmarked=bookmarked, revision=revision, now=now
    )


def test_empty_list_does_not_invent_bookmark_rows_and_uses_private_no_store(client, monkeypatch):
    assert initialize(client, monkeypatch) == {"items": []}
    response = client.get(LIST_URL)
    assert response.headers["cache-control"] == "private, no-store"
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapBookmark)) == 0
        assert db.scalar(select(func.count()).select_from(RoadmapTopicProgress)) == 0


def test_bookmark_create_remove_and_lost_response_retries_preserve_false_tombstones(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    created = put(client, True, 0)
    assert created.status_code == 200
    assert created.headers["cache-control"] == "private, no-store"
    original = created.json()
    assert original == {
        "roadmap_slug": ROADMAP,
        "topic_slug": TOPIC,
        "bookmarked": True,
        "revision": 1,
        "updated_at": "2026-11-13T06:30:00.123456Z",
        "available": True,
        "study_url": f"/roadmaps/{ROADMAP}/{TOPIC}",
    }
    monkeypatch.setattr(bookmark_api, "utc_now", lambda: NOW + timedelta(hours=1))
    assert put(client, True, 0).json() == original
    removed = put(client, False, 1).json()
    assert removed["revision"] == 2 and removed["bookmarked"] is False
    assert removed["updated_at"] == "2026-11-13T07:30:00.123456Z"
    assert put(client, False, 1).json() == removed
    assert put(client, False, 0).json() == removed
    stale = put(client, True, 0)
    assert stale.status_code == 409
    assert stale.headers["cache-control"] == "private, no-store"
    assert put(client, True, 1).status_code == 409
    assert client.get(LIST_URL).json() == {"items": [removed]}
    with SessionLocal() as db:
        rows = list(db.scalars(select(RoadmapBookmark)))
        assert len(rows) == 1 and rows[0].bookmarked is False and rows[0].revision == 2
    restored = put(client, True, 2).json()
    assert restored["revision"] == 3 and restored["bookmarked"] is True


def test_initial_false_write_creates_tombstone_that_blocks_stale_resurrection(client, monkeypatch):
    initialize(client, monkeypatch)
    response = put(client, False, 0)
    assert response.status_code == 200
    saved = response.json()
    assert saved["bookmarked"] is False and saved["revision"] == 1
    assert put(client, False, 0).json() == saved
    assert put(client, True, 0).status_code == 409
    assert put(client, False, 99).status_code == 409
    assert client.get(LIST_URL).json()["items"] == [saved]


@pytest.mark.parametrize("bookmarked", [True, False])
def test_new_row_requires_revision_zero(client, monkeypatch, bookmarked):
    initialize(client, monkeypatch)
    assert put(client, bookmarked, 1).status_code == 409
    assert client.get(LIST_URL).json()["items"] == []


def test_complete_existing_catalog_accepts_advanced_topics_not_only_authored_lessons(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    assert sum(map(len, ROADMAP_TOPICS.values())) == 300
    for roadmap, topics in ROADMAP_TOPICS.items():
        for topic in sorted(topics):
            response = put(client, True, 0, url=f"/api/roadmaps/bookmarks/{roadmap}/{topic}")
            assert response.status_code == 200, (roadmap, topic, response.text)
            assert response.json()["available"] is True
            assert response.json()["study_url"] == f"/roadmaps/{roadmap}/{topic}"
    items = client.get(LIST_URL).json()["items"]
    assert len(items) == 300
    assert [(row["roadmap_slug"], row["topic_slug"]) for row in items] == sorted(
        (row["roadmap_slug"], row["topic_slug"]) for row in items
    )


@pytest.mark.parametrize(
    ("roadmap", "topic"),
    [
        ("unknown-subject", TOPIC),
        (ROADMAP, "unknown-topic"),
        ("calculus", TOPIC),
        ("Real-Analysis", TOPIC),
        (ROADMAP, TOPIC.upper()),
        ("real-analysis%00", TOPIC),
    ],
)
@pytest.mark.parametrize("bookmarked", [True, False])
def test_unknown_misspelled_and_cross_subject_topics_cannot_create_rows(
    client, monkeypatch, roadmap, topic, bookmarked
):
    initialize(client, monkeypatch)
    response = put(client, bookmarked, 0, url=f"/api/roadmaps/bookmarks/{roadmap}/{topic}")
    assert response.status_code == 404
    assert client.get(LIST_URL).json()["items"] == []


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"bookmarked": True},
        {"revision": 0},
        {"bookmarked": 1, "revision": 0},
        {"bookmarked": "false", "revision": 0},
        {"bookmarked": None, "revision": 0},
        {"bookmarked": True, "revision": True},
        {"bookmarked": True, "revision": 0.0},
        {"bookmarked": True, "revision": "0"},
        {"bookmarked": True, "revision": -1},
        {"bookmarked": True, "revision": 2_147_483_648},
        {"bookmarked": True, "revision": 0, "user_id": 2},
        {"bookmarked": True, "revision": 0, "available": True},
        {"bookmarked": True, "revision": 0, "study_url": "/elsewhere"},
    ],
)
def test_payload_validation_forbids_coercion_owner_and_projection_overrides(
    client, monkeypatch, body
):
    initialize(client, monkeypatch)
    assert client.put(URL, json=body).status_code == 422
    assert client.get(LIST_URL).json()["items"] == []


@pytest.mark.parametrize(
    "url",
    [
        f"/api/roadmaps/bookmarks/{'r' * 81}/{TOPIC}",
        f"/api/roadmaps/bookmarks/{ROADMAP}/{'t' * 161}",
    ],
)
def test_slug_bounds_are_checked_before_creating_rows(client, monkeypatch, url):
    initialize(client, monkeypatch)
    assert put(client, True, 0, url=url).status_code == 422
    assert client.get(LIST_URL).json()["items"] == []


def test_retired_bookmarks_remain_readable_and_removable_but_cannot_be_reactivated(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    original = put(client, True, 0).json()
    catalog = {slug: topics for slug, topics in ROADMAP_TOPICS.items() if slug != ROADMAP}
    monkeypatch.setattr(bookmarks, "ROADMAP_TOPICS", catalog)
    retired = {**original, "available": False, "study_url": None}
    assert client.get(LIST_URL).json() == {"items": [retired]}
    assert put(client, True, 0).json() == retired
    removed = put(client, False, 1)
    assert removed.status_code == 200
    assert removed.json()["revision"] == 2
    assert removed.json()["available"] is False and removed.json()["study_url"] is None
    assert put(client, False, 0).json() == removed.json()
    assert put(client, True, 2).status_code == 404
    other_retired = next(topic for topic in ROADMAP_TOPICS[ROADMAP] if topic != TOPIC)
    assert (
        put(client, False, 0, url=f"/api/roadmaps/bookmarks/{ROADMAP}/{other_retired}").status_code
        == 404
    )
    assert client.get(LIST_URL).json() == {"items": [removed.json()]}


def test_removing_one_catalog_topic_does_not_retire_the_roadmap(client, monkeypatch):
    initialize(client, monkeypatch)
    put(client, True, 0)
    monkeypatch.setattr(
        bookmarks,
        "ROADMAP_TOPICS",
        {**ROADMAP_TOPICS, ROADMAP: ROADMAP_TOPICS[ROADMAP] - {TOPIC}},
    )
    assert client.get(LIST_URL).json()["items"][0]["available"] is False
    remaining = next(topic for topic in ROADMAP_TOPICS[ROADMAP] if topic != TOPIC)
    assert (
        put(client, True, 0, url=f"/api/roadmaps/bookmarks/{ROADMAP}/{remaining}").status_code
        == 200
    )


def test_services_scope_reads_and_cas_writes_to_the_explicit_owner(client, monkeypatch):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        first = db.scalar(select(User)).id
        second_user = User(name="Another local profile")
        db.add(second_user)
        db.commit()
        second = second_user.id
        mine = owned_save(db, first, True, 0)
        theirs = owned_save(db, second, False, 0)
        assert bookmarks.list_bookmarks(db, first) == {"items": [mine]}
        assert bookmarks.list_bookmarks(db, second) == {"items": [theirs]}
        changed = owned_save(db, second, True, 1)
        assert changed["revision"] == 2
        assert bookmarks.list_bookmarks(db, first) == {"items": [mine]}
        assert bookmarks.list_bookmarks(db, 999_999) == {"items": []}
    assert client.get(LIST_URL).json()["items"] == [mine]


@pytest.mark.parametrize("requested", [True, False])
@pytest.mark.parametrize("same", [True, False])
def test_overlapping_initial_insert_recovers_same_state_or_preserves_opposing_tombstone(
    client, monkeypatch, requested, same
):
    initialize(client, monkeypatch)
    original_commit = Session.commit
    fired = False

    def overlapping_commit(db):
        nonlocal fired
        if not fired and any(isinstance(row, RoadmapBookmark) for row in db.new):
            fired = True
            with SessionLocal() as winner:
                winner.add(
                    RoadmapBookmark(
                        user_id=1,
                        roadmap_slug=ROADMAP,
                        topic_slug=TOPIC,
                        bookmarked=requested if same else not requested,
                        revision=1,
                        updated_at=NOW,
                    )
                )
                original_commit(winner)
        return original_commit(db)

    monkeypatch.setattr(Session, "commit", overlapping_commit)
    response = put(client, requested, 0)
    assert fired and response.status_code == (200 if same else 409)
    saved = client.get(LIST_URL).json()["items"]
    assert len(saved) == 1 and saved[0]["revision"] == 1
    assert saved[0]["bookmarked"] is (requested if same else not requested)


@pytest.mark.parametrize("same", [True, False])
def test_overlapping_updates_use_atomic_revision_and_never_resurrect_removed_bookmark(
    client, monkeypatch, same
):
    initialize(client, monkeypatch)
    put(client, False, 0)
    original_update = bookmarks.update
    fired = False

    def overlapping_update(model):
        nonlocal fired
        if not fired:
            fired = True
            with SessionLocal() as winner:
                # Same-state winner adds once. Opposing winner adds then removes,
                # so its durable revision3 tombstone must defeat this stale add.
                owned_save(winner, 1, True, 1)
                if not same:
                    owned_save(winner, 1, False, 2)
        return original_update(model)

    monkeypatch.setattr(bookmarks, "update", overlapping_update)
    response = put(client, True, 1)
    assert fired and response.status_code == (200 if same else 409)
    saved = client.get(LIST_URL).json()["items"][0]
    assert saved["bookmarked"] is same
    assert saved["revision"] == (2 if same else 3)


@pytest.mark.parametrize("existing", [False, True])
def test_busy_commit_rolls_back_insert_or_cas_update_without_server_error(
    client, monkeypatch, existing
):
    initialize(client, monkeypatch)
    if existing:
        put(client, True, 0)

    def busy_commit(db):
        raise OperationalError("COMMIT", {}, RuntimeError("database is locked"))

    with monkeypatch.context() as patch:
        patch.setattr(Session, "commit", busy_commit)
        response = put(client, False if existing else True, 1 if existing else 0)
        assert response.status_code == 409
        assert response.headers["cache-control"] == "private, no-store"
    saved = client.get(LIST_URL).json()["items"]
    if existing:
        assert saved[0]["bookmarked"] is True and saved[0]["revision"] == 1
    else:
        assert saved == []


def test_service_validates_inputs_and_stops_revision_overflow(client, monkeypatch):
    initialize(client, monkeypatch)
    with SessionLocal() as db:
        for desired, revision in [(1, 0), (True, True), (True, -1), (True, 1.5)]:
            with pytest.raises(HTTPException) as error:
                owned_save(db, 1, desired, revision)
            assert error.value.status_code == 422
        row = RoadmapBookmark(
            user_id=1,
            roadmap_slug=ROADMAP,
            topic_slug=TOPIC,
            bookmarked=True,
            revision=bookmarks.MAX_REVISION,
            updated_at=NOW,
        )
        db.add(row)
        db.commit()
        assert owned_save(db, 1, True, 0)["revision"] == bookmarks.MAX_REVISION
        with pytest.raises(HTTPException) as error:
            owned_save(db, 1, False, bookmarks.MAX_REVISION)
        assert error.value.status_code == 409
        db.refresh(row)
        assert row.bookmarked is True and row.revision == bookmarks.MAX_REVISION


def test_aware_service_timestamp_is_serialized_in_utc(client, monkeypatch):
    initialize(client, monkeypatch)
    aware = datetime(2026, 11, 13, 1, 30, tzinfo=timezone(timedelta(hours=-5)))
    with SessionLocal() as db:
        saved = owned_save(db, 1, True, 0, now=aware)
        assert saved["updated_at"] == aware.astimezone(UTC).isoformat().replace("+00:00", "Z")


def test_bookmarks_do_not_modify_attempts_mastery_notes_preferences_or_recorded_time(
    client, monkeypatch
):
    initialize(client, monkeypatch)
    session_id = str(uuid4())
    with SessionLocal() as db:
        db.add_all(
            [
                RoadmapTopicProgress(
                    user_id=1,
                    roadmap_slug=ROADMAP,
                    topic_slug=TOPIC,
                    status="completed",
                    quiz_score=88,
                    independent_score=75,
                    quiz_attempts=2,
                    mastery_version=1,
                    time_spent_seconds=91,
                    last_viewed_at=NOW,
                    completed_at=NOW,
                ),
                StudyPreferences(
                    user_id=1, goal_minutes=40, session_minutes=20, revision=4, updated_at=NOW
                ),
                RoadmapAssessmentSession(
                    id=session_id,
                    user_id=1,
                    roadmap_slug=ROADMAP,
                    topic_slug=TOPIC,
                    mode="practice",
                    question_ids=["historical-question"],
                    draft={"revision": 3},
                    hint_usage={"historical-question": 1},
                    hint_revision=1,
                    result={"score": 100, "feedback": []},
                    recorded_seconds=91,
                    recorded_intervals={"version": 1, "intervals": []},
                    started_at=NOW - timedelta(minutes=2),
                    completed_at=NOW,
                    expires_at=NOW + timedelta(hours=1),
                ),
                RoadmapQuestionAttempt(
                    user_id=1,
                    session_id=session_id,
                    roadmap_slug=ROADMAP,
                    topic_slug=TOPIC,
                    question_id="historical-question",
                    concept="logic",
                    answer=True,
                    correct=True,
                    hints_used=1,
                    created_at=NOW,
                ),
                RoadmapQuestionNote(
                    user_id=1,
                    roadmap_slug=ROADMAP,
                    question_id="historical-question",
                    text="Keep my reflection",
                    revision=3,
                    created_at=NOW,
                    updated_at=NOW,
                ),
            ]
        )
        db.commit()

    def unrelated_snapshot():
        with SessionLocal() as db:
            return {
                model.__tablename__: [
                    {column.key: getattr(row, column.key) for column in model.__table__.columns}
                    for row in db.scalars(select(model))
                ]
                for model in [
                    RoadmapTopicProgress,
                    RoadmapAssessmentSession,
                    RoadmapQuestionAttempt,
                    RoadmapQuestionNote,
                    StudyPreferences,
                ]
            }

    before = unrelated_snapshot()
    assert put(client, True, 0).status_code == 200
    assert put(client, False, 1).status_code == 200
    assert put(client, True, 0).status_code == 409
    assert client.get(LIST_URL).status_code == 200
    assert unrelated_snapshot() == before
