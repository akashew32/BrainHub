"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useGameSession } from "@/hooks/use-game-session";
import {
  cardStoppingDecision,
  difficultyIndex,
  offerContinuationValue,
  seededRandom,
  stoppingDecision,
} from "@/lib/quant-games";
import type { Difficulty } from "@/types/games";
import { GameShell, ScoreRow } from "./game-shell";
import { AnalysisGrid, ModeTabs, PersistenceNotice } from "./quant-game-ui";

type Mode = "dice" | "cards" | "search";
type Review = {
  state: string;
  action: "stop" | "continue";
  optimal: "stop" | "continue";
  stopEv: number;
  continueEv: number;
  regret: number;
};

const modes: Mode[] = ["dice", "cards", "search"];
const offerValues = [20, 35, 50, 65, 80, 95];

export function OptimalStoppingGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [mode, setMode] = useState<Mode>("dice");
  const [seed, setSeed] = useState(731);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [value, setValue] = useState(10);
  const [stepsLeft, setStepsLeft] = useState(5);
  const [deck, setDeck] = useState<number[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [lastOutcome, setLastOutcome] = useState("Awaiting your decision");
  const { persistenceError, startSession, completeSession } = useGameSession("optimal-stopping");

  const decision = useMemo(() => {
    if (mode === "dice") return stoppingDecision(value, stepsLeft);
    if (mode === "cards") return cardStoppingDecision(value, deck, stepsLeft);
    const continueEv = offerContinuationValue(Math.max(0, stepsLeft - 1), offerValues);
    return {
      stopEv: value,
      continueEv,
      optimal: continueEv > value ? ("continue" as const) : ("stop" as const),
    };
  }, [deck, mode, stepsLeft, value]);

  const finish = useCallback(
    (finalValue: number, finalReviews: Review[]) => {
      const correct = finalReviews.filter((item) => item.action === item.optimal).length;
      const regret = finalReviews.reduce((sum, item) => sum + item.regret, 0);
      const accuracy = finalReviews.length ? (correct / finalReviews.length) * 100 : 0;
      const score = Math.max(0, Math.round(1000 - regret * 45));
      setValue(finalValue);
      setFinished(true);
      void completeSession(score, {
        mode,
        seed,
        decisions: finalReviews.length,
        accuracy,
        optimal_decision_percentage: accuracy,
        cumulative_ev_lost: regret,
        average_ev_loss: regret / Math.max(1, finalReviews.length),
        final_payoff: finalValue,
      });
    },
    [completeSession, mode, seed],
  );

  const act = useCallback(
    (action: "stop" | "continue") => {
      if (!started || finished) return;
      const chosenEv = action === "stop" ? decision.stopEv : decision.continueEv;
      const optimalEv = Math.max(decision.stopEv, decision.continueEv);
      const review: Review = {
        state: mode === "search" ? `Offer $${value}` : `Value $${value} · ${stepsLeft} choices left`,
        action,
        optimal: decision.optimal,
        stopEv: decision.stopEv,
        continueEv: decision.continueEv,
        regret: Math.max(0, optimalEv - chosenEv),
      };
      const nextReviews = [...reviews, review];
      setReviews(nextReviews);
      if (action === "stop") {
        setLastOutcome(`Banked $${value}`);
        finish(value, nextReviews);
        return;
      }
      const random = seededRandom(seed + reviews.length * 101 + difficultyIndex(difficulty));
      const remaining = stepsLeft - 1;
      if (mode === "dice") {
        const roll = Math.floor(random() * 6) + 1;
        const nextValue = roll <= 4 ? value + roll : roll === 5 ? value + 10 : 0;
        setLastOutcome(
          roll === 6 ? "Rolled 6 — bust" : roll === 5 ? "Rolled 5 — added $10" : `Rolled ${roll}`,
        );
        setValue(nextValue);
        setStepsLeft(remaining);
        if (roll === 6 || remaining === 0) finish(nextValue, nextReviews);
      } else if (mode === "cards") {
        const index = Math.floor(random() * deck.length);
        const card = deck[index] ?? 0;
        const nextDeck = deck.filter((_, itemIndex) => itemIndex !== index);
        const nextValue = value + card;
        setDeck(nextDeck);
        setValue(nextValue);
        setStepsLeft(remaining);
        setLastOutcome(`Drew ${card >= 0 ? "+" : ""}${card}`);
        if (remaining === 0 || nextDeck.length === 0) finish(nextValue, nextReviews);
      } else {
        const nextOffer = offerValues[Math.floor(random() * offerValues.length)]!;
        setValue(nextOffer);
        setStepsLeft(remaining);
        setLastOutcome(`The next offer is $${nextOffer}`);
        if (remaining === 0) finish(nextOffer, nextReviews);
      }
    },
    [decision, deck, difficulty, finish, finished, mode, reviews, seed, started, stepsLeft, value],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "c") act("continue");
      if (event.key.toLowerCase() === "s") act("stop");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [act]);

  function reset(nextMode = mode, nextDifficulty = difficulty, replay = false) {
    const nextSeed = replay ? seed : seed + 1;
    const random = seededRandom(nextSeed);
    const choices = 4 + difficultyIndex(nextDifficulty);
    setMode(nextMode);
    setSeed(nextSeed);
    setValue(nextMode === "search" ? offerValues[Math.floor(random() * offerValues.length)]! : 10);
    setStepsLeft(choices);
    setDeck(Array.from({ length: choices + 2 }, () => Math.floor(random() * 21) - 8));
    setReviews([]);
    setLastOutcome("Awaiting your decision");
    setStarted(false);
    setFinished(false);
  }

  function begin() {
    setStarted(true);
    void startSession(difficulty);
  }

  const correct = reviews.filter((item) => item.action === item.optimal).length;
  const totalRegret = reviews.reduce((sum, item) => sum + item.regret, 0);
  const score = Math.max(0, Math.round(1000 - totalRegret * 45));
  return (
    <GameShell
      slug="optimal-stopping"
      difficulty={difficulty}
      setDifficulty={(next) => {
        setDifficulty(next);
        reset(mode, next);
      }}
      onRestart={() => reset()}
    >
      <ModeTabs modes={modes} value={mode} accent="#2dd4bf" onChange={(next) => reset(next)} />
      <ScoreRow
        items={[
          [mode === "search" ? "Current offer" : "Current value", `$${value}`],
          ["Choices left", stepsLeft],
          ["Optimal decisions", `${correct}/${reviews.length}`],
          ["Decision score", score],
        ]}
      />
      <section className="panel p-6 sm:p-9">
        {!started ? (
          <div className="grid min-h-[360px] place-items-center text-center">
            <div>
              <p className="metric text-[#2dd4bf]">Seed {seed} · exact backward induction</p>
              <h2 className="mt-4 text-3xl font-semibold">Know when another look is worth it.</h2>
              <p className="mx-auto mt-3 max-w-xl text-[#8995a7]">
                {mode === "dice"
                  ? "Roll 1–4 to add the face, 5 to add $10, or 6 to bust."
                  : mode === "cards"
                    ? "Draw without replacement from a finite payoff deck."
                    : "Accept the current offer or reject it forever and keep searching."}
              </p>
              <button className="btn btn-primary mt-7" onClick={begin}>
                Start session
              </button>
            </div>
          </div>
        ) : finished ? (
          <div>
            <p className="metric text-[#2dd4bf]">State-by-state decision review</p>
            <h2 className="mt-3 text-3xl font-semibold">{score} decision score</h2>
            <AnalysisGrid
              items={[
                ["Final payoff", `$${value}`],
                ["Optimal actions", `${Math.round((correct / Math.max(1, reviews.length)) * 100)}%`],
                ["Cumulative EV lost", `$${totalRegret.toFixed(2)}`],
                ["Average EV loss", `$${(totalRegret / Math.max(1, reviews.length)).toFixed(2)}`],
              ]}
            />
            <div className="mt-6 space-y-2">
              {reviews.map((item, index) => (
                <div
                  key={`${item.state}-${index}`}
                  className="grid gap-2 rounded-xl border border-[#283345] p-4 text-sm sm:grid-cols-5"
                >
                  <span>{item.state}</span>
                  <span>You: {item.action}</span>
                  <span>Optimal: {item.optimal}</span>
                  <span>Stop ${item.stopEv.toFixed(2)}</span>
                  <span>Continue ${item.continueEv.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <button className="btn btn-primary" onClick={() => reset(mode, difficulty)}>
                New seed
              </button>
              <button className="btn" onClick={() => reset(mode, difficulty, true)}>
                Replay seed
              </button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-[360px] content-center">
            <p className="metric text-[#2dd4bf]">{lastOutcome}</p>
            <h2 className="mt-4 text-5xl font-semibold">${value}</h2>
            <p className="mt-3 text-[#8995a7]">Stop and bank it, or continue into the next state?</p>
            <div className="mt-8 flex gap-3">
              <button className="btn btn-primary min-w-36" onClick={() => act("continue")}>
                Continue <kbd className="ml-2">C</kbd>
              </button>
              <button className="btn min-w-36" onClick={() => act("stop")}>
                Stop <kbd className="ml-2">S</kbd>
              </button>
            </div>
          </div>
        )}
        <PersistenceNotice message={persistenceError} />
      </section>
    </GameShell>
  );
}
