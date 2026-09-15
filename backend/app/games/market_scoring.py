from typing import Any


def score_market(state: dict[str, Any]) -> dict[str, Any]:
    """Score quoting profit after inventory, selection, and timeout penalties."""
    mark_to_market = state["cash"] + state["inventory"] * state["fair_value"]
    inventory_penalty = abs(state["inventory"]) ** 1.5 * state["inventory_penalty"]
    risk_adjusted_pnl = mark_to_market - inventory_penalty
    average_spread = sum(state["spreads"]) / len(state["spreads"]) if state["spreads"] else 0
    center_bias = sum(state["calibration_errors"]) / max(1, len(state["calibration_errors"]))
    score = max(
        0,
        round(
            500 + risk_adjusted_pnl * 8 - state["adverse_selection"] * 3 - state["timeouts"] * 50
        ),
    )
    return {
        "pnl": round(risk_adjusted_pnl, 2),
        "realized_pnl": round(state["realized_pnl"], 2),
        "inventory": state["inventory"],
        "cash": round(state["cash"], 2),
        "trades": state["trades"],
        "timeouts": state["timeouts"],
        "average_spread": round(average_spread, 2),
        "spread_captured": round(state["spread_captured"], 2),
        "adverse_selection": round(state["adverse_selection"], 2),
        "center_bias": round(center_bias, 2),
        "score": score,
    }
