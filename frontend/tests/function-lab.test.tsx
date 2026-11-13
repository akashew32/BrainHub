import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionLab } from "@/components/roadmaps/function-lab";
import { FunctionPlot, clipPolyline } from "@/components/roadmaps/function-plot";
import { defaultFunctionScene, evaluateFunction, FUNCTION_PRESETS } from "@/lib/function-lab";
import {
  FUNCTION_LESSONS,
  FUNCTION_MODES,
  functionFields,
  type FunctionMode,
  type FunctionPlotData,
  type FunctionScene,
} from "@/lib/function-lab-types";

function edit(label: string, value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value } });
}
function choose(label: string, value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value } });
}
function fill(values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) edit(label, value);
}
function reveal() {
  fireEvent.click(screen.getByRole("button", { name: "Reveal result" }));
}
function matchPrediction() {
  expect(screen.getAllByText("Your prediction matches the model.").length).toBeGreaterThan(0);
}
function answerKind(kind: string) {
  expect(document.querySelector(`[data-answer-kind="${kind}"]`)).toBeInTheDocument();
}
const scene = (mode: FunctionMode, values: Partial<FunctionScene> = {}) => ({
  ...defaultFunctionScene(mode),
  ...values,
});
const model = (mode: FunctionMode, values: Partial<FunctionScene> = {}) =>
  evaluateFunction(mode, scene(mode, values));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Exploration must remain local")));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("function explorer component", () => {
  it("offers six labelled native experiments, optional predictions and explicit reveal without persistence", () => {
    const storage = ["getItem", "setItem", "removeItem"].map((method) =>
      vi.spyOn(Storage.prototype, method as "getItem"),
    );
    render(<FunctionLab />);
    const experiments = screen.getByRole("combobox", { name: "Experiment" });
    expect(experiments.tagName).toBe("SELECT");
    expect(within(experiments).getAllByRole("option")).toHaveLength(6);
    for (const mode of FUNCTION_MODES)
      expect(
        within(experiments).getByRole("option", { name: FUNCTION_LESSONS[mode].title }),
      ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your prediction" })).toHaveValue("");
    expect(screen.queryByRole("img", { name: "Function plot" })).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Reveal result" });
    button.focus();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("type", "button");
    reveal();
    expect(screen.getByRole("img", { name: "Function plot" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    storage.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it.each(FUNCTION_MODES)("preserves invalid raw input and disables reveal in %s", (mode) => {
    render(<FunctionLab initialMode={mode} />);
    const field = functionFields(mode, defaultFunctionScene(mode))[0]!;
    for (const value of ["", "NaN", "Infinity", "1.5", String(field.max + 1), String(field.min - 1)]) {
      edit(field.label, value);
      expect(screen.getByRole("textbox", { name: field.label })).toHaveValue(value);
      expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
      expect(screen.queryByRole("img", { name: "Function plot" })).not.toBeInTheDocument();
    }
    edit(field.label, String(field.min));
    expect(screen.getByRole("button", { name: "Reveal result" })).toBeEnabled();
  });
});

describe("concrete functions and domains", () => {
  it("distinguishes composition order and inverse branches, including excluded inputs", () => {
    render(<FunctionLab initialMode="composition" />);
    fill({ "Excluded value a": "1", "Horizontal shift h": "1", "Probe input": "0" });
    choose("Operation", "fg");
    choose("Prediction type", "undefined");
    expect(screen.getByRole("button", { name: "Reveal result" })).toBeEnabled();
    reveal();
    answerKind("undefined");
    matchPrediction(); // f(g(0)) = f(1) is excluded.
    choose("Operation", "gf");
    choose("Prediction type", "value");
    edit("Your prediction", "4");
    reveal();
    answerKind("number");
    matchPrediction(); // g(f(0)) = (-1-1)^2 = 4.
    choose("Operation", "inverse-left");
    edit("Probe input", "4");
    edit("Your prediction", "-1");
    reveal();
    matchPrediction();
    choose("Operation", "inverse-right");
    edit("Your prediction", "3");
    reveal();
    matchPrediction();
    edit("Probe input", "-1");
    choose("Prediction type", "undefined");
    reveal();
    answerKind("undefined");
    matchPrediction();
  });

  it("keeps a cancelled rational input excluded and distinguishes an included coincident root", () => {
    render(<FunctionLab initialMode="rational" />);
    choose("Function family", "shifted");
    fill({ "Horizontal shift h": "1", "Linear offset b": "2", "Remainder a": "0", "Probe input": "1" });
    choose("Prediction type", "undefined");
    reveal();
    matchPrediction();
    expect(document.querySelector('[data-open="true"][data-x="1"][data-y="3"]')).toBeInTheDocument();
    edit("Probe input", "2");
    choose("Prediction type", "value");
    edit("Your prediction", "4");
    reveal();
    matchPrediction();
    choose("Function family", "polynomial");
    fill({ "Horizontal shift h": "1", "Root parameter b": "-1", "Multiplicity m": "2", "Probe input": "1" });
    edit("Your prediction", "0");
    reveal();
    answerKind("number");
    matchPrediction();
    expect(document.querySelector('[data-open="false"][data-x="1"][data-y="0"]')).toBeInTheDocument();
  });

  it("handles a decreasing exponential/log inverse and strict positive log domain", () => {
    render(<FunctionLab initialMode="exponential" />);
    choose("Base b", "half");
    choose("Operation", "exp");
    fill({ "Horizontal shift h": "1", "Probe input": "3", "Your prediction": "1/4" });
    reveal();
    matchPrediction();
    choose("Operation", "log");
    edit("Probe input", "4");
    edit("Your prediction", "-1");
    reveal();
    matchPrediction();
    for (const input of ["0", "-1"]) {
      edit("Probe input", input);
      choose("Prediction type", "undefined");
      expect(screen.getByRole("button", { name: "Reveal result" })).toBeEnabled();
      reveal();
      answerKind("undefined");
      matchPrediction();
    }
  });

  it("uses exact trigonometric zeros and preserves the original identity holes", () => {
    render(<FunctionLab initialMode="trigonometry" />);
    choose("Function family", "wave");
    fill({
      "Amplitude A": "3",
      "Frequency B": "2",
      "Phase C in multiples of π/6": "0",
      "Vertical shift D": "0",
      "Probe angle in multiples of π/6": "3",
      "Your prediction": "0",
    });
    reveal();
    matchPrediction(); // 3 sin(pi), exactly zero.
    choose("Function family", "identity");
    edit("Probe angle in multiples of π/6", "1");
    edit("Your prediction", "1/2");
    reveal();
    matchPrediction();
    for (const angle of ["-6", "0", "6", "12"]) {
      edit("Probe angle in multiples of π/6", angle);
      choose("Prediction type", "undefined");
      reveal();
      answerKind("undefined");
      matchPrediction();
    }
  });

  it("converts signed polar inputs and changes ellipse orientation without changing radii", () => {
    render(<FunctionLab initialMode="curves" />);
    choose("Coordinate model", "polar");
    fill({ "Signed radius r": "-2", "Angle in multiples of π/6": "3", "Your prediction": "[0,-2]" });
    reveal();
    answerKind("vector");
    matchPrediction();
    edit("Signed radius r", "0");
    edit("Your prediction", "[0,0]");
    reveal();
    matchPrediction();
    choose("Coordinate model", "ellipse");
    fill({
      "Horizontal radius a": "3",
      "Vertical radius b": "2",
      "Parameter t in multiples of π/6": "3",
      "Your prediction": "[0,2]",
    });
    choose("Increasing parameter direction", "ccw");
    reveal();
    matchPrediction();
    choose("Increasing parameter direction", "cw");
    edit("Your prediction", "[0,-2]");
    reveal();
    matchPrediction();
  });

  it("requires the exact strict sequence threshold rather than a rounded or approximate index", () => {
    render(<FunctionLab initialMode="sequences" />);
    choose("Sequence family", "rational");
    fill({
      "Numerator slope a": "0",
      "Numerator constant b": "1",
      "Denominator slope c": "1",
      "Denominator constant d": "0",
      "Error numerator p": "1",
      "Error denominator q": "4",
      "Terms to display": "8",
      "Your prediction": "5",
    });
    reveal();
    answerKind("integer");
    matchPrediction(); // 1/n < 1/4 starts at N=5; n=4 is equality.
    edit("Your prediction", "4");
    reveal();
    expect(
      screen.getAllByText("Your prediction differs from the model. Compare the explanation and try again.")
        .length,
    ).toBeGreaterThan(0);
    edit("Your prediction", "5.000000001");
    expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
    edit("Your prediction", "10/2");
    reveal();
    matchPrediction();
  });

  it("allows no-index and a loose fixed tolerance for an oscillation without claiming convergence", () => {
    render(<FunctionLab initialMode="sequences" />);
    choose("Sequence family", "recurrence");
    choose("Recurrence ratio ρ", "negative-one");
    fill({
      "Initial term a₁": "1",
      "Recurrence offset c": "0",
      "Error numerator p": "1",
      "Error denominator q": "1",
    });
    choose("Prediction type", "no-index");
    reveal();
    answerKind("no-index");
    matchPrediction(); // Every error equals 1, so strict epsilon=1 fails forever.
    edit("Error numerator p", "2");
    choose("Prediction type", "value");
    edit("Your prediction", "1");
    reveal();
    answerKind("integer");
    matchPrediction();
    expect(
      model("sequences", {
        sequence: "recurrence",
        ratio: "negative-one",
        a: 1,
        b: 0,
        p: 2,
        q: 1,
      }).observations.join(" "),
    ).toMatch(/without establishing convergence/i);
  });
});

describe("exploration drafts and invalidation", () => {
  it("preserves raw controls, prediction type/text and reasoning per mode while invalidating revealed answers", () => {
    render(<FunctionLab initialMode="composition" />);
    fill({ "Probe input": "2", "Your prediction": "7/3" });
    reveal();
    edit("Explain your reasoning", "Check the original domain first.");
    edit("Probe input", "3");
    expect(screen.queryByRole("img", { name: "Function plot" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your prediction" })).toHaveValue("7/3");
    choose("Prediction type", "undefined");
    choose("Experiment", "curves");
    edit("Your prediction", "[1/2,-2]");
    choose("Experiment", "composition");
    expect(screen.getByRole("textbox", { name: "Probe input" })).toHaveValue("3");
    expect(screen.getByRole("combobox", { name: "Prediction type" })).toHaveValue("undefined");
    choose("Prediction type", "value");
    expect(screen.getByRole("textbox", { name: "Your prediction" })).toHaveValue("7/3");
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue(
      "Check the original domain first.",
    );
    choose("Experiment", "curves");
    expect(screen.getByRole("textbox", { name: "Your prediction" })).toHaveValue("[1/2,-2]");
    expect(screen.queryByRole("img", { name: "Function plot" })).not.toBeInTheDocument();
  });

  it("clears only the current prediction on presets/reset, preserving reasoning and other mode drafts", () => {
    render(<FunctionLab initialMode="composition" />);
    edit("Your prediction", "1/7");
    reveal();
    edit("Explain your reasoning", "Remember the branch restriction.");
    choose("Experiment", "curves");
    edit("Your prediction", "[2,3]");
    choose("Experiment", "composition");
    const preset = FUNCTION_PRESETS.find(
      (item) =>
        item.mode === "composition" &&
        item.id !== FUNCTION_PRESETS.find((item) => item.mode === "composition")!.id,
    )!;
    choose("Preset", preset.id);
    expect(screen.getByRole("textbox", { name: "Your prediction" })).toHaveValue("");
    expect(screen.queryByRole("img", { name: "Function plot" })).not.toBeInTheDocument();
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue(
      "Remember the branch restriction.",
    );
    edit("Your prediction", "3/2");
    fireEvent.click(screen.getByRole("button", { name: "Reset experiment" }));
    expect(screen.getByRole("textbox", { name: "Your prediction" })).toHaveValue("");
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue(
      "Remember the branch restriction.",
    );
    choose("Experiment", "curves");
    expect(screen.getByRole("textbox", { name: "Your prediction" })).toHaveValue("[2,3]");
  });

  it("rejects malformed scalar/vector predictions and invalidates stale comparisons", () => {
    render(<FunctionLab initialMode="exponential" />);
    edit("Your prediction", "sqrt(");
    expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
    edit("Your prediction", "");
    reveal();
    edit("Your prediction", "1");
    expect(screen.queryByRole("img", { name: "Function plot" })).not.toBeInTheDocument();
    choose("Experiment", "curves");
    for (const value of ["1", "[1]", "[1,2,3]", "[Infinity,0]"]) {
      edit("Your prediction", value);
      expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
    }
    edit("Your prediction", "[1/2,sqrt(4)]");
    expect(screen.getByRole("button", { name: "Reveal result" })).toBeEnabled();
  });
});

describe("function plot geometry and domain separation", () => {
  it("distinguishes one static polar displacement arrow from two ellipse parameter arrows and the undirected origin", () => {
    const polar = model("curves", { curves: "polar", radius: -2, angle: 3 });
    expect(polar.plot!.curves.filter((curve) => curve.direction).map((curve) => curve.direction)).toEqual([
      "displacement",
    ]);
    const view = render(<FunctionPlot data={polar.plot} />);
    const svg = screen.getByRole("img", { name: "Function plot" });
    const arrows = svg.querySelectorAll('line[data-direction-arrow="displacement"]');
    expect(arrows).toHaveLength(1);
    expect(svg.querySelectorAll('[data-direction-arrow="increasing-parameter"]')).toHaveLength(0);
    const arrow = arrows[0]!;
    expect(Number(arrow.getAttribute("x1"))).toBeCloseTo(300, 9);
    expect(Number(arrow.getAttribute("y1"))).toBeCloseTo(300, 9);
    expect(Number(arrow.getAttribute("x2"))).toBeCloseTo(300, 9);
    expect(Number(arrow.getAttribute("y2"))).toBeCloseTo(300 + 480 / 7, 9); // (0,-2) is below the origin.
    expect(view.container.textContent).toMatch(/displacement/i);
    expect(view.container.textContent).not.toMatch(/increasing parameter/i);

    const ellipse = model("curves", { curves: "ellipse", a: 3, b: 2, direction: "ccw" });
    expect(ellipse.plot!.curves.find((curve) => curve.role === "function")?.direction).toBe("parameter");
    view.rerender(<FunctionPlot data={ellipse.plot} />);
    expect(view.container.querySelectorAll('[data-direction-arrow="increasing-parameter"]')).toHaveLength(2);
    expect(view.container.querySelectorAll('[data-direction-arrow="displacement"]')).toHaveLength(0);
    expect(view.container.textContent).toMatch(/increasing parameter/i);

    view.rerender(<FunctionPlot data={model("curves", { curves: "polar", radius: 0, angle: 3 }).plot} />);
    expect(view.container.querySelectorAll("[data-direction-arrow]")).toHaveLength(0);
    expect(
      view.container.querySelector('[data-marker-label="Origin; angle not unique"]'),
    ).toBeInTheDocument();
    expect(view.container.textContent).not.toMatch(/increasing parameter/i);
  });

  it("clips segment intersections instead of manufacturing horizontal boundary plateaus", () => {
    const bounds = { xMin: -2, xMax: 2, yMin: -1, yMax: 1 };
    expect(
      clipPolyline(
        [
          [-1, -4],
          [0, 0],
          [1, 4],
        ],
        bounds,
      ),
    ).toEqual([
      [
        [-0.25, -1],
        [0, 0],
        [0.25, 1],
      ],
    ]);
    expect(
      clipPolyline(
        [
          [-2, 0],
          [-1, 2],
          [1, 2],
          [2, 0],
        ],
        bounds,
      ),
    ).toEqual([
      [
        [-2, 0],
        [-1.5, 1],
      ],
      [
        [1.5, 1],
        [2, 0],
      ],
    ]);
    expect(
      clipPolyline(
        [
          [-1, 2],
          [1, 2],
        ],
        bounds,
      ),
    ).toEqual([]);
    expect(
      clipPolyline(
        [
          [NaN, 1],
          [1, Infinity],
        ],
        bounds,
      ),
    ).toEqual([]);
    expect(
      clipPolyline(
        [
          [0, 0],
          [1, 1],
        ],
        { ...bounds, xMax: -2 },
      ),
    ).toEqual([]);
  });

  it("uses y-up equal-unit coordinates, separate discrete points and explicit open/closed markers", () => {
    const data: FunctionPlotData = {
      bounds: { xMin: -4, xMax: 4, yMin: -2, yMax: 2 },
      curves: [
        {
          label: "Three discrete values",
          role: "function",
          style: "points",
          points: [
            [-1, -1],
            [0, 0],
            [1, 1],
          ],
        },
      ],
      markers: [
        { label: "Excluded", at: [-2, 0], open: true },
        { label: "Included", at: [2, 0], open: false },
      ],
      xLabel: "x",
      yLabel: "y",
      caption: "An independent geometry fixture.",
      equalScale: true,
      clipped: false,
    };
    render(<FunctionPlot data={data} />);
    const svg = screen.getByRole("img", { name: "Function plot" });
    const points = svg.querySelectorAll('circle[data-point-style="discrete"]');
    expect(points).toHaveLength(3);
    const X = [...points].map((point) => Number(point.getAttribute("cx"))),
      Y = [...points].map((point) => Number(point.getAttribute("cy")));
    expect(X).toEqual([240, 300, 360]);
    expect(Y).toEqual([360, 300, 240]);
    expect(X[2]! - X[1]!).toBe(Y[1]! - Y[2]!);
    expect(svg.querySelectorAll('[data-style="points"] polyline')).toHaveLength(0);
    expect(svg.querySelector('[data-marker-label="Excluded"]')).toHaveAttribute("data-open", "true");
    expect(svg.querySelector('[data-marker-label="Included"]')).toHaveAttribute("data-open", "false");
    const table = screen.getByRole("table", { name: "Coordinates represented in the plot" });
    expect(within(table).getAllByRole("row")).toHaveLength(6);
    expect(within(table).getByText("(-1, -1)")).toBeInTheDocument();
    expect(within(table).getByText("Excluded (open circle)")).toBeInTheDocument();
    expect(within(table).getByText("Included (filled marker)")).toBeInTheDocument();
  });

  it("keeps every selected rational and identity component on its own side of excluded inputs", () => {
    const rational = model("rational", { rational: "shifted", h: 1, b: 2, a: 0 });
    const holeCurves = rational.plot!.curves.filter((curve) => curve.role === "function");
    expect(holeCurves.length).toBeGreaterThanOrEqual(2);
    for (const curve of holeCurves) {
      expect(curve.points.some(([x]) => x === 1)).toBe(false);
      expect(curve.points.every(([x]) => x < 1) || curve.points.every(([x]) => x > 1)).toBe(true);
    }
    const pole = model("rational", { rational: "shifted", h: 1, a: 2 });
    for (const curve of pole.plot!.curves.filter((entry) => entry.role === "function"))
      expect(curve.points.every(([x]) => x < 1) || curve.points.every(([x]) => x > 1)).toBe(true);
    const identity = model("trigonometry", { trigonometry: "identity" });
    for (const curve of identity.plot!.curves.filter((entry) => entry.role === "function")) {
      for (const [x] of curve.points) expect(Math.abs(Math.sin(x))).toBeGreaterThan(1e-10);
      for (let index = 1; index < curve.points.length; index += 1) {
        const left = curve.points[index - 1]![0],
          right = curve.points[index]![0];
        for (let multiple = -4; multiple <= 4; multiple += 1)
          expect(left < multiple * Math.PI && right > multiple * Math.PI).toBe(false);
      }
    }
  });

  it("bounds samples and keeps every clipped SVG coordinate finite", () => {
    for (const preset of FUNCTION_PRESETS) {
      const result = evaluateFunction(preset.mode, preset.scene);
      expect(result.error, preset.id).toBeNull();
      for (const curve of result.plot!.curves) {
        expect(curve.points.length).toBeLessThanOrEqual(curve.style === "points" ? 40 : 241);
        for (const [x, y] of curve.points) expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        const clipped = clipPolyline(curve.points, result.plot!.bounds);
        for (const [x, y] of clipped.flat()) {
          expect(x).toBeGreaterThanOrEqual(result.plot!.bounds.xMin - 1e-9);
          expect(x).toBeLessThanOrEqual(result.plot!.bounds.xMax + 1e-9);
          expect(y).toBeGreaterThanOrEqual(result.plot!.bounds.yMin - 1e-9);
          expect(y).toBeLessThanOrEqual(result.plot!.bounds.yMax + 1e-9);
        }
      }
      const view = render(<FunctionPlot data={result.plot} />);
      expect(view.container.querySelector("svg")!.outerHTML).not.toMatch(/NaN|Infinity/);
      view.unmount();
    }
  });
});

describe("independent algebraic review", () => {
  it("checks every recurrence ratio with exact integer error comparisons", () => {
    for (const ratio of ["half", "negative-half", "zero", "negative-one"] as const)
      for (let a = -3; a <= 3; a += 1)
        for (let b = -3; b <= 3; b += 1) {
          let expected: number | null;
          if (ratio === "zero") expected = 4 * Math.abs(a - b) < 1 ? 1 : 2;
          else if (ratio === "negative-one") expected = 4 * Math.abs(2 * a - b) < 2 ? 1 : null;
          else {
            const numerator = ratio === "half" ? Math.abs(a - 2 * b) : Math.abs(3 * a - 2 * b);
            const denominator = ratio === "half" ? 1 : 3;
            expected = 1;
            while (4 * numerator >= denominator * 2 ** (expected - 1)) expected += 1;
          }
          const answer = model("sequences", { sequence: "recurrence", ratio, a, b, p: 1, q: 4 }).answer;
          if (expected === null) expect(answer?.kind).toBe("no-index");
          else expect(answer).toMatchObject({ kind: "integer", value: expected });
        }
  });

  it("checks every rational sequence threshold by exact integer inequalities at N and N minus one", () => {
    for (let a = -3; a <= 3; a += 1)
      for (let b = -3; b <= 3; b += 1)
        for (let c = 1; c <= 3; c += 1)
          for (let d = 0; d <= 3; d += 1) {
            const result = model("sequences", { sequence: "rational", a, b, c, d, p: 1, q: 20 });
            const answer = result.answer;
            expect(answer?.kind).toBe("integer");
            if (answer?.kind !== "integer") continue;
            const N = answer.value,
              numerator = Math.abs(b * c - a * d) * 20;
            expect(Number.isInteger(N) && N >= 1).toBe(true);
            expect(numerator).toBeLessThan(c * (c * N + d));
            if (N > 1) expect(numerator).toBeGreaterThanOrEqual(c * (c * (N - 1) + d));
          }
  });

  it("independently verifies values, inverse domains, and coincident polynomial multiplicity", () => {
    expect(model("composition", { composition: "gf", a: 1, h: 1, x: 0 }).answer).toMatchObject({
      kind: "number",
      value: 4,
    });
    expect(model("composition", { composition: "fg", a: 1, h: 1, x: 0 }).answer?.kind).toBe("undefined");
    expect(model("composition", { composition: "inverse-left", h: 1, x: 4 }).answer).toMatchObject({
      kind: "number",
      value: -1,
    });
    expect(model("rational", { rational: "horizontal", a: 2, b: 1, c: 3, x: 2 }).answer).toMatchObject({
      kind: "number",
      value: 9 / 13,
    });
    expect(model("rational", { rational: "polynomial", h: 1, b: -1, m: 2, x: 2 }).answer).toMatchObject({
      kind: "number",
      value: 1,
    });
    const triple = model("rational", { rational: "polynomial", h: 1, b: -1, m: 2, x: 1 });
    expect(
      [...triple.steps, ...triple.observations, ...triple.facts.map((fact) => fact.value)].join(" "),
    ).toMatch(/multiplicit(?:y|ies)[^.]*3/i);
    expect(model("exponential", { exponential: "log", base: "half", h: 1, x: 4 }).answer).toMatchObject({
      kind: "number",
      value: -1,
    });
    expect(
      model("trigonometry", { trigonometry: "wave", a: 3, b: 2, d: 0, phase: 0, angle: 3 }).answer,
    ).toMatchObject({ kind: "number", value: 0 });
    const polar = model("curves", { curves: "polar", radius: -2, angle: 3 }).answer;
    expect(polar?.kind).toBe("vector");
    if (polar?.kind === "vector") {
      expect(polar.value[0] === 0).toBe(true); // A signed floating zero is the same coordinate.
      expect(polar.value[1]).toBe(-2);
    }
  });
});

describe("function explorer SSR hydration", () => {
  async function hydrate(element: React.ReactNode, assertion: (container: HTMLDivElement) => void) {
    const errors: unknown[] = [];
    const messages = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, element, {
          onRecoverableError: (error) => {
            errors.push(error);
          },
        });
      });
      assertion(container);
      expect(errors).toEqual([]);
      expect(messages).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        root?.unmount();
      });
      container.remove();
      messages.mockRestore();
    }
  }

  it.each(FUNCTION_MODES)("hydrates the default %s explorer after an actual HTML parse", async (mode) => {
    await hydrate(<FunctionLab initialMode={mode} />, (container) => {
      expect(within(container).getByRole("combobox", { name: "Experiment" })).toHaveValue(mode);
      expect(within(container).getByRole("button", { name: "Reveal result" })).toBeEnabled();
    });
  });

  it.each(FUNCTION_MODES)("hydrates the revealed %s plot after an actual HTML parse", async (mode) => {
    const result = model(mode);
    expect(result.error).toBeNull();
    expect(result.plot).not.toBeNull();
    await hydrate(<FunctionPlot data={result.plot} />, (container) => {
      expect(within(container).getByRole("img", { name: "Function plot" })).toBeInTheDocument();
      expect(
        within(container).getByRole("table", { name: "Coordinates represented in the plot" }),
      ).toBeInTheDocument();
      expect(container.querySelector("svg")!.outerHTML).not.toMatch(/NaN|Infinity/);
    });
  });
});
