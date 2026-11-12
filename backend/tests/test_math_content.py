"""Independent numerical checks for authored calculus answer keys.

These compute results from the exercises' stated functions and geometry rather
than passing the answer key back into the same grader.
"""

import math

import pytest

from app.services.curriculum import grade, questions_for


def recurrence(initial, multiplier, offset, steps):
    value = initial
    for _ in range(steps):
        value = multiplier * value + offset
    return value


@pytest.mark.parametrize(
    "question_id, expected",
    [
        ("function-composition-and-inverses-01", 2 * (2**2 - 3) + 1),
        ("function-composition-and-inverses-02", (2 * 2 + 1) ** 2 - 3),
        ("function-composition-and-inverses-03", (11 + 4) / 5),
        ("function-composition-and-inverses-05", [-2, 1]),
        ("function-composition-and-inverses-07", (4 + 2) / (1 - 4)),
        ("polynomial-and-rational-behavior-03", 3 / 2),
        ("polynomial-and-rational-behavior-04", [3, 3 + 3]),
        ("polynomial-and-rational-behavior-07", [1, -2, 7 - 4]),
        ("polynomial-and-rational-behavior-09", (2 + 2) / (2 + 3)),
        ("exponential-and-logarithmic-functions-01", math.log(32, 2)),
        ("exponential-and-logarithmic-functions-02", math.log(math.exp(3))),
        (
            "exponential-and-logarithmic-functions-03",
            math.log(math.exp(4)) + math.log(math.exp(-1)),
        ),
        ("exponential-and-logarithmic-functions-05", 2 ** (9 / 3)),
        ("exponential-and-logarithmic-functions-06", 3**2 + 1),
        ("exponential-and-logarithmic-functions-08", 50 * (200 / 50) ** (3 / 2)),
        ("exponential-and-logarithmic-functions-09", math.sqrt(15 + 1)),
        ("trigonometric-functions-and-identities-01", math.radians(150) / math.pi),
        ("trigonometric-functions-and-identities-02", math.sin(math.pi / 6)),
        ("trigonometric-functions-and-identities-03", -math.sqrt(1 - (3 / 5) ** 2)),
        ("trigonometric-functions-and-identities-04", abs(3)),
        ("trigonometric-functions-and-identities-05", (2 * math.pi / 2) / math.pi),
        ("trigonometric-functions-and-identities-06", [0.5, 1.5]),
        ("trigonometric-functions-and-identities-08", math.sin(2 * math.asin(3 / 5))),
        ("trigonometric-functions-and-identities-09", [0.25, 0.75, 1.25, 1.75]),
        ("parametric-and-polar-curves-01", [2 * 3 - 1, 3**2 + 1]),
        (
            "parametric-and-polar-curves-02",
            [2 * math.cos(math.pi / 2), 2 * math.sin(math.pi / 2)],
        ),
        ("parametric-and-polar-curves-03", math.hypot(3, 4)),
        ("parametric-and-polar-curves-06", [3, 2]),
        ("parametric-and-polar-curves-07", [6 / 2, 0, 6 / 2]),
        ("parametric-and-polar-curves-09", 3 * 2 * math.pi / (2 * math.pi)),
        (
            "parametric-and-polar-curves-10",
            [-4 * math.cos(math.pi), -4 * math.sin(math.pi)],
        ),
        ("sequences-and-informal-limiting-behavior-01", 2 * 4**2 - 1),
        ("sequences-and-informal-limiting-behavior-02", recurrence(3, 2, -1, 2)),
        ("sequences-and-informal-limiting-behavior-03", 5 / 2),
        ("sequences-and-informal-limiting-behavior-04", 7),
        ("sequences-and-informal-limiting-behavior-07", math.floor(1 / 0.05) + 1),
        ("sequences-and-informal-limiting-behavior-08", 4 / (1 - 1 / 3)),
        ("sequences-and-informal-limiting-behavior-10", 1 / (math.sqrt(1) + 1)),
    ],
)
def test_calculus_answers_match_independent_computations(question_id, expected):
    answer = questions_for("calculus")[question_id]["answer"]
    assert answer == pytest.approx(expected)


@pytest.mark.parametrize(
    "question, submitted",
    [
        ({"kind": "vector", "answer": [1, 2]}, [99, "not-a-number"]),
        ({"kind": "matrix", "answer": [[1, 2], [3, 4]]}, [[99, 2], [3, "1/0"]]),
    ],
)
def test_malformed_later_coordinates_are_validated_even_after_a_wrong_value(question, submitted):
    correct, validation_error = grade(question, submitted)
    assert not correct
    assert validation_error is not None
