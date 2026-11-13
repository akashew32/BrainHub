import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { RoadmapProgressProvider, useRoadmapProgress } from "@/components/roadmaps/roadmap-progress-provider";
import type { AssessmentResult, AssessmentSession } from "@/lib/curriculum";
import type { RoadmapProgressItem } from "@/lib/roadmap-progress";

const CACHE = "brainhub:roadmap-progress:v3";
const LEGACY_CACHE = "brainhub:roadmap-progress:v2";
const topic = "vector-arithmetic-and-linear-combinations";
const progressItem: RoadmapProgressItem = {
  roadmap_slug: "linear-algebra",
  topic_slug: topic,
  status: "completed",
  quiz_score: 100,
  quiz_attempts: 2,
  time_spent_seconds: 120,
  last_viewed_at: "2026-11-12T14:00:00Z",
  completed_at: "2026-11-12T14:00:00Z",
};

function response(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload };
}

function progressResponse(items: RoadmapProgressItem[]) {
  return response({
    items,
    summary: {
      total: 300,
      started: items.length,
      completed: items.length,
      average_quiz_score: items.length ? 100 : 0,
      time_spent_seconds: 120 * items.length,
      roadmaps: [],
    },
  });
}

function ProgressConsumer() {
  const { progress, ready, syncState } = useRoadmapProgress();
  const item = progress.get("linear-algebra:" + topic);
  return (
    <>
      <output aria-label="Progress readiness">{ready ? "ready" : "loading"}</output>
      <output aria-label="Progress synchronization">{syncState}</output>
      <output aria-label="Best practice score">{item?.quiz_score ?? "missing"}</output>
      <output aria-label="Independent score">
        {typeof item?.independent_score === "number" ? item.independent_score : "untracked"}
      </output>
    </>
  );
}

function renderProgress() {
  return render(
    <RoadmapProgressProvider>
      <ProgressConsumer />
    </RoadmapProgressProvider>,
  );
}

beforeEach(() => localStorage.clear());

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("independent practice evidence", () => {
  it("does not let a legacy v2 cache establish an independent score while offline", async () => {
    // Old releases had no trustworthy hint tracking, even if a cache entry now
    // happens to contain a similarly named field.
    localStorage.setItem(LEGACY_CACHE, JSON.stringify([{ ...progressItem, independent_score: 100 }]));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));

    renderProgress();

    await waitFor(() => expect(screen.getByLabelText("Progress readiness")).toHaveTextContent("ready"));
    expect(screen.getByLabelText("Progress synchronization")).toHaveTextContent("offline");
    expect(screen.getByLabelText("Best practice score")).toHaveTextContent("100");
    expect(screen.getByLabelText("Independent score")).toHaveTextContent("untracked");
    await waitFor(() => {
      const migrated = JSON.parse(localStorage.getItem(CACHE)!);
      expect(migrated[0].independent_score).toBeNull();
      expect(migrated[0].quiz_score).toBe(100);
    });
  });

  it("preserves a recorded zero independent score from the current cache", async () => {
    localStorage.setItem(CACHE, JSON.stringify([{ ...progressItem, independent_score: 0 }]));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));

    renderProgress();

    await waitFor(() => expect(screen.getByLabelText("Progress readiness")).toHaveTextContent("ready"));
    expect(screen.getByLabelText("Best practice score")).toHaveTextContent("100");
    expect(screen.getByLabelText("Independent score")).toHaveTextContent(/^0$/);
    expect(JSON.parse(localStorage.getItem(CACHE)!)[0].independent_score).toBe(0);
  });

  it("lets explicit server uncertainty replace a cached independent claim", async () => {
    localStorage.setItem(CACHE, JSON.stringify([{ ...progressItem, independent_score: 88 }]));
    let finishFetch!: (value: ReturnType<typeof progressResponse>) => void;
    const pending = new Promise<ReturnType<typeof progressResponse>>((resolve) => {
      finishFetch = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending),
    );
    renderProgress();

    await waitFor(() => expect(screen.getByLabelText("Independent score")).toHaveTextContent("88"));
    expect(screen.getByLabelText("Progress readiness")).toHaveTextContent("loading");

    await act(async () => {
      finishFetch(
        progressResponse([
          {
            ...progressItem,
            independent_score: null,
            last_viewed_at: "2026-11-12T15:00:00Z",
          },
        ]),
      );
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Progress synchronization")).toHaveTextContent("synced"),
    );
    expect(screen.getByLabelText("Independent score")).toHaveTextContent("untracked");
    expect(screen.getByLabelText("Best practice score")).toHaveTextContent("100");
    expect(JSON.parse(localStorage.getItem(CACHE)!)[0].independent_score).toBeNull();
  });

  it("never derives independent evidence from a perfect legacy API quiz score", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => progressResponse([progressItem])),
    );
    renderProgress();

    await waitFor(() => expect(screen.getByLabelText("Progress readiness")).toHaveTextContent("ready"));
    expect(screen.getByLabelText("Best practice score")).toHaveTextContent("100");
    expect(screen.getByLabelText("Independent score")).toHaveTextContent("untracked");
    const saved = JSON.parse(localStorage.getItem(CACHE)!)[0];
    expect(saved.quiz_score).toBe(100);
    expect(saved.independent_score == null).toBe(true);
  });

  it("labels a successful legacy result without assistance metadata as untracked", async () => {
    const session: AssessmentSession = {
      id: "legacy-untracked-session",
      mode: "practice",
      roadmap_slug: "linear-algebra",
      topic_slug: topic,
      expires_at: "2099-01-01T00:00:00Z",
      pass_score: 75,
      questions: [
        {
          id: "legacy-scalar-question",
          kind: "number",
          prompt: "Compute $1+1$.",
          concept: "Scalar arithmetic",
          difficulty: "foundation",
          hints: [],
          topic_slug: topic,
          lesson_title: "Vector arithmetic and linear combinations",
        },
      ],
    };
    const legacyResult: AssessmentResult = {
      session_id: session.id,
      mode: "practice",
      score: 100,
      passed: true,
      correct: 1,
      total: 1,
      progress: null,
      feedback: [
        {
          question_id: session.questions[0]!.id,
          prompt: session.questions[0]!.prompt,
          concept: "Scalar arithmetic",
          correct: true,
          submitted_answer: "2",
          expected_answer: 2,
          solution: "Adding one and one gives two.",
          topic_slug: topic,
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/roadmaps/progress")) return progressResponse([]);
        if (url.endsWith("/assessments") && init?.method === "POST") return response(session);
        if (url.endsWith("/" + session.id + "/submit")) return response(legacyResult);
        throw new Error("Unexpected request: " + url);
      }),
    );
    render(
      <RoadmapProgressProvider>
        <AssessmentPanel roadmapSlug="linear-algebra" topicSlug={topic} />
      </RoadmapProgressProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Answer to question 1" }), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));

    expect(await screen.findByRole("status")).toHaveTextContent("100%");
    expect(screen.getByText("Hint usage was not recorded for this older attempt.")).toBeVisible();
    expect(screen.getByText("Hint usage untracked")).toBeInTheDocument();
    expect(screen.queryByText(/Independent score:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Independent practice passed/)).not.toBeInTheDocument();
  });
});
