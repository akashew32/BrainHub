import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { AssessmentSessionViewer } from "@/components/roadmaps/assessment-session-viewer";
import { RoadmapProgressProvider, useRoadmapProgress } from "@/components/roadmaps/roadmap-progress-provider";
import { validAssessmentResult } from "@/lib/assessment-recovery";
import type { AssessmentResult, AssessmentSession, MathQuestion } from "@/lib/curriculum";

const id = "00000000-0000-4000-8000-000000000010";
const cacheKey = "brainhub:assessment:v2:linear-algebra:diagnostic:stage-0";
const topics = Array.from({ length: 6 }, (_, index) => `foundation-topic-${index + 1}`);
const questions: MathQuestion[] = Array.from({ length: 12 }, (_, index) => ({
  id: `diagnostic-practice-${index + 1}`,
  kind: index === 1 ? "matrix" : index === 2 ? "proof" : index === 3 ? "choice" : "number",
  prompt: `Sample question ${index + 1}.`,
  concept: `Concept ${index + 1}`,
  difficulty: "foundation",
  topic_slug: topics[Math.floor(index / 2)]!,
  lesson_title: `Foundation lesson ${Math.floor(index / 2) + 1}`,
  hints: ["This cached hint must never be rendered."],
  hint_count: 2,
  ...(index === 2
    ? { choices: ["Subtract the repeated term.", "Apply additivity."] }
    : index === 3
      ? { choices: ["Choice A", "Choice B"] }
      : {}),
}));
const raw = Object.fromEntries(
  questions.map((question, index) => [
    question.id,
    index === 0
      ? " 1 / 2 "
      : index === 1
        ? "1/2, sqrt(2); 3, 4"
        : index === 2
          ? "[2,  1]"
          : index === 3
            ? "Choice B"
            : "1",
  ]),
);
function session(overrides: Partial<AssessmentSession> = {}): AssessmentSession {
  return {
    id,
    roadmap_slug: "linear-algebra",
    topic_slug: null,
    stage_index: 0,
    mode: "diagnostic",
    state: "active",
    questions,
    expires_at: "2099-01-01T00:00:00Z",
    server_now: "2026-11-12T12:00:00Z",
    expires_in_seconds: 7200,
    hint_usage: {},
    pass_score: 75,
    draft: { answers: [], revision: 0, time_spent_seconds: 0 },
    ...overrides,
  };
}
function result(counts = [0, 1, 2, 2, 1, 0]): AssessmentResult {
  const correct = counts.reduce((sum, value) => sum + value, 0);
  const ordered = topics
    .map((topic_slug, index) => ({
      topic_slug,
      title: `Foundation lesson ${index + 1}`,
      correct: counts[index]!,
      total: 2 as const,
      priority: (counts[index] === 0 ? "start_here" : counts[index] === 1 ? "review" : "verify") as
        "start_here" | "review" | "verify",
      guidance:
        counts[index] === 2
          ? "Check this small sample with a full independent practice set."
          : "Study this lesson and then complete its full practice set.",
      study_url: index === 5 ? null : `/roadmaps/linear-algebra/${topic_slug}`,
    }))
    .sort((left, right) => left.correct - right.correct || left.topic_slug.localeCompare(right.topic_slug));
  return {
    session_id: id,
    mode: "diagnostic",
    score: Math.round((100 * correct) / 12),
    passed: correct >= 9,
    correct,
    total: 12,
    progress: null,
    assistance: "independent",
    independent_score: Math.round((100 * correct) / 12),
    independent_passed: correct >= 9,
    feedback: questions.map((question, index) => ({
      question_id: question.id,
      prompt: question.prompt,
      concept: question.concept,
      correct: index % 2 < counts[Math.floor(index / 2)]!,
      submitted_answer: raw[question.id],
      expected_answer: 1,
      solution: `Worked explanation ${index + 1}.`,
      topic_slug: question.topic_slug,
      hints_used: 0,
      assistance: "independent",
    })),
    diagnostic_summary: {
      version: 1,
      notice: "This two-question sample guides study and does not establish mastery or exam eligibility.",
      topics: ordered,
      recommended_topics: ordered.map((topic) => topic.topic_slug),
    },
  };
}
function seed(value = session()) {
  localStorage.setItem(
    cacheKey,
    JSON.stringify({
      version: 2,
      sessionId: id,
      roadmapSlug: value.roadmap_slug,
      topicSlug: null,
      stageIndex: 0,
      mode: "diagnostic",
      answers: raw,
      revision: 5,
      startedAt: Date.now(),
      session: value,
    }),
  );
}
function response(value: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => value };
}
function mockApi({
  opened = session(),
  graded = result(),
  failStart = false,
}: { opened?: AssessmentSession; graded?: unknown; failStart?: boolean } = {}) {
  let starts = 0;
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/roadmaps/progress")) return response({ items: [], summary: {} });
    if (url.endsWith("/assessments") && init?.method === "POST") {
      starts += 1;
      if (failStart && starts === 1) throw new Error("The response was lost.");
      const body = JSON.parse(String(init.body));
      return response({ ...opened, request_id: body.request_id });
    }
    if (url.endsWith("/assessments/" + id)) return response(opened);
    if (url.endsWith("/draft")) return response({ ...opened, draft: JSON.parse(String(init?.body)) });
    if (url.endsWith("/submit")) return response(graded);
    throw new Error("Unexpected diagnostic request: " + url);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
function ProgressProbe() {
  return <output aria-label="Mastery progress entries">{useRoadmapProgress().items.length}</output>;
}
function page(child = <AssessmentPanel roadmapSlug="linear-algebra" mode="diagnostic" />) {
  return (
    <RoadmapProgressProvider>
      <ProgressProbe />
      {child}
    </RoadmapProgressProvider>
  );
}
async function answerAll() {
  for (const [index, question] of questions.entries()) {
    if (question.kind === "proof") {
      fireEvent.click(screen.getByRole("button", { name: "Add step 2 to proof" }));
      fireEvent.click(screen.getByRole("button", { name: "Add step 1 to proof" }));
    } else if (question.kind === "choice") fireEvent.click(screen.getByRole("radio", { name: "Choice B" }));
    else
      fireEvent.change(screen.getByRole("textbox", { name: `Answer to question ${index + 1}` }), {
        target: { value: raw[question.id] },
      });
  }
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("foundation diagnostic assessment", () => {
  it("starts an isolated fourth mode, suppresses all hints, and shows six limited-sample guidance rows without mastery credit", async () => {
    const oldKey = "brainhub:assessment:v2:linear-algebra:practice:some-lesson";
    localStorage.setItem(oldKey, "unrelated draft");
    const mock = mockApi();
    render(page());
    fireEvent.click(await screen.findByRole("button", { name: "Start diagnostic" }));
    await screen.findByRole("textbox", { name: "Answer to question 1" });
    expect(screen.getAllByRole("group", { name: /^Question \d+/ })).toHaveLength(12);
    expect(screen.getByText("0 of 12 answered · limited diagnostic sample")).toBeVisible();
    expect(screen.queryByText(/75% to pass/)).not.toBeInTheDocument();
    expect(screen.queryByText("Step-by-step hints")).not.toBeInTheDocument();
    expect(screen.queryByText("This cached hint must never be rendered.")).not.toBeInTheDocument();
    await answerAll();
    fireEvent.click(screen.getByRole("button", { name: "Submit diagnostic" }));
    expect(await screen.findByRole("heading", { name: "Diagnostic complete" })).toBeVisible();
    expect(screen.getByText("Sample accuracy: 50% · 6/12 correct")).toBeVisible();
    const guidance = screen.getByRole("list", { name: "Diagnostic topic guidance" });
    expect(within(guidance).getAllByRole("listitem")).toHaveLength(6);
    expect(within(guidance).getAllByText(/0\/2 in this sample/)).toHaveLength(2);
    expect(within(guidance).getAllByText(/2\/2 in this sample/)).toHaveLength(2);
    expect(
      screen.queryByText(/Assessment passed|Independent score:|Practice passed/),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Mastery progress entries")).toHaveTextContent("0");
    expect(localStorage.getItem(oldKey)).toBe("unrelated draft");
    const start = mock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/assessments") && init?.method === "POST",
    )!;
    expect(JSON.parse(String(start[1]?.body))).toMatchObject({ mode: "diagnostic", stage_index: 0 });
    expect(JSON.parse(String(start[1]?.body))).not.toHaveProperty("topic_slug");
    expect(mock.mock.calls.some(([url]) => String(url).includes("/hints"))).toBe(false);
    expect(mock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  });

  it("treats a perfect diagnostic as sample evidence rather than a qualification", async () => {
    const value = session({ state: "completed", questions: [], result: result([2, 2, 2, 2, 2, 2]) });
    mockApi({ opened: value });
    render(page(<AssessmentSessionViewer sessionId={id} />));
    expect(await screen.findByText("Sample accuracy: 100% · 12/12 correct")).toBeVisible();
    expect(screen.getAllByText(/2\/2 in this sample/)).toHaveLength(6);
    expect(screen.getByRole("heading", { name: "Foundation diagnostic", level: 1 })).toBeVisible();
    expect(
      screen.queryByText(/Assessment passed|Independent practice passed|Independent score:/),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start another session" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Mastery progress entries")).toHaveTextContent("0");
  });

  it("reuses the diagnostic start token after a lost response and restores raw mixed-format answers", async () => {
    const opened = session({
      draft: {
        answers: Object.entries(raw).map(([question_id, answer]) => ({ question_id, answer })),
        revision: 5,
        time_spent_seconds: 20,
      },
    });
    const mock = mockApi({ opened, failStart: true });
    const first = render(page());
    fireEvent.click(await screen.findByRole("button", { name: "Start diagnostic" }));
    await screen.findByText("The response was lost.");
    first.unmount();
    render(page());
    fireEvent.click(await screen.findByRole("button", { name: "Retry opening saved assignment" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue(
        raw[questions[0]!.id],
      ),
    );
    expect(screen.getByRole("textbox", { name: "Answer to question 2" })).toHaveValue(raw[questions[1]!.id]);
    const starts = mock.mock.calls.filter(
      ([url, init]) => String(url).endsWith("/assessments") && init?.method === "POST",
    );
    expect(starts).toHaveLength(2);
    expect(JSON.parse(String(starts[0]![1]?.body)).request_id).toBe(
      JSON.parse(String(starts[1]![1]?.body)).request_id,
    );
    expect(JSON.parse(localStorage.getItem(cacheKey)!).answers[questions[2]!.id]).toBe("[2,  1]");
  });

  it("recovers selected diagnostic raw answers and makes them read-only at the exact deadline", async () => {
    vi.useFakeTimers({
      toFake: ["Date", "performance", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
    const value = session({ expires_in_seconds: 1 });
    seed(value);
    mockApi({ opened: value });
    await act(async () => {
      render(page(<AssessmentSessionViewer sessionId={id} />));
    });
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue(raw[questions[0]!.id]);
    expect(screen.queryByText("Step-by-step hints")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const closed = screen.getByLabelText("Saved answers from closed assessment");
    expect(Array.from(closed.querySelectorAll("pre"), (item) => item.textContent)).toEqual(
      Object.values(raw),
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit diagnostic" })).not.toBeInTheDocument();
  });

  it("rejects an invalid diagnostic result with progress credit and preserves the current answers", async () => {
    seed();
    const invalid = {
      ...result(),
      progress: {
        roadmap_slug: "linear-algebra",
        topic_slug: topics[0],
        status: "completed",
        quiz_score: 100,
        quiz_attempts: 1,
        time_spent_seconds: 1,
        last_viewed_at: "2026-11-12T12:00:00Z",
        completed_at: "2026-11-12T12:00:00Z",
      },
    };
    mockApi({ graded: invalid });
    render(page());
    await screen.findByRole("textbox", { name: "Answer to question 1" });
    fireEvent.click(screen.getByRole("button", { name: "Submit diagnostic" }));
    expect(await screen.findByText(/The diagnostic result could not be verified/)).toBeVisible();
    expect(screen.getByLabelText("Mastery progress entries")).toHaveTextContent("0");
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue(raw[questions[0]!.id]);
    expect(screen.queryByRole("heading", { name: "Diagnostic complete" })).not.toBeInTheDocument();
  });

  it.each([
    "missing",
    "duplicate-topic",
    "wrong-count",
    "unknown-recommendation",
    "wrong-priority",
    "wrong-percentage",
  ])("rejects %s completed diagnostic metadata", (invalid) => {
    const value = structuredClone(result());
    if (invalid === "missing") delete value.diagnostic_summary;
    else if (invalid === "duplicate-topic")
      value.diagnostic_summary!.topics[1]!.topic_slug = value.diagnostic_summary!.topics[0]!.topic_slug;
    else if (invalid === "wrong-count") value.diagnostic_summary!.topics[0]!.correct = 2;
    else if (invalid === "unknown-recommendation")
      value.diagnostic_summary!.recommended_topics[0] = "unrelated-topic";
    else if (invalid === "wrong-priority") value.diagnostic_summary!.topics[0]!.priority = "verify";
    else value.score = 100;
    expect(validAssessmentResult(value, id, "diagnostic")).toBe(false);
  });
});
