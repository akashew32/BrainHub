import { describe, expect, it } from "vitest";
import { fermiFeedback, fermiQuestions, fermiScore } from "@/components/games/fermi-game";
import { calculateReactionStats } from "@/components/games/reaction-game";
import { calculateMathScore, generateMathProblem } from "@/components/games/mental-math-game";
import { isValidSet } from "@/components/games/pattern-game";
import {
  bayesUpdate,
  brierScore,
  decimalOdds,
  expectedProfit,
  firstPriceTarget,
  impliedProbability,
  isWinningTakeaway,
  kellyFraction,
  optimalTakeawayMoves,
  penneyResponse,
  seededRandom,
  settleAuction,
  stoppingDecision,
  stoppingValue,
  sweepBook,
} from "@/lib/quant-games";
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

  it("solves finite optimal-stopping decisions deterministically", () => {
    expect(stoppingValue(17, 0)).toBe(17);
    expect(stoppingDecision(100, 1).optimal).toBe("stop");
    expect(stoppingDecision(1, 3).optimal).toBe("continue");
    const left = seededRandom(42);
    const right = seededRandom(42);
    expect([left(), left(), left()]).toEqual([right(), right(), right()]);
  });

  it("calculates betting EV, odds, and Kelly sizing", () => {
    expect(expectedProfit(0.6, 100, 100)).toBeCloseTo(20);
    expect(decimalOdds(0.25)).toBe(4);
    expect(impliedProbability(3)).toBe(0.25);
    expect(kellyFraction(0.6, 1)).toBeCloseTo(0.2);
  });

  it("settles first- and second-price auctions", () => {
    expect(firstPriceTarget(100, 4)).toBe(75);
    expect(settleAuction([70, 80, 60], [100, 90, 75], "first-price")).toEqual({
      winner: 1,
      payment: 80,
      profit: 10,
    });
    expect(settleAuction([70, 80, 60], [100, 90, 75], "second-price").payment).toBe(70);
  });

  it("updates Bayesian beliefs and scores calibration", () => {
    expect(bayesUpdate(0.5, 0.7, 0.4)).toBeCloseTo(0.7 / 1.1);
    expect(brierScore(0.8, true)).toBeLessThan(brierScore(0.3, true));
  });

  it("sweeps order-book levels with partial fills", () => {
    expect(
      sweepBook(
        [
          { tick: 10003, quantity: 100 },
          { tick: 10004, quantity: 300 },
        ],
        250,
      ),
    ).toEqual({
      fills: [
        { tick: 10003, quantity: 100 },
        { tick: 10004, quantity: 150 },
      ],
      filled: 250,
      remaining: 0,
      averageTick: 10003.6,
    });
  });

  it("solves take-away states and Penney responses", () => {
    expect(isWinningTakeaway(4, [1, 2, 3])).toBe(false);
    expect(optimalTakeawayMoves(5, [1, 2, 3])).toEqual([1]);
    expect(penneyResponse("HHT")).toBe("THH");
  });
});
