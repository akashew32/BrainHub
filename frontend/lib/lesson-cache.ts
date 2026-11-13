import type { AuthoredLesson } from "@/lib/curriculum";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function textList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function validLesson(value: unknown, roadmapSlug: string, topicSlug: string): value is AuthoredLesson {
  return (
    isRecord(value) &&
    value.roadmap_slug === roadmapSlug &&
    value.topic_slug === topicSlug &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    textList(value.objectives) &&
    Array.isArray(value.sections) &&
    value.sections.every(
      (section) =>
        isRecord(section) && typeof section.heading === "string" && typeof section.body === "string",
    ) &&
    Array.isArray(value.worked_examples) &&
    value.worked_examples.every(
      (example) =>
        isRecord(example) &&
        typeof example.prompt === "string" &&
        textList(example.steps) &&
        typeof example.result === "string",
    ) &&
    Array.isArray(value.sources) &&
    value.sources.every(
      (source) =>
        isRecord(source) &&
        typeof source.title === "string" &&
        typeof source.url === "string" &&
        /^https:\/\//.test(source.url),
    ) &&
    typeof value.question_count === "number" &&
    typeof value.practice_count === "number" &&
    (value.alternate_form_count === undefined ||
      (Number.isInteger(value.alternate_form_count) &&
        typeof value.alternate_form_count === "number" &&
        value.alternate_form_count >= 0 &&
        typeof value.practice_form_count === "number" &&
        value.practice_form_count === value.practice_count + value.alternate_form_count)) &&
    typeof value.pass_score === "number"
  );
}
function cacheKey(roadmapSlug: string, topicSlug: string) {
  return `brainhub:lesson:v1:${roadmapSlug}:${topicSlug}`;
}
export function readLessonCache(roadmapSlug: string, topicSlug: string): AuthoredLesson | null {
  try {
    const raw = localStorage.getItem(cacheKey(roadmapSlug, topicSlug));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return validLesson(parsed, roadmapSlug, topicSlug) ? parsed : null;
  } catch {
    return null;
  }
}
export function saveLessonCache(lesson: AuthoredLesson) {
  try {
    localStorage.setItem(cacheKey(lesson.roadmap_slug, lesson.topic_slug), JSON.stringify(lesson));
  } catch {
    /* Online reading and practice continue when device storage is unavailable. */
  }
}
