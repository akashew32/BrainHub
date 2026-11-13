"""Owned assessment snapshots, notebook reflections and concept measurements."""

from __future__ import annotations

import base64
import binascii
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import quote

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.db.base import RoadmapAssessmentSession, RoadmapQuestionAttempt, RoadmapQuestionNote
from app.services.curriculum import curriculum, questions_for
from app.services.spaced_review import utc_naive


@dataclass(frozen=True)
class HistoricalAnswer:
    id: int
    roadmap_slug: str
    question_id: str
    topic_slug: str
    session_id: str
    mode: str
    created_at: datetime
    correct: bool
    hints_used: int | None
    snapshot: dict[str, Any]

    @property
    def order_key(self) -> tuple[datetime, int]:
        return utc_naive(self.created_at), self.id

    @property
    def assistance(self) -> str:
        return (
            "untracked"
            if self.hints_used is None
            else "assisted"
            if self.hints_used
            else "independent"
        )

    @property
    def flagged(self) -> bool:
        return not self.correct or self.assistance != "independent"


def timestamp(value: datetime) -> str:
    return utc_naive(value).isoformat() + "Z"


def owned_history(db: Session, user_id: int, *, now: datetime) -> list[HistoricalAnswer]:
    rows = db.execute(
        select(RoadmapQuestionAttempt, RoadmapAssessmentSession)
        .join(
            RoadmapAssessmentSession,
            RoadmapAssessmentSession.id == RoadmapQuestionAttempt.session_id,
        )
        .where(
            RoadmapQuestionAttempt.user_id == user_id,
            RoadmapAssessmentSession.user_id == user_id,
            RoadmapAssessmentSession.completed_at.is_not(None),
            RoadmapQuestionAttempt.roadmap_slug == RoadmapAssessmentSession.roadmap_slug,
            RoadmapQuestionAttempt.created_at <= utc_naive(now),
        )
    ).all()
    result = []
    for attempt, session in rows:
        feedback = session.result.get("feedback") if isinstance(session.result, dict) else None
        if not isinstance(feedback, list):
            continue
        matches = [
            item
            for item in feedback
            if isinstance(item, dict) and item.get("question_id") == attempt.question_id
        ]
        if len(matches) != 1:
            continue
        snapshot = matches[0]
        correct = bool(attempt.correct)
        if (
            snapshot.get("correct") is not correct
            or not all(
                isinstance(snapshot.get(key), str) for key in ("prompt", "concept", "solution")
            )
            or "submitted_answer" not in snapshot
            or "expected_answer" not in snapshot
        ):
            continue
        hints = attempt.hints_used
        hints = hints if type(hints) is int and hints >= 0 else None
        topic = snapshot.get("topic_slug")
        if not isinstance(topic, str):
            topic = attempt.topic_slug
        result.append(
            HistoricalAnswer(
                id=attempt.id,
                roadmap_slug=attempt.roadmap_slug,
                question_id=attempt.question_id,
                topic_slug=topic,
                session_id=session.id,
                mode=session.mode,
                created_at=utc_naive(attempt.created_at),
                correct=correct,
                hints_used=hints,
                snapshot=snapshot,
            )
        )
    return sorted(result, key=lambda item: item.order_key)


def note_payload(note: RoadmapQuestionNote | None) -> dict[str, Any]:
    return {
        "text": note.text if note else "",
        "revision": note.revision if note else 0,
        "created_at": timestamp(note.created_at) if note else None,
        "updated_at": timestamp(note.updated_at) if note else None,
    }


def _notes(db: Session, user_id: int) -> dict[tuple[str, str], RoadmapQuestionNote]:
    return {
        (item.roadmap_slug, item.question_id): item
        for item in db.scalars(
            select(RoadmapQuestionNote).where(RoadmapQuestionNote.user_id == user_id)
        )
    }


def _availability() -> dict[tuple[str, str], str]:
    # Current curriculum is consulted only for navigation availability, never
    # for historical prompts, answer keys or worked feedback.
    available = {}
    for slug in curriculum():
        try:
            bank = questions_for(slug)
        except HTTPException as error:
            if error.status_code != 503:
                raise
            continue
        for qid, question in bank.items():
            available[(slug, qid)] = question["topic_slug"]
    return available


def _entries(
    history: list[HistoricalAnswer], notes: dict[tuple[str, str], RoadmapQuestionNote]
) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], list[HistoricalAnswer]] = defaultdict(list)
    for item in history:
        grouped[(item.roadmap_slug, item.question_id)].append(item)
    available = _availability()
    result = []
    for key, answers in grouped.items():
        flagged = [item for item in answers if item.flagged]
        if not flagged:
            continue
        latest = answers[-1]
        note = notes.get(key)
        current_topic = available.get(key)
        result.append(
            {
                "roadmap_slug": latest.roadmap_slug,
                "question_id": latest.question_id,
                "topic_slug": latest.topic_slug,
                "lesson_title": latest.snapshot.get("lesson_title")
                or latest.topic_slug.replace("-", " "),
                "concept": latest.snapshot["concept"],
                "prompt": latest.snapshot["prompt"],
                "status": "resolved" if latest.correct and latest.hints_used == 0 else "unresolved",
                "latest_outcome": "mistake" if not latest.correct else latest.assistance,
                "first_flagged_at": timestamp(flagged[0].created_at),
                "last_attempt_at": timestamp(latest.created_at),
                "last_attempt_id": latest.id,
                "attempts": len(answers),
                "incorrect_attempts": sum(not item.correct for item in answers),
                "assisted_attempts": sum(item.assistance == "assisted" for item in answers),
                "untracked_attempts": sum(item.assistance == "untracked" for item in answers),
                "independent_correct_attempts": sum(
                    item.correct and item.hints_used == 0 for item in answers
                ),
                "archived": current_topic is None,
                "practice_url": f"/roadmaps/{quote(latest.roadmap_slug, safe='')}/{quote(current_topic, safe='')}"
                if current_topic is not None
                else None,
                "has_note": bool(note and note.text),
                "note_preview": note.text[:160] if note else "",
            }
        )
    return sorted(
        result,
        key=lambda item: (
            datetime.fromisoformat(item["last_attempt_at"].removesuffix("Z")),
            item["last_attempt_id"],
        ),
        reverse=True,
    )


def _encode_cursor(
    user_id: int, scope: dict[str, Any], watermark: int, at: datetime, last_id: int
) -> str:
    payload = {
        "v": 1,
        "user": user_id,
        "scope": scope,
        "max_id": watermark,
        "last_at": timestamp(at),
        "last_id": last_id,
    }
    return (
        base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode())
        .decode()
        .rstrip("=")
    )


def _decode_cursor(
    cursor: str | None, user_id: int, scope: dict[str, Any], current_max: int
) -> tuple[int, tuple[datetime, int] | None]:
    if cursor is None:
        return current_max, None
    try:
        if not 1 <= len(cursor) <= 1024:
            raise ValueError
        raw = base64.b64decode(cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True)
        data = json.loads(raw)
        if (
            not isinstance(data, dict)
            or set(data) != {"v", "user", "scope", "max_id", "last_at", "last_id"}
            or type(data["v"]) is not int
            or data["v"] != 1
            or type(data["user"]) is not int
            or data["user"] != user_id
            or data["scope"] != scope
            or type(data["max_id"]) is not int
            or not 0 <= data["max_id"] <= current_max
            or type(data["last_id"]) is not int
            or not 1 <= data["last_id"] <= data["max_id"]
            or not isinstance(data["last_at"], str)
        ):
            raise ValueError
        at = datetime.fromisoformat(data["last_at"].replace("Z", "+00:00"))
        return data["max_id"], (utc_naive(at), data["last_id"])
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


def list_notebook(
    db: Session,
    user_id: int,
    *,
    roadmap_slug: str | None,
    state: str,
    limit: int,
    cursor: str | None,
    now: datetime,
) -> dict[str, Any]:
    history = owned_history(db, user_id, now=now)
    scope = {"kind": "list", "roadmap": roadmap_slug, "state": state}
    watermark, boundary = _decode_cursor(
        cursor, user_id, scope, max((item.id for item in history), default=0)
    )
    entries = [
        item
        for item in _entries(
            [item for item in history if item.id <= watermark], _notes(db, user_id)
        )
        if (roadmap_slug is None or item["roadmap_slug"] == roadmap_slug)
        and (state == "all" or item["status"] == state)
    ]
    if boundary is not None:
        if not any(
            (
                datetime.fromisoformat(item["last_attempt_at"].removesuffix("Z")),
                item["last_attempt_id"],
            )
            == boundary
            for item in entries
        ):
            raise HTTPException(
                422, "This page cursor no longer matches an available notebook entry."
            )
        entries = [
            item
            for item in entries
            if (
                datetime.fromisoformat(item["last_attempt_at"].removesuffix("Z")),
                item["last_attempt_id"],
            )
            < boundary
        ]
    page = entries[:limit]
    next_cursor = None
    if len(entries) > limit:
        last = page[-1]
        next_cursor = _encode_cursor(
            user_id,
            scope,
            watermark,
            datetime.fromisoformat(last["last_attempt_at"].removesuffix("Z")),
            last["last_attempt_id"],
        )
    return {
        "generated_at": timestamp(now),
        "items": page,
        "next_cursor": next_cursor,
        "snapshot_max_attempt_id": watermark,
    }


def _history_item(item: HistoricalAnswer) -> dict[str, Any]:
    snapshot = item.snapshot
    result = {
        "attempt_id": item.id,
        "session_id": item.session_id,
        "mode": item.mode,
        "created_at": timestamp(item.created_at),
        "correct": item.correct,
        "hints_used": item.hints_used,
        "assistance": item.assistance,
        "prompt": snapshot["prompt"],
        "concept": snapshot["concept"],
        "submitted_answer": snapshot["submitted_answer"],
        "expected_answer": snapshot["expected_answer"],
        "solution": snapshot["solution"],
    }
    if isinstance(snapshot.get("proof_details"), dict):
        result["proof_details"] = snapshot["proof_details"]
    return result


def notebook_detail(
    db: Session,
    user_id: int,
    roadmap_slug: str,
    question_id: str,
    *,
    limit: int,
    cursor: str | None,
    now: datetime,
) -> dict[str, Any]:
    history = owned_history(db, user_id, now=now)
    scope = {"kind": "history", "roadmap": roadmap_slug, "question": question_id}
    watermark, boundary = _decode_cursor(
        cursor, user_id, scope, max((item.id for item in history), default=0)
    )
    selected = [
        item
        for item in history
        if item.id <= watermark
        and item.roadmap_slug == roadmap_slug
        and item.question_id == question_id
    ]
    notes = _notes(db, user_id)
    entries = _entries(selected, notes)
    if not entries:
        raise HTTPException(404, "This question has no owned notebook history.")
    ordered = sorted(selected, key=lambda item: item.order_key, reverse=True)
    if boundary is not None:
        if not any(item.order_key == boundary for item in ordered):
            raise HTTPException(
                422, "This page cursor no longer matches an available historical answer."
            )
        ordered = [item for item in ordered if item.order_key < boundary]
    page = ordered[:limit]
    next_cursor = (
        _encode_cursor(user_id, scope, watermark, page[-1].created_at, page[-1].id)
        if len(ordered) > limit
        else None
    )
    return {
        "entry": entries[0],
        "note": note_payload(notes.get((roadmap_slug, question_id))),
        "history": {
            "items": [_history_item(item) for item in page],
            "next_cursor": next_cursor,
            "snapshot_max_attempt_id": watermark,
        },
    }


def _save_note(
    db: Session,
    user_id: int,
    roadmap_slug: str,
    question_id: str,
    *,
    text: str,
    revision: int,
    now: datetime,
) -> dict[str, Any]:
    history = [
        item
        for item in owned_history(db, user_id, now=now)
        if item.roadmap_slug == roadmap_slug and item.question_id == question_id
    ]
    if not any(item.flagged for item in history):
        raise HTTPException(404, "This question has no owned notebook history.")
    note = db.scalar(
        select(RoadmapQuestionNote)
        .where(
            RoadmapQuestionNote.user_id == user_id,
            RoadmapQuestionNote.roadmap_slug == roadmap_slug,
            RoadmapQuestionNote.question_id == question_id,
        )
        .with_for_update()
    )
    if note is not None:
        if revision <= note.revision and text == note.text:
            return note_payload(note)
        if revision != note.revision:
            raise HTTPException(
                409, "This note changed elsewhere. Reload the saved note before saving your text."
            )
        changed = db.execute(
            update(RoadmapQuestionNote)
            .where(RoadmapQuestionNote.id == note.id, RoadmapQuestionNote.revision == revision)
            .values(text=text, revision=revision + 1, updated_at=utc_naive(now))
            .execution_options(synchronize_session=False)
        )
        if not isinstance(changed, CursorResult) or changed.rowcount != 1:
            db.rollback()
            raise HTTPException(
                409, "This note changed elsewhere. Reload the saved note before saving your text."
            )
        db.commit()
        db.refresh(note)
        return note_payload(note)
    if revision != 0:
        raise HTTPException(409, "Start this note from its current empty revision.")
    note = RoadmapQuestionNote(
        user_id=user_id,
        roadmap_slug=roadmap_slug,
        question_id=question_id,
        text=text,
        revision=1,
        created_at=utc_naive(now),
        updated_at=utc_naive(now),
    )
    db.add(note)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        winner = db.scalar(
            select(RoadmapQuestionNote).where(
                RoadmapQuestionNote.user_id == user_id,
                RoadmapQuestionNote.roadmap_slug == roadmap_slug,
                RoadmapQuestionNote.question_id == question_id,
            )
        )
        if winner is not None and winner.text == text:
            return note_payload(winner)
        raise HTTPException(
            409, "This note was created elsewhere. Reload the saved note before saving your text."
        ) from error
    return note_payload(note)


def save_note(
    db: Session,
    user_id: int,
    roadmap_slug: str,
    question_id: str,
    *,
    text: str,
    revision: int,
    now: datetime,
) -> dict[str, Any]:
    try:
        return _save_note(
            db, user_id, roadmap_slug, question_id, text=text, revision=revision, now=now
        )
    except OperationalError as error:
        db.rollback()
        raise HTTPException(409, "The saved note is busy. Retry with your current text.") from error


def _metrics(history: list[HistoricalAnswer]) -> dict[str, Any]:
    correct = sum(item.correct for item in history)
    result: dict[str, Any] = {
        "answers": len(history),
        "correct": correct,
        "incorrect": len(history) - correct,
        "accuracy": round(100 * correct / len(history)) if history else None,
        "questions_seen": len({(item.roadmap_slug, item.question_id) for item in history}),
    }
    for category in ("independent", "assisted", "untracked"):
        selected = [item for item in history if item.assistance == category]
        successes = sum(item.correct for item in selected)
        result[category] = {
            "answers": len(selected),
            "correct": successes,
            "accuracy": round(100 * successes / len(selected)) if selected else None,
        }
    return result


def concept_performance(
    db: Session, user_id: int, *, roadmap_slug: str | None, days: int, now: datetime
) -> dict[str, Any]:
    reference = utc_naive(now)
    midnight = reference.replace(hour=0, minute=0, second=0, microsecond=0)
    start = midnight - timedelta(days=days - 1)
    history = [
        item
        for item in owned_history(db, user_id, now=reference)
        if item.created_at >= start and (roadmap_slug is None or item.roadmap_slug == roadmap_slug)
    ]
    grouped: dict[tuple[str, str, str], list[HistoricalAnswer]] = defaultdict(list)
    for item in history:
        grouped[(item.roadmap_slug, item.topic_slug, item.snapshot["concept"])].append(item)
    concepts = [
        {
            "roadmap_slug": slug,
            "topic_slug": topic,
            "concept": concept,
            "latest_attempt_at": timestamp(items[-1].created_at),
            **_metrics(items),
        }
        for (slug, topic, concept), items in sorted(grouped.items())
    ]
    trend = []
    for offset in range(13, -1, -1):
        day = (midnight - timedelta(days=offset)).date()
        trend.append(
            {
                "date": day.isoformat(),
                **_metrics([item for item in history if item.created_at.date() == day]),
            }
        )
    return {
        "generated_at": timestamp(reference),
        "window": {
            "days": days,
            "start_at": timestamp(start),
            "end_at": timestamp(reference),
            "timezone": "UTC",
        },
        "totals": _metrics(history),
        "concepts": concepts,
        "trend": trend,
    }
