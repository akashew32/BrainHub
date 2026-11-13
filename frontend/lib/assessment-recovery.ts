import type { AssessmentResult } from "@/lib/curriculum";
import { DIAGNOSTIC_SAMPLE } from "@/lib/assessment-modes";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function score(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}
function assistance(value: unknown) {
  return value === undefined || ["independent", "assisted", "untracked"].includes(String(value));
}

export function validAssessmentResult(
  value: unknown,
  sessionId: string,
  mode: string,
): value is AssessmentResult {
  if (
    !record(value) ||
    value.session_id !== sessionId ||
    value.mode !== mode ||
    !score(value.score) ||
    typeof value.passed !== "boolean" ||
    !Number.isInteger(value.total) ||
    (value.total as number) < 1 ||
    (value.total as number) > 60 ||
    !Number.isInteger(value.correct) ||
    (value.correct as number) < 0 ||
    (value.correct as number) > (value.total as number) ||
    !assistance(value.assistance) ||
    (value.independent_score !== undefined &&
      value.independent_score !== null &&
      !score(value.independent_score)) ||
    (value.independent_passed !== undefined &&
      value.independent_passed !== null &&
      typeof value.independent_passed !== "boolean") ||
    !Array.isArray(value.feedback) ||
    value.feedback.length !== value.total
  )
    return false;
  if (mode === "diagnostic" && value.progress !== null) return false;
  if (value.progress !== null) {
    const progress = value.progress;
    if (
      !record(progress) ||
      typeof progress.roadmap_slug !== "string" ||
      typeof progress.topic_slug !== "string" ||
      !["in_progress", "completed", "review"].includes(String(progress.status)) ||
      !score(progress.quiz_score) ||
      typeof progress.quiz_attempts !== "number" ||
      typeof progress.time_spent_seconds !== "number" ||
      typeof progress.last_viewed_at !== "string" ||
      (progress.completed_at !== null && typeof progress.completed_at !== "string")
    )
      return false;
  }
  const feedbackValid =
    new Set(value.feedback.map((item) => (record(item) ? item.question_id : null))).size ===
      value.feedback.length &&
    value.feedback.every(
      (item) =>
        record(item) &&
        typeof item.question_id === "string" &&
        item.question_id.length > 0 &&
        typeof item.prompt === "string" &&
        typeof item.concept === "string" &&
        typeof item.correct === "boolean" &&
        typeof item.solution === "string" &&
        typeof item.topic_slug === "string" &&
        "submitted_answer" in item &&
        "expected_answer" in item &&
        assistance(item.assistance) &&
        (item.hints_used === undefined ||
          item.hints_used === null ||
          (Number.isInteger(item.hints_used) &&
            (item.hints_used as number) >= 0 &&
            (item.hints_used as number) <= 64)) &&
        (item.proof_details === undefined || validProofDetails(item.proof_details)),
    );
  return feedbackValid && (mode !== "diagnostic" || validDiagnosticSummary(value));
}

function validDiagnosticSummary(result: Record<string, unknown>) {
  const value = result.diagnostic_summary;
  if (
    !record(value) ||
    value.version !== 1 ||
    typeof value.notice !== "string" ||
    !value.notice.trim() ||
    !Array.isArray(value.topics) ||
    value.topics.length !== DIAGNOSTIC_SAMPLE.lessons ||
    !Array.isArray(value.recommended_topics) ||
    value.recommended_topics.length !== DIAGNOSTIC_SAMPLE.lessons ||
    !value.recommended_topics.every((topic) => typeof topic === "string") ||
    new Set(value.recommended_topics).size !== DIAGNOSTIC_SAMPLE.lessons ||
    result.total !== DIAGNOSTIC_SAMPLE.questions ||
    !Array.isArray(result.feedback)
  )
    return false;
  const feedback = result.feedback;
  let correct = 0;
  const slugs = new Set<string>();
  for (const topic of value.topics) {
    if (
      !record(topic) ||
      typeof topic.topic_slug !== "string" ||
      !topic.topic_slug ||
      slugs.has(topic.topic_slug) ||
      typeof topic.title !== "string" ||
      !topic.title.trim() ||
      topic.total !== DIAGNOSTIC_SAMPLE.perLesson ||
      !Number.isInteger(topic.correct) ||
      (topic.correct as number) < 0 ||
      (topic.correct as number) > DIAGNOSTIC_SAMPLE.perLesson ||
      topic.priority !== ["start_here", "review", "verify"][topic.correct as number] ||
      typeof topic.guidance !== "string" ||
      !topic.guidance.trim() ||
      (topic.study_url !== null &&
        (typeof topic.study_url !== "string" || !topic.study_url.startsWith("/roadmaps/")))
    )
      return false;
    const rows = feedback.filter((row) => record(row) && row.topic_slug === topic.topic_slug);
    if (
      rows.length !== DIAGNOSTIC_SAMPLE.perLesson ||
      rows.filter((row) => record(row) && row.correct === true).length !== topic.correct
    )
      return false;
    slugs.add(topic.topic_slug);
    correct += topic.correct as number;
  }
  return (
    correct === result.correct &&
    result.score === Math.round((100 * correct) / DIAGNOSTIC_SAMPLE.questions) &&
    value.recommended_topics.every((topic) => slugs.has(topic))
  );
}

function validProofDetails(value: unknown) {
  if (
    !record(value) ||
    !Number.isInteger(value.total_steps) ||
    (value.total_steps as number) < 1 ||
    !Number.isInteger(value.correct_prefix_length) ||
    typeof value.explanation !== "string" ||
    (value.first_divergence !== null && !Number.isInteger(value.first_divergence))
  )
    return false;
  const steps = (candidate: unknown) =>
    Array.isArray(candidate) &&
    candidate.every(
      (step) =>
        record(step) &&
        Number.isInteger(step.step) &&
        typeof step.text === "string" &&
        (step.justification === undefined || typeof step.justification === "string"),
    );
  return (
    steps(value.submitted_steps) &&
    steps(value.expected_steps) &&
    (value.violated_dependencies === undefined ||
      (Array.isArray(value.violated_dependencies) &&
        value.violated_dependencies.every(
          (item) => record(item) && Number.isInteger(item.step) && Number.isInteger(item.requires),
        )))
  );
}

export type StartIntent = { version: 1; request_id: string; scope: string };
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readStartIntent(key: string, scope: string): StartIntent | null {
  try {
    const raw = localStorage.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return record(value) &&
      value.version === 1 &&
      value.scope === scope &&
      typeof value.request_id === "string" &&
      UUID_PATTERN.test(value.request_id)
      ? (value as StartIntent)
      : null;
  } catch {
    return null;
  }
}
export function storeStartIntent(key: string, intent: StartIntent) {
  try {
    localStorage.setItem(key, JSON.stringify(intent));
    return true;
  } catch {
    return false;
  }
}
export function clearStartIntent(key: string, intent: StartIntent) {
  try {
    if (readStartIntent(key, intent.scope)?.request_id === intent.request_id) localStorage.removeItem(key);
  } catch {
    /* Keep a recoverable token if storage has become unavailable. */
  }
}
