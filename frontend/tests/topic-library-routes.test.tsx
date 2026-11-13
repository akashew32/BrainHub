import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TopicLibraryPage, { metadata } from "@/app/roadmaps/library/page";
import RoadmapsPage from "@/app/roadmaps/page";
import RoadmapPage from "@/app/roadmaps/[slug]/page";
import TopicPage from "@/app/roadmaps/[slug]/[topic]/page";
import RoadmapsLayout from "@/app/roadmaps/layout";
import { api } from "@/lib/api";
import { learningRoadmaps } from "@/lib/roadmaps";
import { parseTopicFilters, type TopicFilters } from "@/lib/roadmap-search";
import { slugifyTopic } from "@/lib/roadmap-utils";

vi.mock("@/components/roadmaps/topic-library", () => ({
  TopicLibrary: ({ initialFilters }: { initialFilters: TopicFilters }) => (
    <output data-testid="library-filters">{JSON.stringify(initialFilters)}</output>
  ),
}));
vi.mock("@/components/roadmaps/authored-lesson", () => ({
  AuthoredLesson: () => (
    <section aria-label="Authored lesson">
      <h2>Worked teaching and practice</h2>
    </section>
  ),
}));
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ items: [], summary: {} }) })),
  );
  vi.spyOn(api, "topicBookmarks").mockResolvedValue({ items: [] });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("topic library and bookmark entry points", () => {
  it("awaits and parses URL filters without requiring a server-side API request", async () => {
    const query = {
      q: "vector arithmetic",
      subject: "linear-algebra",
      stage: "1",
      level: "Foundation",
      availability: "authored",
      saved: "bookmarked",
    };
    render(await TopicLibraryPage({ searchParams: Promise.resolve(query) }));
    expect(metadata.title).toBe("Topic Library — BrainHub");
    expect(screen.getByRole("heading", { name: "Topic Library", level: 1 })).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId("library-filters").textContent!)).toEqual(parseTopicFilters(query));
    expect(screen.getByRole("link", { name: "All roadmaps" })).toHaveAttribute("href", "/roadmaps");
    expect(screen.getByRole("link", { name: "Learning dashboard" })).toHaveAttribute(
      "href",
      "/roadmaps/learning",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("defaults unknown URL fields safely and labels the local-profile and content distinction", async () => {
    render(
      await TopicLibraryPage({
        searchParams: Promise.resolve({
          subject: "constructor",
          stage: "0",
          level: "PhD",
          availability: "invented",
          saved: "yes",
        }),
      }),
    );
    expect(JSON.parse(screen.getByTestId("library-filters").textContent!)).toEqual(parseTopicFilters({}));
    expect(screen.getByText(/current local BrainHub profile/)).toBeInTheDocument();
    expect(screen.getByText(/Curriculum outlines describe later study/)).toBeInTheDocument();
  });

  it("makes curriculum discovery available from the roadmap landing page", () => {
    render(
      <RoadmapsLayout>
        <RoadmapsPage />
      </RoadmapsLayout>,
    );
    expect(screen.getByRole("link", { name: "Search topics and bookmarks" })).toHaveAttribute(
      "href",
      "/roadmaps/library",
    );
  });

  it.each(learningRoadmaps)("preserves $title subject context when opening discovery", async (roadmap) => {
    render(
      <RoadmapsLayout>
        {await RoadmapPage({ params: Promise.resolve({ slug: roadmap.slug }) })}
      </RoadmapsLayout>,
    );
    expect(screen.getByRole("link", { name: "Search this curriculum and saved topics" })).toHaveAttribute(
      "href",
      `/roadmaps/library?subject=${roadmap.slug}`,
    );
  });

  it.each([0, 1])("shares the durable bookmark provider with a stage-index %i topic page", async (stage) => {
    const roadmap = learningRoadmaps[0]!,
      title = roadmap.stages[stage]!.topics[0]!,
      topic = slugifyTopic(title);
    const save = vi.spyOn(api, "saveTopicBookmark").mockResolvedValue({
      roadmap_slug: roadmap.slug,
      topic_slug: topic,
      bookmarked: true,
      revision: 1,
      updated_at: "2026-11-13T12:00:00Z",
      available: true,
      study_url: `/roadmaps/${roadmap.slug}/${topic}`,
    });
    render(
      <RoadmapsLayout>
        {await TopicPage({ params: Promise.resolve({ slug: roadmap.slug, topic }) })}
      </RoadmapsLayout>,
    );
    expect(screen.getByRole("link", { name: "Search this curriculum" })).toHaveAttribute(
      "href",
      `/roadmaps/library?subject=${roadmap.slug}`,
    );
    const button = screen.getByRole("button", { name: `Save bookmark: ${title} — ${roadmap.title}` });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(
      await screen.findByRole("button", { name: `Remove bookmark: ${title} — ${roadmap.title}` }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(save).toHaveBeenCalledWith(roadmap.slug, topic, { bookmarked: true, revision: 0 });
    if (stage === 1) {
      expect(screen.getByText(/This advanced topic is a study outline/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /practice/i })).not.toBeInTheDocument();
    }
  });
});
