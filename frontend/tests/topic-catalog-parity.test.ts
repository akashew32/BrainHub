import { describe, expect, it } from "vitest";
import catalog from "../../backend/app/roadmaps/catalog.json";
import { learningRoadmaps } from "@/lib/roadmaps";
import { slugifyTopic } from "@/lib/roadmap-utils";

describe("packaged public topic catalog parity", () => {
  it("matches actual TypeScript topic identifiers rather than trusting the generator's parser", () => {
    const expected = Object.fromEntries(
      learningRoadmaps.map((roadmap) => [
        roadmap.slug,
        roadmap.stages.flatMap((stage) => stage.topics.map(slugifyTopic)),
      ]),
    );
    expect(catalog).toEqual({ roadmaps: expected });
    expect(Object.values(expected).flat()).toHaveLength(300);
    const keys = Object.entries(expected).flatMap(([subject, topics]) =>
      topics.map((topic) => `${subject}:${topic}`),
    );
    expect(new Set(keys).size).toBe(300);
    expect(Object.values(expected).every((topics) => topics.length === 60)).toBe(true);
  });

  it("preserves same-titled topics as different subject identities", () => {
    const topic = "direct-contrapositive-and-contradiction-proofs";
    expect(catalog.roadmaps["real-analysis"]).toContain(topic);
    expect(catalog.roadmaps["discrete-math"]).toContain(topic);
    expect(`real-analysis:${topic}`).not.toBe(`discrete-math:${topic}`);
  });
});
