import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionReflection } from "@/components/roadmaps/question-reflection";
import type { ReflectionNote } from "@/lib/curriculum";

let nextQuestion = 0;
function note(text = "", revision = 0): ReflectionNote {
  return {
    text,
    revision,
    created_at: revision ? "2026-11-12T00:00:00Z" : null,
    updated_at: revision ? "2026-11-12T00:00:00Z" : null,
  };
}
function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}
function props() {
  return {
    roadmapSlug: "linear-algebra",
    questionId: `reflection-${++nextQuestion}`,
    concept: "Scalar arithmetic",
    initialNote: note(),
  };
}
function key(questionId: string) {
  return `brainhub:question-reflection:v1:linear-algebra:${questionId}`;
}
function mockNotes({
  save = async (body) => response(note(body.text, body.revision + 1)),
  latest = async () => response({ note: note() }),
}: {
  save?: (body: { text: string; revision: number }) => Promise<ReturnType<typeof response>>;
  latest?: () => Promise<ReturnType<typeof response>>;
} = {}) {
  const mock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) =>
    init?.method === "PUT" ? save(JSON.parse(String(init.body))) : latest(),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("persistent question reflections", () => {
  it("restores unsaved raw text on remount without sending it to the server", async () => {
    const current = props();
    const mock = mockNotes();
    const first = render(<QuestionReflection {...current} />);
    const editor = await screen.findByRole("textbox", { name: "Reflection for Scalar arithmetic" });
    fireEvent.change(editor, { target: { value: "I mixed up $x$ and y.\nTry 1/2 next time." } });
    first.unmount();
    render(<QuestionReflection {...current} />);
    expect(await screen.findByRole("textbox")).toHaveValue("I mixed up $x$ and y.\nTry 1/2 next time.");
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved reflection restored");
    expect(mock).not.toHaveBeenCalled();
  });

  it("preserves text on a CAS conflict and retries only after an explicit latest-revision choice", async () => {
    const current = props();
    let saves = 0;
    const mock = mockNotes({
      save: async (body) =>
        ++saves === 1
          ? response({ detail: "Reflection changed in another tab." }, 409)
          : response(note(body.text, 3)),
      latest: async () => response({ note: note("Other tab explanation", 2) }),
    });
    render(<QuestionReflection {...current} />);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "My unsaved reasoning" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    expect(await screen.findByText("A newer saved reflection needs your review")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("My unsaved reasoning");
    expect(screen.getByText("Other tab explanation")).toBeInTheDocument();
    expect(mock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Save my text using latest revision" }));
    await screen.findByText("Reflection saved to your profile (revision 3).");
    expect(
      mock.mock.calls
        .filter(([, init]) => init?.method === "PUT")
        .map(([, init]) => JSON.parse(String(init?.body))),
    ).toEqual([
      { text: "My unsaved reasoning", revision: 0 },
      { text: "My unsaved reasoning", revision: 2 },
    ]);
    expect(screen.queryByText("A newer saved reflection needs your review")).not.toBeInTheDocument();
  });

  it("requires an explicit choice before replacing a local draft with the saved reflection", async () => {
    const current = props();
    mockNotes({
      save: async () => response({ detail: "Conflict" }, 409),
      latest: async () => response({ note: note("Saved elsewhere", 2) }),
    });
    render(<QuestionReflection {...current} />);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Local text" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use saved reflection" }));
    expect(screen.getByRole("textbox")).toHaveValue("Saved elsewhere");
    expect(screen.getByRole("button", { name: "Save reflection" })).toBeDisabled();
  });

  it("retains text after a network failure and can retry the same base revision", async () => {
    let saves = 0;
    const mock = mockNotes({
      save: async (body) => {
        if (++saves === 1) throw new Error("Network unavailable");
        return response(note(body.text, 1));
      },
      latest: async () => {
        throw new Error("Offline");
      },
    });
    render(<QuestionReflection {...props()} />);
    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: "Keep this unfinished explanation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your text has been preserved");
    expect(screen.getByRole("textbox")).toHaveValue("Keep this unfinished explanation");
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    await screen.findByText("Reflection saved to your profile (revision 1).");
    expect(
      mock.mock.calls
        .filter(([, init]) => init?.method === "PUT")
        .map(([, init]) => JSON.parse(String(init?.body)).revision),
    ).toEqual([0, 0]);
  });

  it("recovers a committed save after its response is lost", async () => {
    const current = props();
    mockNotes({
      save: async () => {
        throw new Error("Response lost");
      },
      latest: async () => response({ note: note("The committed reflection", 1) }),
    });
    render(<QuestionReflection {...current} />);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "The committed reflection" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    await screen.findByText("Reflection saved to your profile (revision 1).");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save reflection" })).toBeDisabled();
    expect(localStorage.getItem(key(current.questionId))).toBeNull();
  });

  it("keeps newer edits when an earlier save completes and blocks duplicate pending saves", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    const current = props();
    const mock = mockNotes({
      save: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    render(<QuestionReflection {...current} />);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "First explanation" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    fireEvent.click(screen.getByRole("button", { name: "Saving reflection…" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Newer unfinished explanation" } });
    await act(async () => resolve(response(note("First explanation", 1))));
    expect(screen.getByRole("textbox")).toHaveValue("Newer unfinished explanation");
    expect(screen.getByRole("status")).toHaveTextContent("Your newer edits are still unsaved");
    expect(JSON.parse(localStorage.getItem(key(current.questionId))!)).toMatchObject({
      text: "Newer unfinished explanation",
      base_revision: 1,
    });
    expect(mock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
  });

  it("restores the newer memory draft when an old disk draft exists and later writes fail", async () => {
    const current = props();
    const first = render(<QuestionReflection {...current} />);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Old disk copy" } });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage is read-only");
    });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Newer memory copy" } });
    expect(screen.getByText(/Device storage is unavailable/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(key(current.questionId))!).text).toBe("Old disk copy");
    first.unmount();
    render(<QuestionReflection {...current} />);
    expect(await screen.findByRole("textbox")).toHaveValue("Newer memory copy");
    set.mockRestore();
  });

  it("does not delete a different tab's newer draft when this tab receives a save acknowledgement", async () => {
    const current = props();
    let resolve!: (value: ReturnType<typeof response>) => void;
    mockNotes({
      save: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    render(<QuestionReflection {...current} />);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "This tab's submitted text" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    const otherDraft = {
      version: 1,
      text: "Other tab's unsaved text",
      base_revision: 2,
      updated_at: Date.now() + 1000,
    };
    localStorage.setItem(key(current.questionId), JSON.stringify(otherDraft));
    await act(async () => resolve(response(note("This tab's submitted text", 1))));
    expect(JSON.parse(localStorage.getItem(key(current.questionId))!)).toEqual(otherDraft);
    expect(screen.getByRole("textbox")).toHaveValue("This tab's submitted text");
  });

  it("ignores a save response after switching to a different question context", async () => {
    const first = props();
    const second = props();
    const onSaved = vi.fn();
    let resolve!: (value: ReturnType<typeof response>) => void;
    mockNotes({
      save: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    const rendered = render(<QuestionReflection {...first} onSaved={onSaved} />);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "First question text" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    rendered.rerender(
      <QuestionReflection
        {...second}
        initialNote={note("Second question saved text", 2)}
        onSaved={onSaved}
      />,
    );
    expect(await screen.findByRole("textbox")).toHaveValue("Second question saved text");
    await act(async () => resolve(response(note("First question text", 1))));
    expect(screen.getByRole("textbox")).toHaveValue("Second question saved text");
    expect(onSaved).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(key(first.questionId))!).text).toBe("First question text");
  });

  it("ignores a corrupt cache and keeps the editor usable when storage fails", async () => {
    const current = props();
    localStorage.setItem(key(current.questionId), "{broken");
    render(<QuestionReflection {...current} initialNote={note("Saved profile text", 1)} />);
    expect(await screen.findByRole("textbox")).toHaveValue("Saved profile text");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota");
    });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Editable text" } });
    expect(screen.getByRole("textbox")).toHaveValue("Editable text");
    await waitFor(() => expect(screen.getByRole("button", { name: "Save reflection" })).toBeEnabled());
  });
});
