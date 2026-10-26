"use client";

import type { Difficulty } from "@/types/games";
import { QuantDrill, type DrillQuestion } from "./quant-drill";

export type BookLevel = { price: number; size: number };

export function orderBookVwap(levels: BookLevel[], quantity: number) {
  let remaining = quantity;
  let notional = 0;
  for (const level of levels) {
    const filled = Math.min(remaining, level.size);
    notional += filled * level.price;
    remaining -= filled;
    if (remaining <= 0) break;
  }
  if (remaining > 0 || quantity <= 0) throw new Error("Book depth cannot fill requested quantity");
  return notional / quantity;
}

function formatLevels(label: string, levels: BookLevel[]) {
  return `${label}: ${levels.map((level) => `${level.size} @ $${level.price.toFixed(2)}`).join("  |  ")}`;
}

export function generateOrderBookQuestion(
  difficulty: Difficulty,
  random: () => number = Math.random,
): DrillQuestion {
  const tick = difficulty === "easy" ? 0.5 : difficulty === "medium" ? 0.25 : 0.1;
  const bestBid = Math.round((90 + random() * 20) / tick) * tick;
  const spreadTicks = 1 + Math.floor(random() * (difficulty === "easy" ? 3 : 5));
  const bestAsk = bestBid + spreadTicks * tick;

  if (difficulty === "easy" || (difficulty === "medium" && random() < 0.7)) {
    const midpointTask = random() < 0.55;
    const answer = midpointTask ? (bestBid + bestAsk) / 2 : bestAsk - bestBid;
    return {
      prompt: midpointTask ? "What is the quoted midpoint?" : "What is the bid–ask spread?",
      context: `Best bid: $${bestBid.toFixed(2)}\nBest ask: $${bestAsk.toFixed(2)}`,
      answer,
      tolerance: 0.01,
      prefix: "$",
      decimals: 2,
      explanation: midpointTask
        ? `Midpoint = (best bid + best ask) ÷ 2 = ($${bestBid.toFixed(2)} + $${bestAsk.toFixed(2)}) ÷ 2 = $${answer.toFixed(2)}.`
        : `Spread = best ask − best bid = $${bestAsk.toFixed(2)} − $${bestBid.toFixed(2)} = $${answer.toFixed(2)}.`,
    };
  }

  const buying = difficulty !== "expert" || random() > 0.4;
  const levels = Array.from({ length: 3 }, (_, index) => ({
    price: buying ? bestAsk + index * tick : bestBid - index * tick,
    size: 2 + Math.floor(random() * 5),
  }));
  const totalDepth = levels.reduce((sum, level) => sum + level.size, 0);
  const quantity = Math.min(totalDepth, 3 + Math.floor(random() * Math.max(1, totalDepth - 3)));
  const answer = orderBookVwap(levels, quantity);

  return {
    prompt: `A market ${buying ? "buy" : "sell"} for ${quantity} units crosses the book. What is its VWAP?`,
    context: formatLevels(buying ? "Asks" : "Bids", levels),
    answer,
    tolerance: difficulty === "expert" ? 0.005 : 0.01,
    prefix: "$",
    decimals: 2,
    explanation: `Walk the ${buying ? "asks from lowest to highest" : "bids from highest to lowest"}, multiply each fill by its price, and divide total notional by ${quantity}. The resulting VWAP is $${answer.toFixed(2)}.`,
  };
}

export function OrderBookGame() {
  return (
    <QuantDrill
      slug="order-book"
      generator={generateOrderBookQuestion}
      focus="Read top-of-book liquidity and calculate the price of crossing it."
    />
  );
}
