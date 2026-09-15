import math
from typing import Any

from app.games.base import Difficulty, GameEngine


def is_legal_raise(previous: tuple[int, int] | None, proposed: tuple[int, int]) -> bool:
    quantity, face = proposed
    if quantity < 1 or face not in range(1, 7):
        return False
    return (
        previous is None
        or quantity > previous[0]
        or (quantity == previous[0] and face > previous[1])
    )


def matching_dice(dice: list[int], face: int) -> int:
    return sum(value == face or (face != 1 and value == 1) for value in dice)


def bid_probability(quantity: int, face: int, own_dice: list[int], hidden_count: int) -> float:
    """Return the exact posterior truth probability from a player's private dice.

    Each hidden die independently matches with probability 1/3 for non-one faces
    because ones are wild, and with probability 1/6 when the bid itself is ones.
    """
    known = matching_dice(own_dice, face)
    needed = quantity - known
    if needed <= 0:
        return 1.0
    probability = 1 / 6 if face == 1 else 1 / 3
    return sum(
        math.comb(hidden_count, k) * probability**k * (1 - probability) ** (hidden_count - k)
        for k in range(needed, hidden_count + 1)
    )


class LiarsDiceEngine(GameEngine):
    personalities = ("human", "conservative", "balanced", "aggressive")

    def create_session(self, difficulty: Difficulty) -> dict[str, Any]:
        state = {
            "difficulty": difficulty.value,
            "dice_counts": [5, 5, 5, 5],
            "active": [True] * 4,
            "turn": 0,
            "bid": None,
            "history": [],
            "round": 1,
            "winner": None,
            "analysis": None,
        }
        self._roll(state)
        return state

    def _roll(self, state: dict[str, Any]) -> None:
        state["dice"] = [
            [self.rng.randint(1, 6) for _ in range(count)] for count in state["dice_counts"]
        ]
        state["bid"] = None
        state["history"] = []

    def _next(self, state: dict[str, Any], player: int) -> int:
        for offset in range(1, 5):
            candidate = (player + offset) % 4
            if state["active"][candidate]:
                return candidate
        return player

    def _challenge(self, state: dict[str, Any], challenger: int) -> None:
        quantity, face = state["bid"]
        total = sum(matching_dice(dice, face) for dice in state["dice"])
        bidder = state["history"][-1]["player"]
        loser = bidder if total < quantity else challenger
        hidden = sum(state["dice_counts"]) - state["dice_counts"][challenger]
        probability = bid_probability(quantity, face, state["dice"][challenger], hidden)
        bidder_hidden = sum(state["dice_counts"]) - state["dice_counts"][bidder]
        bidder_probability = bid_probability(quantity, face, state["dice"][bidder], bidder_hidden)
        bid_aggressiveness = (
            "conservative"
            if bidder_probability >= 0.7
            else "balanced"
            if bidder_probability >= 0.4
            else "aggressive"
        )
        state["dice_counts"][loser] -= 1
        if state["dice_counts"][loser] == 0:
            state["active"][loser] = False
        survivors = [i for i, active in enumerate(state["active"]) if active]
        state["analysis"] = {
            "challenger": challenger,
            "bidder": bidder,
            "bid": [quantity, face],
            "actual_matches": total,
            "bid_was_true": total >= quantity,
            "estimated_probability": round(probability, 3),
            "bidder_probability": round(bidder_probability, 3),
            "bid_aggressiveness": bid_aggressiveness,
            "reasonable_challenge": probability < 0.5,
            "loser": loser,
            "revealed_dice": state["dice"],
        }
        if len(survivors) == 1:
            state["winner"] = survivors[0]
            state["turn"] = survivors[0]
        else:
            state["round"] += 1
            state["turn"] = loser if state["active"][loser] else self._next(state, loser)
            self._roll(state)

    def choose_ai_action(self, state: dict[str, Any], player: int) -> dict[str, Any]:
        """Choose a legal action using exact bid odds and risk-aware thresholds.

        Personalities shift the challenge threshold slightly; difficulty controls
        bounded decision noise and how many top probability-ranked raises are sampled.
        Expert bots therefore choose the strongest evaluated legal raise deterministically.
        """
        total_dice = sum(state["dice_counts"])
        bid = tuple(state["bid"]) if state["bid"] else None
        own = state["dice"][player]
        if bid:
            truth = bid_probability(bid[0], bid[1], own, total_dice - len(own))
            thresholds = {"conservative": 0.42, "balanced": 0.34, "aggressive": 0.27}
            skill_noise = {"easy": 0.14, "medium": 0.07, "hard": 0.025, "expert": 0.0}[
                state["difficulty"]
            ]
            threshold = thresholds.get(
                self.personalities[player], thresholds["balanced"]
            ) + self.rng.uniform(-skill_noise, skill_noise)
            if truth < threshold:
                return {"type": "challenge"}
        candidates = [
            (q, face)
            for q in range(1, total_dice + 1)
            for face in range(1, 7)
            if is_legal_raise(bid, (q, face))
        ]
        if not candidates:
            return {"type": "challenge"}
        scored = [
            (
                bid_probability(q, face, own, total_dice - len(own)) - q / total_dice * 0.08,
                (q, face),
            )
            for q, face in candidates
        ]
        scored.sort(reverse=True)
        candidate_pool = {"easy": 5, "medium": 3, "hard": 2, "expert": 1}[state["difficulty"]]
        legal = self.rng.choice(scored[:candidate_pool])[1]
        return {"type": "bid", "quantity": legal[0], "face": legal[1]}

    def apply_action(self, state: dict[str, Any], action: dict[str, Any]) -> dict[str, Any]:
        if state["winner"] is not None:
            raise ValueError("Game is complete")
        player = state["turn"]
        if action["type"] == "challenge":
            if state["bid"] is None:
                raise ValueError("Cannot challenge before a bid")
            self._challenge(state, player)
            return state
        proposed = (int(action["quantity"]), int(action["face"]))
        current = tuple(state["bid"]) if state["bid"] else None
        if proposed[0] > sum(state["dice_counts"]):
            raise ValueError("Bid quantity cannot exceed the dice remaining in play")
        if not is_legal_raise(current, proposed):
            raise ValueError("Bid must increase lexicographically by quantity then face")
        state["bid"] = list(proposed)
        state["history"].append({"player": player, "quantity": proposed[0], "face": proposed[1]})
        state["turn"] = self._next(state, player)
        return state

    def public_state(self, state: dict[str, Any]) -> dict[str, Any]:
        public = {key: value for key, value in state.items() if key not in {"dice", "_rng_state"}}
        public["your_dice"] = state["dice"][0]
        return public
