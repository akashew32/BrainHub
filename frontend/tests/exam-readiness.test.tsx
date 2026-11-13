import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExamReadiness } from "@/components/roadmaps/exam-readiness";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import { roadmapMap } from "@/lib/roadmaps";
import { slugifyTopic } from "@/lib/roadmap-utils";
import type { AssessmentResult, AssessmentSession, ExamReadiness as Readiness } from "@/lib/curriculum";

function readiness(slug = "linear-algebra", eligible = true): Readiness {
  return {
    roadmap_slug: slug,
    stage_index: 0,
    generated_at: "2026-11-12T00:05:00Z",
    eligible,
    ready_lessons: eligible ? 6 : 5,
    required_lessons: 6,
    pass_score: 75,
    lessons: roadmapMap[slug]!.stages[0]!.topics.map((title, index) => ({
      topic_slug: slugifyTopic(title),
      title,
      practice_count: 8,
      exam_count: 2,
      best_score: 100,
      best_independent_score: !eligible && index === 0 ? 50 : 100,
      completed_attempts: 1,
      untracked_attempts: 0,
      outdated_attempts: 0,
      status: !eligible && index === 0 ? "independent_needed" : "ready",
      reason:
        !eligible && index === 0
          ? "Complete more answers independently before this lesson is ready."
          : "Independent practice threshold met.",
      study_url: `/roadmaps/${slug}/${slugifyTopic(title)}`,
      last_attempt_at: "2026-11-12T00:05:00",
    })),
    blueprint: {
      total_questions: 12,
      kinds: { number: 5, vector: 2, matrix: 2, choice: 1, proof: 2 },
      difficulties: { foundation: 3, core: 6, stretch: 3 },
      hints_allowed: false,
    },
  };
}
const exam: AssessmentSession = {
  id: "ready-exam",
  roadmap_slug: "linear-algebra",
  topic_slug: null,
  mode: "exam",
  pass_score: 75,
  expires_at: "2099-01-01T00:00:00Z",
  hint_usage: {},
  questions: [
    {
      id: "exam-coefficient",
      kind: "number",
      prompt: "Solve $2x=1$.",
      hints: [],
      hint_count: 2,
      concept: "Scalar coefficient",
      difficulty: "core",
      topic_slug: "vector-arithmetic-and-linear-combinations",
      lesson_title: "Vector arithmetic and linear combinations",
    },
  ],
};
const result: AssessmentResult = {
  session_id: exam.id,
  mode: "exam",
  score: 100,
  passed: true,
  correct: 1,
  total: 1,
  assistance: "independent",
  independent_score: 100,
  independent_passed: true,
  progress: null,
  feedback: [
    {
      question_id: "exam-coefficient",
      prompt: exam.questions[0]!.prompt,
      concept: "Scalar coefficient",
      correct: true,
      submitted_answer: "1/2",
      expected_answer: 0.5,
      solution: "Divide by two to obtain $x=1/2$.",
      topic_slug: exam.questions[0]!.topic_slug,
      assistance: "independent",
      hints_used: 0,
    },
  ],
};
function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}
function mockApi({
  getReadiness = async (slug) => response(readiness(slug)),
  restored = exam,
}: {
  getReadiness?: (slug: string) => Promise<ReturnType<typeof response>>;
  restored?: AssessmentSession;
} = {}) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/progress")) return response({ items: [], summary: {} });
    if (url.pathname.endsWith("/exam-readiness")) return getReadiness(url.pathname.split("/").at(-2)!);
    if (url.pathname.endsWith("/assessments") && init?.method === "POST") return response(exam);
    if (url.pathname.endsWith("/" + exam.id)) return response(restored);
    if (url.pathname.endsWith("/draft")) return response({ ...exam, draft: JSON.parse(String(init?.body)) });
    if (url.pathname.endsWith("/submit")) return response(result);
    throw new Error("Unexpected exam readiness request: " + url);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
function renderReadiness(slug = "linear-algebra") {
  return render(
    <RoadmapProgressProvider>
      <ExamReadiness roadmapSlug={slug} />
    </RoadmapProgressProvider>,
  );
}
function savedExam(answer = "1/") {
  localStorage.setItem(
    "brainhub:assessment:v2:linear-algebra:exam:stage-0",
    JSON.stringify({
      version: 2,
      sessionId: exam.id,
      roadmapSlug: exam.roadmap_slug,
      topicSlug: null,
      stageIndex: 0,
      mode: "exam",
      answers: { "exam-coefficient": answer },
      startedAt: Date.now() - 10_000,
      revision: 1,
      session: exam,
    }),
  );
}
async function readyEditor(value?: string) {
  return waitFor(() => {
    const editor = screen.getByRole("textbox", { name: "Answer to question 1" });
    expect(editor).toBeEnabled();
    if (value !== undefined) expect(editor).toHaveValue(value);
    return editor;
  });
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("server-confirmed exam readiness", () => {
  it("blocks a new exam until eligibility is known and keeps it locked for incomplete independent practice", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    const mock = mockApi({
      getReadiness: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    renderReadiness();
    expect(await screen.findByRole("button", { name: "Start exam" })).toBeDisabled();
    expect(screen.getByText("Checking eligibility for a new exam")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start exam" }));
    expect(mock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    await act(async () => resolve(response(readiness("linear-algebra", false))));
    expect(screen.getByText("Complete your independent practice to unlock a new exam")).toBeInTheDocument();
    expect(screen.getByText(/5 of 6 lessons ready/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start exam" })).toBeDisabled();
  });

  it("shows six lesson checks and a public blueprint before opening a confirmed eligible exam", async () => {
    const mock = mockApi();
    renderReadiness();
    await screen.findByText("Ready to start a new exam");
    const checklist = screen.getByRole("list", { name: "Lesson readiness checklist" });
    expect(within(checklist).getAllByRole("listitem")).toHaveLength(6);
    expect(within(checklist).getAllByText("Best independent practice:")).toHaveLength(6);
    expect(
      screen.getByRole("link", { name: /Study Vector arithmetic and linear combinations/ }),
    ).toHaveAttribute("href", "/roadmaps/linear-algebra/vector-arithmetic-and-linear-combinations");
    const blueprint = screen.getByRole("region", { name: "Exam blueprint" });
    expect(blueprint).toHaveTextContent("12 reserved questions across 6 lessons · 75% to pass · No hints");
    for (const label of [
      "Numerical answers",
      "Vectors",
      "Matrices",
      "Multiple choice",
      "Proof ordering",
      "Foundation",
      "Core",
      "Stretch",
    ])
      expect(within(blueprint).getByText(label)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start exam" }));
    await readyEditor("");
    expect(screen.queryByRole("button", { name: /Show hint/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit exam" })).toBeEnabled();
    const request = mock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/assessments") && init?.method === "POST",
    );
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ mode: "exam", stage_index: 0 });
  });

  it("distinguishes measured zero from untracked independent practice without borrowing an overall pass", async () => {
    const payload = readiness("linear-algebra", false);
    payload.ready_lessons = 4;
    Object.assign(payload.lessons[0]!, {
      best_score: 100,
      best_independent_score: null,
      status: "untracked",
      reason: "Earlier hint usage was not recorded; complete a fresh practice set.",
    });
    Object.assign(payload.lessons[1]!, {
      best_score: 100,
      best_independent_score: 0,
      status: "independent_needed",
      reason: "Your measured independent score is below 75%.",
    });
    mockApi({ getReadiness: async () => response(payload) });
    renderReadiness();
    const checklist = await screen.findByRole("list", { name: "Lesson readiness checklist" });
    const lessons = within(checklist).getAllByRole("listitem");
    expect(within(lessons[0]!).getByText("Best independent practice:").nextElementSibling).toHaveTextContent(
      "Not measured",
    );
    expect(within(lessons[0]!).getByText("Independent score untracked")).toBeInTheDocument();
    expect(within(lessons[1]!).getByText("Best independent practice:").nextElementSibling).toHaveTextContent(
      "0%",
    );
    expect(within(lessons[1]!).getByText("Independent practice needed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start exam" })).toBeDisabled();
  });

  it("recovers and grades an existing exam even when new exams are now ineligible", async () => {
    savedExam();
    mockApi({ getReadiness: async () => response(readiness("linear-algebra", false)) });
    renderReadiness();
    const editor = await readyEditor("1/");
    fireEvent.change(editor, { target: { value: "1/2" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit exam" }));
    expect(await screen.findByText("Assessment passed. Your responses have been saved.")).toBeInTheDocument();
    expect(screen.getByText("Question 1: Correct · Scalar coefficient")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start another session" })).toBeDisabled();
  });

  it("cannot claim readiness after a fetch error and can retry server confirmation", async () => {
    let requests = 0;
    mockApi({
      getReadiness: async () =>
        ++requests === 1
          ? response({ detail: "Connection temporarily unavailable" }, 503)
          : response(readiness()),
    });
    renderReadiness();
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not confirm exam readiness");
    expect(screen.getByText("Readiness not confirmed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start exam" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry exam readiness" }));
    await screen.findByText("Ready to start a new exam");
    expect(screen.getByRole("button", { name: "Start exam" })).toBeEnabled();
  });

  it("keeps saved exam recovery and submission available while readiness is offline", async () => {
    savedExam("1/2");
    mockApi({
      getReadiness: async () => {
        throw new Error("Offline");
      },
    });
    renderReadiness();
    await screen.findByRole("alert");
    await readyEditor("1/2");
    expect(screen.getByRole("button", { name: "Submit exam" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Submit exam" }));
    expect(await screen.findByText("Assessment passed. Your responses have been saved.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start another session" })).toBeDisabled();
  });

  it("ignores an old subject response and resets ready state immediately on subject change", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    mockApi({
      getReadiness: (slug) =>
        slug === "linear-algebra"
          ? new Promise((done) => {
              resolve = done;
            })
          : Promise.resolve(response(readiness(slug, false))),
    });
    const rendered = renderReadiness();
    await screen.findByRole("button", { name: "Start exam" });
    rendered.rerender(
      <RoadmapProgressProvider>
        <ExamReadiness roadmapSlug="probability" />
      </RoadmapProgressProvider>,
    );
    await screen.findByText("Complete your independent practice to unlock a new exam");
    await act(async () => resolve(response(readiness("linear-algebra", true))));
    expect(screen.getByRole("button", { name: "Start exam" })).toBeDisabled();
    expect(screen.queryByText("Ready to start a new exam")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Study Sum and product rules/ })).toHaveAttribute(
      "href",
      "/roadmaps/probability/sum-and-product-rules",
    );
  });

  it("refreshes on focus and manually without remounting active answers or disabling submission", async () => {
    let requests = 0;
    mockApi({
      getReadiness: async () =>
        ++requests === 1
          ? response(readiness())
          : requests === 2
            ? response(readiness("linear-algebra", false))
            : response({ detail: "Refresh failed" }, 503),
    });
    renderReadiness();
    await screen.findByText("Ready to start a new exam");
    fireEvent.click(screen.getByRole("button", { name: "Start exam" }));
    const editor = await readyEditor("");
    fireEvent.change(editor, { target: { value: "sqrt(" } });
    fireEvent.focus(window);
    await screen.findByText("Complete your independent practice to unlock a new exam");
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toBe(editor);
    expect(editor).toHaveValue("sqrt(");
    expect(editor).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh exam readiness" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toBe(editor);
    expect(editor).toHaveValue("sqrt(");
    expect(screen.getByRole("button", { name: "Submit exam" })).toBeEnabled();
  });

  it("does not unlock an exam for a mismatched readiness payload", async () => {
    mockApi({ getReadiness: async () => response(readiness("probability", true)) });
    renderReadiness();
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be confirmed for this subject");
    expect(screen.getByRole("button", { name: "Start exam" })).toBeDisabled();
    expect(screen.queryByText("Ready to start a new exam")).not.toBeInTheDocument();
  });

  it("defaults an uncontrolled exam panel to blocked fresh starts", async () => {
    mockApi();
    render(
      <RoadmapProgressProvider>
        <AssessmentPanel roadmapSlug="linear-algebra" mode="exam" />
      </RoadmapProgressProvider>,
    );
    expect(await screen.findByRole("button", { name: "Start exam" })).toBeDisabled();
  });
});
