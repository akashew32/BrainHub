"""Owned assessment summaries without assigned questions or answer data.

Pagination anchors the immutable start order. Lifecycle filters remain live:
completing or expiring a session can change its membership between page reads.
"""

from __future__ import annotations

import base64
import binascii
import json
from datetime import datetime
from typing import Any
from urllib.parse import quote
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import String, and_, cast, or_, select
from sqlalchemy.orm import Session

from app.db.base import RoadmapAssessmentSession
from app.services.assessment_sessions import assessment_state, frozen_entries
from app.services.curriculum import PASS_SCORE, curriculum, questions_for
from app.services.spaced_review import utc_naive


def _timestamp(value: datetime) -> str:
    return utc_naive(value).isoformat() + "Z"


def _cursor(
    *, user_id: int, scope: dict[str, Any], as_of: datetime, last_at: datetime, last_id: str
) -> str:
    data = {
        "v": 1,
        "user": user_id,
        "scope": scope,
        "as_of": _timestamp(as_of),
        "last_at": _timestamp(last_at),
        "last_id": last_id,
    }
    return (
        base64.urlsafe_b64encode(json.dumps(data, separators=(",", ":")).encode())
        .decode()
        .rstrip("=")
    )


def _parse_time(value: Any) -> datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ValueError
    parsed = utc_naive(datetime.fromisoformat(value.removesuffix("Z") + "+00:00"))
    if _timestamp(parsed) != value:
        raise ValueError
    return parsed


def _decode_cursor(
    cursor: str | None, *, user_id: int, scope: dict[str, Any], now: datetime
) -> tuple[datetime, tuple[datetime, str] | None]:
    if cursor is None:
        return utc_naive(now), None
    try:
        if not 1 <= len(cursor) <= 1024:
            raise ValueError
        raw = base64.b64decode(cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True)
        data = json.loads(raw)
        if (
            not isinstance(data, dict)
            or set(data) != {"v", "user", "scope", "as_of", "last_at", "last_id"}
            or type(data["v"]) is not int
            or data["v"] != 1
            or type(data["user"]) is not int
            or data["user"] != user_id
            or data["scope"] != scope
            or not isinstance(data["last_id"], str)
            or str(UUID(data["last_id"])) != data["last_id"]
        ):
            raise ValueError
        as_of = _parse_time(data["as_of"])
        last_at = _parse_time(data["last_at"])
        if last_at > as_of or as_of > utc_naive(now):
            raise ValueError
        return as_of, (last_at, data["last_id"])
    except (
        ValueError,
        TypeError,
        KeyError,
        binascii.Error,
        UnicodeDecodeError,
        RecursionError,
        OverflowError,
    ) as error:
        raise HTTPException(
            422, "This page cursor is invalid for the selected user and filters."
        ) from error


def _result_summary(session: RoadmapAssessmentSession) -> dict[str, Any] | None:
    result = session.result
    if not isinstance(result, dict) or session.completed_at is None:
        return None
    total, correct, score = result.get("total"), result.get("correct"), result.get("score")
    if (
        result.get("session_id") != session.id
        or result.get("mode") != session.mode
        or type(total) is not int
        or not 1 <= total <= 60
        or type(correct) is not int
        or not 0 <= correct <= total
        or type(score) is not int
        or score != round(100 * correct / total)
        or type(result.get("passed")) is not bool
        or result["passed"] != (score >= PASS_SCORE)
    ):
        return None
    feedback = result.get("feedback")
    if (
        not isinstance(feedback, list)
        or len(feedback) != total
        or any(
            not isinstance(item, dict) or type(item.get("correct")) is not bool for item in feedback
        )
        or sum(item["correct"] for item in feedback) != correct
        or any(not isinstance(item.get("question_id"), str) for item in feedback)
        or any(
            any(
                not isinstance(item.get(key), str)
                for key in ("prompt", "concept", "solution", "topic_slug")
            )
            or "submitted_answer" not in item
            or "expected_answer" not in item
            for item in feedback
        )
        or len({item["question_id"] for item in feedback}) != total
        or {item["question_id"] for item in feedback} != set(session.question_ids)
    ):
        return None
    independent = result.get("independent_score")
    category = result.get("assistance", "untracked")
    if (
        not isinstance(category, str)
        or category not in {"independent", "assisted", "untracked"}
        or (
            independent is not None
            and (type(independent) is not int or not 0 <= independent <= score)
        )
        or (category == "untracked" and independent is not None)
    ):
        return None
    return {
        "score": score,
        "independent_score": independent,
        "correct": correct,
        "total": total,
        "passed": result["passed"],
        "assistance": category,
    }


def _summary(
    session: RoadmapAssessmentSession,
    *,
    now: datetime,
    banks: dict[str, dict[str, Any]],
    topics: set[tuple[str, str]],
) -> dict[str, Any]:
    state = assessment_state(session, now=now)
    ids = session.question_ids
    valid_ids = (
        isinstance(ids, list)
        and 1 <= len(ids) <= 60
        and all(isinstance(item, str) for item in ids)
        and len(set(ids)) == len(ids)
    )
    snapshot_valid = True
    try:
        entries = frozen_entries(session) if valid_ids else None
    except (HTTPException, TypeError, KeyError):
        entries, snapshot_valid = None, False
    available = bool(
        valid_ids
        and snapshot_valid
        and (entries is not None or all(qid in banks.get(session.roadmap_slug, {}) for qid in ids))
    )
    result = _result_summary(session) if valid_ids else None
    recoverable = snapshot_valid and (result is not None if state == "completed" else available)
    draft = session.draft if isinstance(session.draft, dict) else {}
    saved = draft.get("answers", [])
    saved_entries = (
        len(
            {
                item["question_id"]
                for item in saved
                if isinstance(item, dict)
                and isinstance(item.get("question_id"), str)
                and item["question_id"] in ids
            }
        )
        if valid_ids and isinstance(saved, list)
        else 0
    )
    study = (
        f"/roadmaps/{quote(session.roadmap_slug, safe='')}/{quote(session.topic_slug, safe='')}"
        if session.topic_slug is not None and (session.roadmap_slug, session.topic_slug) in topics
        else None
    )
    return {
        "id": session.id,
        "roadmap_slug": session.roadmap_slug,
        "topic_slug": session.topic_slug,
        "stage_index": session.stage_index,
        "mode": session.mode,
        "state": state,
        "started_at": _timestamp(session.started_at),
        "completed_at": _timestamp(session.completed_at) if session.completed_at else None,
        "expires_at": _timestamp(session.expires_at),
        "question_count": len(ids) if valid_ids else 0,
        "saved_entries": saved_entries,
        "result_available": result is not None,
        "result_summary": result,
        "questions_available": available,
        "open_url": f"/roadmaps/sessions/{session.id}" if recoverable else None,
        "study_url": study,
    }


def list_assessment_sessions(
    db: Session,
    user_id: int,
    *,
    roadmap_slug: str | None,
    mode: str | None,
    state: str,
    limit: int,
    cursor: str | None,
    now: datetime,
) -> dict[str, Any]:
    reference = utc_naive(now)
    scope = {"roadmap_slug": roadmap_slug, "mode": mode, "state": state}
    as_of, boundary = _decode_cursor(cursor, user_id=user_id, scope=scope, now=reference)
    statement = select(RoadmapAssessmentSession).where(
        RoadmapAssessmentSession.user_id == user_id, RoadmapAssessmentSession.started_at <= as_of
    )
    if roadmap_slug is not None:
        statement = statement.where(RoadmapAssessmentSession.roadmap_slug == roadmap_slug)
    if mode is not None:
        statement = statement.where(RoadmapAssessmentSession.mode == mode)
    # Casting distinguishes SQL NULL and persisted JSON null on both SQLite and
    # PostgreSQL JSON (which lacks the JSONB equality operator).
    completed = and_(
        RoadmapAssessmentSession.result.is_not(None),
        cast(RoadmapAssessmentSession.result, String) != "null",
    )
    if state == "completed":
        statement = statement.where(completed)
    elif state in {"active", "expired"}:
        statement = statement.where(
            ~completed,
            RoadmapAssessmentSession.expires_at > reference
            if state == "active"
            else RoadmapAssessmentSession.expires_at <= reference,
        )
    if boundary is not None:
        at, session_id = boundary
        statement = statement.where(
            or_(
                RoadmapAssessmentSession.started_at < at,
                and_(
                    RoadmapAssessmentSession.started_at == at,
                    RoadmapAssessmentSession.id < session_id,
                ),
            )
        )
    rows = list(
        db.scalars(
            statement.order_by(
                RoadmapAssessmentSession.started_at.desc(), RoadmapAssessmentSession.id.desc()
            ).limit(limit + 1)
        )
    )
    selected = rows[:limit]
    banks = {slug: questions_for(slug) for slug in curriculum()}
    topics = {
        (slug, lesson["topic_slug"])
        for slug, data in curriculum().items()
        for lesson in data["lessons"]
    }
    return {
        "generated_at": _timestamp(reference),
        "items": [_summary(item, now=reference, banks=banks, topics=topics) for item in selected],
        "next_cursor": _cursor(
            user_id=user_id,
            scope=scope,
            as_of=as_of,
            last_at=selected[-1].started_at,
            last_id=selected[-1].id,
        )
        if len(rows) > limit
        else None,
    }
