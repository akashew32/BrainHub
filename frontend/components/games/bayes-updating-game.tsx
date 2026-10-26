"use client";

import type { Difficulty } from "@/types/games";
import { QuantDrill, type DrillQuestion } from "./quant-drill";

export function bayesPosterior(
  baseRate: number,
  sensitivity: number,
  specificity: number,
  positive: boolean,
) {
  const trueEvidence = baseRate * (positive ? sensitivity : 1 - sensitivity);
  const falseEvidence = (1 - baseRate) * (positive ? 1 - specificity : specificity);
  return (trueEvidence / (trueEvidence + falseEvidence)) * 100;
}

export function generateBayesQuestion(
  difficulty: Difficulty,
  random: () => number = Math.random,
): DrillQuestion {
  const granularity = difficulty === "expert" ? 1 : difficulty === "hard" ? 2 : 5;
  const baseRatePct = Math.max(granularity, Math.round((5 + random() * 40) / granularity) * granularity);
  const sensitivityPct = Math.min(98, Math.round((65 + random() * 30) / granularity) * granularity);
  const specificityPct = Math.min(98, Math.round((65 + random() * 30) / granularity) * granularity);
  const positive = difficulty === "easy" || random() > 0.3;
  const answer = bayesPosterior(baseRatePct / 100, sensitivityPct / 100, specificityPct / 100, positive);
  const evidenceLabel = positive ? "positive signal" : "negative signal";
  const likelihood = positive ? sensitivityPct : 100 - sensitivityPct;
  const alternativeLikelihood = positive ? 100 - specificityPct : specificityPct;

  return {
    prompt: `What is P(event | ${evidenceLabel})?`,
    context: `Prior event rate: ${baseRatePct}%\nSensitivity: ${sensitivityPct}%\nSpecificity: ${specificityPct}%`,
    answer,
    tolerance: { easy: 5, medium: 3, hard: 2, expert: 1 }[difficulty],
    suffix: "%",
    decimals: 1,
    explanation: `Bayes' rule: (${baseRatePct}% × ${likelihood}%) ÷ [(${baseRatePct}% × ${likelihood}%) + (${100 - baseRatePct}% × ${alternativeLikelihood}%)] = ${answer.toFixed(1)}%. The likelihood ratio moves the prior; it does not replace it.`,
  };
}

export function BayesUpdatingGame() {
  return (
    <QuantDrill
      slug="bayes-updating"
      generator={generateBayesQuestion}
      focus="Update a prior without falling for base-rate neglect."
    />
  );
}
