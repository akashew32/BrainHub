"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AssessmentHistoryPage } from "@/lib/curriculum";
import { learningRoadmaps, roadmapMap } from "@/lib/roadmaps";
import { ASSESSMENT_MODES, type AssessmentMode } from "@/lib/assessment-modes";

function utcDate(value: string) {
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + "Z");
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      }).format(date)
    : "Date unavailable (UTC)";
}

export function AssessmentHistory({ compact = false }: { compact?: boolean }) {
  const [subject, setSubject] = useState("all");
  const [state, setState] = useState<"all" | "active" | "completed" | "expired">("all");
  const [mode, setMode] = useState<"all" | AssessmentMode>("all");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [page, setPage] = useState<{ scope: string; data: AssessmentHistoryPage } | null>(null);
  const [error, setError] = useState<{ scope: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const cursor = cursors[pageIndex];
  const limit = compact ? 6 : 20;
  const scope = JSON.stringify([subject, state, mode, cursor]);
  useEffect(() => {
    let active = true;
    api
      .assessmentSessions({
        roadmap_slug: subject === "all" ? undefined : subject,
        state,
        mode: mode === "all" ? undefined : mode,
        limit,
        cursor,
      })
      .then((data) => {
        if (active) {
          setPage({ scope, data });
          setError(null);
        }
      })
      .catch((problem: unknown) => {
        if (active)
          setError({
            scope,
            message: problem instanceof Error ? problem.message : "Unable to load session history.",
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [subject, state, mode, cursor, scope, revision, limit]);
  const visiblePage = page?.scope === scope ? page.data : null;
  const currentError = error?.scope === scope ? error.message : null;
  function resetPage() {
    setCursors([undefined]);
    setPageIndex(0);
    setLoading(true);
  }
  return (
    <section
      className="panel min-w-0 p-5 sm:p-7"
      id="session-history"
      aria-labelledby="session-history-heading"
    >
      <h2 className="text-2xl font-semibold" id="session-history-heading">
        Your assessment sessions
      </h2>
      {compact ? (
        <Link className="mt-3 inline-block text-sm font-semibold text-[#8dc8ff]" href="/roadmaps/sessions">
          Open full session history →
        </Link>
      ) : null}
      <p className="mt-3 text-sm leading-7 text-[#9baec6]">
        Find active drafts, closed attempts, and completed results from your profile, newest started first.
        Dates use UTC. A saved entry may contain an unfinished answer; saving does not grade it.
      </p>
      <div className="my-5 flex flex-wrap items-end gap-4">
        <label className="text-sm">
          Session subject
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
              <option value={roadmap.slug} key={roadmap.slug}>
                {roadmap.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Session state
          <select
            className="input mt-2 block"
            value={state}
            onChange={(event) => {
              setState(event.target.value as typeof state);
              resetPage();
            }}
          >
            {["all", "active", "completed", "expired"].map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All states" : value[0]!.toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Session mode
          <select
            className="input mt-2 block"
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as typeof mode);
              resetPage();
            }}
          >
            {["all", ...ASSESSMENT_MODES].map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All modes" : value[0]!.toUpperCase() + value.slice(1)}
              </option>
            ))}
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
          Refresh session history
        </button>
      </div>
      {loading ? (
        <p className="my-4 text-sm text-[#91a4bb]" role="status">
          Loading assessment sessions…
        </p>
      ) : null}
      {currentError ? (
        <div className="my-4 rounded-xl border border-[#705933] p-4" role="alert">
          <p>{currentError} Session history is unavailable; no empty history is assumed.</p>
          <button
            className="btn mt-3"
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setRevision((value) => value + 1);
            }}
          >
            Retry session history
          </button>
        </div>
      ) : null}
      {visiblePage ? (
        <>
          <p className="mb-4 text-xs leading-6 text-[#91a4bb]" aria-live="polite">
            Page {pageIndex + 1} · {visiblePage.items.length} sessions shown ·{" "}
            {currentError ? "Last loaded" : "Updated"} {utcDate(visiblePage.generated_at)}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {visiblePage.items.map((session) => (
              <article className="min-w-0 rounded-xl border border-[#263449] p-4" key={session.id}>
                <p className="metric text-[#b5a1ee]">
                  {session.state} · {session.mode} ·{" "}
                  {roadmapMap[session.roadmap_slug]?.title ?? session.roadmap_slug}
                </p>
                <h3 className="mt-2 font-semibold">
                  {session.topic_slug
                    ? session.topic_slug.replaceAll("-", " ")
                    : session.mode === "diagnostic"
                      ? "Foundation diagnostic · limited sample"
                      : session.mode === "study"
                        ? "Personal study set"
                        : `Stage ${session.stage_index + 1} ${session.mode}`}
                </h3>
                <p className="mt-2 text-sm text-[#a6b6cb]">
                  {session.saved_entries} saved entries · {session.question_count} questions
                </p>
                <p className="mt-2 text-xs leading-6 text-[#91a4bb]">
                  Started {utcDate(session.started_at)}
                  {session.completed_at
                    ? " · Completed " + utcDate(session.completed_at)
                    : " · Expires " + utcDate(session.expires_at)}
                </p>
                {session.result_summary ? (
                  session.mode === "study" ? (
                    <div className="mt-3 text-sm leading-7 text-[#b6c5d8]">
                      <p>
                        Study set {session.result_summary.score}% · {session.result_summary.correct}/
                        {session.result_summary.total} correct
                      </p>
                      <p>
                        Practice feedback from a personal study set. This result does not complete a lesson or
                        unlock an exam.
                      </p>
                      <p>
                        {session.result_summary.independent_score === null
                          ? "Independent work untracked"
                          : `Independent answers: ${session.result_summary.independent_score}%`}
                      </p>
                    </div>
                  ) : session.mode === "diagnostic" ? (
                    <div className="mt-3 text-sm leading-7 text-[#b6c5d8]">
                      <p>
                        Sample {session.result_summary.score}% · {session.result_summary.correct}/
                        {session.result_summary.total} correct
                      </p>
                      <p>
                        Limited diagnostic sample. Verify with full lesson practice; this result does not
                        qualify a lesson or stage exam.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm leading-7 text-[#b6c5d8]">
                      <p>
                        Overall {session.result_summary.score}% · {session.result_summary.correct}/
                        {session.result_summary.total} correct ·{" "}
                        {session.result_summary.passed ? "Passed" : "Review needed"}
                      </p>
                      <p>
                        {session.result_summary.independent_score === null
                          ? "Independent score untracked"
                          : `Independent ${session.result_summary.independent_score}%`}
                        {" · "}
                        {session.result_summary.assistance === "independent"
                          ? "Completed without hints"
                          : session.result_summary.assistance === "assisted"
                            ? "Hints used"
                            : "Hint usage untracked"}
                      </p>
                    </div>
                  )
                ) : session.state === "completed" ? (
                  <p className="mt-3 text-sm text-[#91a4bb]">
                    A result summary is unavailable for this older attempt.
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  {session.open_url?.startsWith("/roadmaps/sessions/") ? (
                    <Link className="font-semibold text-[#8dc8ff]" href={session.open_url}>
                      {session.state === "active"
                        ? "Resume saved session"
                        : session.state === "completed" && session.result_available
                          ? session.mode === "diagnostic"
                            ? "View diagnostic guidance"
                            : session.mode === "study"
                              ? "View study feedback"
                              : "View saved result"
                          : "View closed session"}
                    </Link>
                  ) : (
                    <p className="text-[#b8a789]">This older session cannot be reopened.</p>
                  )}
                  {session.study_url?.startsWith("/roadmaps/") ? (
                    <Link className="text-[#9baec6]" href={session.study_url}>
                      Study lesson
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          {!visiblePage.items.length ? (
            <p className="rounded-xl border border-[#263449] p-5 leading-8 text-[#a6b6cb]">
              No assessment sessions match these filters. Try another filter or start a lesson practice set.
            </p>
          ) : null}
          <nav className="mt-5 flex flex-wrap gap-3" aria-label="Session history pages">
            <button
              className="btn"
              type="button"
              disabled={loading || pageIndex === 0}
              onClick={() => {
                setLoading(true);
                setPageIndex((value) => value - 1);
              }}
            >
              Previous session page
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
              Next session page
            </button>
          </nav>
        </>
      ) : null}
    </section>
  );
}
