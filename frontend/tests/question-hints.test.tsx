import { useCallback, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionHints } from "@/components/roadmaps/question-hints";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import type { AssessmentResult, AssessmentSession, HintReveal, MathQuestion } from "@/lib/curriculum";

const hintTexts = ["Start with the equation.", "Divide both sides by two."];
const question: MathQuestion = {
  id: "coefficient-one",
  kind: "number",
  prompt: "Solve $2x=1$ for $x$.",
  hint_count: 2,
  hints: [],
  concept: "Scalar coefficients",
  difficulty: "foundation",
  topic_slug: "vector-arithmetic-and-linear-combinations",
  lesson_title: "Vector arithmetic and linear combinations",
};
const assessment: AssessmentSession = {
  id: "hint-session",
  mode: "practice",
  roadmap_slug: "linear-algebra",
  topic_slug: question.topic_slug,
  expires_at: "2099-01-01T00:00:00Z",
  pass_score: 75,
  hint_usage: {},
  questions: [question],
};
const draftKey = "brainhub:assessment:v2:linear-algebra:practice:vector-arithmetic-and-linear-combinations";

function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function revealed(questionId: string, count: number, usage: Record<string, number> = {}): HintReveal {
  return {
    question_id: questionId,
    hint_count: 2,
    hints: hintTexts.slice(0, count),
    hints_used: count,
    hint_usage: { ...usage, [questionId]: count },
  };
}

function HintHarness({
  initialQuestion = question,
  initialUsage = {},
  disabled = false,
}: {
  initialQuestion?: MathQuestion;
  initialUsage?: Record<string, number> | null;
  disabled?: boolean;
}) {
  const [current, setCurrent] = useState(initialQuestion);
  const [usage, setUsage] = useState(initialUsage);
  const [pending, setPending] = useState(false);
  const pendingChanged = useCallback((_questionId: string, value: boolean) => setPending(value), []);
  return (
    <>
      <QuestionHints
        sessionId={assessment.id}
        question={current}
        questionNumber={1}
        hintUsage={usage}
        disabled={disabled}
        onPendingChange={pendingChanged}
        onReveal={(next) => {
          setCurrent((previous) => ({ ...previous, hint_count: next.hint_count, hints: next.hints }));
          setUsage(next.hint_usage);
        }}
      />
      <output data-testid="pending-hint">{pending ? "pending" : "ready"}</output>
    </>
  );
}

function result(assistance: "independent" | "assisted"): AssessmentResult {
  return {
    session_id: assessment.id,
    mode: "practice",
    score: 100,
    passed: true,
    correct: 1,
    total: 1,
    assistance,
    independent_score: assistance === "independent" ? 100 : 0,
    independent_passed: assistance === "independent",
    progress: null,
    feedback: [
      {
        question_id: question.id,
        prompt: question.prompt,
        concept: question.concept,
        correct: true,
        submitted_answer: "1/2",
        expected_answer: 0.5,
        solution: "Divide $2x=1$ by two to get $x=1/2$.",
        topic_slug: question.topic_slug,
        assistance,
        hints_used: assistance === "independent" ? 0 : 1,
      },
    ],
  };
}

function mockAssessment({
  active = assessment,
  resume = async () => response(active),
  reveal = async (questionId: string, index: number) => response(revealed(questionId, index)),
  submittedResult = result("independent"),
}: {
  active?: AssessmentSession;
  resume?: () => Promise<ReturnType<typeof response>>;
  reveal?: (questionId: string, index: number) => Promise<ReturnType<typeof response>>;
  submittedResult?: AssessmentResult;
} = {}) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/roadmaps/progress")) return response({ items: [], summary: {} });
    if (url.endsWith("/assessments") && init?.method === "POST") return response(active);
    if (url.endsWith("/assessments/" + active.id)) return resume();
    if (url.endsWith("/draft")) return response({ ...active, draft: JSON.parse(String(init?.body)) });
    if (url.endsWith("/submit")) return response(submittedResult);
    if (url.includes("/questions/") && url.endsWith("/hints")) {
      const questionId = url.split("/questions/")[1]!.split("/")[0]!;
      const body = JSON.parse(String(init?.body));
      return reveal(questionId, body.index as number);
    }
    throw new Error("Unexpected hint request: " + url);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

function renderAssessment() {
  return render(
    <RoadmapProgressProvider>
      <AssessmentPanel roadmapSlug={assessment.roadmap_slug} topicSlug={question.topic_slug} />
    </RoadmapProgressProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("sequential server hints", () => {
  it("reveals one server-confirmed hint at a time with native accessible controls", async () => {
    const mock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return response(revealed(question.id, body.index as number));
    });
    vi.stubGlobal("fetch", mock);
    render(<HintHarness />);
    expect(screen.queryByText(hintTexts[0]!)).not.toBeInTheDocument();
    const first = screen.getByRole("button", { name: "Reveal hint 1 for question 1" });
    first.focus();
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute("type", "button");
    expect(first).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(first);
    expect(await screen.findByText(hintTexts[0]!)).toBeInTheDocument();
    expect(screen.queryByText(hintTexts[1]!)).not.toBeInTheDocument();
    const second = screen.getByRole("button", { name: "Reveal hint 2 for question 1" });
    expect(second).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(second);
    expect(await screen.findByText(hintTexts[1]!)).toBeInTheDocument();
    expect(screen.getByText(/2 of 2 hints revealed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reveal hint/ })).not.toBeInTheDocument();
    expect(mock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).index)).toEqual([1, 2]);
  });

  it("blocks duplicate reveal requests and marks the request as pending immediately", async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => {
      finish = resolve;
    });
    const mock = vi.fn(() => pending);
    vi.stubGlobal("fetch", mock);
    render(<HintHarness />);
    const button = screen.getByRole("button", { name: "Reveal hint 1 for question 1" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(screen.getByTestId("pending-hint")).toHaveTextContent("pending");
    expect(screen.queryByText(hintTexts[0]!)).not.toBeInTheDocument();
    await act(async () => finish(response(revealed(question.id, 1))));
    expect(screen.getByTestId("pending-hint")).toHaveTextContent("ready");
    expect(screen.getByRole("button", { name: "Reveal hint 2 for question 1" })).toBeEnabled();
  });

  it("keeps revealed hints on a network failure and retries the same indexed request", async () => {
    let attempts = 0;
    const mock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("Offline");
      return response(revealed(question.id, JSON.parse(String(init?.body)).index as number));
    });
    vi.stubGlobal("fetch", mock);
    render(
      <HintHarness
        initialQuestion={{ ...question, hints: [hintTexts[0]!] }}
        initialUsage={{ [question.id]: 1 }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reveal hint 2 for question 1" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your previous hints and answers are kept");
    expect(screen.getByText(hintTexts[0]!)).toBeInTheDocument();
    expect(screen.queryByText(hintTexts[1]!)).not.toBeInTheDocument();
    expect(screen.getByText(/1 of 2 hints revealed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal hint 2 for question 1" }));
    expect(await screen.findByText(hintTexts[1]!)).toBeInTheDocument();
    expect(mock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).index)).toEqual([2, 2]);
  });

  it("labels legacy hints as untracked and never requests a newly tracked reveal", () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    render(<HintHarness initialQuestion={{ ...question, hints: hintTexts }} initialUsage={null} />);
    expect(screen.getByText(/Hint usage was not recorded for this older attempt/)).toBeInTheDocument();
    expect(screen.getByText(hintTexts[0]!)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reveal/ })).not.toBeInTheDocument();
    expect(mock).not.toHaveBeenCalled();
  });

  it("does not reveal hints while grading is disabled", () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    render(<HintHarness disabled />);
    const button = screen.getByRole("button", { name: "Reveal hint 1 for question 1" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mock).not.toHaveBeenCalled();
  });

  it("ignores a response arriving after its session component unmounts", async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => {
      finish = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending),
    );
    const changed = vi.fn();
    const pendingChanged = vi.fn();
    const first = render(
      <QuestionHints
        sessionId="old-session"
        question={question}
        questionNumber={1}
        hintUsage={{}}
        onReveal={changed}
        onPendingChange={pendingChanged}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reveal hint 1 for question 1" }));
    first.unmount();
    render(
      <QuestionHints
        sessionId="new-session"
        question={question}
        questionNumber={1}
        hintUsage={{}}
        onReveal={changed}
        onPendingChange={pendingChanged}
      />,
    );
    await act(async () => finish(response(revealed(question.id, 1))));
    expect(changed).not.toHaveBeenCalled();
    expect(screen.queryByText(hintTexts[0]!)).not.toBeInTheDocument();
    expect(screen.getByText(/0 of 2 hints revealed/)).toBeInTheDocument();
    expect(pendingChanged).toHaveBeenLastCalledWith(question.id, false);
  });
});

describe("hints, drafts, and assistance results", () => {
  it("preserves newer answer edits and hint state through a delayed reveal and autosave", async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => {
      finish = resolve;
    });
    const mock = mockAssessment({ reveal: () => pending });
    renderAssessment();
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    const answer = await screen.findByRole("textbox", { name: "Answer to question 1" });
    fireEvent.click(screen.getByRole("button", { name: "Reveal hint 1 for question 1" }));
    expect(screen.getByRole("button", { name: "Submit practice" })).toBeDisabled();
    expect(answer).toBeEnabled();
    fireEvent.change(answer, { target: { value: "3/4" } });
    await act(async () => finish(response(revealed(question.id, 1))));
    expect(answer).toHaveValue("3/4");
    expect(screen.getByRole("button", { name: "Submit practice" })).toBeEnabled();
    const cache = JSON.parse(localStorage.getItem(draftKey)!);
    expect(cache.answers[question.id]).toBe("3/4");
    expect(cache.session.hint_usage[question.id]).toBe(1);
    expect(cache.session.questions[0].hints).toEqual([hintTexts[0]]);
    await waitFor(
      () => {
        const save = mock.mock.calls.find(([url]) => String(url).endsWith("/draft"));
        expect(save).toBeDefined();
        const body = JSON.parse(String(save?.[1]?.body));
        expect(body.answers).toEqual([{ question_id: question.id, answer: "3/4" }]);
        expect(body.hint_usage).toBeUndefined();
      },
      { timeout: 2000 },
    );
    expect(JSON.parse(localStorage.getItem(draftKey)!).session.questions[0].hints).toEqual([hintTexts[0]]);
  });

  it("restores authoritative revealed hints while retaining a newer local answer snapshot", async () => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        version: 2,
        sessionId: assessment.id,
        roadmapSlug: assessment.roadmap_slug,
        topicSlug: assessment.topic_slug,
        stageIndex: 0,
        mode: "practice",
        answers: { [question.id]: "3/4" },
        startedAt: Date.now(),
        revision: 2,
        session: assessment,
      }),
    );
    mockAssessment({
      resume: async () =>
        response({
          ...assessment,
          hint_usage: { [question.id]: 1 },
          questions: [{ ...question, hints: [hintTexts[0]!] }],
          draft: {
            answers: [{ question_id: question.id, answer: "1/2" }],
            revision: 1,
            time_spent_seconds: 5,
          },
        }),
    });
    renderAssessment();
    expect(await screen.findByRole("textbox", { name: "Answer to question 1" })).toHaveValue("3/4");
    expect(screen.getByText(hintTexts[0]!)).toBeInTheDocument();
    expect(screen.queryByText(hintTexts[1]!)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal hint 2 for question 1" })).toBeEnabled();
  });

  it("merges out-of-order reveal responses from different questions without regressing either prefix", async () => {
    const secondQuestion = { ...question, id: "coefficient-two" };
    let finishFirst!: (value: ReturnType<typeof response>) => void;
    let finishSecond!: (value: ReturnType<typeof response>) => void;
    const first = new Promise<ReturnType<typeof response>>((resolve) => {
      finishFirst = resolve;
    });
    const second = new Promise<ReturnType<typeof response>>((resolve) => {
      finishSecond = resolve;
    });
    mockAssessment({
      active: { ...assessment, questions: [question, secondQuestion] },
      reveal: (questionId) => (questionId === question.id ? first : second),
    });
    renderAssessment();
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reveal hint 1 for question 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal hint 1 for question 2" }));
    await act(async () => finishSecond(response(revealed(secondQuestion.id, 1, { [question.id]: 1 }))));
    expect(screen.getByRole("button", { name: "Submit practice" })).toBeDisabled();
    await act(async () => finishFirst(response(revealed(question.id, 1))));
    const cache = JSON.parse(localStorage.getItem(draftKey)!);
    expect(cache.session.hint_usage).toEqual({ [question.id]: 1, [secondQuestion.id]: 1 });
    expect(cache.session.questions.map((item: MathQuestion) => item.hints)).toEqual([
      [hintTexts[0]],
      [hintTexts[0]],
    ]);
    expect(screen.getAllByText(/1 of 2 hints revealed/)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Submit practice" })).toBeEnabled();
  });

  it.each(["independent", "assisted"] as const)(
    "labels a server-confirmed %s result without inferring mastery from total score",
    async (assistance) => {
      mockAssessment({ submittedResult: result(assistance) });
      renderAssessment();
      fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
      fireEvent.change(await screen.findByRole("textbox", { name: "Answer to question 1" }), {
        target: { value: "1/2" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
      if (assistance === "independent") {
        expect(
          await screen.findByText("Independent practice passed. Your progress has been saved."),
        ).toBeInTheDocument();
        expect(screen.getByText("Independent score: 100%")).toBeInTheDocument();
        expect(screen.getByText("Independent answer · No hints used")).toBeInTheDocument();
      } else {
        expect(await screen.findByText(/Practice passed with hints/)).toBeInTheDocument();
        expect(screen.getByText("Independent score: 0%")).toBeInTheDocument();
        expect(screen.getByText("Assisted answer · 1 hint used")).toBeInTheDocument();
        expect(
          screen.queryByText("Independent practice passed. Your progress has been saved."),
        ).not.toBeInTheDocument();
      }
      expect(screen.queryByText(/Lesson mastered/)).not.toBeInTheDocument();
    },
  );
});
