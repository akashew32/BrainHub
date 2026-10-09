from decimal import Decimal

import pytest

from app.games.auction import common_value_round, first_price_equilibrium, settle_auction
from app.games.bayesian import action_values, bayes_update, brier_score, sequential_update
from app.games.optimal_stopping import card_value, dice_decision, dice_value, offer_value
from app.games.order_book import OrderBook, average_price, marked_pnl
from app.games.probability_betting import (
    decimal_odds,
    expected_profit,
    implied_probability,
    kelly_fraction,
)
from app.games.sequential_strategy import (
    is_winning_takeaway,
    optimal_takeaway_moves,
    penney_response,
)


def test_optimal_stopping_bellman_terminal_and_actions():
    assert dice_value(17, 0) == 17
    assert dice_decision(100, 1)["optimal"] == "stop"
    assert dice_decision(1, 3)["optimal"] == "continue"
    assert card_value(10, (-5, 8), 1) == pytest.approx(11.5)
    assert offer_value(1, (10, 20, 30)) == 20


def test_probability_ev_odds_and_kelly():
    assert expected_profit(0.6, 100, 100) == pytest.approx(20)
    assert decimal_odds(0.25) == 4
    assert implied_probability(3) == 0.25
    assert kelly_fraction(0.6, 1) == pytest.approx(0.2)
    assert kelly_fraction(0.4, 1) == 0


def test_auction_winners_payments_profit_and_seeded_common_values():
    assert first_price_equilibrium(100, 4) == 75
    first = settle_auction([70, 80, 60], [100, 90, 75], "first-price")
    assert (first.winner, first.payment, first.profit) == (1, 80, 10)
    second = settle_auction([70, 80, 60], [100, 90, 75], "second-price")
    assert (second.winner, second.payment, second.profit) == (1, 70, 20)
    assert common_value_round(42) == common_value_round(42)


def test_bayesian_updates_normalization_scoring_and_decision_ev():
    posterior = bayes_update(0.5, 0.7, 0.4)
    assert posterior == pytest.approx(0.7 / 1.1)
    path = sequential_update(0.5, [(0.7, 0.4), (0.3, 0.6)])
    assert len(path) == 2 and all(0 <= value <= 1 for value in path)
    assert brier_score(0.8, True) < brier_score(0.3, True)
    values = action_values(0.75, 20, 10)
    assert max(values, key=values.get) == "buy"


def test_order_book_sorting_spread_sweeps_partial_fills_and_pnl():
    book = OrderBook(bids={10000: 100, 10001: 200}, asks={10003: 100, 10004: 300})
    assert book.best_bid == 10001
    assert book.best_ask == 10003
    assert book.spread_ticks == 2
    assert book.midpoint == Decimal("100.02")
    fills = book.market("buy", 250)
    assert [(fill.tick, fill.quantity) for fill in fills] == [(10003, 100), (10004, 150)]
    assert average_price(fills) == Decimal("100.036")
    assert book.asks[10004] == 150
    book.add_limit("sell", 10002, 75)
    assert book.best_ask == 10002
    assert book.cancel("sell", 10002, 25) == 25
    assert book.asks[10002] == 50
    assert marked_pnl(Decimal("-1000"), 10, 10100) == Decimal("10.00")


def test_sequential_strategy_exact_states_and_legal_moves():
    moves = (1, 2, 3)
    assert not is_winning_takeaway(4, moves)
    assert is_winning_takeaway(5, moves)
    assert optimal_takeaway_moves(5, moves) == [1]
    assert penney_response("HHT") == "THH"
    assert all(move <= 7 for move in optimal_takeaway_moves(7, (1, 3, 4)))
