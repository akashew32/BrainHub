"use client";

import { FormEvent, useMemo, useState } from "react";
import { useGameSession } from "@/hooks/use-game-session";
import {
  type AuctionType,
  difficultyIndex,
  firstPriceTarget,
  seededRandom,
  settleAuction,
} from "@/lib/quant-games";
import type { Difficulty } from "@/types/games";
import { GameShell, ScoreRow } from "./game-shell";
import { AnalysisGrid, ModeTabs, PersistenceNotice } from "./quant-game-ui";

type RoundResult = {
  value: number;
  signal: number;
  bid: number;
  winningBid: number;
  payment: number;
  profit: number;
  won: boolean;
  target: number;
  evLost: number;
  trueValue: number;
};
const modes: AuctionType[] = ["first-price", "second-price", "common-value"];

export function AuctionArenaGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [mode, setMode] = useState<AuctionType>("first-price");
  const [seed, setSeed] = useState(2903);
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(0);
  const [bid, setBid] = useState("");
  const [last, setLast] = useState<RoundResult | null>(null);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [finished, setFinished] = useState(false);
  const { persistenceError, startSession, completeSession } = useGameSession("auction-arena");
  const scenario = useMemo(() => makeAuction(seed, round, difficulty, mode), [difficulty, mode, round, seed]);
  const pnl = history.reduce((sum, item) => sum + item.profit, 0);
  const wins = history.filter((item) => item.won).length;
  const averageRatio = history.length
    ? history.reduce((sum, item) => sum + item.bid / item.signal, 0) / history.length
    : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    const yourBid = Number(bid);
    if (!Number.isFinite(yourBid) || yourBid < 0) return;
    const bids = [yourBid, ...scenario.botBids];
    const values = [scenario.trueValue, ...scenario.botValues];
    const settlement = settleAuction(bids, values, mode);
    const won = settlement.winner === 0;
    const target =
      mode === "first-price"
        ? firstPriceTarget(scenario.signal, 4)
        : mode === "second-price"
          ? scenario.signal
          : Math.max(0, scenario.signal - scenario.noise * 0.45);
    const result: RoundResult = {
      value: scenario.privateValue,
      signal: scenario.signal,
      bid: yourBid,
      winningBid: Math.max(...bids),
      payment: won ? settlement.payment : 0,
      profit: won ? scenario.trueValue - settlement.payment : 0,
      won,
      target,
      evLost: Math.abs(yourBid - target),
      trueValue: scenario.trueValue,
    };
    setLast(result);
    setHistory((current) => [...current, result]);
  }

  function next() {
    if (round >= 9) {
      const accuracy =
        (history.filter((item) => item.evLost <= Math.max(5, item.target * 0.12)).length / 10) * 100;
      const totalRegret = history.reduce((sum, item) => sum + item.evLost, 0);
      const score = Math.max(0, Math.round(1000 - totalRegret * 2));
      setFinished(true);
      void completeSession(
        score,
        {
          mode,
          seed,
          auctions: 10,
          profit: pnl,
          win_rate: wins / 10,
          average_bid_value_ratio: averageRatio,
          expected_value_lost: totalRegret,
          accuracy,
          winners_curse_losses: history.filter((item) => item.won && item.profit < 0).length,
        },
        pnl > 0,
      );
      return;
    }
    setRound((current) => current + 1);
    setBid("");
    setLast(null);
  }

  function reset(nextMode = mode, replay = false) {
    setMode(nextMode);
    setSeed((current) => (replay ? current : current + 1));
    setStarted(false);
    setRound(0);
    setBid("");
    setLast(null);
    setHistory([]);
    setFinished(false);
  }

  function begin() {
    setStarted(true);
    void startSession(difficulty);
  }

  return (
    <GameShell
      slug="auction-arena"
      difficulty={difficulty}
      setDifficulty={(next) => {
        setDifficulty(next);
        reset(mode);
      }}
      onRestart={() => reset()}
    >
      <ModeTabs modes={modes} value={mode} accent="#f59e0b" onChange={(next) => reset(next)} />
      <ScoreRow
        items={[
          ["Auction", `${Math.min(round + 1, 10)}/10`],
          ["Cumulative PnL", `$${pnl.toFixed(0)}`],
          ["Wins", wins],
          ["Bid / signal", averageRatio ? `${averageRatio.toFixed(2)}×` : "—"],
        ]}
      />
      <section className="panel p-6 sm:p-9">
        {!started ? (
          <div className="grid min-h-[370px] place-items-center text-center">
            <div>
              <p className="metric text-[#f59e0b]">Ten-auction adaptation set</p>
              <h2 className="mt-4 text-3xl font-semibold">Bid for value, not for the feeling of winning.</h2>
              <p className="mx-auto mt-3 max-w-xl text-[#8995a7]">
                Bots shade private values and condition common-value bids on noisy signals.
              </p>
              <button className="btn btn-primary mt-7" onClick={begin}>
                Enter arena
              </button>
            </div>
          </div>
        ) : finished ? (
          <div>
            <p className="metric text-[#f59e0b]">Repeated-auction analysis</p>
            <h2 className="mt-3 text-4xl font-semibold">
              {pnl >= 0 ? "+" : ""}${pnl.toFixed(0)} PnL
            </h2>
            <AnalysisGrid
              items={[
                ["Win rate", `${Math.round((wins / 10) * 100)}%`],
                ["Avg bid / signal", `${averageRatio.toFixed(2)}×`],
                ["Winner's curse losses", history.filter((item) => item.won && item.profit < 0).length],
                [
                  "Mean bid regret",
                  `$${(history.reduce((sum, item) => sum + item.evLost, 0) / 10).toFixed(1)}`,
                ],
              ]}
            />
            <button className="btn btn-primary mt-7" onClick={() => reset()}>
              Run another set
            </button>
          </div>
        ) : (
          <div className="min-h-[390px]">
            <p className="metric text-[#f59e0b]">{mode.replaceAll("-", " ")} · 4 bidders</p>
            <h2 className="mt-4 text-3xl font-semibold">
              {mode === "common-value"
                ? `Your noisy signal: $${scenario.signal.toFixed(0)} ± ${scenario.noise}`
                : `Your private valuation: $${scenario.privateValue.toFixed(0)}`}
            </h2>
            <p className="mt-3 max-w-2xl text-[#8995a7]">
              {mode === "first-price"
                ? "Highest bid wins and pays its own bid."
                : mode === "second-price"
                  ? "Highest bid wins and pays the second-highest bid."
                  : "Everyone values the same hidden asset; each bidder sees an independent noisy signal."}
            </p>
            {!last ? (
              <form onSubmit={submit} className="mt-8 max-w-sm">
                <label className="metric mb-2 block" htmlFor="auction-bid">
                  Your sealed bid
                </label>
                <input
                  id="auction-bid"
                  autoFocus
                  className="input text-xl"
                  type="number"
                  min="0"
                  step="0.01"
                  value={bid}
                  onChange={(event) => setBid(event.target.value)}
                />
                <button className="btn btn-primary mt-3">Submit bid</button>
              </form>
            ) : (
              <div className="mt-8 border-t border-[#283345] pt-6">
                <AnalysisGrid
                  items={[
                    ["Your bid", `$${last.bid.toFixed(0)}`],
                    ["Winning bid", `$${last.winningBid.toFixed(0)}`],
                    ["Payment", last.won ? `$${last.payment.toFixed(0)}` : "Did not win"],
                    ["Profit", `${last.profit >= 0 ? "+" : ""}$${last.profit.toFixed(0)}`],
                  ]}
                />
                {mode === "common-value" ? (
                  <p className="mt-5 text-[#aab4c2]">
                    True value: <strong>${last.trueValue.toFixed(0)}</strong>. Winning selects unusually high
                    signals, so a rational bid shades below the raw signal.
                  </p>
                ) : (
                  <p className="mt-5 text-[#aab4c2]">
                    Reference bidding region centers near <strong>${last.target.toFixed(0)}</strong>
                    {mode === "second-price"
                      ? "; truthful bidding is dominant under standard independent private values"
                      : " under the symmetric-uniform benchmark"}
                    .
                  </p>
                )}
                <button className="btn btn-primary mt-6" onClick={next}>
                  {round >= 9 ? "View analysis" : "Next auction"}
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

function makeAuction(seed: number, round: number, difficulty: Difficulty, mode: AuctionType) {
  const random = seededRandom(seed + round * 131 + difficultyIndex(difficulty) * 997);
  const trueValue = 70 + random() * 90;
  const noise = 12 + difficultyIndex(difficulty) * 6;
  const signals = Array.from({ length: 4 }, () => trueValue + (random() * 2 - 1) * noise);
  const privateValues = Array.from({ length: 4 }, () => 50 + random() * 120);
  const signal = mode === "common-value" ? signals[0]! : privateValues[0]!;
  const botValues = mode === "common-value" ? [trueValue, trueValue, trueValue] : privateValues.slice(1);
  const botBids = (mode === "common-value" ? signals.slice(1) : privateValues.slice(1)).map((value) =>
    mode === "second-price"
      ? value
      : mode === "first-price"
        ? firstPriceTarget(value, 4)
        : Math.max(0, value - noise * (0.35 + random() * 0.3)),
  );
  return { trueValue, signal, privateValue: privateValues[0]!, botValues, botBids, noise };
}
