from itertools import combinations
from random import Random

from app.games.pattern import generate_board, is_set


def test_set_validity_all_same_or_different():
    assert is_set(
        [
            {"shape": "diamond", "color": "cyan", "count": 1, "fill": "solid"},
            {"shape": "wave", "color": "violet", "count": 2, "fill": "solid"},
            {"shape": "pill", "color": "amber", "count": 3, "fill": "solid"},
        ]
    )


def test_two_of_attribute_is_invalid():
    cards = [
        {"shape": "diamond", "color": "cyan", "count": 1, "fill": "solid"},
        {"shape": "diamond", "color": "violet", "count": 2, "fill": "striped"},
        {"shape": "pill", "color": "amber", "count": 3, "fill": "outline"},
    ]
    assert not is_set(cards)


def test_generated_board_always_has_set():
    for seed in range(50):
        board = generate_board(Random(seed), 15)
        assert len({tuple(sorted(card.items())) for card in board}) == 15
        assert any(is_set(list(group)) for group in combinations(board, 3))
