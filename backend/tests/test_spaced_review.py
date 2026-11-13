from datetime import UTC, datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.api import learning
from app.db.base import RoadmapAssessmentSession, RoadmapQuestionAttempt, User
from app.db.session import SessionLocal
from app.services import spaced_review
from app.services.curriculum import questions_for
from app.services.spaced_review import (
    INTERVAL_DAYS,
    ReviewEvidence,
    build_review_plan,
    schedule_history,
)

BASE = datetime(2026, 1, 1, 12)


def evidence(
    index=1,
    *,
    at=BASE,
    correct=True,
    hints=0,
    slug="probability",
    question="q",
    user=1,
    mode="practice",
):
    return ReviewEvidence(index, user, slug, question, correct, hints, at, mode)


def question(topic="topic"):
    return {
        "topic_slug": topic,
        "lesson_title": "Lesson",
        "concept": "Concept",
        "prompt": "Compute a value.",
        "answer": "private answer",
        "solution": "private solution",
        "hints": ["private hint"],
    }


def banks(entries=None):
    result = {
        slug: {}
        for slug in ["probability", "linear-algebra", "calculus", "real-analysis", "discrete-math"]
    }
    for slug, ids in (entries or {"probability": ["q"]}).items():
        result[slug] = {qid: question() for qid in ids}
    return result


def test_intervals_advance_only_at_qualifying_recall_and_cap_at_ninety_days():
    history = []
    at = BASE
    for index, interval in enumerate([1, 3, 7, 14, 30, 60, 90, 90, 90], start=1):
        history.append(evidence(index, at=at))
        state = schedule_history(history, now=at)
        assert state.independent_streak == index
        assert state.interval_days == interval
        assert state.due_at == at + timedelta(days=interval)
        at = state.due_at


def test_early_correct_answers_never_advance_or_postpone_due_time():
    original_due = BASE + timedelta(days=1)
    history = [
        evidence(),
        evidence(2, at=BASE + timedelta(hours=12)),
        evidence(3, at=original_due - timedelta(microseconds=1)),
    ]
    state = schedule_history(history, now=original_due)
    assert state.independent_streak == state.interval_days == 1
    assert state.due_at == original_due
    assert state.last_attempt_at == original_due - timedelta(microseconds=1)
    state = schedule_history([*history, evidence(4, at=original_due)], now=original_due)
    assert state.independent_streak == 2
    assert state.interval_days == 3
    assert state.due_at == original_due + timedelta(days=3)


def test_late_correct_answer_anchors_next_interval_to_actual_answer_time():
    late = BASE + timedelta(days=10)
    state = schedule_history([evidence(), evidence(2, at=late)], now=late)
    assert state.interval_days == 3
    assert state.due_at == late + timedelta(days=3)


@pytest.mark.parametrize(
    "correct,hints,status",
    [
        (False, 0, "mistake"),
        (True, 2, "assisted"),
        (True, None, "untracked"),
        (True, -1, "untracked"),
    ],
)
def test_wrong_assisted_and_unknown_answers_reset_then_independent_answer_restarts(
    correct, hints, status
):
    reset_at = BASE + timedelta(hours=12)
    history = [evidence(), evidence(2, at=reset_at, correct=correct, hints=hints)]
    reset = schedule_history(history, now=reset_at)
    assert reset.status == status
    assert reset.independent_streak == reset.interval_days == 0
    assert reset.due_at == reset_at
    state = schedule_history(
        [*history, evidence(3, at=reset_at + timedelta(hours=1))], now=reset_at + timedelta(hours=1)
    )
    assert state.independent_streak == state.interval_days == 1
    assert state.due_at == reset_at + timedelta(hours=25)


def test_out_of_order_histories_use_timestamp_then_id_and_ignore_future_events():
    history = [
        evidence(2, at=BASE, hints=1),
        evidence(1, at=BASE),
        evidence(3, at=BASE + timedelta(days=2)),
    ]
    state = schedule_history(history, now=BASE)
    assert state.status == "assisted" and state.attempts == 2
    reversed_tie = [evidence(2, at=BASE), evidence(1, at=BASE, hints=1)]
    state = schedule_history(reversed_tie, now=BASE)
    assert state.status == "recall" and state.independent_streak == 1


def test_aware_timestamps_are_utc_for_schedule_and_daily_distinct_counts():
    at = datetime(2026, 1, 2, 0, 30, tzinfo=timezone(timedelta(hours=2)))
    now = datetime(2026, 1, 1, 23, tzinfo=UTC)
    plan = build_review_plan([evidence(at=at, mode="review")], banks(), user_id=1, now=now)
    assert plan["summary"]["reviewed_today"] == plan["summary"]["independent_today"] == 1
    assert plan["upcoming"][0]["due_at"] == "2026-01-02T22:30:00Z"


def test_question_keys_include_subject_and_other_users_and_removed_questions_are_ignored():
    current = banks({"probability": ["q", "unseen"], "linear-algebra": ["q"]})
    history = [
        evidence(correct=False),
        evidence(2, slug="linear-algebra"),
        evidence(3, user=2),
        evidence(4, question="removed", correct=False),
    ]
    plan = build_review_plan(history, current, user_id=1, now=BASE)
    assert plan["summary"]["tracked"] == 2
    assert plan["summary"]["unseen"] == 1
    assert plan["items"][0]["roadmap_slug"] == "probability"
    assert plan["upcoming"][0]["roadmap_slug"] == "linear-algebra"
    assert len(plan["subjects"]) == 5
    serialized = str(plan)
    assert (
        "private answer" not in serialized
        and "private solution" not in serialized
        and "private hint" not in serialized
    )


def test_due_priority_and_ties_are_deterministic():
    ids = ["mistake", "assisted", "untracked", "recall"]
    current = banks({"probability": ids})
    history = [
        evidence(1, question="recall"),
        evidence(2, question="untracked", hints=None, at=BASE + timedelta(days=7)),
        evidence(3, question="assisted", hints=1, at=BASE + timedelta(days=8)),
        evidence(4, question="mistake", correct=False, at=BASE + timedelta(days=9)),
    ]
    plan = build_review_plan(reversed(history), current, user_id=1, now=BASE + timedelta(days=10))
    assert [item["status"] for item in plan["items"]] == ids


@pytest.mark.parametrize(
    "correct,now", [(False, BASE + timedelta(days=2)), (True, BASE + timedelta(hours=1))]
)
def test_exact_second_sorts_before_one_microsecond_later_for_due_and_upcoming(correct, now):
    history = [
        evidence(1, question="z-earlier", correct=correct),
        evidence(2, question="a-later", correct=correct, at=BASE + timedelta(microseconds=1)),
    ]
    plan = build_review_plan(
        history, banks({"probability": ["z-earlier", "a-later"]}), user_id=1, now=now
    )
    ordered = plan["upcoming"] if correct else plan["items"]
    assert [item["question_id"] for item in ordered] == ["z-earlier", "a-later"]


def test_daily_counts_are_distinct_review_questions_not_practice_or_new_mastery():
    current = banks({"probability": ["q", "hinted", "practice", "yesterday"]})
    history = [
        evidence(1, mode="review"),
        evidence(2, mode="review", at=BASE + timedelta(minutes=1), correct=False),
        evidence(3, mode="review", question="hinted", hints=1),
        evidence(4, question="practice"),
        evidence(5, question="yesterday", mode="review", at=BASE - timedelta(days=1)),
    ]
    plan = build_review_plan(history, current, user_id=1, now=BASE + timedelta(hours=1))
    assert plan["summary"]["reviewed_today"] == 2
    assert plan["summary"]["independent_today"] == 1


def test_empty_and_large_plans_keep_all_subjects_and_limit_only_upcoming_preview():
    empty = build_review_plan([], banks(), user_id=1, now=BASE)
    assert len(empty["subjects"]) == 5
    assert empty["summary"]["due"] == empty["summary"]["tracked"] == 0
    assert empty["summary"]["next_due_at"] is None
    ids = [f"q{index:02}" for index in range(24)]
    history = [evidence(index + 1, question=qid) for index, qid in enumerate(ids)]
    plan = build_review_plan(history, banks({"probability": ids}), user_id=1, now=BASE)
    assert plan["summary"]["scheduled"] == plan["summary"]["tracked"] == 24
    assert len(plan["upcoming"]) == 10
    assert plan["summary"]["unseen"] == 0
    assert plan["summary"]["next_due_at"] == plan["upcoming"][0]["due_at"]
    assert plan["policy"]["interval_days"] == list(INTERVAL_DAYS)
    assert not plan["policy"]["early_practice_advances"]


def seed_attempt(
    db,
    *,
    user_id=1,
    slug="calculus",
    question_id=None,
    correct=False,
    hints=0,
    at=BASE,
    mode="practice",
    owner=None,
):
    bank = questions_for(slug)
    qid = question_id or next(iter(bank))
    private = bank[qid]
    session_id = str(uuid4())
    db.add(
        RoadmapAssessmentSession(
            id=session_id,
            user_id=owner or user_id,
            roadmap_slug=slug,
            topic_slug=private["topic_slug"],
            mode=mode,
            question_ids=[qid],
            hint_usage={} if hints is not None else None,
            completed_at=at,
            expires_at=at + timedelta(hours=2),
            result={"score": 100 if correct else 0, "passed": correct},
        )
    )
    db.flush()
    db.add(
        RoadmapQuestionAttempt(
            user_id=user_id,
            session_id=session_id,
            roadmap_slug=slug,
            topic_slug=private["topic_slug"],
            question_id=qid,
            concept=private["concept"],
            answer=private["answer"],
            correct=correct,
            hints_used=hints,
            created_at=at,
        )
    )
    return qid


def freeze_api(monkeypatch, at):
    clock = [at]
    monkeypatch.setattr(learning, "utc_now", lambda: clock[0])
    return clock


def test_api_empty_plan_covers_all_five_subjects_and_three_hundred_unseen_questions(
    client, monkeypatch
):
    freeze_api(monkeypatch, BASE)
    response = client.get("/api/roadmaps/review-plan")
    assert response.status_code == 200
    plan = response.json()
    assert plan["summary"]["unseen"] == 300
    assert len(plan["subjects"]) == 5
    assert all(item["unseen"] == 60 for item in plan["subjects"])
    assert plan["items"] == plan["upcoming"] == []


def test_api_review_submission_reschedules_question_and_reads_or_drafts_do_not_change_schedule(
    client, monkeypatch
):
    clock = freeze_api(monkeypatch, BASE + timedelta(days=5))
    client.get("/api/stats")
    with SessionLocal() as db:
        qid = seed_attempt(db)
        db.commit()
    before = client.get("/api/roadmaps/review-plan").json()
    assert before["summary"]["due"] == 1
    assert client.get("/api/roadmaps/mistakes").json()["items"] == before["items"]
    assert client.get("/api/roadmaps/learning-stats").json()["concepts_to_review"] == 1
    session = client.post("/api/roadmaps/calculus/assessments", json={"mode": "review"}).json()
    topic = questions_for("calculus")[qid]["topic_slug"]
    assert client.get(f"/api/roadmaps/calculus/lessons/{topic}").status_code == 200
    assert (
        client.put(
            f"/api/roadmaps/assessments/{session['id']}/draft",
            json={"answers": [{"question_id": qid, "answer": "1/"}], "revision": 1},
        ).status_code
        == 200
    )
    assert client.get("/api/roadmaps/review-plan").json() == before
    result = client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={
            "answers": [{"question_id": qid, "answer": questions_for("calculus")[qid]["answer"]}]
        },
    )
    assert result.status_code == 200
    after = client.get("/api/roadmaps/review-plan").json()
    assert after["summary"]["due"] == 0
    assert after["summary"]["scheduled"] == 1
    assert after["summary"]["reviewed_today"] == after["summary"]["independent_today"] == 1
    assert after["upcoming"][0]["due_at"] == (clock[0] + timedelta(days=1)).isoformat() + "Z"
    assert client.get("/api/roadmaps/mistakes").json()["items"] == []
    assert client.get("/api/roadmaps/learning-stats").json()["concepts_to_review"] == 0
    assert (
        client.post("/api/roadmaps/calculus/assessments", json={"mode": "review"}).status_code
        == 409
    )
    assert client.get("/api/roadmaps/review-plan").json() == after
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 2


def test_api_review_selection_matches_queue_priority_and_caps_at_eight_without_answer_leaks(
    client, monkeypatch
):
    freeze_api(monkeypatch, BASE + timedelta(days=5))
    client.get("/api/stats")
    qids = list(questions_for("calculus"))[:10]
    with SessionLocal() as db:
        for qid in qids:
            seed_attempt(db, question_id=qid)
        db.commit()
    plan = client.get("/api/roadmaps/review-plan").json()
    expected = [item["question_id"] for item in plan["items"]][:8]
    started = client.post("/api/roadmaps/calculus/assessments", json={"mode": "review"}).json()
    assert [item["id"] for item in started["questions"]] == expected
    assert len(expected) == 8
    assert all(
        not {"answer", "solution", "proof_dependencies", "proof_rationales"}.intersection(item)
        and not item["hints"]
        for item in started["questions"]
    )
    forbidden = {
        "answer",
        "expected_answer",
        "solution",
        "hints",
        "choices",
        "proof_rationales",
        "proof_dependencies",
    }
    assert all(not forbidden.intersection(item) for item in plan["items"])
    due_concepts = {(item["roadmap_slug"], item["concept"]) for item in plan["items"]}
    assert client.get("/api/roadmaps/learning-stats").json()["concepts_to_review"] == len(
        due_concepts
    )


def test_api_filters_other_users_mismatched_session_owners_and_removed_questions_consistently(
    client, monkeypatch
):
    freeze_api(monkeypatch, BASE + timedelta(days=5))
    client.get("/api/stats")
    with SessionLocal() as db:
        other = User(name="Other user")
        db.add(other)
        db.flush()
        qid = seed_attempt(db, user_id=other.id)
        seed_attempt(db, owner=other.id)
        db.commit()
    assert client.get("/api/roadmaps/review-plan").json()["summary"]["tracked"] == 0
    with SessionLocal() as db:
        seed_attempt(db)
        db.commit()
    assert client.get("/api/roadmaps/review-plan").json()["summary"]["due"] == 1
    original = spaced_review.questions_for

    def removed(slug):
        result = original(slug)
        if slug == "calculus":
            result.pop(qid)
        return result

    monkeypatch.setattr(spaced_review, "questions_for", removed)
    plan = client.get("/api/roadmaps/review-plan").json()
    assert plan["summary"]["tracked"] == 0 and plan["summary"]["unseen"] == 299
    assert client.get("/api/roadmaps/mistakes").json()["items"] == []
    assert client.get("/api/roadmaps/learning-stats").json()["concepts_to_review"] == 0
    assert (
        client.post("/api/roadmaps/calculus/assessments", json={"mode": "review"}).status_code
        == 409
    )
