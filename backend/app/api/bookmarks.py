"""Durable bookmarks for the current local learning profile."""

from typing import Any

from fastapi import APIRouter, Path, Response
from pydantic import BaseModel, Field

from app.api.routes import Database, get_local_user
from app.db.base import utc_now
from app.services.bookmarks import MAX_REVISION, list_bookmarks, save_bookmark

router = APIRouter(prefix="/api/roadmaps", tags=["Topic bookmarks"])


class BookmarkUpdate(BaseModel):
    model_config = {"extra": "forbid"}

    bookmarked: bool = Field(strict=True)
    revision: int = Field(ge=0, le=MAX_REVISION, strict=True)


@router.get("/bookmarks")
def get_bookmarks(db: Database, response: Response) -> dict[str, Any]:
    response.headers["Cache-Control"] = "private, no-store"
    return list_bookmarks(db, get_local_user(db).id)


@router.put("/bookmarks/{roadmap_slug}/{topic_slug}")
def put_bookmark(
    payload: BookmarkUpdate,
    db: Database,
    response: Response,
    roadmap_slug: str = Path(min_length=1, max_length=80),
    topic_slug: str = Path(min_length=1, max_length=160),
) -> dict[str, Any]:
    response.headers["Cache-Control"] = "private, no-store"
    return save_bookmark(
        db,
        get_local_user(db).id,
        roadmap_slug,
        topic_slug,
        bookmarked=payload.bookmarked,
        revision=payload.revision,
        now=utc_now(),
    )
