from typing import Literal

from fastapi import APIRouter, Path, Query
from pydantic import BaseModel, Field, field_validator

from app.api.routes import Database, get_local_user
from app.db.base import utc_now
from app.services.notebook import concept_performance, list_notebook, notebook_detail, save_note

router = APIRouter(prefix="/api/roadmaps", tags=["Mistake notebook"])


class NoteUpdate(BaseModel):
    model_config = {"extra": "forbid"}

    text: str = Field(max_length=4000, strict=True)
    revision: int = Field(ge=0, le=2_147_483_647, strict=True)

    @field_validator("text")
    @classmethod
    def text_without_nul(cls, value: str) -> str:
        if "\x00" in value:
            raise ValueError("Remove null characters from the note.")
        return value


@router.get("/notebook")
def notebook_list_route(
    db: Database,
    roadmap_slug: str | None = Query(default=None, max_length=80),
    state: Literal["all", "unresolved", "resolved"] = "all",
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None, max_length=1024),
):
    now = utc_now()
    user = get_local_user(db)
    return list_notebook(
        db, user.id, roadmap_slug=roadmap_slug, state=state, limit=limit, cursor=cursor, now=now
    )


@router.get("/notebook/{roadmap_slug}/{question_id}")
def notebook_detail_route(
    db: Database,
    roadmap_slug: str = Path(min_length=1, max_length=80),
    question_id: str = Path(min_length=1, max_length=220),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None, max_length=1024),
):
    now = utc_now()
    user = get_local_user(db)
    return notebook_detail(
        db, user.id, roadmap_slug, question_id, limit=limit, cursor=cursor, now=now
    )


@router.put("/notebook/{roadmap_slug}/{question_id}/note")
def save_note_route(
    payload: NoteUpdate,
    db: Database,
    roadmap_slug: str = Path(min_length=1, max_length=80),
    question_id: str = Path(min_length=1, max_length=220),
):
    now = utc_now()
    user = get_local_user(db)
    return save_note(
        db,
        user.id,
        roadmap_slug,
        question_id,
        text=payload.text,
        revision=payload.revision,
        now=now,
    )


@router.get("/concept-performance")
def concept_performance_route(
    db: Database,
    roadmap_slug: str | None = Query(default=None, max_length=80),
    days: int = Query(default=30, ge=14, le=365),
):
    now = utc_now()
    user = get_local_user(db)
    return concept_performance(db, user.id, roadmap_slug=roadmap_slug, days=days, now=now)
