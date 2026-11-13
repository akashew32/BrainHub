import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FunctionLabPage, { metadata } from "@/app/roadmaps/explore/calculus/page";
import RoadmapPage from "@/app/roadmaps/[slug]/page";
import { AuthoredLesson } from "@/components/roadmaps/authored-lesson";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import { api } from "@/lib/api";
import type { AuthoredLesson as Lesson } from "@/lib/curriculum";
import { FUNCTION_LESSONS, FUNCTION_MODES } from "@/lib/function-lab-types";
import { roadmapLessons } from "@/lib/roadmap-lessons";
import {
  functionExperimentForTopic,
  explorationForLesson,
  explorationForRoadmap,
  FUNCTION_LAB_URL,
  COUNTING_LAB_URL,
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

describe("lesson-linked function exploration", () => {
  it("covers the actual six calculus foundation topics with public metadata", () => {
    const foundation = roadmapLessons.filter(
      (lesson) => lesson.roadmapSlug === "calculus" && lesson.stageIndex === 0,
    );
    expect(new Set(Object.values(FUNCTION_LESSONS).map((lesson) => lesson.topic))).toEqual(
      new Set(foundation.map((lesson) => lesson.topicSlug)),
    );
    expect(metadata.title).toBe("Function and Sequence Lab — BrainHub");
    expect(explorationForRoadmap("calculus")).toEqual({
      href: FUNCTION_LAB_URL,
      label: "Explore functions and sequences",
    });
    expect(explorationForRoadmap("unknown")).toBeNull();
    expect(explorationForRoadmap("constructor")).toBeNull();
    expect(explorationForLesson("calculus", "unimplemented-advanced-topic")).toBeNull();
    expect(explorationForLesson("probability", FUNCTION_LESSONS.sequences.topic)).toBeNull();
  });

  it.each(FUNCTION_MODES)("opens the %s experiment from its lesson query", async (mode) => {
    render(
      await FunctionLabPage({ searchParams: Promise.resolve({ lesson: FUNCTION_LESSONS[mode].topic }) }),
    );
    expect(screen.getByRole("heading", { name: "Function and Sequence Lab", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Experiment" })).toHaveValue(mode);
    expect(screen.getByText(/does not save scores/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Calculus curriculum" })).toHaveAttribute(
      "href",
      "/roadmaps/calculus",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    "unknown",
    [FUNCTION_LESSONS.sequences.topic],
    null,
    { topic: FUNCTION_LESSONS.curves.topic },
  ])("defaults safely for malformed or absent topics (%j)", (topic) => {
    expect(functionExperimentForTopic(topic)).toBe("composition");
  });

  it.each(FUNCTION_MODES)("links the authored %s lesson to its experiment", async (mode) => {
    const topic = FUNCTION_LESSONS[mode];
    const lesson: Lesson = {
      roadmap_slug: "calculus",
      topic_slug: topic.topic,
      title: topic.title,
      summary: "A concrete authored function lesson.",
      objectives: ["Respect the defined domain."],
      sections: [{ heading: "Definition", body: "Use the stated function family." }],
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
        <AuthoredLesson roadmapSlug="calculus" topicSlug={topic.topic} accent="#c4b5fd" />
      </RoadmapProgressProvider>,
    );
    expect(await screen.findByRole("link", { name: "Open this experiment" })).toHaveAttribute(
      "href",
      `${FUNCTION_LAB_URL}?lesson=${encodeURIComponent(topic.topic)}`,
    );
  });

  it("offers the new lab from the calculus overview", async () => {
    render(
      <RoadmapProgressProvider>
        {await RoadmapPage({ params: Promise.resolve({ slug: "calculus" }) })}
      </RoadmapProgressProvider>,
    );
    expect(screen.getByRole("link", { name: "Explore functions and sequences" })).toHaveAttribute(
      "href",
      FUNCTION_LAB_URL,
    );
    expect(screen.queryByRole("link", { name: "Explore counting constructions" })).not.toBeInTheDocument();
  });

  it("retains the implemented counting discovery link", async () => {
    render(
      <RoadmapProgressProvider>
        {await RoadmapPage({ params: Promise.resolve({ slug: "probability" }) })}
      </RoadmapProgressProvider>,
    );
    expect(screen.getByRole("link", { name: "Explore counting constructions" })).toHaveAttribute(
      "href",
      COUNTING_LAB_URL,
    );
    expect(screen.queryByRole("link", { name: "Explore functions and sequences" })).not.toBeInTheDocument();
  });
});
