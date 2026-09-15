"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import type { Difficulty } from "@/types/games";
import { GameShell, ScoreRow } from "./game-shell";

type RoundAnalysis = {
  challenger: number;
  bidder: number;
  bid: [number, number];
  actual_matches: number;
  bid_was_true: boolean;
  estimated_probability: number;
  bidder_probability: number;
  bid_aggressiveness: "conservative" | "balanced" | "aggressive";
  reasonable_challenge: boolean;
  loser: number;
  revealed_dice: number[][];
};
type DiceState = {
  difficulty: Difficulty;
  dice_counts: number[];
  active: boolean[];
  turn: number;
  bid: [number, number] | null;
  history: Array<{ player: number; quantity: number; face: number }>;
  round: number;
  winner: number | null;
  your_dice: number[];
  analysis?: RoundAnalysis;
};
const names = ["You", "Ada", "Bayes", "Kelly"];

export function LiarsDiceGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("expert");
  const [session, setSession] = useState("");
  const [state, setState] = useState<DiceState | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [face, setFace] = useState(2);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const result = await api.create("liars-dice", difficulty);
      setSession(result.id);
      setState(result.state as unknown as DiceState);
      setQuantity(1);
      setFace(2);
      setError("");
    } catch {
      setError("Start the backend API to play against the bots.");
    } finally {
      setBusy(false);
    }
  }

  async function act(action: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api.action("liars-dice", session, action);
      const next = result.state as unknown as DiceState;
      setState(next);
      setError("");
      if (next.bid) {
        setQuantity(next.bid[0]);
        setFace(next.bid[1]);
      }
      if (next.winner !== null)
        await api.complete("liars-dice", session, {
          score: next.winner === 0 ? 1000 : 250,
          duration_ms: 0,
          won: next.winner === 0,
          metrics: { rounds: next.round, difficulty },
        });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action rejected");
    } finally {
      setBusy(false);
    }
  }

  function bid(event: FormEvent) {
    event.preventDefault();
    void act({ type: "bid", quantity, face });
  }

  return (
    <GameShell
      slug="liars-dice"
      difficulty={difficulty}
      setDifficulty={(next) => {
        setDifficulty(next);
        setState(null);
      }}
      onRestart={start}
    >
      {!state ? (
        <div className="panel grid min-h-[440px] place-items-center text-center">
          <div>
            <p className="metric text-[#f97316]">Four-player rules · ones wild</p>
            <h2 className="mt-4 text-3xl font-semibold">Read the bid. Read the room.</h2>
            <p className="mx-auto mt-3 max-w-lg text-[#8995a7]">
              Three probability-driven opponents evaluate challenges with exact binomial beliefs and
              strategically rank every legal raise.
            </p>
            <button disabled={busy} className="btn btn-primary mt-7 disabled:opacity-50" onClick={start}>
              {busy ? "Rolling…" : "Roll dice"}
            </button>
            <p className="mt-3 text-[#fb7185]">{error}</p>
          </div>
        </div>
      ) : (
        <>
          <ScoreRow
            items={[
              ["Round", state.round],
              ["Your dice", state.dice_counts[0]],
              ["Current bid", state.bid ? `${state.bid[0]} × ${state.bid[1]}` : "Open"],
              ["Players", state.active.filter(Boolean).length],
            ]}
          />
          <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
            <section className="panel p-6">
              <div className="grid grid-cols-4 gap-2">
                {names.map((name, index) => (
                  <div
                    key={name}
                    className={`rounded-xl border p-3 text-center ${state.active[index] ? (state.turn === index ? "border-[#f97316] bg-[#f9731608]" : "border-[#2a3444]") : "border-[#2a344422] opacity-35"}`}
                  >
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="metric mt-1">{state.dice_counts[index]} dice</p>
                  </div>
                ))}
              </div>
              <p className="metric mt-8 text-[#f97316]">Your private dice</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {state.your_dice.map((die, index) => (
                  <Die key={index} value={die} />
                ))}
              </div>
              {state.winner === null ? (
                <form onSubmit={bid} className="mt-9 grid grid-cols-2 gap-3">
                  <label>
                    <span className="metric mb-2 block">Quantity</span>
                    <input
                      aria-label="Bid quantity"
                      className="input"
                      type="number"
                      min="1"
                      max={state.dice_counts.reduce((sum, count) => sum + count, 0)}
                      value={quantity}
                      onChange={(event) => setQuantity(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span className="metric mb-2 block">Face</span>
                    <select
                      aria-label="Bid face"
                      className="input"
                      value={face}
                      onChange={(event) => setFace(Number(event.target.value))}
                    >
                      {[1, 2, 3, 4, 5, 6].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <button disabled={busy} className="btn btn-primary disabled:opacity-50">
                    {busy ? "Bots thinking…" : "Raise bid"}
                  </button>
                  <button
                    type="button"
                    disabled={!state.bid || busy}
                    className="btn border-[#fb7185] text-[#fb7185] disabled:opacity-30"
                    onClick={() => void act({ type: "challenge" })}
                  >
                    Challenge
                  </button>
                  <p className="col-span-2 text-sm text-[#fb7185]" aria-live="polite">
                    {error}
                  </p>
                </form>
              ) : (
                <div className="mt-8">
                  <p className="metric text-[#f97316]">Match complete</p>
                  <h3 className="mt-2 text-3xl font-semibold">
                    {state.winner === 0 ? "You outlasted the table" : `${names[state.winner]} wins`}
                  </h3>
                  <button className="btn btn-primary mt-5" onClick={start}>
                    Play again
                  </button>
                </div>
              )}
              {state.analysis ? <RoundAnalysisView analysis={state.analysis} /> : null}
            </section>
            <aside className="panel p-5">
              <p className="metric mb-4">Bid history</p>
              {state.history.length ? (
                state.history.map((item, index) => (
                  <div key={index} className="mb-2 flex justify-between rounded-lg bg-[#090d13] p-3 text-sm">
                    <span>{names[item.player]}</span>
                    <strong>
                      {item.quantity} × {item.face}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#758195]">
                  {state.analysis ? "A new round has begun. You are first to bid." : "You open the bidding."}
                </p>
              )}
              <div className="mt-6 border-t border-[#202937] pt-5 text-xs leading-5 text-[#7f8b9c]">
                <strong className="text-[#b8c1cd]">Bid order:</strong> raise quantity, or keep quantity and
                raise face. Ones are wild for bids on faces 2–6; a bid on ones counts literal ones only.
              </div>
            </aside>
          </div>
        </>
      )}
    </GameShell>
  );
}

function Die({ value }: { value: number }) {
  return (
    <span
      aria-label={`${value}`}
      className="enter grid h-14 w-14 place-items-center rounded-xl bg-white text-2xl font-black text-black shadow-[0_8px_30px_#0008]"
    >
      {value}
    </span>
  );
}

function RoundAnalysisView({ analysis }: { analysis: RoundAnalysis }) {
  return (
    <div className="enter mt-8 rounded-xl border border-[#f9731644] bg-[#f9731609] p-5">
      <p className="metric text-[#f97316]">Post-round analysis</p>
      <p className="mt-2 text-sm text-[#b4bdc9]">
        {names[analysis.challenger]} challenged {names[analysis.bidder]}&apos;s {analysis.bid[0]} ×{" "}
        {analysis.bid[1]} bid. It was <strong>{analysis.bid_was_true ? "true" : "false"}</strong> with{" "}
        {analysis.actual_matches} matches. From the challenger&apos;s information it was{" "}
        {Math.round(analysis.estimated_probability * 100)}% likely to hold, so challenging was{" "}
        {analysis.reasonable_challenge ? "statistically reasonable" : "aggressive"}. {names[analysis.loser]}{" "}
        lost a die. The bidder&apos;s private information supported the bid at{" "}
        {Math.round(analysis.bidder_probability * 100)}%, making it a {analysis.bid_aggressiveness} bid.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {analysis.revealed_dice.map((dice, player) => (
          <div key={player} className="rounded-lg bg-[#090d13] p-3">
            <p className="metric mb-2">{names[player]}</p>
            <p className="text-sm font-semibold">{dice.join(" · ") || "Eliminated"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
