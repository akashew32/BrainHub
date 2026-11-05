import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RoadmapLessonPage from "@/app/roadmaps/[slug]/[topic]/page";
import RoadmapDetailPage from "@/app/roadmaps/[slug]/page";
import RoadmapsPage from "@/app/roadmaps/page";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import { roadmapLessonMap, roadmapLessons } from "@/lib/roadmap-lessons";
import { learningRoadmaps, roadmapCounts } from "@/lib/roadmaps";

const emptyProgress = {
  items: [],
  summary: {
    total: 300,
    started: 0,
    completed: 0,
    average_quiz_score: 0,
    time_spent_seconds: 0,
    roadmaps: learningRoadmaps.map((roadmap) => ({
      slug: roadmap.slug,
      total: 60,
      started: 0,
      completed: 0,
      percent: 0,
    })),
  },
};

function renderWithProgress(children: ReactNode) {
  return render(<RoadmapProgressProvider>{children}</RoadmapProgressProvider>);
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (!init?.method || init.method === "GET") {
        return { ok: true, json: async () => emptyProgress };
      }
      const body = JSON.parse(String(init.body)) as {
        status: "in_progress" | "completed" | "review";
        quiz_score?: number;
        time_spent_seconds?: number;
      };
      const parts = url.split("/");
      return {
        ok: true,
        json: async () => ({
          roadmap_slug: parts.at(-3),
          topic_slug: parts.at(-1),
          status: body.status,
          quiz_score: body.quiz_score ?? 0,
          quiz_attempts: body.quiz_score === undefined ? 0 : 1,
          time_spent_seconds: body.time_spent_seconds ?? 0,
          last_viewed_at: new Date().toISOString(),
          completed_at: body.status === "completed" ? new Date().toISOString() : null,
        }),
      };
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("learning roadmaps", () => {
  it("contains five exhaustive tracks with advanced depth", () => {
    expect(roadmapCounts).toEqual({ roadmaps: 5, stages: 50, topics: 300 });
    expect(new Set(learningRoadmaps.map((roadmap) => roadmap.slug)).size).toBe(5);
    for (const roadmap of learningRoadmaps) {
      expect(roadmap.stages).toHaveLength(10);
      expect(roadmap.stages.every((stage) => stage.topics.length === 6)).toBe(true);
      expect(roadmap.stages.some((stage) => stage.level === "Graduate")).toBe(true);
      expect(roadmap.prerequisites).toHaveLength(4);
      expect(roadmap.outcomes).toHaveLength(4);
    }
  });

  it("builds a complete, internally valid lesson for every topic", () => {
    expect(roadmapLessons).toHaveLength(300);
    expect(new Set(roadmapLessons.map((lesson) => lesson.id)).size).toBe(300);
    for (const lesson of roadmapLessons) {
      expect(lesson.objectives).toHaveLength(3);
      expect(lesson.sections).toHaveLength(3);
      expect(lesson.workedExample.steps).toHaveLength(4);
      expect(lesson.exercise.hints).toHaveLength(3);
      expect(lesson.quiz).toHaveLength(3);
      expect(lesson.quiz.every((question) => question.answer >= 0 && question.answer < 4)).toBe(true);
      expect(lesson.quiz.every((question) => new Set(question.choices).size === 4)).toBe(true);
      expect(lesson.prerequisiteIds.every((id) => roadmapLessonMap[id])).toBe(true);
    }
  });

  it("links every overview card to its detailed curriculum", () => {
    renderWithProgress(<RoadmapsPage />);
    const links = screen.getAllByRole("link", { name: "View curriculum" });
    expect(links).toHaveLength(5);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      learningRoadmaps.map((roadmap) => `/roadmaps/${roadmap.slug}`),
    );
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("Graduate")).toBeInTheDocument();
  });

  it("renders the full probability sequence with stage gates", async () => {
    const page = await RoadmapDetailPage({ params: Promise.resolve({ slug: "probability" }) });
    renderWithProgress(page);
    expect(screen.getByRole("heading", { name: "Probability", level: 1 })).toBeInTheDocument();
    const stageNavigation = screen.getByRole("navigation", { name: "Probability roadmap stages" });
    expect(within(stageNavigation).getAllByRole("link")).toHaveLength(10);
    expect(screen.getByText("Martingale convergence theorems")).toBeInTheDocument();
    expect(screen.getAllByText("Readiness checkpoint")).toHaveLength(10);
    expect(screen.getAllByText("Locked")).toHaveLength(9);
  });

  it("renders a lesson and completes it after a passing mastery check", async () => {
    const lesson = roadmapLessons[0]!;
    const page = await RoadmapLessonPage({
      params: Promise.resolve({ slug: lesson.roadmapSlug, topic: lesson.topicSlug }),
    });
    renderWithProgress(page);
    expect(await screen.findByRole("heading", { name: lesson.title, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Apply the structure deliberately" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Computational or proof exercise" })).toBeInTheDocument();

    for (const question of lesson.quiz) {
      fireEvent.click(screen.getByLabelText(question.choices[question.answer]!));
    }
    fireEvent.click(screen.getByRole("button", { name: "Submit mastery check" }));
    await waitFor(() => expect(screen.getByText(/Mastery check passed/)).toBeInTheDocument());
    expect(screen.getByText("Score: 100%")).toBeInTheDocument();
  });
});
