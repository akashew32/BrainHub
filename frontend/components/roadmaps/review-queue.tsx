"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, RotateCcw, Sparkles } from "lucide-react";
import { useRoadmapProgress } from "@/components/roadmaps/roadmap-progress-provider";
import type { RoadmapLesson } from "@/lib/roadmap-lessons";
import {
  isCompleted,
  isStageUnlocked,
  progressKey,
  reviewPriority,
  type RoadmapProgressItem,
} from "@/lib/roadmap-progress";
import { learningRoadmaps, roadmapMap } from "@/lib/roadmaps";
import { slugifyTopic } from "@/lib/roadmap-utils";

export type ReviewLesson = Pick<
  RoadmapLesson,
  | "id"
  | "roadmapSlug"
  | "roadmapTitle"
  | "topicSlug"
  | "title"
  | "stageIndex"
  | "topicIndex"
  | "accent"
  | "estimatedMinutes"
>;

type Recommendation = {
  lesson: ReviewLesson;
  item: RoadmapProgressItem | undefined;
  priority: number;
  reason: string;
};

export function ReviewQueue({ lessons }: { lessons: ReviewLesson[] }) {
  const { progress, ready } = useRoadmapProgress();
  const [referenceTime] = useState(Date.now);

  if (!ready) {
    return (
      <div className="panel grid min-h-64 place-items-center text-sm text-[#8190a4]">
        Building your review queue…
      </div>
    );
  }

  const recommendations = new Map<string, Recommendation>();
  for (const lesson of lessons) {
    const roadmap = roadmapMap[lesson.roadmapSlug]!;
    if (!isStageUnlocked(roadmap, lesson.stageIndex, progress)) continue;
    const item = progress.get(lesson.id);
    const priority = reviewPriority(lesson, item, referenceTime);
    if (!priority || (!item && lesson.topicIndex !== 0)) continue;
    const ageDays = item
      ? Math.floor((referenceTime - new Date(item.last_viewed_at).getTime()) / 86_400_000)
      : 0;
    const reason = !item
      ? "Ready to begin"
      : !isCompleted(item)
        ? "Continue an unfinished lesson"
        : item.quiz_score < 100
          ? `Strengthen a ${item.quiz_score}% mastery score`
          : `Refresh after ${ageDays} days`;
    recommendations.set(lesson.id, { lesson, item, priority, reason });
  }

  for (const roadmap of learningRoadmaps) {
    for (const [stageIndex, stage] of roadmap.stages.entries()) {
      if (!isStageUnlocked(roadmap, stageIndex, progress)) break;
      const topic = stage.topics.find(
        (candidate) => !progress.has(progressKey(roadmap.slug, slugifyTopic(candidate))),
      );
      if (!topic) continue;
      const lesson = lessons.find(
        (candidate) => candidate.roadmapSlug === roadmap.slug && candidate.topicSlug === slugifyTopic(topic),
      )!;
      recommendations.set(lesson.id, {
        lesson,
        item: undefined,
        priority: recommendations.get(lesson.id)?.priority ?? 20,
        reason: "Next lesson in your unlocked sequence",
      });
      break;
    }
  }

  const ordered = [...recommendations.values()]
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 18);
  const completed = [...progress.values()].filter(isCompleted).length;

  return (
    <div>
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <QueueMetric label="Lessons complete" value={completed} />
        <QueueMetric label="Queue size" value={ordered.length} />
        <QueueMetric
          label="Saved study time"
          value={`${Math.round([...progress.values()].reduce((sum, item) => sum + item.time_spent_seconds, 0) / 60)}m`}
        />
      </section>

      {ordered.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ordered.map(({ lesson, item, reason }) => (
            <article className="panel flex flex-col p-5" key={lesson.id}>
              <div className="flex items-start justify-between gap-3">
                <span className="metric" style={{ color: lesson.accent }}>
                  {lesson.roadmapTitle} · Stage {lesson.stageIndex + 1}
                </span>
                {isCompleted(item) ? (
                  <RotateCcw className="shrink-0 text-[#c084fc]" size={16} />
                ) : item ? (
                  <Clock3 className="shrink-0 text-[#facc15]" size={16} />
                ) : (
                  <Sparkles className="shrink-0 text-[#60a5fa]" size={16} />
                )}
              </div>
              <h2 className="mt-3 text-lg font-semibold">{lesson.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#8f9baa]">{reason}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#718096]">
                <span>{lesson.estimatedMinutes} min</span>
                <span>·</span>
                <span>{item?.quiz_attempts ? `Best ${item.quiz_score}%` : "No quiz yet"}</span>
              </div>
              <Link
                className="btn mt-5 flex items-center justify-between"
                href={`/roadmaps/${lesson.roadmapSlug}/${lesson.topicSlug}`}
              >
                {item ? "Review lesson" : "Start lesson"} <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel p-10 text-center">
          <CheckCircle2 className="mx-auto text-[#34d399]" size={34} />
          <h2 className="mt-4 text-2xl font-semibold">You are caught up</h2>
          <p className="mt-2 text-[#8995a7]">
            Completed lessons will return here when they are due for review.
          </p>
        </section>
      )}
    </div>
  );
}

function QueueMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-5">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="metric mt-1">{label}</p>
    </div>
  );
}
