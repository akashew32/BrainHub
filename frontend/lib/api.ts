import type { Attempt, Difficulty } from "@/types/games";
import type { ChallengeLanguage, ChallengeResult } from "@/lib/challenges";
import type { AssessmentMode } from "@/lib/assessment-modes";
import type {
  RoadmapProgressItem,
  RoadmapProgressResponse,
  RoadmapProgressUpdate,
} from "@/lib/roadmap-progress";
const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string | Array<{ msg?: string }>;
    } | null;
    const detail = Array.isArray(payload?.detail)
      ? payload.detail.map((item) => item.msg ?? "Invalid answer").join("; ")
      : payload?.detail;
    throw new ApiError(detail ?? `Request failed with status ${response.status}`, response.status);
  }
  return response.json() as Promise<T>;
}
async function assessmentRequest(path: string, init?: RequestInit) {
  const started = performance.now();
  const session = await request<import("@/lib/curriculum").AssessmentSession>(path, init);
  // Subtract the whole request duration conservatively; client epoch clocks never set expiry.
  return typeof session.expires_in_seconds === "number"
    ? {
        ...session,
        expires_in_seconds: Math.max(0, session.expires_in_seconds - (performance.now() - started) / 1000),
      }
    : session;
}
export const api = {
  assessmentSessions: (
    query: {
      state?: "all" | "active" | "completed" | "expired";
      roadmap_slug?: string;
      mode?: AssessmentMode;
      limit?: number;
      cursor?: string;
    } = {},
  ) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== "") params.set(key, String(value));
    return request<import("@/lib/curriculum").AssessmentHistoryPage>(
      "/roadmaps/assessment-sessions?" + params,
      { signal: AbortSignal.timeout(12_000) },
    );
  },
  examReadiness: (roadmapSlug: string, stageIndex = 0) =>
    request<import("@/lib/curriculum").ExamReadiness>(
      `/roadmaps/${encodeURIComponent(roadmapSlug)}/exam-readiness?stage_index=${stageIndex}`,
      { signal: AbortSignal.timeout(12_000) },
    ),
  roadmapNotebook: (
    query: {
      roadmap_slug?: string;
      state?: "all" | "unresolved" | "resolved";
      limit?: number;
      cursor?: string;
    } = {},
  ) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== "") params.set(key, String(value));
    return request<import("@/lib/curriculum").NotebookPage>("/roadmaps/notebook?" + params, {
      signal: AbortSignal.timeout(12_000),
    });
  },
  notebookQuestion: (roadmapSlug: string, questionId: string, cursor?: string) => {
    const params = new URLSearchParams({ limit: "20" });
    if (cursor) params.set("cursor", cursor);
    return request<import("@/lib/curriculum").NotebookDetail>(
      `/roadmaps/notebook/${encodeURIComponent(roadmapSlug)}/${encodeURIComponent(questionId)}?${params}`,
      { signal: AbortSignal.timeout(12_000) },
    );
  },
  saveQuestionReflection: (
    roadmapSlug: string,
    questionId: string,
    body: { text: string; revision: number },
  ) =>
    request<import("@/lib/curriculum").ReflectionNote>(
      `/roadmaps/notebook/${encodeURIComponent(roadmapSlug)}/${encodeURIComponent(questionId)}/note`,
      { method: "PUT", body: JSON.stringify(body), signal: AbortSignal.timeout(12_000) },
    ),
  conceptPerformance: (roadmapSlug?: string) => {
    const params = new URLSearchParams({ days: "14" });
    if (roadmapSlug) params.set("roadmap_slug", roadmapSlug);
    return request<import("@/lib/curriculum").ConceptPerformance>("/roadmaps/concept-performance?" + params, {
      signal: AbortSignal.timeout(12_000),
    });
  },
  revealAssessmentHint: (sessionId: string, questionId: string, index: number) =>
    request<import("@/lib/curriculum").HintReveal>(
      "/roadmaps/assessments/" + sessionId + "/questions/" + questionId + "/hints",
      { method: "POST", body: JSON.stringify({ index }), signal: AbortSignal.timeout(12_000) },
    ),
  resumeAssessment: (sessionId: string) =>
    assessmentRequest(`/roadmaps/assessments/${sessionId}`, {
      signal: AbortSignal.timeout(12_000),
    }),
  saveAssessmentDraft: (sessionId: string, body: import("@/lib/curriculum").AssessmentDraft) =>
    request<import("@/lib/curriculum").AssessmentSession>(`/roadmaps/assessments/${sessionId}/draft`, {
      method: "PUT",
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    }),
  authoredLesson: (roadmapSlug: string, topicSlug: string) =>
    request<import("@/lib/curriculum").AuthoredLesson>(`/roadmaps/${roadmapSlug}/lessons/${topicSlug}`),
  startAssessment: (
    roadmapSlug: string,
    body: {
      mode: AssessmentMode;
      topic_slug?: string;
      stage_index?: number;
      request_id?: string;
    },
  ) =>
    assessmentRequest(`/roadmaps/${roadmapSlug}/assessments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  submitAssessment: (
    sessionId: string,
    body: { answers: Array<{ question_id: string; answer: unknown }>; time_spent_seconds: number },
  ) =>
    request<import("@/lib/curriculum").AssessmentResult>(`/roadmaps/assessments/${sessionId}/submit`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  roadmapMistakes: () => request<import("@/lib/curriculum").MistakeQueue>("/roadmaps/mistakes"),
  roadmapReviewPlan: () =>
    request<import("@/lib/curriculum").ReviewPlan>("/roadmaps/review-plan", {
      signal: AbortSignal.timeout(12_000),
    }),
  learningStats: () => request<import("@/lib/curriculum").LearningStats>("/roadmaps/learning-stats"),
  roadmapProgress: () => request<RoadmapProgressResponse>("/roadmaps/progress"),
  updateRoadmapProgress: (roadmapSlug: string, topicSlug: string, body: RoadmapProgressUpdate) =>
    request<RoadmapProgressItem>(`/roadmaps/${roadmapSlug}/topics/${topicSlug}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  runChallenge: (
    slug: string,
    body: { language: ChallengeLanguage; source: string; mode: "run" | "submit" },
  ) =>
    request<ChallengeResult>(`/challenges/${slug}/run`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  stats: () =>
    request<{
      games_played: number;
      total_training_ms: number;
      current_streak: number;
      rating: number;
      games: Array<{
        slug: string;
        attempts: number;
        best_score: number;
        average_score: number;
        accuracy: number | null;
        total_duration_ms: number;
      }>;
      categories: Array<{ name: string; rating: number }>;
      recent_trend: Array<{ date: string; score: number; game: string }>;
      roadmaps: import("@/lib/roadmap-progress").RoadmapProgressSummary;
    }>("/stats"),
  recent: () => request<Attempt[]>("/attempts/recent"),
  create: (slug: string, difficulty: Difficulty) =>
    request<{ id: string; state: Record<string, unknown> }>(`/games/${slug}/sessions`, {
      method: "POST",
      body: JSON.stringify({ difficulty }),
    }),
  action: (slug: string, id: string, action: Record<string, unknown>) =>
    request<{ state: Record<string, unknown> }>(`/games/${slug}/sessions/${id}/actions`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),
  complete: (
    slug: string,
    id: string,
    body: { score: number; duration_ms: number; won?: boolean; metrics?: Record<string, unknown> },
  ) =>
    request<Attempt>(`/games/${slug}/sessions/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
