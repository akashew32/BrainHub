from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    difficulty: str = "medium"
    seed: int | None = Field(default=None, ge=0, lt=2**31)


class SessionAction(BaseModel):
    action: dict[str, Any]


class CompleteAttempt(BaseModel):
    score: float = Field(ge=0)
    duration_ms: int = Field(default=0, ge=0)
    won: bool | None = None
    metrics: dict[str, Any] = Field(default_factory=dict)


class AttemptOut(CompleteAttempt):
    id: int
    game_slug: str
    difficulty: str
    created_at: datetime
    model_config = {"from_attributes": True}


class ChallengeRun(BaseModel):
    language: Literal["python", "java", "cpp"]
    source: str = Field(min_length=1, max_length=30_000)
    mode: Literal["run", "submit"] = "run"
