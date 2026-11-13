import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentSessionViewer } from "@/components/roadmaps/assessment-session-viewer";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import type { AssessmentResult, AssessmentSession } from "@/lib/curriculum";

const first = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";
const topic = "vector-arithmetic-and-linear-combinations";
const base = `brainhub:assessment:v2:linear-algebra:practice:${topic}`;
function session(id = first, text = "1/2"): AssessmentSession {
  return {
    id,
    mode: "practice",
    roadmap_slug: "linear-algebra",
    topic_slug: topic,
    stage_index: 0,
    state: "active",
    expires_at: "2099-01-01T00:00:00Z",
    server_now: "2026-11-12T12:00:00Z",
    expires_in_seconds: 7200,
    pass_score: 75,
    hint_usage: {},
    draft: { answers: [{ question_id: "fraction", answer: text }], revision: 3, time_spent_seconds: 10 },
    questions: [
      {
        id: "fraction",
        kind: "number",
        prompt: "Frozen original question.",
        hints: [],
        hint_count: 2,
        concept: "Fractions",
        difficulty: "foundation",
        topic_slug: topic,
        lesson_title: "Frozen vectors",
      },
    ],
  };
}
function result(value: AssessmentSession): AssessmentResult {
  return {
    session_id: value.id,
    mode: value.mode,
    score: 100,
    passed: true,
    correct: 1,
    total: 1,
    progress: null,
    feedback: [
      {
        question_id: "fraction",
        prompt: "Archived original question.",
        concept: "Archived concept",
        correct: true,
        submitted_answer: "1/2",
        expected_answer: 0.5,
        solution: "The original archived explanation.",
        topic_slug: "retired-topic",
      },
    ],
  };
}
function response(value: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => value };
}
function cached(value: AssessmentSession, text: string, revision = 7) {
  return JSON.stringify({
    version: 2,
    sessionId: value.id,
    roadmapSlug: value.roadmap_slug,
    topicSlug: value.topic_slug,
    stageIndex: value.stage_index ?? 0,
    mode: value.mode,
    answers: { fraction: text },
    revision,
    startedAt: Date.now(),
    session: value,
  });
}
function api(get: (id: string) => Promise<ReturnType<typeof response>>) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/roadmaps/progress")) return response({ items: [], summary: {} });
    if (url.pathname.endsWith("/submit")) {
      const id = url.pathname.split("/").at(-2)!;
      return response(result({ ...session(id), mode: "exam", topic_slug: null }));
    }
    if (url.pathname.endsWith("/draft"))
      return response({ ...session(), draft: JSON.parse(String(init?.body)) });
    const id = url.pathname.match(/\/assessments\/([^/]+)$/)?.[1];
    if (id) return get(id);
    throw new Error("Unexpected viewer request: " + url);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
function viewer(id = first) {
  return (
    <RoadmapProgressProvider>
      <AssessmentSessionViewer sessionId={id} />
    </RoadmapProgressProvider>
  );
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saved assessment session viewer", () => {
  it("opens a server-owned draft by its ID with no device storage and a single resource GET", async () => {
    const mock = api(async (id) => response(session(id, "server raw 1 / 2")));
    render(viewer());
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue("server raw 1 / 2"),
    );
    expect(screen.getByRole("heading", { name: "Frozen vectors" })).toBeVisible();
    expect(mock.mock.calls.filter(([url]) => String(url).endsWith("/assessments/" + first))).toHaveLength(1);
    expect(mock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("ignores a late response from the previously selected ID", async () => {
    let release!: (value: ReturnType<typeof response>) => void;
    api(async (id) =>
      id === first
        ? new Promise((resolve) => {
            release = resolve;
          })
        : response(session(id, "second-only answer")),
    );
    const view = render(viewer(first));
    view.rerender(viewer(second));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue("second-only answer"),
    );
    await act(async () => {
      release(response(session(first, "wrong previous answer")));
    });
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue("second-only answer");
    expect(screen.queryByDisplayValue("wrong previous answer")).not.toBeInTheDocument();
  });

  it("rejects a different resource ID rather than opening an unrelated response or draft", async () => {
    const unrelated = cached(session(second), "Unrelated device answer");
    localStorage.setItem(base, unrelated);
    api(async () => response(session(second)));
    render(viewer(first));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be verified");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(localStorage.getItem(base)).toBe(unrelated);
  });

  it("rejects malformed stored draft JSON before mounting answer controls", async () => {
    api(async () =>
      response({ ...session(), draft: { answers: { fraction: "invalid container" }, revision: 1 } }),
    );
    render(viewer());
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be verified");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("displays an archived completed result without depending on the current subject or lesson catalogue", async () => {
    const value = {
      ...session(),
      roadmap_slug: "retired-subject",
      topic_slug: "retired-topic",
      stage_index: 4,
    };
    const mock = api(async () =>
      response({
        ...value,
        state: "completed",
        questions: [],
        questions_available: false,
        result: result(value),
      }),
    );
    render(viewer());
    expect(await screen.findByText("100% · 1/1 correct")).toBeVisible();
    expect(screen.getByRole("heading", { name: "retired topic" })).toBeVisible();
    fireEvent.click(screen.getByText("Question 1: Correct · Archived concept"));
    expect(screen.getByText("The original archived explanation.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Start/ })).not.toBeInTheDocument();
    expect(mock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("resumes and submits an existing exam without requesting fresh-start eligibility", async () => {
    const value = { ...session(), mode: "exam" as const, topic_slug: null };
    const mock = api(async () => response(value));
    render(viewer());
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue("1/2"),
    );
    expect(screen.getByRole("heading", { name: "Stage 1 examination", level: 1 })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Submit exam" }));
    expect(await screen.findByText("100% · 1/1 correct")).toBeVisible();
    const posts = mock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(String(posts[0]![0])).toContain("/assessments/" + first + "/submit");
    expect(mock.mock.calls.some(([url]) => String(url).includes("exam-readiness"))).toBe(false);
    expect(screen.queryByRole("button", { name: "Start another session" })).not.toBeInTheDocument();
  });

  it("keeps an expired selected attempt readable without offering a new allocation under its URL", async () => {
    const mock = api(async () => response({ ...session(), state: "expired", expires_in_seconds: 0 }));
    render(viewer());
    const closed = await screen.findByLabelText("Saved answers from closed assessment");
    expect(closed.querySelector("pre")?.textContent).toBe("1/2");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start a fresh session" })).not.toBeInTheDocument();
    expect(mock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("does not use cached data after an ownership404 and can retry the exact selected ID", async () => {
    localStorage.setItem(base + ":session-" + first, cached(session(), "Cached selected answer"));
    let allowed = false;
    const mock = api(async () =>
      allowed ? response(session()) : response({ detail: "Unknown assessment" }, 404),
    );
    render(viewer());
    expect(await screen.findByRole("alert")).toHaveTextContent("not found in your profile");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    allowed = true;
    fireEvent.click(screen.getByRole("button", { name: "Retry selected assessment" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue(
        "Cached selected answer",
      ),
    );
    expect(mock.mock.calls.filter(([url]) => String(url).endsWith("/assessments/" + first))).toHaveLength(2);
  });

  it.each([409, 410])(
    "preserves only matching cached answers read-only after a legacy closure %s",
    async (status) => {
      const unrelated = cached(session(second), "Unrelated raw text", 99);
      localStorage.setItem(base, unrelated);
      const selectedKey = base + ":session-" + first;
      localStorage.setItem(selectedKey, cached(session(), " 11 / 17 ", 8));
      api(async () => response({ detail: "This legacy assignment is no longer open." }, status));
      render(viewer());
      const closed = await screen.findByLabelText("Saved answers from closed assessment");
      expect(closed.querySelector("pre")?.textContent).toBe(" 11 / 17 ");
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Submit practice" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Start a fresh session" })).not.toBeInTheDocument();
      expect(localStorage.getItem(base)).toBe(unrelated);
      expect(JSON.parse(localStorage.getItem(selectedKey)!).session.state).toBe("expired");
    },
  );

  it("uses only matching selected offline cache and keeps its newest raw text separate from another attempt", async () => {
    const unrelated = cached(session(second), "Other session raw text", 50);
    localStorage.setItem(base, unrelated);
    localStorage.setItem(base + ":session-" + first, cached(session(), " 7 / 11 ", 8));
    const mock = api(async () => {
      throw new Error("Offline");
    });
    render(viewer());
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue(" 7 / 11 "),
    );
    expect(screen.getByLabelText("Assessment time remaining")).toHaveTextContent("unconfirmed");
    expect(screen.getByText(/Offline copy of the selected assessment/)).toBeVisible();
    expect(localStorage.getItem(base)).toBe(unrelated);
    expect(mock.mock.calls.some(([url]) => String(url).includes(second))).toBe(false);
  });
});
