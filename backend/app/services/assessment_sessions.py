"""Private frozen assignments and public assessment lifecycle serialization."""

from __future__ import annotations

import copy
import hashlib
import json
import random
from datetime import datetime
from typing import Any
from urllib.parse import quote

from fastapi import HTTPException

from app.db.base import RoadmapAssessmentSession
from app.services.assessment_hints import assistance, hints_allowed
from app.services.curriculum import PASS_SCORE, grade, lesson_for, public_question
from app.services.spaced_review import utc_naive


def assessment_state(session: RoadmapAssessmentSession, *, now: datetime) -> str:
    """One lifecycle definition for recovery, history and deadline boundaries."""
    if session.result is not None:
        return "completed"
    return "expired" if utc_naive(session.expires_at) <= utc_naive(now) else "active"


def semantic_fingerprint(question: dict[str, Any]) -> str:
    """Identify the assigned mathematics, excluding editorial feedback changes."""
    fields = (
        "id",
        "prompt",
        "kind",
        "choices",
        "answer",
        "tolerance",
        "accepted_orders",
        "proof_dependencies",
        "hints",
    )
    semantic = {key: copy.deepcopy(question.get(key)) for key in fields}
    if question.get("kind") == "choice":
        semantic["choices"] = sorted(question["choices"])
    for key in ("accepted_orders", "proof_dependencies"):
        values = semantic[key]
        if values is not None:
            semantic[key] = sorted(values)
    encoded = json.dumps(semantic, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def freeze_questions(questions: list[dict[str, Any]], *, mode: str) -> dict[str, Any]:
    return {
        "version": 1,
        "questions": [
            {
                "definition": copy.deepcopy(question),
                "presentation": copy.deepcopy(
                    public_question(question, include_hints=hints_allowed(mode))
                ),
                "fingerprint": semantic_fingerprint(question),
            }
            for question in questions
        ],
    }


def frozen_entries(session: RoadmapAssessmentSession) -> dict[str, dict[str, Any]] | None:
    snapshot = session.question_snapshot
    if snapshot is None:
        return None
    if not isinstance(snapshot, dict) or snapshot.get("version") != 1:
        raise HTTPException(409, "This assessment's saved assignment is unavailable.")
    entries = snapshot.get("questions")
    if not isinstance(entries, list) or len(entries) != len(session.question_ids):
        raise HTTPException(409, "This assessment's saved assignment is incomplete.")
    result = {}
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("definition"), dict):
            raise HTTPException(409, "This assessment's saved assignment is incomplete.")
        definition = entry["definition"]
        question_id = definition.get("id")
        if (
            not isinstance(question_id, str)
            or question_id in result
            or not isinstance(entry.get("presentation"), dict)
            or entry["presentation"].get("id") != question_id
        ):
            raise HTTPException(409, "This assessment's saved assignment is incomplete.")
        result[question_id] = entry
    if set(result) != set(session.question_ids):
        raise HTTPException(409, "This assessment's saved assignment is incomplete.")
    return result


def assigned_questions(
    session: RoadmapAssessmentSession, current_bank: dict[str, dict[str, Any]]
) -> dict[str, dict[str, Any]]:
    entries = frozen_entries(session)
    if entries is not None:
        return {question_id: entry["definition"] for question_id, entry in entries.items()}
    if any(question_id not in current_bank for question_id in session.question_ids):
        raise HTTPException(409, "This assessment's curriculum changed. Start a fresh session.")
    return {question_id: current_bank[question_id] for question_id in session.question_ids}


def diagnostic_study_url(
    roadmap_slug: str,
    topic_slug: str,
    assigned: list[dict[str, Any]],
    current_bank: dict[str, dict[str, Any]],
) -> str | None:
    """Offer current navigation only when it still teaches the sampled mathematics."""
    compatible = (
        len(assigned) == 2
        and lesson_for(roadmap_slug, topic_slug) is not None
        and all(
            question["id"] in current_bank
            and current_bank[question["id"]]["topic_slug"] == topic_slug
            and semantic_fingerprint(current_bank[question["id"]]) == semantic_fingerprint(question)
            for question in assigned
        )
    )
    return (
        f"/roadmaps/{quote(roadmap_slug, safe='')}/{quote(topic_slug, safe='')}"
        if compatible
        else None
    )


def project_result_navigation(
    session: RoadmapAssessmentSession,
    result: dict[str, Any],
    *,
    current_bank: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Refresh diagnostic links without rewriting immutable graded feedback."""
    if session.mode != "diagnostic":
        return result
    projected = copy.deepcopy(result)
    summary = projected.get("diagnostic_summary")
    if not isinstance(summary, dict) or not isinstance(summary.get("topics"), list):
        return projected
    entries = frozen_entries(session)
    definitions = [item["definition"] for item in entries.values()] if entries else []
    for topic in summary["topics"]:
        if not isinstance(topic, dict) or not isinstance(topic.get("topic_slug"), str):
            continue
        samples = [
            question
            for question in definitions
            if question.get("topic_slug") == topic["topic_slug"]
        ]
        if (
            diagnostic_study_url(session.roadmap_slug, topic["topic_slug"], samples, current_bank)
            is None
        ):
            topic["study_url"] = None
    return projected


def assessment_payload(
    session: RoadmapAssessmentSession,
    *,
    now: datetime,
    current_bank: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    completed = session.result is not None
    state = assessment_state(session, now=now)
    entries = frozen_entries(session)
    missing = entries is None and any(qid not in current_bank for qid in session.question_ids)
    if missing and not completed:
        if state == "expired":
            raise HTTPException(410, "This assessment has expired. Start a fresh session.")
        raise HTTPException(409, "This assessment's curriculum changed. Start a fresh session.")
    questions = []
    if not missing:
        for question_id in session.question_ids:
            if entries is not None:
                entry = entries[question_id]
                question = copy.deepcopy(entry["presentation"])
                definition = entry["definition"]
            else:
                definition = current_bank[question_id]
                question = public_question(definition, include_hints=hints_allowed(session.mode))
                if definition["kind"] == "choice":
                    # Legacy rows have no stored presentation. Keep their fallback
                    # stable across reloads without changing proof step numbering.
                    choices = list(definition["choices"])
                    random.Random(f"{session.id}:{question_id}").shuffle(choices)
                    question["choices"] = choices
            hints = definition.get("hints", []) if hints_allowed(session.mode) else []
            count = (session.hint_usage or {}).get(question_id, 0)
            question["hint_count"] = len(hints)
            question["hints"] = hints[:count]
            questions.append(question)
    draft = session.draft or {}
    payload: dict[str, Any] = {
        "id": session.id,
        "request_id": session.start_request_id,
        "mode": session.mode,
        "roadmap_slug": session.roadmap_slug,
        "topic_slug": session.topic_slug,
        "stage_index": session.stage_index,
        "expires_at": session.expires_at.isoformat() + "Z",
        "state": state,
        "server_now": now.isoformat() + "Z",
        "expires_in_seconds": max(0.0, (session.expires_at - now).total_seconds()),
        "questions_available": bool(questions),
        "pass_score": PASS_SCORE,
        "questions": questions,
        "hint_usage": session.hint_usage,
        "assistance": assistance(session.hint_usage),
        "draft": {
            "answers": draft.get("answers", []),
            "time_spent_seconds": draft.get("time_spent_seconds", 0),
            "revision": draft.get("revision", 0),
        },
    }
    if session.result is not None:
        payload["result"] = project_result_navigation(
            session, session.result, current_bank=current_bank
        )
    if "time_recording" in draft:
        payload["draft"]["time_recording"] = copy.deepcopy(draft["time_recording"])
    if session.mode == "study":
        metadata = (session.question_snapshot or {}).get("study_plan")
        if not isinstance(metadata, dict):
            raise HTTPException(409, "This study session's saved selection is unavailable.")
        payload["study_plan"] = {
            key: copy.deepcopy(metadata[key])
            for key in (
                "version",
                "budget_minutes",
                "preferences_revision",
                "estimated_seconds",
                "question_count",
                "reason_counts",
                "notice",
            )
        }
        reasons = {item["question_id"]: item for item in metadata["questions"]}
        for question in questions:
            reason = reasons[question["id"]]
            question["selection_reason"] = {
                key: reason[key] for key in ("code", "text", "estimated_seconds")
            }
    return payload


def compatible_practice_content(
    session: RoadmapAssessmentSession,
    questions: dict[str, dict[str, Any]],
    attempts: list[Any],
) -> bool:
    """Require evidence for the current math, while retaining compatible legacy work."""
    try:
        entries = frozen_entries(session)
        if entries is not None:
            return set(entries) == set(questions) and all(
                semantic_fingerprint(entries[qid]["definition"]) == semantic_fingerprint(question)
                for qid, question in questions.items()
            )
        feedback = (session.result or {}).get("feedback")
        if not isinstance(feedback, list) or len(feedback) != len(questions):
            return False
        saved = {item["question_id"]: item for item in feedback if isinstance(item, dict)}
        if len(saved) != len(feedback) or set(saved) != set(questions):
            return False
        rows = {item.question_id: item for item in attempts}
        for qid, question in questions.items():
            item = saved[qid]
            if (
                item.get("prompt") != question["prompt"]
                or item.get("submitted_answer") != rows[qid].answer
                or grade(question, item.get("expected_answer")) != (True, None)
                or (rows[qid].correct and grade(question, rows[qid].answer) != (True, None))
            ):
                return False
        return True
    except (HTTPException, KeyError, TypeError, ValueError):
        return False
