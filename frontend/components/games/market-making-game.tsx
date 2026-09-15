"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Difficulty } from "@/types/games";
import { GameShell, ScoreRow } from "./game-shell";

type Analysis = {
  pnl: number;
  realized_pnl: number;
  score: number;
  average_spread: number;
  spread_captured: number;
  adverse_selection: number;
  center_bias: number;
  timeouts: number;
};
type MarketState = {
  difficulty: Difficulty;
  round: number;
  max_rounds: number;
  prompt: string;
  reference_signal: number;
  market_kind: string;
  cash: number;
  inventory: number;
  realized_pnl: number;
  trades: number;
  timeouts: number;
  time_limit: number;
  complete: boolean;
  mark_to_market_pnl: number;
  history: Array<{ round: number; bid: number; ask: number; size: number; side: string }>;
  analysis?: Analysis;
  fair_value?: number;
};

export function MarketMakingGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [session, setSession] = useState("");
  const [state, setState] = useState<MarketState | null>(null);
  const [bid, setBid] = useState("90");
  const [ask, setAsk] = useState("110");
  const [size, setSize] = useState(1);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const roundStarted = useRef(0);

  useEffect(() => {
    if (!state || state.complete) return;
    const id = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  async function start() {
    setSubmitting(true);
    try {
      const result = await api.create("market-making", difficulty);
      const next = result.state as unknown as MarketState;
      setSession(result.id);
      setState(next);
      setSeconds(next.time_limit);
      roundStarted.current = performance.now();
      setBid(Math.max(0.01, next.reference_signal - 5).toFixed(2));
      setAsk(Math.max(0.02, next.reference_signal + 5).toFixed(2));
      setError("");
    } catch {
      setError("Start the backend API to play this authoritative simulation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendQuote(event: FormEvent) {
    event.preventDefault();
    if (!state || submitting) return;
    setSubmitting(true);
    try {
      const elapsed = performance.now() - roundStarted.current;
      const result = await api.action("market-making", session, {
        bid: Number(bid),
        ask: Number(ask),
        size,
        elapsed_ms: elapsed,
      });
      const next = result.state as unknown as MarketState;
      setState(next);
      setSeconds(next.time_limit);
      roundStarted.current = performance.now();
      setError("");
      if (!next.complete) {
        setBid(Math.max(0.01, next.reference_signal - 4).toFixed(2));
        setAsk(Math.max(0.02, next.reference_signal + 4).toFixed(2));
      }
      if (next.complete && next.analysis)
        await api.complete("market-making", session, {
          score: next.analysis.score,
          duration_ms: 0,
          metrics: next.analysis,
        });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Quote rejected");
    } finally {
      setSubmitting(false);
    }
  }

  const requiresSize = difficulty === "hard" || difficulty === "expert";
  return (
    <GameShell
      slug="market-making"
      difficulty={difficulty}
      setDifficulty={(next) => {
        setDifficulty(next);
        setState(null);
      }}
      onRestart={start}
    >
      {!state ? (
        <div className="panel grid min-h-[430px] place-items-center text-center">
          <div>
            <p className="metric text-[#60a5fa]">Flagship simulation</p>
            <h2 className="mt-4 text-3xl font-semibold">Make a two-sided market</h2>
            <p className="mx-auto mt-3 max-w-md text-[#8995a7]">
              Your fair value is uncertain. Informed and noisy counterparties will trade against your quotes.
            </p>
            <button
              onClick={start}
              disabled={submitting}
              className="btn btn-primary mt-7 disabled:opacity-50"
            >
              {submitting ? "Opening…" : "Open market"}
            </button>
            <p className="mt-3 text-sm text-[#fb7185]">{error}</p>
          </div>
        </div>
      ) : (
        <>
          <ScoreRow
            items={[
              ["Round", `${Math.min(state.round, state.max_rounds)}/${state.max_rounds}`],
              ["Quote clock", `${seconds}s`],
              ["MTM PnL", `$${state.mark_to_market_pnl.toFixed(2)}`],
              ["Inventory", state.inventory],
            ]}
          />
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <section className="panel p-6">
              <p className="metric text-[#60a5fa]">Market brief</p>
              <h2 className="mt-3 text-2xl font-semibold">{state.prompt}</h2>
              {!state.complete ? (
                <form onSubmit={sendQuote} className="mt-8 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="metric mb-2 block">Bid</span>
                    <input
                      aria-label="Bid price"
                      className="input text-xl"
                      type="number"
                      step=".01"
                      value={bid}
                      onChange={(event) => setBid(event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="metric mb-2 block">Ask</span>
                    <input
                      aria-label="Ask price"
                      className="input text-xl"
                      type="number"
                      step=".01"
                      value={ask}
                      onChange={(event) => setAsk(event.target.value)}
                    />
                  </label>
                  {requiresSize ? (
                    <label className="sm:col-span-2">
                      <span className="metric mb-2 block">Quote size</span>
                      <input
                        aria-label="Quote size"
                        className="input"
                        type="number"
                        min="1"
                        max="10"
                        value={size}
                        onChange={(event) => setSize(Number(event.target.value))}
                      />
                    </label>
                  ) : null}
                  <button disabled={submitting} className="btn btn-primary sm:col-span-2 disabled:opacity-50">
                    {submitting
                      ? "Matching order flow…"
                      : seconds === 0
                        ? "Send late quote (penalty)"
                        : "Send quote"}
                  </button>
                  <p className="text-sm text-[#fb7185] sm:col-span-2" aria-live="polite">
                    {error}
                  </p>
                </form>
              ) : (
                <MarketAnalysis state={state} onRestart={start} />
              )}
            </section>
            <aside className="panel p-5">
              <p className="metric mb-4">Order flow</p>
              <div className="space-y-2">
                {[...state.history].reverse().map((item) => (
                  <div key={item.round} className="flex justify-between rounded-lg bg-[#090d13] p-3 text-sm">
                    <span>
                      #{item.round} {item.bid} / {item.ask} × {item.size}
                    </span>
                    <span
                      className={
                        item.side === "none"
                          ? "text-[#758195]"
                          : item.side === "timeout"
                            ? "text-[#fb7185]"
                            : "text-[#63e6be]"
                      }
                    >
                      {item.side}
                    </span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </>
      )}
    </GameShell>
  );
}

function MarketAnalysis({ state, onRestart }: { state: MarketState; onRestart: () => void }) {
  const analysis = state.analysis!;
  const calibration =
    Math.abs(analysis.center_bias) < 2
      ? "well calibrated"
      : analysis.center_bias > 0
        ? "systematically high"
        : "systematically low";
  const width =
    analysis.adverse_selection > analysis.spread_captured
      ? "Quotes were generally too narrow for the informed flow."
      : analysis.average_spread > 15
        ? "Quotes were safe but likely wider than necessary."
        : "Quote width balanced capture and adverse selection.";
  return (
    <div className="enter mt-8">
      <p className="text-4xl font-semibold">${analysis.pnl.toFixed(2)}</p>
      <p className="metric">Final risk-adjusted PnL · fair value {state.fair_value}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-[#080c12] p-4">
          Realized PnL
          <br />
          <strong>${analysis.realized_pnl}</strong>
        </div>
        <div className="rounded-xl bg-[#080c12] p-4">
          Average spread
          <br />
          <strong>{analysis.average_spread}</strong>
        </div>
        <div className="rounded-xl bg-[#080c12] p-4">
          Spread captured
          <br />
          <strong>{analysis.spread_captured}</strong>
        </div>
        <div className="rounded-xl bg-[#080c12] p-4">
          Adverse selection
          <br />
          <strong>{analysis.adverse_selection}</strong>
        </div>
      </div>
      <p className="mt-5 text-[#9aa7b8]">
        Your quote centers were {calibration}. {width} Final inventory was {state.inventory};{" "}
        {analysis.timeouts} quote deadlines were missed.
      </p>
      <button className="btn btn-primary mt-6" onClick={onRestart}>
        Play again
      </button>
    </div>
  );
}
