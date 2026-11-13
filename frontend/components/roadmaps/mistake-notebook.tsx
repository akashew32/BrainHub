"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { NotebookAttempt, NotebookDetail, NotebookEntry, NotebookPage } from "@/lib/curriculum";
import { learningRoadmaps, roadmapMap } from "@/lib/roadmaps";
import { MathText } from "@/components/roadmaps/math-text";
import { QuestionReflection } from "@/components/roadmaps/question-reflection";
import { ConceptPerformancePanel } from "@/components/roadmaps/concept-performance";

function utcDate(value: string) {
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + "Z");
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      }).format(date)
    : "Date unavailable (UTC)";
}
const outcomes: Record<NotebookEntry["latest_outcome"], string> = {
  mistake: "Incorrect answer",
  assisted: "Answered with hints",
  untracked: "Hint usage untracked",
  independent: "Correct without hints",
};
function answer(value: unknown) {
  return typeof value === "string" ? value : (JSON.stringify(value) ?? "No answer recorded");
}

function AttemptSnapshot({ attempt }: { attempt: NotebookAttempt }) {
  return (
    <details className="rounded-xl border border-[#263449] p-4">
      <summary className="cursor-pointer leading-7">
        Attempt {attempt.attempt_id} · {attempt.correct ? "Correct" : "Incorrect"} ·{" "}
        {attempt.assistance === "independent"
          ? "No hints"
          : attempt.assistance === "assisted"
            ? `${attempt.hints_used ?? "Recorded"} hints`
            : "Hint usage untracked"}{" "}
        · {utcDate(attempt.created_at)}
      </summary>
      <p className="mt-3 text-xs text-[#91a4bb]">
        {attempt.mode} · Historical feedback saved with this completed attempt
      </p>
      <p className="mt-4 leading-8">
        <MathText>{attempt.prompt}</MathText>
      </p>
      <p className="mt-3 text-sm text-[#a6b6cb]">
        Your answer: <code className="whitespace-pre-wrap break-all">{answer(attempt.submitted_answer)}</code>
      </p>
      <p className="mt-3 text-sm text-[#63e6be]">
        Expected in this attempt:{" "}
        <code className="whitespace-pre-wrap break-all">{answer(attempt.expected_answer)}</code>
      </p>
      {attempt.proof_details ? (
        <section
          className="mt-4 rounded-lg bg-[#101a25] p-4"
          aria-label={`Proof feedback for attempt ${attempt.attempt_id}`}
        >
          <h4 className="font-semibold">One valid proof</h4>
          <ol className="mt-3 list-decimal space-y-3 pl-5">
            {attempt.proof_details.expected_steps.map((step) => (
              <li key={step.step}>
                <MathText>{step.text}</MathText>
                {step.justification ? (
                  <p className="mt-1 text-sm text-[#a6b6cb]">
                    <MathText>{step.justification}</MathText>
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mt-3 leading-8">
            <MathText>{attempt.proof_details.explanation}</MathText>
          </p>
        </section>
      ) : null}
      <p className="mt-4 leading-8 text-[#bdcadd]">
        <MathText>{attempt.solution}</MathText>
      </p>
    </details>
  );
}

function NotebookQuestion({ entry }: { entry: NotebookEntry }) {
  const [detail, setDetail] = useState<NotebookDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const active = useRef(false);
  const pendingOlder = useRef(false);
  useEffect(() => {
    active.current = true;
    let current = true;
    api
      .notebookQuestion(entry.roadmap_slug, entry.question_id)
      .then((response) => {
        if (current) {
          setDetail(response);
          setError(null);
        }
      })
      .catch((problem: unknown) => {
        if (current)
          setError(problem instanceof Error ? problem.message : "Unable to load this question's history.");
      });
    return () => {
      current = false;
      active.current = false;
    };
  }, [entry.roadmap_slug, entry.question_id, revision]);

  async function loadOlder() {
    const cursor = detail?.history.next_cursor;
    if (!cursor || pendingOlder.current) return;
    pendingOlder.current = true;
    setLoadingOlder(true);
    try {
      const next = await api.notebookQuestion(entry.roadmap_slug, entry.question_id, cursor);
      if (!active.current) return;
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              history: {
                ...next.history,
                items: [
                  ...previous.history.items,
                  ...next.history.items.filter(
                    (row) =>
                      !previous.history.items.some((existing) => existing.attempt_id === row.attempt_id),
                  ),
                ],
              },
            }
          : next,
      );
      setError(null);
    } catch (problem) {
      if (active.current)
        setError(problem instanceof Error ? problem.message : "Unable to load older attempts.");
    } finally {
      if (active.current) {
        pendingOlder.current = false;
        setLoadingOlder(false);
      }
    }
  }

  return (
    <section className="panel min-w-0 space-y-6 p-5 sm:p-7" aria-label={`Notebook entry: ${entry.concept}`}>
      <div>
        <p className="metric text-[#c084fc]">
          Open notebook entry · {roadmapMap[entry.roadmap_slug]?.title ?? entry.roadmap_slug}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{entry.concept}</h2>
        <p className="mt-3 text-sm leading-7 text-[#91a4bb]">
          This entry stays open when you filter or change list pages. Your reflection is separate from your
          assessment answers.
        </p>
      </div>
      {!detail && !error ? <p role="status">Loading completed attempt history…</p> : null}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            className="btn mt-3"
            type="button"
            onClick={() => (detail ? loadOlder() : setRevision((value) => value + 1))}
          >
            Retry question history
          </button>
        </div>
      ) : null}
      {detail ? (
        <>
          {detail.entry.archived ? (
            <p className="rounded-xl border border-[#705933] p-4 text-sm leading-7">
              Archived question. Practice is unavailable; your historical feedback and reflection remain
              readable.
            </p>
          ) : detail.entry.practice_url?.startsWith("/roadmaps/") ? (
            <Link className="btn inline-block" href={detail.entry.practice_url}>
              Open lesson practice
            </Link>
          ) : null}
          <QuestionReflection
            roadmapSlug={entry.roadmap_slug}
            questionId={entry.question_id}
            concept={entry.concept}
            initialNote={detail.note}
            onSaved={(note) => setDetail((previous) => (previous ? { ...previous, note } : previous))}
          />
          <section aria-label="Completed attempt snapshots">
            <h3 className="text-lg font-semibold">Your completed attempts</h3>
            <p className="my-3 text-sm leading-7 text-[#91a4bb]">
              Only your saved feedback snapshots appear here. A later curriculum change does not replace an
              older attempt&apos;s explanation.
            </p>
            <div className="space-y-3">
              {detail.history.items.map((attempt) => (
                <AttemptSnapshot key={attempt.attempt_id} attempt={attempt} />
              ))}
            </div>
            {detail.history.next_cursor ? (
              <button className="btn mt-4" type="button" disabled={loadingOlder} onClick={loadOlder}>
                {loadingOlder ? "Loading older attempts…" : "Load older attempts"}
              </button>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  );
}

export function MistakeNotebook() {
  const [subject, setSubject] = useState("all");
  const [state, setState] = useState<"all" | "unresolved" | "resolved">("all");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [page, setPage] = useState<{ scope: string; value: NotebookPage } | null>(null);
  const [error, setError] = useState<{ scope: string; message: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NotebookEntry | null>(null);
  const cursor = cursors[pageIndex];
  const scope = JSON.stringify([subject, state, cursor]);
  useEffect(() => {
    let active = true;
    api
      .roadmapNotebook({ roadmap_slug: subject === "all" ? undefined : subject, state, limit: 20, cursor })
      .then((value) => {
        if (active) {
          setPage({ scope, value });
          setError(null);
        }
      })
      .catch((problem: unknown) => {
        if (active)
          setError({
            scope,
            message: problem instanceof Error ? problem.message : "Unable to load your notebook.",
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [subject, state, cursor, scope, revision]);
  const visiblePage = page?.scope === scope ? page.value : null;
  const currentError = error?.scope === scope ? error.message : null;
  function resetPage() {
    setCursors([undefined]);
    setPageIndex(0);
    setLoading(true);
  }
  return (
    <div className="space-y-7">
      <section className="panel p-5 sm:p-7" aria-labelledby="notebook-history-heading">
        <h2 className="text-2xl font-semibold" id="notebook-history-heading">
          Your learning history
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#9baec6]">
          Questions enter this notebook after an incorrect, hint-assisted, or untracked answer. An independent
          correct answer resolves the entry without removing its history.
        </p>
        <div className="mt-5 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            Notebook subject
            <select
              className="input mt-2 block"
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value);
                resetPage();
              }}
            >
              <option value="all">All subjects</option>
              {learningRoadmaps.map((roadmap) => (
                <option key={roadmap.slug} value={roadmap.slug}>
                  {roadmap.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Notebook status
            <select
              className="input mt-2 block"
              value={state}
              onChange={(event) => {
                setState(event.target.value as typeof state);
                resetPage();
              }}
            >
              <option value="all">All entries</option>
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <button
            className="btn"
            type="button"
            disabled={loading}
            onClick={() => {
              resetPage();
              setRevision((value) => value + 1);
            }}
          >
            Refresh notebook
          </button>
        </div>
        <p className="mt-3 text-xs leading-6 text-[#91a4bb]">
          Subject filters also apply to concept performance. Status filters apply to notebook entries only.
          All history dates use UTC.
        </p>
      </section>
      {loading ? (
        <p role="status" className="text-sm text-[#91a4bb]">
          Loading notebook entries…
        </p>
      ) : null}
      {currentError ? (
        <div className="panel p-5" role="alert">
          <p>{currentError}</p>
          <button
            className="btn mt-3"
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setRevision((value) => value + 1);
            }}
          >
            Retry notebook
          </button>
        </div>
      ) : null}
      {visiblePage ? (
        <section aria-label="Notebook entries">
          <p className="mb-4 text-sm text-[#91a4bb]" aria-live="polite">
            Page {pageIndex + 1} · {visiblePage.items.length} entries shown · Updated{" "}
            {utcDate(visiblePage.generated_at)}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {visiblePage.items.map((entry) => (
              <article className="panel min-w-0 p-5" key={`${entry.roadmap_slug}:${entry.question_id}`}>
                <p className="metric text-[#c084fc]">
                  {entry.status === "resolved" ? "Resolved" : "Unresolved"} ·{" "}
                  {roadmapMap[entry.roadmap_slug]?.title ?? entry.roadmap_slug}
                  {entry.archived ? " · Archived" : ""}
                </p>
                <h3 className="mt-3 text-lg font-semibold">{entry.concept}</h3>
                <p className="mt-3 leading-8 text-[#b1c1d7]">
                  <MathText>{entry.prompt}</MathText>
                </p>
                <p className="mt-3 text-sm text-[#a6b6cb]">
                  Latest: {outcomes[entry.latest_outcome]} · {entry.attempts} recorded answers
                </p>
                <p className="mt-2 text-xs leading-6 text-[#91a4bb]">
                  {entry.incorrect_attempts} incorrect · {entry.assisted_attempts} with hints ·{" "}
                  {entry.untracked_attempts} untracked · {entry.independent_correct_attempts} independently
                  correct
                </p>
                <p className="mt-2 text-xs text-[#91a4bb]">Last answered {utcDate(entry.last_attempt_at)}</p>
                {entry.has_note ? (
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-[#a6b6cb]">
                    Reflection: {entry.note_preview}
                  </p>
                ) : null}
                <button
                  className="btn mt-4"
                  type="button"
                  aria-pressed={
                    selected?.roadmap_slug === entry.roadmap_slug &&
                    selected.question_id === entry.question_id
                  }
                  onClick={() => setSelected(entry)}
                >
                  Open {entry.concept} notebook entry
                </button>
              </article>
            ))}
          </div>
          {!visiblePage.items.length ? (
            <p className="panel p-6 leading-8 text-[#a6b6cb]">
              No notebook entries match these filters. Complete a lesson practice set to build your history,
              or choose another filter. Resolved entries stay in your notebook.
            </p>
          ) : null}
          <nav className="mt-5 flex flex-wrap items-center gap-4" aria-label="Notebook pages">
            <button
              className="btn"
              type="button"
              disabled={loading || pageIndex === 0}
              onClick={() => {
                setLoading(true);
                setPageIndex((value) => value - 1);
              }}
            >
              Previous notebook page
            </button>
            <button
              className="btn"
              type="button"
              disabled={loading || !visiblePage.next_cursor}
              onClick={() => {
                if (!visiblePage.next_cursor) return;
                setLoading(true);
                setCursors((previous) => [...previous.slice(0, pageIndex + 1), visiblePage.next_cursor!]);
                setPageIndex((value) => value + 1);
              }}
            >
              Next notebook page
            </button>
          </nav>
        </section>
      ) : null}
      {selected ? (
        <NotebookQuestion key={`${selected.roadmap_slug}:${selected.question_id}`} entry={selected} />
      ) : null}
      <ConceptPerformancePanel roadmapSlug={subject === "all" ? undefined : subject} />
    </div>
  );
}
