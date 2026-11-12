"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MistakeQueue } from "@/lib/curriculum";
import { roadmapMap } from "@/lib/roadmaps";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { MathText } from "@/components/roadmaps/math-text";

export function MistakeReview() {
  const [queue, setQueue] = useState<MistakeQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api
      .roadmapMistakes()
      .then((response) => {
        if (active) {
          setQueue(response);
          setError(null);
        }
      })
      .catch((problem: unknown) => {
        if (active) setError(problem instanceof Error ? problem.message : "Unable to load review history.");
      });
    return () => {
      active = false;
    };
  }, [revision]);
  if (error)
    return (
      <section className="panel p-6" role="alert">
        <p>{error}</p>
        <button className="btn mt-4" type="button" onClick={() => setRevision((current) => current + 1)}>
          Reload review history
        </button>
      </section>
    );
  if (!queue)
    return (
      <p className="panel p-6" role="status">
        Loading your question history…
      </p>
    );
  const subjects = [...new Set(queue.items.map((item) => item.roadmap_slug))];
  return (
    <div className="space-y-6">
      <section className="panel flex flex-wrap items-center justify-between gap-4 p-6">
        <p>
          {queue.items.length} questions to revisit · {queue.total_attempts} recorded answers
        </p>
        <button className="btn" type="button" onClick={() => setRevision((current) => current + 1)}>
          Refresh history
        </button>
      </section>
      {subjects.length ? (
        <div className="flex flex-wrap gap-3">
          {subjects.map((slug) => (
            <button
              className="btn"
              key={slug}
              type="button"
              aria-pressed={subject === slug}
              onClick={() => setSubject(slug)}
            >
              Practice {roadmapMap[slug]?.title}
            </button>
          ))}
        </div>
      ) : (
        <section className="panel p-8">
          <h2 className="text-xl font-semibold">No questions need review yet</h2>
          <p className="mt-3 leading-8 text-[#9bafc8]">
            Complete a lesson practice set. Mistakes return here immediately; successful answers return when
            recall practice is due.
          </p>
          <Link className="btn mt-5 inline-block" href="/roadmaps">
            Choose a lesson
          </Link>
        </section>
      )}
      {subject ? <AssessmentPanel key={subject} roadmapSlug={subject} mode="review" /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {queue.items.map((item) => (
          <article className="panel p-5" key={item.question_id}>
            <p className="metric text-[#facc15]">
              {item.reason} · {roadmapMap[item.roadmap_slug]?.title}
            </p>
            <h2 className="mt-3 text-lg font-semibold">{item.concept}</h2>
            <p className="mt-3 leading-8 text-[#b1c1d7]">
              <MathText>{item.prompt}</MathText>
            </p>
            <p className="mt-3 text-xs text-[#91a4bb]">
              {item.attempts} attempts · Last answered {new Date(item.last_attempt_at).toLocaleDateString()}
            </p>
            <Link
              className="mt-4 inline-block text-sm text-[#8dc8ff]"
              href={`/roadmaps/${item.roadmap_slug}/${item.topic_slug}`}
            >
              Revisit {item.lesson_title} →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
