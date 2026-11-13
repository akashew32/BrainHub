"""Validate proof dependencies and explain submitted step orders.

Dependency graphs and rationales are private assessment metadata. Public
questions contain neither; the API attaches these explanations only to a
successfully validated submission's persisted result.
"""

from __future__ import annotations

import json
from typing import Any, NotRequired, TypedDict, TypeGuard


class ProofStep(TypedDict):
    step: int
    text: str
    justification: NotRequired[str]


class ViolatedDependency(TypedDict):
    step: int
    requires: int


class ProofDetails(TypedDict):
    submitted_steps: list[ProofStep]
    expected_steps: list[ProofStep]
    first_divergence: int | None
    correct_prefix_length: int
    total_steps: int
    explanation: str
    violated_dependencies: NotRequired[list[ViolatedDependency]]


def _is_permutation(value: Any, total: int) -> TypeGuard[list[int]]:
    return (
        isinstance(value, list)
        and len(value) == total
        and all(type(step) is int for step in value)
        and sorted(value) == list(range(1, total + 1))
    )


def _submitted_order(value: Any, total: int) -> list[int]:
    if isinstance(value, str):
        if len(value) > 4000:
            raise ValueError("Use a short JSON array containing the numbered proof steps.")
        try:
            value = json.loads(value)
        except (ValueError, TypeError, RecursionError) as error:
            raise ValueError("Use a JSON array containing the numbered proof steps.") from error
    if not _is_permutation(value, total):
        raise ValueError("Use every numbered proof step exactly once.")
    return value


def _recognized_orders(question: dict[str, Any], total: int) -> list[list[int]]:
    orders = [question.get("answer")]
    alternatives = question.get("accepted_orders", [])
    if not isinstance(alternatives, list):
        raise ValueError("This proof question has invalid authored proof orders.")
    orders.extend(alternatives)
    validated = []
    for order in orders:
        if not _is_permutation(order, total):
            raise ValueError("This proof question has invalid authored proof orders.")
        validated.append(order)
    return validated


def _dependencies(
    question: dict[str, Any], total: int, orders: list[list[int]]
) -> dict[int, set[int]] | None:
    if "proof_dependencies" not in question:
        return None
    edges = question["proof_dependencies"]
    if not isinstance(edges, list) or len(edges) > total * max(total - 1, 1):
        raise ValueError("This proof question has invalid dependency metadata.")
    prerequisites: dict[int, set[int]] = {step: set() for step in range(1, total + 1)}
    for edge in edges:
        if (
            not isinstance(edge, list)
            or len(edge) != 2
            or any(type(step) is not int or step not in prerequisites for step in edge)
            or edge[0] == edge[1]
        ):
            raise ValueError("This proof question has invalid dependency references.")
        prerequisites[edge[1]].add(edge[0])
    # An explicit cycle check keeps inconsistent content from granting mastery.
    remaining = set(prerequisites)
    resolved: set[int] = set()
    while remaining:
        ready = {step for step in remaining if prerequisites[step] <= resolved}
        if not ready:
            raise ValueError("This proof question has cyclic dependencies.")
        remaining -= ready
        resolved |= ready
    if any(not _respects(order, prerequisites) for order in orders):
        raise ValueError("The authored proof orders do not satisfy their dependency metadata.")
    return prerequisites


def _respects(order: list[int], prerequisites: dict[int, set[int]]) -> bool:
    seen: set[int] = set()
    for step in order:
        if not prerequisites[step] <= seen:
            return False
        seen.add(step)
    return True


def _configuration(
    question: dict[str, Any], submitted: Any
) -> tuple[list[str], list[int], list[list[int]], dict[int, set[int]] | None]:
    choices = question.get("choices")
    if (
        question.get("kind") != "proof"
        or not isinstance(choices, list)
        or not 1 <= len(choices) <= 64
        or any(not isinstance(choice, str) for choice in choices)
    ):
        raise ValueError("This proof question has invalid numbered steps.")
    order = _submitted_order(submitted, len(choices))
    recognized = _recognized_orders(question, len(choices))
    return choices, order, recognized, _dependencies(question, len(choices), recognized)


def grade_proof(question: dict[str, Any], submitted: Any) -> bool:
    """Accept whole valid chains only; prefix information never gives credit."""
    _, order, recognized, prerequisites = _configuration(question, submitted)
    if prerequisites is not None:
        return _respects(order, prerequisites)
    return order in recognized


def _prefix_length(left: list[int], right: list[int]) -> int:
    for index, (actual, expected) in enumerate(zip(left, right, strict=True)):
        if actual != expected:
            return index
    return len(left)


def _valid_continuation(
    submitted: list[int], canonical: list[int], prerequisites: dict[int, set[int]]
) -> tuple[list[int], int]:
    expected: list[int] = []
    seen: set[int] = set()
    for step in submitted:
        if not prerequisites[step] <= seen:
            break
        expected.append(step)
        seen.add(step)
    prefix = len(expected)
    # Kahn's topological sort uses authored order solely to break ties among
    # available independent steps, retaining the learner's valid prefix.
    while len(expected) < len(canonical):
        step = next(step for step in canonical if step not in seen and prerequisites[step] <= seen)
        expected.append(step)
        seen.add(step)
    return expected, prefix


def _rationale(question: dict[str, Any], step: int) -> str:
    rationales = question.get("proof_rationales", {})
    value = rationales.get(str(step)) if isinstance(rationales, dict) else None
    return value.strip() if isinstance(value, str) else ""


def _display_step(question: dict[str, Any], choices: list[str], step: int) -> ProofStep:
    result: ProofStep = {"step": step, "text": choices[step - 1]}
    justification = _rationale(question, step)
    if justification:
        result["justification"] = justification
    return result


def build_proof_feedback(question: dict[str, Any], submitted: Any) -> ProofDetails:
    choices, order, recognized, prerequisites = _configuration(question, submitted)
    violations: list[ViolatedDependency] = []
    if prerequisites is not None:
        expected, prefix = _valid_continuation(order, recognized[0], prerequisites)
        positions = {step: index for index, step in enumerate(order)}
        violations = [
            {"step": step, "requires": required}
            for step in order
            for required in sorted(prerequisites[step])
            if positions[required] > positions[step]
        ]
    else:
        expected = max(recognized, key=lambda candidate: _prefix_length(order, candidate))
        prefix = _prefix_length(order, expected)
    first_divergence = prefix + 1 if prefix < len(order) else None
    if first_divergence is None:
        explanation = "Your sequence follows a recognized proof chain through its conclusion."
        rationale = _rationale(question, order[-1])
    elif violations:
        violation = violations[0]
        explanation = (
            f"At position {first_divergence}, step {violation['step']} appears before its "
            f"prerequisite step {violation['requires']}. Your sequence leaves a recognized proof "
            "chain here. The displayed chain is one valid continuation; independent steps may "
            "admit other valid orders."
        )
        rationale = _rationale(question, violation["requires"])
    else:
        explanation = (
            f"At position {first_divergence}, your sequence leaves the closest recognized proof "
            f"chain; its next continuation is step {expected[prefix]}. Other valid proof orders "
            "may exist beyond the recorded alternatives."
        )
        rationale = _rationale(question, expected[prefix])
    if rationale:
        explanation += " " + rationale
    details: ProofDetails = {
        "submitted_steps": [_display_step(question, choices, step) for step in order],
        "expected_steps": [_display_step(question, choices, step) for step in expected],
        "first_divergence": first_divergence,
        "correct_prefix_length": prefix,
        "total_steps": len(order),
        "explanation": explanation,
    }
    if prerequisites is not None:
        details["violated_dependencies"] = violations
    return details
