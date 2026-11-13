import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookmarkProvider, useBookmarks } from "@/components/roadmaps/bookmark-provider";
import { BookmarkButton } from "@/components/roadmaps/bookmark-button";
import { bookmarkKey, type TopicBookmark } from "@/lib/bookmarks";

const slug = "probability",
  topic = "sum-and-product-rules",
  title = "Sum and product rules";
function row(bookmarked: boolean, revision: number, roadmap = slug, topicSlug = topic): TopicBookmark {
  return {
    roadmap_slug: roadmap,
    topic_slug: topicSlug,
    bookmarked,
    revision,
    updated_at: "2026-11-13T12:00:00Z",
    available: true,
    study_url: `/roadmaps/${roadmap}/${topicSlug}`,
  };
}
function response(payload: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as Response;
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function Harness() {
  const context = useBookmarks();
  if (!context) throw new Error("Bookmark provider is required for this harness");
  const item = context.rows.get(bookmarkKey(slug, topic)),
    pending = context.pending.get(bookmarkKey(slug, topic));
  return (
    <>
      <output aria-label="Bookmark readiness">{context.ready ? "ready" : "unconfirmed"}</output>
      <output aria-label="Confirmed saved state">{item?.bookmarked ? "true" : "false"}</output>
      <output aria-label="Confirmed revision">{item?.revision ?? 0}</output>
      <output aria-label="Pending bookmark state">{pending?.state ?? "none"}</output>
      <output aria-label="Desired bookmark state">{pending ? String(pending.desired) : "none"}</output>
      <output aria-label="Bookmark load error">{context.error ?? "none"}</output>
      <button onClick={() => void context.refresh()}>Refresh bookmarks</button>
      <button onClick={() => void context.setBookmark(slug, topic, true)}>Request save</button>
      <button onClick={() => void context.setBookmark(slug, topic, false)}>Request removal</button>
      <button onClick={() => void context.retryBookmark(slug, topic)}>Retry pending change</button>
      <button onClick={() => context.useServerState(slug, topic)}>Use server state</button>
      <BookmarkButton roadmapSlug={slug} topicSlug={topic} title={title} />
      <BookmarkButton roadmapSlug={slug} topicSlug={topic} title={title} />
    </>
  );
}
const mount = () =>
  render(
    <BookmarkProvider>
      <Harness />
    </BookmarkProvider>,
  );
const get = (name: string) => screen.getByLabelText(name);
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
async function ready() {
  await waitFor(() => expect(get("Bookmark readiness")).toHaveTextContent("ready"));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("server-confirmed bookmark provider", () => {
  it.each([
    ["zero persisted revision", { items: [row(true, 0)] }],
    ["negative persisted revision", { items: [row(true, -1)] }],
    ["out-of-range revision", { items: [row(true, 2_147_483_648)] }],
    [
      "canonical link for a different topic",
      { items: [{ ...row(true, 4), study_url: "/roadmaps/probability/stars-and-bars" }] },
    ],
    ["retired row with a navigation link", { items: [{ ...row(true, 4), available: false }] }],
    ["overlong roadmap identifier", { items: [row(true, 4, "x".repeat(81))] }],
    ["overlong topic identifier", { items: [row(true, 4, slug, "x".repeat(161))] }],
    ["duplicate conflicting states", { items: [row(true, 3), row(false, 4)] }],
  ])("keeps confirmed state when a later GET has %s", async (_name, malformed) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ items: [row(true, 3)] }))
        .mockResolvedValueOnce(response(malformed)),
    );
    mount();
    await ready();
    click("Refresh bookmarks");
    await waitFor(() => expect(get("Bookmark load error")).not.toHaveTextContent("none"));
    expect(get("Bookmark readiness")).toHaveTextContent("ready");
    expect(get("Confirmed saved state")).toHaveTextContent("true");
    expect(get("Confirmed revision")).toHaveTextContent("3");
  });

  it.each([
    ["another resource", row(true, 3, "linear-algebra", "vector-arithmetic-and-linear-combinations")],
    ["zero persisted revision", row(true, 0)],
    ["out-of-range persisted revision", row(true, 2_147_483_648)],
    ["a mismatched canonical link", { ...row(true, 3), study_url: "/roadmaps/probability/stars-and-bars" }],
    ["an unavailable row with a link", { ...row(true, 3), available: false }],
  ])("keeps the intended save and prior acknowledgment when a PUT returns %s", async (_name, malformed) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ items: [row(false, 2)] }))
        .mockResolvedValueOnce(response(malformed)),
    );
    mount();
    await ready();
    click("Request save");
    await waitFor(() => expect(get("Pending bookmark state")).toHaveTextContent("error"));
    expect(get("Confirmed saved state")).toHaveTextContent("false");
    expect(get("Confirmed revision")).toHaveTextContent("2");
    expect(get("Desired bookmark state")).toHaveTextContent("true");
  });

  it("uses persisted false tombstone revisions and synchronizes both buttons only after acknowledgment", async () => {
    const storage = ["getItem", "setItem", "removeItem"].map((method) =>
      vi.spyOn(Storage.prototype, method as "getItem"),
    );
    const save = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [row(false, 7)] }))
      .mockImplementationOnce(() => save.promise);
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await ready();
    expect(get("Confirmed revision")).toHaveTextContent("7");
    expect(screen.getAllByRole("button", { name: `Save bookmark: ${title}` })).toHaveLength(2);
    click("Request save");
    await waitFor(() => expect(get("Pending bookmark state")).toHaveTextContent("saving"));
    expect(get("Confirmed saved state")).toHaveTextContent("false");
    expect(get("Desired bookmark state")).toHaveTextContent("true");
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ bookmarked: true, revision: 7 });
    await act(async () => save.resolve(response(row(true, 8))));
    await waitFor(() => expect(get("Confirmed saved state")).toHaveTextContent("true"));
    expect(get("Confirmed revision")).toHaveTextContent("8");
    expect(get("Pending bookmark state")).toHaveTextContent("none");
    for (const button of screen.getAllByRole("button", { name: `Remove bookmark: ${title}` }))
      expect(button).toHaveAttribute("aria-pressed", "true");
    storage.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it("recovers saved state from the server on a fresh provider mount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ items: [row(true, 3)] }));
    vi.stubGlobal("fetch", fetchMock);
    const first = mount();
    await ready();
    expect(get("Confirmed saved state")).toHaveTextContent("true");
    first.unmount();
    mount();
    await ready();
    expect(get("Confirmed revision")).toHaveTextContent("3");
    expect(get("Confirmed saved state")).toHaveTextContent("true");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps unknown writes disabled after an initial failure and enables them only after a successful retry", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(response({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await waitFor(() => expect(get("Bookmark load error")).not.toHaveTextContent("none"));
    expect(get("Bookmark readiness")).toHaveTextContent("unconfirmed");
    for (const button of screen.getAllByRole("button", { name: `Save bookmark: ${title}` }))
      expect(button).toBeDisabled();
    click("Request save");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    click("Refresh bookmarks");
    await ready();
    for (const button of screen.getAllByRole("button", { name: `Save bookmark: ${title}` }))
      expect(button).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reloads a conflict revision but keeps the pending intent until an explicit retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [row(false, 1)] }))
      .mockResolvedValueOnce(response({ detail: "Bookmark changed" }, 409))
      .mockResolvedValueOnce(response({ items: [row(false, 5)] }))
      .mockResolvedValueOnce(response(row(true, 6)));
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await ready();
    click("Request save");
    await waitFor(() => expect(get("Confirmed revision")).toHaveTextContent("5"));
    expect(get("Pending bookmark state")).toHaveTextContent("conflict");
    expect(get("Desired bookmark state")).toHaveTextContent("true");
    expect(get("Confirmed saved state")).toHaveTextContent("false");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    click("Retry pending change");
    await waitFor(() => expect(get("Confirmed saved state")).toHaveTextContent("true"));
    expect(JSON.parse(fetchMock.mock.calls[3]![1].body)).toEqual({ bookmarked: true, revision: 5 });
    expect(get("Pending bookmark state")).toHaveTextContent("none");
  });

  it("can discard a conflicting local intent without sending another write", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [row(false, 1)] }))
      .mockResolvedValueOnce(response({ detail: "Changed" }, 409))
      .mockResolvedValueOnce(response({ items: [row(false, 4)] }));
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await ready();
    click("Request save");
    await waitFor(() => expect(get("Confirmed revision")).toHaveTextContent("4"));
    click("Use server state");
    expect(get("Pending bookmark state")).toHaveTextContent("none");
    expect(get("Confirmed saved state")).toHaveTextContent("false");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("confirms a save with a lost acknowledgment by GET without automatically repeating the PUT", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [] }))
      .mockRejectedValueOnce(new Error("Connection lost after save"))
      .mockResolvedValueOnce(response({ items: [row(true, 1)] }));
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await ready();
    click("Request save");
    await waitFor(() => expect(get("Pending bookmark state")).toHaveTextContent("error"));
    expect(get("Confirmed saved state")).toHaveTextContent("false");
    click("Refresh bookmarks");
    await waitFor(() => expect(get("Confirmed saved state")).toHaveTextContent("true"));
    expect(get("Pending bookmark state")).toHaveTextContent("none");
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === "PUT")).toHaveLength(1);
  });

  it.each([false, true])(
    "ignores an older complete GET after a new acknowledged mutation (initial saved=%s)",
    async (initial) => {
      const oldGet = deferred<Response>();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(response({ items: initial ? [row(true, 4)] : [] }))
        .mockImplementationOnce(() => oldGet.promise)
        .mockResolvedValueOnce(response(row(!initial, initial ? 5 : 1)));
      vi.stubGlobal("fetch", fetchMock);
      mount();
      await ready();
      click("Refresh bookmarks");
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      click(initial ? "Request removal" : "Request save");
      await waitFor(() => expect(get("Confirmed saved state")).toHaveTextContent(String(!initial)));
      await act(async () => oldGet.resolve(response({ items: initial ? [row(true, 4)] : [] })));
      expect(get("Confirmed saved state")).toHaveTextContent(String(!initial));
      expect(get("Confirmed revision")).toHaveTextContent(String(initial ? 5 : 1));
    },
  );

  it("isolates identical topic slugs in different subjects", async () => {
    const shared = "direct-contrapositive-and-contradiction-proofs";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          items: [row(true, 2, "real-analysis", shared), row(false, 3, "discrete-math", shared)],
        }),
      ),
    );
    render(
      <BookmarkProvider>
        <BookmarkButton roadmapSlug="real-analysis" topicSlug={shared} title="Analysis proofs" />
        <BookmarkButton roadmapSlug="discrete-math" topicSlug={shared} title="Discrete proofs" />
      </BookmarkProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove bookmark: Analysis proofs" })).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: "Save bookmark: Discrete proofs" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
