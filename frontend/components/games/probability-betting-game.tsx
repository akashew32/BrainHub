"use client";

import { FormEvent, useMemo, useState } from "react";
import { useGameSession } from "@/hooks/use-game-session";
import {
  decimalOdds,
  difficultyIndex,
  expectedProfit,
  impliedProbability,
  kellyFraction,
  logarithmicScore,
  seededRandom,
} from "@/lib/quant-games";
import type { Difficulty } from "@/types/games";
import { GameShell, ScoreRow } from "./game-shell";
import { AnalysisGrid, ModeTabs, PersistenceNotice } from "./quant-game-ui";

type Mode = "mixed" | "take-or-pass" | "fair-price" | "odds" | "sizing";
type PromptMode = Exclude<Mode, "mixed">;
type Result = { score: number; answer: string; explanation: string; metric: number };
const modes: Mode[] = ["mixed", "take-or-pass", "fair-price", "odds", "sizing"];
const mixedModes: PromptMode[] = ["take-or-pass", "fair-price", "odds", "sizing"];

export function ProbabilityBettingGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [mode, setMode] = useState<Mode>("mixed");
  const [seed, setSeed] = useState(1823);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [finished, setFinished] = useState(false);
  const { persistenceError, startSession, completeSession } = useGameSession("probability-betting");
  const promptMode: PromptMode = mode === "mixed" ? mixedModes[index % mixedModes.length]! : mode;
  const problem = useMemo(
    () => makeProblem(seed, index, difficulty, promptMode),
    [difficulty, index, promptMode, seed],
  );
  const total = results.reduce((sum, item) => sum + item.score, 0);

  function evaluate(raw: string): Result | null {
    if (promptMode === "take-or-pass") {
      const take = raw === "take";
      const correct = problem.ev >= 0;
      return {
        score: take === correct ? 100 : 0,
        answer: correct ? "TAKE" : "PASS",
        explanation: `Win probability ${(problem.probability * 100).toFixed(1)}% · expected profit $${problem.ev.toFixed(2)}.`,
        metric: take === correct ? 1 : 0,
      };
    }
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric < 0) return null;
    const target =
      promptMode === "fair-price"
        ? problem.fairPrice
        : promptMode === "odds"
          ? problem.target
          : problem.kelly * problem.bankroll;
    const score = logarithmicScore(Math.max(0.001, numeric), Math.max(0.001, target));
    return {
      score: Math.round(score),
      answer: promptMode === "sizing" ? `$${target.toFixed(0)} full Kelly` : target.toFixed(3),
      explanation:
        promptMode === "sizing"
          ? `Kelly fraction ${(problem.kelly * 100).toFixed(1)}%. Fractional Kelly is often sensible; your wager was ${((numeric / problem.bankroll) * 100).toFixed(1)}%.`
          : promptMode === "odds"
            ? problem.oddsDirection === "probability"
              ? `Fair decimal odds are 1/p = ${target.toFixed(3)}.`
              : `Implied probability is 1/(odds+1) = ${(target * 100).toFixed(2)}%.`
            : `Fair price equals expected payoff: $${target.toFixed(2)}.`,
      metric: Math.abs(numeric - target) / Math.max(0.001, target),
    };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = evaluate(answer);
    if (!next) return;
    setResult(next);
    setResults((current) => [...current, next]);
  }

  function choose(choice: "take" | "pass") {
    const next = evaluate(choice);
    if (!next) return;
    setAnswer(choice);
    setResult(next);
    setResults((current) => [...current, next]);
  }

  function next() {
    if (index >= 4) {
      const finalResults = results;
      const finalScore = Math.round(finalResults.reduce((sum, item) => sum + item.score, 0) / 5) * 10;
      const accuracy = (finalResults.filter((item) => item.score >= 75).length / 5) * 100;
      setFinished(true);
      void completeSession(finalScore, {
        mode,
        seed,
        accuracy,
        average_question_score: finalScore / 10,
        average_relative_error: finalResults.reduce((sum, item) => sum + item.metric, 0) / 5,
      });
      return;
    }
    setIndex((current) => current + 1);
    setAnswer("");
    setResult(null);
  }

  function reset(nextMode = mode, replay = false) {
    setMode(nextMode);
    setSeed((current) => (replay ? current : current + 1));
    setStarted(false);
    setIndex(0);
    setAnswer("");
    setResult(null);
    setResults([]);
    setFinished(false);
  }

  function begin() {
    setStarted(true);
    void startSession(difficulty);
  }

  return (
    <GameShell
      slug="probability-betting"
      difficulty={difficulty}
      setDifficulty={(next) => {
        setDifficulty(next);
        reset(mode);
      }}
      onRestart={() => reset()}
    >
      <ModeTabs modes={modes} value={mode} accent="#38bdf8" onChange={(next) => reset(next)} />
      <ScoreRow
        items={[
          ["Question", `${Math.min(index + 1, 5)}/5`],
          ["Score", total],
          ["Mode", promptMode.replaceAll("-", " ")],
          ["Seed", seed],
        ]}
      />
      <section className="panel p-6 sm:p-9">
        {!started ? (
          <div className="grid min-h-[370px] place-items-center text-center">
            <div>
              <p className="metric text-[#38bdf8]">Interview math, not casino theater</p>
              <h2 className="mt-4 text-3xl font-semibold">Price the uncertainty before risking capital.</h2>
              <p className="mx-auto mt-3 max-w-xl text-[#8995a7]">
                Five generated prompts cover expected value, fair price, odds, and Kelly-aware sizing.
              </p>
              <button className="btn btn-primary mt-7" onClick={begin}>
                Start session
              </button>
            </div>
          </div>
        ) : finished ? (
          <div className="grid min-h-[370px] place-items-center text-center">
            <div>
              <p className="metric text-[#38bdf8]">Session analysis</p>
              <h2 className="mt-4 text-5xl font-semibold">{Math.round((total / 5) * 10)}</h2>
              <AnalysisGrid
                items={[
                  ["Average", `${Math.round(total / 5)}%`],
                  ["Strong answers", results.filter((item) => item.score >= 75).length],
                  ["Questions", 5],
                  ["Seed", seed],
                ]}
              />
              <div className="mt-7 flex justify-center gap-2">
                <button className="btn btn-primary" onClick={() => reset()}>
                  New set
                </button>
                <button className="btn" onClick={() => reset(mode, true)}>
                  Replay seed
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-[390px]">
            <p className="metric text-[#38bdf8]">{promptMode.replaceAll("-", " ")}</p>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold leading-snug">{problem.prompt}</h2>
            {!result ? (
              promptMode === "take-or-pass" ? (
                <div className="mt-8 flex gap-3">
                  <button className="btn btn-primary min-w-32" onClick={() => choose("take")}>
                    Take
                  </button>
                  <button className="btn min-w-32" onClick={() => choose("pass")}>
                    Pass
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="mt-8 max-w-md">
                  <label className="metric mb-2 block" htmlFor="bet-answer">
                    Your answer
                  </label>
                  <input
                    id="bet-answer"
                    autoFocus
                    className="input text-xl"
                    type="number"
                    min="0"
                    step="any"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                  />
                  <button className="btn btn-primary mt-3">Check answer</button>
                </form>
              )
            ) : (
              <div className="mt-8 border-t border-[#283345] pt-7">
                <p
                  className="text-3xl font-semibold"
                  style={{ color: result.score >= 75 ? "#63e6be" : "#fbbf24" }}
                >
                  {result.score}/100
                </p>
                <p className="mt-3">
                  <strong>Reference:</strong> {result.answer}
                </p>
                <p className="mt-2 max-w-2xl text-[#9aa6b6]">{result.explanation}</p>
                <button className="btn btn-primary mt-6" onClick={next}>
                  {index >= 4 ? "View analysis" : "Next problem"}
                </button>
              </div>
            )}
          </div>
        )}
        <PersistenceNotice message={persistenceError} />
      </section>
    </GameShell>
  );
}

function makeProblem(seed: number, index: number, difficulty: Difficulty, mode: PromptMode) {
  const random = seededRandom(seed + index * 97 + difficultyIndex(difficulty) * 1009);
  const sides = 6 + difficultyIndex(difficulty) * 2;
  const threshold = Math.floor(sides * (0.55 + random() * 0.2));
  const probability = (sides - threshold + 1) / sides;
  const cost = 15 + Math.floor(random() * 25);
  const payout = cost + 20 + Math.floor(random() * 50);
  const ev = expectedProfit(probability, payout - cost, cost);
  const repeatProbability = 0.35 + random() * 0.4;
  const reward = 30 + Math.floor(random() * 90);
  const fairPrice = repeatProbability * reward;
  const oddsDirection = random() > 0.5 ? "probability" : "offered";
  const quotedProbability = 0.2 + random() * 0.65;
  const profitToOne = 0.5 + random() * 3;
  const target =
    oddsDirection === "probability" ? decimalOdds(quotedProbability) : impliedProbability(profitToOne);
  const bankroll = 500 * (1 + difficultyIndex(difficulty));
  const sizingProbability = 0.52 + random() * 0.25;
  const sizingOdds = 0.75 + random() * 1.5;
  const kelly = kellyFraction(sizingProbability, sizingOdds);
  const prompt =
    mode === "take-or-pass"
      ? `Pay $${cost}. Roll a d${sides}; ${threshold} or higher pays $${payout} total. Take or pass?`
      : mode === "fair-price"
        ? `A generated event has ${(repeatProbability * 100).toFixed(0)}% probability of paying $${reward}. What is its fair price?`
        : mode === "odds"
          ? oddsDirection === "probability"
            ? `${(quotedProbability * 100).toFixed(1)}% probability. What are the fair decimal odds?`
            : `Offered odds are ${profitToOne.toFixed(2)} to 1. Enter the implied probability as a decimal.`
          : `Bankroll $${bankroll}. Win probability ${(sizingProbability * 100).toFixed(1)}%; profit is ${sizingOdds.toFixed(2)} per $1 risked. What full-Kelly dollar wager is the reference?`;
  return { prompt, probability, ev, fairPrice, target, oddsDirection, bankroll, kelly };
}
