"""Personal study, revisioned preferences and immutable visible-time credit."""

import copy
import json
from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.api import learning, learning_dashboard
from app.api import study as study_api
from app.db.base import (
    RoadmapAssessmentSession,
    RoadmapQuestionAttempt,
    RoadmapTopicProgress,
    StudyPreferences,
    User,
)
from app.db.session import SessionLocal
from app.services import study
from app.services.assessment_sessions import freeze_questions
from app.services.curriculum import curriculum, questions_for

NOW = datetime(2026, 6, 1, 12)
SLUGS = ["calculus", "probability", "linear-algebra", "real-analysis", "discrete-math"]


def clock(monkeypatch, now=NOW):
    for module in (learning, learning_dashboard, study_api):
        monkeypatch.setattr(module, "utc_now", lambda: now)


def preferences(**extra):
    return {
        "goal_minutes": 20,
        "session_minutes": 15,
        "preferred_roadmap_slug": None,
        "revision": 0,
        **extra,
    }


def start(client, monkeypatch, slug="calculus", now=NOW, **extra):
    clock(monkeypatch, now)
    payload = {"mode": "study", "budget_minutes": 5, **extra}
    response = client.post(f"/api/roadmaps/{slug}/assessments", json=payload)
    assert response.status_code == 201, response.text
    return response.json(), payload


def answers(session):
    bank = questions_for(session["roadmap_slug"])
    return [
        {"question_id": item["id"], "answer": bank[item["id"]]["answer"]}
        for item in session["questions"]
    ]


def submit(client, session, **extra):
    return client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={"answers": answers(session), **extra},
    )


def recording(*pairs):
    return {
        "version": 1,
        "intervals": [
            {"start_at": start.isoformat() + "Z", "end_at": end.isoformat() + "Z"}
            for start, end in pairs
        ],
    }


def test_preferences_defaults_are_readonly_and_revisioned_updates_are_idempotent_and_owned(
    client, monkeypatch
):
    clock(monkeypatch)
    default = client.get("/api/roadmaps/study-preferences")
    assert default.status_code == 200 and default.headers["cache-control"] == "private, no-store"
    assert default.json() == {**preferences(), "updated_at": None}
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(StudyPreferences)) == 0
        other = User(name="Other")
        db.add(other)
        db.flush()
        db.add(StudyPreferences(user_id=other.id, goal_minutes=120, session_minutes=60))
        db.commit()
    body = preferences(goal_minutes=5, session_minutes=60, preferred_roadmap_slug="probability")
    first = client.put("/api/roadmaps/study-preferences", json=body)
    assert first.status_code == 200 and first.json()["revision"] == 1
    assert first.json()["goal_minutes"] == 5 and first.json()["session_minutes"] == 60
    assert client.put("/api/roadmaps/study-preferences", json=body).json() == first.json()
    assert (
        client.put("/api/roadmaps/study-preferences", json={**body, "goal_minutes": 25}).status_code
        == 409
    )
    second = client.put(
        "/api/roadmaps/study-preferences", json={**body, "goal_minutes": 25, "revision": 1}
    )
    assert second.status_code == 200 and second.json()["revision"] == 2
    assert client.get("/api/roadmaps/study-preferences").json() == second.json()


@pytest.mark.parametrize(
    "change",
    [
        {"goal_minutes": True},
        {"goal_minutes": 4},
        {"goal_minutes": 121},
        {"session_minutes": 4},
        {"session_minutes": 61},
        {"revision": True},
        {"revision": -1},
        {"preferred_roadmap_slug": "unknown"},
        {"user_id": 99},
    ],
)
def test_preferences_reject_invalid_or_override_fields(client, monkeypatch, change):
    clock(monkeypatch)
    assert (
        client.put("/api/roadmaps/study-preferences", json={**preferences(), **change}).status_code
        == 422
    )


@pytest.mark.parametrize("slug", SLUGS)
def test_all_five_study_sets_fit_budget_use_only_practice_and_never_grant_mastery(
    client, monkeypatch, slug
):
    session, _ = start(client, monkeypatch, slug)
    assert session["mode"] == "study" and session["topic_slug"] is None
    plan = session["study_plan"]
    assert 1 <= plan["question_count"] == len(session["questions"]) <= 20
    assert plan["estimated_seconds"] <= plan["budget_minutes"] * 60 == 300
    bank = questions_for(slug)
    assert all(not bank[item["id"]]["exam"] for item in session["questions"])
    assert all(item["selection_reason"]["code"] == "next" for item in session["questions"])
    assert (
        sum(item["selection_reason"]["estimated_seconds"] for item in session["questions"])
        == plan["estimated_seconds"]
    )
    assert sum(plan["reason_counts"].values()) == len(session["questions"])
    target = session["questions"][0]
    hinted = client.post(
        f"/api/roadmaps/assessments/{session['id']}/questions/{target['id']}/hints",
        json={"index": 1},
    )
    assert hinted.status_code == 200
    completed = submit(client, session)
    assert completed.status_code == 200
    result = completed.json()
    assert result["progress"] is None and result["study_summary"]["total"] == len(
        session["questions"]
    )
    assert "does not complete a lesson" in result["study_summary"]["notice"]
    assert not client.get(f"/api/roadmaps/{slug}/exam-readiness").json()["eligible"]
    assert client.get("/api/roadmaps/learning-stats").json()["exams"] == []
    assert (
        client.get("/api/roadmaps/assessment-sessions?mode=study").json()["items"][0]["id"]
        == session["id"]
    )
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapTopicProgress)) == 0


def test_plan_preview_is_private_readonly_and_respects_subject_and_budget_preferences(
    client, monkeypatch
):
    clock(monkeypatch)
    assert (
        client.put(
            "/api/roadmaps/study-preferences",
            json=preferences(preferred_roadmap_slug="real-analysis", session_minutes=5),
        ).status_code
        == 200
    )
    response = client.get("/api/roadmaps/study-plan")
    assert response.status_code == 200 and response.headers["cache-control"] == "private, no-store"
    plan = response.json()
    assert plan["recommendation"]["roadmap_slug"] == "real-analysis"
    assert plan["recommendation"]["budget_minutes"] == 5 and len(plan["subjects"]) == 5
    assert (
        plan["daily_goal"]["recorded_seconds"] == 0
        and plan["daily_goal"]["unknown_duration_sessions"] == 0
    )
    override = client.get("/api/roadmaps/study-plan?roadmap_slug=calculus&budget_minutes=10").json()
    assert (
        override["recommendation"]["roadmap_slug"] == "calculus"
        and override["recommendation"]["budget_minutes"] == 10
    )
    assert client.get("/api/roadmaps/study-plan?roadmap_slug=unknown").status_code == 422
    assert client.get("/api/roadmaps/study-plan?budget_minutes=4").status_code == 422
    serialized = json.dumps(plan)
    assert all(
        key not in serialized
        for key in ("question_id", "prompt", "expected_answer", "proof_dependencies", "hints")
    )
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapAssessmentSession)) == 0
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 0


def test_assigned_budget_and_reasons_survive_preference_changes_uuid_replay_and_archive(
    client, monkeypatch
):
    clock(monkeypatch)
    assert (
        client.put(
            "/api/roadmaps/study-preferences", json=preferences(session_minutes=5)
        ).status_code
        == 200
    )
    session, payload = start(
        client, monkeypatch, budget_minutes=None, request_id=str(uuid4()), topic_slug="ignored"
    )
    assert session["study_plan"]["budget_minutes"] == 5
    assert (
        client.put(
            "/api/roadmaps/study-preferences", json=preferences(session_minutes=60, revision=1)
        ).status_code
        == 200
    )
    replay = client.post("/api/roadmaps/calculus/assessments", json=payload)
    assert replay.status_code == 200 and replay.json() == session
    assert (
        client.post(
            "/api/roadmaps/calculus/assessments", json={**payload, "budget_minutes": 5}
        ).status_code
        == 409
    )
    monkeypatch.setattr(learning, "curriculum", lambda: {})
    monkeypatch.setattr(learning, "questions_for", lambda _: {})
    assert (
        client.get(f"/api/roadmaps/assessments/{session['id']}").json()["study_plan"]
        == session["study_plan"]
    )
    assert (
        client.post("/api/roadmaps/calculus/assessments", json=payload).json()["id"]
        == session["id"]
    )


def test_due_then_unseen_weak_questions_use_only_current_owned_semantic_evidence(
    client, monkeypatch
):
    clock(monkeypatch)
    client.get("/api/stats")
    bank = questions_for("linear-algebra")
    proof = next(item for item in bank.values() if item["kind"] == "proof" and not item["exam"])
    before, after = proof["proof_dependencies"][0]
    wrong = [after, before, *[step for step in proof["answer"] if step not in {before, after}]]
    identifier = str(uuid4())
    with SessionLocal() as db:
        session = RoadmapAssessmentSession(
            id=identifier,
            user_id=1,
            roadmap_slug="linear-algebra",
            topic_slug=proof["topic_slug"],
            stage_index=0,
            mode="practice",
            question_ids=[proof["id"]],
            question_snapshot=freeze_questions([proof], mode="practice"),
            hint_usage={},
            started_at=NOW - timedelta(hours=1),
            completed_at=NOW - timedelta(minutes=1),
            expires_at=NOW + timedelta(hours=1),
            result={
                "feedback": [
                    {
                        "question_id": proof["id"],
                        "submitted_answer": wrong,
                        "expected_answer": proof["answer"],
                        "prompt": proof["prompt"],
                        "correct": False,
                    }
                ]
            },
        )
        db.add(session)
        db.flush()
        db.add(
            RoadmapQuestionAttempt(
                user_id=1,
                session_id=identifier,
                roadmap_slug="linear-algebra",
                topic_slug=proof["topic_slug"],
                question_id=proof["id"],
                concept=proof["concept"],
                answer=wrong,
                correct=False,
                hints_used=0,
                created_at=NOW - timedelta(minutes=1),
            )
        )
        db.commit()
    before = client.get("/api/roadmaps/study-plan?roadmap_slug=linear-algebra").json()
    subject = next(item for item in before["subjects"] if item["slug"] == "linear-algebra")
    assert subject["due"] == 1 and subject["weak"] > 0
    study_set, _ = start(client, monkeypatch, "linear-algebra", budget_minutes=10)
    assert (
        study_set["questions"][0]["id"] == proof["id"]
        and study_set["questions"][0]["selection_reason"]["code"] == "due"
    )
    assert any(item["selection_reason"]["code"] == "weak" for item in study_set["questions"])
    changed = copy.deepcopy(bank)
    changed[proof["id"]]["proof_dependencies"] = []
    monkeypatch.setattr(
        study,
        "questions_for",
        lambda slug: changed if slug == "linear-algebra" else questions_for(slug),
    )
    after = client.get("/api/roadmaps/study-plan?roadmap_slug=linear-algebra").json()
    current = next(item for item in after["subjects"] if item["slug"] == "linear-algebra")
    assert current["due"] == current["weak"] == 0 and current["unseen"] == 48


def test_draft_recording_merges_without_goal_credit_then_finalizes_once(client, monkeypatch):
    session, _ = start(client, monkeypatch)
    url = f"/api/roadmaps/assessments/{session['id']}"
    clock(monkeypatch, NOW + timedelta(seconds=60))
    saved = client.put(
        url + "/draft",
        json={"revision": 1, "time_recording": recording((NOW, NOW + timedelta(seconds=30)))},
    )
    assert saved.status_code == 200
    assert saved.json()["draft"]["time_recording"]["truncated"] is False
    assert client.get("/api/roadmaps/study-plan").json()["daily_goal"]["recorded_seconds"] == 0
    clock(monkeypatch, NOW + timedelta(seconds=120))
    result = submit(
        client,
        session,
        time_recording=recording((NOW + timedelta(seconds=20), NOW + timedelta(seconds=70))),
    ).json()
    assert result["recorded_seconds"] == 70
    assert (
        submit(client, session, time_recording=recording((NOW, NOW + timedelta(hours=1)))).json()
        == result
    )
    goal = client.get("/api/roadmaps/study-plan").json()["daily_goal"]
    assert goal["recorded_seconds"] == 70 and goal["recorded_sessions"] == 1
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        assert row.recorded_seconds == 70 and len(row.recorded_intervals["intervals"]) == 1


def test_nonstudy_budget_is_rejected_before_uuid_replay_and_corrupt_study_context_is_conflict(
    client, monkeypatch
):
    clock(monkeypatch)
    topic = curriculum()["calculus"]["lessons"][0]["topic_slug"]
    body = {"mode": "practice", "topic_slug": topic, "request_id": str(uuid4())}
    assert client.post("/api/roadmaps/calculus/assessments", json=body).status_code == 201
    assert (
        client.post(
            "/api/roadmaps/calculus/assessments", json={**body, "budget_minutes": 5}
        ).status_code
        == 422
    )
    session, payload = start(client, monkeypatch, request_id=str(uuid4()))
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        snapshot = copy.deepcopy(row.question_snapshot)
        snapshot["study_plan"] = None
        row.question_snapshot = snapshot
        db.commit()
    assert client.post("/api/roadmaps/calculus/assessments", json=payload).status_code == 409


def test_daily_goals_union_actual_midnight_segments_and_keep_unknown_legacy_separate(
    client, monkeypatch
):
    beginning = datetime(2026, 5, 31, 23, 55)
    end = datetime(2026, 6, 1, 0, 10)
    day = datetime(2026, 6, 1)
    sessions = [start(client, monkeypatch, now=beginning)[0] for _ in range(4)]
    clock(monkeypatch, end)
    first = recording(
        (beginning + timedelta(minutes=1), beginning + timedelta(minutes=3)),
        (day + timedelta(minutes=1), day + timedelta(minutes=3)),
    )
    assert submit(client, sessions[0], time_recording=first).json()["recorded_seconds"] == 240
    assert (
        submit(
            client,
            sessions[1],
            time_recording=recording((day + timedelta(minutes=2), day + timedelta(minutes=4))),
        ).json()["recorded_seconds"]
        == 120
    )
    assert submit(client, sessions[2]).json()["recorded_seconds"] is None
    assert submit(client, sessions[3], time_recording=recording()).json()["recorded_seconds"] == 0
    goal = client.get("/api/roadmaps/study-plan").json()["daily_goal"]
    assert goal["date"] == "2026-06-01" and goal["recorded_seconds"] == 180
    assert goal["recorded_sessions"] == 2 and goal["unknown_duration_sessions"] == 1
    assert not goal["goal_met"]


@pytest.mark.parametrize(
    "bad",
    [
        {"version": True, "intervals": []},
        {"version": 1, "intervals": [None]},
        {"version": 1, "intervals": [], "score": 100},
        {
            "version": 1,
            "intervals": [{"start_at": "2026-06-01T12:00:00", "end_at": "2026-06-01T12:01:00Z"}],
        },
    ],
)
def test_invalid_recording_rejects_atomically_without_attempts_or_credit(client, monkeypatch, bad):
    session, _ = start(client, monkeypatch)
    assert submit(client, session, time_recording=bad).status_code == 422
    assert (
        client.put(
            f"/api/roadmaps/assessments/{session['id']}/draft",
            json={"revision": 1, "time_recording": bad},
        ).status_code
        == 422
    )
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 0
        assert db.get(RoadmapAssessmentSession, session["id"]).recorded_intervals is None


def test_concurrent_time_draft_requires_submit_retry_and_preserves_all_saved_intervals(
    client, monkeypatch
):
    session, _ = start(client, monkeypatch)
    clock(monkeypatch, NOW + timedelta(seconds=60))
    assert (
        client.put(
            f"/api/roadmaps/assessments/{session['id']}/draft",
            json={"revision": 1, "time_recording": recording((NOW, NOW + timedelta(seconds=10)))},
        ).status_code
        == 200
    )
    original = learning.grade
    fired = False

    def save_during_grade(question, answer):
        nonlocal fired
        if not fired:
            fired = True
            with SessionLocal() as db:
                row = db.get(RoadmapAssessmentSession, session["id"])
                row.draft = {
                    "revision": 2,
                    "answers": [],
                    "time_spent_seconds": 0,
                    "time_recording": recording(
                        (NOW, NOW + timedelta(seconds=10)),
                        (NOW + timedelta(seconds=20), NOW + timedelta(seconds=40)),
                    ),
                }
                db.commit()
        return original(question, answer)

    monkeypatch.setattr(learning, "grade", save_during_grade)
    assert submit(client, session).status_code == 409
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 0
        assert db.get(RoadmapAssessmentSession, session["id"]).recorded_seconds is None
    monkeypatch.setattr(learning, "grade", original)
    assert submit(client, session).json()["recorded_seconds"] == 30
