from itertools import combinations, product
from typing import Any

from app.games.base import Difficulty, GameEngine

ATTRIBUTES = ("shape", "color", "count", "fill")
VALUES = {
    "shape": ("diamond", "wave", "pill"),
    "color": ("cyan", "violet", "amber"),
    "count": (1, 2, 3),
    "fill": ("solid", "striped", "outline"),
}


def is_set(cards: list[dict[str, Any]]) -> bool:
    return len(cards) == 3 and all(
        len({card[attr] for card in cards}) in (1, 3) for attr in ATTRIBUTES
    )


def explain_invalid(cards: list[dict[str, Any]]) -> list[str]:
    return [attr for attr in ATTRIBUTES if len({card[attr] for card in cards}) == 2]


def all_cards() -> list[dict[str, Any]]:
    return [
        dict(zip(ATTRIBUTES, values, strict=True))
        for values in product(*(VALUES[a] for a in ATTRIBUTES))
    ]


def generate_board(rng: Any, size: int = 12) -> list[dict[str, Any]]:
    deck = all_cards()
    for _ in range(1_000):
        board = rng.sample(deck, size)
        if any(is_set(list(group)) for group in combinations(board, 3)):
            return [{"id": index, **card} for index, card in enumerate(board)]
    raise RuntimeError("Unable to generate playable board")


class PatternEngine(GameEngine):
    def create_session(self, difficulty: Difficulty) -> dict[str, Any]:
        size = {
            Difficulty.EASY: 9,
            Difficulty.MEDIUM: 12,
            Difficulty.HARD: 15,
            Difficulty.EXPERT: 18,
        }[difficulty]
        return {
            "board": generate_board(self.rng, size),
            "score": 0,
            "sets_found": 0,
            "mistakes": 0,
            "streak": 0,
        }

    def apply_action(self, state: dict[str, Any], action: dict[str, Any]) -> dict[str, Any]:
        selected = [card for card in state["board"] if card["id"] in action.get("card_ids", [])]
        valid = is_set(selected)
        state.update(
            {"last_valid": valid, "violations": [] if valid else explain_invalid(selected)}
        )
        if valid:
            state["sets_found"] += 1
            state["streak"] += 1
            state["score"] += 100 + min(100, state["streak"] * 10)
            state["board"] = generate_board(self.rng, len(state["board"]))
        else:
            state["mistakes"] += 1
            state["streak"] = 0
            state["score"] = max(0, state["score"] - 25)
        return state

    def public_state(self, state: dict[str, Any]) -> dict[str, Any]:
        return {key: value for key, value in state.items() if key != "_rng_state"}
