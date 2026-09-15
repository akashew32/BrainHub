import ast
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import StrEnum
from random import Random
from typing import Any


class Difficulty(StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"


@dataclass(frozen=True)
class GameDefinition:
    slug: str
    name: str
    description: str
    category: str
    instructions: str
    icon: str
    timed: bool
    scoring_method: str
    modes: tuple[str, ...]
    difficulties: tuple[str, ...] = tuple(level.value for level in Difficulty)


class GameEngine(ABC):
    def __init__(self, seed: int | None = None) -> None:
        self.seed = seed if seed is not None else Random().randrange(2**31)
        self.rng = Random(self.seed)

    def checkpoint(self, state: dict[str, Any]) -> None:
        """Persist Python's deterministic RNG state in JSON-compatible text."""
        state["_rng_state"] = repr(self.rng.getstate())

    def restore(self, state: dict[str, Any]) -> None:
        if checkpoint := state.get("_rng_state"):
            self.rng.setstate(ast.literal_eval(checkpoint))

    @abstractmethod
    def create_session(self, difficulty: Difficulty) -> dict[str, Any]: ...

    @abstractmethod
    def apply_action(self, state: dict[str, Any], action: dict[str, Any]) -> dict[str, Any]: ...

    @abstractmethod
    def public_state(self, state: dict[str, Any]) -> dict[str, Any]: ...
