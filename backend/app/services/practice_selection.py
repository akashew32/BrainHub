"""Choose one authored form per skill, without immediately repeating its form."""

from __future__ import annotations

import random
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import RoadmapAssessmentSession
from app.services.question_forms import family_id, practice_families


def choose_practice_forms(
    db: Session,
    user_id: int,
    roadmap_slug: str,
    families: list[str],
    bank: dict[str, dict[str, Any]],
    *,
    now: datetime,
) -> list[str]:
    """Assignment history is owned, includes drafts, and uses a stable tie-break.

    Only current physical IDs participate. A removed form does not suppress a
    valid current choice. Frozen sessions and idempotent replays never call this.
    """
    pools = practice_families(bank)
    if len(set(families)) != len(families) or any(family not in pools for family in families):
        raise HTTPException(503, "The current practice selection is unavailable.")
    latest: dict[str, str] = {}
    for ids in db.scalars(
        select(RoadmapAssessmentSession.question_ids)
        .where(
            RoadmapAssessmentSession.user_id == user_id,
            RoadmapAssessmentSession.roadmap_slug == roadmap_slug,
            RoadmapAssessmentSession.started_at <= now,
        )
        .order_by(RoadmapAssessmentSession.started_at.desc(), RoadmapAssessmentSession.id.desc())
    ):
        if not isinstance(ids, list):
            continue
        for qid in ids:
            question = bank.get(qid) if isinstance(qid, str) else None
            if question is not None and question.get("exam") is False:
                latest.setdefault(family_id(question), qid)
        if all(family in latest for family in families):
            break
    picker = random.SystemRandom()
    selected = []
    for family in families:
        pool = pools[family]
        if family not in latest:
            # Introduce the canonical exercise before its inverse/context form.
            selected.append(family)
            continue
        options = [qid for qid in pool if qid != latest.get(family)]
        selected.append(picker.choice(options or pool))
    return selected
