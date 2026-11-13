import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudyPreferencesEditor } from "@/components/roadmaps/study-preferences-editor";
import type { StudyPreferences } from "@/lib/curriculum";

let scopeIndex = 0;
function scope() {
  return "preferences-test-" + ++scopeIndex;
}
function preferences(goal = 20, budget = 15, revision = 0): StudyPreferences {
  return {
    goal_minutes: goal,
    session_minutes: budget,
    preferred_roadmap_slug: null,
    revision,
    updated_at: revision ? "2026-11-13T00:00:00Z" : null,
  };
}
function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}
function mockApi({
  get = async () => response(preferences()),
  save = async (body) =>
    response({ ...body, revision: body.revision + 1, updated_at: "2026-11-13T00:00:00Z" }),
}: {
  get?: () => Promise<ReturnType<typeof response>>;
  save?: (body: Omit<StudyPreferences, "updated_at">) => Promise<ReturnType<typeof response>>;
} = {}) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    expect(String(input)).toMatch(/\/roadmaps\/study-preferences$/);
    return init?.method === "PUT" ? save(JSON.parse(String(init.body))) : get();
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
async function goalInput(value?: string) {
  return waitFor(() => {
    const input = screen.getByRole("textbox", { name: "Daily goal in minutes" });
    expect(input).toBeEnabled();
    if (value !== undefined) expect(input).toHaveValue(value);
    return input;
  });
}
const budgetInput = () => screen.getByRole("textbox", { name: "Default session budget in minutes" });
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("revisioned study preferences", () => {
  it("loads defaults as server data without writing preferences on a page view", async () => {
    const mock = mockApi();
    render(<StudyPreferencesEditor storageScope={scope()} />);
    await goalInput("20");
    expect(budgetInput()).toHaveValue("15");
    expect(screen.getByRole("combobox", { name: "Preferred study subject" })).toHaveValue("");
    expect(mock.mock.calls.every(([, init]) => init?.method !== "PUT")).toBe(true);
    expect(screen.getByRole("button", { name: "Save study preferences" })).toBeDisabled();
  });

  it("saves the full validated form using the current revision", async () => {
    const onSaved = vi.fn();
    const mock = mockApi();
    render(<StudyPreferencesEditor storageScope={scope()} onSaved={onSaved} />);
    fireEvent.change(await goalInput("20"), { target: { value: "45" } });
    fireEvent.change(budgetInput(), { target: { value: "5" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Preferred study subject" }), {
      target: { value: "probability" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save study preferences" }));
    await screen.findByText("Study preferences saved (revision 1).");
    const put = mock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({
      goal_minutes: 45,
      session_minutes: 5,
      preferred_roadmap_slug: "probability",
      revision: 0,
    });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ goal_minutes: 45, session_minutes: 5, revision: 1 }),
    );
  });

  it("retains invalid partial input and restores it without clamping on remount", async () => {
    const storageScope = scope();
    const mock = mockApi();
    const first = render(<StudyPreferencesEditor storageScope={storageScope} />);
    fireEvent.change(await goalInput("20"), { target: { value: "" } });
    fireEvent.change(budgetInput(), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save study preferences" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("whole-number daily goal from 5 to 120");
    expect(mock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
    first.unmount();
    render(<StudyPreferencesEditor storageScope={storageScope} />);
    await goalInput("");
    expect(budgetInput()).toHaveValue("4");
  });

  it("keeps unsaved values on conflict and retries only after explicit latest-revision confirmation", async () => {
    let gets = 0;
    let saves = 0;
    const mock = mockApi({
      get: async () => response(++gets === 1 ? preferences() : preferences(25, 10, 2)),
      save: async (body) =>
        ++saves === 1
          ? response({ detail: "Preferences changed elsewhere" }, 409)
          : response({ ...body, revision: 3, updated_at: "2026-11-13T00:00:00Z" }),
    });
    render(<StudyPreferencesEditor storageScope={scope()} />);
    fireEvent.change(await goalInput("20"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Save study preferences" }));
    await screen.findByText("Saved preferences changed elsewhere");
    expect(screen.getByRole("textbox", { name: "Daily goal in minutes" })).toHaveValue("40");
    expect(
      screen.getByText(/Saved revision 2: 25-minute daily goal, 10-minute sessions/),
    ).toBeInTheDocument();
    expect(saves).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Save my edits using latest revision" }));
    await screen.findByText("Study preferences saved (revision 3).");
    expect(
      mock.mock.calls
        .filter(([, init]) => init?.method === "PUT")
        .map(([, init]) => JSON.parse(String(init?.body)).revision),
    ).toEqual([0, 2]);
  });

  it("replaces local edits with server values only after Use saved preferences", async () => {
    let gets = 0;
    mockApi({
      get: async () => response(++gets === 1 ? preferences() : preferences(30, 10, 2)),
      save: async () => response({ detail: "Conflict" }, 409),
    });
    render(<StudyPreferencesEditor storageScope={scope()} />);
    fireEvent.change(await goalInput("20"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Save study preferences" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use saved preferences" }));
    expect(screen.getByRole("textbox", { name: "Daily goal in minutes" })).toHaveValue("30");
    expect(budgetInput()).toHaveValue("10");
    expect(screen.getByRole("button", { name: "Save study preferences" })).toBeDisabled();
  });

  it("recovers an acknowledged same-content write after its response was lost", async () => {
    let gets = 0;
    mockApi({
      get: async () => response(++gets === 1 ? preferences() : preferences(40, 15, 1)),
      save: async () => {
        throw new Error("Response lost");
      },
    });
    render(<StudyPreferencesEditor storageScope={scope()} />);
    fireEvent.change(await goalInput("20"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Save study preferences" }));
    await screen.findByText("Study preferences saved (revision 1).");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save study preferences" })).toBeDisabled();
  });

  it("preserves newer edits when an earlier save finishes and blocks duplicate writes", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    const storageScope = scope();
    const mock = mockApi({
      save: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    render(<StudyPreferencesEditor storageScope={storageScope} />);
    fireEvent.change(await goalInput("20"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save study preferences" }));
    fireEvent.click(screen.getByRole("button", { name: "Saving preferences…" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Daily goal in minutes" }), {
      target: { value: "45" },
    });
    await act(async () => resolve(response(preferences(30, 15, 1))));
    expect(screen.getByRole("textbox", { name: "Daily goal in minutes" })).toHaveValue("45");
    expect(
      screen.getByText("Submitted preferences were saved. Your newer edits are still unsaved."),
    ).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(`brainhub:study-preferences:v1:${storageScope}`)!)).toMatchObject({
      values: { goal: "45" },
      base_revision: 1,
    });
    expect(mock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
  });

  it("keeps a newer memory draft when old disk values exist and subsequent writes fail", async () => {
    const storageScope = scope();
    mockApi();
    const first = render(<StudyPreferencesEditor storageScope={storageScope} />);
    fireEvent.change(await goalInput("20"), { target: { value: "30" } });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota");
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Daily goal in minutes" }), {
      target: { value: "45" },
    });
    expect(screen.getByText(/Device storage is unavailable/)).toBeInTheDocument();
    first.unmount();
    render(<StudyPreferencesEditor storageScope={storageScope} />);
    await goalInput("45");
  });

  it("ignores an older initial GET after a newer save was acknowledged", async () => {
    const storageScope = scope();
    localStorage.setItem(
      `brainhub:study-preferences:v1:${storageScope}`,
      JSON.stringify({
        version: 1,
        values: { goal: "40", budget: "10", subject: "" },
        base_revision: 0,
        updated_at: Date.now(),
      }),
    );
    let resolve!: (value: ReturnType<typeof response>) => void;
    mockApi({
      get: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    render(<StudyPreferencesEditor storageScope={storageScope} />);
    await goalInput("40");
    fireEvent.click(screen.getByRole("button", { name: "Save study preferences" }));
    await screen.findByText("Study preferences saved (revision 1).");
    await act(async () => resolve(response(preferences())));
    expect(screen.getByRole("textbox", { name: "Daily goal in minutes" })).toHaveValue("40");
    expect(budgetInput()).toHaveValue("10");
    expect(screen.getByRole("button", { name: "Save study preferences" })).toBeDisabled();
  });

  it("does not clear a different tab's draft on this tab's save acknowledgement", async () => {
    const storageScope = scope();
    let resolve!: (value: ReturnType<typeof response>) => void;
    mockApi({
      save: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    render(<StudyPreferencesEditor storageScope={storageScope} />);
    fireEvent.change(await goalInput("20"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save study preferences" }));
    const other = {
      version: 1,
      values: { goal: "55", budget: "5", subject: "probability" },
      base_revision: 2,
      updated_at: Date.now() + 1000,
    };
    localStorage.setItem(`brainhub:study-preferences:v1:${storageScope}`, JSON.stringify(other));
    await act(async () => resolve(response(preferences(30, 15, 1))));
    expect(JSON.parse(localStorage.getItem(`brainhub:study-preferences:v1:${storageScope}`)!)).toEqual(other);
  });
});
