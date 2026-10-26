"use client";

import type { Difficulty } from "@/types/games";
import { QuantDrill, type DrillQuestion } from "./quant-drill";

export function portfolioVolatility(
  weightA: number,
  volatilityA: number,
  volatilityB: number,
  correlation: number,
) {
  const weightB = 1 - weightA;
  const variance =
    weightA ** 2 * volatilityA ** 2 +
    weightB ** 2 * volatilityB ** 2 +
    2 * weightA * weightB * correlation * volatilityA * volatilityB;
  return Math.sqrt(Math.max(0, variance)) * 100;
}

function pick<T>(items: readonly T[], random: () => number) {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
}

export function generatePortfolioQuestion(
  difficulty: Difficulty,
  random: () => number = Math.random,
): DrillQuestion {
  const weightChoices =
    difficulty === "easy"
      ? ([0.5] as const)
      : difficulty === "medium"
        ? ([0.4, 0.5, 0.6] as const)
        : ([0.25, 0.35, 0.45, 0.55, 0.65, 0.75] as const);
  const correlationChoices =
    difficulty === "easy"
      ? ([0, 1] as const)
      : difficulty === "medium"
        ? ([-0.5, 0, 0.5] as const)
        : difficulty === "hard"
          ? ([-0.75, -0.25, 0.25, 0.75] as const)
          : ([-0.9, -0.6, -0.3, 0.2, 0.55, 0.85] as const);
  const weightA = pick(weightChoices, random);
  const volatilityA = (10 + Math.floor(random() * (difficulty === "expert" ? 26 : 16))) / 100;
  const volatilityB = (10 + Math.floor(random() * (difficulty === "expert" ? 31 : 21))) / 100;
  const correlation = pick(correlationChoices, random);
  const answer = portfolioVolatility(weightA, volatilityA, volatilityB, correlation);

  return {
    prompt: "What is the portfolio's annualized volatility?",
    context: `Asset A: ${(weightA * 100).toFixed(0)}% weight, ${(volatilityA * 100).toFixed(0)}% vol\nAsset B: ${((1 - weightA) * 100).toFixed(0)}% weight, ${(volatilityB * 100).toFixed(0)}% vol\nCorrelation: ${correlation.toFixed(2)}`,
    answer,
    tolerance: { easy: 1, medium: 0.6, hard: 0.35, expert: 0.2 }[difficulty],
    suffix: "%",
    decimals: 2,
    explanation: `Use σp² = wA²σA² + wB²σB² + 2wAwBρσAσB, then take the square root. Here that gives ${answer.toFixed(2)}%. Correlation controls how much risk diversification actually removes.`,
  };
}

export function PortfolioRiskGame() {
  return (
    <QuantDrill
      slug="portfolio-risk"
      generator={generatePortfolioQuestion}
      focus="See diversification through covariance, not through asset count."
    />
  );
}
