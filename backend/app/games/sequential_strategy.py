from functools import cache


@cache
def is_winning_takeaway(stones: int, moves: tuple[int, ...], misere: bool = False) -> bool:
    if stones == 0:
        return misere
    legal = [move for move in moves if move <= stones]
    if not legal:
        return False
    return any(not is_winning_takeaway(stones - move, moves, misere) for move in legal)


def optimal_takeaway_moves(stones: int, moves: tuple[int, ...], misere: bool = False) -> list[int]:
    return [
        move
        for move in moves
        if move <= stones and not is_winning_takeaway(stones - move, moves, misere)
    ]


def penney_response(sequence: str) -> str:
    """Classic best response for a length-three fair-coin sequence."""
    if len(sequence) != 3 or set(sequence) - {"H", "T"}:
        raise ValueError("sequence must contain exactly three H/T symbols")
    opposite = "T" if sequence[1] == "H" else "H"
    return opposite + sequence[:2]
