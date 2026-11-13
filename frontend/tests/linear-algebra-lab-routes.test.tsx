import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LabPage, { metadata } from "@/app/roadmaps/explore/linear-algebra/page";
import RoadmapPage from "@/app/roadmaps/[slug]/page";
import { AuthoredLesson } from "@/components/roadmaps/authored-lesson";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import { api } from "@/lib/api";
import type { AuthoredLesson as Lesson } from "@/lib/curriculum";
import { LAB_LESSONS, LAB_MODES } from "@/lib/linear-algebra-lab-types";
import { roadmapLessons } from "@/lib/roadmap-lessons";
import { experimentForTopic, explorationForLesson, LINEAR_ALGEBRA_LAB_URL } from "@/lib/roadmap-explorations";

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

describe("lesson-linked linear algebra exploration", () => {
  it("covers exactly the six authored foundation topics with public metadata", () => {
    const foundation = roadmapLessons.filter(
      (lesson) => lesson.roadmapSlug === "linear-algebra" && lesson.stageIndex === 0,
    );
    expect(new Set(Object.values(LAB_LESSONS).map((lesson) => lesson.topic))).toEqual(
      new Set(foundation.map((lesson) => lesson.topicSlug)),
    );
    expect(metadata.title).toBe("Linear Algebra Lab — BrainHub");
    expect(explorationForLesson("probability", LAB_LESSONS.combinations.topic)).toBeNull();
    expect(explorationForLesson("linear-algebra", "unimplemented-advanced-topic")).toBeNull();
  });

  it.each(LAB_MODES)("opens the %s experiment through its real lesson query", async (mode) => {
    const query = { lesson: LAB_LESSONS[mode].topic };
    render(await LabPage({ searchParams: Promise.resolve(query) }));
    expect(screen.getByRole("heading", { name: "Linear Algebra Lab", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Experiment" })).toHaveValue(mode);
    expect(screen.getByText(/does not save a score/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Linear Algebra curriculum" })).toHaveAttribute(
      "href",
      "/roadmaps/linear-algebra",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([undefined, "unknown", [LAB_LESSONS.affine.topic], null, { topic: LAB_LESSONS.maps.topic }])(
    "defaults safely for a malformed or absent topic (%j)",
    (topic) => {
      expect(experimentForTopic(topic)).toBe("combinations");
    },
  );

  it.each(LAB_MODES)("links the authored %s lesson to the correct experiment", async (mode) => {
    const topic = LAB_LESSONS[mode];
    const lesson: Lesson = {
      roadmap_slug: "linear-algebra",
      topic_slug: topic.topic,
      title: topic.title,
      summary: "A concrete authored lesson.",
      objectives: ["Work with the defined coordinates."],
      sections: [{ heading: "Definition", body: "Use the stated coordinates." }],
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
        <AuthoredLesson roadmapSlug="linear-algebra" topicSlug={topic.topic} accent="#63e6be" />
      </RoadmapProgressProvider>,
    );
    const link = await screen.findByRole("link", { name: "Open this experiment" });
    expect(link).toHaveAttribute(
      "href",
      `${LINEAR_ALGEBRA_LAB_URL}?lesson=${encodeURIComponent(topic.topic)}`,
    );
  });

  it("offers the implemented lab from the subject overview", async () => {
    render(
      <RoadmapProgressProvider>
        {await RoadmapPage({ params: Promise.resolve({ slug: "linear-algebra" }) })}
      </RoadmapProgressProvider>,
    );
    expect(screen.getByRole("link", { name: "Explore vectors and transformations" })).toHaveAttribute(
      "href",
      LINEAR_ALGEBRA_LAB_URL,
    );
  });

  it("does not advertise an unimplemented lab on another subject", async () => {
    render(
      <RoadmapProgressProvider>
        {await RoadmapPage({ params: Promise.resolve({ slug: "probability" }) })}
      </RoadmapProgressProvider>,
    );
    expect(
      screen.queryByRole("link", { name: "Explore vectors and transformations" }),
    ).not.toBeInTheDocument();
  });
});
