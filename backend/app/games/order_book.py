from dataclasses import dataclass, field
from decimal import Decimal


@dataclass
class Fill:
    tick: int
    quantity: int


@dataclass
class OrderBook:
    bids: dict[int, int] = field(default_factory=dict)
    asks: dict[int, int] = field(default_factory=dict)
    tick_size: Decimal = Decimal("0.01")

    @property
    def best_bid(self) -> int | None:
        return max(self.bids, default=None)

    @property
    def best_ask(self) -> int | None:
        return min(self.asks, default=None)

    @property
    def spread_ticks(self) -> int | None:
        if self.best_bid is None or self.best_ask is None:
            return None
        return self.best_ask - self.best_bid

    @property
    def midpoint(self) -> Decimal | None:
        if self.best_bid is None or self.best_ask is None:
            return None
        return (Decimal(self.best_bid + self.best_ask) * self.tick_size) / 2

    def add_limit(self, side: str, tick: int, quantity: int) -> None:
        if quantity <= 0:
            raise ValueError("quantity must be positive")
        levels = self.bids if side == "buy" else self.asks if side == "sell" else None
        if levels is None:
            raise ValueError("side must be buy or sell")
        levels[tick] = levels.get(tick, 0) + quantity

    def cancel(self, side: str, tick: int, quantity: int) -> int:
        levels = self.bids if side == "buy" else self.asks if side == "sell" else None
        if levels is None or tick not in levels:
            return 0
        removed = min(quantity, levels[tick])
        levels[tick] -= removed
        if levels[tick] == 0:
            del levels[tick]
        return removed

    def market(self, side: str, quantity: int) -> list[Fill]:
        levels = self.asks if side == "buy" else self.bids if side == "sell" else None
        if levels is None:
            raise ValueError("side must be buy or sell")
        ticks = sorted(levels) if side == "buy" else sorted(levels, reverse=True)
        remaining = quantity
        fills: list[Fill] = []
        for tick in ticks:
            if remaining <= 0:
                break
            filled = min(remaining, levels[tick])
            fills.append(Fill(tick, filled))
            levels[tick] -= filled
            remaining -= filled
            if levels[tick] == 0:
                del levels[tick]
        return fills


def average_price(fills: list[Fill], tick_size: Decimal = Decimal("0.01")) -> Decimal:
    quantity = sum(fill.quantity for fill in fills)
    if not quantity:
        raise ValueError("cannot average empty fills")
    notional_ticks = sum(fill.tick * fill.quantity for fill in fills)
    return Decimal(notional_ticks) * tick_size / Decimal(quantity)


def marked_pnl(
    cash: Decimal, inventory: int, mark_tick: int, tick_size: Decimal = Decimal("0.01")
) -> Decimal:
    return cash + Decimal(inventory * mark_tick) * tick_size
