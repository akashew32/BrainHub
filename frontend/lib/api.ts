import type { Attempt, Difficulty } from "@/types/games";
const base = "/api";
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new Error((await response.json()).detail ?? "Request failed");
  return response.json() as Promise<T>;
}
export const api = {
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
