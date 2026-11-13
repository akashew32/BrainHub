"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ExamReadiness as Readiness } from "@/lib/curriculum";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";

const statusLabels: Record<Readiness["lessons"][number]["status"], string> = {
  ready: "Ready",
  practice_needed: "Practice needed",
  independent_needed: "Independent practice needed",
  untracked: "Independent score untracked",
  outdated: "Fresh practice needed",
};
const kindLabels: Record<string, string> = {
  number: "Numerical answers",
  vector: "Vectors",
  matrix: "Matrices",
  choice: "Multiple choice",
  proof: "Proof ordering",
};
const difficultyLabels: Record<string, string> = {
  foundation: "Foundation",
  core: "Core",
  stretch: "Stretch",
};

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

export function ExamReadiness({ roadmapSlug, stageIndex = 0 }: { roadmapSlug: string; stageIndex?: number }) {
  return (
    <ReadinessWorkspace
      key={`${roadmapSlug}:${stageIndex}`}
      roadmapSlug={roadmapSlug}
      stageIndex={stageIndex}
    />
  );
}

function ReadinessWorkspace({ roadmapSlug, stageIndex }: { roadmapSlug: string; stageIndex: number }) {
  const [data, setData] = useState<Readiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => {
    setLoading(true);
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    let active = true;
    api
      .examReadiness(roadmapSlug, stageIndex)
      .then((response) => {
        if (!active) return;
        if (response.roadmap_slug !== roadmapSlug || response.stage_index !== stageIndex)
          throw new Error("The readiness checklist could not be confirmed for this subject.");
        setData(response);
        setError(null);
      })
      .catch((problem: unknown) => {
        if (active)
          setError(problem instanceof Error ? problem.message : "Unable to confirm exam readiness.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roadmapSlug, stageIndex, revision]);
  useEffect(() => {
    const refreshVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [refresh]);
  const eligible = !loading && !error && data?.eligible === true;
  return (
    <div className="space-y-6">
      <section className="panel p-5 sm:p-8" aria-labelledby="exam-readiness-heading" aria-busy={loading}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="metric text-[#c084fc]">Prepare independently</p>
            <h2 className="mt-2 text-2xl font-semibold" id="exam-readiness-heading">
              Your exam readiness
            </h2>
          </div>
          <button className="btn" type="button" disabled={loading} onClick={refresh}>
            {loading ? "Checking readiness…" : "Refresh exam readiness"}
          </button>
        </div>
        <p className="mt-4 text-sm leading-7 text-[#a6b6cb]">
          Earn at least 75% independent practice in each of the six lessons before starting a new exam. Only
          correct answers completed without hints count toward the independent score. Your earlier practice
          and exam results remain in your history.
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-[#91a4bb]" role="status">
            Confirming your independent practice…
          </p>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-[#705933] p-4" role="alert">
            <p>We could not confirm exam readiness. {error}</p>
            <p className="mt-2 text-sm leading-7">
              Retry when connected. Any exam you already started remains available below.
            </p>
            <button className="btn mt-3" type="button" onClick={refresh} disabled={loading}>
              Retry exam readiness
            </button>
          </div>
        ) : null}
        <p className="mt-4 font-semibold text-[#b8c9dc]" aria-live="polite">
          {eligible
            ? "Ready to start a new exam"
            : loading
              ? "Checking eligibility for a new exam"
              : error
                ? "Readiness not confirmed"
                : "Complete your independent practice to unlock a new exam"}
        </p>
        {data ? (
          <>
            <p className="mt-2 text-sm text-[#91a4bb]">
              {data.ready_lessons} of {data.required_lessons} lessons ready ·{" "}
              {error || loading ? "Last loaded checklist" : "Updated"} {utcDate(data.generated_at)}
            </p>
            <ol className="mt-5 space-y-4" aria-label="Lesson readiness checklist">
              {data.lessons.map((lesson, index) => (
                <li className="rounded-xl border border-[#263449] p-4" key={lesson.topic_slug}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold">
                      {index + 1}. {lesson.title}
                    </h3>
                    <span className="text-sm text-[#b5c8dc]">{statusLabels[lesson.status]}</span>
                  </div>
                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <div>
                      <dt className="inline text-[#91a4bb]">Best overall practice: </dt>
                      <dd className="inline">
                        {lesson.best_score === null ? "Not recorded" : `${lesson.best_score}%`}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-[#91a4bb]">Best independent practice: </dt>
                      <dd className="inline">
                        {lesson.best_independent_score === null
                          ? "Not measured"
                          : `${lesson.best_independent_score}%`}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-sm leading-7 text-[#a6b6cb]">{lesson.reason}</p>
                  <p className="mt-2 text-xs leading-6 text-[#91a4bb]">
                    {lesson.practice_count} questions per practice set · {lesson.exam_count} questions in the
                    exam{lesson.last_attempt_at ? " · Last practice: " + utcDate(lesson.last_attempt_at) : ""}
                  </p>
                  <Link
                    className="mt-3 inline-block text-sm font-semibold text-[#8dc8ff]"
                    href={lesson.study_url}
                  >
                    Study {lesson.title} →
                  </Link>
                </li>
              ))}
            </ol>
            <section
              className="mt-6 rounded-xl border border-[#263449] p-5"
              aria-labelledby="exam-blueprint-heading"
            >
              <h3 className="text-lg font-semibold" id="exam-blueprint-heading">
                Exam blueprint
              </h3>
              <p className="mt-2 text-sm leading-7 text-[#a6b6cb]">
                {data.blueprint.total_questions} reserved questions across {data.required_lessons} lessons ·{" "}
                {data.pass_score}% to pass · No hints. Worked solutions appear after submission.
              </p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold">Answer formats</h4>
                  <dl className="mt-2 space-y-2 text-sm text-[#a6b6cb]">
                    {Object.entries(data.blueprint.kinds).map(([kind, count]) => (
                      <div className="flex justify-between gap-4" key={kind}>
                        <dt>{kindLabels[kind] ?? kind}</dt>
                        <dd>{count}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Difficulty</h4>
                  <dl className="mt-2 space-y-2 text-sm text-[#a6b6cb]">
                    {Object.entries(data.blueprint.difficulties).map(([difficulty, count]) => (
                      <div className="flex justify-between gap-4" key={difficulty}>
                        <dt>{difficultyLabels[difficulty] ?? difficulty}</dt>
                        <dd>{count}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </section>
      <AssessmentPanel
        roadmapSlug={roadmapSlug}
        stageIndex={stageIndex}
        mode="exam"
        examAvailable={eligible}
        onCompleted={refresh}
      />
    </div>
  );
}
