"""Independent mathematics for every owned authored alternate form.

These checks derive keys from the quantities printed in the prompts. They do
not call the application grader or read an answer in order to compute it.
"""

import itertools
import json
import math
from collections import Counter
from fractions import Fraction as F
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1] / "app" / "roadmaps"
SUBJECTS = ("calculus", "real-analysis")
BANKS = {
    subject: json.loads((ROOT / "variants" / f"{subject}.json").read_text(encoding="utf-8"))
    for subject in SUBJECTS
}
QUESTIONS = {item["family_id"]: item for bank in BANKS.values() for item in bank["forms"]}


def iterate(initial, update, steps):
    value = initial
    for _ in range(steps):
        value = update(value)
    return value


def divide_by_linear(coefficients, root):
    """Synthetic division of a descending coefficient list by x-root."""
    result = [F(coefficients[0])]
    for coefficient in coefficients[1:]:
        result.append(F(coefficient) + root * result[-1])
    return result


def positive_sqrt(value):
    value = F(value)
    numerator, denominator = math.isqrt(value.numerator), math.isqrt(value.denominator)
    assert numerator**2 == value.numerator and denominator**2 == value.denominator
    return F(numerator, denominator)


def pairs_through(sum_limit):
    return [(i, diagonal - i) for diagonal in range(2, sum_limit + 1) for i in range(1, diagonal)]


def case(topic, number, expected, *fragments):
    return pytest.param(f"{topic}-{number:02d}", expected, fragments, id=f"{topic}-{number:02d}")


CALCULUS_CASES = [
    case(
        "function-composition-and-inverses",
        1,
        (lambda u: 3 * u - 4)(5),
        "g(-2)=5",
        "f(u)=3u-4",
        r"(f\circ g)(-2)",
    ),
    case("function-composition-and-inverses", 3, 4 * (-2) + 6, "h(x)=(x-6)/4", r"h^{-1}(-2)"),
    case(
        "function-composition-and-inverses",
        5,
        sorted([(2 - positive_sqrt(16)) / 2, (2 + positive_sqrt(16)) / 2]),
        "f(u)=1/(u-3)",
        "g(x)=x^2-2x",
        "increasing order",
    ),
    case("function-composition-and-inverses", 7, F(5 + 2, 5 - 3), "(3x+2)/(x-1)", r"f^{-1}(5)"),
    case("polynomial-and-rational-behavior", 1, 2 * 2, "x=2", "(x^2-4x+4)^2(x+3)"),
    case("polynomial-and-rational-behavior", 3, F(-9, 6), "(-9x^3+2)/(6x^3-x^2+1)", r"x\to-\infty"),
    case("polynomial-and-rational-behavior", 4, [-3, -3 - 2], "(x^2+x-6)/(x+3)", "hole"),
    case(
        "polynomial-and-rational-behavior",
        7,
        divide_by_linear([2, 3, -4], F(-2)),
        "(2x^2+3x-4)/(x+2)",
        "[a,b,r]",
    ),
    case(
        "exponential-and-logarithmic-functions",
        1,
        next(power for power in range(-10, 11) if F(1, 2) ** power == 8),
        r"\log_{1/2}8",
    ),
    case(
        "exponential-and-logarithmic-functions",
        5,
        F(1, 2) ** (12 // 4),
        "doubles every four years",
        "present amount",
        "twelve years earlier",
    ),
    case(
        "exponential-and-logarithmic-functions",
        8,
        120 * positive_sqrt(F(30, 120)),
        "120e^{kt}",
        "A(4)=30",
        "A(2)",
    ),
    case(
        "trigonometric-functions-and-identities",
        1,
        -F(3, 4) * 2,
        "three quarters",
        "clockwise",
        "negative",
    ),
    case(
        "trigonometric-functions-and-identities",
        3,
        -F(math.isqrt(13**2 - 5**2), 13),
        r"\sin\theta=-5/13",
        "quadrant III",
        r"\cos\theta",
    ),
    case(
        "trigonometric-functions-and-identities",
        5,
        F(2) / F(3, 2),
        r"-4\sin(3x/2+\pi/5)+2",
        "fundamental period",
    ),
    case(
        "trigonometric-functions-and-identities",
        6,
        [
            F(k, 6)
            for k in range(12)
            if math.isclose(2 * math.sin(k * math.pi / 6), math.sqrt(3), abs_tol=1e-12)
        ],
        r"2\sin\theta=\sqrt3",
        r"[0,2\pi)",
        "increasing order",
    ),
    case(
        "parametric-and-polar-curves",
        1,
        [5 - 2 * (-2), (-2 + 1) ** 2],
        "x(t)=5-2t",
        "y(t)=(t+1)^2",
        "t=-2",
    ),
    case("parametric-and-polar-curves", 2, [-4 * (-1), -4 * 0], r"(-4,\pi)", "signed polar"),
    case(
        "parametric-and-polar-curves",
        7,
        [0, F(-8, 2), abs(F(-8, 2))],
        r"r=-8\sin\theta",
        "[center_x,center_y,radius]",
    ),
    case(
        "sequences-and-informal-limiting-behavior",
        2,
        iterate(4, lambda value: 3 * value - 2, 3),
        "a_1=4",
        "a_{n+1}=3a_n-2",
        "a_4",
    ),
    case("sequences-and-informal-limiting-behavior", 3, F(4, -2), "(4n^2-n+7)/(-2n^2+3n+1)"),
    case(
        "sequences-and-informal-limiting-behavior",
        7,
        next(n for n in range(1, 100) if F(3, 2 * n + 1) < F(1, 10)),
        "smallest positive integer",
        "|3/(2n+1)|<1/10",
    ),
    case(
        "sequences-and-informal-limiting-behavior",
        8,
        F(12) / (1 + F(1, 2)),
        "a_1=10",
        "a_{n+1}=-a_n/2+12",
    ),
]

ANALYSIS_CASES = [
    case(
        "propositions-quantifiers-and-negation",
        2,
        sum((x - 1) ** 2 <= 4 for x in (-3, -2, -1, 0, 1, 2, 3, 4)),
        r"\{-3,-2,-1,0,1,2,3,4\}",
        "(x-1)^2\\le4",
    ),
    case(
        "propositions-quantifiers-and-negation",
        7,
        next(x for x in range(10) if (x - 3) ** 2 < 4),
        "nonnegative INTEGER",
        "(x-3)^2\\ge4",
    ),
    case(
        "direct-contrapositive-and-contradiction-proofs",
        2,
        next(n for n in range(1, 100) if 2**n < n * n),
        "smallest positive integer",
        "2^n\\ge n^2",
    ),
    case(
        "direct-contrapositive-and-contradiction-proofs",
        5,
        ((2 * 1 + 1) * (2 * 1 - 1) - 1) // 2,
        "(2k+1)(2k-1)=2m+1",
        "m=ak^2+b",
        "a+b",
    ),
    case("induction-and-recursive-arguments", 1, sum(range(6, 16)), r"6+7+\cdots+15"),
    case("induction-and-recursive-arguments", 2, sum(3**j for j in range(6)), r"\sum_{j=0}^{5}3^j"),
    case(
        "induction-and-recursive-arguments",
        5,
        iterate(-2, lambda value: -2 * value, 5),
        "b_0=-2",
        "b_{n+1}=-2b_n",
        "b_5",
    ),
    case(
        "induction-and-recursive-arguments",
        7,
        5 - F(-4, 1 - 3),
        "a_1=5",
        "a_{n+1}=3a_n-4",
        r"c\,3^{n-1}+2",
    ),
    case(
        "sets-functions-images-and-preimages",
        1,
        len({abs(x - 1) for x in (-2, -1, 0, 1, 2, 3, 4)}),
        r"\{-2,-1,0,1,2,3,4\}",
        "f(x)=|x-1|",
    ),
    case(
        "sets-functions-images-and-preimages",
        2,
        sorted(F(3 - y, 2) for y in (-5, 1, 7)),
        "f(x)=3-2x",
        r"\{-5,1,7\}",
        "increasing order",
    ),
    case(
        "sets-functions-images-and-preimages",
        3,
        [0, max((-2 - 1) ** 2, (3 - 1) ** 2)],
        "f(x)=(x-1)^2",
        r"f([-2,3])",
    ),
    case(
        "countability-and-diagonal-arguments",
        2,
        sum(bool(mask & 1) and not (mask & 2) for mask in range(1 << 8)),
        "eight-element",
        "distinct",
        "contain $a$ and exclude $b$",
    ),
    case(
        "countability-and-diagonal-arguments",
        4,
        list(pairs_through(7)[11]),
        "twelfth",
        "increasing $i+j$",
        "increasing $i$",
    ),
    case(
        "countability-and-diagonal-arguments",
        6,
        [
            1 - int(row[index])
            for index, row in enumerate(("10100", "10011", "01101", "01010", "11100"))
        ],
        "$10100$, $10011$, $01101$, $01010$, and $11100$",
        "first five bits",
    ),
    case("suprema-infima-and-order", 1, max(F(2), F(5, 2)), r"[-4,2)\cup\{5/2\}"),
    case("suprema-infima-and-order", 2, F(2), "2+5/n", "positive integers"),
    case(
        "suprema-infima-and-order",
        4,
        [min(-math.isqrt(9), F(7, 2), F(-1, 4)), max(-math.isqrt(9), F(7, 2), F(-1, 4))],
        r"\{-\sqrt9,\,7/2,\,-1/4\}",
    ),
    case(
        "suprema-infima-and-order", 6, [5 - 3 * 4, 5 - 3 * (-3)], r"\inf S=-3", r"\sup S=4", "5-3s"
    ),
]


@pytest.mark.parametrize("family,expected,fragments", CALCULUS_CASES + ANALYSIS_CASES)
def test_independently_calculated_numeric_and_vector_keys_match_printed_problem(
    family, expected, fragments
):
    question = QUESTIONS[family]
    assert all(fragment in question["prompt"] for fragment in fragments)
    if isinstance(expected, list):
        assert question["answer"] == pytest.approx([float(value) for value in expected], abs=1e-12)
    else:
        assert question["answer"] == pytest.approx(float(expected), abs=1e-12)


def check_choices(question, labels, valid):
    assert question["choices"] == labels
    assert len(labels) == len(set(labels)) == len(valid)
    assert sum(valid) == 1
    assert question["answer"] == labels[valid.index(True)]


def test_log_domain_choice_by_exact_sign_chart():
    question = QUESTIONS["exponential-and-logarithmic-functions-04"]
    assert r"\ln((x-2)(x+1))" in question["prompt"]
    points = [F(-4), F(-2), F(-1), F(-1, 2), F(0), F(1), F(2), F(5, 2), F(3)]
    actual = [(x - 2) * (x + 1) > 0 for x in points]
    predicates = [
        lambda x: x < -1 or x > 2,
        lambda x: x <= -1 or x >= 2,
        lambda x: -1 < x < 2,
        lambda x: x > 2,
    ]
    check_choices(
        question,
        [r"$x<-1$ or $x>2$", r"$x\le-1$ or $x\ge2$", r"$-1<x<2$", r"$x>2$ only"],
        [
            all(predicate(x) == value for x, value in zip(points, actual, strict=True))
            for predicate in predicates
        ],
    )


def test_signed_polar_choice_has_one_equivalent_point_and_distinct_distractors():
    question = QUESTIONS["parametric-and-polar-curves-04"]
    assert r"(3,-\pi/6)" in question["prompt"]
    target = (3 * math.cos(-math.pi / 6), 3 * math.sin(-math.pi / 6))
    candidates = [(-3, F(5, 6)), (-3, F(-1, 6)), (3, F(1, 6)), (-3, F(1, 3))]
    points = [
        (r * math.cos(float(angle) * math.pi), r * math.sin(float(angle) * math.pi))
        for r, angle in candidates
    ]
    assert len({tuple(round(value, 10) for value in point) for point in points}) == 4
    check_choices(
        question,
        [r"$(-3,5\pi/6)$", r"$(-3,-\pi/6)$", r"$(3,\pi/6)$", r"$(-3,\pi/3)$"],
        [math.dist(point, target) < 1e-12 for point in points],
    )


def test_universal_negation_choices_by_exhaustive_finite_function_countermodels():
    question = QUESTIONS["propositions-quantifiers-and-negation-03"]
    assert r"f:\mathbb R\to\mathbb R" in question["prompt"] and "f(x)>2" in question["prompt"]
    models = list(itertools.product((1, 2, 3), repeat=3))
    target = [not all(value > 2 for value in model) for model in models]
    candidates = [
        lambda xs: any(x <= 2 for x in xs),
        lambda xs: all(x <= 2 for x in xs),
        lambda xs: any(x > 2 for x in xs),
        lambda xs: all(x > 2 for x in xs),
    ]
    check_choices(
        question,
        [
            r"$\exists x\in\mathbb R:\ f(x)\le2$",
            r"$\forall x\in\mathbb R:\ f(x)\le2$",
            r"$\exists x\in\mathbb R:\ f(x)>2$",
            r"$\forall x\in\mathbb R:\ f(x)>2$",
        ],
        [[candidate(model) for model in models] == target for candidate in candidates],
    )


def test_nested_negation_choices_by_exhaustive_quantifier_truth_tables():
    question = QUESTIONS["propositions-quantifiers-and-negation-04"]
    assert r"\forall\epsilon>0\;\exists N\in\mathbb N\;\forall n\ge N" in question["prompt"]
    models = list(itertools.product(range(5), repeat=3))

    def original(xs):
        return all(
            any(all(abs(xs[n - 1] - 2) < epsilon for n in range(N, 4)) for N in (1, 2))
            for epsilon in (1, 2)
        )

    candidates = [
        lambda xs: any(
            all(any(abs(xs[n - 1] - 2) >= e for n in range(N, 4)) for N in (1, 2)) for e in (1, 2)
        ),
        lambda xs: all(
            all(any(abs(xs[n - 1] - 2) >= e for n in range(N, 4)) for N in (1, 2)) for e in (1, 2)
        ),
        lambda xs: any(
            any(all(abs(xs[n - 1] - 2) >= e for n in range(N, 4)) for N in (1, 2)) for e in (1, 2)
        ),
        lambda xs: all(
            any(all(abs(xs[n - 1] - 2) >= e for n in range(N, 4)) for N in (1, 2)) for e in (1, 2)
        ),
    ]
    target = [not original(xs) for xs in models]
    labels = [
        r"$\exists\epsilon>0\;\forall N\in\mathbb N\;\exists n\ge N:\ |a_n-2|\ge\epsilon$",
        r"$\forall\epsilon>0\;\forall N\in\mathbb N\;\exists n\ge N:\ |a_n-2|\ge\epsilon$",
        r"$\exists\epsilon>0\;\exists N\in\mathbb N\;\forall n\ge N:\ |a_n-2|\ge\epsilon$",
        r"$\forall\epsilon>0\;\exists N\in\mathbb N\;\forall n\ge N:\ |a_n-2|\ge\epsilon$",
    ]
    check_choices(
        question, labels, [[candidate(xs) for xs in models] == target for candidate in candidates]
    )


def test_parity_proof_choice_uses_an_identity_for_arbitrary_signed_integers():
    question = QUESTIONS["direct-contrapositive-and-contradiction-proofs-01"]
    assert "odd integers $2r+1$ and $2s+1$" in question["prompt"]
    pairs = list(itertools.product(range(-3, 4), repeat=2))
    right_sides = [
        lambda r, s: 2 * (r + s + 1),
        lambda r, s: 2 * (r + s) + 1,
        lambda r, s: 2 * r * s,
        lambda r, s: 2 * (r + s + 2),
    ]
    valid = [all((2 * r + 1) + (2 * s + 1) == rhs(r, s) for r, s in pairs) for rhs in right_sides]
    check_choices(
        question,
        [
            r"$(2r+1)+(2s+1)=2(r+s+1)$",
            r"$(2r+1)+(2s+1)=2(r+s)+1$",
            r"$(2r+1)+(2s+1)=2rs$",
            r"$(2r+1)+(2s+1)=2(r+s+2)$",
        ],
        valid,
    )


def test_false_implication_choice_requires_true_hypothesis_and_false_conclusion():
    question = QUESTIONS["direct-contrapositive-and-contradiction-proofs-04"]
    assert "if $x^2=16$, then $x=4$" in question["prompt"]
    inputs = (-4, 4, 0, -2)
    check_choices(
        question, ["$x=-4$", "$x=4$", "$x=0$", "$x=-2$"], [x * x == 16 and x != 4 for x in inputs]
    )


def test_image_intersection_choices_by_explicit_set_operations():
    question = QUESTIONS["sets-functions-images-and-preimages-06"]
    assert r"A=\{-2,1\}" in question["prompt"] and r"B=\{2,1\}" in question["prompt"]
    A, B = {-2, 1}, {2, 1}
    actual = ({x * x for x in A & B}, {x * x for x in A} & {x * x for x in B})
    candidates = [({1}, {1, 4}), ({1, 4}, {1, 4}), (set(), {4}), ({1, 4}, {1})]
    check_choices(
        question,
        [
            r"$\{1\}$ and $\{1,4\}$",
            r"$\{1,4\}$ and $\{1,4\}$",
            r"$\varnothing$ and $\{4\}$",
            r"$\{1,4\}$ and $\{1\}$",
        ],
        [candidate == actual for candidate in candidates],
    )


def test_negative_odd_bijection_choice_has_integer_inverse_and_rejects_other_maps():
    question = QUESTIONS["countability-and-diagonal-arguments-01"]
    assert "negative odd integers" in question["prompt"]
    for k in range(50):
        target = -(2 * k + 1)
        n = F(1 - target, 2)
        assert n.denominator == 1 and n >= 1 and 1 - 2 * n == target
    assert (-2 * 1) % 2 == 0  # second candidate leaves the target set
    assert (-(2**2)) % 2 == 0  # third candidate leaves it at n=2
    missed_target = -1
    assert F(-missed_target - 1, 2) == 0  # fourth candidate would need forbidden n=0
    check_choices(
        question,
        ["$f(n)=1-2n$", "$f(n)=-2n$", "$f(n)=-n^2$", "$f(n)=-(2n+1)$"],
        [True, False, False, False],
    )


@pytest.mark.parametrize("subject", SUBJECTS)
def test_all_owned_forms_preserve_four_distinct_taught_nonproof_families_per_lesson(subject):
    bank = BANKS[subject]
    baseline = json.loads((ROOT / "curriculum" / f"{subject}.json").read_text(encoding="utf-8"))
    original = {
        question["id"]: (lesson, question)
        for lesson in baseline["lessons"]
        for question in lesson["questions"]
    }
    assert bank["version"] == 1 and bank["roadmap_slug"] == subject and len(bank["forms"]) == 24
    counts = Counter()
    for question in bank["forms"]:
        lesson, base = original[question["family_id"]]
        counts[lesson["topic_slug"]] += 1
        assert not base["exam"] and base["kind"] != "proof"
        assert question["id"] == base["id"] + "--alt-01" and not question["exam"]
        assert all(question[key] == base[key] for key in ("kind", "concept", "difficulty"))
        assert len(question["hints"]) >= 2 and len(question["solution"]) > 100
    assert set(counts.values()) == {4} and len(counts) == 6
    assert len({question["family_id"] for question in bank["forms"]}) == 24
    assert len({question["prompt"] for question in bank["forms"]}) == 24


def test_all_48_forms_have_an_independent_numeric_or_choice_calculation():
    numeric_ids = {parameter.values[0] for parameter in CALCULUS_CASES + ANALYSIS_CASES}
    choice_ids = {family for family, question in QUESTIONS.items() if question["kind"] == "choice"}
    assert len(numeric_ids) == 40 and len(choice_ids) == 8 and len(QUESTIONS) == 48
    assert numeric_ids | choice_ids == set(QUESTIONS)


def test_sequence_infimum_and_stable_recurrence_justifications():
    for epsilon in (F(1), F(1, 2), F(1, 10), F(1, 100)):
        n = int(5 / epsilon) + 1
        assert 2 < 2 + F(5, n) < 2 + epsilon
    for index in range(1, 12):
        actual = iterate(F(10), lambda value: -value / 2 + 12, index - 1)
        assert actual == 8 + 2 * F(-1, 2) ** (index - 1)
