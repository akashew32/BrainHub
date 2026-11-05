from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from app.db.base import RoadmapTopicProgress

CATALOG_PATH = Path(__file__).resolve().parents[1] / "roadmaps" / "catalog.json"
_catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))["roadmaps"]
ROADMAP_TOPICS = {slug: frozenset(topics) for slug, topics in _catalog.items()}
ROADMAP_TOTALS = {slug: len(topics) for slug, topics in ROADMAP_TOPICS.items()}


def serialize_progress(item: RoadmapTopicProgress) -> dict[str, Any]:
    return {
        "roadmap_slug": item.roadmap_slug,
        "topic_slug": item.topic_slug,
        "status": item.status,
        "quiz_score": item.quiz_score,
        "quiz_attempts": item.quiz_attempts,
        "time_spent_seconds": item.time_spent_seconds,
        "last_viewed_at": item.last_viewed_at.isoformat(),
        "completed_at": item.completed_at.isoformat() if item.completed_at else None,
    }


def summarize_progress(items: list[RoadmapTopicProgress]) -> dict[str, Any]:
    by_roadmap: dict[str, list[RoadmapTopicProgress]] = defaultdict(list)
    for item in items:
        by_roadmap[item.roadmap_slug].append(item)

    completed = [item for item in items if item.status in {"completed", "review"}]
    attempted = [item for item in items if item.quiz_attempts]
    roadmaps = []
    for slug, total in ROADMAP_TOTALS.items():
        relevant = by_roadmap[slug]
        roadmap_completed = sum(item.status in {"completed", "review"} for item in relevant)
        roadmaps.append(
            {
                "slug": slug,
                "total": total,
                "started": len(relevant),
                "completed": roadmap_completed,
                "percent": round(roadmap_completed / total * 100),
            }
        )

    return {
        "total": sum(ROADMAP_TOTALS.values()),
        "started": len(items),
        "completed": len(completed),
        "average_quiz_score": (
            round(sum(item.quiz_score for item in attempted) / len(attempted)) if attempted else 0
        ),
        "time_spent_seconds": sum(item.time_spent_seconds for item in items),
        "roadmaps": roadmaps,
    }
