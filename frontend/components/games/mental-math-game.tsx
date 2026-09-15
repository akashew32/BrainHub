"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useGameSession } from "@/hooks/use-game-session";
import type { Difficulty } from "@/types/games";
import { GameShell, ScoreRow } from "./game-shell";

type Problem = { prompt: string; answer: number; category: string };
type Mode = "60-second" | "2-minute" | "untimed";
const scales = { easy: 12, medium: 30, hard: 75, expert: 150 };
const modeSeconds: Record<Mode, number | null> = { "60-second": 60, "2-minute": 120, untimed: null };
const difficultyMultiplier: Record<Difficulty, number> = { easy: 1, medium: 1.25, hard: 1.55, expert: 1.9 };

export function calculateMathScore(
  correct: number,
  accuracy: number,
  difficulty: Difficulty,
  bestStreak = 0,
) {
  const streakMultiplier = 1 + Math.min(bestStreak, 10) * 0.03;
  return Math.round(
    correct * 100 * (1 + accuracy / 200) * difficultyMultiplier[difficulty] * streakMultiplier,
  );
}

export function calculateQuestionsPerMinute(responseTimes: number[], attempts: number) {
  const elapsedMs = responseTimes.reduce((sum, value) => sum + value, 0);
  return elapsedMs > 0 ? (attempts * 60_000) / elapsedMs : 0;
}

export function generateMathProblem(difficulty: Difficulty, random = Math.random): Problem {
  const max = scales[difficulty];
  const a = 2 + Math.floor(random() * max);
  const b = 2 + Math.floor(random() * Math.max(4, max / 5));
  const kind = Math.floor(random() * 12);
  if (kind === 0) return { prompt: `${a} + ${b}`, answer: a + b, category: "Arithmetic" };
  if (kind === 1) return { prompt: `${a * b} ÷ ${b}`, answer: a, category: "Arithmetic" };
  if (kind === 2) return { prompt: `${a} × ${b}`, answer: a * b, category: "Arithmetic" };
  if (kind === 3) {
    const pct = [5, 10, 12.5, 20, 25][Math.floor(random() * 5)]!;
    const base = (2 + Math.floor(random() * max)) * 20;
    return { prompt: `${pct}% of ${base}`, answer: (pct * base) / 100, category: "Percentages" };
  }
  if (kind === 4) {
    const quantity = (2 + Math.floor(random() * 18)) * 100;
    const move = (2 + Math.floor(random() * 28)) / 10;
    return {
      prompt: `PnL: long ${quantity.toLocaleString()} shares, +$${move}`,
      answer: quantity * move,
      category: "Trading",
    };
  }
  if (kind === 5) {
    const denominator = [4, 5, 8, 10, 16, 20, 25][Math.floor(random() * 7)]!;
    const numerator = 1 + Math.floor(random() * (denominator - 1));
    return {
      prompt: `${numerator}/${denominator} as a percentage`,
      answer: (numerator / denominator) * 100,
      category: "Fractions",
    };
  }
  if (kind === 6) {
    const start = 80 + Math.floor(random() * 80);
    const bps = [10, 25, 50, 75][Math.floor(random() * 4)]!;
    return {
      prompt: `${bps} bps of $${start}m`,
      answer: (start * bps) / 10000,
      category: "Basis points ($m)",
    };
  }
  if (kind === 7) {
    const n = 2 + Math.floor(random() * 13);
    const exponent = difficulty === "hard" || difficulty === "expert" ? (random() > 0.5 ? 3 : 2) : 2;
    return { prompt: `${n}${exponent === 2 ? "²" : "³"}`, answer: n ** exponent, category: "Powers" };
  }
  if (kind === 8) {
    const original = (2 + Math.floor(random() * max)) * 20;
    const pct = [10, 20, 25, 50][Math.floor(random() * 4)]!;
    return {
      prompt: `After +${pct}%, value is ${original * (1 + pct / 100)}. Original?`,
      answer: original,
      category: "Reverse percentage",
    };
  }
  if (kind === 9) {
    const n = 5 + Math.floor(random() * 5);
    const k = 2 + Math.floor(random() * Math.min(3, n - 2));
    return { prompt: `C(${n}, ${k})`, answer: combination(n, k), category: "Combinations" };
  }
  if (kind === 10) {
    const probability = [25, 40, 50, 60, 75][Math.floor(random() * 5)]!;
    const win = (2 + Math.floor(random() * 14)) * 10;
    const lose = (1 + Math.floor(random() * 7)) * 10;
    return {
      prompt: `EV: ${probability}% win $${win}, else lose $${lose}`,
      answer: (probability / 100) * win - (1 - probability / 100) * lose,
      category: "Expected value",
    };
  }
  const weight = [20, 25, 40, 60, 75, 80][Math.floor(random() * 6)]!;
  const low = (2 + Math.floor(random() * 18)) * 5;
  const high = (5 + Math.floor(random() * 25)) * 5;
  return {
    prompt: `${weight}% × ${low}, rest × ${high}`,
    answer: (weight / 100) * low + (1 - weight / 100) * high,
    category: "Weighted average",
  };
}

export function MentalMathGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [mode, setMode] = useState<Mode>("60-second");
  const [problem, setProblem] = useState(() => generateMathProblem("medium"));
  const [answer, setAnswer] = useState("");
  const [correct, setCorrect] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [seconds, setSeconds] = useState<number | null>(60);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const problemStarted = useRef(0);
  const secondsRef = useRef<number | null>(60);
  const latest = useRef({ correct: 0, attempts: 0, bestStreak: 0, responseTimes: [] as number[] });
  const { persistenceError, startSession, completeSession } = useGameSession("mental-math");

  useEffect(() => {
    if (!started || secondsRef.current === null) return;
    const id = window.setInterval(() => {
      if (secondsRef.current === null) return;
      if (secondsRef.current > 1) {
        secondsRef.current -= 1;
        setSeconds(secondsRef.current);
        return;
      }
      secondsRef.current = 0;
      setSeconds(0);
      setStarted(false);
      setFinished(true);
      const current = latest.current;
      const accuracy = current.attempts ? (current.correct / current.attempts) * 100 : 0;
      const score = calculateMathScore(current.correct, accuracy, difficulty, current.bestStreak);
      void completeSession(score, {
        correct: current.correct,
        attempts: current.attempts,
        accuracy,
        max_streak: current.bestStreak,
        questions_per_minute: calculateQuestionsPerMinute(current.responseTimes, current.attempts),
        average_response_ms: average(current.responseTimes),
        mode,
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [completeSession, difficulty, mode, started]);

  function restart(nextDifficulty = difficulty, nextMode = mode) {
    setProblem(generateMathProblem(nextDifficulty));
    setAnswer("");
    setCorrect(0);
    setAttempts(0);
    setStreak(0);
    setBestStreak(0);
    secondsRef.current = modeSeconds[nextMode];
    setSeconds(modeSeconds[nextMode]);
    setStarted(false);
    setFinished(false);
    setFeedback("");
    setResponseTimes([]);
    latest.current = { correct: 0, attempts: 0, bestStreak: 0, responseTimes: [] };
  }

  function begin() {
    void startSession(difficulty);
    problemStarted.current = performance.now();
    setStarted(true);
    input.current?.focus();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!answer.trim() || !Number.isFinite(Number(answer))) return;
    const elapsed = problemStarted.current ? performance.now() - problemStarted.current : 0;
    const isCorrect = Math.abs(Number(answer) - problem.answer) < 0.01;
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextAttempts = attempts + 1;
    const nextTimes = [...responseTimes, elapsed];
    const nextStreak = isCorrect ? streak + 1 : 0;
    const nextBestStreak = Math.max(bestStreak, nextStreak);
    setAttempts(nextAttempts);
    setCorrect(nextCorrect);
    setResponseTimes(nextTimes);
    setStreak(nextStreak);
    setBestStreak(nextBestStreak);
    latest.current = {
      correct: nextCorrect,
      attempts: nextAttempts,
      bestStreak: nextBestStreak,
      responseTimes: nextTimes,
    };
    setFeedback(isCorrect ? "Correct" : `Answer: ${problem.answer}`);
    setProblem(generateMathProblem(difficulty));
    setAnswer("");
    problemStarted.current = performance.now();
    requestAnimationFrame(() => input.current?.focus());
  }

  function finishUntimed() {
    setStarted(false);
    setFinished(true);
    const accuracy = attempts ? (correct / attempts) * 100 : 0;
    void completeSession(calculateMathScore(correct, accuracy, difficulty, bestStreak), {
      correct,
      attempts,
      accuracy,
      max_streak: bestStreak,
      questions_per_minute: calculateQuestionsPerMinute(responseTimes, attempts),
      average_response_ms: average(responseTimes),
      mode,
    });
  }

  const accuracy = attempts ? Math.round((correct / attempts) * 100) : 100;
  if (!started && !finished && attempts === 0)
    return (
      <GameShell
        slug="mental-math"
        difficulty={difficulty}
        setDifficulty={(next) => {
          setDifficulty(next);
          restart(next);
        }}
        onRestart={() => restart()}
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {(["60-second", "2-minute", "untimed"] as Mode[]).map((item) => (
            <button
              key={item}
              className={`btn ${mode === item ? "border-[#fbbf24] text-[#fbbf24]" : ""}`}
              onClick={() => {
                setMode(item);
                restart(difficulty, item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="panel grid min-h-[420px] place-items-center p-8 text-center">
          <div>
            <p className="metric text-[#fbbf24]">Keyboard-first sprint</p>
            <h2 className="mt-4 text-3xl font-semibold">Accuracy first. Speed follows.</h2>
            <p className="mx-auto mt-3 max-w-xl text-[#8995a7]">
              Questions mix arithmetic, fractions, percentages, powers, combinations, expected values,
              weighted averages, basis points, and trading PnL.
            </p>
            <button className="btn btn-primary mt-7" onClick={begin}>
              Start session
            </button>
          </div>
        </div>
      </GameShell>
    );
  return (
    <GameShell
      slug="mental-math"
      difficulty={difficulty}
      setDifficulty={(next) => {
        setDifficulty(next);
        restart(next);
      }}
      onRestart={() => restart()}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {(["60-second", "2-minute", "untimed"] as Mode[]).map((item) => (
          <button
            key={item}
            className={`btn ${mode === item ? "border-[#fbbf24] text-[#fbbf24]" : ""}`}
            onClick={() => {
              setMode(item);
              restart(difficulty, item);
            }}
          >
            {item}
          </button>
        ))}
      </div>
      <ScoreRow
        items={[
          ["Time", seconds === null ? "Untimed" : `${seconds}s`],
          ["Correct", correct],
          ["Accuracy", `${accuracy}%`],
          ["Streak", streak],
        ]}
      />
      <div className="panel grid min-h-[420px] place-items-center p-6 text-center">
        <div>
          {!finished ? (
            <>
              <p className="metric mb-5 text-[#fbbf24]">{problem.category}</p>
              <p className="text-4xl font-semibold sm:text-6xl">{problem.prompt}</p>
              <form className="mx-auto mt-10 max-w-sm" onSubmit={submit}>
                <input
                  ref={input}
                  autoFocus
                  inputMode="decimal"
                  aria-label="Answer"
                  className="input text-center text-2xl"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Type answer"
                />
                <button className="btn btn-primary mt-3 w-full">
                  Submit <span className="ml-2 opacity-60">↵</span>
                </button>
              </form>
              {mode === "untimed" && attempts > 0 ? (
                <button className="mt-4 text-sm text-[#8995a7] underline" onClick={finishUntimed}>
                  End accuracy session
                </button>
              ) : null}
            </>
          ) : (
            <>
              <p className="metric text-[#fbbf24]">Session analysis</p>
              <p className="mt-4 text-5xl font-semibold">
                {correct}/{attempts}
              </p>
              <p className="mt-3 text-[#98a4b5]">
                {accuracy}% accuracy · {(average(responseTimes) / 1000 || 0).toFixed(1)}s average response ·{" "}
                {Math.round(calculateQuestionsPerMinute(responseTimes, attempts))} questions/min ·{" "}
                {bestStreak} best streak
              </p>
              <button className="btn btn-primary mt-7" onClick={() => restart()}>
                Play again
              </button>
            </>
          )}
          <p
            aria-live="polite"
            className={`mt-4 h-6 text-sm ${feedback === "Correct" ? "text-[#63e6be]" : "text-[#fb7185]"}`}
          >
            {feedback}
          </p>
          <p className="text-xs text-[#758195]">{persistenceError}</p>
        </div>
      </div>
    </GameShell>
  );
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function combination(n: number, k: number) {
  let result = 1;
  for (let index = 1; index <= k; index++) result = (result * (n - index + 1)) / index;
  return result;
}
