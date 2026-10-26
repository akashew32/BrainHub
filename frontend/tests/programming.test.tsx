import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProgrammingPage from "@/app/programming/page";
import { ProgrammingTrivia } from "@/components/programming/programming-trivia";
import { programmingMap, programmingTracks, selectProgrammingQuestions } from "@/lib/programming";

describe("programming training", () => {
  it("registers Java, Python, and C++ with balanced question banks", () => {
    expect(programmingTracks.map((track) => track.slug)).toEqual(["java", "python", "cpp"]);
    const ids = new Set<string>();
    for (const track of programmingTracks) {
      expect(track.questions).toHaveLength(10);
      expect(new Set(track.questions.map((question) => question.topic))).toEqual(
        new Set(["fundamentals", "function-calls"]),
      );
      for (const question of track.questions) {
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThan(question.choices.length);
        expect(ids.has(question.id)).toBe(false);
        ids.add(question.id);
      }
    }
  });

  it("keeps the Python track focused on the language rather than ML libraries", () => {
    const pythonContent = JSON.stringify(programmingMap.python.questions).toLowerCase();
    expect(pythonContent).not.toMatch(
      /numpy|pandas|scikit|sklearn|tensorflow|pytorch|torch|keras|matplotlib|seaborn/,
    );
  });

  it("builds mixed rounds with equal fundamentals and function calls", () => {
    const selected = selectProgrammingQuestions(programmingMap.java, "mixed", () => 0);
    expect(selected).toHaveLength(10);
    expect(selected.filter((question) => question.topic === "fundamentals")).toHaveLength(5);
    expect(selected.filter((question) => question.topic === "function-calls")).toHaveLength(5);
  });

  it("renders a separate programming dashboard with three language links", () => {
    render(<ProgrammingPage />);
    expect(screen.getByRole("heading", { name: "Programming trivia" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Practice Java" })).toHaveAttribute("href", "/programming/java");
    expect(screen.getByRole("link", { name: "Practice Python" })).toHaveAttribute(
      "href",
      "/programming/python",
    );
    expect(screen.getByRole("link", { name: "Practice C++" })).toHaveAttribute("href", "/programming/cpp");
  });

  it("starts a trivia round and explains an answered question", () => {
    render(<ProgrammingTrivia track={programmingMap.java} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Java trivia" }));
    fireEvent.click(screen.getByRole("button", { name: /^Answer A:/ }));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/Correct|Not quite/);
    expect(within(status).getByText("Why this is right")).toBeInTheDocument();
    expect(within(status).getByRole("button", { name: "Next question" })).toBeInTheDocument();
  });
});
