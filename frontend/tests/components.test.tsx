import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameCard } from "@/components/game-card";
import { MentalMathGame } from "@/components/games/mental-math-game";
import { games } from "@/lib/games";

afterEach(() => vi.unstubAllGlobals());

describe("training UI", () => {
  it("registers all eleven playable games", () => expect(games).toHaveLength(11));

  it("renders registry-driven game metadata and play link", () => {
    render(<GameCard game={games[0]!} index={0} best={820} recent={740} />);
    expect(screen.getByRole("heading", { name: "Pattern Recognition" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Play Pattern Recognition" })).toHaveAttribute(
      "href",
      "/games/pattern-recognition",
    );
    expect(screen.getByText("820")).toBeInTheDocument();
  });

  it("moves mental math from instructions into keyboard input", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline test")));
    render(<MentalMathGame />);
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));
    expect(screen.getByRole("textbox", { name: "Answer" })).toHaveFocus();
  });
});
