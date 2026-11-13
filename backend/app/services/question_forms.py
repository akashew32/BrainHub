"""Finite authored practice forms linked to stable original exercise families."""

from __future__ import annotations

import json
import math
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any

FORMS_ROOT = Path(__file__).resolve().parents[1] / "roadmaps" / "variants"
_REQUIRED = {
    "id",
    "family_id",
    "kind",
    "prompt",
    "answer",
    "hints",
    "solution",
    "concept",
    "difficulty",
    "exam",
}
_ALLOWED = _REQUIRED | {"choices", "tolerance"}


def family_id(question: dict[str, Any]) -> str:
    return str(question.get("family_id", question["id"]))


@lru_cache(maxsize=16)
def _read_forms(path: Path, modified: int, size: int) -> Any:
    del modified, size  # File metadata makes edits invalidate this small private cache.
    return json.loads(path.read_text(encoding="utf-8"))


def _numeric_key(value: Any, kind: str) -> bool:
    def number(item: Any) -> bool:
        return type(item) in {int, float} and abs(item) <= 10**100 and math.isfinite(item)

    if kind == "number":
        return number(value)
    if kind == "vector":
        return isinstance(value, list) and 1 <= len(value) <= 64 and all(map(number, value))
    if kind == "matrix":
        return (
            isinstance(value, list)
            and 1 <= len(value) <= 8
            and all(isinstance(row, list) and 1 <= len(row) <= 8 for row in value)
            and len({len(row) for row in value}) == 1
            and all(number(item) for row in value for item in row)
        )
    return False


def add_practice_forms(
    roadmap_slug: str, originals: dict[str, dict[str, Any]]
) -> dict[str, dict[str, Any]]:
    """Validate authored forms before they can become assigned mathematics.

    Missing files allow the original curriculum to run during authoring. Release
    verification separately requires all five files and all 120 alternate forms.
    """
    bank = {qid: {**question, "family_id": qid} for qid, question in originals.items()}
    path = FORMS_ROOT / f"{roadmap_slug}.json"
    if not path.exists():
        return bank
    stat = path.stat()
    data = _read_forms(path, stat.st_mtime_ns, stat.st_size)
    message = "The authored alternate practice bank is invalid."
    if (
        not isinstance(data, dict)
        or set(data) != {"version", "roadmap_slug", "forms"}
        or type(data["version"]) is not int
        or data["version"] != 1
        or data["roadmap_slug"] != roadmap_slug
        or not isinstance(data["forms"], list)
        or len(data["forms"]) != 24
    ):
        raise ValueError(message)
    seen: set[str] = set()
    per_topic: Counter[str] = Counter()
    for form in data["forms"]:
        if not isinstance(form, dict) or not _REQUIRED <= set(form) <= _ALLOWED:
            raise ValueError(message)
        parent_id = form["family_id"]
        parent = originals.get(parent_id) if isinstance(parent_id, str) else None
        if (
            parent is None
            or parent.get("exam") is not False
            or parent.get("kind") == "proof"
            or parent_id in seen
            or form["id"] != parent_id + "--alt-01"
            or len(form["id"]) > 220
            or form["id"] in bank
            or form["exam"] is not False
            or any(form[key] != parent[key] for key in ("kind", "concept", "difficulty"))
            or any(
                not isinstance(form[key], str) or not form[key].strip()
                for key in ("prompt", "solution")
            )
            or form["prompt"].strip() == parent["prompt"].strip()
            or not isinstance(form["hints"], list)
            or not 2 <= len(form["hints"]) <= 8
            or any(not isinstance(hint, str) or not hint.strip() for hint in form["hints"])
            or (
                "tolerance" in form
                and (
                    type(form["tolerance"]) not in {int, float}
                    or not 0 <= form["tolerance"] <= 0.001
                )
            )
        ):
            raise ValueError(message)
        if form["kind"] == "choice":
            choices = form.get("choices")
            if (
                not isinstance(choices, list)
                or not 2 <= len(choices) <= 8
                or any(not isinstance(choice, str) or not choice.strip() for choice in choices)
                or len(set(choices)) != len(choices)
                or type(form["answer"]) is not str
                or form["answer"] not in choices
            ):
                raise ValueError(message)
        elif "choices" in form or not _numeric_key(form["answer"], form["kind"]):
            raise ValueError(message)
        seen.add(parent_id)
        per_topic[parent["topic_slug"]] += 1
        bank[form["id"]] = {
            **form,
            "topic_slug": parent["topic_slug"],
            "lesson_title": parent["lesson_title"],
        }
    expected_topics = {
        question["topic_slug"] for question in originals.values() if not question["exam"]
    }
    if set(per_topic) != expected_topics or any(count != 4 for count in per_topic.values()):
        raise ValueError(message)
    return bank


def practice_families(
    bank: dict[str, dict[str, Any]], *, topic_slug: str | None = None
) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for qid, question in bank.items():
        if question.get("exam") is False and (
            topic_slug is None or question["topic_slug"] == topic_slug
        ):
            result.setdefault(family_id(question), []).append(qid)
    return result


def unique_families(ids: list[str], bank: dict[str, dict[str, Any]]) -> list[str]:
    """Keep the earliest physical recall item, never swap its assigned answer."""
    seen: set[str] = set()
    selected = []
    for qid in ids:
        question = bank.get(qid)
        if question is None:
            continue
        family = family_id(question)
        if family not in seen:
            selected.append(qid)
            seen.add(family)
    return selected
