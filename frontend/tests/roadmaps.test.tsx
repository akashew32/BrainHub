import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RoadmapLessonPage from "@/app/roadmaps/[slug]/[topic]/page";
import RoadmapDetailPage from "@/app/roadmaps/[slug]/page";
import RoadmapsPage from "@/app/roadmaps/page";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import type { AssessmentResult, AssessmentSession, AuthoredLesson } from "@/lib/curriculum";
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

const authoredLesson: AuthoredLesson = {
  roadmap_slug: "probability",
  topic_slug: "sum-and-product-rules",
  title: "Sum and product rules",
  summary: "Count disjoint choices by addition and successive choices by multiplication.",
  objectives: ["Separate disjoint cases.", "Count successive choices.", "Check for repeated outcomes."],
  sections: [
    { heading: "Disjoint alternatives", body: "For disjoint finite sets, $|A\\cup B|=|A|+|B|$." },
    { heading: "Successive choices", body: "Two stages with $m$ and $n$ choices produce $mn$ outcomes." },
    { heading: "Overlapping cases", body: "If cases overlap, subtract their intersection once." },
  ],
  worked_examples: [
    {
      prompt: "A route has two first legs and three second legs. Count the complete routes.",
      steps: ["Each first leg admits three continuations.", "There are $2\\cdot3=6$ pairs."],
      result: "There are six complete routes.",
    },
  ],
  sources: [{ title: "MIT OpenCourseWare", url: "https://ocw.mit.edu/" }],
  practice_count: 8,
  question_count: 10,
  practice_form_count: 12,
  alternate_form_count: 4,
  pass_score: 75,
};

const assessmentSession: AssessmentSession = {
  id: "practice-session",
  mode: "practice",
  roadmap_slug: "probability",
  topic_slug: "sum-and-product-rules",
  expires_at: "2099-01-01T00:00:00Z",
  pass_score: 75,
  questions: [
    {
      id: "count-successive-choices",
      kind: "number",
      prompt: "Two first legs each allow three second legs. How many routes exist?",
      hints: ["Count ordered pairs.", "Multiply the two choice counts."],
      concept: "Product rule",
      difficulty: "foundation",
      topic_slug: authoredLesson.topic_slug,
      lesson_title: authoredLesson.title,
    },
    {
      id: "choose-disjoint-rule",
      kind: "choice",
      prompt: "How do you combine the counts of two disjoint alternatives?",
      choices: ["Add the counts.", "Multiply the counts."],
      hints: ["The alternatives do not overlap.", "Each outcome belongs to exactly one alternative."],
      concept: "Sum rule",
      difficulty: "foundation",
      topic_slug: authoredLesson.topic_slug,
      lesson_title: authoredLesson.title,
    },
  ],
};

const assessmentResult: AssessmentResult = {
  session_id: assessmentSession.id,
  mode: "practice",
  score: 100,
  passed: true,
  correct: 2,
  total: 2,
  feedback: assessmentSession.questions.map((question, index) => ({
    question_id: question.id,
    prompt: question.prompt,
    concept: question.concept,
    correct: true,
    submitted_answer: index === 0 ? "6" : "Add the counts.",
    expected_answer: index === 0 ? 6 : "Add the counts.",
    solution: index === 0 ? "There are $2\\cdot3=6$ ordered pairs." : "Disjoint alternatives add.",
    topic_slug: authoredLesson.topic_slug,
  })),
  progress: {
    roadmap_slug: authoredLesson.roadmap_slug,
    topic_slug: authoredLesson.topic_slug,
    status: "completed",
    quiz_score: 100,
    quiz_attempts: 1,
    time_spent_seconds: 30,
    last_viewed_at: "2026-11-12T12:00:00Z",
    completed_at: "2026-11-12T12:00:00Z",
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
        if (url.includes("/lessons/")) return { ok: true, json: async () => authoredLesson };
        return { ok: true, json: async () => emptyProgress };
      }
      if (url.endsWith("/assessments")) return { ok: true, json: async () => assessmentSession };
      if (url.endsWith("/submit")) return { ok: true, json: async () => assessmentResult };
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

  it("provides unique topic routes with valid prerequisite references", () => {
    expect(roadmapLessons).toHaveLength(300);
    expect(new Set(roadmapLessons.map((lesson) => lesson.id)).size).toBe(300);
    for (const lesson of roadmapLessons) {
      expect(lesson.topicSlug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(lesson.title.trim()).not.toBe("");
      expect(lesson.stageIndex).toBeGreaterThanOrEqual(0);
      expect(lesson.stageIndex).toBeLessThan(10);
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
    expect(screen.getAllByText("Curriculum outline")).toHaveLength(9);
    expect(screen.getByRole("link", { name: "Stage 1 exam · 12 questions" })).toHaveAttribute(
      "href",
      "/roadmaps/probability/exam",
    );
  });

  it("loads authored content and applies the server-graded practice result", async () => {
    const lesson = roadmapLessons[0]!;
    const page = await RoadmapLessonPage({
      params: Promise.resolve({ slug: lesson.roadmapSlug, topic: lesson.topicSlug }),
    });
    renderWithProgress(page);
    expect(await screen.findByRole("heading", { name: lesson.title, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Worked examples" })).toBeInTheDocument();
    expect(screen.getByText(/10 core questions \+ 4 alternate forms/)).toBeInTheDocument();
    expect(screen.getByText(/Each practice set covers 8 distinct skills/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Disjoint alternatives" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit mastery check" })).not.toBeInTheDocument();

    const start = await waitFor(() => {
      const button = screen.getByRole("button", { name: "Start practice" });
      expect(button).toBeEnabled();
      return button;
    });
    fireEvent.click(start);
    const answer = await waitFor(() => {
      const input = screen.getByRole("textbox", { name: "Answer to question 1" });
      expect(input).toBeEnabled();
      return input;
    });
    fireEvent.change(answer, {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByLabelText("Add the counts."));
    fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    expect(await screen.findByText("Practice passed. Your progress has been saved.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Completed · Best practice 100%")).toBeInTheDocument());
    const requests = vi.mocked(fetch).mock.calls;
    const submission = requests.find(([input]) => String(input).endsWith("/practice-session/submit"));
    expect(submission).toBeDefined();
    expect(JSON.parse(String(submission?.[1]?.body))).toEqual({
      answers: [
        { question_id: "count-successive-choices", answer: "6" },
        { question_id: "choose-disjoint-rule", answer: "Add the counts." },
      ],
      time_spent_seconds: expect.any(Number),
    });
  });
});
