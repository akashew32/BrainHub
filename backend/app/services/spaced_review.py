"""A transparent review heuristic derived only from immutable graded answers.

The intervals are a product policy, not a claim of an optimal memory model.
Early correct practice may reinforce learning but does not advance or postpone
the last qualifying schedule. Reading pages and saving drafts produce no evidence.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import RoadmapAssessmentSession, RoadmapQuestionAttempt
from app.services.curriculum import curriculum, questions_for

INTERVAL_DAYS = (1, 3, 7, 14, 30, 60, 90)
SESSION_LIMIT = 8
Status = Literal["mistake", "assisted", "untracked", "recall"]
STATUS_ORDER = {"mistake": 0, "assisted": 1, "untracked": 2, "recall": 3}
QuestionBanks = Mapping[str, Mapping[str, dict[str, Any]]]


@dataclass(frozen=True)
class ReviewEvidence:
    id: int
    user_id: int
    roadmap_slug: str
    question_id: str
    correct: bool
    hints_used: int | None
    created_at: datetime
    mode: str = "practice"


@dataclass(frozen=True)
class ReviewState:
    status: Status
    independent_streak: int
    interval_days: int
    due_at: datetime
    last_attempt_at: datetime
    last_correct: bool
    last_hints_used: int | None
    attempts: int


def utc_naive(value: datetime) -> datetime:
    return value if value.tzinfo is None else value.astimezone(UTC).replace(tzinfo=None)


def _timestamp(value: datetime) -> str:
    return utc_naive(value).isoformat() + "Z"


def _due_time(item: dict[str, Any]) -> datetime:
    # ISO strings with optional fractional seconds are not lexicographically
    # chronological at exact-second boundaries.
    return datetime.fromisoformat(item["due_at"].removesuffix("Z"))


def schedule_history(history: Iterable[ReviewEvidence], *, now: datetime) -> ReviewState | None:
    reference = utc_naive(now)
    ordered = sorted(
        (attempt for attempt in history if utc_naive(attempt.created_at) <= reference),
        key=lambda attempt: (utc_naive(attempt.created_at), attempt.id),
    )
    state = None
    for index, attempt in enumerate(ordered):
        at = utc_naive(attempt.created_at)
        hints = attempt.hints_used
        hints = hints if type(hints) is int and hints >= 0 else None
        if not attempt.correct:
            status: Status = "mistake"
        elif hints is None:
            status = "untracked"
        elif hints > 0:
            status = "assisted"
        else:
            status = "recall"
        if status != "recall":
            streak, interval, due_at = 0, 0, at
        elif state is None or state.independent_streak == 0:
            streak, interval = 1, INTERVAL_DAYS[0]
            due_at = at + timedelta(days=interval)
        elif at >= state.due_at:
            streak = state.independent_streak + 1
            interval = INTERVAL_DAYS[min(streak - 1, len(INTERVAL_DAYS) - 1)]
            due_at = at + timedelta(days=interval)
        else:
            # Preserve the previous qualifying anchor, even if many early
            # practice answers occur just before the due time.
            streak = state.independent_streak
            interval = state.interval_days
            due_at = state.due_at
        state = ReviewState(
            status=status,
            independent_streak=streak,
            interval_days=interval,
            due_at=due_at,
            last_attempt_at=at,
            last_correct=attempt.correct,
            last_hints_used=hints,
            attempts=index + 1,
        )
    return state


def _reason(state: ReviewState, is_due: bool) -> str:
    if state.status == "mistake":
        return "The latest answer was incorrect; independent recall is due now."
    if state.status == "assisted":
        return "The latest correct answer used hints; retry without hints."
    if state.status == "untracked":
        return "Hint use was untracked for the latest correct answer; establish independent recall."
    return (
        f"Independent recall is due after the {state.interval_days}-day interval."
        if is_due
        else f"Independent recall is scheduled at the {state.interval_days}-day interval."
    )


def build_review_plan(
    attempts: Iterable[ReviewEvidence],
    banks: QuestionBanks,
    *,
    user_id: int,
    now: datetime,
) -> dict[str, Any]:
    reference = utc_naive(now)
    grouped: dict[tuple[str, str], list[ReviewEvidence]] = defaultdict(list)
    today_reviewed: set[tuple[str, str]] = set()
    today_independent: set[tuple[str, str]] = set()
    for attempt in attempts:
        if (
            attempt.user_id != user_id
            or attempt.question_id not in banks.get(attempt.roadmap_slug, {})
            or utc_naive(attempt.created_at) > reference
        ):
            continue
        key = (attempt.roadmap_slug, attempt.question_id)
        grouped[key].append(attempt)
        if attempt.mode == "review" and utc_naive(attempt.created_at).date() == reference.date():
            today_reviewed.add(key)
            if attempt.correct and type(attempt.hints_used) is int and attempt.hints_used == 0:
                today_independent.add(key)
    all_items = []
    for (roadmap_slug, question_id), history in grouped.items():
        state = schedule_history(history, now=reference)
        if state is None:
            continue
        question = banks[roadmap_slug][question_id]
        is_due = state.due_at <= reference
        all_items.append(
            {
                "question_id": question_id,
                "roadmap_slug": roadmap_slug,
                "topic_slug": question["topic_slug"],
                "lesson_title": question["lesson_title"],
                "concept": question["concept"],
                "last_correct": state.last_correct,
                "attempts": state.attempts,
                "last_attempt_at": _timestamp(state.last_attempt_at),
                "due_at": _timestamp(state.due_at),
                "reason": _reason(state, is_due),
                "prompt": question["prompt"],
                "status": state.status,
                "independent_streak": state.independent_streak,
                "interval_days": state.interval_days,
                "is_due": is_due,
                "last_hints_used": state.last_hints_used,
            }
        )
    due = sorted(
        (item for item in all_items if item["is_due"]),
        key=lambda item: (
            STATUS_ORDER[item["status"]],
            _due_time(item),
            item["roadmap_slug"],
            item["question_id"],
        ),
    )
    scheduled = sorted(
        (item for item in all_items if not item["is_due"]),
        key=lambda item: (_due_time(item), item["roadmap_slug"], item["question_id"]),
    )
    subjects = []
    for slug, bank in sorted(banks.items()):
        subject_scheduled = [item for item in scheduled if item["roadmap_slug"] == slug]
        subject_seen = sum(item["roadmap_slug"] == slug for item in all_items)
        subjects.append(
            {
                "slug": slug,
                "due": sum(item["roadmap_slug"] == slug for item in due),
                "scheduled": len(subject_scheduled),
                "tracked": subject_seen,
                "unseen": len(bank) - subject_seen,
                "next_due_at": subject_scheduled[0]["due_at"] if subject_scheduled else None,
            }
        )
    return {
        "generated_at": _timestamp(reference),
        "policy": {
            "version": 1,
            "interval_days": list(INTERVAL_DAYS),
            "session_limit": SESSION_LIMIT,
            "timezone": "UTC",
            "early_practice_advances": False,
        },
        "summary": {
            "due": len(due),
            "scheduled": len(scheduled),
            "tracked": len(all_items),
            "unseen": sum(len(bank) for bank in banks.values()) - len(all_items),
            "reviewed_today": len(today_reviewed),
            "independent_today": len(today_independent),
            "next_due_at": scheduled[0]["due_at"] if scheduled else None,
        },
        "subjects": subjects,
        "items": due,
        "upcoming": scheduled[:10],
    }


def review_plan_for_user(db: Session, user_id: int, *, now: datetime) -> dict[str, Any]:
    rows = db.execute(
        select(RoadmapQuestionAttempt, RoadmapAssessmentSession.mode)
        .join(
            RoadmapAssessmentSession,
            RoadmapAssessmentSession.id == RoadmapQuestionAttempt.session_id,
        )
        .where(
            RoadmapQuestionAttempt.user_id == user_id,
            RoadmapAssessmentSession.user_id == user_id,
            RoadmapAssessmentSession.completed_at.is_not(None),
        )
    ).all()
    evidence = [
        ReviewEvidence(
            id=attempt.id,
            user_id=attempt.user_id,
            roadmap_slug=attempt.roadmap_slug,
            question_id=attempt.question_id,
            correct=attempt.correct,
            hints_used=attempt.hints_used,
            created_at=attempt.created_at,
            mode=mode,
        )
        for attempt, mode in rows
    ]
    banks = {slug: questions_for(slug) for slug in curriculum()}
    return build_review_plan(evidence, banks, user_id=user_id, now=now)
