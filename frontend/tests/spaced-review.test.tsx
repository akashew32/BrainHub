import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MistakeReview } from "@/components/roadmaps/mistake-review";
import { LearningSummary } from "@/components/roadmaps/learning-summary";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import { learningRoadmaps } from "@/lib/roadmaps";
import type { AssessmentResult, AssessmentSession, ReviewItem, ReviewPlan } from "@/lib/curriculum";

function item(id = "linear-recall", slug = "linear-algebra"): ReviewItem {
  return {
    question_id: id,
    roadmap_slug: slug,
    topic_slug: "vector-arithmetic-and-linear-combinations",
    lesson_title: "Vector arithmetic and linear combinations",
    concept: id === "linear-recall" ? "Scalar multiplication" : "Counting outcomes",
    last_correct: false,
    attempts: 2,
    last_attempt_at: "2026-11-12T00:05:00",
    due_at: "2026-11-12T00:05:00Z",
    reason: "Try this question again without hints.",
    prompt: "Find $x$ when $2x=2$.",
    status: "assisted",
    independent_streak: 0,
    interval_days: 0,
    is_due: true,
    last_hints_used: 1,
  };
}

function plan(items: ReviewItem[] = [], upcoming: ReviewItem[] = []): ReviewPlan {
  const all = [...items, ...upcoming];
  return {
    generated_at: "2026-11-12T23:55:00Z",
    policy: {
      version: 1,
      interval_days: [1, 3, 7, 14, 30, 60, 90],
      session_limit: 8,
      timezone: "UTC",
      early_practice_advances: false,
    },
    summary: {
      due: items.length,
      scheduled: upcoming.length,
      tracked: all.length,
      unseen: 300 - all.length,
      reviewed_today: 0,
      independent_today: 0,
      next_due_at: upcoming[0]?.due_at ?? null,
    },
    subjects: learningRoadmaps.map(({ slug }) => ({
      slug,
      due: items.filter((entry) => entry.roadmap_slug === slug).length,
      scheduled: upcoming.filter((entry) => entry.roadmap_slug === slug).length,
      tracked: all.filter((entry) => entry.roadmap_slug === slug).length,
      unseen: 60 - all.filter((entry) => entry.roadmap_slug === slug).length,
      next_due_at: upcoming.find((entry) => entry.roadmap_slug === slug)?.due_at ?? null,
    })),
    items,
    upcoming,
  };
}

const assessment: AssessmentSession = {
  id: "daily-review-session",
  mode: "review",
  roadmap_slug: "linear-algebra",
  topic_slug: null,
  expires_at: "2099-01-01T00:00:00Z",
  pass_score: 75,
  hint_usage: {},
  questions: [
    {
      id: "linear-recall",
      kind: "number",
      prompt: "Find $x$ when $2x=2$.",
      hints: [],
      hint_count: 2,
      concept: "Scalar multiplication",
      difficulty: "foundation",
      topic_slug: "vector-arithmetic-and-linear-combinations",
      lesson_title: "Vector arithmetic and linear combinations",
    },
  ],
};
const result: AssessmentResult = {
  session_id: assessment.id,
  mode: "review",
  score: 100,
  passed: true,
  correct: 1,
  total: 1,
  assistance: "independent",
  independent_score: 100,
  independent_passed: true,
  progress: null,
  feedback: [
    {
      question_id: "linear-recall",
      prompt: assessment.questions[0]!.prompt,
      concept: "Scalar multiplication",
      correct: true,
      submitted_answer: "1",
      expected_answer: 1,
      solution: "Divide both sides by two, giving $x=1$.",
      topic_slug: "vector-arithmetic-and-linear-combinations",
      assistance: "independent",
      hints_used: 0,
    },
  ],
};

function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}
function mockApi({
  getPlan = async () => plan([item()]),
  onSubmit = () => {},
  resumed = assessment,
}: {
  getPlan?: () => Promise<ReviewPlan>;
  onSubmit?: () => void;
  resumed?: AssessmentSession;
} = {}) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/roadmaps/progress")) return response({ items: [], summary: {} });
    if (url.endsWith("/review-plan")) return response(await getPlan());
    if (url.endsWith("/learning-stats"))
      return response({ answers: 19, correct: 10, accuracy: 53, concepts_to_review: 4, exams: [] });
    if (url.endsWith("/assessments") && init?.method === "POST") return response(assessment);
    if (url.endsWith("/" + assessment.id)) return response(resumed);
    if (url.endsWith("/draft")) return response({ ...assessment, draft: JSON.parse(String(init?.body)) });
    if (url.endsWith("/submit")) {
      onSubmit();
      return response(result);
    }
    throw new Error("Unexpected spaced-review request: " + url);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
function renderReview() {
  return render(
    <RoadmapProgressProvider>
      <MistakeReview />
    </RoadmapProgressProvider>,
  );
}
async function openReview() {
  fireEvent.click(await screen.findByRole("button", { name: "Open Linear Algebra review" }));
  fireEvent.click(await screen.findByRole("button", { name: "Start review" }));
  return screen.findByRole("textbox", { name: "Answer to question 1" });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("daily spaced review", () => {
  it("keeps matching question IDs distinct across subjects while filtering due and upcoming cards", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const discrete = { ...item("shared-proof", "discrete-math"), concept: "Discrete proof" };
    const analysis = { ...item("shared-proof", "real-analysis"), concept: "Analysis proof" };
    const upcomingDiscrete: ReviewItem = {
      ...item("shared-future", "discrete-math"),
      concept: "Upcoming discrete proof",
      is_due: false,
      status: "recall",
      interval_days: 1,
    };
    const upcomingAnalysis: ReviewItem = {
      ...upcomingDiscrete,
      roadmap_slug: "real-analysis",
      concept: "Upcoming analysis proof",
    };
    mockApi({ getPlan: async () => plan([discrete, analysis], [upcomingDiscrete, upcomingAnalysis]) });
    renderReview();
    await screen.findByRole("heading", { name: "Discrete proof" });
    expect(screen.getByRole("heading", { name: "Analysis proof" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upcoming discrete proof" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upcoming analysis proof" })).toBeInTheDocument();
    const filters = screen.getByRole("group", { name: "Filter review questions by subject" });
    fireEvent.click(within(filters).getByRole("button", { name: "Real Analysis" }));
    expect(screen.queryByRole("heading", { name: "Discrete proof" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Upcoming discrete proof" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Analysis proof" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upcoming analysis proof" })).toBeInTheDocument();
    fireEvent.click(within(filters).getByRole("button", { name: "All subjects" }));
    expect(screen.getByRole("heading", { name: "Discrete proof" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upcoming discrete proof" })).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("shows accessible loading, all five subjects, and a distinct first-practice state", async () => {
    let resolve!: (value: ReviewPlan) => void;
    mockApi({
      getPlan: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    renderReview();
    expect(screen.getByRole("status")).toHaveTextContent("Loading your daily review plan");
    await act(async () => resolve(plan()));
    expect(
      await screen.findByRole("heading", { name: "Build your first review schedule" }),
    ).toBeInTheDocument();
    const subjects = screen.getByRole("region", { name: "Review by subject" });
    for (const roadmap of learningRoadmaps) {
      expect(within(subjects).getByRole("heading", { name: roadmap.title })).toBeInTheDocument();
      expect(within(subjects).getByRole("button", { name: `Open ${roadmap.title} review` })).toBeEnabled();
    }
    expect(screen.getByText(/up to 8 due questions from one subject/)).toBeInTheDocument();
    expect(screen.getByText(/Practising early does not change/)).toBeInTheDocument();
  });

  it("distinguishes future-only recall from a new learner and formats naive and offset dates in UTC", async () => {
    const upcoming = {
      ...item(),
      status: "recall" as const,
      interval_days: 3,
      independent_streak: 2,
      is_due: false,
      due_at: "2026-11-13T02:15:00+02:00",
    };
    mockApi({ getPlan: async () => plan([], [upcoming]) });
    renderReview();
    expect(await screen.findByRole("heading", { name: "Nothing is due right now" })).toBeInTheDocument();
    expect(screen.queryByText("Build your first review schedule")).not.toBeInTheDocument();
    expect(screen.getByText(/Next scheduled review: Nov 13, 2026, 12:15 AM UTC/)).toBeInTheDocument();
    expect(screen.getByText("Nov 12, 2026, 12:05 AM UTC")).toBeInTheDocument();
    expect(screen.getByText(/3 days · 2 recorded answers/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Linear Algebra review" }));
    expect(await screen.findByRole("button", { name: "Start review" })).toBeDisabled();
  });

  it("filters due and upcoming cards by subject while keeping untracked assistance explicit", async () => {
    const legacy = {
      ...item("probability-recall", "probability"),
      status: "untracked" as const,
      reason: "Hint usage was not recorded for this answer.",
      last_hints_used: null,
    };
    mockApi({ getPlan: async () => plan([item(), legacy]) });
    renderReview();
    await screen.findByText("Previous hint usage untracked · Probability");
    expect(screen.getByText(legacy.reason)).toBeInTheDocument();
    const filters = screen.getByRole("group", { name: "Filter review questions by subject" });
    fireEvent.click(within(filters).getByRole("button", { name: "Probability" }));
    expect(within(filters).getByRole("button", { name: "Probability" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("heading", { name: "Counting outcomes" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Scalar multiplication" })).not.toBeInTheDocument();
    expect(screen.getByText(/1 due question in this view/)).toBeInTheDocument();
    fireEvent.click(within(filters).getByRole("button", { name: "All subjects" }));
    expect(screen.getByRole("heading", { name: "Scalar multiplication" })).toBeInTheDocument();
  });

  it("retries an initial network failure without inventing a zero-due plan", async () => {
    let requests = 0;
    mockApi({
      getPlan: async () => {
        if (++requests === 1) throw new Error("Review service offline");
        return plan([item()]);
      },
    });
    renderReview();
    expect(await screen.findByRole("alert")).toHaveTextContent("Review service offline");
    expect(screen.queryByText("Nothing is due right now")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry review plan" }));
    expect(await screen.findByRole("heading", { name: "Your daily review plan" })).toBeInTheDocument();
    expect(requests).toBe(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("refreshes after actual server grading and retains feedback when the due queue reaches zero", async () => {
    let graded = false;
    const scheduled = {
      ...item(),
      status: "recall" as const,
      is_due: false,
      interval_days: 1,
      independent_streak: 1,
      due_at: "2026-11-13T23:55:00Z",
    };
    const after = plan([], [scheduled]);
    after.summary.reviewed_today = 1;
    after.summary.independent_today = 1;
    const mock = mockApi({
      getPlan: async () => (graded ? after : plan([item()])),
      onSubmit: () => {
        graded = true;
      },
    });
    renderReview();
    const input = await openReview();
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));
    expect(await screen.findByText("Assessment passed. Your responses have been saved.")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Nothing is due right now" })).toBeInTheDocument();
    expect(screen.getByText("Question 1: Correct · Scalar multiplication")).toBeInTheDocument();
    expect(screen.getByText(/Divide both sides by two, giving/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start another session" })).toBeDisabled();
    const summary = screen.getByRole("region", { name: "Your daily review plan" });
    expect(within(summary).getByText("Due now").nextElementSibling).toHaveTextContent("0");
    expect(within(summary).getByText("Independent recalls today (UTC)").nextElementSibling).toHaveTextContent(
      "1",
    );
    expect(mock.mock.calls.filter(([url]) => String(url).endsWith("/review-plan"))).toHaveLength(2);
    const submission = mock.mock.calls.find(([url]) => String(url).endsWith("/submit"));
    expect(JSON.parse(String(submission?.[1]?.body)).answers).toEqual([
      { question_id: "linear-recall", answer: "1" },
    ]);
  });

  it("preserves an active raw answer and the stale plan when a refresh fails, then retries", async () => {
    let requests = 0;
    mockApi({
      getPlan: async () => {
        if (++requests === 2) throw new Error("Connection lost");
        return plan([item()]);
      },
    });
    renderReview();
    const input = await openReview();
    fireEvent.change(input, { target: { value: "1/" } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh review plan" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your last loaded plan and current assessment remain available",
    );
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue("1/");
    expect(screen.getByRole("button", { name: "Submit review" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry review plan" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue("1/");
  });

  it("allows a zero-due subject to restore an active draft and submit it", async () => {
    localStorage.setItem(
      "brainhub:assessment:v2:linear-algebra:review:stage-0",
      JSON.stringify({
        version: 2,
        sessionId: assessment.id,
        roadmapSlug: "linear-algebra",
        topicSlug: null,
        stageIndex: 0,
        mode: "review",
        answers: { "linear-recall": "1/" },
        startedAt: Date.now() - 10_000,
        revision: 1,
        session: assessment,
      }),
    );
    mockApi({
      getPlan: async () => plan([], [{ ...item(), is_due: false, due_at: "2026-11-13T00:00:00Z" }]),
    });
    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: "Open Linear Algebra review" }));
    expect(await screen.findByRole("textbox", { name: "Answer to question 1" })).toHaveValue("1/");
    expect(screen.getByRole("button", { name: "Submit review" })).toBeEnabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Answer to question 1" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));
    expect(await screen.findByText("Assessment passed. Your responses have been saved.")).toBeInTheDocument();
  });

  it("refreshes authoritative due counts on foreground return without resetting current answers", async () => {
    let current = plan([item()]);
    mockApi({ getPlan: async () => current });
    renderReview();
    const input = await openReview();
    fireEvent.change(input, { target: { value: "sqrt(" } });
    current = plan([]);
    fireEvent.focus(window);
    await screen.findByRole("heading", { name: "Build your first review schedule" });
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue("sqrt(");
    expect(screen.getByRole("button", { name: "Submit review" })).toBeEnabled();
  });

  it("uses a safe date fallback without rendering Invalid Date", async () => {
    mockApi({ getPlan: async () => plan([{ ...item(), due_at: "broken", last_attempt_at: "broken" }]) });
    renderReview();
    await screen.findByRole("heading", { name: "Scalar multiplication" });
    expect(screen.getAllByText("Date unavailable (UTC)")).toHaveLength(2);
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });

  it("shows server daily counts on the roadmap summary without deriving them from answer totals", async () => {
    const daily = plan([item()]);
    daily.summary.reviewed_today = 2;
    daily.summary.independent_today = 1;
    mockApi({ getPlan: async () => daily });
    render(<LearningSummary />);
    await screen.findByText("Review questions today (UTC)");
    expect(screen.getByText("Review questions today (UTC)").nextElementSibling).toHaveTextContent("2");
    expect(screen.getByText("Independent recalls today (UTC)").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Answers recorded").nextElementSibling).toHaveTextContent("19");
    expect(screen.getByRole("link", { name: "Daily review plan →" })).toHaveAttribute(
      "href",
      "/roadmaps/review",
    );
  });
});
