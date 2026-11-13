"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AssessmentHistoryPage, ConceptPerformance, ExamReadiness, ReviewPlan } from "@/lib/curriculum";
import { learningRoadmaps, roadmapCounts } from "@/lib/roadmaps";
import { AssessmentHistory } from "@/components/roadmaps/assessment-history";

type Data = ReviewPlan | ConceptPerformance | ExamReadiness | AssessmentHistoryPage;
type Resource = { data: Data | null; loading: boolean; error: string | null };
type Source = { key: string; load: () => Promise<Data> };
const sources: Source[] = [
  { key: "review", load: api.roadmapReviewPlan },
  { key: "performance", load: () => api.conceptPerformance() },
  { key: "active", load: () => api.assessmentSessions({ state: "active", limit: 3 }) },
  ...learningRoadmaps.map((roadmap) => ({
    key: roadmap.slug,
    load: async () => {
      const data = await api.examReadiness(roadmap.slug);
      if (data.roadmap_slug !== roadmap.slug || data.stage_index !== 0)
        throw new Error("Readiness could not be confirmed for this subject.");
      return data;
    },
  })),
];
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
function ResourceStatus({
  resource,
  label,
  retry,
}: {
  resource: Resource;
  label: string;
  retry: () => void;
}) {
  return resource.error ? (
    <div className="mt-4 text-sm leading-7 text-[#e3be9d]" role="alert">
      <p>
        {label} unavailable. {resource.error}
      </p>
      <button className="btn mt-3" type="button" disabled={resource.loading} onClick={retry}>
        Retry {label.toLowerCase()}
      </button>
    </div>
  ) : resource.loading ? (
    <p className="mt-4 text-sm text-[#91a4bb]" role="status">
      Loading {label.toLowerCase()}…
    </p>
  ) : null;
}

export function LearningDashboard() {
  const [resources, setResources] = useState<Record<string, Resource>>(() =>
    Object.fromEntries(sources.map((source) => [source.key, { data: null, loading: true, error: null }])),
  );
  const mounted = useRef(false);
  const generations = useRef<Record<string, number>>({});
  const load = useCallback((selected: Source[]) => {
    const requests = selected.map((source) => {
      const generation = (generations.current[source.key] ?? 0) + 1;
      generations.current[source.key] = generation;
      return { source, generation };
    });
    setResources((previous) => {
      const next = { ...previous };
      for (const { source } of requests) next[source.key] = { ...previous[source.key]!, loading: true };
      return next;
    });
    void Promise.allSettled(
      requests.map(async ({ source, generation }) => {
        let settled: { data: Data; error: null } | { error: string };
        try {
          settled = { data: await source.load(), error: null };
        } catch (problem) {
          settled = { error: problem instanceof Error ? problem.message : "Please try again." };
        }
        if (!mounted.current || generations.current[source.key] !== generation) return;
        setResources((previous) => {
          if (!mounted.current || generations.current[source.key] !== generation) return previous;
          return { ...previous, [source.key]: { ...previous[source.key]!, ...settled, loading: false } };
        });
      }),
    );
  }, []);
  useEffect(() => {
    mounted.current = true;
    load(sources);
    return () => {
      mounted.current = false;
    };
  }, [load]);
  const retry = (key: string) => load(sources.filter((source) => source.key === key));
  const reviewResource = resources.review!;
  const performanceResource = resources.performance!;
  const activeResource = resources.active!;
  const review = !reviewResource.error ? (reviewResource.data as ReviewPlan | null) : null;
  const performance = !performanceResource.error
    ? (performanceResource.data as ConceptPerformance | null)
    : null;
  const active = !activeResource.error ? (activeResource.data as AssessmentHistoryPage | null) : null;
  const weak =
    performance?.concepts
      .filter(
        (concept) =>
          concept.independent.answers > 0 &&
          concept.independent.accuracy !== null &&
          concept.independent.accuracy < 75,
      )
      .sort(
        (a, b) =>
          a.independent.accuracy! - b.independent.accuracy! || b.independent.answers - a.independent.answers,
      )
      .slice(0, 5) ?? [];
  const evidenceNeeded =
    performance?.concepts
      .filter(
        (concept) =>
          concept.independent.answers === 0 && concept.assisted.answers + concept.untracked.answers > 0,
      )
      .slice(0, 3) ?? [];
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link className="btn btn-primary" href="/roadmaps/study">
          Plan a short study set
        </Link>
        <p className="max-w-3xl text-sm leading-7 text-[#9baec6]">
          Use due review first, continue a saved attempt, or work on the next lesson that needs independent
          practice. These recommendations come from graded answers and saved sessions.
        </p>
        <button
          className="btn"
          type="button"
          disabled={Object.values(resources).some((resource) => resource.loading)}
          onClick={() => load(sources)}
        >
          Refresh learning dashboard
        </button>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5 sm:p-7" aria-labelledby="dashboard-review-heading">
          <h2 className="text-xl font-semibold" id="dashboard-review-heading">
            Due review and daily recall
          </h2>
          <ResourceStatus resource={reviewResource} label="Review plan" retry={() => retry("review")} />
          {review ? (
            <>
              <dl className="mt-5 grid grid-cols-2 gap-5">
                {[
                  ["Due now", review.summary.due],
                  ["Scheduled later", review.summary.scheduled],
                  ["Review questions today (UTC)", review.summary.reviewed_today],
                  ["Independent recalls today (UTC)", review.summary.independent_today],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="metric text-[#93a5bc]">{label}</dt>
                    <dd className="mt-2 text-2xl font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm leading-7 text-[#9baec6]">
                {review.summary.due > 0
                  ? "Start with your due questions. Each review set contains up to 8 questions from one subject."
                  : review.summary.tracked === 0
                    ? "Complete a lesson practice set to build your recall schedule."
                    : "Nothing is due right now."}
                {review.summary.next_due_at
                  ? " Next scheduled review: " + utcDate(review.summary.next_due_at) + "."
                  : ""}
              </p>
              <Link className="btn mt-4 inline-block" href="/roadmaps/review">
                {review.summary.due > 0 ? "Review due questions" : "Open daily review plan"}
              </Link>
            </>
          ) : null}
        </section>
        <section className="panel p-5 sm:p-7" aria-labelledby="dashboard-independent-heading">
          <h2 className="text-xl font-semibold" id="dashboard-independent-heading">
            Independent work · last 14 UTC days
          </h2>
          <ResourceStatus
            resource={performanceResource}
            label="Recent performance"
            retry={() => retry("performance")}
          />
          {performance ? (
            <>
              <dl className="mt-5 grid grid-cols-2 gap-5">
                {[
                  [
                    "Independent correct / answered",
                    `${performance.totals.independent.correct}/${performance.totals.independent.answers}`,
                  ],
                  [
                    "Independent accuracy",
                    performance.totals.independent.accuracy === null
                      ? "Not measured"
                      : `${performance.totals.independent.accuracy}%`,
                  ],
                  ["Answers with hints", performance.totals.assisted.answers],
                  ["Hint usage untracked", performance.totals.untracked.answers],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="metric text-[#93a5bc]">{label}</dt>
                    <dd className="mt-2 text-2xl font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm leading-7 text-[#9baec6]">
                Independent accuracy includes correct and incorrect answers completed without hints. Missing
                evidence is not a zero score.
              </p>
              <Link
                className="mt-4 inline-block text-sm font-semibold text-[#8dc8ff]"
                href="/roadmaps/notebook"
              >
                Explore concepts and reflections →
              </Link>
            </>
          ) : null}
        </section>
      </div>
      <section className="panel p-5 sm:p-7" aria-labelledby="dashboard-active-heading">
        <h2 className="text-xl font-semibold" id="dashboard-active-heading">
          Continue an active session
        </h2>
        <ResourceStatus resource={activeResource} label="Active sessions" retry={() => retry("active")} />
        {active ? (
          <>
            <p className="mt-3 text-sm leading-7 text-[#91a4bb]">
              Up to three recent active sessions. Opening one recovers that exact assignment without creating
              a new set.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {active.items.map((session) => (
                <article className="rounded-xl border border-[#263449] p-4" key={session.id}>
                  <h3 className="font-semibold">
                    {learningRoadmaps.find((roadmap) => roadmap.slug === session.roadmap_slug)?.title ??
                      session.roadmap_slug}{" "}
                    · {session.mode}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[#91a4bb]">
                    {session.saved_entries} saved entries · {session.question_count} questions
                    <br />
                    Expires {utcDate(session.expires_at)}
                  </p>
                  {session.open_url?.startsWith("/roadmaps/sessions/") ? (
                    <Link className="btn mt-3 inline-block" href={session.open_url}>
                      Resume this session
                    </Link>
                  ) : (
                    <p className="mt-3 text-sm text-[#c7ae8e]">This older assignment cannot be reopened.</p>
                  )}
                </article>
              ))}
            </div>
            {!active.items.length ? (
              <p className="mt-4 text-sm text-[#91a4bb]">
                No active sessions were found. Choose a foundation lesson below.
              </p>
            ) : null}
            <a className="mt-4 inline-block text-sm text-[#8dc8ff]" href="#session-history">
              Find more sessions in your history ↓
            </a>
          </>
        ) : null}
      </section>
      <section aria-labelledby="dashboard-subjects-heading">
        <h2 className="mb-4 text-2xl font-semibold" id="dashboard-subjects-heading">
          Your next step in each subject
        </h2>
        <p className="mb-4 text-sm leading-7 text-[#91a4bb]">
          A 12-question diagnostic can suggest a foundation starting point. Full eight-question lesson
          practice confirms independent readiness.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {learningRoadmaps.map((roadmap) => {
            const resource = resources[roadmap.slug]!;
            const readiness = !resource.error ? (resource.data as ExamReadiness | null) : null;
            const next = readiness?.lessons.find((lesson) => lesson.status !== "ready");
            const due = review?.subjects.find((subject) => subject.slug === roadmap.slug);
            const evidence = performance?.concepts.filter((concept) => concept.roadmap_slug === roadmap.slug);
            const independent = evidence
              ? evidence.reduce(
                  (total, concept) => ({
                    correct: total.correct + concept.independent.correct,
                    answers: total.answers + concept.independent.answers,
                  }),
                  { correct: 0, answers: 0 },
                )
              : null;
            return (
              <article
                className="panel min-w-0 p-5"
                key={roadmap.slug}
                aria-label={`${roadmap.title} learning plan`}
              >
                <h3 className="text-xl font-semibold" style={{ color: roadmap.accent }}>
                  {roadmap.title}
                </h3>
                <p className="mt-3 text-sm text-[#9baec6]">
                  {due
                    ? `${due.due} due now · ${due.scheduled} scheduled later`
                    : reviewResource.loading
                      ? "Loading review counts…"
                      : "Review counts unavailable"}
                </p>
                <ResourceStatus
                  resource={resource}
                  label={`${roadmap.title} readiness`}
                  retry={() => retry(roadmap.slug)}
                />
                {readiness ? (
                  <>
                    <p className="mt-3 text-sm text-[#b5c7dc]">
                      {readiness.ready_lessons}/{readiness.required_lessons} foundation lessons ready
                      independently
                    </p>
                    {next ? (
                      <>
                        <p className="mt-3 font-semibold">Next lesson: {next.title}</p>
                        <p className="mt-2 text-sm leading-7 text-[#91a4bb]">{next.reason}</p>
                        <Link className="btn mt-4 inline-block" href={next.study_url}>
                          Continue {next.title}
                        </Link>
                      </>
                    ) : readiness.eligible ? (
                      <>
                        <p className="mt-3 text-sm leading-7 text-[#a6b6cb]">
                          All six foundation lessons meet the independent practice threshold.
                        </p>
                        <Link className="btn mt-4 inline-block" href={`/roadmaps/${roadmap.slug}/exam`}>
                          Open stage 1 exam readiness
                        </Link>
                      </>
                    ) : (
                      <Link
                        className="mt-4 inline-block text-sm text-[#8dc8ff]"
                        href={`/roadmaps/${roadmap.slug}/exam`}
                      >
                        Check exam readiness
                      </Link>
                    )}
                  </>
                ) : null}
                <p className="mt-4 text-xs leading-6 text-[#91a4bb]">
                  {independent
                    ? independent.answers > 0
                      ? `${independent.correct}/${independent.answers} correct without hints in the last 14 UTC days`
                      : "No independent answers in the last 14 UTC days"
                    : performanceResource.loading
                      ? "Loading independent evidence…"
                      : "Recent independent evidence unavailable"}
                </p>
                <Link
                  className="mt-3 block text-sm font-semibold text-[#c4a5ff]"
                  href={`/roadmaps/${roadmap.slug}/diagnostic`}
                >
                  Try a 12-question diagnostic
                </Link>
                <Link className="mt-3 inline-block text-sm text-[#8dc8ff]" href={`/roadmaps/${roadmap.slug}`}>
                  Open full curriculum →
                </Link>
              </article>
            );
          })}
        </div>
      </section>
      {performance ? (
        <section className="panel p-5 sm:p-7" aria-labelledby="dashboard-concepts-heading">
          <h2 className="text-xl font-semibold" id="dashboard-concepts-heading">
            Concepts to strengthen
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#91a4bb]">
            Below 75% independent accuracy during the last 14 UTC days, with at least one answer completed
            without hints. More attempts give stronger evidence.
          </p>
          {weak.length ? (
            <ul className="mt-4 space-y-3">
              {weak.map((concept) => (
                <li key={`${concept.roadmap_slug}:${concept.topic_slug}:${concept.concept}`}>
                  <Link
                    className="text-sm font-semibold text-[#8dc8ff]"
                    href={`/roadmaps/${concept.roadmap_slug}/${concept.topic_slug}`}
                  >
                    {concept.concept}
                  </Link>
                  <span className="ml-2 text-sm text-[#a6b6cb]">
                    {concept.independent.accuracy}% independent · {concept.independent.correct}/
                    {concept.independent.answers} correct
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[#a6b6cb]">
              {performance.totals.independent.answers > 0
                ? "No recently assessed concepts are below this independent accuracy threshold."
                : "Independent practice is needed before concepts can be assessed this way."}
            </p>
          )}
          {evidenceNeeded.length ? (
            <div className="mt-5 border-t border-[#263449] pt-4">
              <h3 className="font-semibold">Independent evidence needed</h3>
              <p className="mt-2 text-sm leading-7 text-[#91a4bb]">
                These concepts have hint-assisted or untracked answers, with no independent answers in this
                window.
              </p>
              <ul className="mt-3 space-y-2">
                {evidenceNeeded.map((concept) => (
                  <li key={`${concept.roadmap_slug}:${concept.topic_slug}:${concept.concept}`}>
                    <Link
                      className="text-sm text-[#8dc8ff]"
                      href={`/roadmaps/${concept.roadmap_slug}/${concept.topic_slug}`}
                    >
                      {concept.concept}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
      <aside className="rounded-xl border border-[#263449] p-5 text-sm leading-7 text-[#9baec6]">
        {learningRoadmaps.length * 6} authored foundation lessons are available now. The remaining{" "}
        {roadmapCounts.topics - learningRoadmaps.length * 6} advanced topics are curriculum outlines, with no
        authored lesson or practice set yet. Completing the foundations leads to the stage exam.
      </aside>
      <AssessmentHistory compact />
    </div>
  );
}
