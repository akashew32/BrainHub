from __future__ import annotations

import math
import random
from datetime import datetime, timedelta
from typing import Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_, case, func, or_, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import IntegrityError, OperationalError

from app.api.routes import Database, get_local_user
from app.db.base import (
    RoadmapAssessmentSession,
    RoadmapQuestionAttempt,
    RoadmapTopicProgress,
    utc_now,
)
from app.services.assessment_hints import assistance, hints_allowed, hints_used
from app.services.assessment_sessions import (
    assessment_payload as serialize_assessment,
)
from app.services.assessment_sessions import (
    assigned_questions,
    freeze_questions,
    project_result_navigation,
)
from app.services.curriculum import (
    PASS_SCORE,
    curriculum,
    grade,
    lesson_for,
    public_lesson,
    questions_for,
)
from app.services.diagnostics import build_diagnostic_summary, select_diagnostic_questions
from app.services.exam_readiness import readiness_for_stage
from app.services.proof_feedback import build_proof_feedback
from app.services.recorded_time import merge_recordings, recording_seconds
from app.services.roadmaps import serialize_progress
from app.services.spaced_review import SESSION_LIMIT, review_plan_for_user
from app.services.study import NOTICE as STUDY_NOTICE
from app.services.study import study_assignment

router = APIRouter(prefix="/api/roadmaps", tags=["Mathematics learning"])


class StartAssessment(BaseModel):
    model_config = {"extra": "forbid"}

    mode: Literal["practice", "exam", "review", "diagnostic", "study"] = "practice"
    topic_slug: str | None = Field(default=None, max_length=160)
    stage_index: int = Field(default=0, ge=0, le=9)
    request_id: UUID | None = None
    budget_minutes: int | None = Field(default=None, ge=5, le=60, strict=True)


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
    model_config = {"extra": "forbid"}

    answers: list[Answer] = Field(min_length=1, max_length=60)
    time_spent_seconds: int = Field(default=0, ge=0, le=7200)
    time_recording: Any = None


class AssessmentDraft(BaseModel):
    model_config = {"extra": "forbid"}

    answers: list[Answer] = Field(default_factory=list, max_length=60)
    time_spent_seconds: int = Field(default=0, ge=0, le=7200)
    revision: int = Field(default=0, ge=0, le=2_147_483_647)
    time_recording: Any = None


class RevealHint(BaseModel):
    model_config = {"extra": "forbid"}

    index: int = Field(ge=1, le=64, strict=True)


def _persist_practice_progress(
    db: Database,
    session: RoadmapAssessmentSession,
    score: int,
    independent_score: int | None,
    seconds: int,
    now: datetime,
) -> RoadmapTopicProgress:
    prior_sessions = list(
        db.scalars(
            select(RoadmapAssessmentSession).where(
                RoadmapAssessmentSession.user_id == session.user_id,
                RoadmapAssessmentSession.roadmap_slug == session.roadmap_slug,
                RoadmapAssessmentSession.topic_slug == session.topic_slug,
                RoadmapAssessmentSession.mode == "practice",
                RoadmapAssessmentSession.completed_at.is_not(None),
                RoadmapAssessmentSession.id != session.id,
            )
        )
    )
    prior_results = [item.result for item in prior_sessions if item.result is not None]
    recorded_score = max([score, *[item["score"] for item in prior_results]])
    independent_scores = [
        item["independent_score"]
        for item in prior_results
        if type(item.get("independent_score")) is int
    ]
    if independent_score is not None:
        independent_scores.append(independent_score)
    recorded_independent = max(independent_scores) if independent_scores else None
    passed = recorded_score >= PASS_SCORE
    progress = db.scalar(
        select(RoadmapTopicProgress).where(
            RoadmapTopicProgress.user_id == session.user_id,
            RoadmapTopicProgress.roadmap_slug == session.roadmap_slug,
            RoadmapTopicProgress.topic_slug == session.topic_slug,
        )
    )
    if progress is None:
        progress = RoadmapTopicProgress(
            user_id=session.user_id,
            roadmap_slug=session.roadmap_slug,
            topic_slug=session.topic_slug,
            quiz_score=recorded_score,
            quiz_attempts=len(prior_results) + 1,
            independent_score=recorded_independent,
            mastery_version=1,
            time_spent_seconds=seconds,
            last_viewed_at=now,
            status="completed" if passed else "in_progress",
            completed_at=now if passed else None,
        )
        db.add(progress)
        db.flush()
        return progress
    # These expressions inspect the current row at UPDATE time, rather than
    # replacing it with a stale ORM snapshot from another session's completion.
    verified = RoadmapTopicProgress.mastery_version == 1
    established = or_(
        passed,
        and_(verified, RoadmapTopicProgress.quiz_score >= PASS_SCORE),
    )
    independent_value = (
        case(
            (RoadmapTopicProgress.mastery_version != 1, recorded_independent),
            (RoadmapTopicProgress.independent_score.is_(None), recorded_independent),
            (RoadmapTopicProgress.independent_score < recorded_independent, recorded_independent),
            else_=RoadmapTopicProgress.independent_score,
        )
        if recorded_independent is not None
        else case((verified, RoadmapTopicProgress.independent_score), else_=None)
    )
    db.execute(
        update(RoadmapTopicProgress)
        .where(RoadmapTopicProgress.id == progress.id)
        .values(
            quiz_score=case(
                (
                    and_(verified, RoadmapTopicProgress.quiz_score > recorded_score),
                    RoadmapTopicProgress.quiz_score,
                ),
                else_=recorded_score,
            ),
            quiz_attempts=case(
                (verified, RoadmapTopicProgress.quiz_attempts + 1),
                else_=len(prior_results) + 1,
            ),
            independent_score=independent_value,
            mastery_version=1,
            time_spent_seconds=RoadmapTopicProgress.time_spent_seconds + seconds,
            last_viewed_at=case(
                (RoadmapTopicProgress.last_viewed_at > now, RoadmapTopicProgress.last_viewed_at),
                else_=now,
            ),
            status=case((established, "completed"), else_="in_progress"),
            completed_at=case(
                (
                    established,
                    case(
                        (
                            and_(verified, RoadmapTopicProgress.completed_at.is_not(None)),
                            RoadmapTopicProgress.completed_at,
                        ),
                        else_=now,
                    ),
                ),
                else_=None,
            ),
        )
        .execution_options(synchronize_session=False)
    )
    db.flush()
    db.refresh(progress)
    return progress


def assessment_payload(session: RoadmapAssessmentSession) -> dict[str, Any]:
    """Serialize the public session without exposing unsubmitted answer keys."""
    return serialize_assessment(
        session, now=utc_now(), current_bank=questions_for(session.roadmap_slug)
    )


def assessment_result(session: RoadmapAssessmentSession) -> dict[str, Any]:
    if session.result is None:
        raise HTTPException(409, "This assessment does not have a saved result.")
    return project_result_navigation(
        session, session.result, current_bank=questions_for(session.roadmap_slug)
    )


@router.post("/assessments/{session_id}/questions/{question_id}/hints")
def reveal_assessment_hint(
    session_id: str, question_id: str, payload: RevealHint, db: Database
) -> dict[str, Any]:
    user = get_local_user(db)
    for _ in range(3):
        session = db.scalar(
            select(RoadmapAssessmentSession)
            .where(
                RoadmapAssessmentSession.id == session_id,
                RoadmapAssessmentSession.user_id == user.id,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if session is None:
            raise HTTPException(404, "Unknown assessment session")
        if not hints_allowed(session.mode):
            raise HTTPException(
                409,
                "Diagnostics do not provide hints."
                if session.mode == "diagnostic"
                else "Stage exams do not provide hints.",
            )
        if session.completed_at is not None:
            raise HTTPException(409, "This assessment is complete. Start a new practice session.")
        if session.expires_at <= utc_now():
            raise HTTPException(410, "This assessment has expired. Start a fresh session.")
        if question_id not in session.question_ids:
            raise HTTPException(404, "This question does not belong to the assessment.")
        if session.hint_usage is None:
            raise HTTPException(
                409,
                "Hint usage was not tracked for this session. Start a new practice session for tracked hints.",
            )
        question = assigned_questions(session, questions_for(session.roadmap_slug)).get(question_id)
        if question is None:
            raise HTTPException(409, "This assessment's curriculum changed. Start a fresh session.")
        available = question.get("hints", [])
        if payload.index > len(available):
            raise HTTPException(422, "This question has no hint at that index.")
        count = session.hint_usage.get(question_id, 0)
        if payload.index > count + 1:
            raise HTTPException(409, "Reveal hints in order, one step at a time.")
        if payload.index <= count:
            return {
                "question_id": question_id,
                "hint_count": len(available),
                "hints": available[:count],
                "hints_used": count,
                "hint_usage": session.hint_usage,
            }
        usage = {**session.hint_usage, question_id: payload.index}
        try:
            changed = db.execute(
                update(RoadmapAssessmentSession)
                .where(
                    RoadmapAssessmentSession.id == session.id,
                    RoadmapAssessmentSession.completed_at.is_(None),
                    RoadmapAssessmentSession.hint_revision == session.hint_revision,
                )
                .values(hint_usage=usage, hint_revision=session.hint_revision + 1)
                .execution_options(synchronize_session=False)
            )
            if not isinstance(changed, CursorResult) or changed.rowcount != 1:
                db.rollback()
                continue
            db.commit()
            return {
                "question_id": question_id,
                "hint_count": len(available),
                "hints": available[: payload.index],
                "hints_used": payload.index,
                "hint_usage": usage,
            }
        except OperationalError:
            db.rollback()
    raise HTTPException(409, "The saved session changed. Retry the hint request.")


@router.get("/assessments/{session_id}")
def recover_assessment(session_id: str, db: Database, response: Response) -> dict[str, Any]:
    response.headers["Cache-Control"] = "private, no-store"
    user = get_local_user(db)
    session = db.scalar(
        select(RoadmapAssessmentSession).where(
            RoadmapAssessmentSession.id == session_id, RoadmapAssessmentSession.user_id == user.id
        )
    )
    if session is None:
        raise HTTPException(404, "Unknown assessment session")
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
    try:
        recording = merge_recordings(
            previous.get("time_recording"),
            payload.time_recording,
            started_at=session.started_at,
            expires_at=session.expires_at,
            now=utc_now(),
        )
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
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
    if recording is not None:
        candidate["time_recording"] = recording
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
    now = utc_now()
    user = get_local_user(db)
    attempts = list(
        db.scalars(
            select(RoadmapQuestionAttempt)
            .where(RoadmapQuestionAttempt.user_id == user.id)
            .order_by(RoadmapQuestionAttempt.created_at, RoadmapQuestionAttempt.id)
        )
    )
    plan = review_plan_for_user(db, user.id, now=now)
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
            {(item["roadmap_slug"], item["concept"]) for item in plan["items"]}
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
    now = utc_now()
    user = get_local_user(db)
    plan = review_plan_for_user(db, user.id, now=now)
    return {
        "items": plan["items"],
        "total_attempts": db.scalar(
            select(func.count())
            .select_from(RoadmapQuestionAttempt)
            .where(RoadmapQuestionAttempt.user_id == user.id)
        ),
    }


@router.get("/review-plan")
def review_plan(db: Database) -> dict[str, Any]:
    now = utc_now()
    user = get_local_user(db)
    return review_plan_for_user(db, user.id, now=now)


@router.get("/{roadmap_slug}/lessons/{topic_slug}")
def authored_lesson(roadmap_slug: str, topic_slug: str) -> dict[str, Any]:
    lesson = lesson_for(roadmap_slug, topic_slug)
    if lesson is None:
        raise HTTPException(
            404,
            "This topic currently has a curriculum outline; its authored lesson is not released yet.",
        )
    return public_lesson(roadmap_slug, lesson)


@router.get("/{roadmap_slug}/exam-readiness")
def exam_readiness(
    roadmap_slug: str, db: Database, stage_index: int = Query(default=0, ge=0, le=9)
) -> dict[str, Any]:
    now = utc_now()
    user = get_local_user(db)
    return readiness_for_stage(db, user.id, roadmap_slug, stage_index=stage_index, now=now)


@router.post("/{roadmap_slug}/assessments", status_code=201)
def start_assessment(
    roadmap_slug: str, payload: StartAssessment, db: Database, response: Response
) -> dict[str, Any]:
    now = utc_now()
    if payload.mode != "study" and payload.budget_minutes is not None:
        raise HTTPException(422, "A session budget applies only to study mode.")
    user = get_local_user(db)
    request_id = str(payload.request_id) if payload.request_id is not None else None
    topic_slug = payload.topic_slug if payload.mode == "practice" else None

    def replay(existing: RoadmapAssessmentSession) -> dict[str, Any]:
        options = None
        if existing.mode == "study":
            snapshot = existing.question_snapshot
            options = snapshot.get("study_plan") if isinstance(snapshot, dict) else None
            if not isinstance(options, dict):
                raise HTTPException(
                    409, "This study session's saved request context is unavailable."
                )
        if (
            existing.roadmap_slug != roadmap_slug
            or existing.mode != payload.mode
            or existing.stage_index != payload.stage_index
            or existing.topic_slug != topic_slug
            or (
                existing.mode == "study"
                and options is not None
                and options.get("requested_budget_minutes") != payload.budget_minutes
            )
        ):
            raise HTTPException(
                409, "This start request ID already belongs to a different assessment request."
            )
        response.status_code = 200
        return assessment_payload(existing)

    if request_id is not None:
        existing = db.scalar(
            select(RoadmapAssessmentSession).where(
                RoadmapAssessmentSession.user_id == user.id,
                RoadmapAssessmentSession.start_request_id == request_id,
            )
        )
        if existing is not None:
            return replay(existing)
    data = curriculum().get(roadmap_slug)
    if data is None or payload.stage_index != data["stage_index"]:
        raise HTTPException(404, "No authored assessment is available for this stage yet.")
    study_metadata = None
    if payload.mode == "practice":
        lesson = lesson_for(roadmap_slug, payload.topic_slug or "")
        if lesson is None:
            raise HTTPException(404, "Unknown authored lesson")
        selected = [question["id"] for question in lesson["questions"] if not question["exam"]]
    elif payload.mode == "exam":
        readiness = readiness_for_stage(
            db, user.id, roadmap_slug, stage_index=payload.stage_index, now=now
        )
        if not readiness["eligible"]:
            raise HTTPException(
                409,
                "Complete all six lesson practice sets with at least 75% independently correct answers before starting a fresh stage exam.",
            )
        selected = [
            question["id"]
            for lesson in data["lessons"]
            for question in lesson["questions"]
            if question["exam"]
        ]
    elif payload.mode == "diagnostic":
        selected = select_diagnostic_questions(data)
    elif payload.mode == "study":
        selected, study_metadata = study_assignment(
            db, user.id, roadmap_slug, budget_minutes=payload.budget_minutes, now=now
        )
    else:
        plan = review_plan_for_user(db, user.id, now=now)
        selected = [
            item["question_id"] for item in plan["items"] if item["roadmap_slug"] == roadmap_slug
        ][:SESSION_LIMIT]
        if not selected:
            raise HTTPException(
                409, "No attempted questions are currently due for review in this subject."
            )
    if payload.mode not in {"review", "study"}:
        random.SystemRandom().shuffle(selected)
    snapshot = freeze_questions(
        [questions_for(roadmap_slug)[qid] for qid in selected], mode=payload.mode
    )
    if study_metadata is not None:
        snapshot["study_plan"] = study_metadata
    session = RoadmapAssessmentSession(
        id=str(uuid4()),
        user_id=user.id,
        roadmap_slug=roadmap_slug,
        topic_slug=topic_slug,
        stage_index=payload.stage_index,
        mode=payload.mode,
        question_ids=selected,
        question_snapshot=snapshot,
        start_request_id=request_id,
        hint_usage={},
        started_at=now,
        expires_at=now + timedelta(hours=2),
    )
    try:
        db.add(session)
        db.commit()
    except (IntegrityError, OperationalError) as error:
        db.rollback()
        if request_id is not None:
            existing = db.scalar(
                select(RoadmapAssessmentSession).where(
                    RoadmapAssessmentSession.user_id == user.id,
                    RoadmapAssessmentSession.start_request_id == request_id,
                )
            )
            if existing is not None:
                return replay(existing)
        raise HTTPException(
            409, "The assessment start is busy. Retry with the same request ID."
        ) from error
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
        return assessment_result(session)
    if session.expires_at <= utc_now():
        raise HTTPException(410, "This assessment has expired. Start a fresh session.")
    answers = {answer.question_id: answer.answer for answer in payload.answers}
    if len(answers) != len(payload.answers) or set(answers) != set(session.question_ids):
        raise HTTPException(422, "Submit exactly one answer for every question in this session.")
    bank = assigned_questions(session, questions_for(session.roadmap_slug))
    feedback = []
    for question_id in session.question_ids:
        question = bank[question_id]
        correct, validation_error = grade(question, answers[question_id])
        if validation_error:
            raise HTTPException(422, f"{question_id}: {validation_error}")
        item = {
            "question_id": question_id,
            "prompt": question["prompt"],
            "concept": question["concept"],
            "correct": correct,
            "submitted_answer": answers[question_id],
            "expected_answer": question["answer"],
            "solution": question["solution"],
            "topic_slug": question["topic_slug"],
            "hints_used": hints_used(session.hint_usage, question_id),
            "assistance": assistance(session.hint_usage, question_id),
        }
        if question["kind"] == "proof":
            details = build_proof_feedback(question, answers[question_id])
            item["proof_details"] = details
            item["expected_answer"] = [step["step"] for step in details["expected_steps"]]
        feedback.append(item)
    now = utc_now()
    try:
        recording = merge_recordings(
            (session.draft or {}).get("time_recording"),
            payload.time_recording,
            started_at=session.started_at,
            expires_at=session.expires_at,
            now=now,
        )
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    recorded_seconds = recording_seconds(recording)
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
                hints_used=item["hints_used"],
                created_at=now,
            )
        )
    score = round(100 * sum(item["correct"] for item in feedback) / len(feedback))
    passed = score >= PASS_SCORE
    independent_score = (
        round(
            100
            * sum(item["correct"] and item["hints_used"] == 0 for item in feedback)
            / len(feedback)
        )
        if session.hint_usage is not None
        else None
    )
    result = {
        "session_id": session.id,
        "mode": session.mode,
        "score": score,
        "passed": passed,
        "assistance": assistance(session.hint_usage),
        "hints_used": hints_used(session.hint_usage),
        "independent_score": independent_score,
        "independent_passed": independent_score >= PASS_SCORE
        if independent_score is not None
        else None,
        "correct": sum(item["correct"] for item in feedback),
        "total": len(feedback),
        "feedback": feedback,
        "progress": None,
        "recorded_seconds": recorded_seconds,
    }
    if session.mode == "diagnostic":
        result["diagnostic_summary"] = build_diagnostic_summary(
            session.roadmap_slug, bank, feedback
        )
    if session.mode == "study":
        metadata = (session.question_snapshot or {}).get("study_plan", {})
        result["study_summary"] = {
            "version": 1,
            "notice": STUDY_NOTICE,
            "correct": result["correct"],
            "total": result["total"],
            "reason_counts": metadata["reason_counts"],
        }
    try:
        # Claim completion using the exact hint snapshot used for grading. A
        # concurrent reveal must never be labeled as independent work.
        changed = db.execute(
            update(RoadmapAssessmentSession)
            .where(
                RoadmapAssessmentSession.id == session.id,
                RoadmapAssessmentSession.completed_at.is_(None),
                RoadmapAssessmentSession.hint_revision == session.hint_revision,
            )
            .where(
                func.coalesce(RoadmapAssessmentSession.draft["revision"].as_integer(), -1)
                == (session.draft or {}).get("revision", -1)
            )
            .values(
                completed_at=now, recorded_intervals=recording, recorded_seconds=recorded_seconds
            )
            .execution_options(synchronize_session=False)
        )
        if not isinstance(changed, CursorResult) or changed.rowcount != 1:
            db.rollback()
            winner = db.get(RoadmapAssessmentSession, session_id)
            if winner is not None and winner.result is not None:
                return assessment_result(winner)
            raise HTTPException(
                409, "Hint usage changed while submitting. Retry with your saved answers."
            )
        if session.mode == "practice" and session.topic_slug:
            progress = _persist_practice_progress(
                db,
                session,
                score,
                independent_score,
                payload.time_spent_seconds if recorded_seconds is None else recorded_seconds,
                now,
            )
            result["progress"] = serialize_progress(progress)
        db.execute(
            update(RoadmapAssessmentSession)
            .where(RoadmapAssessmentSession.id == session.id)
            .values(result=result)
            .execution_options(synchronize_session=False)
        )
        db.commit()
    except IntegrityError as error:
        # PostgreSQL row locks serialize repeated submits. SQLite ignores those
        # locks, so its uniqueness constraint is the final duplicate-write guard.
        db.rollback()
        winner = db.get(RoadmapAssessmentSession, session_id)
        if winner is not None and winner.result is not None:
            return assessment_result(winner)
        raise HTTPException(
            409, "The assessment changed while saving. Retry your submission."
        ) from error
    except OperationalError as error:
        db.rollback()
        raise HTTPException(
            409, "The saved session is busy. Retry with your saved answers."
        ) from error
    return project_result_navigation(
        session, result, current_bank=questions_for(session.roadmap_slug)
    )
