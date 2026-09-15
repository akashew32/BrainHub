"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useGameSession } from "@/hooks/use-game-session";
import type { Difficulty } from "@/types/games";
import { fermiFeedback, fermiQuestions, fermiScore } from "./fermi-game";
import { GameShell, ScoreRow } from "./game-shell";

type Mode = "practice" | "timed";
const limits = { easy: 60, medium: 45, hard: 30, expert: 20 };

export function FermiTrainingGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [mode, setMode] = useState<Mode>("practice");
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<ReturnType<typeof fermiScore> | null>(null);
  const [total, setTotal] = useState(0);
  const [ratios, setRatios] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(limits.medium);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const secondsRef = useRef(limits.medium);
  const { persistenceError, startSession, completeSession } = useGameSession("fermi");
  const question = fermiQuestions[index % fermiQuestions.length]!;

  useEffect(() => {
    if (mode !== "timed" || !started || result || finished) return;
    const id = window.setInterval(() => {
      if (secondsRef.current > 1) {
        secondsRef.current -= 1;
        setSeconds(secondsRef.current);
        return;
      }
      secondsRef.current = 0;
      setSeconds(0);
      setResult({ score: 0, ratio: 0 });
    }, 1000);
    return () => window.clearInterval(id);
  }, [finished, mode, result, started]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const answer = Number(value);
    if (answer <= 0) return;
    const next = fermiScore(answer, question.reference);
    setResult(next);
    setTotal((current) => current + next.score);
    setRatios((current) => [...current, next.ratio]);
  }

  function next() {
    if (index >= 4) {
      setFinished(true);
      const calibration = ratios.length
        ? Math.exp(ratios.reduce((sum, ratio) => sum + Math.abs(Math.log(ratio)), 0) / ratios.length)
        : 0;
      void completeSession(total, {
        questions: 5,
        average_score: total / 5,
        calibration_factor: calibration,
        mode,
      });
      return;
    }
    secondsRef.current = limits[difficulty];
    setIndex((current) => current + 1);
    setValue("");
    setResult(null);
    setSeconds(limits[difficulty]);
  }

  function reset(nextDifficulty = difficulty, nextMode = mode) {
    secondsRef.current = limits[nextDifficulty];
    setIndex(0);
    setValue("");
    setResult(null);
    setTotal(0);
    setRatios([]);
    setSeconds(limits[nextDifficulty]);
    setStarted(false);
    setFinished(false);
    setMode(nextMode);
  }

  function begin() {
    setStarted(true);
    secondsRef.current = limits[difficulty];
    setSeconds(limits[difficulty]);
    void startSession(difficulty);
  }

  const displayedRatio = result?.ratio
    ? `${Math.max(result.ratio, 1 / result.ratio).toFixed(2)}×`
    : result
      ? "Timed out"
      : "—";
  if (!started)
    return (
      <GameShell
        slug="fermi"
        difficulty={difficulty}
        setDifficulty={(next) => {
          setDifficulty(next);
          reset(next);
        }}
        onRestart={() => reset()}
      >
        <div className="mb-4 flex gap-2">
          {(["practice", "timed"] as Mode[]).map((item) => (
            <button
              key={item}
              className={`btn ${mode === item ? "border-[#c084fc] text-[#c084fc]" : ""}`}
              onClick={() => reset(difficulty, item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="panel grid min-h-[420px] place-items-center p-8 text-center">
          <div>
            <p className="metric text-[#c084fc]">Five-question calibration set</p>
            <h2 className="mt-4 text-3xl font-semibold">Think in assumptions and orders of magnitude.</h2>
            <p className="mx-auto mt-3 max-w-xl text-[#8995a7]">
              Reference values are ranges, not pretend certainties. You will see a defensible decomposition
              after every estimate.
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
      slug="fermi"
      difficulty={difficulty}
      setDifficulty={(next) => {
        setDifficulty(next);
        reset(next);
      }}
      onRestart={() => reset()}
    >
      <div className="mb-4 flex gap-2">
        {(["practice", "timed"] as Mode[]).map((item) => (
          <button
            key={item}
            className={`btn ${mode === item ? "border-[#c084fc] text-[#c084fc]" : ""}`}
            onClick={() => reset(difficulty, item)}
          >
            {item}
          </button>
        ))}
      </div>
      <ScoreRow
        items={[
          ["Question", `${Math.min(index + 1, 5)}/5`],
          ["Total score", total],
          ["Category", question.category],
          [mode === "timed" ? "Time" : "Calibration", mode === "timed" ? `${seconds}s` : displayedRatio],
        ]}
      />
      <div className="panel p-6 sm:p-10">
        {finished ? (
          <div className="grid min-h-[380px] place-items-center text-center">
            <div>
              <p className="metric text-[#c084fc]">Session analysis</p>
              <h2 className="mt-4 text-5xl font-semibold">{total}/500</h2>
              <p className="mt-3 text-[#98a4b5]">
                Average logarithmic calibration score: {Math.round(total / 5)}
              </p>
              <button className="btn btn-primary mt-7" onClick={() => reset()}>
                Play again
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="metric text-[#c084fc]">Estimate the scale, not false precision</p>
            <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight">{question.prompt}</h2>
            {!result ? (
              <form onSubmit={submit} className="mt-10 max-w-lg">
                <label className="metric mb-2 block" htmlFor="estimate">
                  Your estimate
                </label>
                <input
                  id="estimate"
                  autoFocus
                  className="input text-xl"
                  type="number"
                  min="0"
                  step="any"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="Enter a positive number"
                />
                <button className="btn btn-primary mt-3">Score estimate</button>
              </form>
            ) : (
              <div className="enter mt-9 border-t border-[#202937] pt-7">
                <div className="flex flex-wrap gap-10">
                  <div>
                    <p className="text-4xl font-semibold text-[#c084fc]">{result.score}</p>
                    <p className="metric">Score</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold">
                      {question.low.toLocaleString()} – {question.high.toLocaleString()}
                    </p>
                    <p className="metric">Defensible range</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold">{displayedRatio}</p>
                    <p className="metric">Error factor</p>
                  </div>
                </div>
                <p className="mt-6 max-w-2xl text-[#aab4c2]">
                  <strong className="text-white">One decomposition:</strong> {question.reasoning}
                </p>
                <button className="btn mt-6" onClick={next}>
                  {index >= 4 ? "View analysis" : "Next estimate →"}
                </button>
              </div>
            )}
          </>
        )}
        {result ? <p className="mt-5 font-semibold text-[#c084fc]">{fermiFeedback(result.ratio)}</p> : null}
        <p className="mt-4 text-xs text-[#758195]">{persistenceError}</p>
      </div>
    </GameShell>
  );
}
