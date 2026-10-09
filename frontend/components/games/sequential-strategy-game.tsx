"use client";

import { useMemo, useState } from "react";
import { useGameSession } from "@/hooks/use-game-session";
import {
  difficultyIndex,
  isWinningTakeaway,
  optimalTakeawayMoves,
  penneyResponse,
  seededRandom,
} from "@/lib/quant-games";
import type { Difficulty } from "@/types/games";
import { GameShell, ScoreRow } from "./game-shell";
import { AnalysisGrid, ModeTabs, PersistenceNotice } from "./quant-game-ui";

type Mode = "take-away" | "coin-race" | "dice-choice";
type Review = {
  before: number;
  move: number;
  optimal: number[];
  beforeWinning: boolean;
  afterWinning: boolean;
};
const modes: Mode[] = ["take-away", "coin-race", "dice-choice"];
const sequences = ["HHH", "HHT", "HTH", "HTT", "THH", "THT", "TTH", "TTT"];
const dice = {
  A: [0, 0, 4, 4, 4, 4],
  B: [3, 3, 3, 3, 3, 3],
  C: [2, 2, 2, 2, 6, 6],
  D: [1, 1, 1, 5, 5, 5],
};

export function SequentialStrategyGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [mode, setMode] = useState<Mode>("take-away");
  const [seed, setSeed] = useState(6803);
  const [started, setStarted] = useState(false);
  const [stones, setStones] = useState(21);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [message, setMessage] = useState("Your move");
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState<boolean | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, string | number> | null>(null);
  const { persistenceError, startSession, completeSession } = useGameSession("sequential-strategy");
  const moves = useMemo(() => (difficultyIndex(difficulty) >= 2 ? [1, 3, 4] : [1, 2, 3]), [difficulty]);
  const opponentSequence = useMemo(
    () => sequences[(seed + difficultyIndex(difficulty)) % sequences.length]!,
    [difficulty, seed],
  );
  const score = Math.round(
    (reviews.filter((item) => item.optimal.includes(item.move)).length / Math.max(1, reviews.length)) * 1000,
  );

  function finishGame(nextWon: boolean, nextReviews: Review[], extra: Record<string, string | number> = {}) {
    const correct = nextReviews.filter((item) => item.optimal.includes(item.move)).length;
    const accuracy = nextReviews.length ? (correct / nextReviews.length) * 100 : Number(extra.accuracy ?? 0);
    const finalScore = nextReviews.length ? Math.round(accuracy * 10) : Number(extra.score ?? 0);
    setFinished(true);
    setWon(nextWon);
    setAnalysis(extra);
    void completeSession(
      finalScore,
      {
        mode,
        seed,
        accuracy,
        optimal_move_percentage: accuracy,
        wins: Number(nextWon),
        losses: Number(!nextWon),
        ...extra,
      },
      nextWon,
    );
  }

  function take(move: number) {
    if (!started || finished || move > stones) return;
    const optimal = optimalTakeawayMoves(stones, moves);
    const afterPlayer = stones - move;
    const review: Review = {
      before: stones,
      move,
      optimal,
      beforeWinning: isWinningTakeaway(stones, moves),
      afterWinning: isWinningTakeaway(afterPlayer, moves),
    };
    const nextReviews = [...reviews, review];
    setReviews(nextReviews);
    if (afterPlayer === 0) {
      setStones(0);
      setMessage("You took the final stone");
      finishGame(true, nextReviews);
      return;
    }
    const aiOptimal = optimalTakeawayMoves(afterPlayer, moves);
    const aiMove = aiOptimal[0] ?? moves.filter((candidate) => candidate <= afterPlayer)[0]!;
    const afterAi = afterPlayer - aiMove;
    setStones(afterAi);
    setMessage(`Opponent took ${aiMove}`);
    if (afterAi === 0) finishGame(false, nextReviews);
  }

  function chooseSequence(sequence: string) {
    const random = seededRandom(seed);
    let tape = "";
    while (!tape.includes(sequence) && !tape.includes(opponentSequence) && tape.length < 10_000)
      tape += random() < 0.5 ? "H" : "T";
    const nextWon = tape.indexOf(sequence) <= tape.indexOf(opponentSequence) && tape.includes(sequence);
    const best = penneyResponse(opponentSequence);
    const accuracy = sequence === best ? 100 : 35;
    setMessage(tape.slice(-18));
    finishGame(nextWon, [], {
      player_sequence: sequence,
      opponent_sequence: opponentSequence,
      optimal_response: best,
      accuracy,
      score: accuracy * 10,
      ev_regret: sequence === best ? 0 : 0.35,
    });
  }

  function chooseDie(name: keyof typeof dice) {
    const responses = (Object.keys(dice) as Array<keyof typeof dice>)
      .filter((other) => other !== name)
      .map((other) => ({ other, p: winProbability(dice[other], dice[name]) }));
    const counter = responses.reduce((best, item) => (item.p > best.p ? item : best));
    const random = seededRandom(seed);
    let playerWins = 0;
    for (let index = 0; index < 12; index += 1) {
      const player = dice[name][Math.floor(random() * 6)]!;
      const opponent = dice[counter.other][Math.floor(random() * 6)]!;
      if (player > opponent) playerWins += 1;
    }
    const nextWon = playerWins >= 7;
    setMessage(`Opponent countered with die ${counter.other}; you won ${playerWins}/12 rolls.`);
    finishGame(nextWon, [], {
      player_die: name,
      opponent_die: counter.other,
      opponent_win_probability: counter.p,
      accuracy: Math.max(0, 100 - counter.p * 100),
      score: Math.round((1 - counter.p) * 1000),
      ev_regret: counter.p - 0.5,
    });
  }

  function reset(nextMode = mode, nextDifficulty = difficulty, replay = false) {
    const nextSeed = replay ? seed : seed + 1;
    const random = seededRandom(nextSeed);
    setMode(nextMode);
    setSeed(nextSeed);
    setStarted(false);
    setStones(16 + difficultyIndex(nextDifficulty) * 3 + Math.floor(random() * 7));
    setReviews([]);
    setMessage("Your move");
    setFinished(false);
    setWon(null);
    setAnalysis(null);
  }
  function begin() {
    setStarted(true);
    void startSession(difficulty);
  }

  return (
    <GameShell
      slug="sequential-strategy"
      difficulty={difficulty}
      setDifficulty={(next) => {
        setDifficulty(next);
        reset(mode, next);
      }}
      onRestart={() => reset()}
    >
      <ModeTabs modes={modes} value={mode} accent="#fb7185" onChange={(next) => reset(next)} />
      <ScoreRow
        items={[
          [mode === "take-away" ? "Stones" : "Round", mode === "take-away" ? stones : 1],
          ["Decision score", score],
          ["Moves reviewed", reviews.length],
          ["Seed", seed],
        ]}
      />
      <section className="panel p-6 sm:p-9">
        {!started ? (
          <div className="grid min-h-[370px] place-items-center text-center">
            <div>
              <p className="metric text-[#fb7185]">Exact finite-game reasoning</p>
              <h2 className="mt-4 text-3xl font-semibold">Every move changes the game tree.</h2>
              <p className="mx-auto mt-3 max-w-xl text-[#8995a7]">
                The opponent uses backward induction, exact sequence logic, or exhaustive die comparison.
              </p>
              <button className="btn btn-primary mt-7" onClick={begin}>
                Start game
              </button>
            </div>
          </div>
        ) : finished ? (
          <div>
            <p className="metric text-[#fb7185]">Game analysis</p>
            <h2 className="mt-3 text-4xl font-semibold">{won ? "You won" : "Opponent won"}</h2>
            <p className="mt-3 text-[#aab4c2]">{message}</p>
            {mode === "take-away" ? (
              <div className="mt-6 space-y-2">
                {reviews.map((item, index) => (
                  <div
                    key={`${item.before}-${index}`}
                    className="grid gap-2 rounded-xl border border-[#283345] p-4 text-sm sm:grid-cols-5"
                  >
                    <span>{item.before} stones</span>
                    <span>You took {item.move}</span>
                    <span>Optimal {item.optimal.join("/") || "none"}</span>
                    <span>Before: {item.beforeWinning ? "winning" : "losing"}</span>
                    <span>After: {item.afterWinning ? "winning" : "losing"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <AnalysisGrid items={Object.entries(analysis ?? {})} />
            )}
            <button className="btn btn-primary mt-7" onClick={() => reset()}>
              Play again
            </button>
          </div>
        ) : mode === "take-away" ? (
          <div className="grid min-h-[360px] content-center">
            <p className="metric text-[#fb7185]">{message}</p>
            <h2 className="mt-4 text-6xl font-semibold">{stones} stones</h2>
            <p className="mt-3 text-[#8995a7]">
              Take the final stone to win. Legal moves: {moves.join(", ")}.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {moves
                .filter((move) => move <= stones)
                .map((move) => (
                  <button className="btn min-w-24" key={move} onClick={() => take(move)}>
                    Take {move}
                  </button>
                ))}
            </div>
          </div>
        ) : mode === "coin-race" ? (
          <div>
            <p className="metric text-[#fb7185]">Penney-style sequence race</p>
            <h2 className="mt-4 text-3xl font-semibold">
              Opponent chose {opponentSequence}. Choose your response.
            </h2>
            <div className="mt-8 grid grid-cols-4 gap-2 sm:grid-cols-8">
              {sequences
                .filter((item) => item !== opponentSequence)
                .map((item) => (
                  <button className="btn" key={item} onClick={() => chooseSequence(item)}>
                    {item}
                  </button>
                ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="metric text-[#fb7185]">Non-transitive dice · opponent chooses second</p>
            <h2 className="mt-4 text-3xl font-semibold">
              Choose a die. The opponent will counter after seeing it.
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              {(Object.keys(dice) as Array<keyof typeof dice>).map((name) => (
                <button className="btn p-5" key={name} onClick={() => chooseDie(name)}>
                  <strong className="text-xl">Die {name}</strong>
                  <span className="mt-2 block text-xs text-[#8995a7]">{dice[name].join(" · ")}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <PersistenceNotice message={persistenceError} />
      </section>
    </GameShell>
  );
}

function winProbability(first: number[], second: number[]) {
  let wins = 0;
  let total = 0;
  for (const left of first)
    for (const right of second) {
      total += 1;
      if (left > right) wins += 1;
      else if (left === right) wins += 0.5;
    }
  return wins / total;
}
