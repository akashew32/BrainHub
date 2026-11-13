"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, RotateCcw } from "lucide-react";
import { useRoadmapProgress } from "@/components/roadmaps/roadmap-progress-provider";
import { isCompleted, isStageUnlocked, progressKey, roadmapCompletion } from "@/lib/roadmap-progress";
import type { LearningRoadmap } from "@/lib/roadmaps";
import { slugifyTopic } from "@/lib/roadmap-utils";

function resumeHref(roadmap: LearningRoadmap, progress: ReturnType<typeof useRoadmapProgress>["progress"]) {
  for (const [stageIndex, stage] of roadmap.stages.entries()) {
    if (!isStageUnlocked(roadmap, stageIndex, progress)) break;
    const topic = stage.topics.find(
      (candidate) => !isCompleted(progress.get(progressKey(roadmap.slug, slugifyTopic(candidate)))),
    );
    if (topic) return `/roadmaps/${roadmap.slug}/${slugifyTopic(topic)}`;
  }
  return `/roadmaps/${roadmap.slug}`;
}

export function RoadmapCatalog({ roadmaps }: { roadmaps: LearningRoadmap[] }) {
  const { progress, ready, syncState } = useRoadmapProgress();

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#263246] bg-[#0b1119] px-4 py-3 text-sm">
        <p className="text-[#94a3b8]">
          {ready ? "Progress loaded" : "Loading saved progress…"} ·{" "}
          {syncState === "offline" ? "offline cache active" : "synced to your BrainHub profile"}
        </p>
        <div className="flex flex-wrap gap-5">
          <Link className="font-semibold text-[#c084fc] hover:text-white" href="/roadmaps/notebook">
            Open mathematics notebook
          </Link>
          <Link
            className="flex items-center gap-2 font-semibold text-[#c084fc] hover:text-white"
            href="/roadmaps/review"
          >
            <RotateCcw size={15} /> Open review queue
          </Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roadmaps.map((roadmap, index) => {
          const completion = roadmapCompletion(roadmap, progress);
          const href = resumeHref(roadmap, progress);
          return (
            <article
              className="panel group relative overflow-hidden p-6 transition hover:-translate-y-1 hover:border-[#40516a]"
              key={roadmap.slug}
              style={{ contentVisibility: "auto", containIntrinsicSize: "430px" }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px opacity-80"
                style={{ backgroundColor: roadmap.accent }}
              />
              <div className="flex items-start justify-between gap-4">
                <div
                  className="inline-flex rounded-xl border bg-[#111a27] p-3"
                  style={{ borderColor: `${roadmap.accent}55`, color: roadmap.accent }}
                >
                  <BookOpenCheck size={20} />
                </div>
                <span className="font-mono text-xs text-[#465267]">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <p className="metric mt-8" style={{ color: roadmap.accent }}>
                {roadmap.eyebrow}
              </p>
              <h3 className="mt-2 text-2xl font-semibold">{roadmap.title}</h3>
              <p className="mt-3 min-h-24 text-sm leading-6 text-[#8995a7]">{roadmap.description}</p>
              <div className="mt-6 grid grid-cols-2 gap-3 border-y border-[#202937] py-4">
                <div>
                  <p className="text-lg font-semibold">{roadmap.stages.length}</p>
                  <p className="metric">Stages</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    {completion.completed}/{completion.total}
                  </p>
                  <p className="metric">Lessons complete</p>
                </div>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs text-[#8090a5]">
                  <span>Track progress</span>
                  <span>{completion.percent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#1d2735]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ backgroundColor: roadmap.accent, width: `${completion.percent}%` }}
                  />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                <Link className="text-[#94a3b8] hover:text-white" href={`/roadmaps/${roadmap.slug}`}>
                  View curriculum
                </Link>
                <Link
                  className="flex items-center gap-1 font-semibold hover:text-white"
                  href={href}
                  style={{ color: roadmap.accent }}
                >
                  {completion.completed ? "Continue" : "Start"} <ArrowUpRight size={15} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
