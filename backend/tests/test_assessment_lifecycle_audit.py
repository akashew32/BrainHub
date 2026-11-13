"""Pure lifecycle invariants; safe to run without the shared database fixtures."""

from copy import deepcopy
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException

from app.db.base import RoadmapAssessmentSession
from app.services.assessment_sessions import (
    assessment_payload,
    assigned_questions,
    freeze_questions,
    semantic_fingerprint,
)

NOW = datetime(2026, 11, 12, 12)
PRIVATE_KEYS = {
    "answer",
    "solution",
    "accepted_orders",
    "proof_dependencies",
    "proof_rationales",
    "definition",
    "presentation",
    "fingerprint",
    "question_snapshot",
    "exam",
}


def question(kind="choice"):
    value = {
        "id": "audit-question",
        "kind": kind,
        "prompt": "Which integer equals $2+3$?",
        "choices": ["4", "5", "6"],
        "answer": "5",
        "hints": ["Add two to three.", "Count five objects."],
        "solution": "Two plus three is five.",
        "concept": "Addition",
        "difficulty": "foundation",
        "topic_slug": "addition",
        "lesson_title": "Addition",
        "exam": False,
    }
    if kind == "proof":
        value.update(
            {
                "prompt": "Order a proof that the sum of two even integers is even.",
                "choices": ["Write $a=2m$.", "Write $b=2n$.", "Then $a+b=2(m+n)$ is even."],
                "answer": [1, 2, 3],
                "accepted_orders": [[2, 1, 3]],
                "proof_dependencies": [[1, 3], [2, 3]],
                "proof_rationales": {
                    "1": "Represent the first even integer.",
                    "2": "Represent the second even integer.",
                    "3": "Factor out two from the sum.",
                },
            }
        )
    return value


def session(*, snapshot=None, result=None, deadline=None):
    return RoadmapAssessmentSession(
        id="audit-session",
        user_id=1,
        roadmap_slug="probability",
        topic_slug="addition",
        stage_index=0,
        mode="practice",
        question_ids=["audit-question"],
        question_snapshot=snapshot,
        start_request_id="00000000-0000-4000-8000-000000000001",
        hint_usage={},
        hint_revision=0,
        result=result,
        draft={"answers": [{"question_id": "audit-question", "answer": "4"}], "revision": 2},
        started_at=NOW - timedelta(minutes=5),
        expires_at=deadline or NOW + timedelta(hours=2),
    )


def assert_no_private_keys(value):
    if isinstance(value, dict):
        assert not PRIVATE_KEYS.intersection(value)
        for child in value.values():
            assert_no_private_keys(child)
    elif isinstance(value, list):
        for child in value:
            assert_no_private_keys(child)


@pytest.mark.parametrize(
    "field,value",
    [
        ("solution", "A rewritten explanation with the same mathematics."),
        ("proof_rationales", {"1": "More detailed editorial reasoning."}),
        ("concept", "A clearer concept label"),
        ("lesson_title", "A clearer lesson title"),
        ("difficulty", "stretch"),
    ],
)
def test_editorial_changes_do_not_revoke_the_assigned_mathematics(field, value):
    original = question("proof")
    changed = deepcopy(original)
    changed[field] = value
    assert semantic_fingerprint(original) == semantic_fingerprint(changed)


@pytest.mark.parametrize(
    "field,value",
    [
        ("answer", [3, 1, 2]),
        ("prompt", "Prove that the product of two even integers is even."),
        ("hints", ["A newly supplied mathematical hint."]),
        ("tolerance", 0.0001),
        ("proof_dependencies", [[1, 2], [2, 3]]),
        ("accepted_orders", [[1, 3, 2]]),
        ("choices", ["Write $b=2n$.", "Write $a=2m$.", "Then $a+b=2(m+n)$ is even."]),
    ],
)
def test_math_hint_and_proof_identity_changes_are_detected(field, value):
    original = question("proof")
    changed = deepcopy(original)
    changed[field] = value
    assert semantic_fingerprint(original) != semantic_fingerprint(changed)


def test_unordered_choice_presentation_and_dependency_storage_order_are_semantically_stable():
    original = question()
    reordered = deepcopy(original)
    reordered["choices"].reverse()
    assert semantic_fingerprint(original) == semantic_fingerprint(reordered)
    proof = question("proof")
    reordered = deepcopy(proof)
    reordered["proof_dependencies"].reverse()
    assert semantic_fingerprint(proof) == semantic_fingerprint(reordered)


def test_frozen_definition_and_presentation_do_not_alias_the_bank_or_public_response():
    original = question()
    frozen = freeze_questions([original], mode="practice")
    value = session(snapshot=frozen)
    first = assessment_payload(value, now=NOW, current_bank={})
    stored_choices = deepcopy(first["questions"][0]["choices"])
    original["answer"] = "6"
    original["choices"][:] = ["new choice"]
    original["hints"][0] = "A later hint."
    first["questions"][0]["choices"].reverse()
    second = assessment_payload(value, now=NOW, current_bank={})
    assert second["questions"][0]["choices"] == stored_choices
    assert assigned_questions(value, {})["audit-question"]["answer"] == "5"
    assert assigned_questions(value, {})["audit-question"]["hints"][0] == "Add two to three."
    assert second["questions"][0]["hints"] == []
    assert_no_private_keys(second["questions"])


def test_frozen_proof_numbering_is_preserved_and_only_committed_hints_are_public():
    original = question("proof")
    value = session(snapshot=freeze_questions([original], mode="practice"))
    value.hint_usage = {original["id"]: 1}
    payload = assessment_payload(value, now=NOW, current_bank={})
    assert payload["questions"][0]["choices"] == original["choices"]
    assert payload["questions"][0]["hints"] == original["hints"][:1]
    assert payload["questions"][0]["hint_count"] == 2
    assert_no_private_keys(payload["questions"])


def test_exam_snapshot_never_reveals_hints_even_if_its_usage_contains_a_count():
    value = session(snapshot=freeze_questions([question()], mode="exam"))
    value.mode = "exam"
    value.hint_usage = {"audit-question": 2}
    payload = assessment_payload(value, now=NOW, current_bank={})
    assert payload["questions"][0]["hints"] == []
    assert payload["questions"][0]["hint_count"] == 0
    assert_no_private_keys(payload["questions"])


@pytest.mark.parametrize(
    "offset,state", [(-0.000001, "active"), (0, "expired"), (0.000001, "expired")]
)
def test_lifecycle_changes_at_the_exact_server_deadline(offset, state):
    value = session(snapshot=freeze_questions([question()], mode="practice"), deadline=NOW)
    payload = assessment_payload(value, now=NOW + timedelta(seconds=offset), current_bank={})
    assert payload["state"] == state
    assert payload["expires_in_seconds"] >= 0
    assert payload["questions_available"] is True
    assert payload["draft"]["answers"] == value.draft["answers"]
    assert (payload["expires_in_seconds"] == 0) is (state == "expired")


def test_completed_legacy_archive_recovers_its_own_result_and_answers_without_a_current_bank():
    stored_result = {
        "session_id": "audit-session",
        "score": 100,
        "feedback": [{"solution": "Stored feedback."}],
    }
    value = session(result=stored_result, deadline=NOW - timedelta(days=1))
    payload = assessment_payload(value, now=NOW, current_bank={})
    assert payload["state"] == "completed"
    assert payload["result"] == stored_result
    assert payload["questions"] == []
    assert payload["questions_available"] is False
    assert payload["draft"]["answers"] == value.draft["answers"]


def test_legacy_choice_order_is_repeatable_without_rewriting_proof_indices():
    original = question()
    value = session()
    bank = {original["id"]: original}
    first = assessment_payload(value, now=NOW, current_bank=bank)
    for _ in range(5):
        assert (
            assessment_payload(value, now=NOW, current_bank=bank)["questions"] == first["questions"]
        )
    proof = question("proof")
    payload = assessment_payload(value, now=NOW, current_bank={proof["id"]: proof})
    assert payload["questions"][0]["choices"] == proof["choices"]


def test_malformed_private_assignment_is_rejected_instead_of_falling_back_to_a_new_bank():
    frozen = freeze_questions([question()], mode="practice")
    frozen["questions"][0]["presentation"]["id"] = "other-question"
    value = session(snapshot=frozen)
    with pytest.raises(HTTPException) as error:
        assessment_payload(value, now=NOW, current_bank={"audit-question": question()})
    assert error.value.status_code == 409
