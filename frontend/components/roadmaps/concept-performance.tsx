"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ConceptPerformance, PerformanceBucket } from "@/lib/curriculum";
import { roadmapMap } from "@/lib/roadmaps";

function accuracy(value: number | null) {
  return value === null ? "No answers" : `${value}%`;
}
function Bucket({ value }: { value: PerformanceBucket }) {
  return (
    <span>
      {value.correct}/{value.answers} correct · {accuracy(value.accuracy)}
    </span>
  );
}

export function ConceptPerformancePanel({ roadmapSlug }: { roadmapSlug?: string }) {
  return <PerformanceWorkspace key={roadmapSlug ?? "all"} roadmapSlug={roadmapSlug} />;
}

function PerformanceWorkspace({ roadmapSlug }: { roadmapSlug?: string }) {
  const [data, setData] = useState<ConceptPerformance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api
      .conceptPerformance(roadmapSlug)
      .then((response) => {
        if (active) {
          setData(response);
          setError(null);
        }
      })
      .catch((problem: unknown) => {
        if (active)
          setError(problem instanceof Error ? problem.message : "Unable to load concept performance.");
      });
    return () => {
      active = false;
    };
  }, [roadmapSlug, revision]);

  return (
    <section className="panel min-w-0 p-5 sm:p-7" aria-labelledby="concept-performance-heading">
      <h2 className="text-2xl font-semibold" id="concept-performance-heading">
        Concept performance
      </h2>
      <p className="mt-3 text-sm leading-7 text-[#9baec6]">
        The last 14 UTC calendar days
        {roadmapSlug ? ` in ${roadmapMap[roadmapSlug]?.title ?? roadmapSlug}` : " across all subjects"}.
        Independent, hint-assisted, and untracked answers have separate denominators, including incorrect
        answers. Historical and archived questions remain part of your record.
      </p>
      {error ? (
        <div className="mt-4" role="alert">
          <p>{error}</p>
          <button className="btn mt-3" type="button" onClick={() => setRevision((value) => value + 1)}>
            Retry concept performance
          </button>
        </div>
      ) : null}
      {!data && !error ? (
        <p className="mt-4 text-sm text-[#91a4bb]" role="status">
          Loading concept performance…
        </p>
      ) : null}
      {data ? (
        <>
          <dl className="my-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Answers", data.totals.answers],
              ["Questions seen", data.totals.questions_seen],
              ["Correct", data.totals.correct],
              ["Accuracy", accuracy(data.totals.accuracy)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="metric text-[#93a5bc]">{label}</dt>
                <dd className="mt-2 text-xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <div
            className="overflow-x-auto rounded-xl border border-[#263449]"
            role="region"
            aria-label="Concept performance table"
            tabIndex={0}
          >
            <table className="w-full min-w-[780px] text-left text-sm">
              <caption className="p-4 text-left text-xs leading-6 text-[#91a4bb]">
                Concepts by subject and lesson. Each bucket shows correct / answered and accuracy. No answers
                means accuracy is unknown.
              </caption>
              <thead>
                <tr>
                  {[
                    "Subject",
                    "Lesson",
                    "Concept",
                    "All answers",
                    "Independent",
                    "With hints",
                    "Untracked",
                  ].map((label) => (
                    <th className="px-4 py-3" scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.concepts.map((concept) => (
                  <tr
                    className="border-t border-[#263449]"
                    key={`${concept.roadmap_slug}:${concept.topic_slug}:${concept.concept}`}
                  >
                    <td className="px-4 py-3">
                      {roadmapMap[concept.roadmap_slug]?.title ?? concept.roadmap_slug}
                    </td>
                    <td className="px-4 py-3">{concept.topic_slug.replaceAll("-", " ")}</td>
                    <th className="px-4 py-3 font-medium" scope="row">
                      {concept.concept}
                    </th>
                    <td className="px-4 py-3">
                      <Bucket value={concept} />
                    </td>
                    <td className="px-4 py-3">
                      <Bucket value={concept.independent} />
                    </td>
                    <td className="px-4 py-3">
                      <Bucket value={concept.assisted} />
                    </td>
                    <td className="px-4 py-3">
                      <Bucket value={concept.untracked} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.concepts.length ? (
              <p className="p-4 text-sm text-[#91a4bb]">No graded answers in this time window.</p>
            ) : null}
          </div>
          <div
            className="mt-6 overflow-x-auto rounded-xl border border-[#263449]"
            role="region"
            aria-label="UTC daily performance trend"
            tabIndex={0}
          >
            <table className="w-full min-w-[780px] text-left text-sm">
              <caption className="p-4 text-left font-semibold">14-day answer trend (UTC)</caption>
              <thead>
                <tr>
                  {[
                    "UTC date",
                    "Answers",
                    "Correct",
                    "Accuracy",
                    "Independent",
                    "With hints",
                    "Untracked",
                  ].map((label) => (
                    <th className="px-4 py-3" scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.trend.map((day) => (
                  <tr className="border-t border-[#263449]" key={day.date}>
                    <th className="whitespace-nowrap px-4 py-3 font-medium" scope="row">
                      {day.date}
                    </th>
                    <td className="px-4 py-3">{day.answers}</td>
                    <td className="px-4 py-3">{day.correct}</td>
                    <td className="px-4 py-3">{accuracy(day.accuracy)}</td>
                    <td className="px-4 py-3">
                      <Bucket value={day.independent} />
                    </td>
                    <td className="px-4 py-3">
                      <Bucket value={day.assisted} />
                    </td>
                    <td className="px-4 py-3">
                      <Bucket value={day.untracked} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
