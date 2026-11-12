"use client";

import { useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Play, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import type { AssessmentResult, AssessmentSession, MathQuestion } from "@/lib/curriculum";
import { MathText } from "@/components/roadmaps/math-text";
import { useRoadmapProgress } from "@/components/roadmaps/roadmap-progress-provider";

function answerHelp(kind: MathQuestion["kind"]) {
  if (kind === "vector") return 'Enter a vector as [1, 2]. Entries may be fractions in quotes: ["1/2", 3].';
  if (kind === "matrix") return "Enter rows as [[1, 2], [3, 4]]. Check the requested dimensions.";
  if (kind === "proof")
    return "Put the numbered steps in logical order, for example [3, 1, 2]. Use each step once.";
  return "Enter a number, decimal, or fraction such as 3/4. Decimal answers are accepted within the stated precision.";
}

export function AssessmentPanel({
  roadmapSlug,
  topicSlug,
  mode = "practice",
}: {
  roadmapSlug: string;
  topicSlug?: string;
  mode?: "practice" | "exam" | "review";
}) {
  const { acceptProgress } = useRoadmapProgress();
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);
  const submitting = useRef(false);
  const title =
    mode === "exam"
      ? "Stage 1 examination"
      : mode === "review"
        ? "Targeted retrieval practice"
        : "Practice and mastery";

  async function start() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await api.startAssessment(roadmapSlug, { mode, topic_slug: topicSlug, stage_index: 0 });
      setSession(next);
      setResult(null);
      setAnswers({});
      startedAt.current = Date.now();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to start. Please try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function submit() {
    if (!session || submitting.current) return;
    const missing = session.questions.find((question) => !answers[question.id]?.trim());
    if (missing) {
      setError("Answer every question before submitting. Your entries are kept while you complete the set.");
      document.getElementById(`question-${missing.id}`)?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await api.submitAssessment(session.id, {
        answers: session.questions.map((question) => ({
          question_id: question.id,
          answer: answers[question.id],
        })),
        time_spent_seconds: Math.min(7200, Math.floor((Date.now() - startedAt.current) / 1000)),
      });
      setResult(next);
      if (next.progress) acceptProgress(next.progress);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to grade. Your answers are still here; try again.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const answered = session?.questions.filter((question) => Boolean(answers[question.id]?.trim())).length ?? 0;
  return (
    <section
      className="panel scroll-mt-24 p-6 sm:p-8"
      id="practice"
      aria-labelledby={`assessment-${mode}`}
      aria-busy={busy}
    >
      <p className="metric text-[#63e6be]">Apply the mathematics</p>
      <h2 className="mt-2 text-2xl font-semibold" id={`assessment-${mode}`}>
        {title}
      </h2>
      <p className="mt-3 leading-7 text-[#9ba8b9]">
        {mode === "exam"
          ? "Twelve reserved questions cover all six lessons. Complete each lesson practice set first. A score of 75% passes the exam."
          : mode === "review"
            ? "Revisit questions selected from your recent mistakes and due recall practice."
            : "Solve eight questions to check the lesson. A score of 75% completes it. Worked feedback appears after you submit."}
      </p>
      {!session ? (
        <button
          className="btn btn-primary mt-5 inline-flex items-center gap-2"
          onClick={start}
          disabled={busy}
          type="button"
        >
          <Play size={15} />
          {busy ? "Preparing…" : `Start ${mode}`}
        </button>
      ) : null}
      {session && !result ? (
        <div className="mt-6">
          <p className="mb-6 text-sm text-[#91a1b5]" aria-live="polite">
            {answered} of {session.questions.length} answered · {session.pass_score}% to pass
          </p>
          <div className="space-y-6">
            {session.questions.map((question, index) => (
              <fieldset className="rounded-xl border border-[#263449] p-4 sm:p-5" key={question.id}>
                <legend className="px-2 text-xs text-[#8ea1bb]">
                  Question {index + 1} · {question.difficulty} · {question.concept}
                </legend>
                <p className="mb-4 leading-8">
                  <MathText>{question.prompt}</MathText>
                </p>
                {question.kind === "choice" ? (
                  <div className="grid gap-2">
                    {question.choices?.map((choice, choiceIndex) => (
                      <label
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#29384c] p-3 leading-7"
                        key={choice}
                      >
                        <input
                          className="mt-2"
                          type="radio"
                          name={question.id}
                          id={choiceIndex === 0 ? `question-${question.id}` : undefined}
                          checked={answers[question.id] === choice}
                          onChange={() => setAnswers((current) => ({ ...current, [question.id]: choice }))}
                        />
                        <MathText>{choice}</MathText>
                      </label>
                    ))}
                  </div>
                ) : (
                  <>
                    {question.kind === "proof" ? (
                      <ol className="mb-4 space-y-2">
                        {question.choices?.map((step, stepIndex) => (
                          <li className="rounded-lg bg-[#111b28] p-3 text-sm leading-7" key={step}>
                            <span className="mr-2 font-mono text-[#a78bfa]">{stepIndex + 1}.</span>
                            <MathText>{step}</MathText>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                    <label className="block text-sm text-[#b3c1d3]" htmlFor={`question-${question.id}`}>
                      Answer to question {index + 1}
                    </label>
                    <input
                      className="math-answer mt-2"
                      id={`question-${question.id}`}
                      autoComplete="off"
                      spellCheck={false}
                      value={answers[question.id] ?? ""}
                      onChange={(event) =>
                        setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                      aria-describedby={`help-${question.id}`}
                    />
                    <p className="mt-2 text-xs leading-6 text-[#8396ad]" id={`help-${question.id}`}>
                      {answerHelp(question.kind)}
                    </p>
                  </>
                )}
                {mode !== "exam" ? (
                  <details className="mt-4 text-sm">
                    <summary className="cursor-pointer text-[#facc15]">Hints</summary>
                    <ol className="mt-3 space-y-2 leading-7 text-[#99aabd]">
                      {question.hints.map((hint, hintIndex) => (
                        <li key={hint}>
                          {hintIndex + 1}. <MathText>{hint}</MathText>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </fieldset>
            ))}
          </div>
          <button className="btn btn-primary mt-6" type="button" onClick={submit} disabled={busy}>
            {busy ? "Grading…" : `Submit ${mode}`}
          </button>
        </div>
      ) : null}
      {result ? (
        <div className="mt-6">
          <div
            className={`rounded-xl border p-5 ${result.passed ? "border-[#28654c] bg-[#10251c]" : "border-[#705332] bg-[#281e10]"}`}
            role="status"
          >
            <p className="flex items-center gap-2 text-xl font-semibold">
              {result.passed ? <CheckCircle2 size={21} /> : <CircleAlert size={21} />}
              {result.score}% · {result.correct}/{result.total} correct
            </p>
            <p className="mt-2 leading-7">
              {result.passed
                ? mode === "practice"
                  ? "Lesson mastered. Your progress has been saved."
                  : "Assessment passed. Your responses have been saved."
                : "Review the worked feedback, then try a new session. Your mistakes are saved for targeted practice."}
            </p>
          </div>
          <div className="mt-5 space-y-4">
            {result.feedback.map((item, index) => (
              <details
                className="rounded-xl border border-[#29374a] p-4"
                key={item.question_id}
                open={!item.correct}
              >
                <summary className="cursor-pointer font-semibold">
                  Question {index + 1}: {item.correct ? "Correct" : "Review needed"} · {item.concept}
                </summary>
                <p className="mt-3 leading-8">
                  <MathText>{item.prompt}</MathText>
                </p>
                <p className="mt-3 text-sm text-[#94a5ba]">
                  Your answer:{" "}
                  <code className="break-all">
                    {typeof item.submitted_answer === "string"
                      ? item.submitted_answer
                      : JSON.stringify(item.submitted_answer)}
                  </code>
                </p>
                <p className="mt-2 text-sm text-[#63e6be]">
                  Expected: <code className="break-all">{JSON.stringify(item.expected_answer)}</code>
                </p>
                <p className="mt-4 leading-8 text-[#becada]">
                  <MathText>{item.solution}</MathText>
                </p>
              </details>
            ))}
          </div>
          <button
            className="btn mt-5 inline-flex items-center gap-2"
            onClick={start}
            disabled={busy}
            type="button"
          >
            <RotateCcw size={15} />
            Start another session
          </button>
        </div>
      ) : null}
      <div aria-live="assertive">
        {error ? (
          <p
            className="mt-5 rounded-xl border border-[#704533] bg-[#261611] p-4 leading-7 text-[#fdba9a]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
