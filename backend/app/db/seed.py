"""Seed the game catalog and optional local demo history."""

import argparse
from datetime import timedelta

from sqlalchemy import select

from app.core.config import get_settings
from app.db.base import Base, FermiQuestion, Game, User, utc_now
from app.db.session import SessionLocal, engine
from app.games.fermi_bank import FERMI_QUESTIONS
from app.games.registry import GAMES
from app.services.stats import record_attempt


def seed(include_demo: bool = False) -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        user = db.scalar(select(User).limit(1))
        if user is None:
            user = User(name=get_settings().demo_user_name)
            db.add(user)
            db.flush()
        for definition in GAMES:
            if db.scalar(select(Game).where(Game.slug == definition.slug)) is None:
                db.add(
                    Game(
                        slug=definition.slug,
                        name=definition.name,
                        category=definition.category,
                        is_timed=definition.timed,
                    )
                )
        if db.scalar(select(FermiQuestion).limit(1)) is None:
            for prompt, reference, lower, upper, reasoning, category in FERMI_QUESTIONS:
                db.add(
                    FermiQuestion(
                        prompt=prompt,
                        reference=reference,
                        lower_bound=lower,
                        upper_bound=upper,
                        reasoning=reasoning,
                        category=category,
                    )
                )
        db.commit()
        if include_demo and not user.attempts:
            for index, definition in enumerate(GAMES):
                attempt = record_attempt(
                    db,
                    user.id,
                    definition.slug,
                    "medium",
                    610 + index * 37,
                    60_000 + index * 4_000,
                    index == 5,
                    {"accuracy": 72 + index * 3},
                )
                attempt.created_at = utc_now() - timedelta(days=5 - index)
            db.commit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true", help="Add representative attempt history")
    seed(parser.parse_args().demo)
