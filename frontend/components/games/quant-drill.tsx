"use client";

import { type FormEvent, useRef, useState } from "react";
import { useGameSession } from "@/hooks/use-game-session";
import { gameMap } from "@/lib/games";
import type { Difficulty, GameSlug } from "@/types/games";
import { GameShell, ScoreRow } from "./game-shell";

export type DrillQuestion = {
  prompt: string;
  context: string;
  answer: number;
  tolerance: number;
  errorMode?: "absolute" | "relative";
  prefix?: string;
  suffix?: string;
  decimals?: number;
  explanation: string;
};

export type DrillGenerator = (difficulty: Difficulty, random?: () => number) => DrillQuestion;

type Feedback = ReturnType<typeof scoreDrillAnswer> & { responseMs: number };
type Phase = "intro" | "playing" | "finished";

const roundCounts: Record<Difficulty, number> = { easy: 5, medium: 6, hard: 7, expert: 8 };

export function scoreDrillAnswer(question: DrillQuestion, response: number) {
  const rawError = Math.abs(response - question.answer);
  const toleranceAmount =
    question.errorMode === "relative"
      ? Math.max(Math.abs(question.answer), 1) * question.tolerance
      : question.tolerance;
  const normalizedError = rawError / Math.max(toleranceAmount, Number.EPSILON);
  return {
    correct: normalizedError <= 1,
    error: rawError,
    points: Math.round(100 * Math.exp(-0.45 * normalizedError)),
  };
}

function formatValue(value: number, question: DrillQuestion) {
  return `${question.prefix ?? ""}${value.toLocaleString(undefined, {
    minimumFractionDigits: question.decimals ?? 0,
    maximumFractionDigits: question.decimals ?? 2,
  })}${question.suffix ?? ""}`;
}

export function QuantDrill({
  slug,
  generator,
  focus,
}: {
  slug: GameSlug;
  generator: DrillGenerator;
  focus: string;
}) {
  const game = gameMap[slug];
  const [difficulty, setDifficulty] = useState<Difficulty>(game.defaultDifficulty);
  const [phase, setPhase] = useState<Phase>("intro");
  const [question, setQuestion] = useState<DrillQuestion | null>(null);
  const [round, setRound] = useState(0);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [responseTotalMs, setResponseTotalMs] = useState(0);
  const questionStartedAt = useRef(0);
  const { persistenceError, startSession, completeSession } = useGameSession(slug);
  const totalRounds = roundCounts[difficulty];

  function reset(nextDifficulty = difficulty) {
    setDifficulty(nextDifficulty);
    setPhase("intro");
    setQuestion(null);
    setRound(0);
    setValue("");
    setFeedback(null);
    setScore(0);
    setCorrect(0);
    setStreak(0);
    setBestStreak(0);
    setResponseTotalMs(0);
  }

  function begin() {
    setQuestion(generator(difficulty));
    setPhase("playing");
    questionStartedAt.current = performance.now();
    void startSession(difficulty);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question || feedback) return;
    const response = Number(value);
    if (!Number.isFinite(response)) return;
    const responseMs = performance.now() - questionStartedAt.current;
    const result = { ...scoreDrillAnswer(question, response), responseMs };
    setResponseTotalMs((current) => current + responseMs);
    setFeedback(result);
    setScore((current) => current + result.points);
    if (result.correct) {
      const nextStreak = streak + 1;
      setCorrect((current) => current + 1);
      setStreak(nextStreak);
      setBestStreak((current) => Math.max(current, nextStreak));
    } else {
      setStreak(0);
    }
  }

  function advance() {
    if (!question || !feedback) return;
    const attempts = round + 1;
    if (attempts >= totalRounds) {
      const averageResponseMs = responseTotalMs / totalRounds;
      setPhase("finished");
      void completeSession(score, {
        accuracy: Math.round((correct / totalRounds) * 100),
        average_response_ms: Math.round(averageResponseMs),
        best_streak: bestStreak,
        questions: totalRounds,
      });
      return;
    }
    setRound(attempts);
    setQuestion(generator(difficulty));
    setValue("");
    setFeedback(null);
    questionStartedAt.current = performance.now();
  }

  const accuracy = round + (feedback ? 1 : 0) > 0 ? (correct / (round + (feedback ? 1 : 0))) * 100 : 0;
  const averageResponse = responseTotalMs / totalRounds / 1000;

  return (
    <GameShell
      slug={slug}
      difficulty={difficulty}
      setDifficulty={(next) => reset(next)}
      onRestart={() => reset()}
    >
      {phase === "intro" ? (
        <div className="panel grid min-h-[420px] place-items-center p-8 text-center">
          <div className="max-w-2xl">
            <p className="metric" style={{ color: game.accent }}>
              {totalRounds}-question decision set
            </p>
            <h2 className="mt-4 text-3xl font-semibold">{focus}</h2>
            <p className="mt-3 leading-7 text-[#8995a7]">
              Work from the information given, submit a numeric answer, then compare your method with the
              model calculation before moving on.
            </p>
            <button className="btn btn-primary mt-7" onClick={begin}>
              Start session
            </button>
          </div>
        </div>
      ) : null}

      {phase === "playing" && question ? (
        <>
          <ScoreRow
            items={[
              ["Question", `${round + 1}/${totalRounds}`],
              ["Score", score],
              ["Accuracy", `${Math.round(accuracy)}%`],
              ["Streak", streak],
            ]}
          />
          <div className="panel overflow-hidden">
            <div className="h-1 bg-[#151d28]">
              <div
                className="h-full transition-all"
                style={{ background: game.accent, width: `${((round + 1) / totalRounds) * 100}%` }}
              />
            </div>
            <div className="p-6 sm:p-10">
              <p className="metric" style={{ color: game.accent }}>
                {game.scoring}
              </p>
              <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight">{question.prompt}</h2>
              <p className="mt-4 whitespace-pre-line font-mono text-sm leading-7 text-[#a7b1c0]">
                {question.context}
              </p>
              {!feedback ? (
                <form className="mt-9 max-w-lg" onSubmit={submit}>
                  <label className="metric mb-2 block" htmlFor={`${slug}-answer`}>
                    Your answer {question.suffix ? `(${question.suffix.trim()})` : ""}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`${slug}-answer`}
                      autoFocus
                      className="input text-xl"
                      inputMode="decimal"
                      type="number"
                      step="any"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      placeholder="Enter a number"
                    />
                    <button className="btn btn-primary" type="submit">
                      Submit
                    </button>
                  </div>
                </form>
              ) : (
                <div className="enter mt-9 border-t border-[#202937] pt-7">
                  <div className="flex flex-wrap gap-10">
                    <div>
                      <p className="text-4xl font-semibold" style={{ color: game.accent }}>
                        +{feedback.points}
                      </p>
                      <p className="metric">Round score</p>
                    </div>
                    <div>
                      <p className="text-xl font-semibold">{formatValue(question.answer, question)}</p>
                      <p className="metric">Model answer</p>
                    </div>
                    <div>
                      <p className="text-xl font-semibold">{(feedback.responseMs / 1000).toFixed(1)}s</p>
                      <p className="metric">Response time</p>
                    </div>
                  </div>
                  <p className="mt-6 max-w-3xl leading-7 text-[#aab4c2]">{question.explanation}</p>
                  <button className="btn mt-6" onClick={advance}>
                    {round + 1 >= totalRounds ? "View analysis" : "Next question →"}
                  </button>
                </div>
              )}
              <p className="mt-4 text-xs text-[#758195]">{persistenceError}</p>
            </div>
          </div>
        </>
      ) : null}

      {phase === "finished" ? (
        <div className="panel grid min-h-[420px] place-items-center p-8 text-center">
          <div>
            <p className="metric" style={{ color: game.accent }}>
              Session analysis
            </p>
            <h2 className="mt-4 text-5xl font-semibold">
              {score}/{totalRounds * 100}
            </h2>
            <div className="mt-7 flex flex-wrap justify-center gap-8 text-left">
              <div>
                <p className="text-xl font-semibold">{Math.round((correct / totalRounds) * 100)}%</p>
                <p className="metric">Accuracy</p>
              </div>
              <div>
                <p className="text-xl font-semibold">{averageResponse.toFixed(1)}s</p>
                <p className="metric">Avg response</p>
              </div>
              <div>
                <p className="text-xl font-semibold">{bestStreak}</p>
                <p className="metric">Best streak</p>
              </div>
            </div>
            <button className="btn btn-primary mt-8" onClick={() => reset()}>
              Play again
            </button>
          </div>
        </div>
      ) : null}
    </GameShell>
  );
}
