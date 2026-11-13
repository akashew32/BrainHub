import { learningRoadmaps, type LearningRoadmap, type RoadmapStage } from "@/lib/roadmaps";
import { slugifyTopic } from "@/lib/roadmap-utils";

export type TopicAvailability = "authored" | "outline" | "unknown";
export type TopicFilters = {
  q: string;
  subject: string;
  stage: string;
  level: string;
  availability: "all" | TopicAvailability;
  saved: "all" | "bookmarked";
};
export type TopicSearchItem = {
  key: string;
  roadmapSlug: string;
  roadmapTitle: string;
  topicSlug: string;
  topicTitle: string;
  stageIndex: number;
  stageTitle: string;
  stageDescription: string;
  stageCheckpoint: string;
  level: RoadmapStage["level"];
  accent: string;
  href: string;
  searchText: string;
};
export const DEFAULT_TOPIC_FILTERS: TopicFilters = {
  q: "",
  subject: "all",
  stage: "all",
  level: "all",
  availability: "all",
  saved: "all",
};
const LEVELS = ["Foundation", "Core", "Advanced", "Graduate"] as const;
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();

export function buildRoadmapSearchIndex(
  roadmaps: readonly LearningRoadmap[] = learningRoadmaps,
): TopicSearchItem[] {
  return roadmaps.flatMap((roadmap) =>
    roadmap.stages.flatMap((stage, stageIndex) =>
      stage.topics.map((topicTitle) => {
        const topicSlug = slugifyTopic(topicTitle);
        return {
          key: `${roadmap.slug}:${topicSlug}`,
          roadmapSlug: roadmap.slug,
          roadmapTitle: roadmap.title,
          topicSlug,
          topicTitle,
          stageIndex,
          stageTitle: stage.title,
          stageDescription: stage.description,
          stageCheckpoint: stage.checkpoint,
          level: stage.level,
          accent: roadmap.accent,
          href: `/roadmaps/${roadmap.slug}/${topicSlug}`,
          searchText: normalize(
            [topicTitle, roadmap.title, stage.title, stage.description, stage.checkpoint, stage.level].join(
              " ",
            ),
          ),
        };
      }),
    ),
  );
}

type FilterSource = URLSearchParams | Record<string, string | string[] | undefined>;
export function parseTopicFilters(source: FilterSource): TopicFilters {
  const get = (key: string) => {
    const value = source instanceof URLSearchParams ? source.get(key) : source[key];
    return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
  };
  const subject = get("subject"),
    stage = get("stage"),
    level = get("level"),
    availability = get("availability"),
    saved = get("saved");
  return {
    q: get("q").slice(0, 200),
    subject: learningRoadmaps.some((roadmap) => roadmap.slug === subject) ? subject : "all",
    stage: /^(?:[1-9]|10)$/.test(stage) ? stage : "all",
    level: LEVELS.find((candidate) => candidate.toLowerCase() === level.toLowerCase()) ?? "all",
    availability: ["authored", "outline", "unknown"].includes(availability)
      ? (availability as TopicAvailability)
      : "all",
    saved: saved === "bookmarked" ? "bookmarked" : "all",
  };
}

export function serializeTopicFilters(filters: TopicFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const key of ["subject", "stage", "level", "availability", "saved"] as const)
    if (filters[key] !== "all") params.set(key, filters[key]);
  return params.toString();
}

export function topicAvailability(
  topic: Pick<TopicSearchItem, "key">,
  authoredKeys: ReadonlySet<string> | null,
): TopicAvailability {
  return authoredKeys === null ? "unknown" : authoredKeys.has(topic.key) ? "authored" : "outline";
}

/** A complete public index is required before a missing lesson can be called an outline. */
export function curriculumAuthoredKeys(payload: unknown, index: readonly TopicSearchItem[]): Set<string> {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;
  if (
    !isRecord(payload) ||
    payload.version !== 1 ||
    typeof payload.pass_score !== "number" ||
    !Number.isFinite(payload.pass_score) ||
    payload.pass_score < 0 ||
    payload.pass_score > 100 ||
    !Array.isArray(payload.roadmaps)
  )
    throw new Error("Lesson availability is unavailable because the curriculum index is invalid.");
  const topics = new Map(index.map((topic) => [topic.key, topic])),
    subjects = new Set(index.map((topic) => topic.roadmapSlug)),
    seenSubjects = new Set<string>(),
    entries = new Set<string>(),
    authored = new Set<string>();
  for (const roadmap of payload.roadmaps) {
    if (
      !isRecord(roadmap) ||
      typeof roadmap.slug !== "string" ||
      !subjects.has(roadmap.slug) ||
      !Number.isInteger(roadmap.stage_index) ||
      Number(roadmap.stage_index) < 0 ||
      Number(roadmap.stage_index) >= 10 ||
      !Array.isArray(roadmap.lessons)
    )
      throw new Error("Lesson availability is unavailable because the curriculum index is invalid.");
    const entryKey = `${roadmap.slug}:${roadmap.stage_index}`;
    if (entries.has(entryKey)) throw new Error("Lesson availability contains duplicate stages.");
    entries.add(entryKey);
    seenSubjects.add(roadmap.slug);
    for (const lesson of roadmap.lessons) {
      if (
        !isRecord(lesson) ||
        typeof lesson.topic_slug !== "string" ||
        typeof lesson.title !== "string" ||
        !lesson.title.trim() ||
        !Number.isSafeInteger(lesson.question_count) ||
        Number(lesson.question_count) < 1
      )
        throw new Error("Lesson availability contains invalid lesson metadata.");
      const key = `${roadmap.slug}:${lesson.topic_slug}`,
        topic = topics.get(key);
      if (!topic || topic.stageIndex !== roadmap.stage_index || authored.has(key))
        throw new Error("Lesson availability does not match the public topic catalog.");
      authored.add(key);
    }
  }
  if (seenSubjects.size !== subjects.size)
    throw new Error("Lesson availability is incomplete. Topics remain searchable while it is retried.");
  return authored;
}

export function filterRoadmapTopics(
  index: readonly TopicSearchItem[],
  filters: TopicFilters,
  {
    authoredKeys,
    bookmarkedKeys = new Set<string>(),
  }: { authoredKeys: ReadonlySet<string> | null; bookmarkedKeys?: ReadonlySet<string> },
): TopicSearchItem[] {
  const tokens = normalize(filters.q).split(/\s+/).filter(Boolean);
  return index.filter(
    (topic) =>
      (filters.subject === "all" || topic.roadmapSlug === filters.subject) &&
      (filters.stage === "all" || topic.stageIndex + 1 === Number(filters.stage)) &&
      (filters.level === "all" || topic.level === filters.level) &&
      (filters.availability === "all" || topicAvailability(topic, authoredKeys) === filters.availability) &&
      (filters.saved === "all" || bookmarkedKeys.has(topic.key)) &&
      tokens.every((token) => topic.searchText.includes(token)),
  );
}
