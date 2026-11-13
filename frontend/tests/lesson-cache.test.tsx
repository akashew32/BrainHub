import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { readLessonCache, saveLessonCache } from "@/lib/lesson-cache";
import type { AuthoredLesson as Lesson, AssessmentSession } from "@/lib/curriculum";
import { AuthoredLesson } from "@/components/roadmaps/authored-lesson";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";

const lesson: Lesson = {
  roadmap_slug: "probability",
  topic_slug: "sum-and-product-rules",
  title: "Counting choices",
  summary: "Count disjoint alternatives and sequential choices.",
  objectives: ["Distinguish addition from multiplication."],
  sections: [
    {
      heading: "The product rule",
      body: "Two independent menu choices produce a product of their option counts.",
    },
  ],
  worked_examples: [
    {
      prompt: "Two shirts and three trousers: how many outfits?",
      steps: ["For each shirt, choose one of three trousers."],
      result: "Six outfits.",
    },
  ],
  sources: [
    {
      title: "MIT Mathematics for Computer Science",
      url: "https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-spring-2015/",
    },
  ],
  practice_count: 8,
  question_count: 10,
  pass_score: 75,
};
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("offline authored lessons", () => {
  it("keeps each subject and lesson cache isolated", () => {
    saveLessonCache(lesson);
    expect(readLessonCache("probability", "sum-and-product-rules")).toEqual(lesson);
    expect(readLessonCache("linear-algebra", "sum-and-product-rules")).toBeNull();
    expect(readLessonCache("probability", "other-topic")).toBeNull();
  });
  it("rejects corrupt structure and handles unavailable device storage", () => {
    localStorage.setItem(
      "brainhub:lesson:v1:probability:sum-and-product-rules",
      JSON.stringify({ ...lesson, sections: [null] }),
    );
    expect(readLessonCache("probability", "sum-and-product-rules")).toBeNull();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    expect(readLessonCache("probability", "sum-and-product-rules")).toBeNull();
    expect(() => saveLessonCache(lesson)).not.toThrow();
  });
  it("keeps a saved assessment accessible when lesson and session requests fail after reload", async () => {
    saveLessonCache(lesson);
    const session: AssessmentSession = {
      id: "offline-test-session",
      mode: "practice",
      roadmap_slug: "probability",
      topic_slug: "sum-and-product-rules",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      pass_score: 75,
      questions: [
        {
          id: "q1",
          kind: "number",
          prompt: "How many outfits can be made from two shirts and three trousers?",
          hints: ["Choose a shirt, then trousers."],
          concept: "product rule",
          difficulty: "foundation",
          topic_slug: "sum-and-product-rules",
          lesson_title: lesson.title,
        },
      ],
    };
    localStorage.setItem(
      "brainhub:assessment:v2:probability:practice:sum-and-product-rules",
      JSON.stringify({
        version: 2,
        sessionId: session.id,
        roadmapSlug: "probability",
        topicSlug: "sum-and-product-rules",
        stageIndex: 0,
        mode: "practice",
        answers: { q1: "1/" },
        startedAt: Date.now(),
        revision: 1,
        session,
      }),
    );
    vi.spyOn(api, "authoredLesson").mockRejectedValue(new TypeError("Offline"));
    vi.spyOn(api, "resumeAssessment").mockRejectedValue(new TypeError("Offline"));
    vi.spyOn(api, "roadmapProgress").mockRejectedValue(new TypeError("Offline"));
    render(
      <RoadmapProgressProvider>
        <AuthoredLesson roadmapSlug="probability" topicSlug="sum-and-product-rules" accent="#60a5fa" />
      </RoadmapProgressProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Counting choices" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("1/")).toBeEnabled();
    expect(screen.getByText(/Showing the lesson saved on this device/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume saved session" })).toBeInTheDocument();
  });
});
