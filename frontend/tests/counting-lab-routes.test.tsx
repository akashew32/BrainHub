import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CountingLabPage, { metadata } from "@/app/roadmaps/explore/probability/page";
import RoadmapPage from "@/app/roadmaps/[slug]/page";
import { AuthoredLesson } from "@/components/roadmaps/authored-lesson";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import { api } from "@/lib/api";
import type { AuthoredLesson as Lesson } from "@/lib/curriculum";
import { COUNTING_LESSONS, COUNTING_MODES } from "@/lib/counting-lab-types";
import { roadmapLessons } from "@/lib/roadmap-lessons";
import {
  countingExperimentForTopic,
  explorationForLesson,
  explorationForRoadmap,
  COUNTING_LAB_URL,
  LINEAR_ALGEBRA_LAB_URL,
} from "@/lib/roadmap-explorations";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ items: [], summary: {} }) })),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("lesson-linked counting exploration", () => {
  it("covers the six authored probability topics and advertises only implemented subject labs", () => {
    const foundation = roadmapLessons.filter(
      (lesson) => lesson.roadmapSlug === "probability" && lesson.stageIndex === 0,
    );
    expect(new Set(Object.values(COUNTING_LESSONS).map((lesson) => lesson.topic))).toEqual(
      new Set(foundation.map((lesson) => lesson.topicSlug)),
    );
    expect(metadata.title).toBe("Counting Lab — BrainHub");
    expect(explorationForRoadmap("probability")).toEqual({
      href: COUNTING_LAB_URL,
      label: "Explore counting constructions",
    });
    expect(explorationForRoadmap("linear-algebra")).toEqual({
      href: LINEAR_ALGEBRA_LAB_URL,
      label: "Explore vectors and transformations",
    });
    expect(explorationForRoadmap("unknown")).toBeNull();
    expect(explorationForRoadmap("constructor")).toBeNull();
    expect(explorationForLesson("probability", "unimplemented-advanced-topic")).toBeNull();
    expect(explorationForLesson("linear-algebra", COUNTING_LESSONS.rules.topic)).toBeNull();
  });

  it.each(COUNTING_MODES)("opens the %s construction through its actual lesson query", async (mode) => {
    render(
      await CountingLabPage({ searchParams: Promise.resolve({ lesson: COUNTING_LESSONS[mode].topic }) }),
    );
    expect(screen.getByRole("heading", { name: "Counting Lab", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Experiment" })).toHaveValue(mode);
    expect(screen.getByText(/does not save a score/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Probability curriculum" })).toHaveAttribute(
      "href",
      "/roadmaps/probability",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    "unknown",
    [COUNTING_LESSONS.pigeonhole.topic],
    null,
    { topic: COUNTING_LESSONS.inclusion.topic },
  ])("defaults safely for malformed or missing topics (%j)", (topic) => {
    expect(countingExperimentForTopic(topic)).toBe("rules");
  });

  it.each(COUNTING_MODES)("links the authored %s lesson to its construction", async (mode) => {
    const topic = COUNTING_LESSONS[mode];
    const lesson: Lesson = {
      roadmap_slug: "probability",
      topic_slug: topic.topic,
      title: topic.title,
      summary: "A concrete authored counting lesson.",
      objectives: ["State the counting assumptions."],
      sections: [{ heading: "Definition", body: "Use the specified finite model." }],
      worked_examples: [],
      sources: [],
      question_count: 10,
      practice_count: 8,
      alternate_form_count: 4,
      practice_form_count: 12,
      pass_score: 75,
    };
    vi.spyOn(api, "authoredLesson").mockResolvedValue(lesson);
    render(
      <RoadmapProgressProvider>
        <AuthoredLesson roadmapSlug="probability" topicSlug={topic.topic} accent="#60a5fa" />
      </RoadmapProgressProvider>,
    );
    expect(await screen.findByRole("link", { name: "Open this experiment" })).toHaveAttribute(
      "href",
      `${COUNTING_LAB_URL}?lesson=${encodeURIComponent(topic.topic)}`,
    );
  });

  it("offers the counting lab on the probability overview", async () => {
    render(
      <RoadmapProgressProvider>
        {await RoadmapPage({ params: Promise.resolve({ slug: "probability" }) })}
      </RoadmapProgressProvider>,
    );
    expect(screen.getByRole("link", { name: "Explore counting constructions" })).toHaveAttribute(
      "href",
      COUNTING_LAB_URL,
    );
    expect(
      screen.queryByRole("link", { name: "Explore vectors and transformations" }),
    ).not.toBeInTheDocument();
  });

  it("preserves the existing linear algebra discovery link", async () => {
    render(
      <RoadmapProgressProvider>
        {await RoadmapPage({ params: Promise.resolve({ slug: "linear-algebra" }) })}
      </RoadmapProgressProvider>,
    );
    expect(screen.getByRole("link", { name: "Explore vectors and transformations" })).toHaveAttribute(
      "href",
      LINEAR_ALGEBRA_LAB_URL,
    );
    expect(screen.queryByRole("link", { name: "Explore counting constructions" })).not.toBeInTheDocument();
  });
});
