"""Cross-language arithmetic fixtures and authoritative grading regressions."""

import json
import math
from fractions import Fraction
from pathlib import Path

import pytest

from app.services.curriculum import grade, numeric, public_question
from app.services.math_input import (
    exact_value,
    matches_integer,
    parse_answer,
    parse_container,
    parse_number,
)

FIXTURES = json.loads(
    (Path(__file__).resolve().parents[2] / "fixtures" / "math-input.json").read_text(
        encoding="utf-8"
    )
)


def assert_numeric_result(actual, expected):
    if isinstance(expected, list):
        assert isinstance(actual, list)
        assert len(actual) == len(expected)
        for item, target in zip(actual, expected, strict=True):
            assert_numeric_result(item, target)
    else:
        assert actual == pytest.approx(expected, rel=1e-12, abs=0)


@pytest.mark.parametrize("case", FIXTURES["cases"], ids=lambda case: case["name"])
def test_shared_math_input_contract(case):
    assert FIXTURES["version"] == 1
    if case.get("error"):
        with pytest.raises(ValueError):
            parse_answer(case["input"], case["kind"])
    else:
        # preview_error applies only to browser numeric precision; the backend
        # still computes exact rational cancellation before returning a value.
        assert_numeric_result(parse_answer(case["input"], case["kind"]), case["expected"])


@pytest.mark.parametrize("value", [True, False, None, {}, [], math.nan, math.inf, -math.inf])
def test_scalar_rejects_non_numeric_types_and_nonfinite_values(value):
    with pytest.raises(ValueError):
        parse_number(value)


def test_json_arrays_and_quoted_fraction_entries_share_the_same_grammar():
    assert parse_container(["1/2", "sqrt(4)"], "vector") == [0.5, 2]
    assert parse_container([["1/2", 2], [3, "sqrt(16)"]], "matrix") == [[0.5, 2], [3, 4]]
    assert parse_container('["\\u03c0",2]', "vector") == pytest.approx([math.pi, 2])


@pytest.mark.parametrize(
    "kind,value",
    [
        ("vector", [True, 2]),
        ("vector", [1, math.nan]),
        ("vector", [[1, 2]]),
        ("vector", [1] * 65),
        ("matrix", [[1], [2, 3]]),
        ("matrix", [[1, 2], [3, False]]),
        ("matrix", [[1] * 9 for _ in range(8)]),
        ("matrix", [[[1]]]),
    ],
)
def test_container_types_dimensions_and_all_entries_are_bounded(kind, value):
    with pytest.raises(ValueError):
        parse_container(value, kind)


def test_integer_answers_are_exact_even_for_large_combinatorial_counts():
    question = {"kind": "number", "answer": 10_000_000}
    assert grade(question, "10000001") == (False, None)
    assert grade(question, "10000000.00000001") == (False, None)
    assert grade(question, "20000000/2") == (True, None)
    assert grade({"kind": "number", "answer": 1}, 1.0) == (True, None)
    assert grade({"kind": "number", "answer": 1}, "1.00000000000000001") == (False, None)
    assert grade({"kind": "number", "answer": 9_007_199_254_740_993}, "9007199254740993") == (
        True,
        None,
    )
    assert grade({"kind": "number", "answer": 9_007_199_254_740_993}, "9007199254740992") == (
        False,
        None,
    )
    assert matches_integer("9007199254740993-9007199254740992", 1)
    assert exact_value("1/3+1/3+1/3") == Fraction(1)


def test_integer_mastery_cannot_be_established_by_rounded_irrational_intermediates():
    for source, expected in [
        ("pi+10000000000000000-10000000000000000", 4),
        ("pi+4503599627370496-4503599627370496", 3),
        ("sqrt(2)^2", 2),
        ("pi/pi", 1),
    ]:
        correct, error = grade({"kind": "number", "answer": expected}, source)
        assert not correct
        assert error is not None
        assert "exact" in error
    assert grade({"kind": "number", "answer": 2}, "sqrt(4)") == (True, None)
    assert grade({"kind": "number", "answer": 0}, "1e-20") == (False, None)


def test_real_answer_tolerances_and_natural_containers_remain_supported():
    assert grade({"kind": "number", "answer": math.sqrt(2)}, "sqrt(2)") == (True, None)
    assert grade({"kind": "vector", "answer": [1, math.sqrt(2)]}, "1,sqrt(2)") == (True, None)
    assert grade({"kind": "matrix", "answer": [[0.5, 0], [0, 1]]}, "1/2,0;0,1") == (True, None)
    assert grade({"kind": "vector", "answer": [1, 2]}, "99,1/0")[1]
    assert grade({"kind": "matrix", "answer": [[1, 2], [3, 4]]}, "99,2;3,NaN")[1]


def test_proof_orders_still_require_exact_integer_json_permutations():
    proof = {"kind": "proof", "choices": ["first", "second"], "answer": [2, 1]}
    assert grade(proof, "[2,1]") == (True, None)
    assert grade(proof, "[1+1,1]")[1]
    assert grade(proof, "[2.0,1]")[1]
    assert grade(proof, "2,1")[1]


def test_public_answer_format_explains_integer_rules_without_leaking_answer_keys():
    question = {
        "id": "count",
        "kind": "number",
        "prompt": "Count arrangements.",
        "answer": 10_000_000,
        "solution": "private",
        "tolerance": 0.001,
    }
    public = public_question(question)
    assert public["math_input_version"] == 1
    assert public["answer_format"] == "integer"
    assert public["numeric_tolerance"] == {"absolute": 0, "relative": 0}
    assert not {"answer", "solution", "accepted_orders", "tolerance"}.intersection(public)
    real = public_question({**question, "answer": 0.5})
    assert real["answer_format"] == "number"
    assert real["numeric_tolerance"] == {"absolute": 0.001, "relative": 0.001}


def test_exact_rational_work_is_rejected_before_a_large_power_is_allocated(monkeypatch):
    original = Fraction.__pow__
    calls = []

    def record_power(self, exponent):
        calls.append((self.numerator.bit_length(), self.denominator.bit_length(), exponent))
        return original(self, exponent)

    monkeypatch.setattr(Fraction, "__pow__", record_power)
    with pytest.raises(ValueError):
        parse_number("((99/100)^100)^100")
    assert len(calls) == 1
    assert calls[0][2] == 100


def test_huge_scientific_literals_are_screened_before_fraction_construction(monkeypatch):
    class GuardedFraction(Fraction):
        def __new__(cls, numerator=0, denominator=None):
            if isinstance(numerator, str) and "99999999" in numerator:
                raise AssertionError("Huge scientific power reached Fraction allocation")
            return super().__new__(cls, numerator, denominator)

    monkeypatch.setattr("app.services.math_input.Fraction", GuardedFraction)
    with pytest.raises(ValueError):
        parse_number("1e99999999")
    assert parse_number("0e99999999") == 0


def test_inclusive_magnitude_boundary_and_compatibility_wrapper():
    assert numeric("1e100") == 1e100
    assert numeric("1e100/1e100") == 1
    assert numeric("1.5/3") == 0.5
    with pytest.raises(ValueError):
        numeric("1" + "0" * 100 + "+1")
