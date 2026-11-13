"""Pure editorial invariants for every authored proof dependency graph.

These tests load JSON directly and need neither an application server nor a
database. Exhaustive permutations are small because every proof has 3–5 steps.
Independent examples below protect mathematically legitimate alternative orders,
not just the stored canonical sequence.
"""

import json
from itertools import permutations
from pathlib import Path
from typing import Any

import pytest

CONTENT = Path(__file__).resolve().parents[1] / "app" / "roadmaps" / "curriculum"
PROOFS: list[tuple[str, dict[str, Any]]] = [
    (bank["roadmap_slug"], question)
    for path in sorted(CONTENT.glob("*.json"))
    for bank in [json.loads(path.read_text(encoding="utf-8"))]
    for lesson in bank["lessons"]
    for question in lesson["questions"]
    if question["kind"] == "proof"
]
BY_ID = {(roadmap, question["id"]): question for roadmap, question in PROOFS}


def respects_dependencies(question: dict[str, Any], order: tuple[int, ...]) -> bool:
    if sorted(order) != list(range(1, len(question["choices"]) + 1)):
        return False
    positions = {step: position for position, step in enumerate(order)}
    return all(
        positions[before] < positions[after] for before, after in question["proof_dependencies"]
    )


def possible_orders(question: dict[str, Any]) -> set[tuple[int, ...]]:
    return {
        order
        for order in permutations(range(1, len(question["choices"]) + 1))
        if respects_dependencies(question, order)
    }


def has_path(edges: list[list[int]], start: int, target: int) -> bool:
    pending = [start]
    seen = set()
    while pending:
        current = pending.pop()
        if current == target:
            return True
        if current in seen:
            continue
        seen.add(current)
        pending.extend(after for before, after in edges if before == current)
    return False


def test_proof_content_covers_all_existing_proofs_without_changing_question_mix():
    assert len(PROOFS) == len(BY_ID) == 21
    assert sum(question["exam"] for _, question in PROOFS) == 12
    assert {roadmap: sum(current == roadmap for current, _ in PROOFS) for roadmap, _ in PROOFS} == {
        "calculus": 1,
        "discrete-math": 7,
        "linear-algebra": 5,
        "probability": 1,
        "real-analysis": 7,
    }
    assert sum(len(question["choices"]) for _, question in PROOFS) == 79


@pytest.mark.parametrize(
    "roadmap,question",
    PROOFS,
    ids=[roadmap + ":" + question["id"] for roadmap, question in PROOFS],
)
def test_every_proof_has_a_valid_minimal_dependency_graph_and_step_rationales(
    roadmap: str, question: dict[str, Any]
):
    del roadmap
    count = len(question["choices"])
    steps = set(range(1, count + 1))
    edges = question["proof_dependencies"]
    assert isinstance(edges, list) and edges
    assert all(
        isinstance(edge, list)
        and len(edge) == 2
        and all(type(step) is int and step in steps for step in edge)
        and edge[0] != edge[1]
        for edge in edges
    )
    assert len({tuple(edge) for edge in edges}) == len(edges)

    rationales = question["proof_rationales"]
    assert isinstance(rationales, dict)
    assert set(rationales) == {str(step) for step in steps}
    assert all(
        isinstance(rationale, str) and len(rationale.strip()) >= 40
        for rationale in rationales.values()
    )
    assert len(set(rationales.values())) == count

    # An available full permutation proves that the directed graph is acyclic.
    valid_orders = possible_orders(question)
    assert valid_orders
    assert tuple(question["answer"]) in valid_orders
    assert all(tuple(order) in valid_orders for order in question.get("accepted_orders", []))

    # Store only necessary immediate dependencies, not redundant transitive edges.
    for index, (before, after) in enumerate(edges):
        other_edges = edges[:index] + edges[index + 1 :]
        assert not has_path(other_edges, before, after)


@pytest.mark.parametrize(
    "roadmap,question_id,expected",
    [
        (
            "real-analysis",
            "suprema-infima-and-order-09",
            {(2, 4, 1, 3), (4, 2, 1, 3), (4, 1, 2, 3)},
        ),
        (
            "linear-algebra",
            "rotations-reflections-projections-and-shears-08",
            {(2, 3, 4, 1), (2, 4, 3, 1), (4, 2, 3, 1)},
        ),
        (
            "discrete-math",
            "invariants-and-extremal-arguments-10",
            {(2, 3, 1, 4), (2, 1, 3, 4)},
        ),
        (
            "discrete-math",
            "induction-and-strong-induction-07",
            {(2, 3, 1, 4), (3, 2, 1, 4), (3, 1, 2, 4)},
        ),
        (
            "discrete-math",
            "induction-and-strong-induction-10",
            {(2, 4, 1, 3), (4, 2, 1, 3), (4, 1, 2, 3)},
        ),
    ],
)
def test_independent_arguments_accept_exactly_the_legitimate_alternative_orders(
    roadmap: str, question_id: str, expected: set[tuple[int, ...]]
):
    assert possible_orders(BY_ID[(roadmap, question_id)]) == expected


@pytest.mark.parametrize(
    "roadmap,question_id,invalid",
    [
        ("real-analysis", "suprema-infima-and-order-09", (2, 1, 4, 3)),
        ("real-analysis", "suprema-infima-and-order-09", (4, 1, 3, 2)),
        (
            "linear-algebra",
            "rotations-reflections-projections-and-shears-08",
            (2, 3, 1, 4),
        ),
        (
            "linear-algebra",
            "rotations-reflections-projections-and-shears-08",
            (3, 2, 4, 1),
        ),
        ("discrete-math", "invariants-and-extremal-arguments-10", (2, 1, 4, 3)),
        ("discrete-math", "induction-and-strong-induction-07", (3, 1, 4, 2)),
    ],
)
def test_real_logical_dependency_violations_are_rejected(
    roadmap: str, question_id: str, invalid: tuple[int, ...]
):
    assert not respects_dependencies(BY_ID[(roadmap, question_id)], invalid)
