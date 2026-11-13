"""Private authored curriculum and safe deterministic answer evaluation.

Answer keys never leave this module before a learner submits a session. Numeric
input uses the bounded arithmetic grammar; arbitrary source code is never run.
"""

from __future__ import annotations

import json
import math
import random
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.services.math_input import VERSION, matches_integer, parse_container, parse_number
from app.services.proof_feedback import grade_proof
from app.services.question_forms import add_practice_forms

ROOT = Path(__file__).resolve().parents[1] / "roadmaps" / "curriculum"
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
    originals = {
        question["id"]: {
            **question,
            "topic_slug": lesson["topic_slug"],
            "lesson_title": lesson["title"],
        }
        for lesson in curriculum().get(roadmap_slug, {}).get("lessons", [])
        for question in lesson["questions"]
    }
    try:
        return add_practice_forms(roadmap_slug, originals)
    except (ValueError, OSError, TypeError, KeyError) as error:
        raise HTTPException(
            503, "The current practice forms are unavailable. Please try again later."
        ) from error


def public_question(
    question: dict[str, Any], *, include_hints: bool = True, revealed_hints: int = 0
) -> dict[str, Any]:
    result = {
        key: value
        for key, value in question.items()
        if key
        not in {
            "answer",
            "accepted_orders",
            "proof_dependencies",
            "proof_rationales",
            "solution",
            "exam",
            "tolerance",
        }
    }
    if question["kind"] == "choice":
        result["choices"] = random.SystemRandom().sample(
            question["choices"], k=len(question["choices"])
        )
    available = question.get("hints", []) if include_hints else []
    result["hint_count"] = len(available)
    result["hints"] = available[: max(0, min(revealed_hints, len(available)))]
    integer_answer = question["kind"] == "number" and _integer_key(question["answer"])
    result["math_input_version"] = VERSION
    result["answer_format"] = "integer" if integer_answer else question["kind"]
    if question["kind"] in {"number", "vector", "matrix"}:
        tolerance = 0.0 if integer_answer else _tolerance(question)
        result["numeric_tolerance"] = {"absolute": tolerance, "relative": tolerance}
    return result


def public_lesson(roadmap_slug: str, lesson: dict[str, Any]) -> dict[str, Any]:
    forms = [
        question
        for question in questions_for(roadmap_slug).values()
        if question["topic_slug"] == lesson["topic_slug"] and not question["exam"]
    ]
    return {
        **{key: value for key, value in lesson.items() if key != "questions"},
        "roadmap_slug": roadmap_slug,
        "sources": curriculum()[roadmap_slug].get("sources", []),
        "practice_count": sum(not question["exam"] for question in lesson["questions"]),
        "question_count": len(lesson["questions"]),
        "practice_form_count": len(forms),
        "alternate_form_count": len(forms)
        - sum(not question["exam"] for question in lesson["questions"]),
        "pass_score": PASS_SCORE,
    }


def numeric(value: Any) -> float:
    """Compatibility wrapper for the versioned bounded arithmetic parser."""
    return parse_number(value)


def _integer_key(value: Any) -> bool:
    return type(value) is int or (
        type(value) is float and math.isfinite(value) and value.is_integer()
    )


def _tolerance(question: dict[str, Any]) -> float:
    return max(0.0, min(float(question.get("tolerance", 1e-6)), 0.001))


def grade(question: dict[str, Any], submitted: Any) -> tuple[bool, str | None]:
    expected = question["answer"]
    kind = question["kind"]
    tolerance = _tolerance(question)
    try:
        if kind == "choice":
            if not isinstance(submitted, str) or submitted not in question["choices"]:
                raise ValueError("Choose one of the listed answers.")
            return submitted == expected, None
        if kind == "proof":
            return grade_proof(question, submitted), None
        if kind == "vector":
            actual_values = parse_container(submitted, "vector")
            if len(actual_values) != len(expected):
                raise ValueError(f"Enter a vector with {len(expected)} entries.")
            expected_values = [numeric(value) for value in expected]
            return all(
                math.isclose(actual, target, rel_tol=tolerance, abs_tol=tolerance)
                for actual, target in zip(actual_values, expected_values, strict=True)
            ), None
        if kind == "matrix":
            actual_rows = parse_container(submitted, "matrix")
            if len(actual_rows) != len(expected) or any(
                len(row) != len(target) for row, target in zip(actual_rows, expected, strict=True)
            ):
                raise ValueError("The matrix dimensions must match the requested result.")
            actual_values = [value for row in actual_rows for value in row]
            expected_values = [numeric(value) for row in expected for value in row]
            return all(
                math.isclose(actual, target, rel_tol=tolerance, abs_tol=tolerance)
                for actual, target in zip(actual_values, expected_values, strict=True)
            ), None
        if _integer_key(expected):
            return matches_integer(submitted, int(expected)), None
        return math.isclose(
            numeric(submitted), numeric(expected), rel_tol=tolerance, abs_tol=tolerance
        ), None
    except ValueError as error:
        return False, str(error)
