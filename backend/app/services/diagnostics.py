"""Balanced, low-stakes foundation samples without mastery or exam credit."""

from __future__ import annotations

import random
from collections import defaultdict
from typing import Any

from fastapi import HTTPException

from app.services.assessment_sessions import diagnostic_study_url
from app.services.curriculum import questions_for

NOTICE = (
    "This diagnostic samples two questions from each foundation lesson. It suggests where to study; "
    "it does not establish mastery, complete a lesson, or unlock a stage exam."
)


def select_diagnostic_questions(data: dict[str, Any]) -> list[str]:
    """Choose one foundation and one core practice question per lesson."""
    lessons = data.get("lessons")
    message = "A balanced diagnostic requires six lessons, each with distinct foundation and core practice questions."
    if not isinstance(lessons, list) or len(lessons) != 6:
        raise HTTPException(409, message)
    topics: set[str] = set()
    seen_ids: set[str] = set()
    selected: list[str] = []
    rng = random.SystemRandom()
    for lesson in lessons:
        if not isinstance(lesson, dict):
            raise HTTPException(409, message)
        topic = lesson.get("topic_slug")
        questions = lesson.get("questions")
        if (
            not isinstance(topic, str)
            or not topic
            or topic in topics
            or not isinstance(questions, list)
        ):
            raise HTTPException(409, message)
        topics.add(topic)
        pools: dict[str, list[str]] = {"foundation": [], "core": []}
        for question in questions:
            if not isinstance(question, dict):
                raise HTTPException(409, message)
            question_id = question.get("id")
            if not isinstance(question_id, str) or not question_id or question_id in seen_ids:
                raise HTTPException(409, message)
            seen_ids.add(question_id)
            if (
                question.get("exam") is False
                and isinstance(question.get("difficulty"), str)
                and question["difficulty"] in pools
            ):
                pools[question["difficulty"]].append(question_id)
        if not all(pools.values()):
            raise HTTPException(409, message)
        selected.extend(rng.choice(pools[difficulty]) for difficulty in ("foundation", "core"))
    return selected


def build_diagnostic_summary(
    roadmap_slug: str,
    assigned: dict[str, dict[str, Any]],
    feedback: list[dict[str, Any]],
) -> dict[str, Any]:
    """Use frozen assigned mathematics and final graded evidence, never a new sample."""
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_id = {item["question_id"]: item for item in feedback}
    if len(assigned) != 12 or len(by_id) != 12 or set(by_id) != set(assigned):
        raise HTTPException(409, "This saved diagnostic is not a complete balanced sample.")
    for question_id, question in assigned.items():
        grouped[question["topic_slug"]].append(
            {"question": question, "correct": by_id[question_id]["correct"]}
        )
    if len(grouped) != 6 or any(len(items) != 2 for items in grouped.values()):
        raise HTTPException(409, "This saved diagnostic is not a complete balanced sample.")
    current = questions_for(roadmap_slug)
    topics = []
    guidance = {
        0: "Start with this lesson's definitions and worked examples, then complete its full eight-question practice set.",
        1: "Review the worked feedback for the missed sample, then complete the full eight-question practice set.",
        2: "Both samples were correct. Complete the full eight-question practice set to verify independent readiness; this sample does not establish mastery.",
    }
    for topic_slug, items in grouped.items():
        correct = sum(item["correct"] for item in items)
        topics.append(
            {
                "topic_slug": topic_slug,
                "title": items[0]["question"]["lesson_title"],
                "correct": correct,
                "total": 2,
                "priority": ("start_here", "review", "verify")[correct],
                "guidance": guidance[correct],
                "study_url": diagnostic_study_url(
                    roadmap_slug, topic_slug, [item["question"] for item in items], current
                ),
            }
        )
    topics.sort(key=lambda item: (item["correct"], item["topic_slug"]))
    return {
        "version": 1,
        "notice": NOTICE,
        "topics": topics,
        "recommended_topics": [item["topic_slug"] for item in topics],
    }
