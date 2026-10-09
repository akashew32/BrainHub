from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Attempt, UserGameStats
from app.games.registry import GAME_MAP, GAMES


def record_attempt(
    db: Session,
    user_id: int,
    game_slug: str,
    difficulty: str,
    score: float,
    duration_ms: int,
    won: bool | None,
    metrics: dict,
) -> Attempt:
    attempt = Attempt(
        user_id=user_id,
        game_slug=game_slug,
        difficulty=difficulty,
        score=score,
        duration_ms=duration_ms,
        won=won,
        metrics=metrics,
    )
    stats = db.scalar(
        select(UserGameStats).where(
            UserGameStats.user_id == user_id, UserGameStats.game_slug == game_slug
        )
    )
    if stats is None:
        stats = UserGameStats(
            user_id=user_id,
            game_slug=game_slug,
            attempts=0,
            best_score=0,
            average_score=0,
            total_duration_ms=0,
        )
        db.add(stats)
    stats.average_score = (stats.average_score * stats.attempts + score) / (stats.attempts + 1)
    stats.attempts += 1
    stats.best_score = max(stats.best_score, score)
    stats.total_duration_ms += duration_ms
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def aggregate_stats(db: Session, user_id: int) -> dict:
    attempts = list(
        db.scalars(
            select(Attempt).where(Attempt.user_id == user_id).order_by(Attempt.created_at.desc())
        )
    )
    game_stats = list(db.scalars(select(UserGameStats).where(UserGameStats.user_id == user_id)))
    average = sum(item.average_score for item in game_stats) / max(1, len(game_stats))
    dates = {item.created_at.date() for item in attempts}
    streak, day = 0, datetime.now(UTC).date()
    if day not in dates:
        day -= timedelta(days=1)
    while day in dates:
        streak += 1
        day -= timedelta(days=1)
    attempts_by_game = {
        item.game_slug: [attempt for attempt in attempts if attempt.game_slug == item.game_slug]
        for item in game_stats
    }
    games = []
    for item in game_stats:
        relevant = attempts_by_game[item.game_slug]
        accuracies = [
            float(attempt.metrics["accuracy"])
            for attempt in relevant
            if isinstance(attempt.metrics.get("accuracy"), int | float)
        ]
        games.append(
            {
                "slug": item.game_slug,
                "attempts": item.attempts,
                "best_score": item.best_score,
                "average_score": round(item.average_score, 1),
                "accuracy": round(sum(accuracies) / len(accuracies), 1) if accuracies else None,
                "total_duration_ms": item.total_duration_ms,
            }
        )
    categories: dict[str, list[float]] = {game.category: [] for game in GAMES}
    for item in game_stats:
        category = GAME_MAP[item.game_slug].category
        categories.setdefault(category, []).append(item.average_score)
    return {
        "games_played": len(attempts),
        "total_training_ms": sum(item.duration_ms for item in attempts),
        "current_streak": streak,
        "rating": round(800 + min(1200, average * 2 + len(attempts) * 3)),
        "games": games,
        "categories": [
            {
                "name": name,
                "rating": round(800 + min(1400, sum(scores) / len(scores) * 2)) if scores else 800,
            }
            for name, scores in categories.items()
        ],
        "recent_trend": [
            {
                "date": attempt.created_at.strftime("%m/%d"),
                "score": round(attempt.score),
                "game": attempt.game_slug,
            }
            for attempt in reversed(attempts[:14])
        ],
    }
