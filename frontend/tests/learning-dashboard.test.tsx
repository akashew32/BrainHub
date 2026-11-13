import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LearningDashboard } from "@/components/roadmaps/learning-dashboard";
import { AssessmentHistory } from "@/components/roadmaps/assessment-history";
import { learningRoadmaps } from "@/lib/roadmaps";
import { slugifyTopic } from "@/lib/roadmap-utils";
import type {
  AssessmentHistoryItem,
  AssessmentHistoryPage,
  ConceptMetrics,
  ConceptPerformance,
  ExamReadiness,
  ReviewPlan,
} from "@/lib/curriculum";

const activeId = "11111111-1111-4111-8111-111111111111";
const completedId = "22222222-2222-4222-8222-222222222222";
const topic = "vector-arithmetic-and-linear-combinations";
function historyItem(overrides: Partial<AssessmentHistoryItem> = {}): AssessmentHistoryItem {
  return {
    id: activeId,
    roadmap_slug: "linear-algebra",
    topic_slug: topic,
    stage_index: 0,
    mode: "practice",
    state: "active",
    started_at: "2026-11-12T00:05:00",
    completed_at: null,
    expires_at: "2026-11-13T00:05:00Z",
    question_count: 8,
    saved_entries: 1,
    result_available: false,
    result_summary: null,
    questions_available: true,
    open_url: "/roadmaps/sessions/" + activeId,
    study_url: "/roadmaps/linear-algebra/" + topic,
    ...overrides,
  };
}
function historyPage(
  items: AssessmentHistoryItem[] = [historyItem()],
  next_cursor: string | null = null,
): AssessmentHistoryPage {
  return { generated_at: "2026-11-12T23:55:00Z", items, next_cursor };
}
function readiness(slug: string, ready = false): ExamReadiness {
  const topics = learningRoadmaps.find((roadmap) => roadmap.slug === slug)!.stages[0]!.topics;
  return {
    roadmap_slug: slug,
    stage_index: 0,
    generated_at: "2026-11-12T23:55:00Z",
    eligible: ready,
    ready_lessons: ready ? 6 : 0,
    required_lessons: 6,
    pass_score: 75,
    lessons: topics.map((title) => ({
      topic_slug: slugifyTopic(title),
      title,
      practice_count: 8,
      exam_count: 2,
      best_score: ready ? 100 : null,
      best_independent_score: ready ? 100 : null,
      completed_attempts: ready ? 1 : 0,
      untracked_attempts: 0,
      outdated_attempts: 0,
      status: ready ? "ready" : "practice_needed",
      reason: ready ? "Independent threshold met." : "Complete a fresh independent practice set.",
      study_url: `/roadmaps/${slug}/${slugifyTopic(title)}`,
      last_attempt_at: null,
    })),
    blueprint: {
      total_questions: 12,
      kinds: { number: 12 },
      difficulties: { core: 12 },
      hints_allowed: false,
    },
  };
}
function reviewPlan(): ReviewPlan {
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
      due: 2,
      scheduled: 8,
      tracked: 10,
      unseen: 290,
      reviewed_today: 2,
      independent_today: 1,
      next_due_at: "2026-11-13T02:15:00+02:00",
    },
    subjects: learningRoadmaps.map(({ slug }) => ({
      slug,
      due: slug === "linear-algebra" ? 2 : 0,
      scheduled: slug === "linear-algebra" ? 8 : 0,
      tracked: slug === "linear-algebra" ? 10 : 0,
      unseen: 60,
      next_due_at: null,
    })),
    items: [],
    upcoming: [],
  };
}
function metrics(
  independentAnswers = 8,
  independentCorrect = 8,
  assisted = 2,
  untracked = 4,
): ConceptMetrics {
  const answers = independentAnswers + assisted + untracked;
  const correct = independentCorrect + assisted + untracked;
  return {
    answers,
    correct,
    incorrect: answers - correct,
    accuracy: answers ? (correct / answers) * 100 : null,
    questions_seen: answers,
    independent: {
      answers: independentAnswers,
      correct: independentCorrect,
      accuracy: independentAnswers ? (independentCorrect / independentAnswers) * 100 : null,
    },
    assisted: { answers: assisted, correct: assisted, accuracy: assisted ? 100 : null },
    untracked: { answers: untracked, correct: untracked, accuracy: untracked ? 100 : null },
  };
}
function performance(): ConceptPerformance {
  return {
    generated_at: "2026-11-12T23:55:00Z",
    window: { days: 14, start_at: "2026-10-30T00:00:00Z", end_at: "2026-11-12T23:55:00Z", timezone: "UTC" },
    totals: metrics(),
    concepts: [
      {
        ...metrics(),
        roadmap_slug: "linear-algebra",
        topic_slug: topic,
        concept: "Strong independent concept",
        latest_attempt_at: "2026-11-12T23:00:00Z",
      },
    ],
    trend: [],
  };
}
function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}
function mockApi({
  review = async () => response(reviewPlan()),
  recent = async () => response(performance()),
  subject = async (slug) => response(readiness(slug)),
  active = async () => response(historyPage()),
  history = async () => response(historyPage()),
}: {
  review?: () => Promise<ReturnType<typeof response>>;
  recent?: () => Promise<ReturnType<typeof response>>;
  subject?: (slug: string) => Promise<ReturnType<typeof response>>;
  active?: () => Promise<ReturnType<typeof response>>;
  history?: (params: URLSearchParams) => Promise<ReturnType<typeof response>>;
} = {}) {
  const mock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/review-plan")) return review();
    if (url.pathname.endsWith("/concept-performance")) return recent();
    if (url.pathname.endsWith("/exam-readiness")) return subject(url.pathname.split("/").at(-2)!);
    if (url.pathname.endsWith("/assessment-sessions"))
      return url.searchParams.get("state") === "active" && url.searchParams.get("limit") === "3"
        ? active()
        : history(url.searchParams);
    throw new Error("Unexpected dashboard request: " + url);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("mathematics learning dashboard", () => {
  it("combines authoritative review, independent performance, active assignments, and all five next lessons", async () => {
    const mock = mockApi();
    render(<LearningDashboard />);
    const reviews = screen.getByRole("region", { name: "Due review and daily recall" });
    await within(reviews).findByText("Due now");
    expect(within(reviews).getByText("Due now").nextElementSibling).toHaveTextContent("2");
    expect(within(reviews).getByText("Independent recalls today (UTC)").nextElementSibling).toHaveTextContent(
      "1",
    );
    expect(within(reviews).getByRole("link", { name: "Review due questions" })).toHaveAttribute(
      "href",
      "/roadmaps/review",
    );
    expect(within(reviews).getByText(/Nov 13, 2026, 12:15 AM UTC/)).toBeInTheDocument();
    const independent = screen.getByRole("region", { name: "Independent work · last 14 UTC days" });
    expect(await within(independent).findByText("Independent correct / answered")).toBeInTheDocument();
    expect(
      within(independent).getByText("Independent correct / answered").nextElementSibling,
    ).toHaveTextContent("8/8");
    const active = screen.getByRole("region", { name: "Continue an active session" });
    expect(await within(active).findByRole("link", { name: "Resume this session" })).toHaveAttribute(
      "href",
      "/roadmaps/sessions/" + activeId,
    );
    for (const roadmap of learningRoadmaps) {
      const card = screen.getByRole("article", { name: `${roadmap.title} learning plan` });
      await within(card).findByText(`Next lesson: ${roadmap.stages[0]!.topics[0]}`);
    }
    expect(screen.getByText(/remaining 270 advanced topics are curriculum outlines/)).toBeInTheDocument();
    expect(mock.mock.calls.some(([value]) => String(value).includes("state=active&limit=3"))).toBe(true);
  });

  it("publishes available sections while one readiness request is still pending", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    mockApi({
      subject: (slug) =>
        slug === "linear-algebra"
          ? new Promise((done) => {
              resolve = done;
            })
          : Promise.resolve(response(readiness(slug))),
    });
    render(<LearningDashboard />);
    await screen.findByRole("link", { name: "Review due questions" });
    expect(await screen.findByRole("link", { name: "Resume this session" })).toBeInTheDocument();
    const probability = screen.getByRole("article", { name: "Probability learning plan" });
    await within(probability).findByText("Next lesson: Sum and product rules");
    const algebra = screen.getByRole("article", { name: "Linear Algebra learning plan" });
    expect(within(algebra).getByRole("status")).toHaveTextContent("Loading linear algebra readiness");
    expect(within(algebra).queryByText(/foundation lessons ready independently/)).not.toBeInTheDocument();
    await act(async () => resolve(response(readiness("linear-algebra"))));
    await within(algebra).findByText(/0\/6 foundation lessons ready independently/);
  });

  it("keeps successful sections when one subject and the review plan fail, then retries only the requested subject", async () => {
    let algebraRequests = 0;
    const mock = mockApi({
      review: async () => response({ detail: "Review connection failed" }, 503),
      subject: async (slug) =>
        slug === "linear-algebra" && ++algebraRequests === 1
          ? response({ detail: "Subject unavailable" }, 503)
          : response(readiness(slug)),
    });
    render(<LearningDashboard />);
    const review = screen.getByRole("region", { name: "Due review and daily recall" });
    expect(await within(review).findByRole("alert")).toHaveTextContent("Review plan unavailable");
    expect(within(review).queryByText("Due now")).not.toBeInTheDocument();
    for (const roadmap of learningRoadmaps)
      expect(screen.getByRole("article", { name: `${roadmap.title} learning plan` })).toBeInTheDocument();
    const algebra = screen.getByRole("article", { name: "Linear Algebra learning plan" });
    expect(await within(algebra).findByRole("alert")).toHaveTextContent("Subject unavailable");
    expect(within(algebra).queryByText(/0\/6/)).not.toBeInTheDocument();
    fireEvent.click(within(algebra).getByRole("button", { name: "Retry linear algebra readiness" }));
    await within(algebra).findByText(/0\/6 foundation lessons ready independently/);
    expect(algebraRequests).toBe(2);
    expect(mock.mock.calls.filter(([url]) => String(url).includes("/review-plan"))).toHaveLength(1);
    expect(
      mock.mock.calls.filter(([url]) => String(url).includes("/probability/exam-readiness")),
    ).toHaveLength(1);
  });

  it("recommends the stage exam after all six lessons are ready rather than an unauthored outline", async () => {
    mockApi({ subject: async (slug) => response(readiness(slug, slug === "linear-algebra")) });
    render(<LearningDashboard />);
    const card = screen.getByRole("article", { name: "Linear Algebra learning plan" });
    expect(await within(card).findByRole("link", { name: "Open stage 1 exam readiness" })).toHaveAttribute(
      "href",
      "/roadmaps/linear-algebra/exam",
    );
    expect(within(card).queryByText(/^Next lesson:/)).not.toBeInTheDocument();
    expect(within(card).getByText("6/6 foundation lessons ready independently")).toBeInTheDocument();
  });

  it("labels only measured low independent accuracy as weak and separates missing independent evidence", async () => {
    const data = performance();
    data.concepts = [
      {
        ...metrics(8, 8, 0, 0),
        roadmap_slug: "linear-algebra",
        topic_slug: topic,
        concept: "Strong independent concept",
        latest_attempt_at: "2026-11-12T00:00:00Z",
      },
      {
        ...metrics(2, 1, 0, 0),
        roadmap_slug: "linear-algebra",
        topic_slug: "matrix-arithmetic",
        concept: "Low independent concept",
        latest_attempt_at: "2026-11-12T00:00:00Z",
      },
      {
        ...metrics(0, 0, 4, 2),
        roadmap_slug: "probability",
        topic_slug: "sum-and-product-rules",
        concept: "Hint-assisted concept",
        latest_attempt_at: "2026-11-12T00:00:00Z",
      },
    ];
    mockApi({ recent: async () => response(data) });
    render(<LearningDashboard />);
    const section = await screen.findByRole("region", { name: "Concepts to strengthen" });
    expect(within(section).getByRole("link", { name: "Low independent concept" })).toHaveAttribute(
      "href",
      "/roadmaps/linear-algebra/matrix-arithmetic",
    );
    expect(within(section).getByText("50% independent · 1/2 correct")).toBeInTheDocument();
    expect(within(section).queryByText("Strong independent concept")).not.toBeInTheDocument();
    expect(within(section).getByText("Independent evidence needed")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Hint-assisted concept" })).toBeInTheDocument();
    expect(within(section).queryByText(/^0% independent/)).not.toBeInTheDocument();
  });

  it("keeps null independent accuracy unknown and does not invent a weak-concept score", async () => {
    const data = performance();
    data.totals = metrics(0, 0, 2, 4);
    data.concepts = [];
    mockApi({ recent: async () => response(data) });
    render(<LearningDashboard />);
    const independent = screen.getByRole("region", { name: "Independent work · last 14 UTC days" });
    await within(independent).findByText("Not measured");
    expect(within(independent).queryByText("0%")).not.toBeInTheDocument();
    expect(
      await screen.findByText("Independent practice is needed before concepts can be assessed this way."),
    ).toBeInTheDocument();
  });

  it("does not turn a failed active-session query into a claim that no drafts exist", async () => {
    mockApi({ active: async () => response({ detail: "History service offline" }, 503) });
    render(<LearningDashboard />);
    const section = screen.getByRole("region", { name: "Continue an active session" });
    expect(await within(section).findByRole("alert")).toHaveTextContent("Active sessions unavailable");
    expect(within(section).queryByText(/No active sessions were found/)).not.toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Retry active sessions" })).toBeEnabled();
  });

  it("rejects readiness for the wrong subject without replacing another subject's valid recommendation", async () => {
    mockApi({
      subject: async (slug) => response(readiness(slug === "linear-algebra" ? "probability" : slug, true)),
    });
    render(<LearningDashboard />);
    const algebra = screen.getByRole("article", { name: "Linear Algebra learning plan" });
    expect(await within(algebra).findByRole("alert")).toHaveTextContent(
      "could not be confirmed for this subject",
    );
    expect(within(algebra).queryByText("6/6 foundation lessons ready independently")).not.toBeInTheDocument();
    const probability = screen.getByRole("article", { name: "Probability learning plan" });
    expect(
      await within(probability).findByRole("link", { name: "Open stage 1 exam readiness" }),
    ).toHaveAttribute("href", "/roadmaps/probability/exam");
  });
});

describe("recoverable session history", () => {
  it("shows only whitelisted session summaries and links to the exact saved resource", async () => {
    const completed = historyItem({
      id: completedId,
      state: "completed",
      completed_at: "2026-11-12T00:15:00Z",
      result_available: true,
      result_summary: {
        score: 0,
        independent_score: null,
        correct: 0,
        total: 8,
        passed: false,
        assistance: "untracked",
      },
      open_url: "/roadmaps/sessions/" + completedId,
    });
    mockApi({
      history: async () =>
        response(
          historyPage([
            {
              ...historyItem(),
              prompt: "Secret prompt must not render",
              expected_answer: "Secret answer must not render",
            } as AssessmentHistoryItem,
            completed,
          ]),
        ),
    });
    render(<AssessmentHistory />);
    expect(await screen.findByRole("link", { name: "Resume saved session" })).toHaveAttribute(
      "href",
      "/roadmaps/sessions/" + activeId,
    );
    expect(screen.getByRole("link", { name: "View saved result" })).toHaveAttribute(
      "href",
      "/roadmaps/sessions/" + completedId,
    );
    expect(screen.getByText("Overall 0% · 0/8 correct · Review needed")).toBeInTheDocument();
    expect(screen.getByText(/Independent score untracked/)).toBeInTheDocument();
    expect(screen.queryByText(/Secret prompt|Secret answer/)).not.toBeInTheDocument();
    expect(screen.getByText(/newest started first/)).toBeInTheDocument();
    expect(screen.getAllByText(/Started Nov 12, 2026, 12:05 AM UTC/)).toHaveLength(2);
  });

  it("paginates with opaque cursors and resets paging when subject, state, or mode changes", async () => {
    const mock = mockApi({
      history: async (params) =>
        response(
          historyPage(
            [historyItem({ id: params.get("cursor") ? completedId : activeId })],
            params.get("cursor") ? null : "opaque-history-cursor",
          ),
        ),
    });
    render(<AssessmentHistory />);
    const next = await waitFor(() => {
      const button = screen.getByRole("button", { name: "Next session page" });
      expect(button).toBeEnabled();
      return button;
    });
    fireEvent.click(next);
    await screen.findByText(/Page 2 · 1 sessions shown/);
    fireEvent.change(screen.getByRole("combobox", { name: "Session state" }), {
      target: { value: "completed" },
    });
    await screen.findByText(/Page 1 · 1 sessions shown/);
    fireEvent.change(screen.getByRole("combobox", { name: "Session mode" }), { target: { value: "exam" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Session subject" }), {
      target: { value: "probability" },
    });
    await waitFor(() => {
      const requests = mock.mock.calls.map(([url]) => new URL(String(url)));
      const last = requests.at(-1)!;
      expect(last.searchParams.get("state")).toBe("completed");
      expect(last.searchParams.get("mode")).toBe("exam");
      expect(last.searchParams.get("roadmap_slug")).toBe("probability");
      expect(last.searchParams.has("cursor")).toBe(false);
      expect(last.searchParams.get("limit")).toBe("20");
    });
    expect(screen.getByRole("button", { name: "Previous session page" })).toBeDisabled();
    expect(screen.queryByText("opaque-history-cursor")).not.toBeInTheDocument();
  });

  it("ignores an older history response after changing the filter", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    const completed = historyItem({
      id: completedId,
      state: "completed",
      open_url: "/roadmaps/sessions/" + completedId,
    });
    mockApi({
      history: (params) =>
        params.get("state") === "completed"
          ? Promise.resolve(response(historyPage([completed])))
          : new Promise((done) => {
              resolve = done;
            }),
    });
    render(<AssessmentHistory />);
    fireEvent.change(screen.getByRole("combobox", { name: "Session state" }), {
      target: { value: "completed" },
    });
    await screen.findByText("completed · practice · Linear Algebra");
    await act(async () => resolve(response(historyPage([historyItem()]))));
    expect(screen.queryByText("active · practice · Linear Algebra")).not.toBeInTheDocument();
    expect(screen.getByText("completed · practice · Linear Algebra")).toBeInTheDocument();
  });

  it("retries history failure without inventing an empty history", async () => {
    let attempts = 0;
    mockApi({
      history: async () =>
        ++attempts === 1 ? response({ detail: "History unavailable" }, 503) : response(historyPage([])),
    });
    render(<AssessmentHistory />);
    expect(await screen.findByRole("alert")).toHaveTextContent("no empty history is assumed");
    expect(screen.queryByText(/No assessment sessions match/)).not.toBeInTheDocument();
    const retry = await waitFor(() => {
      const button = screen.getByRole("button", { name: "Retry session history" });
      expect(button).toBeEnabled();
      return button;
    });
    fireEvent.click(retry);
    expect(await screen.findByText(/No assessment sessions match/)).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("shows an unrecoverable legacy result honestly and retains its study destination", async () => {
    mockApi({
      history: async () =>
        response(
          historyPage([
            historyItem({
              state: "completed",
              open_url: null,
              questions_available: false,
              result_available: false,
            }),
          ]),
        ),
    });
    render(<AssessmentHistory />);
    expect(await screen.findByText("This older session cannot be reopened.")).toBeInTheDocument();
    expect(screen.getByText("A result summary is unavailable for this older attempt.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Study lesson" })).toHaveAttribute(
      "href",
      "/roadmaps/linear-algebra/" + topic,
    );
    expect(screen.queryByRole("link", { name: "View saved result" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Overall \d+%/)).not.toBeInTheDocument();
  });
});
