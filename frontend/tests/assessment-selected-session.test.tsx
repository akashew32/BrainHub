import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import type { AssessmentSession } from "@/lib/curriculum";

const first = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";
const topic = "vector-arithmetic-and-linear-combinations";
const base = `brainhub:assessment:v2:linear-algebra:practice:${topic}`;
const selectedKey = base + ":session-" + first;
function session(id = first): AssessmentSession {
  return {
    id,
    mode: "practice",
    roadmap_slug: "linear-algebra",
    topic_slug: topic,
    stage_index: 0,
    expires_at: "2099-01-01T00:00:00Z",
    state: "active",
    server_now: "2026-11-12T12:00:00Z",
    expires_in_seconds: 7200,
    pass_score: 75,
    hint_usage: {},
    draft: { answers: [{ question_id: "fraction", answer: "1/2" }], revision: 3, time_spent_seconds: 10 },
    questions: [
      {
        id: "fraction",
        kind: "number",
        prompt: "Solve $2x=1$.",
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
function draft(value: AssessmentSession, text: string, revision: number) {
  return JSON.stringify({
    version: 2,
    sessionId: value.id,
    roadmapSlug: value.roadmap_slug,
    topicSlug: value.topic_slug,
    stageIndex: 0,
    mode: value.mode,
    answers: { fraction: text },
    startedAt: Date.now(),
    revision,
    session: value,
  });
}
function response(value: unknown) {
  return { ok: true, status: 200, json: async () => value };
}
function mockApi(value: AssessmentSession) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/roadmaps/progress")) return response({ items: [], summary: {} });
    if (url.endsWith("/assessments/" + value.id)) return response(value);
    if (url.endsWith("/draft")) return response({ ...value, draft: JSON.parse(String(init?.body)) });
    if (url.endsWith("/submit")) {
      const body = JSON.parse(String(init?.body));
      return response({
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
            prompt: "Solve $2x=1$.",
            concept: "Fractions",
            correct: true,
            submitted_answer: body.answers[0].answer,
            expected_answer: 0.5,
            solution: "Divide by two.",
            topic_slug: topic,
          },
        ],
      });
    }
    throw new Error("Unexpected selected-session request: " + url);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
function mount(value: AssessmentSession, selected = true) {
  return render(
    <RoadmapProgressProvider>
      <AssessmentPanel
        roadmapSlug={value.roadmap_slug}
        topicSlug={value.topic_slug ?? undefined}
        mode={value.mode}
        stageIndex={value.stage_index ?? 0}
        selectedSession={selected ? value : undefined}
        selectedReceivedAt={performance.now()}
      />
    </RoadmapProgressProvider>,
  );
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("explicitly selected assessment workspace", () => {
  it("opens the selected server draft without fetching it again or replacing a different same-topic draft", async () => {
    const value = session();
    const unrelated = draft(session(second), "UNRELATED raw draft", 99);
    localStorage.setItem(base, unrelated);
    const mock = mockApi(value);
    mount(value);
    const input = await screen.findByRole("textbox", { name: "Answer to question 1" });
    await waitFor(() => expect(input).toHaveValue("1/2"));
    expect(localStorage.getItem(base)).toBe(unrelated);
    expect(JSON.parse(localStorage.getItem(selectedKey)!).sessionId).toBe(first);
    fireEvent.change(input, { target: { value: " 3 / 7 " } });
    expect(localStorage.getItem(base)).toBe(unrelated);
    expect(JSON.parse(localStorage.getItem(selectedKey)!).answers.fraction).toBe(" 3 / 7 ");
    expect(mock.mock.calls.filter(([url]) => String(url).endsWith("/assessments/" + first))).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    await screen.findByText("100% · 1/1 correct");
    const submits = mock.mock.calls.filter(([url]) => String(url).endsWith("/submit"));
    expect(submits).toHaveLength(1);
    expect(String(submits[0]![0])).toContain("/assessments/" + first + "/submit");
    expect(JSON.parse(String(submits[0]![1]?.body)).answers).toEqual([
      { question_id: "fraction", answer: " 3 / 7 " },
    ]);
    expect(localStorage.getItem(base)).toBe(unrelated);
    expect(screen.queryByRole("button", { name: "Start another session" })).not.toBeInTheDocument();
  });

  it("uses the newest raw matching-ID draft and safely mirrors it to a matching lesson cache", async () => {
    const value = session();
    localStorage.setItem(base, draft(value, "older matching text", 8));
    localStorage.setItem(selectedKey, draft(value, " sqrt(2) / 2 ", 9));
    mockApi(value);
    mount(value);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue(" sqrt(2) / 2 "),
    );
    expect(JSON.parse(localStorage.getItem(base)!).answers.fraction).toBe(" sqrt(2) / 2 ");
    expect(JSON.parse(localStorage.getItem(selectedKey)!).answers.fraction).toBe(" sqrt(2) / 2 ");
  });

  it("recovers newer matching selected-session text when returning to the regular lesson workspace", async () => {
    const value = session();
    localStorage.setItem(base, draft(value, "older base", 4));
    localStorage.setItem(selectedKey, draft(value, " 7 / 9 ", 6));
    mockApi(value);
    mount(value, false);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue(" 7 / 9 "),
    );
    expect(JSON.parse(localStorage.getItem(base)!).answers.fraction).toBe(" 7 / 9 ");
  });

  it("keeps selected-session answer edits through an ordinary parent render", async () => {
    const value = session();
    mockApi(value);
    const view = mount(value);
    const input = await screen.findByRole("textbox", { name: "Answer to question 1" });
    fireEvent.change(input, { target: { value: "raw 11 / 13" } });
    await act(async () => {
      view.rerender(
        <RoadmapProgressProvider>
          <AssessmentPanel
            roadmapSlug={value.roadmap_slug}
            topicSlug={topic}
            selectedSession={value}
            selectedReceivedAt={0}
          />
        </RoadmapProgressProvider>,
      );
    });
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue("raw 11 / 13");
  });
});
