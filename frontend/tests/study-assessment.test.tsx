import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentPanel, publicSession } from "@/components/roadmaps/assessment-panel";
import { AssessmentSessionViewer } from "@/components/roadmaps/assessment-session-viewer";
import { RoadmapProgressProvider, useRoadmapProgress } from "@/components/roadmaps/roadmap-progress-provider";
import { validAssessmentResult } from "@/lib/assessment-recovery";
import type { AssessmentResult, AssessmentSession } from "@/lib/curriculum";

const id = "00000000-0000-4000-8000-000000000011";
const key = "brainhub:assessment:v2:linear-algebra:study:stage-0";
function session(budget = 10): AssessmentSession {
  return {
    id,
    mode: "study",
    roadmap_slug: "linear-algebra",
    topic_slug: null,
    state: "active",
    stage_index: 0,
    expires_at: "2099-01-01T00:00:00Z",
    server_now: "2026-11-12T12:00:00Z",
    expires_in_seconds: 7200,
    pass_score: 75,
    hint_usage: {},
    study_plan: {
      version: 1,
      budget_minutes: budget,
      preferences_revision: 2,
      estimated_seconds: 300,
      question_count: 3,
      reason_counts: { due: 1, weak: 1, next: 1 },
      notice: "A personal mix selected for this study session.",
    },
    draft: { answers: [], revision: 0, time_spent_seconds: 0, time_recording: null },
    questions: ["due", "weak", "next"].map((code, index) => ({
      id: `study-practice-${index}`,
      kind: index === 1 ? "matrix" : index === 2 ? "proof" : "number",
      prompt: `Frozen study question ${index}.`,
      hints: [],
      hint_count: 1,
      concept: `Concept ${index}`,
      difficulty: "core",
      topic_slug: `lesson-${index}`,
      lesson_title: `Lesson ${index}`,
      ...(index === 2 ? { choices: ["Conclude.", "Apply additivity."] } : {}),
      selection_reason: {
        code: code as "due" | "weak" | "next",
        text: `Selected for ${code} practice`,
        estimated_seconds: 100,
      },
    })),
  };
}
const raw = {
  "study-practice-0": " 1 / 2 ",
  "study-practice-1": "1/2, sqrt(2);3,4",
  "study-practice-2": "[2,  1]",
};
function result(): AssessmentResult {
  return {
    session_id: id,
    mode: "study",
    score: 67,
    correct: 2,
    total: 3,
    passed: false,
    progress: null,
    recorded_seconds: 3,
    study_summary: {
      version: 1,
      correct: 2,
      total: 3,
      notice: "This mixed set guides further practice and does not complete a lesson.",
      reason_counts: { due: 1, weak: 1, next: 1 },
    },
    feedback: session().questions.map((question, index) => ({
      question_id: question.id,
      prompt: question.prompt,
      topic_slug: question.topic_slug,
      concept: question.concept,
      correct: index !== 1,
      hints_used: index === 1 ? 1 : 0,
      assistance: index === 1 ? "assisted" : "independent",
      submitted_answer: Object.values(raw)[index],
      expected_answer: 1,
      solution: "Apply the definition carefully.",
    })),
  };
}
function response(value: unknown, status = 200) {
  return { ok: status === 200, status, json: async () => value };
}
function mockApi({
  opened = session(),
  failStart = false,
}: { opened?: AssessmentSession; failStart?: boolean } = {}) {
  let starts = 0;
  const request = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/roadmaps/progress")) return response({ items: [], summary: {} });
    if (url.endsWith("/assessments") && init?.method === "POST") {
      starts += 1;
      if (failStart && starts === 1) throw new Error("Start response lost");
      const body = JSON.parse(String(init.body));
      return response({
        ...opened,
        study_plan: { ...opened.study_plan, budget_minutes: body.budget_minutes ?? 10 },
        request_id: body.request_id,
      });
    }
    if (url.endsWith("/assessments/" + id)) return response(opened);
    if (url.includes("/hints"))
      return response({
        question_id: "study-practice-1",
        hint_count: 1,
        hints_used: 1,
        hints: ["Scale each matrix entry separately."],
        hint_usage: { "study-practice-1": 1 },
        assistance: "assisted",
      });
    if (url.endsWith("/draft")) return response({ ...opened, draft: JSON.parse(String(init?.body)) });
    if (url.endsWith("/submit")) return response(result());
    throw new Error("Unexpected study request: " + url);
  });
  vi.stubGlobal("fetch", request);
  return request;
}
function ProgressProbe() {
  return <output aria-label="Mastery entries">{useRoadmapProgress().items.length}</output>;
}
function page(budget = 10, child?: React.ReactNode) {
  return (
    <RoadmapProgressProvider>
      <ProgressProbe />
      {child ?? <AssessmentPanel roadmapSlug="linear-algebra" mode="study" budgetMinutes={budget} />}
    </RoadmapProgressProvider>
  );
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("personal guided study sessions", () => {
  it("starts a variable-sized personal set, supports recorded hints, and reports neutral study feedback", async () => {
    const request = mockApi();
    render(page());
    fireEvent.click(await screen.findByRole("button", { name: "Start study" }));
    await screen.findByRole("textbox", { name: "Answer to question 1" });
    expect(screen.getByText("0 of 3 answered · guided study practice")).toBeVisible();
    expect(screen.queryByText(/75% to pass|limited diagnostic sample/)).not.toBeInTheDocument();
    expect(screen.getByText("3 questions · estimated 5 minutes · 10-minute budget")).toBeVisible();
    expect(screen.getByText(/Selected for weak practice/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reveal hint 1 for question 2" }));
    expect(await screen.findByText("Scale each matrix entry separately.")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Answer to question 1" }), {
      target: { value: raw["study-practice-0"] },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Answer to question 2" }), {
      target: { value: raw["study-practice-1"] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add step 2 to proof" }));
    fireEvent.click(screen.getByRole("button", { name: "Add step 1 to proof" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit study" }));
    expect(await screen.findByRole("heading", { name: "Study set complete" })).toBeVisible();
    expect(screen.getByText("Practice accuracy: 67% · 2/3 correct")).toBeVisible();
    expect(screen.getByText("2 independently correct · 1 answer with hints")).toBeVisible();
    expect(
      screen.queryByText(/Diagnostic complete|Assessment passed|Independent score:/),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Mastery entries")).toHaveTextContent("0");
    const start = request.mock.calls.find(
      ([url, init]) => String(url).endsWith("/assessments") && init?.method === "POST",
    )!;
    expect(JSON.parse(String(start[1]?.body))).toMatchObject({
      mode: "study",
      budget_minutes: 10,
      stage_index: 0,
    });
    expect(JSON.parse(String(start[1]?.body))).not.toHaveProperty("topic_slug");
    expect(request.mock.calls.some(([url]) => String(url).includes("exam-readiness"))).toBe(false);
  });

  it("does not reuse a pending start token when the explicitly selected raw budget changes", async () => {
    const request = mockApi({ failStart: true });
    const first = render(page(10));
    fireEvent.click(await screen.findByRole("button", { name: "Start study" }));
    await screen.findByText("Start response lost");
    first.unmount();
    render(page(15));
    fireEvent.click(await screen.findByRole("button", { name: "Start study" }));
    await screen.findByRole("textbox", { name: "Answer to question 1" });
    const starts = request.mock.calls.filter(
      ([url, init]) => String(url).endsWith("/assessments") && init?.method === "POST",
    );
    const bodies = starts.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies.map((body) => body.budget_minutes)).toEqual([10, 15]);
    expect(bodies[0].request_id).not.toBe(bodies[1].request_id);
  });

  it("recovers archived selected study feedback without diagnostic count assumptions", async () => {
    const opened = {
      ...session(),
      roadmap_slug: "archived-subject",
      state: "completed" as const,
      questions: [],
      result: result(),
    };
    mockApi({ opened });
    render(page(10, <AssessmentSessionViewer sessionId={id} />));
    expect(await screen.findByText("Practice accuracy: 67% · 2/3 correct")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Guided study practice", level: 1 })).toBeVisible();
    expect(screen.queryByText(/Diagnostic complete/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start another session" })).not.toBeInTheDocument();
  });

  it("preserves legacy raw answers when cached recording metadata is malformed", async () => {
    const value = session();
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 2,
        sessionId: id,
        roadmapSlug: "linear-algebra",
        topicSlug: null,
        stageIndex: 0,
        mode: "study",
        answers: raw,
        revision: 5,
        startedAt: 0,
        session: value,
        time_recording: { version: 1, intervals: "invalid" },
      }),
    );
    mockApi();
    render(page());
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue(
        raw["study-practice-0"],
      ),
    );
    expect(screen.getByRole("textbox", { name: "Answer to question 2" })).toHaveValue(
      raw["study-practice-1"],
    );
    expect(JSON.parse(localStorage.getItem(key)!).answers).toEqual(raw);
  });

  it.each(["progress", "wrong-total", "wrong-reasons", "wrong-score"])(
    "rejects %s study result metadata",
    (invalid) => {
      const value = structuredClone(result());
      if (invalid === "progress") value.progress = {} as NonNullable<AssessmentResult["progress"]>;
      else if (invalid === "wrong-total") value.study_summary!.total = 12;
      else if (invalid === "wrong-reasons") value.study_summary!.reason_counts.due = 4;
      else value.score = 100;
      expect(validAssessmentResult(value, id, "study")).toBe(false);
    },
  );

  it("agrees with server rounding at an exact half-percent boundary", () => {
    const value = result();
    value.total = 8;
    value.correct = 1;
    value.score = 12;
    value.study_summary = {
      version: 1,
      notice: "Practice only",
      total: 8,
      correct: 1,
      reason_counts: { due: 0, weak: 0, next: 8 },
    };
    value.feedback = Array.from({ length: 8 }, (_, index) => ({
      ...value.feedback[0]!,
      question_id: "rounding-" + index,
      correct: index === 0,
    }));
    expect(validAssessmentResult(value, id, "study")).toBe(true);
    value.score = 13;
    expect(validAssessmentResult(value, id, "study")).toBe(false);
  });

  it("rejects a malformed frozen study plan before mounting controls", () => {
    const value = session();
    value.study_plan!.reason_counts.due = 10;
    expect(publicSession(value)).toBe(false);
  });
});
