"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useGameSession } from "@/hooks/use-game-session";
import { bayesUpdate, brierScore, difficultyIndex, seededRandom } from "@/lib/quant-games";
import type { Difficulty } from "@/types/games";
import { GameShell, ScoreRow } from "./game-shell";
import { AnalysisGrid, ModeTabs, PersistenceNotice } from "./quant-game-ui";

type Mode = "coins" | "sequential" | "trading";
type Estimate = { estimate: number; posterior: number; error: number; brier: number };
const modes: Mode[] = ["coins", "sequential", "trading"];

export function BayesianTraderGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [mode, setMode] = useState<Mode>("trading");
  const [seed, setSeed] = useState(4109);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [prior, setPrior] = useState(0.5);
  const [answer, setAnswer] = useState("");
  const [last, setLast] = useState<Estimate | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [finished, setFinished] = useState(false);
  const [decisionQuality, setDecisionQuality] = useState<number | null>(null);
  const { persistenceError, startSession, completeSession } = useGameSession("bayesian-trader");
  const scenario = useMemo(() => makeBayesScenario(seed, difficulty, mode), [difficulty, mode, seed]);
  const evidence = scenario.evidence[step]!;
  const averageError = estimates.length
    ? estimates.reduce((sum, item) => sum + item.error, 0) / estimates.length
    : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    const estimate = Number(answer) / 100;
    if (!Number.isFinite(estimate) || estimate < 0 || estimate > 1) return;
    const likelihoodTrue = evidence.positive ? evidence.pPositiveTrue : 1 - evidence.pPositiveTrue;
    const likelihoodFalse = evidence.positive ? evidence.pPositiveFalse : 1 - evidence.pPositiveFalse;
    const posterior = bayesUpdate(prior, likelihoodTrue, likelihoodFalse);
    const result = {
      estimate,
      posterior,
      error: Math.abs(estimate - posterior),
      brier: brierScore(estimate, scenario.hiddenTrue),
    };
    setLast(result);
    setEstimates((current) => [...current, result]);
  }

  function next() {
    if (!last) return;
    setPrior(last.posterior);
    if (step >= scenario.evidence.length - 1) {
      setFinished(true);
      return;
    }
    setStep((current) => current + 1);
    setAnswer("");
    setLast(null);
  }

  const trade = useCallback(
    (action: "buy" | "sell" | "hold") => {
      const buyEv = prior * 20 - (1 - prior) * 12;
      const sellEv = (1 - prior) * 20 - prior * 12;
      const values = { buy: buyEv, sell: sellEv, hold: 0 };
      const optimal = (Object.keys(values) as Array<keyof typeof values>).reduce(
        (best, key) => (values[key] > values[best] ? key : best),
        "hold",
      );
      const regret = values[optimal] - values[action];
      const quality = Math.max(0, 100 - regret * 6);
      setDecisionQuality(quality);
      const posteriorError = estimates.reduce((sum, item) => sum + item.error, 0) / estimates.length;
      const meanBrier = estimates.reduce((sum, item) => sum + item.brier, 0) / estimates.length;
      const score = Math.round(Math.max(0, 1000 - posteriorError * 1400 - meanBrier * 400 - regret * 8));
      void completeSession(
        score,
        {
          mode,
          seed,
          accuracy: Math.max(0, 100 - posteriorError * 100),
          posterior_error: posteriorError,
          brier_score: meanBrier,
          decision_ev: values[action],
          optimal_decision_ev: values[optimal],
          ev_regret: regret,
          decision: action,
          optimal_action: optimal,
        },
        action === (scenario.hiddenTrue ? "buy" : "sell"),
      );
    },
    [completeSession, estimates, mode, prior, scenario.hiddenTrue, seed],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat || !finished || decisionQuality !== null) return;
      const action = { b: "buy", s: "sell", h: "hold" }[event.key.toLowerCase()] as
        "buy" | "sell" | "hold" | undefined;
      if (action) trade(action);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [decisionQuality, finished, trade]);

  function reset(nextMode = mode, replay = false) {
    setMode(nextMode);
    setSeed((current) => (replay ? current : current + 1));
    setStarted(false);
    setStep(0);
    setPrior(0.5);
    setAnswer("");
    setLast(null);
    setEstimates([]);
    setFinished(false);
    setDecisionQuality(null);
  }

  function begin() {
    setStarted(true);
    setPrior(scenario.prior);
    void startSession(difficulty);
  }
  const title = mode === "coins" ? "Coin A" : mode === "trading" ? "Bull regime" : "Hypothesis A";

  return (
    <GameShell
      slug="bayesian-trader"
      difficulty={difficulty}
      setDifficulty={(next) => {
        setDifficulty(next);
        reset(mode);
      }}
      onRestart={() => reset()}
    >
      <ModeTabs modes={modes} value={mode} accent="#a78bfa" onChange={(next) => reset(next)} />
      <ScoreRow
        items={[
          ["Evidence", `${Math.min(step + 1, scenario.evidence.length)}/${scenario.evidence.length}`],
          ["Current belief", `${(prior * 100).toFixed(1)}%`],
          ["Mean posterior error", estimates.length ? `${(averageError * 100).toFixed(1)} pp` : "—"],
          ["Seed", seed],
        ]}
      />
      <section className="panel p-6 sm:p-9">
        {!started ? (
          <div className="grid min-h-[370px] place-items-center text-center">
            <div>
              <p className="metric text-[#a78bfa]">Sequential conditional reasoning</p>
              <h2 className="mt-4 text-3xl font-semibold">Update the belief. Then update the trade.</h2>
              <p className="mx-auto mt-3 max-w-xl text-[#8995a7]">
                Signals arrive one at a time. Estimates receive continuous Brier and posterior-error scoring.
              </p>
              <button className="btn btn-primary mt-7" onClick={begin}>
                Reveal first signal
              </button>
            </div>
          </div>
        ) : finished ? (
          <div>
            <p className="metric text-[#a78bfa]">Trading decision</p>
            <h2 className="mt-3 text-3xl font-semibold">
              Posterior P({title}) = {(prior * 100).toFixed(1)}%
            </h2>
            <p className="mt-3 text-[#8995a7]">
              BUY pays +20 in {title} and −12 otherwise. SELL reverses those payoffs. HOLD pays zero.
            </p>
            {decisionQuality === null ? (
              <div className="mt-7 flex flex-wrap gap-3">
                <button className="btn btn-primary" onClick={() => trade("buy")}>
                  Buy <kbd className="ml-2">B</kbd>
                </button>
                <button className="btn" onClick={() => trade("sell")}>
                  Sell <kbd className="ml-2">S</kbd>
                </button>
                <button className="btn" onClick={() => trade("hold")}>
                  Hold <kbd className="ml-2">H</kbd>
                </button>
              </div>
            ) : (
              <>
                <AnalysisGrid
                  items={[
                    ["Decision quality", `${decisionQuality.toFixed(0)}%`],
                    ["Mean error", `${(averageError * 100).toFixed(1)} pp`],
                    ["Hidden state", scenario.hiddenTrue ? title : `Not ${title}`],
                    ["Signals", scenario.evidence.length],
                  ]}
                />
                <button className="btn btn-primary mt-7" onClick={() => reset()}>
                  New scenario
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="min-h-[390px]">
            <p className="metric text-[#a78bfa]">
              Prior P({title}) = {(prior * 100).toFixed(1)}%
            </p>
            <h2 className="mt-4 text-3xl font-semibold">
              Signal {step + 1}: {evidence.positive ? "POSITIVE" : "NEGATIVE"}
            </h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-[#090d13] p-4">
                P(positive | {title}) = {(evidence.pPositiveTrue * 100).toFixed(0)}%
              </div>
              <div className="rounded-xl bg-[#090d13] p-4">
                P(positive | not {title}) = {(evidence.pPositiveFalse * 100).toFixed(0)}%
              </div>
            </div>
            {!last ? (
              <form onSubmit={submit} className="mt-8 max-w-sm">
                <label className="metric mb-2 block" htmlFor="posterior">
                  Your updated probability (%)
                </label>
                <input
                  id="posterior"
                  autoFocus
                  className="input text-xl"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                />
                <button className="btn btn-primary mt-3">Update belief</button>
              </form>
            ) : (
              <div className="mt-8 border-t border-[#283345] pt-6">
                <AnalysisGrid
                  items={[
                    ["Your posterior", `${(last.estimate * 100).toFixed(1)}%`],
                    ["Bayes posterior", `${(last.posterior * 100).toFixed(1)}%`],
                    ["Absolute error", `${(last.error * 100).toFixed(1)} pp`],
                    ["Brier score", last.brier.toFixed(3)],
                  ]}
                />
                <p className="mt-5 text-[#aab4c2]">
                  Bayes: prior × likelihood, normalized by the evidence probability.
                </p>
                <button className="btn btn-primary mt-6" onClick={next}>
                  {step >= scenario.evidence.length - 1 ? "Make trading decision" : "Next signal"}
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

function makeBayesScenario(seed: number, difficulty: Difficulty, mode: Mode) {
  const random = seededRandom(seed + difficultyIndex(difficulty) * 2003 + mode.length * 17);
  const prior = 0.25 + random() * 0.5;
  const hiddenTrue = random() < prior;
  const count = 3 + (difficultyIndex(difficulty) >= 2 ? 1 : 0);
  const evidence = Array.from({ length: count }, () => {
    const pPositiveTrue = 0.62 + random() * 0.28;
    const pPositiveFalse = 0.12 + random() * 0.35;
    const positive = random() < (hiddenTrue ? pPositiveTrue : pPositiveFalse);
    return { pPositiveTrue, pPositiveFalse, positive };
  });
  return { prior, hiddenTrue, evidence };
}
