"""Independent exact-arithmetic audits of the 24 Linear Algebra alternate forms.

The fixtures below restate the mathematical inputs, not the JSON answer keys.
No application grader, database, or generated-answer helper is imported.
"""

import json
import math
from collections import Counter
from fractions import Fraction as F
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1] / "app" / "roadmaps"
BANK = json.loads((ROOT / "variants" / "linear-algebra.json").read_text(encoding="utf-8"))
ORIGINAL = json.loads((ROOT / "curriculum" / "linear-algebra.json").read_text(encoding="utf-8"))
FORMS = {question["family_id"]: question for question in BANK["forms"]}


def vector(values):
    return tuple(F(value) for value in values)


def add(*vectors):
    return tuple(sum(coordinates, F(0)) for coordinates in zip(*vectors, strict=True))


def scale(coefficient, values):
    return tuple(F(coefficient) * value for value in values)


def dot(left, right):
    return sum((F(a) * F(b) for a, b in zip(left, right, strict=True)), F(0))


def matrix(rows):
    return tuple(vector(row) for row in rows)


def transpose(rows):
    return tuple(zip(*rows, strict=True))


def product(left, right):
    assert len(left[0]) == len(right)
    return tuple(tuple(dot(row, column) for column in transpose(right)) for row in left)


def apply(rows, values):
    return tuple(dot(row, values) for row in rows)


def inverse_2x2(rows):
    (a, b), (c, d) = matrix(rows)
    determinant = a * d - b * c
    assert determinant != 0
    return ((d / determinant, -b / determinant), (-c / determinant, a / determinant))


def solve_2x2(rows, target):
    return apply(inverse_2x2(rows), vector(target))


def projection(values, direction):
    return scale(dot(values, direction) / dot(direction, direction), vector(direction))


def projection_matrix(direction):
    values = vector(direction)
    denominator = dot(values, values)
    return tuple(tuple(a * b / denominator for b in values) for a in values)


def unique_true(options):
    selected = [label for label, condition in options.items() if condition]
    assert len(selected) == 1
    return selected[0]


SPAN_OPTIONS = {
    "$(2,3,5)$": (2, 3, 5),
    "$(-1,2,1)$": (-1, 2, 1),
    "$(0,0,1)$": (0, 0, 1),
    "$(4,-1,3)$": (4, -1, 3),
}
SPAN_OUTSIDE = unique_true({label: z != x + y for label, (x, y, z) in SPAN_OPTIONS.items()})

A_SHAPE, B_SHAPE = (2, 3), (3, 2)
AB_SHAPE = (A_SHAPE[0], B_SHAPE[1]) if A_SHAPE[1] == B_SHAPE[0] else None
BA_SHAPE = (B_SHAPE[0], A_SHAPE[1]) if B_SHAPE[1] == A_SHAPE[0] else None
SHAPE_OPTIONS = {
    r"$AB$ exists, but $BA$ is undefined.": AB_SHAPE is not None and BA_SHAPE is None,
    r"$AB$ is $3\times3$ and $BA$ is $2\times2$.": AB_SHAPE == (3, 3) and BA_SHAPE == (2, 2),
    r"$AB$ is $2\times2$ and $BA$ is $3\times3$.": AB_SHAPE == (2, 2) and BA_SHAPE == (3, 3),
    r"Both products are $2\times2$.": AB_SHAPE == BA_SHAPE == (2, 2),
}

IMAGE_DIRECTION = vector((1, -2, 3))
IMAGE_OPTIONS = {
    r"All of $\mathbb R^3$.": False,
    r"The line $\{(t,2t,3t):t\in\mathbb R\}$.": IMAGE_DIRECTION == vector((1, 2, 3)),
    r"The line $\{(t,-2t,3t):t\in\mathbb R\}$.": IMAGE_DIRECTION == vector((1, -2, 3)),
    r"The line $\{(t,-2t,0):t\in\mathbb R\}$.": IMAGE_DIRECTION == vector((1, -2, 0)),
}

AFFINE_CHOICE = r"$F(x,y)=(x+2y,3y-5)$."
AFFINE_OPTIONS = {
    r"$F(x,y)=(xy,y)$.": False,
    r"$F(x,y)=(x+2y,3y)$.": any(vector((0, 0))),
    AFFINE_CHOICE: any(vector((0, -5))),
    r"$F(x,y)=(|x|,y)$.": False,
}

v = "vector-arithmetic-and-linear-combinations"
d = "dot-products-norms-and-angles"
m = "matrix-arithmetic"
t = "linear-transformations-in-coordinates"
g = "rotations-reflections-projections-and-shears"
a = "affine-versus-linear-maps"

# Every expected value is independently calculated from the inputs in the prompt.
EXPECTED = {
    f"{v}-01": add(scale(2, vector((1, -2, 3))), scale(3, vector((2, 1, -1)))),
    f"{v}-02": solve_2x2(((1, 3), (2, -1)), (7, 0)),
    f"{v}-03": SPAN_OUTSIDE,
    f"{v}-08": scale(F(1, 3), add(vector((1, 4, 2)), scale(-1, vector((2, -1, 5))))),
    f"{d}-02": math.sqrt(dot((2, -4, 3), (2, -4, 3))),
    f"{d}-04": -F(2 * 3 + 1 * 4, -2),
    f"{d}-05": math.degrees(
        math.acos(dot((1, 0), (-1, math.sqrt(3))) / (1 * math.hypot(-1, math.sqrt(3))))
    ),
    f"{d}-06": projection((3, 4), (2, -1)),
    f"{m}-02": tuple(
        add(scale(3, row_a), scale(2, row_b))
        for row_a, row_b in zip(
            matrix(((1, -1, 0), (2, 3, -2))),
            matrix(((0, 2, 1), (-1, 0, 4))),
            strict=True,
        )
    ),
    f"{m}-03": product(matrix(((1, 0, 2), (-1, 3, 1))), matrix(((2, 1), (0, -2), (1, 4)))),
    f"{m}-05": transpose(matrix(((2,), (-3,), (5,)))),
    f"{m}-08": unique_true(SHAPE_OPTIONS),
    f"{t}-01": transpose(matrix(((1, -1), (2, 0), (-3, 4)))),
    f"{t}-04": apply(matrix(((1, 2), (0, 1))), apply(matrix(((0, 1), (1, 0))), (1, -2))),
    f"{t}-05": -F(-1 + 3 * (-1), 2),
    f"{t}-06": unique_true(IMAGE_OPTIONS),
    f"{g}-01": apply(inverse_2x2(((0, -1), (1, 0))), (5, -2)),
    f"{g}-02": apply(
        tuple(
            tuple(2 * entry - int(i == j) for j, entry in enumerate(row))
            for i, row in enumerate(projection_matrix((1, -1)))
        ),
        (-3, 2),
    ),
    f"{g}-05": inverse_2x2(((1, 0), (3, 1))),
    f"{g}-06": projection_matrix((2, -1)),
    f"{a}-01": unique_true(AFFINE_OPTIONS),
    f"{a}-05": apply(matrix(((2, -1), (1, 3))), add((4, -1), scale(-1, (1, 2)))),
    f"{a}-06": solve_2x2(((1, 1), (2, -1)), add((4, 3), scale(-1, (1, 3)))),
    f"{a}-08": matrix(((3, -2, 1), (2, 4, -5), (0, 0, 1))),
}


def assert_answer(actual: Any, expected: Any):
    if isinstance(expected, tuple):
        assert isinstance(actual, list) and len(actual) == len(expected)
        for value, wanted in zip(actual, expected, strict=True):
            assert_answer(value, wanted)
    elif isinstance(expected, str):
        assert actual == expected
    else:
        assert type(actual) in (int, float)
        assert actual == pytest.approx(float(expected), rel=1e-10, abs=1e-10)


def test_twenty_four_forms_cover_four_taught_nonproof_families_per_lesson():
    assert BANK["version"] == 1 and BANK["roadmap_slug"] == "linear-algebra"
    assert len(BANK["forms"]) == len(FORMS) == len(EXPECTED) == 24
    assert set(FORMS) == set(EXPECTED)
    base = {
        question["id"]: (lesson["topic_slug"], question)
        for lesson in ORIGINAL["lessons"]
        for question in lesson["questions"]
    }
    coverage = Counter()
    for family, form in FORMS.items():
        topic, original = base[family]
        coverage[topic] += 1
        assert form["id"] == family + "--alt-01"
        assert form["exam"] is original["exam"] is False
        assert original["kind"] != "proof"
        for field in ("kind", "concept", "difficulty"):
            assert form[field] == original[field]
        assert len(form["hints"]) >= 2
    assert coverage == {lesson["topic_slug"]: 4 for lesson in ORIGINAL["lessons"]}


@pytest.mark.parametrize("family", EXPECTED)
def test_each_answer_matches_an_independent_mathematical_calculation(family):
    assert_answer(FORMS[family]["answer"], EXPECTED[family])


def test_span_choices_have_exactly_one_unreachable_vector():
    assert set(FORMS[f"{v}-03"]["choices"]) == set(SPAN_OPTIONS)
    for label, target in SPAN_OPTIONS.items():
        coefficients = target[:2]
        reconstructed = add(scale(coefficients[0], (1, 0, 1)), scale(coefficients[1], (0, 1, 1)))
        assert (reconstructed != vector(target)) == (label == SPAN_OUTSIDE)


def test_dimension_choices_and_image_choices_exclude_every_distractor():
    assert set(FORMS[f"{m}-08"]["choices"]) == set(SHAPE_OPTIONS)
    assert set(FORMS[f"{t}-06"]["choices"]) == set(IMAGE_OPTIONS)
    assert sum(SHAPE_OPTIONS.values()) == sum(IMAGE_OPTIONS.values()) == 1
    image_matrix = matrix(((1, -1), (-2, 2), (3, -3)))
    assert transpose(image_matrix) == (IMAGE_DIRECTION, scale(-1, IMAGE_DIRECTION))
    for scalar in (-3, F(1, 2), 0, 4):
        assert apply(image_matrix, (scalar, 0)) == scale(scalar, IMAGE_DIRECTION)
    # Every output is perpendicular to this normal; the omitted vector is not.
    assert all(dot(column, (2, 1, 0)) == 0 for column in transpose(image_matrix))
    assert dot((0, 1, 0), (2, 1, 0)) != 0


def test_affine_choice_is_unique_with_explicit_nonlinear_counterexamples():
    assert set(FORMS[f"{a}-01"]["choices"]) == set(AFFINE_OPTIONS)
    linear_part = matrix(((1, 2), (0, 3)))
    translation = vector((0, -5))
    assert any(translation)
    assert add(apply(linear_part, (0, 0)), translation) == translation
    # The other affine candidate has zero translation and is linear.
    assert apply(linear_part, (0, 0)) == vector((0, 0))

    def product_map(x, y):
        return x * y, y

    def absolute_map(x, y):
        return abs(x), y

    assert product_map(0, 0) == absolute_map(0, 0) == (0, 0)
    assert vector(product_map(2, 2)) != scale(2, product_map(1, 1))
    assert vector(absolute_map(-1, 0)) != scale(-1, absolute_map(1, 0))


def test_projection_keys_fix_the_line_remove_its_normal_and_minimize_distance():
    projection_key = projection_matrix((2, -1))
    assert transpose(projection_key) == projection_key
    assert product(projection_key, projection_key) == projection_key
    assert apply(projection_key, (2, -1)) == vector((2, -1))
    assert apply(projection_key, (1, 2)) == vector((0, 0))
    projected = projection((3, 4), (2, -1))
    residual = add((3, 4), scale(-1, projected))
    assert dot(residual, (2, -1)) == 0
    for coefficient in (-2, -1, 0, 1, 2, F(2, 5)):
        error = add((3, 4), scale(-coefficient, (2, -1)))
        assert dot(error, error) >= dot(residual, residual)


def test_inverse_composition_and_homogeneous_keys_pass_independent_round_trips():
    identity = matrix(((1, 0), (0, 1)))
    shear = matrix(((1, 0), (3, 1)))
    inverse = EXPECTED[f"{g}-05"]
    assert product(shear, inverse) == product(inverse, shear) == identity
    assert apply(matrix(((0, -1), (1, 0))), EXPECTED[f"{g}-01"]) == vector((5, -2))
    preimage = EXPECTED[f"{a}-06"]
    assert add(apply(matrix(((1, 1), (2, -1))), preimage), (1, 3)) == vector((4, 3))
    # Direct affine formulas independently verify the homogeneous encoding.
    for x, y in ((0, 0), (2, -1), (-3, 4)):
        assert apply(EXPECTED[f"{a}-08"], (x, y, 1)) == vector(
            (3 * x - 2 * y + 1, 2 * x + 4 * y - 5, 1)
        )
