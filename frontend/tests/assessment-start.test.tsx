import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import type { AssessmentResult, AssessmentSession } from "@/lib/curriculum";
import { UUID_PATTERN } from "@/lib/assessment-recovery";

type StartBody = {
  mode: "practice" | "exam" | "review";
  topic_slug?: string;
  stage_index: number;
  request_id: string;
};
const topic = "vector-arithmetic-and-linear-combinations";
const scope = `brainhub:assessment:v2:linear-algebra:practice:${topic}`;
const intentKey = scope.replace("brainhub:assessment:v2:", "brainhub:assessment-start:v1:");
function assignment(body: StartBody, id = "assigned-session"): AssessmentSession {
  return {
    id,
    mode: body.mode,
    roadmap_slug: "linear-algebra",
    topic_slug: body.topic_slug ?? null,
    pass_score: 75,
    expires_at: "2026-11-12T02:00:00Z",
    server_now: "2026-11-12T00:00:00Z",
    expires_in_seconds: 120,
    state: "active",
    questions_available: true,
    request_id: body.request_id,
    hint_usage: {},
    questions: [
      {
        id: "coefficient",
        kind: "number",
        prompt: "Solve $2x=1$.",
        hints: [],
        hint_count: 2,
        concept: "Scalar coefficient",
        difficulty: "foundation",
        topic_slug: topic,
        lesson_title: "Vector arithmetic",
      },
    ],
  };
}
function completed(session: AssessmentSession): AssessmentResult {
  return {
    session_id: session.id,
    mode: session.mode,
    score: 100,
    passed: true,
    correct: 1,
    total: 1,
    progress: null,
    feedback: [
      {
        question_id: "coefficient",
        prompt: "Solve $2x=1$.",
        concept: "Scalar coefficient",
        correct: true,
        submitted_answer: "1/2",
        expected_answer: 0.5,
        solution: "Divide by two.",
        topic_slug: topic,
      },
    ],
  };
}
function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}
function mockApi(start: (body: StartBody) => Promise<ReturnType<typeof response>>) {
  let current: AssessmentSession | null = null;
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/progress")) return response({ items: [], summary: {} });
    if (url.endsWith("/assessments") && init?.method === "POST") {
      const result = await start(JSON.parse(String(init.body)) as StartBody);
      if (result.ok) current = (await result.json()) as AssessmentSession;
      return result;
    }
    if (url.endsWith("/draft")) return response({ ...current, draft: JSON.parse(String(init?.body)) });
    if (url.endsWith("/submit") && current) return response(completed(current));
    if (current && url.endsWith("/" + current.id)) return response(current);
    throw new Error("Unexpected start recovery request: " + url);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
function panel({
  topicSlug = topic,
  mode = "practice",
  examAvailable = false,
}: { topicSlug?: string; mode?: "practice" | "exam"; examAvailable?: boolean } = {}) {
  return (
    <RoadmapProgressProvider>
      <AssessmentPanel
        roadmapSlug="linear-algebra"
        topicSlug={mode === "practice" ? topicSlug : undefined}
        mode={mode}
        examAvailable={examAvailable}
      />
    </RoadmapProgressProvider>
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

describe("recoverable assessment start intents", () => {
  it("persists the UUID before POST and reuses it after a lost response without erasing replayed answers", async () => {
    const bodies: StartBody[] = [];
    mockApi(async (body) => {
      expect(JSON.parse(localStorage.getItem(intentKey)!)).toMatchObject({
        version: 1,
        request_id: body.request_id,
        scope,
      });
      bodies.push(body);
      if (bodies.length === 1) throw new Error("Start response lost");
      return response({
        ...assignment(body),
        draft: {
          answers: [{ question_id: "coefficient", answer: "1/" }],
          revision: 3,
          time_spent_seconds: 12,
        },
      });
    });
    render(panel());
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry opening saved assignment" }));
    await readyEditor("1/");
    expect(bodies[0]!.request_id).toMatch(UUID_PATTERN);
    expect(bodies[1]!.request_id).toBe(bodies[0]!.request_id);
    expect(localStorage.getItem(intentKey)).toBeNull();
    expect(JSON.parse(localStorage.getItem(scope)!)).toMatchObject({
      sessionId: "assigned-session",
      revision: 3,
      answers: { coefficient: "1/" },
      session: { request_id: bodies[0]!.request_id },
    });
  });

  it("recovers the same pending start after a page remount and waits for a deliberate retry", async () => {
    const bodies: StartBody[] = [];
    mockApi(async (body) => {
      bodies.push(body);
      if (bodies.length === 1) throw new Error("Offline");
      return response(assignment(body));
    });
    const first = render(panel());
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    await screen.findByRole("alert");
    first.unmount();
    render(panel());
    const retry = await screen.findByRole("button", { name: "Retry opening saved assignment" });
    expect(bodies).toHaveLength(1);
    fireEvent.click(retry);
    await readyEditor("");
    expect(bodies).toHaveLength(2);
    expect(bodies[1]!.request_id).toBe(bodies[0]!.request_id);
  });

  it("isolates pending tokens by lesson scope and restores the original token when returning", async () => {
    const bodies: StartBody[] = [];
    mockApi(async (body) => {
      bodies.push(body);
      throw new Error("Offline");
    });
    const rendered = render(panel());
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    await screen.findByRole("alert");
    rendered.rerender(panel({ topicSlug: "matrix-arithmetic" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    await screen.findByRole("alert");
    rendered.rerender(panel());
    fireEvent.click(await screen.findByRole("button", { name: "Retry opening saved assignment" }));
    await screen.findByRole("alert");
    expect(bodies[0]!.request_id).not.toBe(bodies[1]!.request_id);
    expect(bodies[2]!.request_id).toBe(bodies[0]!.request_id);
    expect(bodies.map((body) => body.topic_slug)).toEqual([topic, "matrix-arithmetic", topic]);
  });

  it("allows pending exam recovery after fresh-exam eligibility changes", async () => {
    const bodies: StartBody[] = [];
    mockApi(async (body) => {
      bodies.push(body);
      if (bodies.length === 1) throw new Error("Response lost");
      return response(assignment(body));
    });
    const first = render(panel({ mode: "exam", examAvailable: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Start exam" }));
    await screen.findByRole("alert");
    first.unmount();
    render(panel({ mode: "exam", examAvailable: false }));
    const retry = await screen.findByRole("button", { name: "Retry opening saved assignment" });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    await readyEditor("");
    expect(screen.getByRole("button", { name: "Submit exam" })).toBeEnabled();
    expect(bodies[1]!.request_id).toBe(bodies[0]!.request_id);
  });

  it("creates a new intent for a deliberate next session after a confirmed completion", async () => {
    const bodies: StartBody[] = [];
    mockApi(async (body) => {
      bodies.push(body);
      return response(assignment(body, "assignment-" + bodies.length));
    });
    render(panel());
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    fireEvent.change(await readyEditor(""), { target: { value: "1/2" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    await screen.findByText("Practice passed. Your progress has been saved.");
    fireEvent.click(screen.getByRole("button", { name: "Start another session" }));
    await readyEditor("");
    expect(bodies).toHaveLength(2);
    expect(bodies[0]!.request_id).not.toBe(bodies[1]!.request_id);
    expect(bodies[1]!.request_id).toMatch(UUID_PATTERN);
  });

  it("does not clear another tab's newer intent after this assignment is confirmed", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    let firstBody!: StartBody;
    mockApi((body) => {
      firstBody = body;
      return new Promise((done) => {
        resolve = done;
      });
    });
    render(panel());
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    const other = { version: 1, scope, request_id: "11111111-1111-4111-8111-111111111111" };
    localStorage.setItem(intentKey, JSON.stringify(other));
    await act(async () => resolve(response(assignment(firstBody))));
    await readyEditor("");
    expect(JSON.parse(localStorage.getItem(intentKey)!)).toEqual(other);
  });

  it("retains the persisted intent when assignment storage fails", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    let firstBody!: StartBody;
    mockApi((body) => {
      firstBody = body;
      return new Promise((done) => {
        resolve = done;
      });
    });
    render(panel());
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === scope) throw new Error("Quota");
      original.call(this, key, value);
    });
    await act(async () => resolve(response(assignment(firstBody))));
    await readyEditor("");
    expect(JSON.parse(localStorage.getItem(intentKey)!).request_id).toBe(firstBody.request_id);
    expect(screen.getByText(/Device storage is unavailable. Keep this/)).toBeInTheDocument();
  });

  it("keeps retry identity in memory and explains storage failure honestly", async () => {
    const bodies: StartBody[] = [];
    mockApi(async (body) => {
      bodies.push(body);
      if (bodies.length === 1) throw new Error("Offline");
      return response(assignment(body));
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    render(panel());
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    await screen.findByRole("alert");
    expect(screen.getByText(/Device storage is unavailable. Retry/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry opening saved assignment" }));
    await readyEditor("");
    expect(bodies[0]!.request_id).toBe(bodies[1]!.request_id);
  });

  it("rejects a response for a different request token and keeps the original recovery token", async () => {
    let body!: StartBody;
    mockApi(async (value) => {
      body = value;
      return response({ ...assignment(value), request_id: "22222222-2222-4222-8222-222222222222" });
    });
    render(panel());
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be opened");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(intentKey)!).request_id).toBe(body.request_id);
  });

  it("blocks duplicate pending starts and ignores their response after a scope change", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    let body!: StartBody;
    const mock = mockApi((value) => {
      body = value;
      return new Promise((done) => {
        resolve = done;
      });
    });
    const rendered = render(panel());
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    fireEvent.click(screen.getByRole("button", { name: "Preparing…" }));
    rendered.rerender(panel({ topicSlug: "matrix-arithmetic" }));
    await screen.findByRole("button", { name: "Start practice" });
    await act(async () => resolve(response(assignment(body))));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(mock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(intentKey)!).request_id).toBe(body.request_id);
  });
});
