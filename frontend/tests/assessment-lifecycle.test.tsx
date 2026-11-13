import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import type { AssessmentResult, AssessmentSession } from "@/lib/curriculum";

const topic = "vector-arithmetic-and-linear-combinations";
const key = `brainhub:assessment:v2:linear-algebra:practice:${topic}`;
const rawAnswers = { fraction: " 1 / 2 ", matrix: "1/2, sqrt(2); 3, 4", proof: "[2,  1]" };

function assessment(overrides: Partial<AssessmentSession> = {}): AssessmentSession {
  return {
    id: "lifecycle-session",
    mode: "practice",
    roadmap_slug: "linear-algebra",
    topic_slug: topic,
    expires_at: "2026-11-12T12:02:00Z",
    state: "active",
    server_now: "2026-11-12T12:00:00Z",
    expires_in_seconds: 120,
    questions_available: true,
    pass_score: 75,
    hint_usage: {},
    draft: { answers: [], time_spent_seconds: 0, revision: 0 },
    questions: [
      {
        id: "fraction",
        kind: "number",
        prompt: "Solve $2x=1$.",
        hints: [],
        hint_count: 2,
        concept: "Fraction",
        difficulty: "foundation",
        topic_slug: topic,
        lesson_title: "Vectors",
      },
      {
        id: "matrix",
        kind: "matrix",
        prompt: "Enter a two by two matrix.",
        hints: [],
        hint_count: 2,
        concept: "Matrix",
        difficulty: "core",
        topic_slug: topic,
        lesson_title: "Vectors",
      },
      {
        id: "proof",
        kind: "proof",
        prompt: "Order the additivity argument.",
        choices: ["Subtract the repeated term.", "Apply additivity."],
        hints: [],
        hint_count: 2,
        concept: "Proof",
        difficulty: "stretch",
        topic_slug: topic,
        lesson_title: "Vectors",
      },
    ],
    ...overrides,
  };
}

function result(): AssessmentResult {
  return {
    session_id: "lifecycle-session",
    mode: "practice",
    score: 100,
    passed: true,
    correct: 1,
    total: 1,
    progress: null,
    assistance: "independent",
    independent_score: 100,
    independent_passed: true,
    feedback: [
      {
        question_id: "fraction",
        prompt: "An archived original prompt.",
        concept: "Fraction",
        correct: true,
        submitted_answer: "1/2",
        expected_answer: 0.5,
        solution: "Archived stored explanation.",
        topic_slug: topic,
        hints_used: 0,
        assistance: "independent",
      },
    ],
  };
}

function seed(value: AssessmentSession, answers: Record<string, string> = {}, revision = 0) {
  localStorage.setItem(
    key,
    JSON.stringify({
      version: 2,
      sessionId: value.id,
      roadmapSlug: value.roadmap_slug,
      topicSlug: topic,
      stageIndex: 0,
      mode: "practice",
      answers,
      startedAt: Date.now(),
      revision,
      session: value,
    }),
  );
}

function response(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload };
}

function mockApi(value: unknown, offline = false, resumeDelay = 0) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/roadmaps/progress")) return response({ items: [], summary: {} });
    if (url.endsWith("/assessments/lifecycle-session")) {
      if (offline) throw new Error("Offline");
      if (resumeDelay) await new Promise((resolve) => window.setTimeout(resolve, resumeDelay));
      return response(value);
    }
    if (url.endsWith("/draft")) {
      if (offline) throw new Error("Offline");
      return response({ ...(value as AssessmentSession), draft: JSON.parse(String(init?.body)) });
    }
    throw new Error("Unexpected lifecycle request: " + url);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

async function mount() {
  let mounted!: ReturnType<typeof render>;
  await act(async () => {
    mounted = render(
      <RoadmapProgressProvider>
        <AssessmentPanel roadmapSlug="linear-algebra" topicSlug={topic} />
      </RoadmapProgressProvider>,
    );
  });
  return mounted;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({
    toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"],
  });
  vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("server-owned assessment lifecycle", () => {
  it.each(["2000-01-01T00:00:00Z", "2099-01-01T00:00:00Z"])(
    "uses server TTL with the client clock set to %s",
    async (clock) => {
      vi.setSystemTime(new Date(clock));
      const value = assessment();
      seed(value);
      mockApi(value);
      await mount();
      expect(screen.getByLabelText("Assessment time remaining")).toHaveTextContent("Time remaining: 2:00");
      expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toBeEnabled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(screen.getByLabelText("Assessment time remaining")).toHaveTextContent("Time remaining: 1:59");
      vi.setSystemTime(new Date("2050-01-01T00:00:00Z"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(screen.getByLabelText("Assessment time remaining")).toHaveTextContent("Time remaining: 1:58");
    },
  );

  it("closes at the timer deadline and preserves exact fraction, matrix, and proof strings for copying", async () => {
    const value = assessment({ expires_in_seconds: 1, expires_at: "2026-11-12T12:00:01Z" });
    seed(value, rawAnswers, 5);
    mockApi(value);
    await mount();
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue(rawAnswers.fraction);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toBeEnabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    const closed = screen.getByLabelText("Saved answers from closed assessment");
    expect(Array.from(closed.querySelectorAll("pre"), (item) => item.textContent)).toEqual(
      Object.values(rawAnswers),
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit practice" })).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(key)!);
    expect(stored.answers).toEqual(rawAnswers);
    expect(stored.session.state).toBe("expired");
  });

  it("subtracts response latency before starting the monotonic countdown", async () => {
    const value = assessment({ expires_in_seconds: 2, expires_at: "2026-11-12T12:00:02Z" });
    seed(value);
    mockApi(value, false, 1500);
    await mount();
    expect(screen.getByText("Checking for a saved assessment…")).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByLabelText("Assessment time remaining")).toHaveTextContent("Time remaining: 0:01");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toBeEnabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByLabelText("Saved answers from closed assessment")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps cached active expiry unconfirmed offline instead of restarting the old TTL", async () => {
    vi.setSystemTime(new Date("2099-01-01T00:00:00Z"));
    const value = assessment({ expires_in_seconds: 1, expires_at: "2026-11-12T12:00:01Z" });
    seed(value, rawAnswers, 5);
    mockApi(value, true);
    await mount();
    expect(screen.getByLabelText("Assessment time remaining")).toHaveTextContent(
      "Expiry time is unconfirmed while offline",
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue(rawAnswers.fraction);
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toBeEnabled();
    expect(screen.queryByLabelText("Saved answers from closed assessment")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Assessment time remaining")).toHaveTextContent("unconfirmed");
  });

  it("keeps an explicitly expired cached assignment read-only while offline", async () => {
    const value = assessment({ state: "expired", expires_in_seconds: 0 });
    seed(value, rawAnswers, 5);
    mockApi(value, true);
    await mount();
    const closed = screen.getByLabelText("Saved answers from closed assessment");
    expect(Array.from(closed.querySelectorAll("pre"), (item) => item.textContent)).toEqual(
      Object.values(rawAnswers),
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.queryByRole("button", { name: "Submit practice" })).not.toBeInTheDocument();
  });

  it("persists a server submission expiry so an offline remount cannot reopen the attempt", async () => {
    const value = assessment();
    seed(value, rawAnswers, 5);
    let offline = false;
    const mock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/roadmaps/progress")) return response({ items: [], summary: {} });
      if (url.endsWith("/assessments/lifecycle-session")) {
        if (offline) throw new Error("Offline");
        return response(value);
      }
      if (url.endsWith("/submit"))
        return { ok: false, status: 410, json: async () => ({ detail: "This assessment has expired." }) };
      throw new Error("Unexpected lifecycle expiry request: " + url);
    });
    vi.stubGlobal("fetch", mock);
    const first = await mount();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    });
    expect(screen.getByLabelText("Saved answers from closed assessment")).toBeVisible();
    const stored = JSON.parse(localStorage.getItem(key)!);
    expect(stored.session.state).toBe("expired");
    expect(stored.answers).toEqual(rawAnswers);
    expect(mock.mock.calls.some(([url]) => String(url).endsWith("/submit"))).toBe(true);

    first.unmount();
    offline = true;
    await mount();
    const closed = screen.getByLabelText("Saved answers from closed assessment");
    expect(Array.from(closed.querySelectorAll("pre"), (item) => item.textContent)).toEqual(
      Object.values(rawAnswers),
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit practice" })).not.toBeInTheDocument();
  });

  it("recovers an archived completed result even when its question catalogue is empty", async () => {
    seed(assessment(), rawAnswers, 5);
    mockApi(
      assessment({
        state: "completed",
        questions: [],
        questions_available: false,
        expires_in_seconds: 0,
        result: result(),
      }),
    );
    await mount();
    expect(screen.getByText("100% · 1/1 correct")).toBeVisible();
    fireEvent.click(screen.getByText("Question 1: Correct · Fraction"));
    expect(screen.getByText("Archived stored explanation.")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit practice" })).not.toBeInTheDocument();
  });

  it.each(["wrong-result-owner", "malformed-result", "active-empty"])(
    "rejects %s rather than treating an empty assignment as completed",
    async (invalid) => {
      seed(assessment(), rawAnswers, 5);
      const closed = assessment({
        state: "completed",
        questions: [],
        questions_available: false,
        result: result(),
      });
      const value =
        invalid === "wrong-result-owner"
          ? { ...closed, result: { ...result(), session_id: "another-session" } }
          : invalid === "malformed-result"
            ? { ...closed, result: { ...result(), feedback: [] } }
            : { ...closed, state: "active", result: undefined };
      mockApi(value);
      await mount();
      expect(screen.queryByText("Archived stored explanation.")).not.toBeInTheDocument();
      expect(screen.queryByText("100% · 1/1 correct")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue(rawAnswers.fraction);
      expect(screen.getByText(/Your saved answers are still here/)).toBeVisible();
    },
  );

  it("preserves the server's frozen multiple-choice presentation and selected text through resume", async () => {
    const value = assessment({
      questions: [
        { ...assessment().questions[0]!, id: "choice", kind: "choice", choices: ["Zeta", "Alpha", "Beta"] },
      ],
      draft: { answers: [{ question_id: "choice", answer: "Beta" }], time_spent_seconds: 0, revision: 4 },
    });
    seed(value, { choice: "Beta" }, 4);
    mockApi(value);
    const first = await mount();
    const labels = () =>
      screen.getAllByRole("radio").map((radio) => radio.parentElement!.textContent?.trim());
    expect(labels()).toEqual(["Zeta", "Alpha", "Beta"]);
    expect(screen.getByRole("radio", { name: "Beta" })).toBeChecked();
    first.unmount();
    await mount();
    expect(labels()).toEqual(["Zeta", "Alpha", "Beta"]);
    expect(screen.getByRole("radio", { name: "Beta" })).toBeChecked();
    expect(within(screen.getByRole("group")).getAllByRole("radio")).toHaveLength(3);
  });
});
