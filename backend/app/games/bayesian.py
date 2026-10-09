def bayes_update(prior: float, likelihood_if_true: float, likelihood_if_false: float) -> float:
    numerator = prior * likelihood_if_true
    denominator = numerator + (1 - prior) * likelihood_if_false
    if denominator == 0:
        raise ValueError("evidence has zero probability")
    return numerator / denominator


def sequential_update(prior: float, evidence: list[tuple[float, float]]) -> list[float]:
    posteriors: list[float] = []
    current = prior
    for likelihood_true, likelihood_false in evidence:
        current = bayes_update(current, likelihood_true, likelihood_false)
        posteriors.append(current)
    return posteriors


def brier_score(estimate: float, outcome: bool) -> float:
    return (estimate - float(outcome)) ** 2


def action_values(probability_bull: float, up_payoff: float, down_loss: float) -> dict[str, float]:
    buy = probability_bull * up_payoff - (1 - probability_bull) * down_loss
    sell = (1 - probability_bull) * up_payoff - probability_bull * down_loss
    return {"buy": buy, "sell": sell, "hold": 0.0}
