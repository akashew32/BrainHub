"use client";

import { useEffect, useRef, useState } from "react";
import { useGameSession } from "@/hooks/use-game-session";
import type { Difficulty } from "@/types/games";
import { GameShell, ScoreRow } from "./game-shell";

type Card = { id: number; shape: number; color: number; count: number; fill: number };
type Mode = "training" | "timed";
const attributes = ["shape", "color", "count", "fill"] as const;
const boardSize = { easy: 9, medium: 12, hard: 15, expert: 18 };
const timeLimit = { easy: 90, medium: 75, hard: 60, expert: 45 };

function monotonicNow() {
  return window.performance.now();
}

export function isValidSet(cards: Card[]) {
  return cards.length === 3 && attributes.every((key) => new Set(cards.map((card) => card[key])).size !== 2);
}

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function makeBoard(size: number, random = Math.random): Card[] {
  const all: Card[] = [];
  let id = 0;
  for (let shape = 0; shape < 3; shape++)
    for (let color = 0; color < 3; color++)
      for (let count = 0; count < 3; count++)
        for (let fill = 0; fill < 3; fill++) all.push({ id: id++, shape, color, count, fill });
  const guaranteed: Card[] = [0, 1, 2].map((value) => ({
    id: 1000 + value,
    shape: value,
    color: value,
    count: value,
    fill: value,
  }));
  const remaining = all.filter(
    (card) => !guaranteed.some((fixed) => attributes.every((key) => fixed[key] === card[key])),
  );
  for (let index = remaining.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [remaining[index], remaining[swap]] = [remaining[swap]!, remaining[index]!];
  }
  const board = [...guaranteed, ...remaining.slice(0, size - 3)];
  for (let index = board.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [board[index], board[swap]] = [board[swap]!, board[index]!];
  }
  return board;
}

export function PatternGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [mode, setMode] = useState<Mode>("training");
  const [board, setBoard] = useState(() => makeBoard(12, seededRandom(12_012)));
  const [selected, setSelected] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [sets, setSets] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [seconds, setSeconds] = useState(75);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState("Select any card to begin");
  const [solveTimes, setSolveTimes] = useState<number[]>([]);
  const boardStarted = useRef(0);
  const secondsRef = useRef(75);
  const latest = useRef({ score: 0, sets: 0, mistakes: 0, solveTimes: [] as number[] });
  const { persistenceError, startSession, completeSession } = useGameSession("pattern-recognition");

  useEffect(() => {
    if (!started || mode === "training") return;
    const id = window.setInterval(() => {
      if (secondsRef.current > 1) {
        secondsRef.current -= 1;
        setSeconds(secondsRef.current);
        return;
      }
      secondsRef.current = 0;
      setSeconds(0);
      const current = latest.current;
      const attempts = current.sets + current.mistakes;
      setStarted(false);
      setFinished(true);
      void completeSession(current.score, {
        sets_found: current.sets,
        mistakes: current.mistakes,
        accuracy: attempts ? (current.sets / attempts) * 100 : 0,
        average_solve_ms: average(current.solveTimes),
        fastest_solve_ms: current.solveTimes.length ? Math.min(...current.solveTimes) : 0,
        mode,
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [completeSession, mode, started]);

  function reset(nextDifficulty = difficulty) {
    setBoard(makeBoard(boardSize[nextDifficulty]));
    setSelected([]);
    setScore(0);
    setSets(0);
    setMistakes(0);
    setStreak(0);
    secondsRef.current = timeLimit[nextDifficulty];
    setSeconds(timeLimit[nextDifficulty]);
    setStarted(false);
    setFinished(false);
    setMessage("Select any card to begin");
    setSolveTimes([]);
    latest.current = { score: 0, sets: 0, mistakes: 0, solveTimes: [] };
  }

  function select(id: number) {
    if (finished) return;
    if (!started) {
      setStarted(true);
      boardStarted.current = monotonicNow();
      void startSession(difficulty);
    }
    const next = selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
    if (next.length > 3) return;
    setSelected(next);
    if (next.length !== 3) return;
    const cards = board.filter((card) => next.includes(card.id));
    if (isValidSet(cards)) {
      const elapsed = monotonicNow() - boardStarted.current;
      const nextSets = sets + 1;
      const nextStreak = streak + 1;
      const nextScore =
        score + 100 + Math.min(100, nextStreak * 10) + Math.max(0, Math.round(60 - elapsed / 100));
      const nextTimes = [...solveTimes, elapsed];
      setSets(nextSets);
      setStreak(nextStreak);
      setScore(nextScore);
      setSolveTimes(nextTimes);
      latest.current = { score: nextScore, sets: nextSets, mistakes, solveTimes: nextTimes };
      setMessage("Valid set — every attribute is all same or all different");
      setBoard(makeBoard(boardSize[difficulty]));
      boardStarted.current = monotonicNow();
    } else {
      const violations = attributes.filter((key) => new Set(cards.map((card) => card[key])).size === 2);
      const nextMistakes = mistakes + 1;
      const nextScore = Math.max(0, score - 25);
      setMistakes(nextMistakes);
      setStreak(0);
      setScore(nextScore);
      latest.current = { score: nextScore, sets, mistakes: nextMistakes, solveTimes };
      setMessage(
        `Invalid: ${violations.join(", ")} ${violations.length === 1 ? "is" : "are"} neither all same nor all different`,
      );
    }
    window.setTimeout(() => setSelected([]), 220);
  }

  function finishTraining() {
    const current = latest.current;
    const attempts = current.sets + current.mistakes;
    setStarted(false);
    setFinished(true);
    void completeSession(current.score, {
      sets_found: current.sets,
      mistakes: current.mistakes,
      accuracy: attempts ? (current.sets / attempts) * 100 : 0,
      average_solve_ms: average(current.solveTimes),
      fastest_solve_ms: current.solveTimes.length ? Math.min(...current.solveTimes) : 0,
      mode,
    });
  }

  const accuracy = sets + mistakes ? Math.round((sets / (sets + mistakes)) * 100) : 100;
  return (
    <GameShell
      slug="pattern-recognition"
      difficulty={difficulty}
      setDifficulty={(next) => {
        setDifficulty(next);
        reset(next);
      }}
      onRestart={() => reset()}
    >
      <div className="mb-4 flex gap-2">
        {(["training", "timed"] as Mode[]).map((item) => (
          <button
            key={item}
            className={`btn ${mode === item ? "border-[#63e6be] text-[#63e6be]" : ""}`}
            onClick={() => {
              setMode(item);
              reset();
            }}
          >
            {item}
          </button>
        ))}
      </div>
      <ScoreRow
        items={[
          ["Time", mode === "training" ? "Untimed" : `${seconds}s`],
          ["Score", score],
          ["Accuracy", `${accuracy}%`],
          ["Avg solve", solveTimes.length ? `${(average(solveTimes) / 1000).toFixed(1)}s` : "—"],
        ]}
      />
      <div className="panel p-4 sm:p-6">
        {finished ? (
          <div className="grid min-h-[420px] place-items-center text-center">
            <div>
              <p className="metric text-[#63e6be]">Session analysis</p>
              <h2 className="mt-4 text-5xl font-semibold">{score}</h2>
              <p className="mt-3 text-[#98a4b5]">
                {sets} sets · {accuracy}% accuracy ·{" "}
                {solveTimes.length
                  ? `${(Math.min(...solveTimes) / 1000).toFixed(1)}s fastest`
                  : "no completed sets"}
              </p>
              <button className="btn btn-primary mt-7" onClick={() => reset()}>
                Play again
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`mb-4 rounded-lg border px-4 py-3 text-sm ${message.startsWith("Invalid") ? "border-[#fb718555] text-[#fb7185]" : "border-[#63e6be33] text-[#9aa7b8]"}`}
              aria-live="polite"
            >
              {message}
            </div>
            <div
              className={`grid gap-3 ${board.length > 12 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-3 sm:grid-cols-4"}`}
            >
              {board.map((card, index) => (
                <PatternCard
                  key={`${card.id}-${index}`}
                  card={card}
                  selected={selected.includes(card.id)}
                  onClick={() => select(card.id)}
                />
              ))}
            </div>
            {mode === "training" && started ? (
              <button className="btn mt-4" onClick={finishTraining}>
                Finish training
              </button>
            ) : null}
          </>
        )}
        <p className="mt-3 text-xs text-[#758195]">{persistenceError}</p>
      </div>
    </GameShell>
  );
}

function PatternCard({ card, selected, onClick }: { card: Card; selected: boolean; onClick: () => void }) {
  const colors = ["#63e6be", "#c084fc", "#f59e0b"];
  const shapes = ["◆", "●", "▰"];
  return (
    <button
      aria-label={`Card ${card.id}`}
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-28 rounded-xl border bg-[#0a0e15] p-2 transition ${selected ? "scale-[.97] border-[#63e6be] shadow-[0_0_0_2px_#63e6be33]" : "border-[#2a3444] hover:border-[#526178]"}`}
    >
      <div
        className="flex justify-center gap-1 text-2xl sm:text-3xl"
        style={{ color: colors[card.color], opacity: card.fill === 2 ? 0.35 : 1 }}
      >
        {Array.from({ length: card.count + 1 }, (_, index) => (
          <span
            key={index}
            style={{
              WebkitTextStroke: card.fill === 1 ? `1px ${colors[card.color]}` : "",
              color: card.fill === 1 ? "transparent" : undefined,
            }}
          >
            {shapes[card.shape]}
          </span>
        ))}
      </div>
    </button>
  );
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
