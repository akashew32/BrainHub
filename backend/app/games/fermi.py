import math


def score_estimate(answer: float, reference: float) -> tuple[int, float]:
    if answer <= 0 or reference <= 0:
        raise ValueError("Estimates must be positive")
    ratio = answer / reference
    error = abs(math.log10(ratio))
    return max(0, round(100 * (1 - min(error, 2) / 2))), ratio


def feedback_for_ratio(ratio: float) -> str:
    error = max(ratio, 1 / ratio)
    if error <= 1.1:
        return "Within 10%"
    if error <= 1.25:
        return "Within 25%"
    if error <= 2:
        return "Within 2×"
    if error <= 5:
        return "Within 5×"
    if error <= 10:
        return "Correct order of magnitude"
    return "More than an order of magnitude away"
