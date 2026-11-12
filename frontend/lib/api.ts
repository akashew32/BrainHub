import type { Attempt, Difficulty } from "@/types/games";
import type { ChallengeLanguage, ChallengeResult } from "@/lib/challenges";
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
export const api = {
  resumeAssessment: (sessionId: string) =>
    request<import("@/lib/curriculum").AssessmentSession>(`/roadmaps/assessments/${sessionId}`, {
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
    body: { mode: "practice" | "exam" | "review"; topic_slug?: string; stage_index?: number },
  ) =>
    request<import("@/lib/curriculum").AssessmentSession>(`/roadmaps/${roadmapSlug}/assessments`, {
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
