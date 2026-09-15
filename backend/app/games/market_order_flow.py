from dataclasses import dataclass
from random import Random
from typing import Literal


@dataclass(frozen=True)
class OrderFlowDecision:
    side: Literal["buy", "sell", "none"]
    informed: bool


class OrderFlowPolicy:
    """Generate a coherent counterparty decision without exposing its private signal."""

    def decide(
        self,
        *,
        rng: Random,
        fair_value: float,
        bid: float,
        ask: float,
        volatility: float,
        informed_share: float,
    ) -> OrderFlowDecision:
        informed = rng.random() < informed_share
        private_signal = fair_value if informed else fair_value + rng.gauss(0, volatility)
        if private_signal > ask:
            return OrderFlowDecision("buy", informed)
        if private_signal < bid:
            return OrderFlowDecision("sell", informed)
        return OrderFlowDecision("none", informed)
