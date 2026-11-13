import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConceptPerformancePanel } from "@/components/roadmaps/concept-performance";
import type { ConceptMetrics, ConceptPerformance } from "@/lib/curriculum";

const dates = [
  "2026-10-30",
  "2026-10-31",
  "2026-11-01",
  "2026-11-02",
  "2026-11-03",
  "2026-11-04",
  "2026-11-05",
  "2026-11-06",
  "2026-11-07",
  "2026-11-08",
  "2026-11-09",
  "2026-11-10",
  "2026-11-11",
  "2026-11-12",
];
const empty: ConceptMetrics = {
  answers: 0,
  correct: 0,
  accuracy: null,
  incorrect: 0,
  questions_seen: 0,
  independent: { answers: 0, correct: 0, accuracy: null },
  assisted: { answers: 0, correct: 0, accuracy: null },
  untracked: { answers: 0, correct: 0, accuracy: null },
};
const mixed: ConceptMetrics = {
  answers: 7,
  correct: 2,
  accuracy: 29,
  incorrect: 5,
  questions_seen: 4,
  independent: { answers: 2, correct: 1, accuracy: 50 },
  assisted: { answers: 3, correct: 1, accuracy: 33 },
  untracked: { answers: 2, correct: 0, accuracy: 0 },
};

function performance(concepts?: ConceptPerformance["concepts"]): ConceptPerformance {
  return {
    generated_at: "2026-11-12T00:05:00Z",
    window: { days: 14, start_at: "2026-10-30T00:00:00Z", end_at: "2026-11-12T00:05:00Z", timezone: "UTC" },
    totals: mixed,
    concepts: concepts ?? [
      {
        ...mixed,
        roadmap_slug: "linear-algebra",
        topic_slug: "vector-arithmetic-and-linear-combinations",
        concept: "Scalar multiplication",
        latest_attempt_at: "2026-11-12T00:01:00Z",
      },
    ],
    trend: dates.map((date, index) => ({ ...(index === 13 ? mixed : empty), date })),
  };
}

function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("concept performance evidence", () => {
  it("keeps incorrect answers in each assistance bucket's denominator", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(performance())));
    render(<ConceptPerformancePanel />);

    const table = await screen.findByRole("region", { name: "Concept performance table" });
    const row = within(table).getByRole("row", { name: /Scalar multiplication/ });
    expect(within(row).getByText("2/7 correct · 29%")).toBeVisible();
    expect(within(row).getByText("1/2 correct · 50%")).toBeVisible();
    expect(within(row).getByText("1/3 correct · 33%")).toBeVisible();
    expect(within(row).getByText("0/2 correct · 0%")).toBeVisible();
    expect(within(row).queryByText("1/1 correct · 100%")).not.toBeInTheDocument();
  });

  it("renders all fourteen UTC dates and distinguishes no evidence from zero accuracy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(performance())));
    render(<ConceptPerformancePanel />);

    const trend = await screen.findByRole("region", { name: "UTC daily performance trend" });
    expect(within(trend).getAllByRole("row")).toHaveLength(15);
    for (const date of dates) expect(within(trend).getByRole("rowheader", { name: date })).toBeVisible();
    const emptyDay = within(trend).getByRole("row", { name: /^2026-10-30 / });
    expect(within(emptyDay).getAllByText(/No answers/)).toHaveLength(4);
    expect(within(emptyDay).queryByText("0%")).not.toBeInTheDocument();
    const answeredDay = within(trend).getByRole("row", { name: /^2026-11-12 / });
    expect(within(answeredDay).getByText("0/2 correct · 0%")).toBeVisible();
    expect(within(trend).getByText("14-day answer trend (UTC)")).toBeVisible();
  });

  it("renders equally named concepts from distinct subjects and lessons without row key collisions", async () => {
    const concepts = [
      {
        ...mixed,
        roadmap_slug: "linear-algebra",
        topic_slug: "first-lesson",
        concept: "Shared concept",
        latest_attempt_at: "2026-11-12T00:01:00Z",
      },
      {
        ...mixed,
        roadmap_slug: "linear-algebra",
        topic_slug: "second-lesson",
        concept: "Shared concept",
        latest_attempt_at: "2026-11-12T00:02:00Z",
      },
      {
        ...mixed,
        roadmap_slug: "probability",
        topic_slug: "first-lesson",
        concept: "Shared concept",
        latest_attempt_at: "2026-11-12T00:03:00Z",
      },
    ];
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(performance(concepts))));
    render(<ConceptPerformancePanel />);
    const table = await screen.findByRole("region", { name: "Concept performance table" });
    expect(within(table).getAllByRole("rowheader", { name: "Shared concept" })).toHaveLength(3);
    expect(within(table).getAllByText("first lesson")).toHaveLength(2);
    expect(within(table).getByText("second lesson")).toBeVisible();

    expect(errors.mock.calls.flat().join(" ")).not.toMatch(/same key|unique.*key/i);
  });

  it("binds the query to the selected subject and ignores a late response from the old subject", async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    const oldResponse = new Promise<ReturnType<typeof response>>((resolve) => {
      resolveOld = resolve;
    });
    const oldData = performance([
      {
        ...mixed,
        roadmap_slug: "linear-algebra",
        topic_slug: "old-lesson",
        concept: "Old algebra concept",
        latest_attempt_at: "2026-11-12T00:01:00Z",
      },
    ]);
    const newData = performance([
      {
        ...mixed,
        roadmap_slug: "probability",
        topic_slug: "new-lesson",
        concept: "New probability concept",
        latest_attempt_at: "2026-11-12T00:01:00Z",
      },
    ]);
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("days")).toBe("14");
      return url.searchParams.get("roadmap_slug") === "linear-algebra"
        ? oldResponse
        : Promise.resolve(response(newData));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<ConceptPerformancePanel roadmapSlug="linear-algebra" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    rerender(<ConceptPerformancePanel roadmapSlug="probability" />);
    expect(await screen.findByRole("rowheader", { name: "New probability concept" })).toBeVisible();
    expect(new URL(String(fetchMock.mock.calls[1]![0])).searchParams.get("roadmap_slug")).toBe("probability");

    await act(async () => {
      resolveOld(response(oldData));
      await oldResponse;
    });
    expect(screen.getByRole("rowheader", { name: "New probability concept" })).toBeVisible();
    expect(screen.queryByRole("rowheader", { name: "Old algebra concept" })).not.toBeInTheDocument();
  });

  it("shows a failed request and recovers with the same subject on retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ detail: "Performance temporarily unavailable" }, 503))
      .mockResolvedValueOnce(response(performance([])));
    vi.stubGlobal("fetch", fetchMock);
    render(<ConceptPerformancePanel roadmapSlug="discrete-math" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Performance temporarily unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry concept performance" }));
    expect(await screen.findByText("No graded answers in this time window.")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    for (const [input] of fetchMock.mock.calls) {
      expect(new URL(String(input)).searchParams.get("roadmap_slug")).toBe("discrete-math");
    }
  });
});
