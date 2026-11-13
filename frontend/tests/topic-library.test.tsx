import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TopicLibrary } from "@/components/roadmaps/topic-library";
import { BookmarkProvider } from "@/components/roadmaps/bookmark-provider";
import { BookmarkButton } from "@/components/roadmaps/bookmark-button";
import type { CurriculumIndex, TopicBookmark } from "@/lib/bookmarks";
import { parseTopicFilters, serializeTopicFilters } from "@/lib/roadmap-search";
import { learningRoadmaps } from "@/lib/roadmaps";
import { slugifyTopic } from "@/lib/roadmap-utils";

const curriculum: CurriculumIndex = {
  version: 1,
  pass_score: 75,
  roadmaps: learningRoadmaps.map((roadmap) => ({
    slug: roadmap.slug,
    stage_index: 0,
    lessons: roadmap.stages[0]!.topics.map((title) => ({
      topic_slug: slugifyTopic(title),
      title,
      question_count: 10,
    })),
  })),
};
const bookmark = (roadmap: string, topic: string, saved = true, revision = 1): TopicBookmark => ({
  roadmap_slug: roadmap,
  topic_slug: topic,
  bookmarked: saved,
  revision,
  updated_at: "2026-11-13T12:00:00Z",
  available: true,
  study_url: `/roadmaps/${roadmap}/${topic}`,
});
function response(payload: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as Response;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function choose(label: string, value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value } });
}
function search(value: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search topics" }), { target: { value } });
}
function mount(filters: Record<string, string> = {}, sibling = false, preserveBrowserURL = false) {
  const initialFilters = parseTopicFilters(filters),
    query = serializeTopicFilters(initialFilters);
  if (!preserveBrowserURL)
    window.history.replaceState({}, "", `/roadmaps/library${query ? "?" + query : ""}`);
  return render(
    <BookmarkProvider>
      <TopicLibrary initialFilters={initialFilters} />
      {sibling ? (
        <BookmarkButton
          roadmapSlug="probability"
          topicSlug="sum-and-product-rules"
          title="Sum and product rules"
        />
      ) : null}
    </BookmarkProvider>,
  );
}
function mockNetwork(items: TopicBookmark[] = []) {
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/roadmaps/curriculum")) return response(curriculum);
    if (url.endsWith("/roadmaps/bookmarks")) return response({ items });
    if (init?.method === "PUT") {
      const [roadmap, topic] = url.split("/").slice(-2).map(decodeURIComponent),
        payload = JSON.parse(String(init.body));
      return response(bookmark(roadmap!, topic!, payload.bookmarked, payload.revision + 1));
    }
    throw new Error("Unexpected request: " + url);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
async function count(shown: number, total: number) {
  await waitFor(() =>
    expect(screen.getByText(`Showing ${shown} of ${total} matching topics (300 indexed).`)).toBeVisible(),
  );
}
const article = (title: string, subject: string) =>
  screen.getByRole("article", { name: `${title} — ${subject}` });

beforeEach(() => {
  window.history.replaceState({}, "", "/roadmaps/library");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("current-source topic library", () => {
  it("hydrates cached route props consistently before reconciling the actual browser URL", async () => {
    mockNetwork([bookmark("probability", "sum-and-product-rules")]);
    window.history.replaceState({}, "", "/roadmaps/library?saved=bookmarked");
    const element = (
      <BookmarkProvider>
        <TopicLibrary
          initialFilters={parseTopicFilters({
            q: "conditional probability",
            subject: "probability",
            stage: "2",
          })}
        />
      </BookmarkProvider>
    );
    const container = document.createElement("div"),
      errors: unknown[] = [];
    const messages = vi.spyOn(console, "error").mockImplementation(() => {});
    container.innerHTML = renderToString(element);
    expect(within(container).getByRole("searchbox", { name: "Search topics" })).toHaveValue(
      "conditional probability",
    );
    expect(within(container).getByRole("combobox", { name: "Saved topics" })).toHaveValue("all");
    document.body.appendChild(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, element, {
          onRecoverableError: (error) => {
            errors.push(error);
          },
        });
      });
      await waitFor(() =>
        expect(within(container).getByRole("combobox", { name: "Saved topics" })).toHaveValue("bookmarked"),
      );
      expect(within(container).getByRole("searchbox", { name: "Search topics" })).toHaveValue("");
      expect(within(container).getByRole("combobox", { name: "Subject" })).toHaveValue("all");
      expect(errors).toEqual([]);
      expect(messages).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        root?.unmount();
      });
      container.remove();
    }
  });

  it("replaces text-query edits instead of adding a browser Back entry per character", async () => {
    mockNetwork();
    mount();
    await count(30, 300);
    const push = vi.spyOn(window.history, "pushState"),
      replace = vi.spyOn(window.history, "replaceState");
    search("v");
    search("ve");
    search("vec");
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(3);
    expect(new URL(window.location.href).searchParams.get("q")).toBe("vec");
    choose("Subject", "linear-algebra");
    expect(push).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(push).toHaveBeenCalledTimes(2);
    expect(window.location.search).toBe("");
  });

  it("restores URL filters on browser navigation and resets the visible-result limit", async () => {
    mockNetwork();
    mount();
    await count(30, 300);
    fireEvent.click(screen.getByRole("button", { name: "Show more topics" }));
    await count(60, 300);
    act(() => {
      window.history.replaceState({}, "", "/roadmaps/library?subject=probability");
      fireEvent.popState(window);
    });
    await count(30, 60);
    expect(screen.getByRole("combobox", { name: "Subject" })).toHaveValue("probability");
    expect(screen.getByRole("searchbox", { name: "Search topics" })).toHaveValue("");
  });

  it("accepts a genuine route change but preserves a newer local query and focus against stale route props", async () => {
    mockNetwork();
    const view = mount({ subject: "probability" });
    await count(30, 60);
    window.history.replaceState({}, "", "/roadmaps/library?subject=linear-algebra&stage=1");
    view.rerender(
      <BookmarkProvider>
        <TopicLibrary initialFilters={parseTopicFilters({ subject: "linear-algebra", stage: "1" })} />
      </BookmarkProvider>,
    );
    await count(6, 6);
    expect(screen.getByRole("combobox", { name: "Subject" })).toHaveValue("linear-algebra");
    const field = screen.getByRole("searchbox", { name: "Search topics" });
    field.focus();
    search("vector");
    view.rerender(
      <BookmarkProvider>
        <TopicLibrary initialFilters={parseTopicFilters({ subject: "probability" })} />
      </BookmarkProvider>,
    );
    expect(screen.getByRole("searchbox", { name: "Search topics" })).toHaveValue("vector");
    expect(screen.getByRole("searchbox", { name: "Search topics" })).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Subject" })).toHaveValue("linear-algebra");
  });

  it("accepts a genuine navigation to a route signature that was previously ignored as stale", async () => {
    mockNetwork();
    const view = mount();
    await count(30, 300);
    search("kernel");
    const incoming = parseTopicFilters({ q: "continuity" });
    view.rerender(
      <BookmarkProvider>
        <TopicLibrary initialFilters={incoming} />
      </BookmarkProvider>,
    );
    expect(screen.getByRole("searchbox", { name: "Search topics" })).toHaveValue("kernel");
    expect(new URL(window.location.href).searchParams.get("q")).toBe("kernel");
    window.history.pushState({}, "", "/roadmaps/library?q=continuity");
    // Next client navigation supplies new props without a browser popstate event.
    view.rerender(
      <BookmarkProvider>
        <TopicLibrary initialFilters={incoming} />
      </BookmarkProvider>,
    );
    expect(new URL(window.location.href).searchParams.get("q")).toBe("continuity");
    expect(screen.getByRole("searchbox", { name: "Search topics" })).toHaveValue("continuity");
  });

  it("reconciles a remount to the current browser URL and rejects later cached props from a different route", async () => {
    mockNetwork([bookmark("probability", "sum-and-product-rules")]);
    window.history.replaceState({}, "", "/roadmaps/library?saved=bookmarked");
    const view = mount({ q: "conditional probability", subject: "probability", stage: "2" }, false, true);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Saved topics" })).toHaveValue("bookmarked"),
    );
    expect(screen.getByRole("combobox", { name: "Subject" })).toHaveValue("all");
    expect(screen.getByRole("combobox", { name: "Stage" })).toHaveValue("all");
    expect(screen.getByRole("searchbox", { name: "Search topics" })).toHaveValue("");
    await count(1, 1);
    view.rerender(
      <BookmarkProvider>
        <TopicLibrary
          initialFilters={parseTopicFilters({ q: "conditioning", subject: "probability", stage: "2" })}
        />
      </BookmarkProvider>,
    );
    expect(screen.getByRole("combobox", { name: "Saved topics" })).toHaveValue("bookmarked");
    expect(screen.getByRole("combobox", { name: "Subject" })).toHaveValue("all");
    expect(screen.getByRole("searchbox", { name: "Search topics" })).toHaveValue("");
    expect(window.location.search).toBe("?saved=bookmarked");
  });

  it("searches all 300 topics while initially rendering thirty, and grows the visible list on request", async () => {
    mockNetwork();
    mount();
    await count(30, 300);
    expect(screen.getAllByRole("article")).toHaveLength(30);
    fireEvent.click(screen.getByRole("button", { name: "Show more topics" }));
    await count(60, 300);
    const lastRoadmap = learningRoadmaps.at(-1)!,
      lastTopic = lastRoadmap.stages.at(-1)!.topics.at(-1)!;
    choose("Subject", lastRoadmap.slug);
    choose("Stage", "10");
    search(lastTopic);
    await waitFor(() => expect(article(lastTopic, lastRoadmap.title)).toBeVisible());
    expect(
      within(article(lastTopic, lastRoadmap.title)).getByRole("link", { name: /^Study outline\b/ }),
    ).toHaveAttribute("href", `/roadmaps/${lastRoadmap.slug}/${slugifyTopic(lastTopic)}`);
  });

  it("joins the public released-lesson index as 30 authored lessons and 270 outlines", async () => {
    mockNetwork();
    mount({ availability: "authored" });
    await count(30, 30);
    expect(screen.getAllByRole("link", { name: /^Open authored lesson\b/ })).toHaveLength(30);
    expect(screen.queryByRole("link", { name: /^Study outline\b/ })).not.toBeInTheDocument();
    choose("Availability", "outline");
    await count(30, 270);
    expect(screen.getAllByRole("link", { name: /^Study outline\b/ })).toHaveLength(30);
    expect(screen.queryByRole("link", { name: /^Open authored lesson\b/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /start practice|start assessment/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /start practice|start assessment/i })).not.toBeInTheDocument();
  });

  it("combines Unicode text, subject, stage, level, released availability and confirmed saved-state filters", async () => {
    mockNetwork([
      bookmark("linear-algebra", "vector-arithmetic-and-linear-combinations"),
      bookmark("probability", "sum-and-product-rules", false, 4),
    ]);
    mount();
    await count(30, 300);
    choose("Subject", "linear-algebra");
    choose("Stage", "1");
    choose("Level", "Foundation");
    choose("Availability", "authored");
    choose("Saved topics", "bookmarked");
    search("VÉCTOR arithmetic");
    await count(1, 1);
    expect(article("Vector arithmetic and linear combinations", "Linear Algebra")).toBeVisible();
    const url = new URL(window.location.href);
    expect(url.searchParams.get("subject")).toBe("linear-algebra");
    expect(url.searchParams.get("saved")).toBe("bookmarked");
  });

  it("does not mislabel loading availability as curriculum outlines or authored practice", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: unknown) =>
        String(input).endsWith("/curriculum") ? pending.promise : Promise.resolve(response({ items: [] })),
      ),
    );
    mount();
    await count(30, 300);
    expect(screen.queryByRole("link", { name: /^Study outline\b/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Open authored lesson\b/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^View curriculum topic\b/ })).toHaveLength(30);
    await act(async () => pending.resolve(response(curriculum)));
    choose("Availability", "authored");
    await count(30, 30);
  });

  it.each(["authored", "outline"])(
    "does not claim an empty %s result while the curriculum request is pending",
    async (availability) => {
      const pending = deferred<Response>();
      vi.stubGlobal(
        "fetch",
        vi.fn((input: unknown) =>
          String(input).endsWith("/curriculum") ? pending.promise : Promise.resolve(response({ items: [] })),
        ),
      );
      mount({ availability });
      expect(
        screen.getByText("Confirming teaching availability before showing these filtered results…"),
      ).toBeVisible();
      expect(screen.queryByText(/^No topics match these filters/)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Showing 0 of 0 matching topics/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show all availability" })).toBeVisible();
      await act(async () => pending.resolve(response(curriculum)));
      await count(30, availability === "authored" ? 30 : 270);
      expect(screen.queryByRole("button", { name: "Show all availability" })).not.toBeInTheDocument();
    },
  );

  it.each(["authored", "outline"])(
    "explains unknown availability after a failed %s lookup and can broaden the search",
    async (availability) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: unknown) => {
          if (String(input).endsWith("/curriculum")) throw new Error("Availability offline");
          return response({ items: [] });
        }),
      );
      mount({ availability });
      expect(
        await screen.findByText(
          "Teaching availability is unknown. These filtered results cannot yet be confirmed.",
        ),
      ).toBeVisible();
      expect(screen.queryByText(/^No topics match these filters/)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Showing 0 of 0 matching topics/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry availability" })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Show all availability" }));
      await count(30, 300);
      expect(screen.getByRole("combobox", { name: "Availability" })).toHaveValue("all");
      expect(screen.getAllByRole("link", { name: /^View curriculum topic\b/ })).toHaveLength(30);
      expect(screen.queryByRole("link", { name: /^Study outline\b/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /^Open authored lesson\b/ })).not.toBeInTheDocument();
    },
  );

  it("keeps malformed availability unknown and can recover through an explicit retry", async () => {
    let requests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) =>
        String(input).endsWith("/curriculum")
          ? response(++requests === 1 ? { version: 1, roadmaps: "invalid" } : curriculum)
          : response({ items: [] }),
      ),
    );
    mount();
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry availability" })).toBeVisible());
    expect(screen.queryByRole("link", { name: /^Study outline\b/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Open authored lesson\b/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry availability" }));
    choose("Availability", "authored");
    await count(30, 30);
  });

  it("shows a bookmark load error and recovers saved filtering without claiming that unknown bookmarks are empty", async () => {
    let bookmarkLoads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        if (String(input).endsWith("/curriculum")) return response(curriculum);
        if (++bookmarkLoads === 1) throw new Error("Bookmarks offline");
        return response({ items: [bookmark("probability", "sum-and-product-rules")] });
      }),
    );
    mount({ saved: "bookmarked" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry bookmarks" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Retry bookmarks" }));
    await count(1, 1);
    expect(article("Sum and product rules", "Probability")).toBeVisible();
  });

  it("keeps matching slugs in the two proof subjects separately bookmarkable", async () => {
    const shared = "direct-contrapositive-and-contradiction-proofs";
    mockNetwork([bookmark("real-analysis", shared)]);
    mount({ q: "Direct contrapositive contradiction", saved: "bookmarked" });
    await count(1, 1);
    expect(article("Direct, contrapositive, and contradiction proofs", "Real Analysis")).toBeVisible();
    expect(
      screen.queryByRole("article", {
        name: "Direct, contrapositive, and contradiction proofs — Discrete Math",
      }),
    ).not.toBeInTheDocument();
    choose("Saved topics", "all");
    choose("Subject", "discrete-math");
    await waitFor(() =>
      expect(article("Direct, contrapositive, and contradiction proofs", "Discrete Math")).toBeVisible(),
    );
    expect(
      within(article("Direct, contrapositive, and contradiction proofs", "Discrete Math")).getByRole(
        "button",
        { name: /^Save bookmark: Direct, contrapositive, and contradiction proofs\b/ },
      ),
    ).toBeEnabled();
  });

  it.each([false, true])(
    "never fabricates a route for a saved topic absent from the current public index (server available=%s)",
    async (available) => {
      const retired: TopicBookmark = {
        ...bookmark("probability", "retired-topic", true, 2),
        available,
        study_url: available ? "/roadmaps/probability/retired-topic" : null,
      };
      const fetchMock = mockNetwork([retired]);
      mount();
      const heading = await screen.findByRole("heading", { name: "Retired saved topics" }),
        section = heading.closest("section")!;
      expect(within(section).queryAllByRole("link")).toHaveLength(0);
      expect(within(section).queryByRole("button", { name: /^Save bookmark:/ })).not.toBeInTheDocument();
      fireEvent.click(within(section).getByRole("button", { name: /^Remove bookmark:/ }));
      await waitFor(() => expect(fetchMock.mock.calls.some((call) => call[1]?.method === "PUT")).toBe(true));
      const put = fetchMock.mock.calls.find((call) => call[1]?.method === "PUT")!;
      expect(JSON.parse(String(put[1]!.body))).toEqual({ bookmarked: false, revision: 2 });
    },
  );

  it("shares acknowledged bookmark changes between a topic card and another mounted view without storing progress", async () => {
    const storage = ["getItem", "setItem", "removeItem"].map((method) =>
      vi.spyOn(Storage.prototype, method as "getItem"),
    );
    const fetchMock = mockNetwork();
    mount({ q: "Sum product rules", subject: "probability", stage: "1" }, true);
    await count(1, 1);
    const card = article("Sum and product rules", "Probability");
    await waitFor(() =>
      expect(
        within(card).getByRole("button", { name: /^Save bookmark: Sum and product rules\b/ }),
      ).toBeEnabled(),
    );
    fireEvent.click(within(card).getByRole("button", { name: /^Save bookmark: Sum and product rules\b/ }));
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /^Remove bookmark: Sum and product rules\b/ }),
      ).toHaveLength(2),
    );
    expect(
      fetchMock.mock.calls.every((call) =>
        /\/roadmaps\/(curriculum|bookmarks)(?:\/|$)/.test(String(call[0])),
      ),
    ).toBe(true);
    storage.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });
});
