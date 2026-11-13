"""Interpret tracked hint evidence without upgrading legacy uncertainty."""

from typing import Literal

Assistance = Literal["independent", "assisted", "untracked"]


def hints_used(usage: dict[str, int] | None, question_id: str | None = None) -> int | None:
    if usage is None:
        return None
    return usage.get(question_id, 0) if question_id is not None else sum(usage.values())


def assistance(usage: dict[str, int] | None, question_id: str | None = None) -> Assistance:
    count = hints_used(usage, question_id)
    return "untracked" if count is None else "assisted" if count else "independent"
