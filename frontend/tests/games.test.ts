import { describe, expect, it } from "vitest";
import { fermiFeedback, fermiQuestions, fermiScore } from "@/components/games/fermi-game";
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
});
