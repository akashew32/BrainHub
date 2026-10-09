from dataclasses import dataclass
from random import Random


@dataclass(frozen=True)
class AuctionResult:
    winner: int
    payment: float
    profit: float


def first_price_equilibrium(value: float, bidder_count: int) -> float:
    if bidder_count < 2:
        raise ValueError("an auction needs at least two bidders")
    return value * (bidder_count - 1) / bidder_count


def settle_auction(bids: list[float], values: list[float], auction_type: str) -> AuctionResult:
    if not bids or len(bids) != len(values):
        raise ValueError("bids and values must be non-empty and aligned")
    winner = max(range(len(bids)), key=bids.__getitem__)
    if auction_type == "first-price":
        payment = bids[winner]
    elif auction_type == "second-price":
        payment = sorted(bids, reverse=True)[1] if len(bids) > 1 else bids[winner]
    else:
        raise ValueError("unknown auction type")
    return AuctionResult(winner, payment, values[winner] - payment)


def common_value_round(
    seed: int, bidder_count: int = 4, noise: float = 24
) -> tuple[float, list[float]]:
    rng = Random(seed)
    true_value = rng.uniform(70, 150)
    signals = [true_value + rng.uniform(-noise, noise) for _ in range(bidder_count)]
    return true_value, signals
