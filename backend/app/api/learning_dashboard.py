"""Assessment discovery for the learning dashboard and session history."""

from typing import Literal

from fastapi import APIRouter, Query, Response

from app.api.routes import Database, get_local_user
from app.db.base import utc_now
from app.services.learning_dashboard import list_assessment_sessions

router = APIRouter(prefix="/api/roadmaps", tags=["Learning dashboard"])


@router.get("/assessment-sessions")
def assessment_sessions(
    db: Database,
    response: Response,
    state: Literal["all", "active", "completed", "expired"] = "all",
    roadmap_slug: str | None = Query(default=None, min_length=1, max_length=80),
    mode: Literal["practice", "exam", "review"] | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None, min_length=1, max_length=1024),
) -> dict:
    response.headers["Cache-Control"] = "private, no-store"
    now = utc_now()
    user = get_local_user(db)
    return list_assessment_sessions(
        db,
        user.id,
        roadmap_slug=roadmap_slug,
        mode=mode,
        state=state,
        limit=limit,
        cursor=cursor,
        now=now,
    )
