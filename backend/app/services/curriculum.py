"""Private authored curriculum and safe deterministic answer evaluation.

Answer keys never leave this module before a learner submits a session. Numeric
input is parsed as data (decimal/fraction); expressions are never evaluated.
"""

from __future__ import annotations

import json
import math
import random
import re
from fractions import Fraction
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1] / "roadmaps" / "curriculum"
NUMBER = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d{1,3})?(?:/[+-]?\d+)?$")
PASS_SCORE = 75


@lru_cache(maxsize=1)
def curriculum() -> dict[str, dict[str, Any]]:
    return {
        path.stem: json.loads(path.read_text(encoding="utf-8"))
        for path in sorted(ROOT.glob("*.json"))
    }


def lesson_for(roadmap_slug: str, topic_slug: str) -> dict[str, Any] | None:
    return next(
        (
            lesson
            for lesson in curriculum().get(roadmap_slug, {}).get("lessons", [])
            if lesson["topic_slug"] == topic_slug
        ),
        None,
    )


def questions_for(roadmap_slug: str) -> dict[str, dict[str, Any]]:
    return {
        question["id"]: {
            **question,
            "topic_slug": lesson["topic_slug"],
            "lesson_title": lesson["title"],
        }
        for lesson in curriculum().get(roadmap_slug, {}).get("lessons", [])
        for question in lesson["questions"]
    }


def public_question(question: dict[str, Any], *, include_hints: bool = True) -> dict[str, Any]:
    result = {
        key: value
        for key, value in question.items()
        if key not in {"answer", "accepted_orders", "solution", "exam", "tolerance"}
    }
    if question["kind"] == "choice":
        result["choices"] = random.SystemRandom().sample(
            question["choices"], k=len(question["choices"])
        )
    if not include_hints:
        result["hints"] = []
    return result


def public_lesson(roadmap_slug: str, lesson: dict[str, Any]) -> dict[str, Any]:
    return {
        **{key: value for key, value in lesson.items() if key != "questions"},
        "roadmap_slug": roadmap_slug,
        "sources": curriculum()[roadmap_slug].get("sources", []),
        "practice_count": sum(not question["exam"] for question in lesson["questions"]),
        "question_count": len(lesson["questions"]),
        "pass_score": PASS_SCORE,
    }


def numeric(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise ValueError("Enter a finite number, decimal, or fraction such as 3/4.")
    source = str(value).strip().replace("−", "-")
    if len(source) > 80 or not NUMBER.fullmatch(source):
        raise ValueError("Enter a finite number, decimal, or fraction such as 3/4.")
    try:
        answer = float(Fraction(source))
    except (ValueError, ZeroDivisionError, OverflowError) as error:
        raise ValueError("Enter a finite number with a nonzero denominator.") from error
    if not math.isfinite(answer):
        raise ValueError("Answers must be finite.")
    return answer


def grade(question: dict[str, Any], submitted: Any) -> tuple[bool, str | None]:
    expected = question["answer"]
    kind = question["kind"]
    tolerance = min(float(question.get("tolerance", 1e-6)), 0.001)
    try:
        if kind == "choice":
            if not isinstance(submitted, str) or submitted not in question["choices"]:
                raise ValueError("Choose one of the listed answers.")
            return submitted == expected, None
        if kind in {"vector", "matrix", "proof"} and isinstance(submitted, str):
            try:
                submitted = json.loads(submitted)
            except (ValueError, TypeError) as error:
                raise ValueError(
                    "Use an array such as [1, 2] or a matrix such as [[1, 2], [3, 4]]."
                ) from error
        if kind == "proof":
            if (
                not isinstance(submitted, list)
                or any(type(item) is not int for item in submitted)
                or sorted(submitted) != list(range(1, len(question["choices"]) + 1))
            ):
                raise ValueError("Use every numbered proof step exactly once.")
            return submitted == expected or submitted in question.get("accepted_orders", []), None
        if kind == "vector":
            if not isinstance(submitted, list) or len(submitted) != len(expected):
                raise ValueError(f"Enter a vector with {len(expected)} entries.")
            # Validate all entries before comparing. A wrong first coordinate
            # must not hide a malformed later coordinate through all()'s
            # short-circuit behavior.
            actual_values = [numeric(value) for value in submitted]
            expected_values = [numeric(value) for value in expected]
            return all(
                math.isclose(actual, target, rel_tol=tolerance, abs_tol=tolerance)
                for actual, target in zip(actual_values, expected_values, strict=True)
            ), None
        if kind == "matrix":
            if (
                not isinstance(submitted, list)
                or len(submitted) != len(expected)
                or any(
                    not isinstance(row, list) or len(row) != len(target)
                    for row, target in zip(submitted, expected, strict=True)
                )
            ):
                raise ValueError("The matrix dimensions must match the requested result.")
            actual_values = [numeric(value) for row in submitted for value in row]
            expected_values = [numeric(value) for row in expected for value in row]
            return all(
                math.isclose(actual, target, rel_tol=tolerance, abs_tol=tolerance)
                for actual, target in zip(actual_values, expected_values, strict=True)
            ), None
        return math.isclose(
            numeric(submitted), numeric(expected), rel_tol=tolerance, abs_tol=tolerance
        ), None
    except ValueError as error:
        return False, str(error)
