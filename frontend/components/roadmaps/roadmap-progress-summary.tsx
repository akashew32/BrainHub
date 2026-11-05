"use client";

import Link from "next/link";
import { ArrowRight, Cloud, CloudOff } from "lucide-react";
import { useRoadmapProgress } from "@/components/roadmaps/roadmap-progress-provider";
import { isCompleted, isStageUnlocked, progressKey, roadmapCompletion } from "@/lib/roadmap-progress";
import type { LearningRoadmap } from "@/lib/roadmaps";
import { slugifyTopic } from "@/lib/roadmap-utils";

export function RoadmapProgressSummary({ roadmap }: { roadmap: LearningRoadmap }) {
  const { progress, syncState } = useRoadmapProgress();
  const completion = roadmapCompletion(roadmap, progress);
  let nextTopic: string | null = null;
  for (const [stageIndex, stage] of roadmap.stages.entries()) {
    if (!isStageUnlocked(roadmap, stageIndex, progress)) break;
    nextTopic =
      stage.topics.find(
        (topic) => !isCompleted(progress.get(progressKey(roadmap.slug, slugifyTopic(topic)))),
      ) ?? null;
    if (nextTopic) break;
  }

  return (
    <section className="panel mt-5 flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
      <div className="min-w-[240px] flex-1">
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="font-semibold">Your {roadmap.title} progress</p>
          <span className="flex items-center gap-1.5 text-xs text-[#748196]">
            {syncState === "offline" ? <CloudOff size={13} /> : <Cloud size={13} />}
            {syncState === "offline" ? "Saved offline" : "Synced"}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#1d2735]">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ backgroundColor: roadmap.accent, width: `${completion.percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[#748196]">
          {completion.completed} of {completion.total} lessons · {completion.percent}% complete
        </p>
      </div>
      {nextTopic ? (
        <Link
          className="btn flex items-center gap-2"
          href={`/roadmaps/${roadmap.slug}/${slugifyTopic(nextTopic)}`}
        >
          {completion.completed ? "Continue" : "Start first lesson"} <ArrowRight size={15} />
        </Link>
      ) : (
        <span className="rounded-lg border border-[#285443] bg-[#10241d] px-4 py-2 text-sm text-[#63e6be]">
          Roadmap complete
        </span>
      )}
    </section>
  );
}
