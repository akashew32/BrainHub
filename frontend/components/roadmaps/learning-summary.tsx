"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LearningStats } from "@/lib/curriculum";

export function LearningSummary() {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .learningStats()
      .then((response) => {
        if (active) setStats(response);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="panel mt-6 p-6" aria-labelledby="mathematical-practice">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold" id="mathematical-practice">
          Mathematical practice
        </h2>
        <Link className="text-sm text-[#a78bfa]" href="/roadmaps/review">
          Review mistakes →
        </Link>
      </div>
      {failed ? (
        <p className="mt-4 text-sm text-[#e6b191]">Question history is unavailable. Reload to try again.</p>
      ) : !stats ? (
        <p className="mt-4 text-sm text-[#90a2ba]" role="status">
          Loading question history…
        </p>
      ) : (
        <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {[
            ["Answers recorded", stats.answers],
            ["Accuracy", `${stats.accuracy}%`],
            ["Concepts to review", stats.concepts_to_review],
            ["Stage exams passed", stats.exams.filter((exam) => exam.passed).length],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="metric text-[#93a5bc]">{label}</dt>
              <dd className="mt-2 text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
