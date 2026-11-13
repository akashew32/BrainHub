"""Owned preferences and transparent, current-content short study selections."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.db.base import RoadmapAssessmentSession, RoadmapQuestionAttempt, StudyPreferences
from app.services.assessment_sessions import frozen_entries, semantic_fingerprint
from app.services.curriculum import curriculum, grade, questions_for
from app.services.recorded_time import daily_recording_totals
from app.services.spaced_review import STATUS_ORDER, ReviewEvidence, schedule_history, utc_naive

NOTICE = "This short retrieval session uses practice questions. Estimates are planning guides, not measured focus. It does not complete a lesson or establish exam readiness."
ESTIMATED_SECONDS = {"choice": 60, "number": 90, "vector": 120, "matrix": 150, "proof": 180}
REASONS = {
    "due": "Independent recall is due for this current practice question.",
    "weak": "Try an unseen practice question from a lesson with an incorrect, assisted, or untracked answer.",
    "next": "Build coverage with an unseen practice question in your authored foundation sequence.",
}


def preferences_for(db: Session, user_id: int) -> dict[str, Any]:
    row = db.get(StudyPreferences, user_id)
    return {
        "goal_minutes": row.goal_minutes if row else 20,
        "session_minutes": row.session_minutes if row else 15,
        "preferred_roadmap_slug": row.preferred_roadmap_slug if row else None,
        "revision": row.revision if row else 0,
        "updated_at": utc_naive(row.updated_at).isoformat() + "Z" if row else None,
    }


def save_preferences(
    db: Session, user_id: int, values: dict[str, Any], *, now: datetime
) -> dict[str, Any]:
    subject = values["preferred_roadmap_slug"]
    if subject is not None and subject not in curriculum():
        raise HTTPException(422, "Choose one of the five authored roadmap subjects.")
    revision = values["revision"]
    fields = {
        key: values[key] for key in ("goal_minutes", "session_minutes", "preferred_roadmap_slug")
    }
    row = db.scalar(
        select(StudyPreferences).where(StudyPreferences.user_id == user_id).with_for_update()
    )
    if row is not None and all(getattr(row, key) == value for key, value in fields.items()):
        return preferences_for(db, user_id)
    if (row is None and revision != 0) or (row is not None and row.revision != revision):
        raise HTTPException(409, "Study preferences changed elsewhere. Reload them before saving.")
    try:
        if row is None:
            db.add(
                StudyPreferences(user_id=user_id, **fields, revision=1, updated_at=utc_naive(now))
            )
        else:
            changed = db.execute(
                update(StudyPreferences)
                .where(StudyPreferences.user_id == user_id, StudyPreferences.revision == revision)
                .values(**fields, revision=revision + 1, updated_at=utc_naive(now))
                .execution_options(synchronize_session=False)
            )
            if not isinstance(changed, CursorResult) or changed.rowcount != 1:
                db.rollback()
                raise HTTPException(
                    409, "Study preferences changed elsewhere. Reload them before saving."
                )
        db.commit()
        db.expire_all()
    except IntegrityError as error:
        db.rollback()
        winner = db.get(StudyPreferences, user_id)
        if winner is None or any(getattr(winner, key) != value for key, value in fields.items()):
            raise HTTPException(
                409, "Study preferences were created elsewhere. Reload before saving."
            ) from error
    except OperationalError as error:
        db.rollback()
        raise HTTPException(
            409, "Study preferences are busy. Retry with your current values."
        ) from error
    return preferences_for(db, user_id)


def daily_goal(
    db: Session, user_id: int, *, preferences: dict[str, Any], now: datetime
) -> dict[str, Any]:
    reference = utc_naive(now)
    start = reference.replace(hour=0, minute=0, second=0, microsecond=0)
    sessions = list(
        db.scalars(
            select(RoadmapAssessmentSession).where(
                RoadmapAssessmentSession.user_id == user_id,
                RoadmapAssessmentSession.completed_at >= start,
                RoadmapAssessmentSession.completed_at <= reference,
                RoadmapAssessmentSession.started_at < start + timedelta(days=1),
            )
        )
    )
    totals = daily_recording_totals(
        (row.recorded_intervals for row in sessions if isinstance(row.result, dict)),
        day=reference.date(),
        now=reference,
    )
    goal = preferences["goal_minutes"] * 60
    return {
        "date": reference.date().isoformat(),
        "timezone": "UTC",
        "goal_seconds": goal,
        **totals,
        "goal_met": totals["recorded_seconds"] >= goal,
    }


def _compatible(
    session: RoadmapAssessmentSession, attempt: RoadmapQuestionAttempt, question: dict[str, Any]
) -> bool:
    try:
        feedback = session.result.get("feedback") if isinstance(session.result, dict) else None
        if not isinstance(feedback, list):
            return False
        matches = [
            item
            for item in feedback
            if isinstance(item, dict) and item.get("question_id") == attempt.question_id
        ]
        if (
            len(matches) != 1
            or matches[0].get("submitted_answer") != attempt.answer
            or matches[0].get("correct") is not bool(attempt.correct)
        ):
            return False
        entries = frozen_entries(session)
        if entries is not None:
            entry = entries.get(attempt.question_id)
            return entry is not None and semantic_fingerprint(
                entry["definition"]
            ) == semantic_fingerprint(question)
        item = matches[0]
        return (
            item.get("prompt") == question["prompt"]
            and grade(question, item.get("expected_answer")) == (True, None)
            and (not attempt.correct or grade(question, attempt.answer) == (True, None))
        )
    except (HTTPException, KeyError, ValueError, TypeError):
        return False


def _candidates(
    db: Session, user_id: int, roadmap_slug: str, *, now: datetime
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    data = curriculum()[roadmap_slug]
    bank = {
        qid: question
        for qid, question in questions_for(roadmap_slug).items()
        if question.get("exam") is False
    }
    history: dict[str, list[ReviewEvidence]] = defaultdict(list)
    rows = db.execute(
        select(RoadmapQuestionAttempt, RoadmapAssessmentSession)
        .join(
            RoadmapAssessmentSession,
            RoadmapAssessmentSession.id == RoadmapQuestionAttempt.session_id,
        )
        .where(
            RoadmapQuestionAttempt.user_id == user_id,
            RoadmapAssessmentSession.user_id == user_id,
            RoadmapAssessmentSession.roadmap_slug == roadmap_slug,
            RoadmapQuestionAttempt.roadmap_slug == roadmap_slug,
            RoadmapAssessmentSession.completed_at.is_not(None),
            RoadmapAssessmentSession.completed_at <= now,
            RoadmapQuestionAttempt.created_at <= now,
        )
        .order_by(RoadmapQuestionAttempt.created_at, RoadmapQuestionAttempt.id)
    ).all()
    for attempt, session in rows:
        question = bank.get(attempt.question_id)
        if (
            question is not None
            and attempt.topic_slug == question["topic_slug"]
            and _compatible(session, attempt, question)
        ):
            hints = (
                attempt.hints_used
                if type(attempt.hints_used) is int and attempt.hints_used >= 0
                else None
            )
            history[attempt.question_id].append(
                ReviewEvidence(
                    id=attempt.id,
                    user_id=user_id,
                    roadmap_slug=roadmap_slug,
                    question_id=attempt.question_id,
                    correct=bool(attempt.correct),
                    hints_used=hints,
                    created_at=attempt.created_at,
                    mode=session.mode,
                )
            )
    due = []
    weak_topics = set()
    for qid, evidence in history.items():
        state = schedule_history(evidence, now=now)
        if state is None:
            continue
        latest = sorted(evidence, key=lambda item: (utc_naive(item.created_at), item.id))[-1]
        if not latest.correct or latest.hints_used is None or latest.hints_used > 0:
            weak_topics.add(bank[qid]["topic_slug"])
        if state.due_at <= now:
            due.append((STATUS_ORDER[state.status], state.due_at, qid))
    due.sort()
    topic_order = {lesson["topic_slug"]: index for index, lesson in enumerate(data["lessons"])}
    unseen = sorted(
        (qid for qid in bank if qid not in history),
        key=lambda qid: (
            topic_order[bank[qid]["topic_slug"]],
            {"foundation": 0, "core": 1, "stretch": 2}.get(bank[qid]["difficulty"], 3),
            qid,
        ),
    )
    weak = [qid for qid in unseen if bank[qid]["topic_slug"] in weak_topics]
    remaining = [qid for qid in unseen if bank[qid]["topic_slug"] not in weak_topics]
    ordered = (
        [(qid, "due") for _, _, qid in due]
        + [(qid, "weak") for qid in weak]
        + [(qid, "next") for qid in remaining]
    )
    candidates = [
        {
            "question_id": qid,
            "code": code,
            "text": REASONS[code],
            "estimated_seconds": ESTIMATED_SECONDS[bank[qid]["kind"]],
        }
        for qid, code in ordered
    ]
    return candidates, {"due": len(due), "weak": len(weak), "unseen": len(unseen)}


def study_assignment(
    db: Session, user_id: int, roadmap_slug: str, *, budget_minutes: int | None, now: datetime
) -> tuple[list[str], dict[str, Any]]:
    preferences = preferences_for(db, user_id)
    budget = preferences["session_minutes"] if budget_minutes is None else budget_minutes
    candidates, _ = _candidates(db, user_id, roadmap_slug, now=utc_naive(now))
    selected: list[dict[str, Any]] = []
    estimated = 0
    for candidate in candidates:
        if len(selected) >= 20:
            break
        if estimated + candidate["estimated_seconds"] <= budget * 60:
            selected.append(candidate)
            estimated += candidate["estimated_seconds"]
    if not selected:
        raise HTTPException(
            409,
            "No current practice questions need this study session. Check your review plan later or open a full lesson.",
        )
    counts = {code: sum(item["code"] == code for item in selected) for code in REASONS}
    metadata = {
        "version": 1,
        "requested_budget_minutes": budget_minutes,
        "budget_minutes": budget,
        "preferences_revision": preferences["revision"],
        "estimated_seconds": estimated,
        "question_count": len(selected),
        "reason_counts": counts,
        "notice": NOTICE,
        "questions": selected,
    }
    return [item["question_id"] for item in selected], metadata


def study_plan(
    db: Session,
    user_id: int,
    *,
    roadmap_slug: str | None,
    budget_minutes: int | None,
    now: datetime,
) -> dict[str, Any]:
    if roadmap_slug is not None and roadmap_slug not in curriculum():
        raise HTTPException(422, "Choose one of the five authored roadmap subjects.")
    preferences = preferences_for(db, user_id)
    subjects: list[dict[str, Any]] = [
        {"slug": slug, **_candidates(db, user_id, slug, now=utc_naive(now))[1]}
        for slug in sorted(curriculum())
    ]
    preferred = roadmap_slug or preferences["preferred_roadmap_slug"]
    ordered = sorted(
        subjects,
        key=lambda item: (item["slug"] != preferred, -item["due"], -item["weak"], item["slug"]),
    )
    recommendation = None
    for subject in ordered:
        if roadmap_slug is not None and subject["slug"] != roadmap_slug:
            continue
        try:
            _, metadata = study_assignment(
                db, user_id, subject["slug"], budget_minutes=budget_minutes, now=now
            )
        except HTTPException as error:
            if error.status_code != 409:
                raise
            continue
        recommendation = {
            "roadmap_slug": subject["slug"],
            **{
                key: metadata[key]
                for key in (
                    "budget_minutes",
                    "estimated_seconds",
                    "question_count",
                    "reason_counts",
                )
            },
            "reason": "Practice questions are ordered by due recall, unseen material in weak lessons, then your authored foundation sequence.",
        }
        break
    return {
        "generated_at": utc_naive(now).isoformat() + "Z",
        "preferences": preferences,
        "daily_goal": daily_goal(db, user_id, preferences=preferences, now=now),
        "recommendation": recommendation,
        "subjects": subjects,
    }
