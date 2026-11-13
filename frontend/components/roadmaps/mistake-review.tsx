"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ReviewItem, ReviewPlan } from "@/lib/curriculum";
import { roadmapMap } from "@/lib/roadmaps";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { MathText } from "@/components/roadmaps/math-text";

function utcDate(value: string) {
  // Historical API timestamps can be naive UTC; never interpret them as local time.
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + "Z";
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) return "Date unavailable (UTC)";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

const statusLabels: Record<ReviewItem["status"], string> = {
  mistake: "Previous answer incorrect",
  assisted: "Previously answered with hints",
  untracked: "Previous hint usage untracked",
  recall: "Scheduled independent recall",
};

function ReviewCard({ item, upcoming = false }: { item: ReviewItem; upcoming?: boolean }) {
  return (
    <article className="panel min-w-0 p-5">
      <p className="metric text-[#facc15]">
        {statusLabels[item.status]} · {roadmapMap[item.roadmap_slug]?.title ?? item.roadmap_slug}
      </p>
      <h3 className="mt-3 text-lg font-semibold">{item.concept}</h3>
      <p className="mt-3 leading-8 text-[#b1c1d7]">
        <MathText>{item.prompt}</MathText>
      </p>
      <p className="mt-3 text-sm leading-7 text-[#a3b4ca]">{item.reason}</p>
      <dl className="mt-4 space-y-2 text-xs leading-6 text-[#91a4bb]">
        <div>
          <dt className="inline">{upcoming ? "Next review" : "Due since"}: </dt>
          <dd className="inline">{utcDate(item.due_at)}</dd>
        </div>
        <div>
          <dt className="inline">Last answered: </dt>
          <dd className="inline">{utcDate(item.last_attempt_at)}</dd>
        </div>
        <div>
          <dt className="inline">Independent recall streak: </dt>
          <dd className="inline">{item.independent_streak}</dd>
        </div>
        <div>
          <dt className="inline">Current interval: </dt>
          <dd className="inline">
            {item.interval_days > 0
              ? item.interval_days + (item.interval_days === 1 ? " day" : " days")
              : "Review now"}
            {" · "}
            {item.attempts} recorded {item.attempts === 1 ? "answer" : "answers"}
          </dd>
        </div>
      </dl>
      <Link
        className="mt-4 inline-block text-sm text-[#8dc8ff]"
        href={`/roadmaps/${item.roadmap_slug}/${item.topic_slug}`}
      >
        Revisit {item.lesson_title} →
      </Link>
    </article>
  );
}

export function MistakeReview() {
  const [plan, setPlan] = useState<ReviewPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => {
    setLoading(true);
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    api
      .roadmapReviewPlan()
      .then((response) => {
        if (active) {
          setPlan(response);
          setError(null);
        }
      })
      .catch((problem: unknown) => {
        if (active) setError(problem instanceof Error ? problem.message : "Unable to load your review plan.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  useEffect(() => {
    const refreshVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    const timer = window.setInterval(refreshVisible, 60_000);
    return () => {
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

  if (!plan)
    return error ? (
      <section className="panel p-6" role="alert">
        <p>{error}</p>
        <button className="btn mt-4" type="button" onClick={refresh} disabled={loading}>
          {loading ? "Retrying…" : "Retry review plan"}
        </button>
      </section>
    ) : (
      <p className="panel p-6" role="status">
        Loading your daily review plan…
      </p>
    );

  const visibleItems = plan.items.filter((item) => filter === "all" || item.roadmap_slug === filter);
  const visibleUpcoming = plan.upcoming.filter((item) => filter === "all" || item.roadmap_slug === filter);
  const selectedSubject = plan.subjects.find((subject) => subject.slug === activeSubject);
  return (
    <div className="space-y-6">
      <section className="panel p-6" aria-labelledby="daily-review-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold" id="daily-review-heading">
              Your daily review plan
            </h2>
            <p className="mt-2 text-xs leading-6 text-[#91a4bb]">
              Updated {utcDate(plan.generated_at)}. Daily counts use UTC.
            </p>
          </div>
          <button className="btn" type="button" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh review plan"}
          </button>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3">
          {[
            ["Due now", plan.summary.due],
            ["Scheduled later", plan.summary.scheduled],
            ["Questions seen", plan.summary.tracked],
            ["Not yet attempted", plan.summary.unseen],
            ["Review questions today (UTC)", plan.summary.reviewed_today],
            ["Independent recalls today (UTC)", plan.summary.independent_today],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="metric text-[#93a5bc]">{label}</dt>
              <dd className="mt-2 text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-sm leading-7 text-[#9baec6]">
          Each review set contains up to {plan.policy.session_limit} due questions from one subject, starting
          with the highest-priority questions. You can complete more sets when questions remain due. Correct
          answers without hints extend recall intervals through {plan.policy.interval_days.join(", ")} days.
          Practising early does not change your next review date.
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-[#91a4bb]" role="status">
            Updating your schedule…
          </p>
        ) : null}
      </section>
      {error ? (
        <div className="panel p-5" role="alert">
          <p>{error} Your last loaded plan and current assessment remain available.</p>
          <button className="btn mt-3" type="button" onClick={refresh} disabled={loading}>
            Retry review plan
          </button>
        </div>
      ) : null}
      <section aria-labelledby="review-subjects-heading">
        <h2 className="mb-4 text-xl font-semibold" id="review-subjects-heading">
          Review by subject
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plan.subjects.map((subject) => {
            const title = roadmapMap[subject.slug]?.title ?? subject.slug;
            return (
              <article className="panel p-5" key={subject.slug}>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-[#a6b6cb]">
                  {subject.due} due now · {subject.scheduled} scheduled later
                </p>
                <p className="mt-2 text-xs leading-6 text-[#91a4bb]">
                  {subject.tracked} questions seen · {subject.unseen} not yet attempted
                  {subject.next_due_at ? " · Next: " + utcDate(subject.next_due_at) : ""}
                </p>
                <button
                  className="btn mt-4"
                  type="button"
                  aria-pressed={activeSubject === subject.slug}
                  onClick={() => setActiveSubject(subject.slug)}
                >
                  Open {title} review
                </button>
              </article>
            );
          })}
        </div>
      </section>
      {activeSubject ? (
        <div className="space-y-3">
          <p className="text-sm text-[#a6b6cb]">Current review: {roadmapMap[activeSubject]?.title}</p>
          <AssessmentPanel
            key={activeSubject}
            roadmapSlug={activeSubject}
            mode="review"
            reviewAvailable={(selectedSubject?.due ?? 0) > 0}
            onCompleted={refresh}
          />
        </div>
      ) : null}
      {plan.summary.due === 0 ? (
        <section className="panel p-8">
          <h2 className="text-xl font-semibold">
            {plan.summary.tracked === 0 ? "Build your first review schedule" : "Nothing is due right now"}
          </h2>
          <p className="mt-3 leading-8 text-[#9bafc8]">
            {plan.summary.tracked === 0
              ? "Complete a lesson practice set to begin. Incorrect answers and answers with hints return for review; independent correct answers receive a future recall date."
              : "Your remaining recall practice is scheduled for later. A correct independent answer on a due question lengthens its interval; an incorrect or hint-assisted answer stays due."}
          </p>
          {plan.summary.next_due_at ? (
            <p className="mt-3 text-sm text-[#a6b6cb]">
              Next scheduled review: {utcDate(plan.summary.next_due_at)}
            </p>
          ) : null}
          <Link className="btn mt-5 inline-block" href="/roadmaps">
            Choose a lesson
          </Link>
        </section>
      ) : null}
      <section aria-labelledby="due-questions-heading">
        <h2 className="text-xl font-semibold" id="due-questions-heading">
          Due questions
        </h2>
        <div
          className="my-4 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter review questions by subject"
        >
          {[
            { slug: "all", title: "All subjects" },
            ...plan.subjects.map((subject) => ({
              slug: subject.slug,
              title: roadmapMap[subject.slug]?.title ?? subject.slug,
            })),
          ].map(({ slug, title }) => (
            <button
              className="btn"
              key={slug}
              type="button"
              aria-pressed={filter === slug}
              onClick={() => setFilter(slug)}
            >
              {title}
            </button>
          ))}
        </div>
        <p className="mb-4 text-sm text-[#91a4bb]" aria-live="polite">
          {visibleItems.length} due {visibleItems.length === 1 ? "question" : "questions"} in this view.
          Filters do not change an active review set.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {visibleItems.map((item) => (
            <ReviewCard key={item.roadmap_slug + ":" + item.question_id} item={item} />
          ))}
        </div>
      </section>
      <section aria-labelledby="upcoming-review-heading">
        <h2 className="text-xl font-semibold" id="upcoming-review-heading">
          Upcoming recall
        </h2>
        <p className="my-4 text-sm leading-7 text-[#91a4bb]">
          The next {plan.upcoming.length} scheduled questions across all subjects, shown through your subject
          filter. All dates are UTC. These questions are not included in a due review set yet.
        </p>
        {visibleUpcoming.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleUpcoming.map((item) => (
              <ReviewCard key={item.roadmap_slug + ":" + item.question_id} item={item} upcoming />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#91a4bb]">No upcoming questions in this view.</p>
        )}
      </section>
    </div>
  );
}
