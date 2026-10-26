"use client";

import type { Difficulty } from "@/types/games";
import { QuantDrill, type DrillQuestion } from "./quant-drill";

export type Outcome = { probability: number; payoff: number };

export function expectedValue(outcomes: Outcome[], fee = 0) {
  return outcomes.reduce((sum, outcome) => sum + outcome.probability * outcome.payoff, 0) - fee;
}

export function generateExpectedValueQuestion(
  difficulty: Difficulty,
  random: () => number = Math.random,
): DrillQuestion {
  const step = difficulty === "easy" ? 10 : difficulty === "medium" ? 5 : 1;
  const probabilityPct = Math.min(85, Math.max(15, Math.round((15 + random() * 70) / step) * step));
  const win =
    (difficulty === "easy" ? 5 : 10) *
    Math.max(2, Math.round(2 + random() * { easy: 8, medium: 15, hard: 30, expert: 60 }[difficulty]));
  const loss =
    (difficulty === "easy" ? 5 : 10) *
    Math.max(1, Math.round(1 + random() * { easy: 5, medium: 10, hard: 20, expert: 40 }[difficulty]));
  const fee = difficulty === "hard" || difficulty === "expert" ? Math.round(random() * 12 * 2) / 2 : 0;
  const pWin = probabilityPct / 100;
  const outcomes: Outcome[] = [
    { probability: pWin, payoff: win },
    { probability: 1 - pWin, payoff: -loss },
  ];
  const answer = expectedValue(outcomes, fee);

  return {
    prompt: "What is the expected P&L per trade?",
    context: `${probabilityPct}% chance: +$${win}\n${100 - probabilityPct}% chance: −$${loss}${fee ? `\nExecution cost: $${fee.toFixed(1)}` : ""}`,
    answer,
    tolerance: { easy: 1, medium: 0.5, hard: 0.25, expert: 0.1 }[difficulty],
    prefix: "$",
    decimals: 2,
    explanation: `EV = ${pWin.toFixed(2)} × $${win} + ${(1 - pWin).toFixed(2)} × −$${loss}${fee ? ` − $${fee.toFixed(1)}` : ""} = $${answer.toFixed(2)}. A positive hit rate is not enough—the payoff-weighted average determines the edge.`,
  };
}

export function ExpectedValueGame() {
  return (
    <QuantDrill
      slug="expected-value"
      generator={generateExpectedValueQuestion}
      focus="Price uncertain outcomes before intuition talks you into a bad bet."
    />
  );
}
