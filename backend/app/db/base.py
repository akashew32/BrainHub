from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def utc_now() -> datetime:
    """Return a naive UTC timestamp for consistent SQLite/PostgreSQL storage."""
    return datetime.now(UTC).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), default="Local Quant")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    attempts: Mapped[list["Attempt"]] = relationship(back_populates="user")


class Game(Base):
    __tablename__ = "games"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(80))
    is_timed: Mapped[bool] = mapped_column(Boolean, default=False)


class GameSession(Base):
    __tablename__ = "game_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    game_slug: Mapped[str] = mapped_column(String(80), index=True)
    difficulty: Mapped[str] = mapped_column(String(20))
    seed: Mapped[int] = mapped_column(Integer)
    state: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class Attempt(Base):
    __tablename__ = "attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    game_slug: Mapped[str] = mapped_column(String(80), index=True)
    difficulty: Mapped[str] = mapped_column(String(20))
    score: Mapped[float] = mapped_column(Float)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    won: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, index=True)
    user: Mapped[User] = relationship(back_populates="attempts")


class UserGameStats(Base):
    __tablename__ = "user_game_stats"
    __table_args__ = (UniqueConstraint("user_id", "game_slug"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    game_slug: Mapped[str] = mapped_column(String(80))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    best_score: Mapped[float] = mapped_column(Float, default=0)
    average_score: Mapped[float] = mapped_column(Float, default=0)
    total_duration_ms: Mapped[int] = mapped_column(Integer, default=0)


class RoadmapTopicProgress(Base):
    __tablename__ = "roadmap_topic_progress"
    __table_args__ = (UniqueConstraint("user_id", "roadmap_slug", "topic_slug"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    roadmap_slug: Mapped[str] = mapped_column(String(80), index=True)
    topic_slug: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    quiz_score: Mapped[int] = mapped_column(Integer, default=0)
    quiz_attempts: Mapped[int] = mapped_column(Integer, default=0)
    independent_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mastery_version: Mapped[int] = mapped_column(Integer, default=0)
    time_spent_seconds: Mapped[int] = mapped_column(Integer, default=0)
    last_viewed_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class RoadmapAssessmentSession(Base):
    __tablename__ = "roadmap_assessment_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    roadmap_slug: Mapped[str] = mapped_column(String(80))
    topic_slug: Mapped[str | None] = mapped_column(String(160), nullable=True)
    stage_index: Mapped[int] = mapped_column(Integer, default=0)
    mode: Mapped[str] = mapped_column(String(20))
    question_ids: Mapped[list[str]] = mapped_column(JSON)
    draft: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, server_default="{}")
    hint_usage: Mapped[dict[str, int] | None] = mapped_column(JSON, nullable=True, default=dict)
    hint_revision: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class RoadmapQuestionAttempt(Base):
    __tablename__ = "roadmap_question_attempts"
    __table_args__ = (UniqueConstraint("session_id", "question_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("roadmap_assessment_sessions.id"))
    roadmap_slug: Mapped[str] = mapped_column(String(80), index=True)
    topic_slug: Mapped[str] = mapped_column(String(160))
    question_id: Mapped[str] = mapped_column(String(220), index=True)
    concept: Mapped[str] = mapped_column(String(160))
    answer: Mapped[Any] = mapped_column(JSON)
    correct: Mapped[bool] = mapped_column(Boolean)
    hints_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, index=True)


class FermiQuestion(Base):
    __tablename__ = "fermi_questions"
    id: Mapped[int] = mapped_column(primary_key=True)
    prompt: Mapped[str] = mapped_column(String(300), unique=True)
    reference: Mapped[float] = mapped_column(Float)
    lower_bound: Mapped[float] = mapped_column(Float)
    upper_bound: Mapped[float] = mapped_column(Float)
    reasoning: Mapped[str] = mapped_column(String(600))
    category: Mapped[str] = mapped_column(String(80), index=True)
