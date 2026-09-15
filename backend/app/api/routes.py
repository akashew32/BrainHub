import secrets
from datetime import datetime
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.base import Attempt, FermiQuestion, GameSession, User, UserGameStats, utc_now
from app.db.session import get_db
from app.games.base import Difficulty, GameEngine
from app.games.liars_dice import LiarsDiceEngine
from app.games.market_making import MarketMakingEngine
from app.games.pattern import PatternEngine
from app.games.registry import GAME_MAP, GAMES
from app.schemas.api import AttemptOut, CompleteAttempt, SessionAction, SessionCreate
from app.services.stats import aggregate_stats, record_attempt

router = APIRouter(prefix="/api")
ENGINES: dict[str, type[GameEngine]] = {
    "pattern-recognition": PatternEngine,
    "market-making": MarketMakingEngine,
    "liars-dice": LiarsDiceEngine,
}
Database = Annotated[Session, Depends(get_db)]


def get_local_user(db: Session) -> User:
    user = db.scalar(select(User).limit(1))
    if user is None:
        user = User(name=get_settings().demo_user_name)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/games")
def games() -> list[dict[str, Any]]:
    return [
        {**game.__dict__, "difficulties": list(game.difficulties), "modes": list(game.modes)}
        for game in GAMES
    ]


@router.get("/games/fermi/questions")
def fermi_questions(db: Database) -> list[dict[str, Any]]:
    questions = db.scalars(select(FermiQuestion).order_by(FermiQuestion.id)).all()
    return [
        {
            "id": item.id,
            "prompt": item.prompt,
            "reference": item.reference,
            "lower_bound": item.lower_bound,
            "upper_bound": item.upper_bound,
            "reasoning": item.reasoning,
            "category": item.category,
        }
        for item in questions
    ]


@router.post("/games/{slug}/sessions")
def create_game_session(slug: str, payload: SessionCreate, db: Database) -> dict[str, Any]:
    if slug not in GAME_MAP:
        raise HTTPException(404, "Unknown game")
    if payload.difficulty not in {item.value for item in Difficulty}:
        raise HTTPException(422, "Invalid difficulty")
    seed = payload.seed if payload.seed is not None else secrets.randbelow(2**31)
    session_id = str(uuid4())
    state: dict[str, Any] = {"score": 0}
    if engine_type := ENGINES.get(slug):
        engine_instance = engine_type(seed)
        state = engine_instance.create_session(Difficulty(payload.difficulty))
        if slug == "market-making":
            state["_quote_started_at"] = utc_now().isoformat()
        engine_instance.checkpoint(state)
    row = GameSession(
        id=session_id,
        user_id=get_local_user(db).id,
        game_slug=slug,
        difficulty=payload.difficulty,
        seed=seed,
        state=state,
    )
    db.add(row)
    db.commit()
    engine = ENGINES.get(slug)
    public = engine(seed).public_state(state) if engine else state
    return {"id": session_id, "slug": slug, "difficulty": payload.difficulty, "state": public}


@router.post("/games/{slug}/sessions/{session_id}/actions")
def game_action(slug: str, session_id: str, payload: SessionAction, db: Database) -> dict[str, Any]:
    row = db.get(GameSession, session_id)
    if row is None or row.game_slug != slug:
        raise HTTPException(404, "Session not found")
    if row.completed:
        raise HTTPException(409, "Session already completed")
    engine_type = ENGINES.get(slug)
    if engine_type is None:
        raise HTTPException(400, "This game uses local low-latency actions")
    if slug == "liars-dice" and row.state.get("turn") != 0:
        raise HTTPException(409, "Wait for the computer opponents to finish their turns")
    engine = engine_type(row.seed)
    engine.restore(row.state)
    try:
        action = dict(payload.action)
        state = dict(row.state)
        if slug == "market-making":
            started_at = datetime.fromisoformat(state["_quote_started_at"])
            action["elapsed_ms"] = max(0, (utc_now() - started_at).total_seconds() * 1000)
        row.state = engine.apply_action(state, action)
        if slug == "market-making" and not row.state["complete"]:
            row.state["_quote_started_at"] = utc_now().isoformat()
        if slug == "liars-dice":
            assert isinstance(engine, LiarsDiceEngine)
            steps = 0
            while row.state["winner"] is None and row.state["turn"] != 0 and steps < 500:
                bot_action = engine.choose_ai_action(row.state, row.state["turn"])
                row.state = engine.apply_action(row.state, bot_action)
                steps += 1
        engine.checkpoint(row.state)
        db.add(row)
        db.commit()
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"id": row.id, "state": engine.public_state(row.state)}


@router.post("/games/{slug}/sessions/{session_id}/complete", response_model=AttemptOut)
def complete_session(slug: str, session_id: str, payload: CompleteAttempt, db: Database) -> Attempt:
    row = db.get(GameSession, session_id)
    if row is None or row.game_slug != slug:
        raise HTTPException(404, "Session not found")
    if row.completed:
        raise HTTPException(409, "Session already completed")
    score = payload.score
    duration_ms = payload.duration_ms
    won = payload.won
    metrics = payload.metrics
    if slug == "market-making":
        if not row.state.get("complete"):
            raise HTTPException(409, "Finish all market rounds before completing the session")
        authoritative = MarketMakingEngine(row.seed).metrics(row.state)
        score = authoritative["score"]
        metrics = authoritative
        duration_ms = max(0, int((utc_now() - row.started_at).total_seconds() * 1000))
    elif slug == "liars-dice":
        if row.state.get("winner") is None:
            raise HTTPException(409, "The match has not produced a winner")
        won = row.state["winner"] == 0
        score = 1000 if won else 250
        metrics = {"rounds": row.state["round"], "winner": row.state["winner"]}
        duration_ms = max(0, int((utc_now() - row.started_at).total_seconds() * 1000))
    row.completed = True
    db.add(row)
    attempt = record_attempt(
        db, row.user_id, slug, row.difficulty, score, duration_ms, won, metrics
    )
    return attempt


@router.get("/attempts/recent", response_model=list[AttemptOut])
def recent_attempts(db: Database, limit: int = 10) -> list[Attempt]:
    user = get_local_user(db)
    return list(
        db.scalars(
            select(Attempt)
            .where(Attempt.user_id == user.id)
            .order_by(Attempt.created_at.desc())
            .limit(min(max(limit, 1), 50))
        )
    )


@router.get("/stats")
def stats(db: Database) -> dict[str, Any]:
    return aggregate_stats(db, get_local_user(db).id)


@router.get("/stats/{game_slug}")
def game_stats(game_slug: str, db: Database) -> dict[str, Any]:
    if game_slug not in GAME_MAP:
        raise HTTPException(404, "Unknown game")
    user = get_local_user(db)
    attempts = list(
        db.scalars(
            select(Attempt)
            .where(Attempt.user_id == user.id, Attempt.game_slug == game_slug)
            .order_by(Attempt.created_at.desc())
            .limit(30)
        )
    )
    summary = db.scalar(
        select(UserGameStats).where(
            UserGameStats.user_id == user.id, UserGameStats.game_slug == game_slug
        )
    )
    accuracies = [
        float(item.metrics["accuracy"])
        for item in attempts
        if isinstance(item.metrics.get("accuracy"), (int, float))
    ]
    return {
        "slug": game_slug,
        "summary": {
            "attempts": summary.attempts if summary else 0,
            "best_score": summary.best_score if summary else 0,
            "average_score": round(summary.average_score, 1) if summary else 0,
            "total_duration_ms": summary.total_duration_ms if summary else 0,
            "recent_accuracy": round(sum(accuracies) / len(accuracies), 1) if accuracies else None,
        },
        "attempts": [AttemptOut.model_validate(item) for item in attempts],
    }
