import math
from typing import Any

from app.games.base import Difficulty, GameEngine
from app.games.market_order_flow import OrderFlowPolicy
from app.games.market_scoring import score_market

PARAMETERS = {
    Difficulty.EASY: (5.0, 0.25, 0.0, 30),
    Difficulty.MEDIUM: (9.0, 0.45, 0.02, 22),
    Difficulty.HARD: (14.0, 0.65, 0.05, 16),
    Difficulty.EXPERT: (20.0, 0.82, 0.1, 12),
}


class MarketMakingEngine(GameEngine):
    """Seeded market simulation with private fair value and informed/noisy order flow."""

    order_flow_policy = OrderFlowPolicy()

    def create_session(self, difficulty: Difficulty) -> dict[str, Any]:
        volatility, informed, penalty, seconds = PARAMETERS[difficulty]
        market_kind = self.rng.choice(("synthetic", "probability", "estimation"))
        fair = round(
            self.rng.uniform(25, 75) if market_kind == "probability" else self.rng.uniform(80, 120),
            2,
        )
        raw_signal = fair + self.rng.gauss(0, volatility * 1.5)
        noisy_signal = round(
            min(99.9, max(0.1, raw_signal)) if market_kind == "probability" else max(1, raw_signal),
            1,
        )
        prompts = {
            "synthetic": f"Synthetic asset BHX. Initial research value: {noisy_signal}",
            "probability": f"Event contract paying 100 if a launch succeeds. Research probability: {noisy_signal}%",
            "estimation": f"Normalized urban-demand market. Desk estimate: {noisy_signal}",
        }
        return {
            "difficulty": difficulty.value,
            "round": 1,
            "max_rounds": 8,
            "prompt": prompts[market_kind],
            "market_kind": market_kind,
            "reference_signal": noisy_signal,
            "fair_value": fair,
            "volatility": volatility,
            "informed_share": informed,
            "inventory_penalty": penalty,
            "time_limit": seconds,
            "cash": 0.0,
            "inventory": 0,
            "average_entry": 0.0,
            "realized_pnl": 0.0,
            "trades": 0,
            "spreads": [],
            "spread_captured": 0.0,
            "timeouts": 0,
            "adverse_selection": 0.0,
            "calibration_errors": [],
            "history": [],
            "complete": False,
        }

    def apply_action(self, state: dict[str, Any], action: dict[str, Any]) -> dict[str, Any]:
        if state["complete"]:
            raise ValueError("Market session is complete")
        bid, ask = float(action["bid"]), float(action["ask"])
        if not math.isfinite(bid) or not math.isfinite(ask):
            raise ValueError("Bid and ask must be finite numbers")
        requested_size = int(action.get("size", 1))
        if requested_size not in range(1, 11):
            raise ValueError("Quote size must be between 1 and 10")
        size = requested_size if state["difficulty"] in {"hard", "expert"} else 1
        if bid >= ask or bid <= 0:
            raise ValueError("Bid must be positive and strictly below ask")
        if state["market_kind"] == "probability" and ask > 100:
            raise ValueError("Probability-market quotes must stay between 0 and 100")
        fair = state["fair_value"]
        expired = float(action.get("elapsed_ms", 0)) > state["time_limit"] * 1000
        side = "timeout" if expired else "none"
        if expired:
            state["timeouts"] += 1
        else:
            flow = self.order_flow_policy.decide(
                rng=self.rng,
                fair_value=fair,
                bid=bid,
                ask=ask,
                volatility=state["volatility"],
                informed_share=state["informed_share"],
            )
            side = flow.side
            if side == "buy":
                side = "buy"
                self._book_trade(state, -size, ask)
                state["adverse_selection"] += max(0, fair - ask) * size
            elif side == "sell":
                side = "sell"
                self._book_trade(state, size, bid)
                state["adverse_selection"] += max(0, bid - fair) * size
        if side in {"buy", "sell"}:
            state["trades"] += 1
            state["spread_captured"] += (ask - bid) / 2 * size
        state["spreads"].append(ask - bid)
        state["calibration_errors"].append((bid + ask) / 2 - fair)
        state["history"].append(
            {"round": state["round"], "bid": bid, "ask": ask, "size": size, "side": side}
        )
        next_fair = fair + self.rng.gauss(0, state["volatility"] / 3)
        state["fair_value"] = round(
            min(100, max(0, next_fair))
            if state["market_kind"] == "probability"
            else max(0.01, next_fair),
            2,
        )
        state["round"] += 1
        state["complete"] = state["round"] > state["max_rounds"]
        if not state["complete"]:
            signal_noise = state["volatility"] * max(0.35, 1 - state["round"] / state["max_rounds"])
            raw_signal = state["fair_value"] + self.rng.gauss(0, signal_noise)
            signal = round(
                min(99.9, max(0.1, raw_signal))
                if state["market_kind"] == "probability"
                else max(1, raw_signal),
                1,
            )
            state["reference_signal"] = signal
            state["prompt"] = (
                f"Updated research signal: {signal}. Manage the position before requoting."
            )
        return state

    @staticmethod
    def _book_trade(state: dict[str, Any], delta: int, price: float) -> None:
        """Update cash, inventory, weighted entry, and realized PnL for a fill."""
        old = state["inventory"]
        new = old + delta
        state["cash"] -= delta * price
        if old == 0 or old * delta > 0:
            state["average_entry"] = (abs(old) * state["average_entry"] + abs(delta) * price) / abs(
                new
            )
        else:
            closed = min(abs(old), abs(delta))
            state["realized_pnl"] += closed * (
                (price - state["average_entry"]) if old > 0 else (state["average_entry"] - price)
            )
            if new == 0:
                state["average_entry"] = 0.0
            elif old * new < 0:
                state["average_entry"] = price
        state["inventory"] = new

    @staticmethod
    def metrics(state: dict[str, Any]) -> dict[str, Any]:
        return score_market(state)

    def public_state(self, state: dict[str, Any]) -> dict[str, Any]:
        public = {
            key: value
            for key, value in state.items()
            if key
            not in {
                "fair_value",
                "volatility",
                "informed_share",
                "inventory_penalty",
                "calibration_errors",
                "_quote_started_at",
                "_rng_state",
            }
        }
        public["mark_to_market_pnl"] = round(
            state["cash"] + state["inventory"] * state["fair_value"], 2
        )
        if state["complete"]:
            public["fair_value"] = state["fair_value"]
            public["analysis"] = self.metrics(state)
        return public
