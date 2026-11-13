"""Independently enumerate the mathematics of all 48 authored alternate forms."""

from __future__ import annotations

import ast
import json
import math
import re
from collections import Counter
from fractions import Fraction
from functools import cache
from itertools import combinations, permutations, product
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1] / "app" / "roadmaps"
SLUGS = ("probability", "discrete-math")
FORMS = {
    (slug, form["family_id"]): form
    for slug in SLUGS
    for form in json.loads((ROOT / "variants" / f"{slug}.json").read_text(encoding="utf-8"))[
        "forms"
    ]
}


def form(slug, family):
    return FORMS[slug, family]


def probability(family):
    return form("probability", family)


def discrete(family):
    return form("discrete-math", family)


def compositions(total, length):
    if length == 1:
        yield (total,)
        return
    for first in range(total + 1):
        for rest in compositions(total - first, length - 1):
            yield (first, *rest)


def implication(left, right):
    return not left or right


BOOL2 = list(product((False, True), repeat=2))
BOOL3 = list(product((False, True), repeat=3))


def rotate_canonical(values):
    return min(values[index:] + values[:index] for index in range(len(values)))


def ticket_classes():
    possibilities = []
    for seats in range(1, 12):
        tickets = {("standard", time, seat) for time in range(3) for seat in range(2)}
        tickets |= {("premium", time, seat) for time in range(4) for seat in range(seats)}
        if len(tickets) == 22:
            possibilities.append(seats)
    assert possibilities == [4]
    return possibilities[0]


def circular_factor():
    arrangements = set(permutations(range(6)))
    rotations = {rotate_canonical(item) for item in arrangements}
    assert len(arrangements) == math.factorial(6)
    assert len(rotations) == math.factorial(5)
    return len(arrangements) // len(rotations)


def weighted_coefficient():
    terms = [word for word in product("XYZ", repeat=5) if Counter(word) == Counter("XXYYZ")]
    expanded = sum(math.prod(2 if letter == "X" else 1 for letter in word) for word in terms)
    assert expanded == math.comb(5, 2) * math.comb(3, 2) * 2**2
    return expanded


def multinomial_probability():
    probabilities = {"A": Fraction(1, 2), "B": Fraction(1, 3), "C": Fraction(1, 6)}
    assert sum(probabilities.values()) == 1
    favorable = [word for word in product("ABC", repeat=4) if Counter(word) == Counter("ABBC")]
    total = sum(
        (math.prod(probabilities[letter] for letter in word) for word in favorable), Fraction()
    )
    assert total == Fraction(math.factorial(4), math.factorial(2)) * Fraction(1, 2) * Fraction(
        1, 3
    ) ** 2 * Fraction(1, 6)
    return total


def unlabeled_hands():
    cards = frozenset(range(6))
    partitions = {
        frozenset((frozenset(hand), cards - frozenset(hand))) for hand in combinations(cards, 3)
    }
    assert len(partitions) == math.comb(6, 3) // 2
    return len(partitions)


def survey_union():
    only_a = {f"a{i}" for i in range(6)}
    only_b = {f"b{i}" for i in range(5)}
    only_c = {f"c{i}" for i in range(5)}
    ab = {f"ab{i}" for i in range(3)}
    ac = {f"ac{i}" for i in range(2)}
    bc, abc = {"bc"}, {"abc"}
    a, b, c = only_a | ab | ac | abc, only_b | ab | bc | abc, only_c | ac | bc | abc
    assert [len(a), len(b), len(c), len(a & b), len(a & c), len(b & c), len(a & b & c)] == [
        12,
        10,
        9,
        4,
        3,
        2,
        1,
    ]
    return len(a | b | c)


def overlap_from_difference():
    a, b = set(range(17)), set(range(11, 24))
    assert len(a) == 17 and len(b) == 13 and len(a ^ b) == 18
    return len(a & b)


def committee_options():
    lists = list(permutations(range(6), 4))
    multiplicities = Counter(frozenset(item) for item in lists)
    assert len(lists) == 360
    uniform = set(multiplicities.values())
    return [
        uniform == {math.factorial(4)} and len(multiplicities) == 15,
        uniform == {4} and len(multiplicities) == 90,
        len(multiplicities) == 360,
        all(len(group) == 6 for group in multiplicities),
    ]


def stars_word_options():
    decoded = tuple(region.count("*") for region in "**||*|".split("|"))
    choices = probability("stars-and-bars-08")["choices"]
    return [ast.literal_eval(choice) == decoded for choice in choices]


def odd_part(number):
    while number % 2 == 0:
        number //= 2
    return number


def odd_part_options():
    actual = {number for number in range(1, 25) if odd_part(number) == odd_part(12)}
    return [
        ast.literal_eval(choice) == actual
        for choice in probability("pigeonhole-principle-05")["choices"]
    ]


def pair_threshold_options():
    numbers = range(1, 17)

    def safe(group):
        return not any(a + b == 17 for a, b in combinations(group, 2))

    safe_eight = [group for group in combinations(numbers, 8) if safe(group)]
    safe_nine = [group for group in combinations(numbers, 9) if safe(group)]
    pair_at_two = all(not safe(group) for group in combinations(numbers, 2))
    return [bool(safe_eight) and not safe_nine, not safe_eight, pair_at_two, bool(safe_nine)]


def implication_options():
    p, q = False, False
    value = implication(p, q)
    return [value and not p, not value and not q, value == (p and q), not isinstance(value, bool)]


def converse_options():
    domain = range(-12, 13)

    def original(n):
        return implication(n % 4 == 0, n % 2 == 0)

    def converse(n):
        return implication(n % 2 == 0, n % 4 == 0)

    def contrapositive(n):
        return implication(n % 2 != 0, n % 4 != 0)

    return [
        not converse(2),
        all(original(n) == converse(n) for n in domain),
        not contrapositive(2),
        all(n % 4 == 0 for n in domain if n % 2 == 0),
    ]


def de_morgan_options():
    def original(p, q):
        return not ((not p) and q)

    candidates = [
        lambda p, q: p or not q,
        lambda p, q: not p and not q,
        lambda p, q: p and not q,
        lambda p, q: not p or q,
    ]
    return [all(candidate(p, q) == original(p, q) for p, q in BOOL2) for candidate in candidates]


def counterexample_options():
    differing = {q for q in (False, True) if (not (False and q)) != ((not False) and (not q))}
    return [differing == {True}, differing == {False}, not differing, differing == {False, True}]


def nested_negation_options():
    agreements = [True] * 4
    for bits in product((False, True), repeat=4):
        relation = (bits[:2], bits[2:])
        negated_original = not all(any(row) for row in relation)
        candidates = [
            any(all(not entry for entry in row) for row in relation),
            all(not entry for row in relation for entry in row),
            any(not entry for row in relation for entry in row),
            any(all(row) for row in relation),
        ]
        agreements = [
            prior and candidate == negated_original
            for prior, candidate in zip(agreements, candidates, strict=True)
        ]
    assert all(n * n >= 0 for n in range(-20, 21))
    return agreements


def uniform_counterexample_options():
    candidates = [lambda y: -y - 1, lambda y: y + 1, lambda y: 1, lambda y: y * y + 1]
    domain = [Fraction(n, 2) for n in range(-20, 21)]
    return [all(candidate(y) + y <= 0 for y in domain) for candidate in candidates]


def connective_negation_options():
    agreements = [True] * 4
    for bits in product((False, True), repeat=4):
        p, q = bits[:2], bits[2:]
        target = not all(a or b for a, b in zip(p, q, strict=True))
        both_false = [not a and not b for a, b in zip(p, q, strict=True)]
        one_false = [not a or not b for a, b in zip(p, q, strict=True)]
        candidates = [any(both_false), all(both_false), any(one_false), all(one_false)]
        agreements = [
            prior and candidate == target
            for prior, candidate in zip(agreements, candidates, strict=True)
        ]
    return agreements


def parity_identity_options():
    candidates = [
        lambda a, b: 2 * (a + b) + 1,
        lambda a, b: 2 * (a + b),
        lambda a, b: 2 * (a + b + 1),
        lambda a, b: 2 * a * b + 1,
    ]
    assignments = list(product(range(-4, 5), repeat=2))
    assert all((2 * a + 2 * b + 1) % 2 == 1 for a, b in assignments)
    return [
        all(candidate(a, b) == 2 * a + (2 * b + 1) for a, b in assignments)
        for candidate in candidates
    ]


def contrapositive_options():
    # Treat the three atomic propositions independently to check the exact logical form,
    # rather than accepting a different arithmetic theorem that happens to be true.
    candidates = [
        lambda h, a, b: implication(not a or not b, not h),
        lambda h, a, b: implication(not a and not b, not h),
        lambda h, a, b: implication(not h, not a and not b),
        lambda h, a, b: implication(a and b, h),
    ]
    return [
        all(candidate(h, a, b) == implication(h, a and b) for h, a, b in BOOL3)
        for candidate in candidates
    ]


def contradiction_options():
    pairs = [(a, b) for a in range(-12, 13) for b in range(-12, 13) if b and a % 2 == b % 2 == 0]
    assert all(math.gcd(a, b) >= 2 for a, b in pairs)
    assumptions = [
        lambda a, b: math.gcd(a, b) == 1,
        lambda a, b: a > 0 and b > 0,
        lambda a, b: b != 0,
        lambda a, b: a > b,
    ]
    return [not any(assumption(a, b) for a, b in pairs) for assumption in assumptions]


def base_cases():
    representable = {4 * a + 5 * b for a in range(20) for b in range(20)}
    assert all(n in representable for n in range(12, 16))
    for count in range(1, 6):
        reached = {base + 4 * step for base in range(12, 12 + count) for step in range(30)}
        if all(n in reached for n in range(12, 101)):
            return count
    raise AssertionError("No complete base range")


def step_constant():
    differences = {7 ** (k + 1) - 1 - 7 * (7**k - 1) for k in range(1, 9)}
    assert len(differences) == 1
    value = differences.pop()
    assert value % 6 == 0
    return value


def tileable(region):
    if not region:
        return True
    x, y = min(region)
    return any(
        tileable(region - {(x, y), adjacent})
        for adjacent in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
        if adjacent in region
    )


def color_options():
    board = set(product(range(8), repeat=2)) - {(0, 0), (0, 1)}
    black = sum((x + y) % 2 == 0 for x, y in board)
    white = len(board) - black
    balanced_untileable = {(0, 0), (0, 3)}
    assert sum((x + y) % 2 == 0 for x, y in balanced_untileable) == 1
    countermodel = not tileable(balanced_untileable)
    return [
        black == white == 31 and countermodel,
        black != white,
        not countermodel,
        len(board) != black + white,
    ]


def flip_options():
    changes = set()
    for state in product((0, 1), repeat=10):
        for i, j in combinations(range(10), 2):
            changes.add((1 - state[i]) + (1 - state[j]) - state[i] - state[j])
    choices = discrete("invariants-and-extremal-arguments-03")["choices"]
    return [
        {int(value) for value in re.findall(r"[+-]?\d+", choice)} == changes for choice in choices
    ]


@cache
def move_lengths(total):
    if total == 0:
        return frozenset({0})
    return frozenset(
        1 + length for step in (1, 3) if step <= total for length in move_lengths(total - step)
    )


def move_parity_options():
    lengths = move_lengths(18 - 5)
    assert lengths == {5, 7, 9, 11, 13}
    return [
        all(value % 2 == 1 for value in lengths),
        all(value % 2 == 0 for value in lengths),
        lengths == {13},
        not lengths,
    ]


@cache
def longest_potential_path(value):
    return max(
        (1 + longest_potential_path(next_value) for next_value in range(2, value - 2)), default=0
    )


NUMERICAL = {
    ("probability", "sum-and-product-rules-04"): lambda: sum(
        word[0] != 0 for word in permutations(range(4))
    ),
    ("probability", "sum-and-product-rules-05"): ticket_classes,
    ("probability", "sum-and-product-rules-06"): lambda: sum(
        a % 2 == b % 2 for a, b in product(range(1, 7), repeat=2)
    ),
    ("probability", "sum-and-product-rules-08"): lambda: Fraction(
        sum(a + b == 5 for a, b in product(range(1, 7), repeat=2)), 36
    ),
    ("probability", "permutations-and-combinations-02"): lambda: sum(
        order[0] == 0 for order in permutations(range(7), 4)
    ),
    ("probability", "permutations-and-combinations-04"): circular_factor,
    ("probability", "permutations-and-combinations-06"): lambda: sum(
        word[0] == "A" for word in set(permutations("AAABB"))
    ),
    ("probability", "multinomial-coefficients-02"): weighted_coefficient,
    ("probability", "multinomial-coefficients-03"): lambda: sum(
        word[0] == 0 and [word.count(i) for i in range(3)] == [1, 2, 3]
        for word in product(range(3), repeat=6)
    ),
    ("probability", "multinomial-coefficients-05"): multinomial_probability,
    ("probability", "multinomial-coefficients-06"): unlabeled_hands,
    ("probability", "stars-and-bars-04"): lambda: sum(
        a + b <= 4 for a, b in product(range(5), repeat=2)
    ),
    ("probability", "stars-and-bars-05"): lambda: sum(x <= 1 for x, _y, _z in compositions(7, 3)),
    ("probability", "stars-and-bars-07"): lambda: sum(
        parts.count(0) == 1 for parts in compositions(7, 4)
    ),
    ("probability", "inclusion-exclusion-02"): lambda: len(
        {n for n in range(1, 91) if n % 4 == 0 or n % 6 == 0}
    ),
    ("probability", "inclusion-exclusion-04"): survey_union,
    ("probability", "inclusion-exclusion-06"): lambda: sum(
        len(set(word)) == 3 for word in product(range(3), repeat=4)
    ),
    ("probability", "inclusion-exclusion-07"): overlap_from_difference,
    ("probability", "pigeonhole-principle-03"): lambda: min(
        max(parts) for parts in compositions(23, 5)
    ),
    ("probability", "pigeonhole-principle-04"): lambda: (
        max(
            len(group)
            for size in range(8)
            for group in combinations(range(14), size)
            if len({n % 7 for n in group}) == len(group)
        )
        + 1
    ),
    ("discrete-math", "propositional-and-predicate-logic-03"): lambda: sum(
        x * x <= 1 for x in (-2, -1, 0, 1, 2)
    ),
    ("discrete-math", "propositional-and-predicate-logic-07"): lambda: min(
        n for n in range(10) if n * n > 20
    ),
    ("discrete-math", "truth-tables-and-logical-equivalence-02"): lambda: sum(
        not (p != q) for p, q, _r in BOOL3
    ),
    ("discrete-math", "truth-tables-and-logical-equivalence-03"): lambda: sum(
        p == q and q == r for p, q, r in BOOL3
    ),
    ("discrete-math", "quantifiers-and-nested-negation-04"): lambda: sum(
        x + y == 3 for x, y in product(range(4), repeat=2)
    ),
    ("discrete-math", "direct-contrapositive-and-contradiction-proofs-06"): lambda: min(
        n for n in range(1, 20) if not implication(n * n % 3 == 0, n % 9 == 0)
    ),
    ("discrete-math", "induction-and-strong-induction-01"): lambda: sum(range(21, 41)),
    ("discrete-math", "induction-and-strong-induction-02"): lambda: next(
        n for n in range(1, 20) if sum(range(1, 2 * n, 2)) == 121
    ),
    ("discrete-math", "induction-and-strong-induction-04"): base_cases,
    ("discrete-math", "induction-and-strong-induction-08"): step_constant,
    ("discrete-math", "invariants-and-extremal-arguments-08"): lambda: longest_potential_path(17),
}
CHOICES = {
    ("probability", "permutations-and-combinations-08"): committee_options,
    ("probability", "stars-and-bars-08"): stars_word_options,
    ("probability", "pigeonhole-principle-05"): odd_part_options,
    ("probability", "pigeonhole-principle-08"): pair_threshold_options,
    ("discrete-math", "propositional-and-predicate-logic-01"): implication_options,
    ("discrete-math", "propositional-and-predicate-logic-04"): converse_options,
    ("discrete-math", "truth-tables-and-logical-equivalence-04"): de_morgan_options,
    ("discrete-math", "truth-tables-and-logical-equivalence-08"): counterexample_options,
    ("discrete-math", "quantifiers-and-nested-negation-01"): nested_negation_options,
    ("discrete-math", "quantifiers-and-nested-negation-03"): uniform_counterexample_options,
    ("discrete-math", "quantifiers-and-nested-negation-06"): connective_negation_options,
    ("discrete-math", "direct-contrapositive-and-contradiction-proofs-01"): parity_identity_options,
    ("discrete-math", "direct-contrapositive-and-contradiction-proofs-02"): contrapositive_options,
    ("discrete-math", "direct-contrapositive-and-contradiction-proofs-03"): contradiction_options,
    ("discrete-math", "invariants-and-extremal-arguments-02"): color_options,
    ("discrete-math", "invariants-and-extremal-arguments-03"): flip_options,
    ("discrete-math", "invariants-and-extremal-arguments-07"): move_parity_options,
}


@pytest.mark.parametrize("key", NUMERICAL, ids=lambda key: "/".join(key))
def test_every_numerical_variant_by_independent_enumeration(key):
    actual = FORMS[key]
    assert actual["kind"] == "number"
    expected = NUMERICAL[key]()
    if isinstance(expected, Fraction):
        assert math.isclose(actual["answer"], float(expected), rel_tol=0, abs_tol=1e-12)
    else:
        assert type(actual["answer"]) is int
        assert actual["answer"] == expected


@pytest.mark.parametrize("key", CHOICES, ids=lambda key: "/".join(key))
def test_every_choice_variant_has_exactly_one_mathematically_correct_option(key):
    actual = FORMS[key]
    assert actual["kind"] == "choice"
    outcomes = CHOICES[key]()
    assert len(outcomes) == len(actual["choices"])
    assert sum(bool(value) for value in outcomes) == 1
    winner = next(index for index, value in enumerate(outcomes) if value)
    assert actual["answer"] == actual["choices"][winner]


def test_independent_math_checks_cover_all_48_forms_without_self_grading():
    assert set(NUMERICAL).isdisjoint(CHOICES)
    assert set(NUMERICAL) | set(CHOICES) == set(FORMS)
    assert len(FORMS) == 48


@pytest.mark.parametrize("slug", SLUGS)
def test_four_distinct_nonproof_practice_families_per_lesson_preserve_canonical_metadata(slug):
    catalogue = json.loads((ROOT / "curriculum" / f"{slug}.json").read_text(encoding="utf-8"))
    canonical = {
        question["id"]: question
        for lesson in catalogue["lessons"]
        for question in lesson["questions"]
    }
    chosen = [value for (roadmap, _family), value in FORMS.items() if roadmap == slug]
    assert len(chosen) == 24
    for lesson in catalogue["lessons"]:
        ids = {question["id"] for question in lesson["questions"]}
        families = {value["family_id"] for value in chosen if value["family_id"] in ids}
        assert len(families) == 4
    for value in chosen:
        base = canonical[value["family_id"]]
        assert base["exam"] is False and base["kind"] != "proof"
        assert value["id"] == value["family_id"] + "--alt-01"
        assert value["exam"] is False
        assert value["prompt"] != base["prompt"]
        assert all(value[field] == base[field] for field in ("kind", "concept", "difficulty"))
        assert len(value["hints"]) >= 2 and all(
            isinstance(hint, str) and hint.strip() for hint in value["hints"]
        )
        assert value["solution"].strip()
