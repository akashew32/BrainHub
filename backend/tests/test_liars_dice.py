from app.games.base import Difficulty
from app.games.liars_dice import LiarsDiceEngine, bid_probability, is_legal_raise, matching_dice


def test_bid_ordering():
    assert is_legal_raise((2, 4), (2, 5))
    assert is_legal_raise((2, 6), (3, 1))
    assert not is_legal_raise((2, 4), (2, 3))


def test_engine_rejects_quantity_above_dice_in_play():
    engine = LiarsDiceEngine(1)
    state = engine.create_session(Difficulty.EXPERT)
    try:
        engine.apply_action(state, {"type": "bid", "quantity": 21, "face": 2})
    except ValueError as error:
        assert "remaining" in str(error)
    else:
        raise AssertionError("Expected an impossible bid to be rejected")


def test_wild_ones():
    assert matching_dice([1, 2, 4, 1], 4) == 3
    assert matching_dice([1, 2, 4, 1], 1) == 2


def test_probability_bounds_and_ai_legal_actions():
    probability = bid_probability(4, 3, [1, 3, 5], 12)
    assert 0 <= probability <= 1
    engine = LiarsDiceEngine(22)
    state = engine.create_session(Difficulty.EXPERT)
    engine.apply_action(state, {"type": "bid", "quantity": 1, "face": 2})
    action = engine.choose_ai_action(state, state["turn"])
    assert action["type"] == "challenge" or is_legal_raise(
        tuple(state["bid"]), (action["quantity"], action["face"])
    )


def test_challenge_removes_die_and_game_terminates():
    engine = LiarsDiceEngine(4)
    state = engine.create_session(Difficulty.EXPERT)
    initial = sum(state["dice_counts"])
    engine.apply_action(state, {"type": "bid", "quantity": initial, "face": 6})
    engine.apply_action(state, {"type": "challenge"})
    assert sum(state["dice_counts"]) == initial - 1
    assert 0 <= state["analysis"]["bidder_probability"] <= 1
    assert state["analysis"]["bid_aggressiveness"] in {
        "conservative",
        "balanced",
        "aggressive",
    }
    steps = 0
    while state["winner"] is None and steps < 2000:
        action = engine.choose_ai_action(state, state["turn"])
        state = engine.apply_action(state, action)
        steps += 1
    assert state["winner"] is not None


def test_hidden_opponent_dice_are_not_public():
    engine = LiarsDiceEngine(1)
    state = engine.create_session(Difficulty.MEDIUM)
    public = engine.public_state(state)
    assert "dice" not in public
    assert public["your_dice"] == state["dice"][0]
