"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { HintReveal, MathQuestion } from "@/lib/curriculum";
import { MathText } from "@/components/roadmaps/math-text";

function validReveal(value: HintReveal, questionId: string, requestedIndex: number) {
  return (
    value.question_id === questionId &&
    Number.isInteger(value.hint_count) &&
    value.hint_count >= 0 &&
    value.hint_count <= 64 &&
    Number.isInteger(value.hints_used) &&
    value.hints_used >= requestedIndex &&
    value.hints_used <= value.hint_count &&
    Array.isArray(value.hints) &&
    value.hints.length === value.hints_used &&
    value.hints.every((hint) => typeof hint === "string") &&
    typeof value.hint_usage === "object" &&
    value.hint_usage !== null &&
    !Array.isArray(value.hint_usage) &&
    Object.values(value.hint_usage).every((count) => Number.isInteger(count) && count >= 0 && count <= 64) &&
    value.hint_usage[questionId] === value.hints_used
  );
}

export function QuestionHints({
  sessionId,
  question,
  questionNumber,
  hintUsage,
  onReveal,
  onPendingChange,
  disabled = false,
}: {
  sessionId: string;
  question: Pick<MathQuestion, "id" | "hints" | "hint_count">;
  questionNumber: number;
  hintUsage: Record<string, number> | null | undefined;
  onReveal: (response: HintReveal) => void;
  onPendingChange: (questionId: string, pending: boolean) => void;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const requesting = useRef(false);
  const tracked = hintUsage !== null && hintUsage !== undefined;
  const used = tracked ? (hintUsage[question.id] ?? 0) : question.hints.length;
  const count = question.hint_count ?? question.hints.length;
  const revealed = tracked ? question.hints.slice(0, used) : question.hints;
  const missingRevealedText = tracked && used > revealed.length;
  const panelId = "hints-" + sessionId + "-" + question.id;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (requesting.current) onPendingChange(question.id, false);
    };
  }, [onPendingChange, question.id, sessionId]);

  async function reveal() {
    if (disabled || !tracked || requesting.current || (used >= count && !missingRevealedText)) return;
    requesting.current = true;
    setPending(true);
    setError(null);
    onPendingChange(question.id, true);
    try {
      const requestedIndex = missingRevealedText ? used : used + 1;
      const response = await api.revealAssessmentHint(sessionId, question.id, requestedIndex);
      if (!mounted.current) return;
      if (!validReveal(response, question.id, requestedIndex))
        throw new Error("The hint response could not be verified.");
      onReveal(response);
    } catch (problem) {
      if (mounted.current)
        setError(
          problem instanceof ApiError
            ? problem.message
            : "The next hint could not be loaded. Your previous hints and answers are kept. Try again when connected.",
        );
    } finally {
      if (mounted.current) {
        requesting.current = false;
        setPending(false);
        onPendingChange(question.id, false);
      }
    }
  }

  return (
    <section
      className="mt-5 rounded-xl border border-[#4c4431] bg-[#18170f] p-4"
      aria-labelledby={panelId + "-title"}
    >
      <h3 className="text-sm font-semibold text-[#f5d67d]" id={panelId + "-title"}>
        Step-by-step hints
      </h3>
      {tracked ? (
        <p className="mt-2 text-xs leading-6 text-[#bbad85]" aria-live="polite">
          {used} of {count} hints revealed. Revealed hints are recorded as assistance for this question.
        </p>
      ) : (
        <p className="mt-2 text-xs leading-6 text-[#bbad85]">
          Hint usage was not recorded for this older attempt. Start a new session to measure independent work.
        </p>
      )}
      <ol className="mt-3 space-y-3 text-sm leading-7 text-[#c2b99d]" id={panelId}>
        {revealed.map((hint, index) => (
          <li key={index}>
            <span className="mr-2 font-mono text-xs text-[#facc15]">Hint {index + 1}.</span>
            <MathText>{hint}</MathText>
          </li>
        ))}
      </ol>
      {tracked && (used < count || missingRevealedText) ? (
        <button
          className="btn mt-4 text-sm"
          type="button"
          onClick={reveal}
          disabled={disabled || pending}
          aria-label={
            missingRevealedText
              ? "Restore revealed hints for question " + questionNumber
              : "Reveal hint " + (used + 1) + " for question " + questionNumber
          }
          aria-controls={panelId}
          aria-expanded={used > 0}
        >
          {pending
            ? "Loading hint…"
            : missingRevealedText
              ? "Restore revealed hints"
              : "Reveal next hint (" + (used + 1) + " of " + count + ")"}
        </button>
      ) : null}
      {tracked && used >= count && count > 0 ? (
        <p className="mt-3 text-xs leading-6 text-[#a99b75]">All available hints are revealed.</p>
      ) : null}
      {tracked && count === 0 ? (
        <p className="mt-3 text-xs leading-6 text-[#a99b75]">No hints are available for this question.</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm leading-7 text-[#f8bd91]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
