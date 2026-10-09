from functools import cache


@cache
def dice_value(bank: int, rolls_left: int) -> float:
    """Optimal value for the standard BrainHub accumulation die."""
    if rolls_left <= 0:
        return float(bank)
    outcomes = [dice_value(bank + face, rolls_left - 1) for face in range(1, 5)] + [
        dice_value(bank + 10, rolls_left - 1),
        0.0,
    ]
    return max(float(bank), sum(outcomes) / 6)


def dice_decision(bank: int, rolls_left: int) -> dict[str, float | str]:
    if rolls_left <= 0:
        return {"stop_ev": float(bank), "continue_ev": float("-inf"), "optimal": "stop"}
    outcomes = [dice_value(bank + face, rolls_left - 1) for face in range(1, 5)] + [
        dice_value(bank + 10, rolls_left - 1),
        0.0,
    ]
    continue_ev = sum(outcomes) / 6
    return {
        "stop_ev": float(bank),
        "continue_ev": continue_ev,
        "optimal": "continue" if continue_ev > bank else "stop",
    }


@cache
def card_value(total: int, deck: tuple[int, ...], draws_left: int) -> float:
    """Exact without-replacement stopping value for a finite payoff deck."""
    if draws_left <= 0 or not deck:
        return float(total)
    continuation = 0.0
    for index, card in enumerate(deck):
        remaining = deck[:index] + deck[index + 1 :]
        continuation += card_value(total + card, remaining, draws_left - 1) / len(deck)
    return max(float(total), continuation)


def offer_value(offers_left: int, values: tuple[int, ...]) -> float:
    """Expected optimal accepted offer with recall forbidden."""
    if offers_left <= 0:
        return 0.0
    next_value = offer_value(offers_left - 1, values)
    return sum(max(float(offer), next_value) for offer in values) / len(values)
