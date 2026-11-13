from itertools import permutations

import pytest
from sqlalchemy import func, select

from app.db.base import RoadmapQuestionAttempt
from app.db.session import SessionLocal
from app.services.curriculum import grade, public_question, questions_for
from app.services.proof_feedback import build_proof_feedback, grade_proof


def supremum_proof():
    return {
        "kind": "proof",
        "choices": [
            "Choose n > 1/epsilon so 1-1/n > 1-epsilon.",
            "Every 1-1/n is less than one, so one is an upper bound.",
            "No smaller bound works, so one is the supremum.",
            "Let epsilon > 0 be arbitrary.",
        ],
        "answer": [2, 4, 1, 3],
        "proof_dependencies": [[4, 1], [1, 3], [2, 3]],
        "proof_rationales": {
            "1": "The chosen integer supplies a set element within the arbitrary tolerance.",
            "2": "Leastness matters only after the candidate has been shown to bound the set.",
            "3": "The upper bound and arbitrarily close witnesses together establish leastness.",
            "4": "The witness may depend on epsilon, so epsilon must be fixed first.",
        },
    }


def test_canonical_chain_has_full_prefix_and_step_justifications():
    question = supremum_proof()
    details = build_proof_feedback(question, "[2,4,1,3]")
    assert grade_proof(question, [2, 4, 1, 3])
    assert details["correct_prefix_length"] == details["total_steps"] == 4
    assert details["first_divergence"] is None
    assert details["violated_dependencies"] == []
    assert [step["step"] for step in details["expected_steps"]] == [2, 4, 1, 3]
    assert all(step["justification"] for step in details["expected_steps"])
    assert all(step["justification"] for step in details["submitted_steps"])


def test_dependency_graph_accepts_all_and_only_the_three_valid_supremum_orders():
    valid = {(2, 4, 1, 3), (4, 2, 1, 3), (4, 1, 2, 3)}
    question = supremum_proof()
    for order in permutations([1, 2, 3, 4]):
        assert grade(question, list(order)) == (order in valid, None)
    details = build_proof_feedback(question, [4, 1, 2, 3])
    assert details["first_divergence"] is None
    assert [step["step"] for step in details["expected_steps"]] == [4, 1, 2, 3]


def test_wrong_order_preserves_valid_prefix_and_explains_first_missing_prerequisite():
    question = supremum_proof()
    details = build_proof_feedback(question, [4, 3, 1, 2])
    assert grade(question, [4, 3, 1, 2]) == (False, None)
    assert details["first_divergence"] == 2
    assert details["correct_prefix_length"] == 1
    assert [step["step"] for step in details["expected_steps"]] == [4, 2, 1, 3]
    assert details["violated_dependencies"] == [
        {"step": 3, "requires": 1},
        {"step": 3, "requires": 2},
    ]
    assert "step 3 appears before its prerequisite step 1" in details["explanation"]
    assert question["proof_rationales"]["1"] in details["explanation"]
    assert "other valid orders" in details["explanation"]


def test_legacy_alternative_order_uses_matching_expected_chain_and_stable_best_prefix():
    question = supremum_proof()
    del question["proof_dependencies"]
    question["accepted_orders"] = [[4, 2, 1, 3]]
    correct = build_proof_feedback(question, [4, 2, 1, 3])
    assert [step["step"] for step in correct["expected_steps"]] == [4, 2, 1, 3]
    assert correct["first_divergence"] is None
    assert "violated_dependencies" not in correct
    incorrect = build_proof_feedback(question, [4, 2, 3, 1])
    assert incorrect["correct_prefix_length"] == 2
    assert [step["step"] for step in incorrect["expected_steps"]] == [4, 2, 1, 3]
    assert "beyond the recorded alternatives" in incorrect["explanation"]
    assert grade(question, [4, 2, 3, 1]) == (False, None)


@pytest.mark.parametrize(
    "submitted",
    [[1, 1, 3, 4], [1, 2, 3], [1, 2, 3, True], [1, 2, 3, 4.0], "1,2,3,4", "[1+1,1,3,4]"],
)
def test_malformed_orders_never_produce_expected_step_feedback(submitted):
    with pytest.raises(ValueError):
        build_proof_feedback(supremum_proof(), submitted)
    assert grade(supremum_proof(), submitted)[1]


@pytest.mark.parametrize(
    "edges",
    [[[1, 1]], [[0, 1]], [[5, 1]], [[True, 1]], [[1]], [[1, 2], [2, 1]], [[3, 2]]],
)
def test_invalid_or_inconsistent_private_graphs_fail_closed(edges):
    question = {**supremum_proof(), "proof_dependencies": edges}
    correct, error = grade(question, [2, 4, 1, 3])
    assert not correct
    assert error is not None


def test_deeply_nested_json_proof_is_a_validation_error_instead_of_an_exception():
    source = "[" * 1500 + "1" + "]" * 1500
    assert grade(supremum_proof(), source)[1]


def test_public_question_never_exposes_dependency_graphs_or_step_rationales():
    question = supremum_proof()
    public = public_question(question)
    assert not {
        "answer",
        "accepted_orders",
        "proof_dependencies",
        "proof_rationales",
        "proof_details",
    }.intersection(public)
    assert public["choices"] == question["choices"]


def start_projection_practice(client, monkeypatch):
    bank = questions_for("linear-algebra")
    target = "rotations-reflections-projections-and-shears-08"
    bank[target]["proof_dependencies"] = [[2, 3], [3, 1], [4, 1]]
    bank[target]["proof_rationales"] = {
        "1": "Cancellation leaves the same projection matrix, proving idempotence.",
        "2": "Substitution exposes both copies of the projection before regrouping.",
        "3": "Associativity isolates the scalar inner product in the middle.",
        "4": "A nonzero real vector has positive squared norm, permitting division.",
    }
    monkeypatch.setattr("app.api.learning.questions_for", lambda _slug: bank)
    response = client.post(
        "/api/roadmaps/linear-algebra/assessments",
        json={"mode": "practice", "topic_slug": "rotations-reflections-projections-and-shears"},
    )
    assert response.status_code == 201
    return bank, target, response.json()


def session_answers(bank, session, target, order):
    return [
        {
            "question_id": question["id"],
            "answer": order if question["id"] == target else bank[question["id"]]["answer"],
        }
        for question in session["questions"]
    ]


def test_proof_feedback_only_appears_after_submission_and_survives_retry_recovery(
    client, monkeypatch
):
    bank, target, session = start_projection_practice(client, monkeypatch)
    for question in session["questions"]:
        assert not {"proof_details", "proof_dependencies", "proof_rationales"}.intersection(
            question
        )
    before = client.get(f"/api/roadmaps/assessments/{session['id']}").json()
    assert "result" not in before
    alternative = [4, 2, 3, 1]
    response = client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={"answers": session_answers(bank, session, target, alternative)},
    )
    assert response.status_code == 200
    result = response.json()
    feedback = next(item for item in result["feedback"] if item["question_id"] == target)
    assert feedback["correct"]
    assert feedback["expected_answer"] == alternative
    assert feedback["proof_details"]["first_divergence"] is None
    assert (
        feedback["proof_details"]["expected_steps"][0]["justification"]
        == bank[target]["proof_rationales"]["4"]
    )
    recovered = client.get(f"/api/roadmaps/assessments/{session['id']}").json()
    assert recovered["result"] == result
    repeated = client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={"answers": [{"question_id": "ignored", "answer": 0}]},
    )
    assert repeated.json() == result
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 8


def test_wrong_proof_receives_explanation_but_no_partial_question_credit(client, monkeypatch):
    bank, target, session = start_projection_practice(client, monkeypatch)
    response = client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={"answers": session_answers(bank, session, target, [2, 1, 3, 4])},
    )
    result = response.json()
    feedback = next(item for item in result["feedback"] if item["question_id"] == target)
    assert not feedback["correct"]
    assert result["correct"] == 7
    assert feedback["proof_details"]["correct_prefix_length"] == 1
    assert feedback["proof_details"]["first_divergence"] == 2


def test_malformed_submission_does_not_leak_proof_feedback_or_save_other_answers(
    client, monkeypatch
):
    bank, target, session = start_projection_practice(client, monkeypatch)
    response = client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit",
        json={"answers": session_answers(bank, session, target, [2, 2, 3, 4])},
    )
    assert response.status_code == 422
    assert "proof_details" not in response.text
    assert "proof_rationales" not in response.text
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 0


def test_frozen_proof_survives_archived_curriculum_and_completed_retry(client, monkeypatch):
    bank, target, session = start_projection_practice(client, monkeypatch)
    answers = session_answers(bank, session, target, [2, 3, 4, 1])
    monkeypatch.setattr("app.api.learning.questions_for", lambda _slug: {})
    changed = client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit", json={"answers": answers}
    )
    assert changed.status_code == 200
    assert changed.json()["correct"] == 8
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapQuestionAttempt)) == 8
    monkeypatch.setattr("app.api.learning.questions_for", lambda _slug: bank)
    completed = client.post(
        f"/api/roadmaps/assessments/{session['id']}/submit", json={"answers": answers}
    )
    assert completed.status_code == 200
    assert completed.json() == changed.json()
    monkeypatch.setattr("app.api.learning.questions_for", lambda _slug: {})
    assert (
        client.post(
            f"/api/roadmaps/assessments/{session['id']}/submit", json={"answers": answers}
        ).json()
        == completed.json()
    )
