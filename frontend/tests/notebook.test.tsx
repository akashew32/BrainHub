import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MistakeNotebook } from "@/components/roadmaps/mistake-notebook";
import type {
  ConceptMetrics,
  ConceptPerformance,
  NotebookDetail,
  NotebookEntry,
  NotebookPage,
  ReflectionNote,
} from "@/lib/curriculum";

let sequence = 0;
function entry(overrides: Partial<NotebookEntry> = {}): NotebookEntry {
  return {
    roadmap_slug: "linear-algebra",
    question_id: `notebook-${++sequence}`,
    topic_slug: "vector-arithmetic-and-linear-combinations",
    lesson_title: "Vector arithmetic",
    concept: "Vector coefficients",
    prompt: "Find the coefficient $c$ in $2c=1$.",
    status: "resolved",
    latest_outcome: "independent",
    first_flagged_at: "2026-11-11T23:55:00Z",
    last_attempt_at: "2026-11-12T00:05:00",
    last_attempt_id: 11,
    attempts: 2,
    incorrect_attempts: 1,
    assisted_attempts: 0,
    untracked_attempts: 1,
    independent_correct_attempts: 1,
    archived: false,
    practice_url: "/roadmaps/linear-algebra/vector-arithmetic-and-linear-combinations",
    has_note: false,
    note_preview: "",
    ...overrides,
  };
}
function note(text = "", revision = 0): ReflectionNote {
  return {
    text,
    revision,
    created_at: revision ? "2026-11-12T00:00:00Z" : null,
    updated_at: revision ? "2026-11-12T00:00:00Z" : null,
  };
}
function page(items: NotebookEntry[], cursor: string | null = null): NotebookPage {
  return { generated_at: "2026-11-12T00:05:00Z", items, next_cursor: cursor, snapshot_max_attempt_id: 11 };
}
function detail(value: NotebookEntry, reflection = note()): NotebookDetail {
  return {
    entry: value,
    note: reflection,
    history: {
      items: [
        {
          attempt_id: 11,
          session_id: "completed-session",
          mode: "practice",
          created_at: "2026-11-12T00:05:00Z",
          correct: false,
          hints_used: null,
          assistance: "untracked",
          prompt: "The historical prompt was $2c=1$.",
          concept: value.concept,
          submitted_answer: "2",
          expected_answer: 0.5,
          solution: "Historical explanation: divide both sides by two to obtain $c=1/2$.",
        },
      ],
      next_cursor: null,
      snapshot_max_attempt_id: 11,
    },
  };
}
const zero: ConceptMetrics = {
  answers: 0,
  correct: 0,
  incorrect: 0,
  accuracy: null,
  questions_seen: 0,
  independent: { answers: 0, correct: 0, accuracy: null },
  assisted: { answers: 0, correct: 0, accuracy: null },
  untracked: { answers: 0, correct: 0, accuracy: null },
};
const performance: ConceptPerformance = {
  generated_at: "2026-11-12T00:05:00Z",
  window: { days: 14, start_at: "2026-10-30T00:00:00Z", end_at: "2026-11-12T00:05:00Z", timezone: "UTC" },
  totals: zero,
  concepts: [],
  trend: [],
};
function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}
function mockNotebook({
  entries,
  list = async () => response(page(entries)),
  getDetail = async (slug, id) =>
    response(detail(entries.find((value) => value.roadmap_slug === slug && value.question_id === id)!)),
  save = async (body) => response(note(body.text, body.revision + 1)),
}: {
  entries: NotebookEntry[];
  list?: (params: URLSearchParams) => Promise<ReturnType<typeof response>>;
  getDetail?: (slug: string, id: string, cursor?: string) => Promise<ReturnType<typeof response>>;
  save?: (body: { text: string; revision: number }) => Promise<ReturnType<typeof response>>;
}) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/concept-performance")) return response(performance);
    if (url.pathname.endsWith("/notebook")) return list(url.searchParams);
    if (url.pathname.endsWith("/note") && init?.method === "PUT") return save(JSON.parse(String(init.body)));
    const match = url.pathname.match(/\/notebook\/([^/]+)\/([^/]+)$/);
    if (match)
      return getDetail(
        decodeURIComponent(match[1]!),
        decodeURIComponent(match[2]!),
        url.searchParams.get("cursor") ?? undefined,
      );
    throw new Error("Unexpected notebook request: " + url);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("mathematics notebook", () => {
  it("retains resolved entries and expands only the learner's completed feedback snapshots", async () => {
    const value = entry();
    const mock = mockNotebook({ entries: [value] });
    render(<MistakeNotebook />);
    fireEvent.click(await screen.findByRole("button", { name: "Open Vector coefficients notebook entry" }));
    const snapshots = await screen.findByRole("region", { name: "Completed attempt snapshots" });
    const summary = within(snapshots).getByText(/^Attempt 11/);
    fireEvent.click(summary);
    expect(summary).toHaveTextContent("Hint usage untracked");
    expect(within(snapshots).getByText(/Historical explanation: divide both sides/)).toBeVisible();
    expect(within(snapshots).getByText("Expected in this attempt:")).toHaveTextContent("0.5");
    expect(screen.getByText("Resolved · Linear Algebra")).toBeInTheDocument();
    expect(screen.getByText(/Last answered Nov 12, 2026, 12:05 AM UTC/)).toBeInTheDocument();
    expect(
      mock.mock.calls.every(([url]) => /\/(notebook|concept-performance)(\/|\?)/.test(String(url))),
    ).toBe(true);
  });

  it("saves a reflection through the real list/detail flow, preserves it through filtering, and reloads the server note", async () => {
    const value = entry();
    let saved = note();
    const mock = mockNotebook({
      entries: [value],
      list: async (params) => response(page(params.get("state") === "unresolved" ? [] : [value])),
      getDetail: async () => response(detail(value, saved)),
      save: async (body) => {
        saved = note(body.text, body.revision + 1);
        return response(saved);
      },
    });
    const first = render(<MistakeNotebook />);
    fireEvent.click(await screen.findByRole("button", { name: "Open Vector coefficients notebook entry" }));
    const editor = await screen.findByRole("textbox", { name: "Reflection for Vector coefficients" });
    fireEvent.change(editor, {
      target: { value: "Divide the coefficient rather than multiply.\nCheck with 2(1/2)=1." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    await screen.findByText("Reflection saved to your profile (revision 1).");
    const put = mock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ text: saved.text, revision: 0 });
    fireEvent.change(screen.getByRole("combobox", { name: "Notebook status" }), {
      target: { value: "unresolved" },
    });
    await screen.findByText(/No notebook entries match these filters/);
    expect(screen.getByRole("textbox")).toHaveValue(saved.text);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: saved.text + "\nUnfinished local thought" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Notebook subject" }), {
      target: { value: "probability" },
    });
    await waitFor(() =>
      expect(mock.mock.calls.some(([url]) => String(url).includes("roadmap_slug=probability"))).toBe(true),
    );
    expect(screen.getByRole("textbox")).toHaveValue(saved.text + "\nUnfinished local thought");
    first.unmount();
    render(<MistakeNotebook />);
    fireEvent.click(await screen.findByRole("button", { name: "Open Vector coefficients notebook entry" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox")).toHaveValue(saved.text + "\nUnfinished local thought"),
    );
    expect(screen.getByText("Unsaved reflection restored from this device.")).toBeInTheDocument();
  });

  it("paginates with opaque cursors and resets the cursor when a server filter changes", async () => {
    const first = entry();
    const second = entry({ concept: "Second page concept" });
    const mock = mockNotebook({
      entries: [first, second],
      list: async (params) =>
        response(params.get("cursor") ? page([second]) : page([first], "opaque-next-page")),
    });
    render(<MistakeNotebook />);
    fireEvent.click(await screen.findByRole("button", { name: "Next notebook page" }));
    await screen.findByRole("button", { name: "Open Second page concept notebook entry" });
    expect(
      screen.queryByRole("button", { name: "Open Vector coefficients notebook entry" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Notebook status" }), {
      target: { value: "resolved" },
    });
    await screen.findByRole("button", { name: "Open Vector coefficients notebook entry" });
    const requests = mock.mock.calls
      .map(([url]) => new URL(String(url)))
      .filter((url) => url.pathname.endsWith("/notebook"));
    expect(requests[1]?.searchParams.get("cursor")).toBe("opaque-next-page");
    expect(requests.at(-1)?.searchParams.get("state")).toBe("resolved");
    expect(requests.at(-1)?.searchParams.has("cursor")).toBe(false);
    expect(screen.getByRole("button", { name: "Previous notebook page" })).toBeDisabled();
  });

  it("ignores an older list response after changing subject", async () => {
    const old = entry();
    const current = entry({ roadmap_slug: "probability", concept: "Probability-only concept" });
    let resolve!: (value: ReturnType<typeof response>) => void;
    mockNotebook({
      entries: [old, current],
      list: (params) =>
        params.get("roadmap_slug") === "probability"
          ? Promise.resolve(response(page([current])))
          : new Promise((done) => {
              resolve = done;
            }),
    });
    render(<MistakeNotebook />);
    fireEvent.change(screen.getByRole("combobox", { name: "Notebook subject" }), {
      target: { value: "probability" },
    });
    await screen.findByRole("button", { name: "Open Probability-only concept notebook entry" });
    await act(async () => resolve(response(page([old]))));
    expect(
      screen.queryByRole("button", { name: "Open Vector coefficients notebook entry" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open Probability-only concept notebook entry" }),
    ).toBeInTheDocument();
  });

  it("ignores an older detail response after selecting a different question", async () => {
    const first = entry();
    const second = entry({ concept: "Second question" });
    let resolve!: (value: ReturnType<typeof response>) => void;
    mockNotebook({
      entries: [first, second],
      getDetail: async (_slug, id) =>
        id === first.question_id
          ? new Promise((done) => {
              resolve = done;
            })
          : response(detail(second, note("Second question reflection", 1))),
    });
    render(<MistakeNotebook />);
    fireEvent.click(await screen.findByRole("button", { name: "Open Vector coefficients notebook entry" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Second question notebook entry" }));
    expect(await screen.findByRole("textbox")).toHaveValue("Second question reflection");
    await act(async () => resolve(response(detail(first, note("Wrong prior context", 3)))));
    expect(screen.getByRole("textbox")).toHaveValue("Second question reflection");
    expect(
      screen.queryByRole("region", { name: "Notebook entry: Vector coefficients" }),
    ).not.toBeInTheDocument();
  });

  it("loads older snapshots without replacing an in-progress reflection or duplicating attempts", async () => {
    const value = entry();
    const initial = detail(value);
    initial.history.next_cursor = "older-history";
    const older = detail(value, note("Newer server note must not overwrite editor", 7));
    older.history.items = [
      ...older.history.items,
      { ...older.history.items[0]!, attempt_id: 10, solution: "Older preserved explanation" },
    ];
    mockNotebook({
      entries: [value],
      getDetail: async (_slug, _id, cursor) => response(cursor ? older : initial),
    });
    render(<MistakeNotebook />);
    fireEvent.click(await screen.findByRole("button", { name: "Open Vector coefficients notebook entry" }));
    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: "Keep the raw local reflection" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load older attempts" }));
    await screen.findByText(/^Attempt 10/);
    expect(screen.getAllByText(/^Attempt 11/)).toHaveLength(1);
    expect(screen.getByRole("textbox")).toHaveValue("Keep the raw local reflection");
  });

  it("marks archived history and withholds a practice link while retaining readable feedback", async () => {
    const value = entry({ archived: true, practice_url: null });
    mockNotebook({ entries: [value] });
    render(<MistakeNotebook />);
    fireEvent.click(await screen.findByRole("button", { name: "Open Vector coefficients notebook entry" }));
    await screen.findByText(/Archived question. Practice is unavailable/);
    expect(screen.queryByRole("link", { name: "Open lesson practice" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeEnabled();
    expect(screen.getByText(/^Attempt 11/)).toBeInTheDocument();
  });

  it("retries an initial list failure without replacing existing notebook state with an empty success", async () => {
    const value = entry();
    let requests = 0;
    mockNotebook({
      entries: [value],
      list: async () =>
        ++requests === 1 ? response({ detail: "Notebook unavailable" }, 503) : response(page([value])),
    });
    render(<MistakeNotebook />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Notebook unavailable");
    expect(screen.queryByText(/No notebook entries match/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry notebook" }));
    await screen.findByRole("button", { name: "Open Vector coefficients notebook entry" });
    expect(requests).toBe(2);
  });

  it("keeps question identity separate when subjects reuse the same question id", async () => {
    const first = entry({ question_id: "shared-id" });
    const second = entry({
      question_id: "shared-id",
      roadmap_slug: "probability",
      concept: "Probability identity",
    });
    mockNotebook({ entries: [first, second] });
    render(<MistakeNotebook />);
    fireEvent.click(await screen.findByRole("button", { name: "Open Probability identity notebook entry" }));
    expect(
      await screen.findByRole("region", { name: "Notebook entry: Probability identity" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("textbox", { name: "Reflection for Probability identity" })).toBeEnabled();
  });
});
