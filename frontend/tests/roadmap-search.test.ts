import { describe, expect, it } from "vitest";
import { bookmarkKey } from "@/lib/bookmarks";
import {
  buildRoadmapSearchIndex,
  filterRoadmapTopics,
  parseTopicFilters,
  topicAvailability,
} from "@/lib/roadmap-search";
import { learningRoadmaps } from "@/lib/roadmaps";
import { slugifyTopic } from "@/lib/roadmap-utils";

const index = buildRoadmapSearchIndex();
const authoredKeys = new Set(
  learningRoadmaps.flatMap((roadmap) =>
    roadmap.stages[0]!.topics.map((topic) => bookmarkKey(roadmap.slug, slugifyTopic(topic))),
  ),
);
const filters = (values: Record<string, string> = {}) => parseTopicFilters(values);

describe("public roadmap topic search", () => {
  it("builds the actual 300-topic index from all five current public roadmaps", () => {
    expect(index).toHaveLength(300);
    expect(new Set(index.map((topic) => topic.key)).size).toBe(300);
    for (const roadmap of learningRoadmaps)
      for (const [stageIndex, stage] of roadmap.stages.entries())
        for (const title of stage.topics) {
          const topicSlug = slugifyTopic(title),
            item = index.find((topic) => topic.key === bookmarkKey(roadmap.slug, topicSlug));
          expect(item).toMatchObject({
            topicTitle: title,
            roadmapTitle: roadmap.title,
            stageIndex,
            stageTitle: stage.title,
            level: stage.level,
            href: `/roadmaps/${roadmap.slug}/${topicSlug}`,
          });
        }
  });

  it("preserves distinct subject identities for duplicate topic slugs", () => {
    const shared = "direct-contrapositive-and-contradiction-proofs";
    expect(
      index
        .filter((topic) => topic.key.endsWith(":" + shared))
        .map((topic) => topic.key)
        .sort(),
    ).toEqual([`discrete-math:${shared}`, `real-analysis:${shared}`]);
    const saved = new Set([bookmarkKey("real-analysis", shared)]);
    const result = filterRoadmapTopics(index, filters({ saved: "bookmarked" }), {
      authoredKeys,
      bookmarkedKeys: saved,
    });
    expect(result.map((topic) => topic.key)).toEqual([bookmarkKey("real-analysis", shared)]);
  });

  it("normalizes Unicode accents, punctuation, case and surrounding whitespace", () => {
    const result = filterRoadmapTopics(
      index,
      filters({ q: "  ÍNCLUSION—EXCLUSION  ", subject: "probability" }),
      { authoredKeys },
    );
    expect(result.map((topic) => topic.key)).toContain("probability:inclusion-exclusion");
    const plain = filterRoadmapTopics(index, filters({ q: "inclusion exclusion", subject: "probability" }), {
      authoredKeys,
    });
    expect(result.map((topic) => topic.key)).toEqual(plain.map((topic) => topic.key));
    expect(
      filterRoadmapTopics(index, filters({ q: "vector arithmetic" }), { authoredKeys }).map(
        (topic) => topic.key,
      ),
    ).toContain("linear-algebra:vector-arithmetic-and-linear-combinations");
  });

  it("joins the 30 released lessons without classifying unknown availability as an outline", () => {
    expect(authoredKeys.size).toBe(30);
    expect(filterRoadmapTopics(index, filters({ availability: "authored" }), { authoredKeys })).toHaveLength(
      30,
    );
    expect(filterRoadmapTopics(index, filters({ availability: "outline" }), { authoredKeys })).toHaveLength(
      270,
    );
    expect(filterRoadmapTopics(index, filters({ availability: "unknown" }), { authoredKeys })).toHaveLength(
      0,
    );
    expect(filterRoadmapTopics(index, filters(), { authoredKeys: null })).toHaveLength(300);
    expect(
      filterRoadmapTopics(index, filters({ availability: "authored" }), { authoredKeys: null }),
    ).toHaveLength(0);
    expect(
      filterRoadmapTopics(index, filters({ availability: "outline" }), { authoredKeys: null }),
    ).toHaveLength(0);
    expect(
      filterRoadmapTopics(index, filters({ availability: "unknown" }), { authoredKeys: null }),
    ).toHaveLength(300);
    for (const topic of index) expect(topicAvailability(topic, null)).toBe("unknown");
  });

  it("combines subject, human stage number, level, availability and saved filters", () => {
    const saved = new Set(index.map((topic) => topic.key));
    const result = filterRoadmapTopics(
      index,
      filters({
        subject: "probability",
        stage: "1",
        level: "Foundation",
        availability: "authored",
        saved: "bookmarked",
      }),
      { authoredKeys, bookmarkedKeys: saved },
    );
    expect(result).toHaveLength(6);
    expect(
      result.every(
        (topic) =>
          topic.key.startsWith("probability:") && topic.stageIndex === 0 && topic.level === "Foundation",
      ),
    ).toBe(true);
    expect(
      filterRoadmapTopics(index, filters({ subject: "probability", stage: "2", availability: "outline" }), {
        authoredKeys,
      }),
    ).toHaveLength(6);
    expect(filterRoadmapTopics(index, filters({ stage: "10" }), { authoredKeys })).toHaveLength(30);
    expect(filterRoadmapTopics(index, filters({ level: "Graduate" }), { authoredKeys })).toEqual(
      index.filter((topic) => topic.level === "Graduate"),
    );
    expect(
      filterRoadmapTopics(index, filters({ saved: "bookmarked" }), {
        authoredKeys,
        bookmarkedKeys: new Set(),
      }),
    ).toEqual([]);
    expect(filterRoadmapTopics(index, filters({ q: "unfindable-zxyw-topic" }), { authoredKeys })).toEqual([]);
  });

  it("parses valid URL filters and safely defaults malformed and unknown values", () => {
    expect(parseTopicFilters({})).toEqual({
      q: "",
      subject: "all",
      stage: "all",
      level: "all",
      availability: "all",
      saved: "all",
    });
    const query = new URLSearchParams(
      "q=linear+maps&subject=linear-algebra&stage=1&level=Foundation&availability=authored&saved=bookmarked",
    );
    expect(parseTopicFilters(query)).toEqual({
      q: "linear maps",
      subject: "linear-algebra",
      stage: "1",
      level: "Foundation",
      availability: "authored",
      saved: "bookmarked",
    });
    const invalid = {
      subject: "unknown-subject",
      stage: "99",
      level: "Impossible",
      availability: "practice",
      saved: "yes",
    };
    expect(parseTopicFilters(invalid)).toEqual(parseTopicFilters({}));
    for (const stage of ["0", "-1", "1.5", "Infinity", "NaN", "../1", "01"])
      expect(parseTopicFilters({ stage }).stage).toBe("all");
  });
});
