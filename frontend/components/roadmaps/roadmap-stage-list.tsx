"use client";

import Link from "next/link";
import { Check, CircleDot, Flag, LockKeyhole, PlayCircle } from "lucide-react";
import { useRoadmapProgress } from "@/components/roadmaps/roadmap-progress-provider";
import { isCompleted, isStageUnlocked, progressKey } from "@/lib/roadmap-progress";
import type { LearningRoadmap } from "@/lib/roadmaps";
import { slugifyTopic } from "@/lib/roadmap-utils";

export function RoadmapStageList({ roadmap }: { roadmap: LearningRoadmap }) {
  const { progress } = useRoadmapProgress();

  return (
    <ol className="space-y-5">
      {roadmap.stages.map((stage, stageIndex) => {
        const unlocked = isStageUnlocked(roadmap, stageIndex, progress);
        const completeCount = stage.topics.filter((topic) =>
          isCompleted(progress.get(progressKey(roadmap.slug, slugifyTopic(topic)))),
        ).length;
        const percent = Math.round((completeCount / stage.topics.length) * 100);
        return (
          <li className="panel scroll-mt-24 overflow-hidden" id={`stage-${stageIndex + 1}`} key={stage.title}>
            <div className="grid md:grid-cols-[92px_minmax(0,1fr)]">
              <div className="border-b border-[#202937] p-5 md:border-r md:border-b-0">
                <p className="font-mono text-2xl font-semibold" style={{ color: roadmap.accent }}>
                  {String(stageIndex + 1).padStart(2, "0")}
                </p>
                <p className="metric mt-2">Stage</p>
              </div>
              <article className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="metric" style={{ color: roadmap.accent }}>
                      {stage.level}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold sm:text-2xl">{stage.title}</h3>
                  </div>
                  <span className="rounded-full border border-[#2e3a4d] bg-[#111823] px-3 py-1 text-xs text-[#91a0b3]">
                    {stageIndex === 0
                      ? `${completeCount}/${stage.topics.length} complete · Authored`
                      : "Curriculum outline"}
                  </span>
                </div>
                <p className="mt-3 leading-7 text-[#9ca8b8]">{stage.description}</p>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#1d2735]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ backgroundColor: roadmap.accent, width: `${percent}%` }}
                  />
                </div>

                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {stage.topics.map((topic) => {
                    const topicSlug = slugifyTopic(topic);
                    const item = progress.get(progressKey(roadmap.slug, topicSlug));
                    const complete = isCompleted(item);
                    const content = (
                      <>
                        {complete ? (
                          <Check className="mt-0.5 shrink-0" size={15} style={{ color: roadmap.accent }} />
                        ) : unlocked ? (
                          item ? (
                            <PlayCircle className="mt-0.5 shrink-0 text-[#facc15]" size={15} />
                          ) : (
                            <CircleDot
                              className="mt-0.5 shrink-0"
                              size={14}
                              style={{ color: roadmap.accent }}
                            />
                          )
                        ) : (
                          <LockKeyhole className="mt-0.5 shrink-0 text-[#526076]" size={14} />
                        )}
                        <span>
                          {topic}
                          {item?.quiz_attempts ? (
                            <span className="mt-0.5 block text-xs text-[#64748b]">
                              Best quiz: {item.quiz_score}%
                            </span>
                          ) : null}
                        </span>
                      </>
                    );
                    return (
                      <li key={topic}>
                        {unlocked ? (
                          <Link
                            className="flex min-h-14 gap-3 rounded-lg border border-[#202937] bg-[#090d13] px-3 py-2.5 text-sm text-[#bec7d2] transition hover:border-[#40516a] hover:bg-[#101722] hover:text-white"
                            href={`/roadmaps/${roadmap.slug}/${topicSlug}`}
                          >
                            {content}
                          </Link>
                        ) : (
                          <div
                            className="flex min-h-14 gap-3 rounded-lg border border-[#1b2330] bg-[#080b10] px-3 py-2.5 text-sm text-[#5f6b7c]"
                            title="Complete the previous stage to unlock"
                          >
                            {content}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {!unlocked ? (
                  <p className="mt-4 flex items-center gap-2 text-sm text-[#718096]">
                    <LockKeyhole size={14} /> Complete all six lessons in stage {stageIndex} to unlock this
                    stage.
                  </p>
                ) : null}

                <div className="mt-5 flex gap-3 rounded-xl border border-[#293548] bg-[#101722] p-4">
                  <Flag className="mt-0.5 shrink-0" size={17} style={{ color: roadmap.accent }} />
                  <div>
                    <p className="metric">Readiness checkpoint</p>
                    <p className="mt-1 text-sm leading-6 text-[#aeb8c6]">{stage.checkpoint}</p>
                  </div>
                </div>
                {stageIndex === 0 ? (
                  <Link className="btn mt-4 inline-block" href={`/roadmaps/${roadmap.slug}/exam`}>
                    Stage 1 exam · 12 questions
                  </Link>
                ) : null}
              </article>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
