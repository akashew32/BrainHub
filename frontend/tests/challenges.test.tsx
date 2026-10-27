import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChallengesPage from "@/app/challenges/page";
import RoadmapsPage from "@/app/roadmaps/page";
import { ChallengeWorkbench } from "@/components/challenges/challenge-workbench";
import { challengeCounts, codingChallenges } from "@/lib/challenges";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("coding challenges", () => {
  it("registers the requested difficulty mix and public metadata", () => {
    expect(challengeCounts).toEqual({
      total: 150,
      algorithms: 120,
      designs: 30,
      easy: 20,
      medium: 50,
      hard: 50,
    });
    expect(new Set(codingChallenges.map((challenge) => challenge.slug)).size).toBe(150);
    for (const challenge of codingChallenges) {
      expect(challenge.caseCount).toBe(20);
      expect(challenge.samples).toHaveLength(3);
      expect(challenge.starterCode.python).toContain("class Solution");
      expect(challenge.starterCode.java).toContain("class Solution");
      expect(challenge.starterCode.cpp).toContain("class Solution");
      expect(challenge.officialUrl).toBe(
        challenge.category === "Algorithm" ? `https://leetcode.com/problems/${challenge.slug}/` : null,
      );
    }
  });

  it("renders the challenge library and filters by difficulty", () => {
    render(<ChallengesPage />);
    expect(screen.getByRole("heading", { name: /Read the problem/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^Open / })).toHaveLength(150);
    fireEvent.click(screen.getByRole("button", { name: "Easy" }));
    expect(screen.getAllByRole("link", { name: /^Open / })).toHaveLength(20);
    fireEvent.click(
      within(screen.getByLabelText("Filter by difficulty")).getByRole("button", { name: "All" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Low-Level Design" }));
    expect(screen.getAllByRole("link", { name: /^Open / })).toHaveLength(30);
  });

  it("inserts four spaces at the editor selection when Tab is pressed", async () => {
    render(<ChallengeWorkbench challenge={codingChallenges[0]!} />);
    const editor = screen.getByRole("textbox", {
      name: "python solution editor",
    }) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "abc" } });
    editor.setSelectionRange(1, 1);
    fireEvent.keyDown(editor, { key: "Tab" });
    expect(editor.value).toBe("a    bc");
    await waitFor(() => expect(editor.selectionStart).toBe(5));
  });

  it("switches language drafts and renders sandbox output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: { id: 3, description: "Accepted" },
          terminal: "hello from solution",
          results: [
            { index: 0, passed: true, expected: "ab", actual: "ab" },
            { index: 1, passed: true, expected: "ax", actual: "ax" },
            { index: 2, passed: true, expected: "xy", actual: "xy" },
          ],
          passed: 3,
          total: 3,
          complete: true,
          time: "0.01",
          memory: 1024,
          provider: "Judge0 CE",
        }),
      }),
    );
    render(<ChallengeWorkbench challenge={codingChallenges[0]!} />);
    fireEvent.click(screen.getByRole("button", { name: "Java" }));
    expect(
      (screen.getByRole("textbox", { name: "java solution editor" }) as HTMLTextAreaElement).value,
    ).toContain("public String solve");
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(screen.getByText("hello from solution")).toBeInTheDocument());
    expect(screen.getByText(/3\/3 passed/)).toBeInTheDocument();
  });

  it("shows five explicitly unavailable roadmap tracks", () => {
    render(<RoadmapsPage />);
    for (const subject of ["Probability", "Linear Algebra", "Calculus", "Real Analysis", "Discrete Math"]) {
      expect(screen.getByRole("heading", { name: subject })).toBeInTheDocument();
    }
    expect(screen.getAllByText("Coming soon")).toHaveLength(5);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
