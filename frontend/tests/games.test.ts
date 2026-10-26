import { describe, expect, it } from "vitest";
import { bayesPosterior } from "@/components/games/bayes-updating-game";
import { expectedValue } from "@/components/games/expected-value-game";
import { fermiFeedback, fermiQuestions, fermiScore } from "@/components/games/fermi-game";
import { optionProfit } from "@/components/games/options-payoff-game";
import { orderBookVwap } from "@/components/games/order-book-game";
import { portfolioVolatility } from "@/components/games/portfolio-risk-game";
import { scoreDrillAnswer } from "@/components/games/quant-drill";
import { calculateReactionStats } from "@/components/games/reaction-game";
import { calculateMathScore, generateMathProblem } from "@/components/games/mental-math-game";
import { isValidSet } from "@/components/games/pattern-game";
describe("game utilities", () => {
  it("ships forty Fermi questions", () => expect(fermiQuestions).toHaveLength(40));
  it("scores Fermi answers logarithmically", () =>
    expect(fermiScore(100, 100).score).toBeGreaterThan(fermiScore(1000, 100).score));
  it("explains Fermi calibration intuitively", () => expect(fermiFeedback(1.2)).toBe("Within 25%"));
  it("summarizes reactions", () => expect(calculateReactionStats([250, 200, 300]).median).toBe(250));
  it("generates correct deterministic arithmetic", () =>
    expect(generateMathProblem("easy", () => 0)).toEqual({
      prompt: "2 + 2",
      answer: 4,
      category: "Arithmetic",
    }));
  it("difficulty-adjusts mental math scores", () =>
    expect(calculateMathScore(10, 90, "expert")).toBeGreaterThan(calculateMathScore(10, 90, "easy")));
  it("rewards sustained mental math streaks", () =>
    expect(calculateMathScore(10, 90, "medium", 6)).toBeGreaterThan(calculateMathScore(10, 90, "medium", 0)));
  it("recognizes all-different sets", () =>
    expect(
      isValidSet([
        { id: 1, shape: 0, color: 0, count: 0, fill: 0 },
        { id: 2, shape: 1, color: 1, count: 1, fill: 1 },
        { id: 3, shape: 2, color: 2, count: 2, fill: 2 },
      ]),
    ).toBe(true));
  it("updates a prior with Bayes' rule", () =>
    expect(bayesPosterior(0.1, 0.8, 0.9, true)).toBeCloseTo(47.0588, 3));
  it("calculates probability-weighted expected value", () =>
    expect(
      expectedValue([
        { probability: 0.4, payoff: 100 },
        { probability: 0.6, payoff: -50 },
      ]),
    ).toBe(10));
  it("walks order-book levels to calculate VWAP", () =>
    expect(
      orderBookVwap(
        [
          { price: 101, size: 2 },
          { price: 102, size: 3 },
        ],
        4,
      ),
    ).toBe(101.5));
  it("handles option direction, premium, and contract multiplier", () =>
    expect(optionProfit("call", "long", 120, 100, 5, 100)).toBe(1500));
  it("uses covariance in portfolio volatility", () =>
    expect(portfolioVolatility(0.6, 0.1, 0.2, 0)).toBeCloseTo(10, 6));
  it("gives full drill credit inside tolerance", () =>
    expect(
      scoreDrillAnswer(
        {
          prompt: "",
          context: "",
          answer: 50,
          tolerance: 2,
          explanation: "",
        },
        51,
      ).correct,
    ).toBe(true));
});
