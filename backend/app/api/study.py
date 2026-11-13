"""Preferences, transparent study recommendations and daily recorded time."""

from typing import Any

from fastapi import APIRouter, Query, Response
from pydantic import BaseModel, Field

from app.api.routes import Database, get_local_user
from app.db.base import utc_now
from app.services.study import preferences_for, save_preferences, study_plan

router = APIRouter(prefix="/api/roadmaps", tags=["Personal study"])


class PreferencesUpdate(BaseModel):
    model_config = {"extra": "forbid"}
    goal_minutes: int = Field(ge=5, le=120, strict=True)
    session_minutes: int = Field(ge=5, le=60, strict=True)
    preferred_roadmap_slug: str | None = Field(default=None, max_length=80)
    revision: int = Field(ge=0, le=2_147_483_646, strict=True)


@router.get("/study-preferences")
def get_preferences(db: Database, response: Response) -> dict[str, Any]:
    response.headers["Cache-Control"] = "private, no-store"
    return preferences_for(db, get_local_user(db).id)


@router.put("/study-preferences")
def put_preferences(payload: PreferencesUpdate, db: Database) -> dict[str, Any]:
    return save_preferences(db, get_local_user(db).id, payload.model_dump(), now=utc_now())


@router.get("/study-plan")
def get_study_plan(
    db: Database,
    response: Response,
    roadmap_slug: str | None = Query(default=None, min_length=1, max_length=80),
    budget_minutes: int | None = Query(default=None, ge=5, le=60),
) -> dict[str, Any]:
    response.headers["Cache-Control"] = "private, no-store"
    return study_plan(
        db,
        get_local_user(db).id,
        roadmap_slug=roadmap_slug,
        budget_minutes=budget_minutes,
        now=utc_now(),
    )
