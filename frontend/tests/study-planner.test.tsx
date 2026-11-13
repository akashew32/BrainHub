import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudyPlanner } from "@/components/roadmaps/study-planner";
import { DailyStudyGoalCard } from "@/components/roadmaps/daily-study-goal";
import { AssessmentHistory } from "@/components/roadmaps/assessment-history";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import { learningRoadmaps } from "@/lib/roadmaps";
import type {
  AssessmentResult,
  AssessmentSession,
  DailyStudyGoal,
  StudyPlan,
  StudyPreferences,
} from "@/lib/curriculum";

const defaults: StudyPreferences = {
  goal_minutes: 20,
  session_minutes: 15,
  preferred_roadmap_slug: null,
  revision: 0,
  updated_at: null,
};
function dailyGoal(recorded = 0): DailyStudyGoal {
  return {
    date: "2026-11-13",
    timezone: "UTC",
    goal_seconds: 1200,
    recorded_seconds: recorded,
    recorded_sessions: recorded ? 1 : 0,
    unknown_duration_sessions: 34,
    partial_duration_sessions: recorded ? 1 : 0,
    goal_met: recorded >= 1200,
  };
}
function plan(budget = 15, subject = "linear-algebra", recorded = 0): StudyPlan {
  const count = Math.min(20, Math.floor((budget * 60) / 80));
  return {
    generated_at: "2026-11-13T03:00:00Z",
    preferences: defaults,
    daily_goal: dailyGoal(recorded),
    recommendation: {
      roadmap_slug: subject,
      budget_minutes: budget,
      estimated_seconds: count * 80,
      question_count: count,
      reason_counts: { due: 1, weak: 1, next: count - 2 },
      reason: "Due recall comes first, followed by independent practice priorities.",
    },
    subjects: learningRoadmaps.map(({ slug }) => ({
      slug,
      due: slug === subject ? 1 : 0,
      weak: slug === subject ? 1 : 0,
      unseen: 48,
    })),
  };
}
function studySession(budget: number, subject: string, requestId: string): AssessmentSession {
  const recommendation = plan(budget, subject).recommendation!;
  return {
    id: "11111111-1111-4111-8111-111111111111",
    mode: "study",
    roadmap_slug: subject,
    topic_slug: null,
    stage_index: 0,
    expires_at: "2026-11-13T05:00:00Z",
    server_now: "2026-11-13T03:00:00Z",
    expires_in_seconds: 7200,
    state: "active",
    questions_available: true,
    request_id: requestId,
    pass_score: 75,
    hint_usage: {},
    study_plan: {
      version: 1,
      budget_minutes: budget,
      preferences_revision: 0,
      estimated_seconds: recommendation.estimated_seconds,
      question_count: recommendation.question_count,
      reason_counts: recommendation.reason_counts,
      notice: "Estimated study time varies. Full lesson practice establishes independent readiness.",
    },
    questions: Array.from({ length: recommendation.question_count }, (_, index) => ({
      id: `study-question-${index}`,
      kind: "number",
      prompt: `Practice question ${index + 1}: compute $1+0$.`,
      hints: [],
      hint_count: 2,
      concept: "Scalar coefficient",
      difficulty: "foundation",
      topic_slug: "vector-arithmetic-and-linear-combinations",
      lesson_title: "Vector arithmetic",
      selection_reason: {
        code: index === 0 ? "due" : index === 1 ? "weak" : "next",
        text:
          index === 0
            ? "Due for recall."
            : index === 1
              ? "Independent accuracy needs practice."
              : "Next foundation practice.",
        estimated_seconds: 80,
      },
    })),
  };
}
function result(session: AssessmentSession): AssessmentResult {
  return {
    session_id: session.id,
    mode: "study",
    score: 100,
    passed: true,
    correct: session.questions.length,
    total: session.questions.length,
    assistance: "independent",
    independent_score: 100,
    independent_passed: true,
    recorded_seconds: 180,
    progress: null,
    study_summary: {
      version: 1,
      notice: "Study feedback guides future practice without completing a lesson.",
      correct: session.questions.length,
      total: session.questions.length,
      reason_counts: session.study_plan!.reason_counts,
    },
    feedback: session.questions.map((question) => ({
      question_id: question.id,
      prompt: question.prompt,
      concept: question.concept,
      correct: true,
      submitted_answer: "1",
      expected_answer: 1,
      solution: "Adding zero preserves the number.",
      topic_slug: question.topic_slug,
      hints_used: 0,
      assistance: "independent",
    })),
  };
}
function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}
function mockApi({
  getPlan,
  preferencesFail = false,
  emptyAfterGrade = false,
  preferenceConflict = false,
}: {
  getPlan?: (params: URLSearchParams) => Promise<ReturnType<typeof response>>;
  preferencesFail?: boolean;
  emptyAfterGrade?: boolean;
  preferenceConflict?: boolean;
} = {}) {
  let savedPreferences = { ...defaults };
  let session: AssessmentSession | null = null;
  let graded = false;
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/progress")) return response({ items: [], summary: {} });
    if (url.pathname.endsWith("/study-preferences")) {
      if (init?.method === "PUT") {
        if (preferenceConflict) {
          savedPreferences = {
            ...defaults,
            goal_minutes: 25,
            session_minutes: 5,
            revision: 2,
            updated_at: "2026-11-13T03:00:00Z",
          };
          return response({ detail: "Preferences changed elsewhere" }, 409);
        }
        const body = JSON.parse(String(init.body));
        savedPreferences = { ...body, revision: body.revision + 1, updated_at: "2026-11-13T03:00:00Z" };
        return response(savedPreferences);
      }
      return preferencesFail
        ? response({ detail: "Preferences unavailable" }, 503)
        : response(savedPreferences);
    }
    if (url.pathname.endsWith("/study-plan")) {
      if (getPlan) return getPlan(url.searchParams);
      const next = plan(
        Number(url.searchParams.get("budget_minutes") ?? savedPreferences.session_minutes),
        url.searchParams.get("roadmap_slug") ?? savedPreferences.preferred_roadmap_slug ?? "linear-algebra",
        graded ? 180 : 0,
      );
      next.preferences = savedPreferences;
      next.daily_goal.goal_seconds = savedPreferences.goal_minutes * 60;
      if (graded && emptyAfterGrade) next.recommendation = null;
      return response(next);
    }
    if (url.pathname.endsWith("/assessments") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      const slug = url.pathname.split("/").at(-2)!;
      session = studySession(body.budget_minutes as number, slug, body.request_id as string);
      return response(session);
    }
    if (url.pathname.endsWith("/draft") && session) {
      session = { ...session, draft: JSON.parse(String(init?.body)) };
      return response(session);
    }
    if (url.pathname.endsWith("/submit") && session) {
      graded = true;
      return response(result(session));
    }
    if (session && url.pathname.endsWith("/" + session.id)) return response(session);
    throw new Error("Unexpected planner request: " + url);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
function renderPlanner() {
  return render(
    <RoadmapProgressProvider>
      <StudyPlanner />
    </RoadmapProgressProvider>,
  );
}
async function chooseBudget(budget = "5", subject = "linear-algebra") {
  fireEvent.change(screen.getByRole("combobox", { name: "Study set budget" }), { target: { value: budget } });
  fireEvent.change(screen.getByRole("combobox", { name: "Study set subject" }), {
    target: { value: subject },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update preview" }));
  await screen.findByText(new RegExp(`within a ${budget}-minute budget`));
  const open = await waitFor(() => {
    const button = screen.getByRole("button", { name: "Open recommended study set" });
    expect(button).toBeEnabled();
    return button;
  });
  fireEvent.click(open);
  const start = await waitFor(() => {
    const button = screen.getByRole("button", { name: "Start study" });
    expect(button).toBeEnabled();
    return button;
  });
  fireEvent.click(start);
  return waitFor(() => {
    const input = screen.getByRole("textbox", { name: "Answer to question 1" });
    expect(input).toBeEnabled();
    return input;
  });
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("recorded UTC daily goals", () => {
  it("shows authoritative recorded time and keeps unknown legacy durations separate from a zero total", () => {
    render(<DailyStudyGoalCard goal={dailyGoal()} loading={false} error={null} onRetry={() => {}} />);
    expect(screen.getByText("2026-11-13 · UTC")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Daily recorded time goal" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    expect(screen.getByText("Sessions with unknown duration").nextElementSibling).toHaveTextContent("34");
    expect(screen.getByText(/a zero recorded total does not imply/)).toBeInTheDocument();
    expect(screen.getByText(/opening a page or saving a draft adds no goal credit/)).toBeInTheDocument();
  });
  it("uses server goal completion and safely caps the displayed progress without hiding extra recorded time", () => {
    render(
      <DailyStudyGoalCard
        goal={{ ...dailyGoal(1500), goal_met: true }}
        loading={false}
        error={null}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText(/25m 0s/)).toBeInTheDocument();
    expect(screen.getByText("Daily recorded-time goal met.")).toBeInTheDocument();
  });
});

describe("bounded study planning", () => {
  it("opens a genuine five-minute estimated set with the selected budget sent to the real panel start", async () => {
    const mock = mockApi();
    renderPlanner();
    const input = await chooseBudget("5", "probability");
    expect(input).toHaveValue("");
    expect(screen.getAllByRole("textbox", { name: /Answer to question/ })).toHaveLength(3);
    const request = mock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/assessments") && init?.method === "POST",
    );
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      mode: "study",
      budget_minutes: 5,
      stage_index: 0,
    });
    expect(String(request?.[0])).toContain("/probability/assessments");
    expect(screen.getByText(/estimated 4m 0s within a 5-minute budget/)).toBeInTheDocument();
  });

  it("keeps active raw answers and the frozen budget while new options and preferences refresh", async () => {
    mockApi();
    renderPlanner();
    const input = await chooseBudget();
    fireEvent.change(input, { target: { value: "26*(" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Study set budget" }), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Update preview" }));
    await screen.findByText(/within a 10-minute budget/);
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toBe(input);
    expect(input).toHaveValue("26*(");
    expect(screen.getByRole("button", { name: "Use preview for the next set" })).toBeDisabled();
    expect(screen.getByText("Current set: Linear Algebra · 5-minute estimated budget")).toBeInTheDocument();
    const goal = await waitFor(() => {
      const field = screen.getByRole("textbox", { name: "Daily goal in minutes" });
      expect(field).toBeEnabled();
      return field;
    });
    fireEvent.change(goal, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save study preferences" }));
    await screen.findByText("Study preferences saved (revision 1).");
    await screen.findByText(/recorded of 45m 0s daily goal/);
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toBe(input);
    expect(input).toHaveValue("26*(");
    expect(screen.getByRole("button", { name: "Submit study" })).toBeEnabled();
  });

  it("refreshes observed server preferences after a conflict while keeping unsaved values and active answers", async () => {
    mockApi({ preferenceConflict: true });
    renderPlanner();
    const answer = await chooseBudget();
    fireEvent.change(answer, { target: { value: "26*(" } });
    const goal = await waitFor(() => {
      const input = screen.getByRole("textbox", { name: "Daily goal in minutes" });
      expect(input).toBeEnabled();
      expect(input).toHaveValue("20");
      return input;
    });
    fireEvent.change(goal, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save study preferences" }));
    await screen.findByText("Saved preferences changed elsewhere");
    await screen.findByText(/recorded of 25m 0s daily goal/);
    expect(screen.getByText("Saved default: 5 minutes per set · daily goal 25 minutes")).toBeInTheDocument();
    expect(goal).toHaveValue("10");
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toBe(answer);
    expect(answer).toHaveValue("26*(");
    expect(screen.getByRole("button", { name: "Save my edits using latest revision" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Use saved preferences" }));
    expect(goal).toHaveValue("25");
  });

  it("refreshes server goal time after actual grading without unmounting feedback when no next preview exists", async () => {
    mockApi({ emptyAfterGrade: true });
    renderPlanner();
    await chooseBudget();
    for (const input of screen.getAllByRole("textbox", { name: /Answer to question/ }))
      fireEvent.change(input, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit study" }));
    expect(await screen.findByRole("heading", { name: "Study set complete" })).toBeInTheDocument();
    expect(await screen.findByText(/No study set is available for these options/)).toBeInTheDocument();
    const goal = screen.getByRole("region", { name: "Daily recorded study time" });
    expect(within(goal).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "15");
    expect(within(goal).getByText(/3m 0s/)).toBeInTheDocument();
    expect(screen.getByText("Question 1: Correct · Scalar coefficient")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Current study workspace" })).toBeInTheDocument();
  });

  it("ignores an old budget preview response after a newer preview has loaded", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    mockApi({
      getPlan: (params) =>
        params.get("budget_minutes") === "5"
          ? new Promise((done) => {
              resolve = done;
            })
          : Promise.resolve(response(plan(Number(params.get("budget_minutes") ?? 15)))),
    });
    renderPlanner();
    await screen.findByText(/within a 15-minute budget/);
    fireEvent.change(screen.getByRole("combobox", { name: "Study set budget" }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Update preview" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Study set budget" }), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Update preview" }));
    await screen.findByText(/within a 10-minute budget/);
    await act(async () => resolve(response(plan(5))));
    expect(screen.getByText(/within a 10-minute budget/)).toBeInTheDocument();
    expect(screen.queryByText(/within a 5-minute budget/)).not.toBeInTheDocument();
  });

  it("shows plan failure as unavailable rather than inventing a zero goal and can retry", async () => {
    let requests = 0;
    mockApi({
      getPlan: async () => (++requests === 1 ? response({ detail: "Plan offline" }, 503) : response(plan())),
    });
    renderPlanner();
    const goal = screen.getByRole("region", { name: "Daily recorded study time" });
    expect(await within(goal).findByRole("alert")).toHaveTextContent("Recorded study time is unavailable");
    expect(within(goal).queryByRole("progressbar")).not.toBeInTheDocument();
    fireEvent.click(within(goal).getByRole("button", { name: "Retry study plan" }));
    expect(await within(goal).findByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("keeps plan and goal data available when preference loading fails independently", async () => {
    mockApi({ preferencesFail: true });
    renderPlanner();
    const goal = screen.getByRole("region", { name: "Daily recorded study time" });
    await within(goal).findByRole("progressbar");
    const preferences = screen.getByRole("region", { name: "Your study preferences" });
    expect(await within(preferences).findByRole("alert")).toHaveTextContent("Preferences unavailable");
    expect(screen.getByText(/within a 15-minute budget/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Daily goal in minutes" })).toBeDisabled();
  });

  it("restores the chosen scope and raw session answer after remounting the planner", async () => {
    mockApi();
    const first = renderPlanner();
    const input = await chooseBudget();
    fireEvent.change(input, { target: { value: "1/" } });
    first.unmount();
    renderPlanner();
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toBeEnabled();
      expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toHaveValue("1/");
    });
    expect(screen.getByText("Current set: Linear Algebra · 5-minute estimated budget")).toBeInTheDocument();
  });

  it("labels completed study sets as feedback without a lesson qualification badge", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          generated_at: "2026-11-13T03:00:00Z",
          next_cursor: null,
          items: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              roadmap_slug: "linear-algebra",
              topic_slug: null,
              stage_index: 0,
              mode: "study",
              state: "completed",
              started_at: "2026-11-13T00:00:00Z",
              completed_at: "2026-11-13T00:10:00Z",
              expires_at: "2026-11-13T02:00:00Z",
              question_count: 3,
              saved_entries: 3,
              result_available: true,
              result_summary: {
                score: 100,
                independent_score: 100,
                correct: 3,
                total: 3,
                passed: true,
                assistance: "independent",
              },
              questions_available: true,
              open_url: "/roadmaps/sessions/11111111-1111-4111-8111-111111111111",
              study_url: null,
            },
          ],
        }),
      ),
    );
    render(<AssessmentHistory />);
    await screen.findByText("Personal study set");
    expect(screen.getByText("Study set 100% · 3/3 correct")).toBeInTheDocument();
    expect(screen.queryByText(/\bPassed\b|Overall 100%/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View study feedback" })).toBeInTheDocument();
  });
});
