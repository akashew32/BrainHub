"use client";

import { FormEvent, useMemo, useState } from "react";
import { useGameSession } from "@/hooks/use-game-session";
import { type BookLevel, difficultyIndex, seededRandom, sweepBook } from "@/lib/quant-games";
import type { Difficulty } from "@/types/games";
import { GameShell, ScoreRow } from "./game-shell";
import { AnalysisGrid, ModeTabs, PersistenceNotice } from "./quant-game-ui";

type Mode = "best-execution" | "book-updates" | "trading";
type RoundResult = { score: number; error: number; executionCost: number; pnl: number; explanation: string };
const modes: Mode[] = ["best-execution", "book-updates", "trading"];

export function OrderBookChallengeGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("hard");
  const [mode, setMode] = useState<Mode>("best-execution");
  const [seed, setSeed] = useState(5501);
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState("");
  const [last, setLast] = useState<RoundResult | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [finished, setFinished] = useState(false);
  const { persistenceError, startSession, completeSession } = useGameSession("order-book-challenge");
  const scenario = useMemo(() => makeBook(seed, round, difficulty), [difficulty, round, seed]);
  const score = results.reduce((sum, item) => sum + item.score, 0);
  const pnl = results.reduce((sum, item) => sum + item.pnl, 0);

  function evaluate(raw: string): RoundResult | null {
    if (mode === "best-execution") {
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) return null;
      const sweep = sweepBook(scenario.asks, scenario.quantity);
      const target = sweep.averageTick / 100;
      const error = Math.abs(numeric - target);
      return {
        score: Math.max(0, Math.round(100 - error * 100)),
        error,
        executionCost: (target - scenario.midTick / 100) * sweep.filled,
        pnl: 0,
        explanation: `${sweep.fills.map((fill) => `${fill.quantity} @ ${(fill.tick / 100).toFixed(2)}`).join(" + ")} = ${target.toFixed(3)} average.`,
      };
    }
    if (mode === "book-updates") {
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) return null;
      const targetTick = Math.min(scenario.asks[0]!.tick, scenario.insertTick);
      const target = targetTick / 100;
      const error = Math.abs(numeric - target);
      return {
        score: error < 0.001 ? 100 : 0,
        error,
        executionCost: 0,
        pnl: 0,
        explanation: `The sell limit joins at ${(scenario.insertTick / 100).toFixed(2)}; best ask becomes ${target.toFixed(2)}.`,
      };
    }
    const nearBid = scenario.bids.slice(0, 2).reduce((sum, item) => sum + item.quantity, 0);
    const nearAsk = scenario.asks.slice(0, 2).reduce((sum, item) => sum + item.quantity, 0);
    const optimal = nearBid < nearAsk ? "market-sell" : nearBid > nearAsk * 1.25 ? "limit-sell" : "hold";
    const action = raw as "market-sell" | "limit-sell" | "hold";
    const actionPnl =
      action === "market-sell"
        ? ((scenario.bids[0]!.tick - scenario.midTick) * scenario.inventory) / 100
        : action === "limit-sell"
          ? ((scenario.asks[0]!.tick - scenario.midTick) * scenario.inventory * 0.6) / 100
          : 0;
    return {
      score: action === optimal ? 100 : 35,
      error: action === optimal ? 0 : 1,
      executionCost:
        action === "market-sell"
          ? ((scenario.midTick - scenario.bids[0]!.tick) * scenario.inventory) / 100
          : 0,
      pnl: actionPnl,
      explanation: `Near-touch bid depth ${nearBid}; ask depth ${nearAsk}. ${optimal.replace("-", " ")} best balances immediacy and inventory risk in this generated state.`,
    };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = evaluate(answer);
    if (result) {
      setLast(result);
      setResults((current) => [...current, result]);
    }
  }
  function choose(action: "market-sell" | "limit-sell" | "hold") {
    const result = evaluate(action);
    if (result) {
      setAnswer(action);
      setLast(result);
      setResults((current) => [...current, result]);
    }
  }

  function next() {
    if (round >= 4) {
      const accuracy = (results.filter((item) => item.score >= 90).length / 5) * 100;
      const finalScore = Math.round((score / 5) * 10);
      setFinished(true);
      void completeSession(
        finalScore,
        {
          mode,
          seed,
          accuracy,
          execution_cost: results.reduce((sum, item) => sum + item.executionCost, 0),
          average_error: results.reduce((sum, item) => sum + item.error, 0) / 5,
          realized_pnl: pnl,
          slippage: results.reduce((sum, item) => sum + item.executionCost, 0),
          inventory_risk: mode === "trading" ? scenario.inventory : 0,
        },
        pnl >= 0,
      );
      return;
    }
    setRound((current) => current + 1);
    setAnswer("");
    setLast(null);
  }

  function reset(nextMode = mode, replay = false) {
    setMode(nextMode);
    setSeed((current) => (replay ? current : current + 1));
    setStarted(false);
    setRound(0);
    setAnswer("");
    setLast(null);
    setResults([]);
    setFinished(false);
  }
  function begin() {
    setStarted(true);
    void startSession(difficulty);
  }
  const bestBid = scenario.bids[0]!.tick / 100;
  const bestAsk = scenario.asks[0]!.tick / 100;

  return (
    <GameShell
      slug="order-book-challenge"
      difficulty={difficulty}
      setDifficulty={(next) => {
        setDifficulty(next);
        reset(mode);
      }}
      onRestart={() => reset()}
    >
      <ModeTabs modes={modes} value={mode} accent="#22c55e" onChange={(next) => reset(next)} />
      <ScoreRow
        items={[
          ["Challenge", `${Math.min(round + 1, 5)}/5`],
          ["Score", score],
          ["Spread", `${((scenario.asks[0]!.tick - scenario.bids[0]!.tick) / 100).toFixed(2)}`],
          ["Mid", `${(scenario.midTick / 100).toFixed(3)}`],
        ]}
      />
      <section className="panel p-5 sm:p-8">
        {!started ? (
          <div className="grid min-h-[420px] place-items-center text-center">
            <div>
              <p className="metric text-[#22c55e]">Integer-tick matching model</p>
              <h2 className="mt-4 text-3xl font-semibold">Read the book before crossing it.</h2>
              <p className="mx-auto mt-3 max-w-xl text-[#8995a7]">
                Five seeded challenges cover depth sweeps, limit insertion, imbalance, slippage, and
                inventory.
              </p>
              <button className="btn btn-primary mt-7" onClick={begin}>
                Open book
              </button>
            </div>
          </div>
        ) : finished ? (
          <div>
            <p className="metric text-[#22c55e]">Microstructure analysis</p>
            <h2 className="mt-3 text-4xl font-semibold">{Math.round((score / 5) * 10)} score</h2>
            <AnalysisGrid
              items={[
                ["Accuracy", `${Math.round((results.filter((item) => item.score >= 90).length / 5) * 100)}%`],
                [
                  "Execution cost",
                  `$${results.reduce((sum, item) => sum + item.executionCost, 0).toFixed(2)}`,
                ],
                ["Trading PnL", `$${pnl.toFixed(2)}`],
                ["Seed", seed],
              ]}
            />
            <button className="btn btn-primary mt-7" onClick={() => reset()}>
              New book set
            </button>
          </div>
        ) : (
          <div className="grid gap-7 lg:grid-cols-[330px_1fr]">
            <OrderBookView asks={scenario.asks} bids={scenario.bids} mid={scenario.midTick} />
            <div>
              <p className="metric text-[#22c55e]">{mode.replaceAll("-", " ")}</p>
              <h2 className="mt-4 text-2xl font-semibold">
                {mode === "best-execution"
                  ? `Buy ${scenario.quantity} shares immediately. What is the average execution price?`
                  : mode === "book-updates"
                    ? `LIMIT SELL: ${scenario.insertQuantity} @ ${(scenario.insertTick / 100).toFixed(2)}. What is the new best ask?`
                    : `Inventory +${scenario.inventory}. Choose an exit tactic from this book.`}
              </h2>
              <p className="mt-3 text-sm text-[#8995a7]">
                Best bid {bestBid.toFixed(2)} · best ask {bestAsk.toFixed(2)} · midpoint{" "}
                {(scenario.midTick / 100).toFixed(3)}
              </p>
              {!last ? (
                mode === "trading" ? (
                  <div className="mt-8 flex flex-wrap gap-2">
                    <button className="btn btn-primary" onClick={() => choose("market-sell")}>
                      Market sell
                    </button>
                    <button className="btn" onClick={() => choose("limit-sell")}>
                      Limit sell
                    </button>
                    <button className="btn" onClick={() => choose("hold")}>
                      Hold
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submit} className="mt-8 max-w-sm">
                    <label className="metric mb-2 block" htmlFor="book-answer">
                      Price
                    </label>
                    <input
                      id="book-answer"
                      autoFocus
                      className="input text-xl"
                      type="number"
                      step="0.001"
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                    />
                    <button className="btn btn-primary mt-3">Check</button>
                  </form>
                )
              ) : (
                <div className="mt-8 border-t border-[#283345] pt-6">
                  <p
                    className="text-3xl font-semibold"
                    style={{ color: last.score >= 90 ? "#63e6be" : "#fbbf24" }}
                  >
                    {last.score}/100
                  </p>
                  <p className="mt-3 text-[#aab4c2]">{last.explanation}</p>
                  <button className="btn btn-primary mt-6" onClick={next}>
                    {round >= 4 ? "View analysis" : "Next book"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        <PersistenceNotice message={persistenceError} />
      </section>
    </GameShell>
  );
}

function OrderBookView({ asks, bids, mid }: { asks: BookLevel[]; bids: BookLevel[]; mid: number }) {
  return (
    <div className="rounded-xl border border-[#283345] bg-[#090d13] p-4 font-mono text-sm">
      <p className="metric mb-3 text-[#fb7185]">Sell</p>
      {[...asks].reverse().map((level) => (
        <div className="flex justify-between py-1 text-[#fda4af]" key={level.tick}>
          <span>{(level.tick / 100).toFixed(2)}</span>
          <span>{level.quantity}</span>
        </div>
      ))}
      <div className="my-3 border-y border-[#283345] py-2 text-center text-[#aab4c2]">
        MID {(mid / 100).toFixed(3)}
      </div>
      {bids.map((level) => (
        <div className="flex justify-between py-1 text-[#86efac]" key={level.tick}>
          <span>{(level.tick / 100).toFixed(2)}</span>
          <span>{level.quantity}</span>
        </div>
      ))}
      <p className="metric mt-3 text-[#22c55e]">Buy</p>
    </div>
  );
}

function makeBook(seed: number, round: number, difficulty: Difficulty) {
  const random = seededRandom(seed + round * 173 + difficultyIndex(difficulty) * 3001);
  const midTick = 10000 + Math.floor(random() * 1000);
  const halfSpread = 1 + Math.floor(random() * 3);
  const bids = Array.from({ length: 3 }, (_, index) => ({
    tick: midTick - halfSpread - index,
    quantity: (1 + Math.floor(random() * 5)) * 100,
  }));
  const asks = Array.from({ length: 3 }, (_, index) => ({
    tick: midTick + halfSpread + index,
    quantity: (1 + Math.floor(random() * 5)) * 100,
  }));
  const requestedQuantity = 200 + difficultyIndex(difficulty) * 100 + Math.floor(random() * 3) * 100;
  const quantity = Math.min(
    requestedQuantity,
    asks.reduce((sum, level) => sum + level.quantity, 0),
  );
  const insertTick = midTick + Math.floor(random() * (halfSpread + 2));
  return {
    midTick,
    bids,
    asks,
    quantity,
    insertTick,
    insertQuantity: 100 + Math.floor(random() * 4) * 50,
    inventory: 100 + difficultyIndex(difficulty) * 100,
  };
}
