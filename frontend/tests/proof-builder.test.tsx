import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProofBuilder } from "@/components/roadmaps/proof-builder";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import type { AssessmentResult, AssessmentSession, ProofDetails } from "@/lib/curriculum";

const steps = [
  "Because $0+0=0$, write $T(0)=T(0+0)$.",
  "Apply additivity: $T(0+0)=T(0)+T(0)$.",
  "Subtract $T(0)$ from both sides to obtain $T(0)=0$.",
];

function Harness({ initial = "", disabled = false }: { initial?: string; disabled?: boolean }) {
  const [raw, setRaw] = useState(initial);
  return (
    <>
      <ProofBuilder id="proof-test" choices={steps} value={raw} onChange={setRaw} disabled={disabled} />
      <output data-testid="serialized-order">{raw}</output>
    </>
  );
}

function selectedLabels() {
  const selected = screen.getByRole("list", { name: "Selected proof steps" });
  return within(selected)
    .getAllByRole("listitem")
    .map((item) => item.querySelector("p")?.textContent);
}

const proofSession: AssessmentSession = {
  id: "proof-session",
  mode: "practice",
  roadmap_slug: "linear-algebra",
  topic_slug: "linear-transformations-in-coordinates",
  expires_at: "2099-01-01T00:00:00Z",
  pass_score: 75,
  questions: [
    {
      id: "proof-zero",
      kind: "proof",
      prompt: "Order the steps proving a linear map sends zero to zero.",
      choices: steps,
      hints: ["Start with $0+0=0$.", "Apply additivity before subtracting."],
      concept: "Preservation of zero",
      difficulty: "core",
      topic_slug: "linear-transformations-in-coordinates",
      lesson_title: "Linear transformations in coordinates",
    },
  ],
};

function mockSession(proofDetails?: ProofDetails) {
  const result: AssessmentResult = {
    session_id: proofSession.id,
    mode: "practice",
    score: proofDetails ? 0 : 100,
    passed: !proofDetails,
    correct: proofDetails ? 0 : 1,
    total: 1,
    progress: null,
    feedback: [
      {
        question_id: "proof-zero",
        prompt: proofSession.questions[0]!.prompt,
        concept: "Preservation of zero",
        correct: !proofDetails,
        submitted_answer: proofDetails ? "[3,2,1]" : "[1,2,3]",
        expected_answer: [1, 2, 3],
        solution: "Use additivity and then subtract the common term.",
        topic_slug: proofSession.topic_slug!,
        proof_details: proofDetails,
      },
    ],
  };
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/roadmaps/progress"))
      return { ok: true, json: async () => ({ items: [], summary: {} }) };
    if (url.endsWith("/assessments") && init?.method === "POST")
      return { ok: true, json: async () => proofSession };
    if (url.endsWith("/submit") && init?.method === "POST") return { ok: true, json: async () => result };
    if (url.endsWith("/draft"))
      return { ok: true, json: async () => ({ ...proofSession, draft: JSON.parse(String(init?.body)) }) };
    throw new Error("Unexpected proof request " + url);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

function renderSession() {
  return render(
    <RoadmapProgressProvider>
      <AssessmentPanel roadmapSlug="linear-algebra" topicSlug={proofSession.topic_slug!} />
    </RoadmapProgressProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("accessible proof builder", () => {
  it("appends numbered steps and serializes the partial selection into the draft", async () => {
    render(<Harness />);
    const firstControl = screen.getByRole("button", { name: "Add step 3 to proof" });
    firstControl.focus();
    expect(firstControl).toHaveFocus();
    expect(firstControl).toHaveAttribute("type", "button");
    fireEvent.click(firstControl);
    fireEvent.click(screen.getByRole("button", { name: "Add step 1 to proof" }));
    expect(screen.getByTestId("serialized-order")).toHaveTextContent("[3,1]");
    expect(selectedLabels()).toEqual(["Position 1 · Step 3", "Position 2 · Step 1"]);
    expect(screen.getByText("Selected 2 of 3 steps")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add step 3 to proof" })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove step 1 from proof" })).toHaveFocus(),
    );
  });

  it("moves steps up and down, announces the new position, and preserves useful focus", async () => {
    render(<Harness initial="[3,1,2]" />);
    fireEvent.click(screen.getByRole("button", { name: "Move step 2 up" }));
    expect(screen.getByTestId("serialized-order")).toHaveTextContent("[3,2,1]");
    expect(screen.getByText("Moved step 2 to position 2 of 3.")).toHaveAttribute("aria-live", "polite");
    await waitFor(() => expect(screen.getByRole("button", { name: "Move step 2 up" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Move step 2 up" }));
    expect(selectedLabels()[0]).toBe("Position 1 · Step 2");
    expect(screen.getByRole("button", { name: "Move step 2 up" })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove step 2 from proof" })).toHaveFocus(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Move step 2 down" }));
    expect(screen.getByTestId("serialized-order")).toHaveTextContent("[3,2,1]");
    await waitFor(() => expect(screen.getByRole("button", { name: "Move step 2 down" })).toHaveFocus());
  });

  it("removes selected steps and resets with focus returning to the first available step", async () => {
    render(<Harness initial="[3,1,2]" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove step 1 from proof" }));
    expect(screen.getByTestId("serialized-order")).toHaveTextContent("[3,2]");
    await waitFor(() => expect(screen.getByRole("button", { name: "Add step 1 to proof" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Reset proof order" }));
    expect(screen.getByTestId("serialized-order")).toHaveTextContent("[]");
    expect(screen.getByText("Selected 0 of 3 steps")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Selected proof steps" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add step 1 to proof" })).toHaveFocus());
  });

  it("restores a valid partial raw draft without reserializing it on mount", () => {
    const changed = vi.fn();
    render(<ProofBuilder id="saved-proof" choices={steps} value="[2, 1]" onChange={changed} />);
    expect(selectedLabels()).toEqual(["Position 1 · Step 2", "Position 2 · Step 1"]);
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Raw proof order")).not.toBeVisible();
    expect(screen.getByText("Raw order editor (optional)").parentElement).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Raw order editor (optional)"));
    expect(screen.getByRole("textbox", { name: "Raw proof order" })).toHaveValue("[2, 1]");
  });

  it.each(["[2,2]", "[0,1]", "[4]", "[true,1]", '[1,"2"]', "[2.0,1]", "[2e0,1]", "not json", "{}"])(
    "keeps invalid legacy raw draft %s unchanged until an explicit edit or reset",
    (raw) => {
      render(<Harness initial={raw} />);
      expect(screen.getByRole("textbox", { name: "Raw proof order" })).toHaveValue(raw);
      expect(screen.getByText(/Your original response is unchanged/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add step 1 to proof" })).toBeDisabled();
      expect(screen.getByTestId("serialized-order").textContent).toBe(raw);
      fireEvent.click(screen.getByRole("button", { name: "Reset proof order" }));
      expect(screen.getByTestId("serialized-order")).toHaveTextContent("[]");
      expect(screen.getByRole("button", { name: "Add step 1 to proof" })).toBeEnabled();
    },
  );

  it("keeps the raw editor open while deliberately repairing a saved draft", () => {
    render(<Harness initial="[2,2]" />);
    const editor = screen.getByRole("textbox", { name: "Raw proof order" });
    fireEvent.change(editor, { target: { value: "[2,1]" } });
    expect(screen.getByRole("textbox", { name: "Raw proof order" })).toHaveValue("[2,1]");
    expect(selectedLabels()).toEqual(["Position 1 · Step 2", "Position 2 · Step 1"]);
    expect(screen.queryByText(/Your original response is unchanged/)).not.toBeInTheDocument();
  });

  it("disables builder and raw-edit actions while grading", () => {
    const changed = vi.fn();
    render(<ProofBuilder id="disabled-proof" choices={steps} value="[1,2]" onChange={changed} disabled />);
    screen.getAllByRole("button").forEach((button) => expect(button).toBeDisabled());
    expect(screen.getByLabelText("Raw proof order")).toBeDisabled();
    const rawEditor = screen.getByText("Raw order editor (optional)").parentElement!;
    expect(rawEditor).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Raw order editor (optional)"));
    expect(rawEditor).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Add step 3 to proof" }));
    fireEvent.change(screen.getByLabelText("Raw proof order"), { target: { value: "[3,2,1]" } });
    expect(changed).not.toHaveBeenCalled();
  });

  it("uses native controls that inherit a disabled fieldset", () => {
    render(
      <fieldset disabled>
        <Harness initial="[1]" />
      </fieldset>,
    );
    screen.getAllByRole("button").forEach((button) => expect(button).toBeDisabled());
    expect(screen.getByLabelText("Raw proof order")).toBeDisabled();
  });
});

describe("proof assessment integration", () => {
  it("keeps partial proof selections out of completion counts and submits only a full permutation", async () => {
    const mock = mockSession();
    renderSession();
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add step 1 to proof" }));
    expect(screen.getByText("0 of 1 answered · 75% to pass")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Select every proof step exactly once");
    expect(screen.getByRole("group", { name: "Build your proof order" })).toHaveFocus();
    expect(mock.mock.calls.filter(([url]) => String(url).endsWith("/submit"))).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Add step 2 to proof" }));
    fireEvent.click(screen.getByRole("button", { name: "Add step 3 to proof" }));
    expect(screen.getByText("1 of 1 answered · 75% to pass")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    expect(await screen.findByText("Practice passed. Your progress has been saved.")).toBeInTheDocument();
    const submission = mock.mock.calls.find(([url]) => String(url).endsWith("/submit"));
    expect(JSON.parse(String(submission?.[1]?.body)).answers).toEqual([
      { question_id: "proof-zero", answer: "[1,2,3]" },
    ]);
  });

  it("renders submitted and valid arguments, dependency feedback, and per-step justifications", async () => {
    mockSession({
      submitted_steps: [3, 2, 1].map((step) => ({ step, text: steps[step - 1]! })),
      expected_steps: [
        { step: 1, text: steps[0]!, justification: "Start with the identity $0+0=0$." },
        { step: 2, text: steps[1]!, justification: "Additivity applies after the input sum is written." },
        { step: 3, text: steps[2]!, justification: "Cancellation completes the argument." },
      ],
      first_divergence: 1,
      correct_prefix_length: 0,
      total_steps: 3,
      explanation: "The cancellation step needs the additive equation first.",
      violated_dependencies: [{ step: 3, requires: 2 }],
    });
    renderSession();
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    for (const step of [3, 2, 1])
      fireEvent.click(await screen.findByRole("button", { name: "Add step " + step + " to proof" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    const feedback = await screen.findByRole("region", { name: "Proof order feedback" });
    expect(within(feedback).getByRole("heading", { name: "Your submitted argument" })).toBeInTheDocument();
    expect(within(feedback).getByRole("heading", { name: "One valid proof" })).toBeInTheDocument();
    expect(within(feedback).getByText(/Correct initial steps: 0 of 3/)).toBeInTheDocument();
    expect(within(feedback).getByText(/The first difference is at position 1/)).toBeInTheDocument();
    expect(within(feedback).getByText("Step 3 requires step 2 to appear earlier.")).toBeInTheDocument();
    expect(within(feedback).getByText("Cancellation completes the argument.")).toBeInTheDocument();
    expect(
      within(feedback).getByText("The cancellation step needs the additive equation first."),
    ).toBeInTheDocument();
    expect(within(feedback).queryByText(/Expected:/)).not.toBeInTheDocument();
  });
});
