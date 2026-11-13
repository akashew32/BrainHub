import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { MathText } from "@/components/roadmaps/math-text";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import type { AssessmentDraft, AssessmentResult, AssessmentSession } from "@/lib/curriculum";

const session: AssessmentSession = {
  id: "math-session",
  mode: "practice",
  roadmap_slug: "linear-algebra",
  topic_slug: "vector-arithmetic-and-linear-combinations",
  expires_at: "2099-01-01T00:00:00Z",
  pass_score: 75,
  questions: [
    {
      id: "fraction-answer",
      kind: "number",
      prompt: "What is the coefficient $c$ in $2c=1$?",
      hints: ["Divide both sides by two.", "A fraction is an exact answer."],
      concept: "Scalar coefficient",
      difficulty: "foundation",
      topic_slug: "vector-arithmetic-and-linear-combinations",
      lesson_title: "Vector arithmetic and linear combinations",
    },
    {
      id: "vector-answer",
      kind: "vector",
      prompt: "Compute $\\frac12(1,6)$.",
      hints: ["Scale each coordinate.", "A vector has two entries here."],
      concept: "Vector scaling",
      difficulty: "foundation",
      topic_slug: "vector-arithmetic-and-linear-combinations",
      lesson_title: "Vector arithmetic and linear combinations",
    },
    {
      id: "matrix-answer",
      kind: "matrix",
      prompt: "Transpose $\\begin{pmatrix}1&3\\\\2&4\\end{pmatrix}$.",
      hints: ["Interchange rows and columns.", "The result remains two by two."],
      concept: "Matrix transpose",
      difficulty: "core",
      topic_slug: "matrix-arithmetic",
      lesson_title: "Matrix arithmetic",
    },
    {
      id: "proof-answer",
      kind: "proof",
      prompt: "Order the steps showing a linear map preserves zero.",
      choices: ["Subtract $T(0)$ to conclude $T(0)=0$.", "Use additivity to write $T(0)=T(0)+T(0)$."],
      hints: ["Apply additivity first.", "Then subtract the repeated term."],
      concept: "Proof from additivity",
      difficulty: "stretch",
      topic_slug: "linear-transformations-in-coordinates",
      lesson_title: "Linear transformations in coordinates",
    },
    {
      id: "choice-answer",
      kind: "choice",
      prompt: "Which vector is orthogonal to $(1,2)$?",
      choices: ["(2, -1)", "(1, 2)", "(0, 1)"],
      hints: ["Compute a dot product.", "Orthogonality requires zero."],
      concept: "Orthogonality",
      difficulty: "core",
      topic_slug: "dot-products-norms-and-angles",
      lesson_title: "Dot products, norms, and angles",
    },
  ],
};

const entries = ["1/2", '["1/2", 3]', "[[1, 2], [3, 4]]", "[2,1]", "(2, -1)"];
const expectedAnswers = [
  0.5,
  [0.5, 3],
  [
    [1, 2],
    [3, 4],
  ],
  [2, 1],
  "(2, -1)",
];
const emptyProgress = { items: [], summary: { total: 300, started: 0, completed: 0, roadmaps: [] } };

function resultFor(correct = session.questions.length): AssessmentResult {
  return {
    session_id: session.id,
    mode: session.mode,
    score: (correct / session.questions.length) * 100,
    passed: correct / session.questions.length >= 0.75,
    correct,
    total: session.questions.length,
    progress: null,
    feedback: session.questions.map((question, index) => ({
      question_id: question.id,
      prompt: question.prompt,
      concept: question.concept,
      correct: index < correct,
      submitted_answer: entries[index],
      expected_answer: expectedAnswers[index],
      solution:
        index === 0
          ? "Divide $2c=1$ by two to obtain $c=1/2$."
          : "Apply the definition of " + question.concept.toLowerCase() + " to obtain the expected answer.",
      topic_slug: question.topic_slug,
    })),
  };
}

function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function mockAssessmentApi({
  assessment = session,
  submit = async () => response(resultFor()),
  start = async () => response(assessment),
  resume = async () => response(assessment),
  save = async (draft: AssessmentDraft) => response({ ...assessment, draft }),
}: {
  assessment?: AssessmentSession;
  submit?: () => Promise<ReturnType<typeof response>>;
  start?: () => Promise<ReturnType<typeof response>>;
  resume?: () => Promise<ReturnType<typeof response>>;
  save?: (draft: AssessmentDraft) => Promise<ReturnType<typeof response>>;
} = {}) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/roadmaps/progress")) return response(emptyProgress);
    if (url.endsWith("/assessments") && init?.method === "POST") return start();
    if (url.endsWith("/" + assessment.id + "/submit") && init?.method === "POST") return submit();
    if (url.endsWith("/" + assessment.id + "/draft") && init?.method === "PUT")
      return save(JSON.parse(String(init.body)) as AssessmentDraft);
    if (url.endsWith("/assessments/" + assessment.id) && (!init?.method || init.method === "GET"))
      return resume();
    throw new Error("Unexpected assessment request: " + (init?.method ?? "GET") + " " + url);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

function renderAssessment(mode: "practice" | "exam" | "review" = "practice") {
  return render(
    <RoadmapProgressProvider>
      <AssessmentPanel
        roadmapSlug="linear-algebra"
        topicSlug={mode === "practice" ? session.topic_slug! : undefined}
        mode={mode}
      />
    </RoadmapProgressProvider>,
  );
}

async function startAndAnswer() {
  fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
  await screen.findByRole("textbox", { name: "Answer to question 1" });
  for (let index = 0; index < 3; index += 1) {
    fireEvent.change(screen.getByRole("textbox", { name: "Answer to question " + (index + 1) }), {
      target: { value: entries[index] },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "Add step 2 to proof" }));
  fireEvent.click(screen.getByRole("button", { name: "Add step 1 to proof" }));
  fireEvent.click(screen.getByLabelText("(2, -1)"));
}

beforeEach(() => localStorage.clear());

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const draftKey = "brainhub:assessment:v2:linear-algebra:practice:vector-arithmetic-and-linear-combinations";

function storeDraft(
  answers: Record<string, string>,
  revision = 1,
  activeSession: AssessmentSession = session,
) {
  localStorage.setItem(
    draftKey,
    JSON.stringify({
      version: 2,
      sessionId: activeSession.id,
      roadmapSlug: activeSession.roadmap_slug,
      topicSlug: activeSession.topic_slug,
      stageIndex: 0,
      mode: activeSession.mode,
      answers,
      startedAt: Date.now() - 30_000,
      revision,
      session: activeSession,
    }),
  );
}

describe("authored mathematics learning", () => {
  it("renders inline fractions and display matrices as accessible MathML", () => {
    const { container } = render(
      <MathText>
        {"An exact fraction is $\\frac{1}{2}$. A matrix is $$\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}$$."}
      </MathText>,
    );
    const mathematics = container.querySelectorAll("math");
    expect(mathematics).toHaveLength(2);
    expect(mathematics[0]?.querySelector("mfrac")).not.toBeNull();
    expect(mathematics[1]?.querySelector("mtable")).not.toBeNull();
    expect(mathematics[1]?.getAttribute("display")).toBe("block");
    expect(container.querySelector(".katex-error")).toBeNull();
    expect(container.textContent).toContain("An exact fraction is");
  });

  it("submits fractions, vectors, matrices, proof ordering, and choices for server grading", async () => {
    const mock = mockAssessmentApi();
    renderAssessment();
    await startAndAnswer();
    expect(screen.getByRole("textbox", { name: "Answer to question 2" })).toHaveAccessibleDescription(
      /Entries may be fractions/,
    );
    expect(screen.getByRole("textbox", { name: "Answer to question 3" })).toHaveAccessibleDescription(
      /Enter rows as/,
    );
    expect(screen.getByRole("group", { name: "Build your proof order" })).toHaveAccessibleDescription(
      /logical order/,
    );
    expect(screen.getByText("5 of 5 answered · 75% to pass")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    expect(await screen.findByText("Lesson mastered. Your progress has been saved.")).toBeInTheDocument();
    const startRequest = mock.mock.calls.find(([input]) => String(input).endsWith("/assessments"));
    expect(JSON.parse(String(startRequest?.[1]?.body))).toEqual({
      mode: "practice",
      topic_slug: session.topic_slug,
      stage_index: 0,
    });
    const submitRequest = mock.mock.calls.find(([input]) => String(input).endsWith("/submit"));
    expect(JSON.parse(String(submitRequest?.[1]?.body))).toEqual({
      answers: session.questions.map((question, index) => ({
        question_id: question.id,
        answer: entries[index],
      })),
      time_spent_seconds: expect.any(Number),
    });
  });

  it("focuses the first unanswered question without sending an incomplete assessment", async () => {
    const mock = mockAssessmentApi();
    renderAssessment();
    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
    const firstAnswer = await screen.findByRole("textbox", { name: "Answer to question 1" });
    fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Answer every question before submitting");
    expect(firstAnswer).toHaveFocus();
    expect(mock.mock.calls.filter(([input]) => String(input).endsWith("/submit"))).toHaveLength(0);
  });

  it("blocks duplicate submissions while grading is pending", async () => {
    let resolveSubmission!: (value: ReturnType<typeof response>) => void;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => {
      resolveSubmission = resolve;
    });
    const mock = mockAssessmentApi({ submit: () => pending });
    renderAssessment();
    await startAndAnswer();
    const submitButton = screen.getByRole("button", { name: "Submit practice" });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);
    expect(screen.getByRole("button", { name: "Grading…" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Answer to question 1" })).toBeDisabled();
    expect(mock.mock.calls.filter(([input]) => String(input).endsWith("/submit"))).toHaveLength(1);
    await act(async () => resolveSubmission(response(resultFor())));
    expect(screen.getByRole("button", { name: "Start another session" })).toBeEnabled();
  });

  it("keeps all answers after a grading error and permits retrying the same session", async () => {
    let submissions = 0;
    const mock = mockAssessmentApi({
      submit: async () => {
        submissions += 1;
        return submissions === 1
          ? response({ detail: "Grading is temporarily unavailable." }, 503)
          : response(resultFor());
      },
    });
    renderAssessment();
    await startAndAnswer();
    fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Grading is temporarily unavailable.");
    for (let index = 0; index < 3; index += 1) {
      expect(screen.getByRole("textbox", { name: "Answer to question " + (index + 1) })).toHaveValue(
        entries[index],
      );
    }
    expect(screen.getByText("Position 1 · Step 2")).toBeInTheDocument();
    expect(screen.getByText("Position 2 · Step 1")).toBeInTheDocument();
    expect(screen.getByLabelText("(2, -1)")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    expect(await screen.findByText("Lesson mastered. Your progress has been saved.")).toBeInTheDocument();
    const submissionsSent = mock.mock.calls.filter(([input]) => String(input).endsWith("/submit"));
    expect(submissionsSent).toHaveLength(2);
    const firstBody = JSON.parse(String(submissionsSent[0]?.[1]?.body));
    const secondBody = JSON.parse(String(submissionsSent[1]?.[1]?.body));
    expect(secondBody.answers).toEqual(firstBody.answers);
    expect(mock.mock.calls.filter(([input]) => String(input).endsWith("/assessments"))).toHaveLength(1);
  });

  it("shows server-reported failure and worked feedback instead of assuming entered answers passed", async () => {
    mockAssessmentApi({ submit: async () => response(resultFor(2)) });
    renderAssessment();
    await startAndAnswer();
    fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    const result = await screen.findByRole("status");
    expect(result).toHaveTextContent("40% · 2/5 correct");
    expect(result).toHaveTextContent("Your mistakes are saved for targeted practice.");
    expect(screen.queryByText("Lesson mastered. Your progress has been saved.")).not.toBeInTheDocument();
    expect(screen.getByText("Question 3: Review needed · Matrix transpose")).toBeInTheDocument();
    expect(screen.getByText("Question 4: Review needed · Proof from additivity")).toBeInTheDocument();
  });

  it("can retry a failed session start without showing questions prematurely", async () => {
    let starts = 0;
    mockAssessmentApi({
      start: async () => {
        starts += 1;
        return starts === 1
          ? response({ detail: "Session creation failed. Try again." }, 503)
          : response(session);
      },
    });
    renderAssessment();
    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Session creation failed.");
    expect(screen.queryByRole("textbox", { name: "Answer to question 1" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
    expect(await screen.findByRole("textbox", { name: "Answer to question 1" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("starts an exam without a topic filter and withholds practice hints", async () => {
    const mock = mockAssessmentApi({ assessment: { ...session, mode: "exam", topic_slug: null } });
    renderAssessment("exam");
    fireEvent.click(screen.getByRole("button", { name: "Start exam" }));
    await screen.findByRole("textbox", { name: "Answer to question 1" });
    expect(screen.queryByText("Hints")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit exam" })).toBeInTheDocument();
    await waitFor(() => {
      const startRequest = mock.mock.calls.find(([input]) => String(input).endsWith("/assessments"));
      expect(JSON.parse(String(startRequest?.[1]?.body))).toEqual({ mode: "exam", stage_index: 0 });
    });
  });

  it("restores partial fraction, vector, and proof answers after remounting", async () => {
    const mock = mockAssessmentApi();
    const initial = renderAssessment();
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    const firstAnswer = await screen.findByRole("textbox", { name: "Answer to question 1" });
    fireEvent.change(firstAnswer, { target: { value: "1/2" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Answer to question 2" }), {
      target: { value: '["1/2", 3]' },
    });
    fireEvent.click(screen.getByText("Raw order editor (optional)"));
    fireEvent.change(screen.getByRole("textbox", { name: "Answer to question 4" }), {
      target: { value: "[2, 1]" },
    });
    expect(JSON.parse(localStorage.getItem(draftKey)!).answers).toEqual({
      "fraction-answer": "1/2",
      "vector-answer": '["1/2", 3]',
      "proof-answer": "[2, 1]",
    });
    initial.unmount();
    renderAssessment();
    expect(await screen.findByRole("textbox", { name: "Answer to question 1" })).toHaveValue("1/2");
    expect(screen.getByRole("textbox", { name: "Answer to question 2" })).toHaveValue('["1/2", 3]');
    expect(screen.getByText("Position 1 · Step 2")).toBeInTheDocument();
    expect(screen.getByText("Position 2 · Step 1")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(draftKey)!).answers["proof-answer"]).toBe("[2, 1]");
    expect(mock.mock.calls.filter(([input]) => String(input).endsWith("/assessments"))).toHaveLength(1);
  });

  it("uses a newer local snapshot without resurrecting a removed server answer", async () => {
    storeDraft({}, 4);
    mockAssessmentApi({
      resume: async () =>
        response({
          ...session,
          draft: {
            answers: [{ question_id: "fraction-answer", answer: "1/2" }],
            time_spent_seconds: 10,
            revision: 3,
          },
        }),
    });
    renderAssessment();
    expect(await screen.findByRole("textbox", { name: "Answer to question 1" })).toHaveValue("");
    expect(screen.getByText(/Restored your latest device answers/)).toBeInTheDocument();
  });

  it("uses a newer server revision and advances the next local save from it", async () => {
    storeDraft({ "fraction-answer": "1/2" }, 2);
    const mock = mockAssessmentApi({
      resume: async () =>
        response({
          ...session,
          draft: {
            answers: [{ question_id: "fraction-answer", answer: "3/4" }],
            time_spent_seconds: 35,
            revision: 5,
          },
        }),
    });
    renderAssessment();
    const answer = await screen.findByRole("textbox", { name: "Answer to question 1" });
    expect(answer).toHaveValue("3/4");
    fireEvent.change(answer, { target: { value: "2/3" } });
    await waitFor(
      () => {
        const saved = mock.mock.calls.find(([input]) => String(input).endsWith("/draft"));
        expect(saved).toBeDefined();
        const body = JSON.parse(String(saved?.[1]?.body));
        expect(body.revision).toBe(6);
        expect(body.answers).toEqual([{ question_id: "fraction-answer", answer: "2/3" }]);
        expect(body.time_spent_seconds).toBeGreaterThanOrEqual(35);
      },
      { timeout: 2000 },
    );
  });

  it("ignores corrupt storage and keeps practice usable when storage access throws", async () => {
    localStorage.setItem(draftKey, "{broken json");
    mockAssessmentApi();
    const initial = renderAssessment();
    expect(await screen.findByRole("button", { name: "Start practice" })).toBeEnabled();
    initial.unmount();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage disabled");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage disabled");
    });
    renderAssessment();
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    const answer = await screen.findByRole("textbox", { name: "Answer to question 1" });
    fireEvent.change(answer, { target: { value: "1/2" } });
    expect(answer).toHaveValue("1/2");
    expect(screen.getByText(/Device storage is unavailable/)).toBeInTheDocument();
    expect(
      await screen.findByText("Draft saved to your profile.", {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  });

  it.each(["exam", "review"] as const)("does not restore a practice draft into %s mode", async (mode) => {
    storeDraft({ "fraction-answer": "1/2" });
    const mock = mockAssessmentApi({ assessment: { ...session, mode, topic_slug: null } });
    renderAssessment(mode);
    expect(await screen.findByRole("button", { name: "Start " + mode })).toBeEnabled();
    expect(screen.queryByRole("textbox", { name: "Answer to question 1" })).not.toBeInTheDocument();
    expect(
      mock.mock.calls.filter(([input]) => String(input).endsWith("/assessments/" + session.id)),
    ).toHaveLength(0);
  });

  it("keeps lesson drafts separate when the mounted practice scope changes", async () => {
    storeDraft({ "fraction-answer": "1/2" });
    mockAssessmentApi();
    const view = renderAssessment();
    expect(await screen.findByRole("textbox", { name: "Answer to question 1" })).toHaveValue("1/2");
    view.rerender(
      <RoadmapProgressProvider>
        <AssessmentPanel roadmapSlug="linear-algebra" topicSlug="matrix-arithmetic" />
      </RoadmapProgressProvider>,
    );
    expect(await screen.findByRole("button", { name: "Start practice" })).toBeEnabled();
    expect(screen.queryByRole("textbox", { name: "Answer to question 1" })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(draftKey)!).answers["fraction-answer"]).toBe("1/2");
  });

  it("preserves expired answers in a read-only recovery view", async () => {
    storeDraft({ "fraction-answer": "1/2", "vector-answer": '["1/2", 3]' }, 2, {
      ...session,
      expires_at: "2020-01-01T00:00:00Z",
    });
    mockAssessmentApi({ resume: async () => response({ detail: "This assessment has expired." }, 410) });
    renderAssessment();
    expect(await screen.findByRole("heading", { name: "Your saved answers" })).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText('["1/2", 3]')).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit practice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Answer to question 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a fresh session" })).toBeEnabled();
    expect(localStorage.getItem(draftKey)).not.toBeNull();
  });

  it("recovers a completed server result and clears its matching local draft", async () => {
    storeDraft({ "fraction-answer": "1/2" });
    mockAssessmentApi({ resume: async () => response({ ...session, result: resultFor() }) });
    renderAssessment();
    expect(await screen.findByText("Lesson mastered. Your progress has been saved.")).toBeInTheDocument();
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit practice" })).not.toBeInTheDocument();
  });

  it("preserves closed answers when the server reports that the curriculum changed", async () => {
    storeDraft({ "fraction-answer": "1/2" }, 2);
    mockAssessmentApi({
      resume: async () => response({ detail: "This assessment's curriculum changed." }, 409),
    });
    renderAssessment();
    expect(await screen.findByRole("heading", { name: "Your saved answers" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("The curriculum changed");
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a fresh session" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Submit practice" })).not.toBeInTheDocument();
    expect(localStorage.getItem(draftKey)).not.toBeNull();
  });

  it.each([
    { description: "duplicate question IDs", questions: [session.questions[0]!, session.questions[0]!] },
    { description: "missing proof choices", questions: [{ ...session.questions[3]!, choices: undefined }] },
    { description: "empty choice options", questions: [{ ...session.questions[4]!, choices: [] }] },
    {
      description: "duplicate choice options",
      questions: [{ ...session.questions[4]!, choices: ["same", "same"] }],
    },
  ])("ignores an unanswerable cached session with $description", async ({ questions }) => {
    storeDraft({ "fraction-answer": "1/2" }, 2, { ...session, questions });
    const mock = mockAssessmentApi();
    renderAssessment();
    expect(await screen.findByRole("button", { name: "Start practice" })).toBeEnabled();
    expect(screen.queryByRole("textbox", { name: "Answer to question 1" })).not.toBeInTheDocument();
    expect(
      mock.mock.calls.filter(([input]) => String(input).endsWith("/assessments/" + session.id)),
    ).toHaveLength(0);
  });

  it("recovers a committed result when a submit response is lost", async () => {
    const mock = mockAssessmentApi({
      submit: async () => {
        throw new TypeError("Network response lost");
      },
      resume: async () => response({ ...session, result: resultFor() }),
    });
    renderAssessment();
    await startAndAnswer();
    fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    expect(await screen.findByText("Lesson mastered. Your progress has been saved.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(mock.mock.calls.filter(([input]) => String(input).endsWith("/submit"))).toHaveLength(1);
  });

  it("does not let a late autosave response overwrite a newer answer or saved status", async () => {
    let resolveOldSave!: (value: ReturnType<typeof response>) => void;
    const oldSave = new Promise<ReturnType<typeof response>>((resolve) => {
      resolveOldSave = resolve;
    });
    const mock = mockAssessmentApi({
      save: async (draft) => (draft.revision === 1 ? oldSave : response({ ...session, draft })),
    });
    renderAssessment();
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    const answer = await screen.findByRole("textbox", { name: "Answer to question 1" });
    fireEvent.change(answer, { target: { value: "1/2" } });
    await waitFor(
      () => expect(mock.mock.calls.filter(([input]) => String(input).endsWith("/draft"))).toHaveLength(1),
      { timeout: 2000 },
    );
    fireEvent.change(answer, { target: { value: "3/4" } });
    expect(
      await screen.findByText("Draft saved to your profile.", {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    await act(async () =>
      resolveOldSave(
        response({
          ...session,
          draft: {
            answers: [{ question_id: "fraction-answer", answer: "1/2" }],
            time_spent_seconds: 0,
            revision: 1,
          },
        }),
      ),
    );
    expect(answer).toHaveValue("3/4");
    expect(JSON.parse(localStorage.getItem(draftKey)!).answers["fraction-answer"]).toBe("3/4");
    expect(screen.getByText("Draft saved to your profile.")).toBeInTheDocument();
  });
});
