"""Owned topic bookmarks with atomic revisions and durable removal tombstones."""

from datetime import datetime
from typing import Any
from urllib.parse import quote

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.db.base import RoadmapBookmark
from app.services.roadmaps import ROADMAP_TOPICS
from app.services.spaced_review import utc_naive

MAX_REVISION = 2_147_483_647
CACHE_HEADERS = {"Cache-Control": "private, no-store"}
CONFLICT = "This bookmark changed elsewhere. Reload bookmarks before changing its state."


def _error(status: int, detail: str) -> HTTPException:
    return HTTPException(status, detail, headers=CACHE_HEADERS)


def _available(roadmap_slug: str, topic_slug: str) -> bool:
    # This is the same complete topic catalog used by progress validation.
    return topic_slug in ROADMAP_TOPICS.get(roadmap_slug, ())


def serialize_bookmark(row: RoadmapBookmark) -> dict[str, Any]:
    available = _available(row.roadmap_slug, row.topic_slug)
    return {
        "roadmap_slug": row.roadmap_slug,
        "topic_slug": row.topic_slug,
        "bookmarked": row.bookmarked,
        "revision": row.revision,
        "updated_at": utc_naive(row.updated_at).isoformat() + "Z" if row.updated_at else None,
        "available": available,
        "study_url": (
            f"/roadmaps/{quote(row.roadmap_slug, safe='')}/{quote(row.topic_slug, safe='')}"
            if available
            else None
        ),
    }


def _owned_row(
    db: Session, user_id: int, roadmap_slug: str, topic_slug: str, *, lock: bool = False
) -> RoadmapBookmark | None:
    query = select(RoadmapBookmark).where(
        RoadmapBookmark.user_id == user_id,
        RoadmapBookmark.roadmap_slug == roadmap_slug,
        RoadmapBookmark.topic_slug == topic_slug,
    )
    if lock:
        query = query.with_for_update()
    return db.scalar(query.execution_options(populate_existing=True))


def list_bookmarks(db: Session, user_id: int) -> dict[str, Any]:
    rows = db.scalars(
        select(RoadmapBookmark)
        .where(RoadmapBookmark.user_id == user_id)
        .order_by(RoadmapBookmark.roadmap_slug, RoadmapBookmark.topic_slug)
        .execution_options(populate_existing=True)
    )
    return {"items": [serialize_bookmark(row) for row in rows]}


def _winner_or_conflict(
    db: Session, user_id: int, roadmap_slug: str, topic_slug: str, bookmarked: bool
) -> dict[str, Any]:
    winner = _owned_row(db, user_id, roadmap_slug, topic_slug)
    if winner is not None and winner.bookmarked is bookmarked:
        return serialize_bookmark(winner)
    raise _error(409, CONFLICT)


def _save_bookmark(
    db: Session,
    user_id: int,
    roadmap_slug: str,
    topic_slug: str,
    *,
    bookmarked: bool,
    revision: int,
    now: datetime,
) -> dict[str, Any]:
    if (
        not isinstance(roadmap_slug, str)
        or not 1 <= len(roadmap_slug) <= 80
        or not isinstance(topic_slug, str)
        or not 1 <= len(topic_slug) <= 160
        or type(bookmarked) is not bool
        or type(revision) is not int
        or not 0 <= revision <= MAX_REVISION
    ):
        raise _error(422, "Provide valid topic slugs, a Boolean bookmark state and a revision.")
    row = _owned_row(db, user_id, roadmap_slug, topic_slug, lock=True)
    if row is not None:
        # A lost response can be retried even after a later same-state operation.
        # A future revision is never evidence that the caller saw this row.
        if revision <= row.revision and row.bookmarked is bookmarked:
            return serialize_bookmark(row)
        if bookmarked and not _available(roadmap_slug, topic_slug):
            raise _error(
                404, "This topic is no longer available. Its saved bookmark can be removed."
            )
        if revision != row.revision or revision == MAX_REVISION:
            raise _error(409, CONFLICT)
        changed = db.execute(
            update(RoadmapBookmark)
            .where(
                RoadmapBookmark.id == row.id,
                RoadmapBookmark.user_id == user_id,
                RoadmapBookmark.revision == revision,
            )
            .values(bookmarked=bookmarked, revision=revision + 1, updated_at=utc_naive(now))
            .execution_options(synchronize_session=False)
        )
        if not isinstance(changed, CursorResult) or changed.rowcount != 1:
            db.rollback()
            return _winner_or_conflict(db, user_id, roadmap_slug, topic_slug, bookmarked)
        db.commit()
        db.refresh(row)
        return serialize_bookmark(row)

    if not _available(roadmap_slug, topic_slug):
        raise _error(404, "Choose an available topic from its own roadmap.")
    if revision != 0:
        raise _error(409, "Start this bookmark from revision zero, or reload its saved state.")
    row = RoadmapBookmark(
        user_id=user_id,
        roadmap_slug=roadmap_slug,
        topic_slug=topic_slug,
        bookmarked=bookmarked,
        revision=1,
        updated_at=utc_naive(now),
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return _winner_or_conflict(db, user_id, roadmap_slug, topic_slug, bookmarked)
    return serialize_bookmark(row)


def save_bookmark(
    db: Session,
    user_id: int,
    roadmap_slug: str,
    topic_slug: str,
    *,
    bookmarked: bool,
    revision: int,
    now: datetime,
) -> dict[str, Any]:
    try:
        return _save_bookmark(
            db,
            user_id,
            roadmap_slug,
            topic_slug,
            bookmarked=bookmarked,
            revision=revision,
            now=now,
        )
    except OperationalError as error:
        db.rollback()
        raise _error(409, "Bookmarks are busy. Retry with your intended bookmark state.") from error
