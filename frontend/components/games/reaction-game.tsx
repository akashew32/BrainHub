"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameSession } from "@/hooks/use-game-session";
import type { Difficulty } from "@/types/games";
import { GameShell, ScoreRow } from "./game-shell";

type Phase = "idle" | "waiting" | "stimulus" | "result" | "complete";
type Mode = "simple" | "choice" | "go-no-go";

export function calculateReactionStats(times: number[]) {
  if (!times.length) return { average: 0, median: 0, best: 0, stddev: 0 };
  const sorted = [...times].sort((a, b) => a - b);
  const average = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((sum, value) => sum + (value - average) ** 2, 0) / times.length;
  return {
    average: Math.round(average),
    median: Math.round(sorted[Math.floor(sorted.length / 2)]!),
    best: Math.round(sorted[0]!),
    stddev: Math.round(Math.sqrt(variance)),
  };
}

export function ReactionGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [mode, setMode] = useState<Mode>("simple");
  const [phase, setPhase] = useState<Phase>("idle");
  const [times, setTimes] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [correctInhibitions, setCorrectInhibitions] = useState(0);
  const [trial, setTrial] = useState(0);
  const [target, setTarget] = useState("J");
  const [shouldReact, setShouldReact] = useState(true);
  const [lastResult, setLastResult] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responded = useRef(false);
  const start = useRef(0);
  const { persistenceError, startSession, completeSession } = useGameSession("reaction");
  const stats = calculateReactionStats(times);
  const totalJudgements = times.length + correctInhibitions + falseStarts + mistakes;
  const accuracy = totalJudgements
    ? Math.round(((times.length + correctInhibitions) / totalJudgements) * 100)
    : 100;

  const finish = useCallback(
    (nextTimes: number[], nextFalseStarts: number, nextMistakes: number, nextInhibitions: number) => {
      const summary = calculateReactionStats(nextTimes);
      const judgements = nextTimes.length + nextInhibitions + nextFalseStarts + nextMistakes;
      const finalAccuracy = judgements ? ((nextTimes.length + nextInhibitions) / judgements) * 100 : 0;
      const score = Math.max(
        0,
        Math.round(
          1000 -
            summary.median -
            summary.stddev * 2 -
            nextFalseStarts * 125 -
            nextMistakes * 100 +
            finalAccuracy * 2,
        ),
      );
      setPhase("complete");
      void completeSession(score, {
        ...summary,
        false_starts: nextFalseStarts,
        mistakes: nextMistakes,
        accuracy: finalAccuracy,
        mode,
        trials: 8,
      });
    },
    [completeSession, mode],
  );

  const record = useCallback(
    (reactionTime: number | null, errorType: "false-start" | "mistake" | null, inhibition = false) => {
      const nextTimes = reactionTime === null ? times : [...times, reactionTime];
      const nextFalseStarts = falseStarts + (errorType === "false-start" ? 1 : 0);
      const nextMistakes = mistakes + (errorType === "mistake" ? 1 : 0);
      const nextInhibitions = correctInhibitions + (inhibition ? 1 : 0);
      const nextTrial = trial + 1;
      setLastResult(
        inhibition
          ? "Correct inhibition"
          : errorType === "false-start"
            ? "False start"
            : errorType === "mistake"
              ? "Incorrect response"
              : `${Math.round(reactionTime!)} ms`,
      );
      setTimes(nextTimes);
      setFalseStarts(nextFalseStarts);
      setMistakes(nextMistakes);
      setCorrectInhibitions(nextInhibitions);
      setTrial(nextTrial);
      if (nextTrial >= 8) finish(nextTimes, nextFalseStarts, nextMistakes, nextInhibitions);
      else setPhase("result");
    },
    [correctInhibitions, falseStarts, finish, mistakes, times, trial],
  );

  const react = useCallback(
    (key?: string) => {
      if (responded.current) return;
      if (phase === "waiting") {
        responded.current = true;
        if (timer.current) clearTimeout(timer.current);
        record(null, "false-start");
        return;
      }
      if (phase !== "stimulus") return;
      if (!shouldReact) {
        responded.current = true;
        if (timer.current) clearTimeout(timer.current);
        record(null, "mistake");
        return;
      }
      if (mode === "choice" && key?.toUpperCase() !== target) {
        responded.current = true;
        record(null, "mistake");
        return;
      }
      responded.current = true;
      record(performance.now() - start.current, null);
    },
    [mode, phase, record, shouldReact, target],
  );

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        react();
      } else if (["f", "j"].includes(event.key.toLowerCase())) react(event.key);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [react]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function beginTrial() {
    if (trial === 0 && phase === "idle") void startSession(difficulty);
    responded.current = false;
    setPhase("waiting");
    const range = { easy: [1200, 2800], medium: [900, 2400], hard: [650, 2000], expert: [450, 1600] }[
      difficulty
    ];
    timer.current = setTimeout(
      () => {
        const nextTarget = Math.random() > 0.5 ? "J" : "F";
        const nextShouldReact = mode !== "go-no-go" || Math.random() > 0.35;
        setTarget(nextTarget);
        setShouldReact(nextShouldReact);
        start.current = performance.now();
        setPhase("stimulus");
        if (!nextShouldReact)
          timer.current = setTimeout(() => {
            if (!responded.current) {
              responded.current = true;
              record(null, null, true);
            }
          }, 900);
      },
      range[0] + Math.random() * (range[1] - range[0]),
    );
  }

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setTimes([]);
    setFalseStarts(0);
    setMistakes(0);
    setCorrectInhibitions(0);
    setTrial(0);
    setLastResult("");
    setPhase("idle");
  }

  const headline =
    phase === "idle"
      ? "Ready?"
      : phase === "waiting"
        ? "Wait…"
        : phase === "stimulus"
          ? mode === "choice"
            ? target
            : shouldReact
              ? "GO"
              : "NO-GO"
          : phase === "complete"
            ? `${stats.median} ms median`
            : lastResult;
  return (
    <GameShell
      slug="reaction"
      difficulty={difficulty}
      setDifficulty={(next) => {
        setDifficulty(next);
        reset();
      }}
      onRestart={reset}
    >
      <div className="mb-4 flex gap-2">
        {(["simple", "choice", "go-no-go"] as Mode[]).map((item) => (
          <button
            key={item}
            onClick={() => {
              setMode(item);
              reset();
            }}
            className={`btn ${mode === item ? "border-[#fb7185] text-[#fb7185]" : ""}`}
          >
            {item}
          </button>
        ))}
      </div>
      <ScoreRow
        items={[
          ["Trials", `${trial}/8`],
          ["Median", stats.median ? `${stats.median} ms` : "—"],
          ["Best", stats.best ? `${stats.best} ms` : "—"],
          ["Accuracy", `${accuracy}%`],
        ]}
      />
      <button
        onClick={() =>
          phase === "complete" ? reset() : phase === "idle" || phase === "result" ? beginTrial() : react()
        }
        className={`panel grid min-h-[420px] w-full place-items-center text-center transition-colors ${phase === "stimulus" && shouldReact ? "border-[#63e6be] bg-[#143c31]" : phase === "stimulus" ? "border-[#fb7185] bg-[#3c141c]" : phase === "waiting" ? "bg-[#24131a]" : ""}`}
      >
        <div>
          <p className="text-4xl font-semibold">{headline}</p>
          <p className="mt-3 text-[#8995a7]">
            {phase === "stimulus" && mode === "choice"
              ? `Press ${target}`
              : phase === "stimulus" && !shouldReact
                ? "Do nothing"
                : phase === "waiting"
                  ? "Do not react yet"
                  : phase === "complete"
                    ? `${falseStarts} false starts · ${mistakes} mistakes · ${stats.stddev} ms standard deviation`
                    : phase === "result"
                      ? "Click for next trial"
                      : "Click or press Space to begin"}
          </p>
          {phase === "complete" ? (
            <span className="btn btn-primary mt-6 inline-block">Play again</span>
          ) : null}
          <p className="mt-4 text-xs text-[#758195]">{persistenceError}</p>
        </div>
      </button>
    </GameShell>
  );
}
