import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RoadmapDetailPage from "@/app/roadmaps/[slug]/page";
import RoadmapsPage from "@/app/roadmaps/page";
import { learningRoadmaps, roadmapCounts } from "@/lib/roadmaps";

afterEach(cleanup);

describe("learning roadmaps", () => {
  it("contains five exhaustive tracks with advanced depth", () => {
    expect(roadmapCounts).toEqual({ roadmaps: 5, stages: 50, topics: 300 });
    expect(new Set(learningRoadmaps.map((roadmap) => roadmap.slug)).size).toBe(5);
    for (const roadmap of learningRoadmaps) {
      expect(roadmap.stages).toHaveLength(10);
      expect(roadmap.stages.every((stage) => stage.topics.length === 6)).toBe(true);
      expect(roadmap.stages.some((stage) => stage.level === "Graduate")).toBe(true);
      expect(roadmap.prerequisites).toHaveLength(4);
      expect(roadmap.outcomes).toHaveLength(4);
    }
  });

  it("links every overview card to its detailed outline", () => {
    render(<RoadmapsPage />);
    for (const roadmap of learningRoadmaps) {
      const link = screen.getByRole("link", { name: new RegExp(roadmap.title) });
      expect(link).toHaveAttribute("href", `/roadmaps/${roadmap.slug}`);
    }
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("Graduate")).toBeInTheDocument();
  });

  it("renders the full probability sequence with checkpoints", async () => {
    const page = await RoadmapDetailPage({ params: Promise.resolve({ slug: "probability" }) });
    render(page);
    expect(screen.getByRole("heading", { name: "Probability", level: 1 })).toBeInTheDocument();
    const stageNavigation = screen.getByRole("navigation", { name: "Probability roadmap stages" });
    expect(within(stageNavigation).getAllByRole("link")).toHaveLength(10);
    expect(screen.getByText("Martingale convergence theorems")).toBeInTheDocument();
    expect(screen.getAllByText("Readiness checkpoint")).toHaveLength(10);
  });
});
