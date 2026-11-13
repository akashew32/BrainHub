"""Reconstruct stage prerequisites from complete, owned practice evidence.

Progress caches and result flags are useful summaries, but neither proves an
independent pass. Eligibility requires one current complete practice set per
lesson, with its saved answers and tracked hint counts agreeing.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from typing import Any
from urllib.parse import quote

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import RoadmapAssessmentSession, RoadmapQuestionAttempt
from app.services.assessment_sessions import compatible_practice_content
from app.services.curriculum import PASS_SCORE, curriculum
from app.services.question_forms import add_practice_forms, family_id
from app.services.spaced_review import utc_naive


def _current_set(
    session: RoadmapAssessmentSession,
    attempts: list[RoadmapQuestionAttempt],
    questions: dict[str, dict[str, Any]],
    topic_slug: str,
    expected_families: set[str],
) -> tuple[int, int | None] | None:
    ids = session.question_ids
    if (
        not isinstance(ids, list)
        or len(ids) != len(expected_families)
        or any(type(question_id) is not str for question_id in ids)
        or len(set(ids)) != len(ids)
        or any(qid not in questions for qid in ids)
        or {family_id(questions[qid]) for qid in ids} != expected_families
        or len(attempts) != len(ids)
        or len({item.question_id for item in attempts}) != len(attempts)
        or {item.question_id for item in attempts} != set(ids)
        or any(item.topic_slug != topic_slug for item in attempts)
    ):
        return None
    questions = {qid: questions[qid] for qid in ids}
    expected = set(ids)
    if not compatible_practice_content(session, questions, attempts):
        return None
    score = round(100 * sum(item.correct for item in attempts) / len(attempts))
    usage = session.hint_usage
    tracked = (
        isinstance(usage, dict)
        and all(
            question_id in expected
            and type(count) is int
            and 0 <= count <= len(questions[question_id].get("hints", []))
            for question_id, count in usage.items()
        )
        and all(
            type(item.hints_used) is int
            and item.hints_used >= 0
            and item.hints_used == usage.get(item.question_id, 0)
            for item in attempts
        )
    )
    independent = (
        round(100 * sum(item.correct and item.hints_used == 0 for item in attempts) / len(attempts))
        if tracked
        else None
    )
    return score, independent


def readiness_for_stage(
    db: Session,
    user_id: int,
    roadmap_slug: str,
    *,
    stage_index: int,
    now: datetime,
) -> dict[str, Any]:
    data = curriculum().get(roadmap_slug)
    if data is None or stage_index != data["stage_index"]:
        raise HTTPException(404, "No authored stage exam is available for this roadmap stage.")
    reference = utc_naive(now)
    originals = {
        question["id"]: {
            **question,
            "topic_slug": lesson["topic_slug"],
            "lesson_title": lesson["title"],
        }
        for lesson in data["lessons"]
        for question in lesson["questions"]
    }
    try:
        bank = add_practice_forms(roadmap_slug, originals)
    except (ValueError, OSError, TypeError, KeyError) as error:
        raise HTTPException(
            503, "The current practice forms are unavailable. Please try again later."
        ) from error
    sessions = list(
        db.scalars(
            select(RoadmapAssessmentSession).where(
                RoadmapAssessmentSession.user_id == user_id,
                RoadmapAssessmentSession.roadmap_slug == roadmap_slug,
                RoadmapAssessmentSession.stage_index == stage_index,
                RoadmapAssessmentSession.mode == "practice",
                RoadmapAssessmentSession.completed_at.is_not(None),
                RoadmapAssessmentSession.completed_at <= reference,
            )
        )
    )
    sessions = [item for item in sessions if isinstance(item.result, dict)]
    by_session: dict[str, list[RoadmapQuestionAttempt]] = defaultdict(list)
    if sessions:
        for item in db.scalars(
            select(RoadmapQuestionAttempt).where(
                RoadmapQuestionAttempt.user_id == user_id,
                RoadmapQuestionAttempt.roadmap_slug == roadmap_slug,
                RoadmapQuestionAttempt.session_id.in_([session.id for session in sessions]),
                RoadmapQuestionAttempt.created_at <= reference,
            )
        ):
            by_session[item.session_id].append(item)
    lessons = []
    for lesson in data["lessons"]:
        practice = {
            qid: question
            for qid, question in bank.items()
            if question["topic_slug"] == lesson["topic_slug"] and not question["exam"]
        }
        expected_families = {
            question["id"] for question in lesson["questions"] if not question["exam"]
        }
        candidates = [item for item in sessions if item.topic_slug == lesson["topic_slug"]]
        verified = []
        outdated = 0
        for session in candidates:
            scores = _current_set(
                session, by_session[session.id], practice, lesson["topic_slug"], expected_families
            )
            if scores is None:
                outdated += 1
            else:
                verified.append(scores)
        best = max((item[0] for item in verified), default=None)
        independent_scores = [item[1] for item in verified if item[1] is not None]
        best_independent = max(independent_scores, default=None)
        untracked = sum(item[1] is None for item in verified)
        if best_independent is not None and best_independent >= PASS_SCORE:
            status = "ready"
            reason = (
                "A complete practice set demonstrates at least 75% independently correct answers."
            )
        elif not candidates:
            status = "practice_needed"
            reason = "Complete this lesson's eight-question practice set. Drafts and incomplete sessions do not establish readiness."
        elif not verified:
            status = "outdated"
            reason = "Past records do not match all eight current practice questions and their saved answers. Complete a fresh practice set."
        elif best_independent is None:
            status = "untracked"
            reason = "Past scores are preserved, but their hint use is untracked or inconsistent. Complete a fresh set with at least 75% independently correct answers."
        elif best is not None and best < PASS_SCORE:
            status = "practice_needed"
            reason = f"The best verified overall score is {best}%. Continue practice toward at least 75% independently correct answers."
        else:
            status = "independent_needed"
            reason = f"The best independently correct score is {best_independent}%. Reach 75% without hints on those correct answers; assisted scores alone do not qualify."
        latest = max(
            (utc_naive(item.completed_at) for item in candidates if item.completed_at), default=None
        )
        lessons.append(
            {
                "topic_slug": lesson["topic_slug"],
                "title": lesson["title"],
                "practice_count": len(expected_families),
                "exam_count": sum(question["exam"] for question in lesson["questions"]),
                "best_score": best,
                "best_independent_score": best_independent,
                "completed_attempts": len(candidates),
                "untracked_attempts": untracked,
                "outdated_attempts": outdated,
                "status": status,
                "reason": reason,
                "study_url": f"/roadmaps/{quote(roadmap_slug, safe='')}/{quote(lesson['topic_slug'], safe='')}",
                "last_attempt_at": latest.isoformat() + "Z" if latest else None,
            }
        )
    reserved = [
        question
        for lesson in data["lessons"]
        for question in lesson["questions"]
        if question["exam"]
    ]
    ready = sum(lesson["status"] == "ready" for lesson in lessons)
    return {
        "roadmap_slug": roadmap_slug,
        "stage_index": stage_index,
        "generated_at": reference.isoformat() + "Z",
        "eligible": ready == len(lessons),
        "ready_lessons": ready,
        "required_lessons": len(lessons),
        "pass_score": PASS_SCORE,
        "lessons": lessons,
        "blueprint": {
            "total_questions": len(reserved),
            "kinds": dict(sorted(Counter(question["kind"] for question in reserved).items())),
            "difficulties": dict(
                sorted(Counter(question["difficulty"] for question in reserved).items())
            ),
            "hints_allowed": False,
        },
    }
