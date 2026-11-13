import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LogicLabPage, { metadata } from "@/app/roadmaps/explore/logic/page";
import RoadmapPage from "@/app/roadmaps/[slug]/page";
import { AuthoredLesson } from "@/components/roadmaps/authored-lesson";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import { api } from "@/lib/api";
import type { AuthoredLesson as Lesson } from "@/lib/curriculum";
import { LOGIC_LESSONS } from "@/lib/logic-lab-types";
import { roadmapLessons } from "@/lib/roadmap-lessons";
import {
  explorationForLesson,
  explorationForRoadmap,
  logicExperimentForTopic,
  LOGIC_LAB_URL,
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

describe("lesson-linked logic and proof exploration", () => {
  it("covers exactly the twelve authored foundation topics and preserves subject context", () => {
    for (const subject of ["real-analysis", "discrete-math"] as const) {
      const authored = roadmapLessons.filter(
        (lesson) => lesson.roadmapSlug === subject && lesson.stageIndex === 0,
      );
      expect(authored).toHaveLength(6);
      expect(
        new Set(LOGIC_LESSONS.filter((lesson) => lesson.roadmap === subject).map((lesson) => lesson.topic)),
      ).toEqual(new Set(authored.map((lesson) => lesson.topicSlug)));
      expect(explorationForRoadmap(subject)).toEqual({
        href: `${LOGIC_LAB_URL}?subject=${subject}`,
        label: "Explore logic, counterexamples and proofs",
      });
    }
    expect(LOGIC_LESSONS).toHaveLength(12);
    expect(metadata.title).toBe("Logic and Proof Lab — BrainHub");
    expect(explorationForLesson("real-analysis", "unimplemented-topic")).toBeNull();
    expect(explorationForLesson("discrete-math", "suprema-infima-and-order")).toBeNull();
    expect(explorationForLesson("calculus", "suprema-infima-and-order")).toBeNull();
    expect(explorationForRoadmap("constructor")).toBeNull();
  });

  it.each(LOGIC_LESSONS)("opens $roadmap/$topic in its $mode experiment", async (lesson) => {
    render(
      await LogicLabPage({
        searchParams: Promise.resolve({ subject: lesson.roadmap, lesson: lesson.topic }),
      }),
    );
    expect(screen.getByRole("heading", { name: "Logic and Proof Lab", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Experiment" })).toHaveValue(lesson.mode);
    const label =
      lesson.roadmap === "real-analysis" ? "Real analysis curriculum" : "Discrete math curriculum";
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", `/roadmaps/${lesson.roadmap}`);
    expect(screen.getByText(/This local lab does not save scores/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, undefined],
    ["unknown", undefined],
    [["suprema-infima-and-order"], "real-analysis"],
    [null, "real-analysis"],
    [{ topic: "suprema-infima-and-order" }, "real-analysis"],
    ["suprema-infima-and-order", "discrete-math"],
    ["suprema-infima-and-order", "unknown"],
    ["suprema-infima-and-order", ["real-analysis"]],
    ["suprema-infima-and-order", null],
    ["constructor", "real-analysis"],
  ])("defaults safely for malformed or mismatched lesson/context (%j, %j)", (topic, subject) => {
    expect(logicExperimentForTopic(topic, subject)).toBe("truth");
  });

  it("uses exact topic matches without a context and never accepts a topic from another subject", () => {
    for (const lesson of LOGIC_LESSONS) expect(logicExperimentForTopic(lesson.topic)).toBe(lesson.mode);
    expect(logicExperimentForTopic("Suprema-Infima-And-Order", "real-analysis")).toBe("truth");
    expect(logicExperimentForTopic("suprema-infima-and-order ", "real-analysis")).toBe("truth");
  });

  it.each(LOGIC_LESSONS)(
    "links the actual authored $roadmap/$topic lesson to the correct lab",
    async (topic) => {
      const lesson: Lesson = {
        roadmap_slug: topic.roadmap,
        topic_slug: topic.topic,
        title: topic.title,
        summary: "An authored mathematical foundation lesson.",
        objectives: ["State assumptions and justify the conclusion."],
        sections: [{ heading: "Definition", body: "Use the precise stated domain." }],
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
          <AuthoredLesson roadmapSlug={topic.roadmap} topicSlug={topic.topic} accent="#fbbf24" />
        </RoadmapProgressProvider>,
      );
      expect(await screen.findByRole("link", { name: "Open this experiment" })).toHaveAttribute(
        "href",
        `${LOGIC_LAB_URL}?subject=${topic.roadmap}&lesson=${encodeURIComponent(topic.topic)}`,
      );
    },
  );

  it.each(["real-analysis", "discrete-math"])("offers the lab on the %s overview", async (subject) => {
    render(
      <RoadmapProgressProvider>
        {await RoadmapPage({ params: Promise.resolve({ slug: subject }) })}
      </RoadmapProgressProvider>,
    );
    expect(screen.getByRole("link", { name: "Explore logic, counterexamples and proofs" })).toHaveAttribute(
      "href",
      `${LOGIC_LAB_URL}?subject=${subject}`,
    );
  });

  it("provides both curriculum links on the shared page without requiring an account provider", async () => {
    render(await LogicLabPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("link", { name: "Real analysis curriculum" })).toHaveAttribute(
      "href",
      "/roadmaps/real-analysis",
    );
    expect(screen.getByRole("link", { name: "Discrete math curriculum" })).toHaveAttribute(
      "href",
      "/roadmaps/discrete-math",
    );
    expect(screen.getByRole("combobox", { name: "Experiment" })).toHaveValue("truth");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a malformed subject while retaining safe public navigation", async () => {
    render(
      await LogicLabPage({
        searchParams: Promise.resolve({ subject: ["real-analysis"], lesson: "suprema-infima-and-order" }),
      }),
    );
    expect(screen.getByRole("combobox", { name: "Experiment" })).toHaveValue("truth");
    expect(screen.getByRole("link", { name: "Real analysis curriculum" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Discrete math curriculum" })).toBeInTheDocument();
  });
});
