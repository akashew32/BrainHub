from __future__ import annotations

import math
import random
from datetime import timedelta
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import IntegrityError

from app.api.routes import Database, get_local_user
from app.db.base import (
    RoadmapAssessmentSession,
    RoadmapQuestionAttempt,
    RoadmapTopicProgress,
    utc_now,
)
from app.services.curriculum import (
    PASS_SCORE,
    curriculum,
    grade,
    lesson_for,
    public_lesson,
    public_question,
    questions_for,
)
from app.services.roadmaps import serialize_progress

router = APIRouter(prefix="/api/roadmaps", tags=["Mathematics learning"])


class StartAssessment(BaseModel):
    mode: Literal["practice", "exam", "review"] = "practice"
    topic_slug: str | None = Field(default=None, max_length=160)
    stage_index: int = Field(default=0, ge=0, le=9)


class Answer(BaseModel):
    model_config = {"extra": "forbid"}

    question_id: str = Field(min_length=1, max_length=220)
    answer: Any

    @field_validator("answer")
    @classmethod
    def validate_answer_size(cls, value: Any) -> Any:
        """Accept bounded answer data, never arbitrary nested JSON objects."""
        pending = [value]
        visited = 0
        character_count = 0
        while pending:
            item = pending.pop()
            visited += 1
            if visited > 256:
                raise ValueError("The answer contains too many entries.")
            if isinstance(item, list):
                if len(item) > 64:
                    raise ValueError("Use at most 64 entries in one answer array.")
                pending.extend(item)
            elif type(item) in {str, int, float}:
                if type(item) is float and not math.isfinite(item):
                    raise ValueError("Use finite numeric values in an answer.")
                character_count += len(str(item))
                if character_count > 4000:
                    raise ValueError("The answer is too long.")
            else:
                raise ValueError("Use a number, answer choice, or array of numbers.")
        return value


class SubmitAssessment(BaseModel):
    answers: list[Answer] = Field(min_length=1, max_length=60)
    time_spent_seconds: int = Field(default=0, ge=0, le=7200)


class AssessmentDraft(BaseModel):
    model_config = {"extra": "forbid"}

    answers: list[Answer] = Field(default_factory=list, max_length=60)
    time_spent_seconds: int = Field(default=0, ge=0, le=7200)
    revision: int = Field(default=0, ge=0, le=2_147_483_647)


def assessment_payload(session: RoadmapAssessmentSession) -> dict[str, Any]:
    """Serialize the public session without exposing unsubmitted answer keys."""
    bank = questions_for(session.roadmap_slug)
    if any(question_id not in bank for question_id in session.question_ids):
        raise HTTPException(409, "This assessment's curriculum changed. Start a fresh session.")
    draft = session.draft or {}
    payload = {
        "id": session.id,
        "mode": session.mode,
        "roadmap_slug": session.roadmap_slug,
        "topic_slug": session.topic_slug,
        "expires_at": session.expires_at.isoformat() + "Z",
        "pass_score": PASS_SCORE,
        "questions": [
            public_question(bank[question_id], include_hints=session.mode != "exam")
            for question_id in session.question_ids
        ],
        "draft": {
            "answers": draft.get("answers", []),
            "time_spent_seconds": draft.get("time_spent_seconds", 0),
            "revision": draft.get("revision", 0),
        },
    }
    if session.result is not None:
        payload["result"] = session.result
    return payload


@router.get("/assessments/{session_id}")
def recover_assessment(session_id: str, db: Database) -> dict[str, Any]:
    user = get_local_user(db)
    session = db.scalar(
        select(RoadmapAssessmentSession).where(
            RoadmapAssessmentSession.id == session_id, RoadmapAssessmentSession.user_id == user.id
        )
    )
    if session is None:
        raise HTTPException(404, "Unknown assessment session")
    if session.result is None and session.expires_at <= utc_now():
        raise HTTPException(410, "This assessment has expired. Start a fresh session.")
    return assessment_payload(session)


@router.put("/assessments/{session_id}/draft")
def save_assessment_draft(
    session_id: str, payload: AssessmentDraft, db: Database
) -> dict[str, Any]:
    user = get_local_user(db)
    session = db.scalar(
        select(RoadmapAssessmentSession)
        .where(
            RoadmapAssessmentSession.id == session_id, RoadmapAssessmentSession.user_id == user.id
        )
        .with_for_update()
    )
    if session is None:
        raise HTTPException(404, "Unknown assessment session")
    if session.result is not None:
        raise HTTPException(
            409, "This assessment is complete. Its saved answers cannot be changed."
        )
    if session.expires_at <= utc_now():
        raise HTTPException(410, "This assessment has expired. Start a fresh session.")
    question_ids = [answer.question_id for answer in payload.answers]
    if len(set(question_ids)) != len(question_ids) or not set(question_ids).issubset(
        session.question_ids
    ):
        raise HTTPException(422, "Save at most one answer for each question in this session.")
    previous = session.draft or {}
    candidate = {
        "answers": sorted(
            [answer.model_dump() for answer in payload.answers],
            key=lambda item: item["question_id"],
        ),
        "time_spent_seconds": max(
            payload.time_spent_seconds, previous.get("time_spent_seconds", 0)
        ),
        "revision": payload.revision,
    }
    stored_revision = previous.get("revision", -1)
    if payload.revision < stored_revision:
        raise HTTPException(409, "A newer draft is already saved. Reload it before saving again.")
    if payload.revision == stored_revision:
        if candidate == previous:
            return assessment_payload(session)
        raise HTTPException(409, "This draft revision already contains different answers.")
    # The row lock serializes PostgreSQL writes; the revision predicate also
    # prevents a late SQLite request from overwriting a newer snapshot.
    changed = db.execute(
        update(RoadmapAssessmentSession)
        .where(
            RoadmapAssessmentSession.id == session.id,
            RoadmapAssessmentSession.completed_at.is_(None),
            func.coalesce(RoadmapAssessmentSession.draft["revision"].as_integer(), -1)
            == stored_revision,
        )
        .values(draft=candidate)
        .execution_options(synchronize_session=False)
    )
    if not isinstance(changed, CursorResult) or changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "The saved assessment changed. Reload it before saving again.")
    db.commit()
    db.refresh(session)
    return assessment_payload(session)


@router.get("/curriculum")
def curriculum_index() -> dict[str, Any]:
    return {
        "version": 1,
        "pass_score": PASS_SCORE,
        "roadmaps": [
            {
                "slug": slug,
                "stage_index": data["stage_index"],
                "lessons": [
                    {
                        "topic_slug": lesson["topic_slug"],
                        "title": lesson["title"],
                        "question_count": len(lesson["questions"]),
                    }
                    for lesson in data["lessons"]
                ],
            }
            for slug, data in curriculum().items()
        ],
    }


@router.get("/learning-stats")
def learning_stats(db: Database) -> dict[str, Any]:
    user = get_local_user(db)
    attempts = list(
        db.scalars(
            select(RoadmapQuestionAttempt)
            .where(RoadmapQuestionAttempt.user_id == user.id)
            .order_by(RoadmapQuestionAttempt.created_at, RoadmapQuestionAttempt.id)
        )
    )
    latest = {(item.roadmap_slug, item.question_id): item for item in attempts}
    sessions = list(
        db.scalars(
            select(RoadmapAssessmentSession).where(
                RoadmapAssessmentSession.user_id == user.id,
                RoadmapAssessmentSession.completed_at.is_not(None),
            )
        )
    )
    return {
        "answers": len(attempts),
        "correct": sum(item.correct for item in attempts),
        "accuracy": round(100 * sum(item.correct for item in attempts) / len(attempts))
        if attempts
        else 0,
        "concepts_to_review": len(
            {(item.roadmap_slug, item.concept) for item in latest.values() if not item.correct}
        ),
        "exams": [
            {
                "roadmap_slug": item.roadmap_slug,
                "stage_index": item.stage_index,
                "score": item.result["score"],
                "passed": item.result["passed"],
                "completed_at": item.completed_at.isoformat(),
            }
            for item in sessions
            if item.mode == "exam" and item.result is not None and item.completed_at is not None
        ],
    }


@router.get("/mistakes")
def mistakes(db: Database) -> dict[str, Any]:
    user = get_local_user(db)
    attempts = list(
        db.scalars(
            select(RoadmapQuestionAttempt)
            .where(RoadmapQuestionAttempt.user_id == user.id)
            .order_by(RoadmapQuestionAttempt.created_at, RoadmapQuestionAttempt.id)
        )
    )
    grouped: dict[tuple[str, str], list[RoadmapQuestionAttempt]] = {}
    for attempt in attempts:
        grouped.setdefault((attempt.roadmap_slug, attempt.question_id), []).append(attempt)
    now = utc_now()
    items = []
    for (_, question_id), history in grouped.items():
        recent = history[-1]
        bank = questions_for(recent.roadmap_slug)
        question = bank.get(question_id)
        if question is None:
            continue
        interval = 3 if recent.correct else 1
        due_at = recent.created_at + timedelta(days=interval)
        if not recent.correct or due_at <= now:
            items.append(
                {
                    "question_id": question_id,
                    "roadmap_slug": recent.roadmap_slug,
                    "topic_slug": recent.topic_slug,
                    "lesson_title": question["lesson_title"],
                    "concept": recent.concept,
                    "last_correct": recent.correct,
                    "attempts": len(history),
                    "last_attempt_at": recent.created_at.isoformat() + "Z",
                    "due_at": due_at.isoformat() + "Z",
                    "reason": "Recent mistake" if not recent.correct else "Recall practice due",
                    "prompt": question["prompt"],
                }
            )
    return {
        "items": sorted(items, key=lambda item: (item["last_correct"], item["due_at"])),
        "total_attempts": len(attempts),
    }


@router.get("/{roadmap_slug}/lessons/{topic_slug}")
def authored_lesson(roadmap_slug: str, topic_slug: str) -> dict[str, Any]:
    lesson = lesson_for(roadmap_slug, topic_slug)
    if lesson is None:
        raise HTTPException(
            404,
            "This topic currently has a curriculum outline; its authored lesson is not released yet.",
        )
    return public_lesson(roadmap_slug, lesson)


@router.post("/{roadmap_slug}/assessments", status_code=201)
def start_assessment(roadmap_slug: str, payload: StartAssessment, db: Database) -> dict[str, Any]:
    data = curriculum().get(roadmap_slug)
    if data is None or payload.stage_index != data["stage_index"]:
        raise HTTPException(404, "No authored assessment is available for this stage yet.")
    bank = questions_for(roadmap_slug)
    user = get_local_user(db)
    if payload.mode == "practice":
        lesson = lesson_for(roadmap_slug, payload.topic_slug or "")
        if lesson is None:
            raise HTTPException(404, "Unknown authored lesson")
        selected = [question["id"] for question in lesson["questions"] if not question["exam"]]
    elif payload.mode == "exam":
        verified_practice = list(
            db.scalars(
                select(RoadmapAssessmentSession).where(
                    RoadmapAssessmentSession.user_id == user.id,
                    RoadmapAssessmentSession.roadmap_slug == roadmap_slug,
                    RoadmapAssessmentSession.mode == "practice",
                    RoadmapAssessmentSession.completed_at.is_not(None),
                )
            )
        )
        completed = {
            item.topic_slug
            for item in verified_practice
            if item.result is not None and item.result.get("passed") is True
        }
        if any(lesson["topic_slug"] not in completed for lesson in data["lessons"]):
            raise HTTPException(
                409, "Complete all six lesson practice sets before starting the stage exam."
            )
        selected = [
            question["id"]
            for lesson in data["lessons"]
            for question in lesson["questions"]
            if question["exam"]
        ]
    else:
        rows = list(
            db.scalars(
                select(RoadmapQuestionAttempt)
                .where(
                    RoadmapQuestionAttempt.user_id == user.id,
                    RoadmapQuestionAttempt.roadmap_slug == roadmap_slug,
                )
                .order_by(RoadmapQuestionAttempt.created_at, RoadmapQuestionAttempt.id)
            )
        )
        latest = {item.question_id: item for item in rows}
        selected = [
            question_id
            for question_id, item in sorted(
                latest.items(), key=lambda pair: (pair[1].correct, pair[1].created_at, pair[0])
            )
            if question_id in bank
            and (not item.correct or item.created_at + timedelta(days=3) <= utc_now())
        ][:8]
        if not selected:
            raise HTTPException(
                409, "No attempted questions are currently due for review in this subject."
            )
    random.SystemRandom().shuffle(selected)
    session = RoadmapAssessmentSession(
        id=str(uuid4()),
        user_id=user.id,
        roadmap_slug=roadmap_slug,
        topic_slug=payload.topic_slug if payload.mode == "practice" else None,
        stage_index=payload.stage_index,
        mode=payload.mode,
        question_ids=selected,
        expires_at=utc_now() + timedelta(hours=2),
    )
    db.add(session)
    db.commit()
    return assessment_payload(session)


@router.post("/assessments/{session_id}/submit")
def submit_assessment(session_id: str, payload: SubmitAssessment, db: Database) -> dict[str, Any]:
    user = get_local_user(db)
    # Lock the row on PostgreSQL so parallel submits cannot create duplicate attempts.
    session = db.scalar(
        select(RoadmapAssessmentSession)
        .where(
            RoadmapAssessmentSession.id == session_id, RoadmapAssessmentSession.user_id == user.id
        )
        .with_for_update()
    )
    if session is None:
        raise HTTPException(404, "Unknown assessment session")
    if session.result is not None:
        return session.result
    if session.expires_at < utc_now():
        raise HTTPException(410, "This assessment has expired. Start a fresh session.")
    answers = {answer.question_id: answer.answer for answer in payload.answers}
    if len(answers) != len(payload.answers) or set(answers) != set(session.question_ids):
        raise HTTPException(422, "Submit exactly one answer for every question in this session.")
    bank = questions_for(session.roadmap_slug)
    feedback = []
    for question_id in session.question_ids:
        question = bank[question_id]
        correct, validation_error = grade(question, answers[question_id])
        if validation_error:
            raise HTTPException(422, f"{question_id}: {validation_error}")
        feedback.append(
            {
                "question_id": question_id,
                "prompt": question["prompt"],
                "concept": question["concept"],
                "correct": correct,
                "submitted_answer": answers[question_id],
                "expected_answer": question["answer"],
                "solution": question["solution"],
                "topic_slug": question["topic_slug"],
            }
        )
    now = utc_now()
    for item in feedback:
        db.add(
            RoadmapQuestionAttempt(
                user_id=user.id,
                session_id=session.id,
                roadmap_slug=session.roadmap_slug,
                topic_slug=item["topic_slug"],
                question_id=item["question_id"],
                concept=item["concept"],
                answer=item["submitted_answer"],
                correct=item["correct"],
                created_at=now,
            )
        )
    score = round(100 * sum(item["correct"] for item in feedback) / len(feedback))
    passed = score >= PASS_SCORE
    progress = None
    if session.mode == "practice" and session.topic_slug:
        prior_sessions = list(
            db.scalars(
                select(RoadmapAssessmentSession).where(
                    RoadmapAssessmentSession.user_id == user.id,
                    RoadmapAssessmentSession.roadmap_slug == session.roadmap_slug,
                    RoadmapAssessmentSession.topic_slug == session.topic_slug,
                    RoadmapAssessmentSession.mode == "practice",
                    RoadmapAssessmentSession.completed_at.is_not(None),
                )
            )
        )
        prior_results = [item.result for item in prior_sessions if item.result is not None]
        progress = db.scalar(
            select(RoadmapTopicProgress).where(
                RoadmapTopicProgress.user_id == user.id,
                RoadmapTopicProgress.roadmap_slug == session.roadmap_slug,
                RoadmapTopicProgress.topic_slug == session.topic_slug,
            )
        )
        if progress is None:
            progress = RoadmapTopicProgress(
                user_id=user.id, roadmap_slug=session.roadmap_slug, topic_slug=session.topic_slug
            )
        # Legacy roadmap rows may contain client-graded scores. Only completed
        # server sessions may establish mastery for an authored lesson.
        progress.quiz_score = max([score, *[item["score"] for item in prior_results]])
        progress.quiz_attempts = len(prior_results) + 1
        progress.mastery_version = 1
        progress.time_spent_seconds = (
            progress.time_spent_seconds or 0
        ) + payload.time_spent_seconds
        progress.last_viewed_at = now
        if passed or any(item["passed"] for item in prior_results):
            progress.status = "completed"
            progress.completed_at = progress.completed_at or now
        else:
            progress.status = "in_progress"
            progress.completed_at = None
        db.add(progress)
    result = {
        "session_id": session.id,
        "mode": session.mode,
        "score": score,
        "passed": passed,
        "correct": sum(item["correct"] for item in feedback),
        "total": len(feedback),
        "feedback": feedback,
        "progress": serialize_progress(progress) if progress else None,
    }
    session.result = result
    session.completed_at = now
    try:
        db.commit()
    except IntegrityError as error:
        # PostgreSQL row locks serialize repeated submits. SQLite ignores those
        # locks, so its uniqueness constraint is the final duplicate-write guard.
        db.rollback()
        winner = db.get(RoadmapAssessmentSession, session_id)
        if winner is not None and winner.result is not None:
            return winner.result
        raise HTTPException(
            409, "The assessment changed while saving. Retry your submission."
        ) from error
    return result
