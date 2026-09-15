import math
from dataclasses import dataclass
from fractions import Fraction
from random import Random

from app.games.base import Difficulty


@dataclass(frozen=True)
class Problem:
    prompt: str
    answer: float
    category: str
    tolerance: float = 0.001


def generate_problem(rng: Random, difficulty: Difficulty) -> Problem:
    scale = {
        Difficulty.EASY: 12,
        Difficulty.MEDIUM: 30,
        Difficulty.HARD: 75,
        Difficulty.EXPERT: 150,
    }[difficulty]
    kind = rng.choice(
        (
            "add",
            "subtract",
            "multiply",
            "divide",
            "percent",
            "reverse_percent",
            "pnl",
            "fraction",
            "power",
            "combination",
            "expected_value",
            "weighted_average",
        )
    )
    a, b = rng.randint(2, scale), rng.randint(2, scale)
    if kind == "add":
        return Problem(f"{a} + {b}", float(a + b), "arithmetic")
    if kind == "subtract":
        return Problem(f"{max(a, b)} − {min(a, b)}", float(abs(a - b)), "arithmetic")
    if kind == "multiply":
        b = rng.randint(2, max(4, scale // 5))
        return Problem(f"{a} × {b}", float(a * b), "arithmetic")
    if kind == "divide":
        return Problem(f"{a * b} ÷ {b}", float(a), "arithmetic")
    if kind == "percent":
        pct = rng.choice((5, 10, 12.5, 15, 20, 25, 40))
        base = rng.randint(2, max(3, scale // 2)) * 20
        return Problem(f"{pct}% of {base}", pct * base / 100, "percentages")
    if kind == "reverse_percent":
        pct = rng.choice((10, 20, 25, 50))
        original = rng.randint(2, max(3, scale // 2)) * 20
        increased = original * (1 + pct / 100)
        return Problem(
            f"After a {pct}% increase, a value is {increased:g}. Original?",
            float(original),
            "percentages",
        )
    if kind == "pnl":
        qty, move = rng.randint(2, 20) * 100, rng.randint(2, 30) / 10
        return Problem(f"PnL: long {qty:,} shares, price rises ${move:g}", qty * move, "trading")
    if kind == "fraction":
        denominator = rng.choice((4, 5, 8, 10, 16, 20, 25))
        numerator = rng.randint(1, denominator - 1)
        value = float(Fraction(numerator, denominator) * 100)
        return Problem(f"{numerator}/{denominator} as a percentage", value, "fractions")
    if kind == "power":
        exponent = rng.choice((2, 3))
        base = rng.randint(2, 15 if exponent == 2 else 7)
        return Problem(f"{base}^{exponent}", float(base**exponent), "powers")
    if kind == "combination":
        n = rng.randint(4, min(10, 4 + scale // 10))
        k = rng.randint(2, min(4, n - 1))
        return Problem(f"C({n}, {k})", float(math.comb(n, k)), "probability")
    if kind == "expected_value":
        probability = rng.choice((20, 25, 40, 50, 60, 75, 80))
        win, lose = rng.randint(2, 15) * 10, rng.randint(1, 8) * 10
        answer = probability / 100 * win - (1 - probability / 100) * lose
        return Problem(
            f"EV: {probability}% win ${win}, otherwise lose ${lose}", answer, "probability"
        )
    weight = rng.choice((20, 25, 40, 50, 60, 75, 80))
    low, high = rng.randint(2, 20) * 5, rng.randint(5, 30) * 5
    answer = weight / 100 * low + (1 - weight / 100) * high
    return Problem(f"Weighted average: {weight}% × {low}, rest × {high}", answer, "probability")
