import pytest
from sqlalchemy import func, select

from app.db.base import RoadmapAssessmentSession, RoadmapQuestionAttempt, RoadmapTopicProgress
from app.db.session import SessionLocal
from app.services.curriculum import curriculum, grade, numeric, public_question, questions_for


def test_authored_curriculum_has_thirty_substantive_lessons_and_three_hundred_questions():
    banks = curriculum()
    assert set(banks) == {
        "probability",
        "linear-algebra",
        "calculus",
        "real-analysis",
        "discrete-math",
    }
    question_ids = []
    for slug, bank in banks.items():
        assert len(bank["lessons"]) == 6
        assert bank["sources"]
        for lesson in bank["lessons"]:
            assert len(lesson["sections"]) >= 3
            assert all(len(section["body"]) > 100 for section in lesson["sections"])
            assert len(lesson["worked_examples"]) >= 2
            assert all(
                example["steps"] and example["result"] for example in lesson["worked_examples"]
            )
            assert len(lesson["questions"]) == 10
            assert sum(question["exam"] for question in lesson["questions"]) == 2
            for question in lesson["questions"]:
                assert len(question["hints"]) >= 2
                assert len(question["solution"]) > 35
                assert "strongest first move" not in question["prompt"]
                assert grade(question, question["answer"]) == (True, None)
                question_ids.append((slug, question["id"]))
        assert len(questions_for(slug)) == 84
    assert len(set(question_ids)) == len(question_ids) == 300


@pytest.mark.parametrize(
    "source, expected", [("-3/4", -0.75), ("0.25", 0.25), ("1e-3", 0.001), ("−2", -2), ("2/4", 0.5)]
)
def test_numeric_parser_accepts_equivalent_finite_representations(source, expected):
    assert numeric(source) == expected


@pytest.mark.parametrize(
    "source", ["1/0", "nan", "inf", "2**999", "__import__('os')", True, [1], "1e9999", "9" * 161]
)
def test_numeric_parser_rejects_nonfinite_or_executable_input(source):
    with pytest.raises(ValueError):
        numeric(source)


def test_grader_distinguishes_wrong_math_from_malformed_answers():
    assert grade({"kind": "number", "answer": 0.5}, "2/4") == (True, None)
    assert grade({"kind": "number", "answer": 0.5}, "1/3") == (False, None)
    assert grade({"kind": "vector", "answer": [1, 0.5]}, '[1,"1/2"]') == (True, None)
    assert grade({"kind": "vector", "answer": [1, 2]}, "[1]")[1]
    assert grade({"kind": "matrix", "answer": [[1, 2], [3, 4]]}, "[[1,2],[3,4]]") == (True, None)
    assert grade({"kind": "matrix", "answer": [[1, 2], [3, 4]]}, "[1,2,3,4]")[1]
    proof = {"kind": "proof", "choices": ["A", "B", "C"], "answer": [2, 1, 3]}
    assert grade(proof, "[2,1,3]") == (True, None)
    assert grade(proof, "[1,2,3]") == (False, None)
    assert grade(proof, "[2,2,3]")[1]
    assert grade({**proof, "accepted_orders": [[1, 2, 3]]}, "[1,2,3]") == (True, None)


def test_public_choices_are_shuffled_and_private_proof_orders_are_hidden(monkeypatch):
    class ReverseRandom:
        def sample(self, population, k):
            assert k == len(population)
            return list(reversed(population))

    monkeypatch.setattr("app.services.curriculum.random.SystemRandom", ReverseRandom)
    question = {
        "id": "choice",
        "kind": "choice",
        "choices": ["A", "B", "C"],
        "answer": "A",
        "solution": "private",
        "hints": ["private exam hint"],
    }
    public = public_question(question, include_hints=False)
    assert public["choices"] == ["C", "B", "A"]
    assert "answer" not in public and "solution" not in public
    assert public["hints"] == []
    proof = questions_for("linear-algebra")["rotations-reflections-projections-and-shears-08"]
    assert grade(proof, [4, 2, 3, 1]) == (True, None)
    assert grade(proof, [2, 4, 3, 1]) == (True, None)
    assert "accepted_orders" not in public_question(proof)
    assert public_question(proof)["choices"] == proof["choices"]


def test_legacy_client_scores_do_not_establish_authored_mastery(client):
    client.get("/api/stats")
    with SessionLocal() as db:
        for lesson in curriculum()["linear-algebra"]["lessons"]:
            db.add(
                RoadmapTopicProgress(
                    user_id=1,
                    roadmap_slug="linear-algebra",
                    topic_slug=lesson["topic_slug"],
                    status="completed",
                    quiz_score=100,
                    quiz_attempts=1,
                    mastery_version=0,
                    time_spent_seconds=60,
                )
            )
        db.commit()
    progress = client.get("/api/roadmaps/progress").json()
    assert progress["summary"]["completed"] == 0
    assert all(item["quiz_score"] == 0 for item in progress["items"])
    assert progress["summary"]["time_spent_seconds"] == 360
    assert (
        client.post("/api/roadmaps/linear-algebra/assessments", json={"mode": "exam"}).status_code
        == 409
    )
    with SessionLocal() as db:
        assert db.scalars(select(RoadmapTopicProgress)).first().quiz_score == 100


def submit_correct(client, slug, topic):
    started = client.post(
        f"/api/roadmaps/{slug}/assessments", json={"mode": "practice", "topic_slug": topic}
    )
    assert started.status_code == 201
    session = started.json()
    bank = questions_for(slug)
    result = client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={
            "answers": [
                {"question_id": question["id"], "answer": bank[question["id"]]["answer"]}
                for question in session["questions"]
            ],
            "time_spent_seconds": 120,
        },
    )
    assert result.status_code == 200
    return session, result.json()


def test_answers_are_private_and_mastery_requires_server_grading(client):
    slug = "linear-algebra"
    topic = curriculum()[slug]["lessons"][0]["topic_slug"]
    lesson = client.get(f"/api/roadmaps/{slug}/lessons/{topic}").json()
    assert "questions" not in lesson
    assert lesson["question_count"] == 10
    cheat = client.patch(
        f"/api/roadmaps/{slug}/topics/{topic}", json={"status": "completed", "quiz_score": 100}
    )
    assert cheat.status_code == 422
    session, result = submit_correct(client, slug, topic)
    assert all(
        "answer" not in question and "solution" not in question for question in session["questions"]
    )
    assert result["score"] == 100 and result["passed"]
    assert result["progress"]["status"] == "completed"
    assert client.get("/api/stats").json()["roadmaps"]["completed"] == 1
    repeat = client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={"answers": [{"question_id": "ignored", "answer": 0}]},
    )
    assert repeat.json() == result
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 8
    stats = client.get("/api/roadmaps/learning-stats").json()
    assert stats["answers"] == stats["correct"] == 8


def test_session_question_membership_and_malformed_input_are_atomic(client):
    slug = "probability"
    topic = curriculum()[slug]["lessons"][0]["topic_slug"]
    session = client.post(
        f"/api/roadmaps/{slug}/assessments", json={"mode": "practice", "topic_slug": topic}
    ).json()
    invalid = client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={"answers": [{"question_id": "fake", "answer": 3}]},
    )
    assert invalid.status_code == 422
    bank = questions_for(slug)
    answers = [
        {"question_id": question["id"], "answer": bank[question["id"]]["answer"]}
        for question in session["questions"]
    ]
    number_answer = next(item for item in answers if bank[item["question_id"]]["kind"] == "number")
    number_answer["answer"] = "1/0"
    assert (
        client.post(
            f"/api/roadmaps/assessments/{session['id']}/submit", json={"answers": answers}
        ).status_code
        == 422
    )
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 0


def test_review_uses_latest_answer_even_after_a_previous_perfect_score(client):
    slug = "probability"
    topic = curriculum()[slug]["lessons"][0]["topic_slug"]
    submit_correct(client, slug, topic)
    session = client.post(
        f"/api/roadmaps/{slug}/assessments", json={"mode": "practice", "topic_slug": topic}
    ).json()
    bank = questions_for(slug)
    answers = [
        {"question_id": question["id"], "answer": bank[question["id"]]["answer"]}
        for question in session["questions"]
    ]
    target = next(item for item in answers if bank[item["question_id"]]["kind"] == "number")
    target["answer"] = float(target["answer"]) + 17
    result = client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit", json={"answers": answers}
    ).json()
    assert result["score"] < 100
    queue = client.get("/api/roadmaps/mistakes").json()
    assert [item["question_id"] for item in queue["items"]] == [target["question_id"]]
    review = client.post(f"/api/roadmaps/{slug}/assessments", json={"mode": "review"}).json()
    assert [question["id"] for question in review["questions"]] == [target["question_id"]]


def test_stage_exam_is_balanced_and_requires_six_lesson_completions(client):
    slug = "linear-algebra"
    assert (
        client.post(f"/api/roadmaps/{slug}/assessments", json={"mode": "exam"}).status_code == 409
    )
    for lesson in curriculum()[slug]["lessons"]:
        submit_correct(client, slug, lesson["topic_slug"])
    exam = client.post(f"/api/roadmaps/{slug}/assessments", json={"mode": "exam"}).json()
    assert len(exam["questions"]) == 12
    assert all(question["hints"] == [] for question in exam["questions"])
    assert all(
        sum(question["topic_slug"] == lesson["topic_slug"] for question in exam["questions"]) == 2
        for lesson in curriculum()[slug]["lessons"]
    )
    bank = questions_for(slug)
    result = client.post(
        f"/api/roadmaps/assessments/{exam['id']}/submit",
        json={
            "answers": [
                {"question_id": question["id"], "answer": bank[question["id"]]["answer"]}
                for question in exam["questions"]
            ]
        },
    )
    assert result.json()["passed"]
    assert client.get("/api/roadmaps/learning-stats").json()["exams"][0]["score"] == 100


def test_expired_sessions_reject_submission_without_recording_answers(client):
    from datetime import timedelta

    from app.db.base import utc_now

    slug = "probability"
    topic = curriculum()[slug]["lessons"][0]["topic_slug"]
    session = client.post(
        f"/api/roadmaps/{slug}/assessments", json={"mode": "practice", "topic_slug": topic}
    ).json()
    with SessionLocal() as db:
        row = db.get(RoadmapAssessmentSession, session["id"])
        row.expires_at = utc_now() - timedelta(seconds=1)
        db.commit()
    response = client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={"answers": [{"question_id": "x", "answer": 0}]},
    )
    assert response.status_code == 410
