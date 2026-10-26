"use client";

import type { Difficulty } from "@/types/games";
import { QuantDrill, type DrillQuestion } from "./quant-drill";

export type OptionKind = "call" | "put";
export type PositionSide = "long" | "short";

export function optionProfit(
  kind: OptionKind,
  side: PositionSide,
  terminalPrice: number,
  strike: number,
  premium: number,
  multiplier = 1,
) {
  const intrinsic =
    kind === "call" ? Math.max(0, terminalPrice - strike) : Math.max(0, strike - terminalPrice);
  const longProfit = intrinsic - premium;
  return (side === "long" ? longProfit : -longProfit) * multiplier;
}

export function generateOptionsQuestion(
  difficulty: Difficulty,
  random: () => number = Math.random,
): DrillQuestion {
  const kind: OptionKind = random() < 0.5 ? "call" : "put";
  const side: PositionSide =
    difficulty === "easy" || difficulty === "medium" || random() < 0.55 ? "long" : "short";
  const strike = 80 + Math.floor(random() * 9) * 5;
  const terminalPrice = strike - 20 + Math.floor(random() * 9) * 5;
  const premium = difficulty === "easy" ? 0 : 1 + Math.floor(random() * 10);
  const multiplier = difficulty === "expert" ? 100 : 1;
  const answer = optionProfit(kind, side, terminalPrice, strike, premium, multiplier);
  const intrinsic =
    kind === "call" ? Math.max(0, terminalPrice - strike) : Math.max(0, strike - terminalPrice);

  return {
    prompt:
      difficulty === "easy"
        ? `What is this ${kind}'s intrinsic value per share?`
        : `What is the terminal P&L for this ${side} ${kind}?`,
    context: `${side.toUpperCase()} ${kind.toUpperCase()}\nStrike: $${strike}\nTerminal spot: $${terminalPrice}${premium ? `\nPremium: $${premium}` : ""}${multiplier === 100 ? "\nContract multiplier: 100" : ""}`,
    answer,
    tolerance: multiplier === 100 ? 1 : 0.01,
    prefix: "$",
    decimals: 2,
    explanation: `${kind === "call" ? "Call" : "Put"} intrinsic value is $${intrinsic}. ${premium ? `Long profit is intrinsic minus the $${premium} premium` : "With no premium, payoff equals intrinsic value"}${side === "short" ? "; the short position reverses that sign" : ""}${multiplier === 100 ? ", then multiply by 100 shares" : ""}. Final P&L: $${answer.toFixed(2)}.`,
  };
}

export function OptionsPayoffGame() {
  return (
    <QuantDrill
      slug="options-payoff"
      generator={generateOptionsQuestion}
      focus="Turn strikes, premiums, and terminal prices into payoff intuition."
    />
  );
}
