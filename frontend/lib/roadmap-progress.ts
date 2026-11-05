import type { RoadmapLesson } from "@/lib/roadmap-lessons";
import type { LearningRoadmap } from "@/lib/roadmaps";
import { slugifyTopic } from "@/lib/roadmap-utils";

export type RoadmapProgressStatus = "in_progress" | "completed" | "review";

export type RoadmapProgressItem = {
  roadmap_slug: string;
  topic_slug: string;
  status: RoadmapProgressStatus;
  quiz_score: number;
  quiz_attempts: number;
  time_spent_seconds: number;
  last_viewed_at: string;
  completed_at: string | null;
};

export type RoadmapProgressSummary = {
  total: number;
  started: number;
  completed: number;
  average_quiz_score: number;
  time_spent_seconds: number;
  roadmaps: Array<{
    slug: string;
    total: number;
    started: number;
    completed: number;
    percent: number;
  }>;
};

export type RoadmapProgressResponse = {
  items: RoadmapProgressItem[];
  summary: RoadmapProgressSummary;
};

export type RoadmapProgressUpdate = {
  status: RoadmapProgressStatus;
  quiz_score?: number;
  time_spent_seconds?: number;
};

export function progressKey(roadmapSlug: string, topicSlug: string) {
  return `${roadmapSlug}:${topicSlug}`;
}

export function isCompleted(item: RoadmapProgressItem | undefined) {
  return item?.status === "completed" || item?.status === "review";
}

export function isStageUnlocked(
  roadmap: LearningRoadmap,
  stageIndex: number,
  progress: ReadonlyMap<string, RoadmapProgressItem>,
) {
  if (stageIndex === 0) return true;
  return roadmap.stages[stageIndex - 1]!.topics.every((topic) =>
    isCompleted(progress.get(progressKey(roadmap.slug, slugifyTopic(topic)))),
  );
}

export function roadmapCompletion(
  roadmap: LearningRoadmap,
  progress: ReadonlyMap<string, RoadmapProgressItem>,
) {
  const completed = roadmap.stages.reduce(
    (total, stage) =>
      total +
      stage.topics.filter((topic) =>
        isCompleted(progress.get(progressKey(roadmap.slug, slugifyTopic(topic)))),
      ).length,
    0,
  );
  const total = roadmap.stages.reduce((sum, stage) => sum + stage.topics.length, 0);
  return { completed, total, percent: Math.round((completed / total) * 100) };
}

export function reviewPriority(
  lesson: Pick<RoadmapLesson, "stageIndex" | "topicIndex">,
  item: RoadmapProgressItem | undefined,
  referenceTime: number,
) {
  if (!item) return lesson.stageIndex === 0 && lesson.topicIndex === 0 ? 30 : 0;
  const ageDays = Math.max(0, (referenceTime - new Date(item.last_viewed_at).getTime()) / 86_400_000);
  if (!isCompleted(item)) return 100 + (100 - item.quiz_score) + ageDays;
  if (item.quiz_score < 100) return 60 + (100 - item.quiz_score) + ageDays;
  if (ageDays >= 14) return ageDays;
  return 0;
}
