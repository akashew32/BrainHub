import pytest

from app.games.base import Difficulty
from app.games.market_making import MarketMakingEngine


def test_seeded_market_is_deterministic():
    assert MarketMakingEngine(42).create_session(Difficulty.HARD) == MarketMakingEngine(
        42
    ).create_session(Difficulty.HARD)


def test_rng_checkpoint_reproduces_next_transition():
    first = MarketMakingEngine(42)
    state = first.create_session(Difficulty.HARD)
    first.checkpoint(state)
    second = MarketMakingEngine(42)
    second.restore(state)
    assert first.apply_action(dict(state), {"bid": 90, "ask": 110}) == second.apply_action(
        dict(state), {"bid": 90, "ask": 110}
    )


def test_quote_validation_trade_and_pnl():
    engine = MarketMakingEngine(7)
    state = engine.create_session(Difficulty.MEDIUM)
    with pytest.raises(ValueError):
        engine.apply_action(state, {"bid": 100, "ask": 99})
    for _ in range(8):
        engine.apply_action(state, {"bid": 60, "ask": 80, "size": 2})
    metrics = engine.metrics(state)
    assert state["complete"]
    assert isinstance(metrics["pnl"], float)
    assert all(item["size"] == 1 for item in state["history"])
    assert state["trades"] <= 8


def test_probability_quotes_and_advanced_sizes_are_bounded():
    engine = MarketMakingEngine(11)
    state = engine.create_session(Difficulty.EXPERT)
    state["market_kind"] = "probability"
    with pytest.raises(ValueError, match="between 0 and 100"):
        engine.apply_action(state, {"bid": 95, "ask": 105, "size": 2})
    with pytest.raises(ValueError, match="between 1 and 10"):
        engine.apply_action(state, {"bid": 45, "ask": 55, "size": 11})


def test_hidden_fair_value_not_public_until_complete():
    engine = MarketMakingEngine(2)
    state = engine.create_session(Difficulty.EASY)
    assert "fair_value" not in engine.public_state(state)


def test_realized_pnl_when_position_is_closed():
    engine = MarketMakingEngine(3)
    state = engine.create_session(Difficulty.MEDIUM)
    engine._book_trade(state, 2, 100)
    engine._book_trade(state, -2, 110)
    assert state["inventory"] == 0
    assert state["realized_pnl"] == 20
