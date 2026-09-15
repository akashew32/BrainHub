from random import Random

import pytest

from app.games.base import Difficulty
from app.games.fermi import feedback_for_ratio, score_estimate
from app.games.mental_math import generate_problem
from app.games.reaction import reaction_stats


def test_mental_math_generation_is_reproducible_and_reasonable():
    first = [generate_problem(Random(seed), Difficulty.MEDIUM) for seed in range(100)]
    second = [generate_problem(Random(seed), Difficulty.MEDIUM) for seed in range(100)]
    assert first == second
    assert all(abs(problem.answer) < 100_000 for problem in first)


def test_fermi_logarithmic_scoring():
    exact, ratio = score_estimate(100, 100)
    double, _ = score_estimate(200, 100)
    tenfold, _ = score_estimate(1000, 100)
    assert exact == 100 and ratio == 1
    assert exact > double > tenfold
    assert feedback_for_ratio(1.2) == "Within 25%"
    with pytest.raises(ValueError):
        score_estimate(0, 10)


def test_reaction_statistics():
    stats = reaction_stats([200, 250, 300], false_starts=1)
    assert stats["median_ms"] == 250
    assert stats["average_ms"] == 250
    assert stats["best_ms"] == 200
    assert stats["accuracy"] == 75
