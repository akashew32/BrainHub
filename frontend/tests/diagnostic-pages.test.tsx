import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DiagnosticPage, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from "@/app/roadmaps/[slug]/diagnostic/page";
import RoadmapPage from "@/app/roadmaps/[slug]/page";
import ExamPage from "@/app/roadmaps/[slug]/exam/page";
import { AssessmentHistory } from "@/components/roadmaps/assessment-history";
import { LearningDashboard } from "@/components/roadmaps/learning-dashboard";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import { learningRoadmaps } from "@/lib/roadmaps";
import { slugifyTopic } from "@/lib/roadmap-utils";
import { UUID_PATTERN } from "@/lib/assessment-recovery";
import type { AssessmentHistoryItem, AssessmentSession } from "@/lib/curriculum";

function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}
function stubProgress() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response({ items: [], summary: {} })),
  );
}
function diagnosticSession(requestId: string): AssessmentSession {
  const roadmap = learningRoadmaps.find((candidate) => candidate.slug === "linear-algebra")!;
  return {
    id: "11111111-1111-4111-8111-111111111111",
    mode: "diagnostic",
    roadmap_slug: roadmap.slug,
    topic_slug: null,
    stage_index: 0,
    pass_score: 75,
    expires_at: "2026-11-13T02:00:00Z",
    server_now: "2026-11-13T00:00:00Z",
    expires_in_seconds: 3600,
    state: "active",
    questions_available: true,
    request_id: requestId,
    hint_usage: {},
    questions: roadmap.stages[0]!.topics.flatMap((title) =>
      [0, 1].map((index) => ({
        id: `${slugifyTopic(title)}-sample-${index}`,
        kind: "number" as const,
        prompt: `Sample question ${index + 1} for ${title}: compute $1+1$.`,
        hints: [],
        hint_count: 0,
        concept: title,
        difficulty: index === 0 ? ("foundation" as const) : ("core" as const),
        topic_slug: slugifyTopic(title),
        lesson_title: title,
      })),
    ),
  };
}
function diagnosticHistory(score: number): AssessmentHistoryItem {
  const id = "22222222-2222-4222-8222-222222222222";
  return {
    id,
    roadmap_slug: "linear-algebra",
    topic_slug: null,
    stage_index: 0,
    mode: "diagnostic",
    state: "completed",
    started_at: "2026-11-12T23:00:00Z",
    completed_at: "2026-11-12T23:15:00Z",
    expires_at: "2026-11-13T01:00:00Z",
    question_count: 12,
    saved_entries: 12,
    result_available: true,
    result_summary: {
      score,
      independent_score: score,
      correct: score === 100 ? 12 : 0,
      total: 12,
      passed: score === 100,
      assistance: "independent",
    },
    questions_available: true,
    open_url: "/roadmaps/sessions/" + id,
    study_url: "/roadmaps/linear-algebra",
  };
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("foundation diagnostic destinations", () => {
  it("statically exposes exactly the five authored subjects and resolves subject metadata", async () => {
    expect(dynamicParams).toBe(false);
    expect(generateStaticParams()).toEqual(learningRoadmaps.map((roadmap) => ({ slug: roadmap.slug })));
    for (const roadmap of learningRoadmaps) {
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: roadmap.slug }) });
      expect(metadata.title).toBe(`${roadmap.title} Foundation Diagnostic — BrainHub`);
    }
  });

  it.each(learningRoadmaps)("explains the limited foundation sample for $title", async (roadmap) => {
    stubProgress();
    render(
      <RoadmapProgressProvider>
        {await DiagnosticPage({ params: Promise.resolve({ slug: roadmap.slug }) })}
      </RoadmapProgressProvider>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: `${roadmap.title} foundation diagnostic` }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/limited sample of 12 questions from the six authored foundation lessons/),
    ).toBeInTheDocument();
    expect(screen.getByText(/one foundation question and one core question per lesson/)).toBeInTheDocument();
    expect(screen.getByText(/does not complete a lesson or unlock the stage exam/)).toBeInTheDocument();
    expect(screen.getByText(/full eight-question independent practice set/)).toBeInTheDocument();
    expect(screen.getByText(/Advanced roadmap topics remain curriculum outlines/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Start diagnostic" })).toBeEnabled();
    expect(screen.getByRole("link", { name: `← ${roadmap.title} curriculum` })).toHaveAttribute(
      "href",
      `/roadmaps/${roadmap.slug}`,
    );
  });

  it("rejects a diagnostic destination outside the authored subjects", async () => {
    await expect(DiagnosticPage({ params: Promise.resolve({ slug: "unknown-subject" }) })).rejects.toThrow();
  });

  it("starts the real diagnostic panel without an exam-readiness gate and shows its twelve hint-free questions", async () => {
    const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/progress")) return response({ items: [], summary: {} });
      if (url.endsWith("/assessments") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return response(diagnosticSession(body.request_id as string));
      }
      throw new Error("Unexpected diagnostic page request: " + url);
    });
    vi.stubGlobal("fetch", mock);
    render(
      <RoadmapProgressProvider>
        {await DiagnosticPage({ params: Promise.resolve({ slug: "linear-algebra" }) })}
      </RoadmapProgressProvider>,
    );
    const start = await screen.findByRole("button", { name: "Start diagnostic" });
    expect(start).toBeEnabled();
    fireEvent.click(start);
    await waitFor(() => {
      expect(screen.getAllByRole("textbox")).toHaveLength(12);
      for (const editor of screen.getAllByRole("textbox")) expect(editor).toBeEnabled();
    });
    expect(screen.getByRole("button", { name: "Submit diagnostic" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Show hint/ })).not.toBeInTheDocument();
    const request = mock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      mode: "diagnostic",
      stage_index: 0,
      request_id: expect.stringMatching(UUID_PATTERN),
    });
    expect(mock.mock.calls.some(([input]) => String(input).includes("exam-readiness"))).toBe(false);
  });

  it("offers a diagnostic from the subject overview and exam preparation page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) =>
        String(input).endsWith("/progress")
          ? response({ items: [], summary: {} })
          : response({ detail: "Readiness offline" }, 503),
      ),
    );
    const overview = render(
      <RoadmapProgressProvider>
        {await RoadmapPage({ params: Promise.resolve({ slug: "probability" }) })}
      </RoadmapProgressProvider>,
    );
    expect(screen.getByRole("link", { name: "Try the 12-question foundation diagnostic" })).toHaveAttribute(
      "href",
      "/roadmaps/probability/diagnostic",
    );
    overview.unmount();
    render(
      <RoadmapProgressProvider>
        {await ExamPage({ params: Promise.resolve({ slug: "probability" }) })}
      </RoadmapProgressProvider>,
    );
    expect(
      screen.getByRole("link", { name: /Need a starting point\? Try the foundation diagnostic sample/ }),
    ).toHaveAttribute("href", "/roadmaps/probability/diagnostic");
    await screen.findByRole("alert");
  });

  it("keeps diagnostic entry links available for all five subjects when dashboard evidence is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ detail: "Offline" }, 503)),
    );
    render(<LearningDashboard />);
    for (const roadmap of learningRoadmaps) {
      const card = screen.getByRole("article", { name: `${roadmap.title} learning plan` });
      expect(within(card).getByRole("link", { name: "Try a 12-question diagnostic" })).toHaveAttribute(
        "href",
        `/roadmaps/${roadmap.slug}/diagnostic`,
      );
    }
    await screen.findByRole("button", { name: "Retry review plan" });
    expect(screen.getByText(/remaining 270 advanced topics are curriculum outlines/)).toBeInTheDocument();
  });
});

describe("diagnostic history semantics", () => {
  it.each([0, 100])(
    "labels a %i%% diagnostic result as a sample without a qualification badge",
    async (score) => {
      const item = diagnosticHistory(score);
      const mock = vi.fn(async (input: string | URL | Request) => {
        expect(new URL(String(input)).pathname).toMatch(/\/roadmaps\/assessment-sessions$/);
        return response({ generated_at: "2026-11-12T23:55:00Z", items: [item], next_cursor: null });
      });
      vi.stubGlobal("fetch", mock);
      render(<AssessmentHistory />);
      expect(
        await screen.findByText(`Sample ${score}% · ${score === 100 ? 12 : 0}/12 correct`),
      ).toBeInTheDocument();
      const card = screen.getByText("Foundation diagnostic · limited sample").closest("article")!;
      expect(within(card).queryByText(/\bPassed\b|Review needed|Overall/)).not.toBeInTheDocument();
      expect(within(card).queryByText(/Independent (0|100)%/)).not.toBeInTheDocument();
      expect(within(card).getByText(/does not qualify a lesson or stage exam/)).toBeInTheDocument();
      expect(within(card).getByRole("link", { name: "View diagnostic guidance" })).toHaveAttribute(
        "href",
        item.open_url,
      );
      fireEvent.change(screen.getByRole("combobox", { name: "Session mode" }), {
        target: { value: "diagnostic" },
      });
      await waitFor(() =>
        expect(
          mock.mock.calls.some(([input]) => new URL(String(input)).searchParams.get("mode") === "diagnostic"),
        ).toBe(true),
      );
    },
  );
});
