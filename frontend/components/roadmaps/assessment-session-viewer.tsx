"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AssessmentSession } from "@/lib/curriculum";
import { UUID_PATTERN } from "@/lib/assessment-recovery";
import { assessmentTitle } from "@/lib/assessment-modes";
import {
  AssessmentPanel,
  cachedSelectedAssessment,
  publicSession,
} from "@/components/roadmaps/assessment-panel";

type OpenedSession = { session: AssessmentSession; receivedAt: number; fresh: boolean };

export function AssessmentSessionViewer({ sessionId }: { sessionId: string }) {
  if (!UUID_PATTERN.test(sessionId))
    return (
      <div className="panel mx-auto max-w-4xl p-6" role="alert">
        <p>This assessment link is invalid. Open an assessment from your session history.</p>
        <Link className="btn mt-4 inline-block" href="/roadmaps/sessions">
          Your assessment sessions
        </Link>
      </div>
    );
  return <SelectedSession key={sessionId} sessionId={sessionId} />;
}

function SelectedSession({ sessionId }: { sessionId: string }) {
  const [opened, setOpened] = useState<OpenedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api
      .resumeAssessment(sessionId)
      .then((session) => {
        if (!active) return;
        if (!publicSession(session) || session.id !== sessionId) {
          setOpened(null);
          setError(
            "The selected assessment could not be verified. Your other saved attempts have not been opened.",
          );
          return;
        }
        setOpened({ session, receivedAt: performance.now(), fresh: true });
        setError(null);
      })
      .catch((problem: unknown) => {
        if (!active) return;
        const unavailable = !(problem instanceof ApiError) || problem.status >= 500;
        const closed = problem instanceof ApiError && [409, 410].includes(problem.status);
        const cached = unavailable || closed ? cachedSelectedAssessment(sessionId) : null;
        if (cached)
          setOpened({
            session: closed
              ? { ...cached, state: cached.result ? "completed" : "expired", expires_in_seconds: 0 }
              : cached,
            receivedAt: performance.now(),
            fresh: false,
          });
        else if (!unavailable) setOpened(null);
        setError(
          problem instanceof ApiError && problem.status === 404
            ? "This assessment was not found in your profile. Check the link or return to your session history."
            : problem instanceof Error
              ? problem.message
              : "Unable to open the selected assessment.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId, revision]);

  const session = opened?.session;
  const title =
    session && session.mode !== "practice"
      ? assessmentTitle(session.mode, session.stage_index ?? 0)
      : (session?.questions.find((question) => question.lesson_title)?.lesson_title ??
        (session?.topic_slug ? session.topic_slug.replaceAll("-", " ") : "Saved practice assessment"));
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link className="inline-block text-sm text-[#93a8c1]" href="/roadmaps/sessions">
        ← Your assessment sessions
      </Link>
      <header className="panel p-5 sm:p-8">
        <p className="metric text-[#c084fc]">Selected assessment</p>
        <h1 className="mt-3 text-3xl font-semibold">{session ? title : "Open your saved assessment"}</h1>
        {session ? (
          <p className="mt-3 text-sm leading-7 text-[#9fb1c7]">
            {session.roadmap_slug.replaceAll("-", " ")} · {session.mode} · Stage{" "}
            {(session.stage_index ?? 0) + 1}. This page opens this specific attempt. Your other saved attempts
            stay separate.
          </p>
        ) : null}
        {opened && !opened.fresh ? (
          <p className="mt-3 text-sm leading-7 text-[#e3c18f]">
            {session?.state === "expired"
              ? "Saved copy of the selected closed assessment. Your responses remain available to read and copy."
              : "Offline copy of the selected assessment. Reconnect to confirm its current status."}
          </p>
        ) : null}
      </header>
      {loading ? (
        <p role="status" className="text-sm text-[#9fb1c7]">
          Opening the selected assessment…
        </p>
      ) : null}
      {error ? (
        <div className="panel p-5" role="alert">
          <p>{error}</p>
          <button
            className="btn mt-4"
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setRevision((value) => value + 1);
            }}
          >
            Retry selected assessment
          </button>
        </div>
      ) : null}
      {opened ? (
        <AssessmentPanel
          roadmapSlug={opened.session.roadmap_slug}
          topicSlug={opened.session.topic_slug ?? undefined}
          stageIndex={opened.session.stage_index ?? 0}
          mode={opened.session.mode}
          selectedSession={opened.session}
          selectedReceivedAt={opened.receivedAt}
          selectedSessionFresh={opened.fresh}
        />
      ) : null}
    </div>
  );
}
