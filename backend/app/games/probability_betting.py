import math


def expected_profit(win_probability: float, win_profit: float, loss: float) -> float:
    return win_probability * win_profit - (1 - win_probability) * loss


def decimal_odds(probability: float) -> float:
    if not 0 < probability <= 1:
        raise ValueError("probability must be in (0, 1]")
    return 1 / probability


def implied_probability(profit_to_one: float) -> float:
    if profit_to_one < 0:
        raise ValueError("odds must be non-negative")
    return 1 / (profit_to_one + 1)


def kelly_fraction(win_probability: float, profit_to_one: float) -> float:
    if profit_to_one <= 0:
        return 0.0
    loss_probability = 1 - win_probability
    return max(0.0, (profit_to_one * win_probability - loss_probability) / profit_to_one)


def logarithmic_accuracy(estimate: float, target: float) -> float:
    if estimate <= 0 or target <= 0:
        return 0.0
    return max(0.0, 100 - 55 * abs(math.log(estimate / target)))
