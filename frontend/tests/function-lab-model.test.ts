import katex from "katex";
import { describe, expect, it } from "vitest";
import {
  FUNCTION_PRESETS,
  cosineSixth,
  defaultFunctionScene,
  evaluateFunction,
  formatFunctionNumber,
  sineSixth,
} from "@/lib/function-lab";
import {
  FUNCTION_MODES,
  type FunctionMode,
  type FunctionResult,
  type FunctionScene,
} from "@/lib/function-lab-types";

function evaluate(mode: FunctionMode, values: Partial<FunctionScene> = {}): FunctionResult {
  return evaluateFunction(mode, { ...defaultFunctionScene(mode), ...values });
}
function number(result: FunctionResult): number {
  expect(result.error).toBeNull();
  expect(result.answer?.kind).toBe("number");
  if (result.answer?.kind !== "number") throw new Error("Expected a numeric probe");
  return result.answer.value;
}
function index(result: FunctionResult): number | null {
  expect(result.error).toBeNull();
  if (result.answer?.kind === "no-index") return null;
  expect(result.answer?.kind).toBe("integer");
  if (result.answer?.kind !== "integer") throw new Error("Expected an integer index");
  return result.answer.value;
}
function fact(result: FunctionResult, label: string): string {
  const entry = result.facts.find((item) => item.label === label);
  expect(entry, `Missing fact ${label}`).toBeDefined();
  return entry!.value;
}
function noBridging(result: FunctionResult, cuts: readonly number[]) {
  for (const curve of result.plot!.curves.filter((item) => item.role === "function")) {
    for (const cut of cuts) {
      const xs = curve.points.map((point) => point[0]);
      expect(Math.min(...xs) < cut && Math.max(...xs) > cut, `${curve.label} bridges ${cut}`).toBe(false);
      expect(xs.some((x) => x === cut)).toBe(false);
    }
  }
}

describe("bounded public function-family models", () => {
  it("supplies contrasting original presets and never mutates a scene", () => {
    expect(FUNCTION_PRESETS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(FUNCTION_PRESETS.map((item) => item.id)).size).toBe(FUNCTION_PRESETS.length);
    for (const mode of FUNCTION_MODES) {
      expect(FUNCTION_PRESETS.filter((item) => item.mode === mode).length).toBeGreaterThanOrEqual(3);
      const original = defaultFunctionScene(mode),
        copy = { ...original };
      evaluateFunction(mode, Object.freeze({ ...original }));
      expect(original).toEqual(copy);
      original.x = -4;
      expect(defaultFunctionScene(mode)).toEqual(copy);
    }
  });

  it("keeps all preset TeX strict, plot coordinates finite, and sampling bounded", () => {
    for (const preset of FUNCTION_PRESETS) {
      const output = evaluateFunction(preset.mode, preset.scene);
      expect(output.error, preset.id).toBeNull();
      expect(output.setup.length).toBeGreaterThan(0);
      expect(output.answer).not.toBeNull();
      for (const text of [...output.setup, ...output.steps, ...output.observations])
        for (const match of text.matchAll(/\$([^$\n]+)\$/g))
          expect(
            () =>
              katex.renderToString(match[1]!, {
                throwOnError: true,
                strict: "error",
                trust: false,
                maxExpand: 500,
              }),
            `${preset.id}: ${match[1]}`,
          ).not.toThrow();
      for (const curve of output.plot!.curves) {
        expect(curve.points.length).toBeLessThanOrEqual(curve.style === "points" ? 40 : 241);
        expect(curve.points.flat().every(Number.isFinite)).toBe(true);
      }
      expect(output.plot!.markers.flatMap((marker) => marker.at).every(Number.isFinite)).toBe(true);
      if (preset.mode !== "sequences")
        expect(output.plot!.bounds).toEqual({ xMin: -7, xMax: 7, yMin: -7, yMax: 7 });
    }
  });

  it("validates only active controls and refuses unknown choices without throwing", () => {
    expect(evaluate("composition", { a: 1.5 }).error).toMatch(/whole number/);
    expect(evaluate("composition", { composition: "inverse-left", a: 999 }).error).toBeNull();
    expect(evaluate("trigonometry", { trigonometry: "identity", a: 999, b: 999, d: 999 }).error).toBeNull();
    expect(evaluate("curves", { curves: "polar", a: 999, b: 999 }).error).toBeNull();
    expect(evaluate("sequences", { p: 0 }).error).toMatch(/whole number/);
    expect(evaluate("composition", { composition: "bad" as FunctionScene["composition"] }).error).toMatch(
      /valid/,
    );
    expect(evaluateFunction("bad" as FunctionMode, defaultFunctionScene("composition")).error).toMatch(/six/);
  });

  it("does not round a small nonzero value into an exact zero", () => {
    expect(formatFunctionNumber(1e-12)).not.toBe("0");
    expect(Number(formatFunctionNumber(1 / 3))).toBeCloseTo(1 / 3, 9);
    expect(formatFunctionNumber(-0)).toBe("0");
  });
});

describe("composition, original domains and restricted inverse branches", () => {
  it("computes the two orders independently", () => {
    expect(number(evaluate("composition", { composition: "fg", a: 1, h: 1, x: 3 }))).toBeCloseTo(
      1 / (4 - 1),
      14,
    );
    expect(number(evaluate("composition", { composition: "gf", a: 1, h: 1, x: 3 }))).toBe(
      (1 / (3 - 1) - 1) ** 2,
    );
    const invalid = evaluate("composition", { composition: "gf", a: 2, h: -1, x: 2 });
    expect(invalid.answer?.kind).toBe("undefined");
    expect(invalid.error).toBeNull();
    expect(invalid.setup.length).toBeGreaterThan(0);
  });

  it("separates both irrational exclusions before sampling rather than missing a pole", () => {
    const output = evaluate("composition", { composition: "fg", a: 2, h: 1, x: 1 });
    expect(number(output)).toBe(-0.5);
    noBridging(output, [1 - Math.sqrt(2), 1 + Math.sqrt(2)]);
    expect(output.plot!.curves.filter((curve) => curve.role === "function")).toHaveLength(3);
  });

  it("handles no exclusion and the one double-pole case separately", () => {
    const none = evaluate("composition", { composition: "fg", a: -1, h: 0, x: 0 });
    expect(number(none)).toBe(1);
    expect(fact(none, "Excluded inputs")).toBe("None");
    const doubled = evaluate("composition", { composition: "fg", a: 0, h: -2, x: -2 });
    expect(doubled.answer?.kind).toBe("undefined");
    noBridging(doubled, [-2]);
    expect(doubled.steps.join(" ")).toMatch(/positive infinity on both sides/);
    const offscreen = evaluate("composition", { composition: "gf", a: 0, h: 3, x: 1 });
    expect(fact(offscreen, "Horizontal asymptote")).toBe("y = 9");
    expect(offscreen.plot!.clipped).toBe(true);
  });

  it("uses a closed inverse endpoint, a negative left branch, and excludes negative inverse inputs", () => {
    expect(number(evaluate("composition", { composition: "inverse-right", h: 1, x: 4 }))).toBe(3);
    expect(number(evaluate("composition", { composition: "inverse-left", h: 1, x: 4 }))).toBe(-1);
    const boundary = evaluate("composition", { composition: "inverse-left", h: -2, x: 0 });
    expect(number(boundary)).toBe(-2);
    expect(boundary.plot!.markers).toContainEqual({
      label: "Included inverse endpoint",
      at: [0, -2],
      open: false,
    });
    expect(evaluate("composition", { composition: "inverse-right", x: -1 }).answer?.kind).toBe("undefined");
  });
});

describe("rational structure rather than cancellation or plot artifacts", () => {
  it("keeps a canceled input undefined and marks its hole open", () => {
    const hole = evaluate("rational", { rational: "shifted", a: 0, h: 1, b: 2, x: 1 });
    expect(hole.answer?.kind).toBe("undefined");
    expect(hole.plot!.markers).toContainEqual({ label: "Excluded hole", at: [1, 3], open: true });
    noBridging(hole, [1]);
    expect(hole.plot!.curves.some((curve) => curve.label === "Vertical asymptote")).toBe(false);
    expect(number(evaluate("rational", { rational: "shifted", a: 0, h: 1, b: 2, x: -2 }))).toBe(0);
  });

  it("has an actual pole for nonzero remainder and retains its one-sided signs", () => {
    const pole = evaluate("rational", { rational: "shifted", a: 2, h: 1, b: -1, x: 0 });
    expect(number(pole)).toBe(-3);
    noBridging(pole, [1]);
    expect(fact(pole, "One-sided pole behavior")).toBe("Left → −∞; right → +∞");
    expect(fact(evaluate("rational", { rational: "shifted", a: -2, h: 1 }), "One-sided pole behavior")).toBe(
      "Left → +∞; right → −∞",
    );
    expect(pole.plot!.markers.some((marker) => marker.open)).toBe(false);
    expect(pole.plot!.clipped).toBe(true);
  });

  it("adds coincident root multiplicities and includes all polynomial roots", () => {
    const merged = evaluate("rational", { rational: "polynomial", h: 1, b: -1, m: 2, x: 2 });
    expect(number(merged)).toBe((2 - 1) ** 2 * (2 - 1));
    expect(merged.plot!.markers).toEqual([{ label: "Root 1, multiplicity 3", at: [1, 0], open: false }]);
    expect(fact(merged, "End behavior")).toBe("Left → −∞; right → +∞");
    const distinct = evaluate("rational", { rational: "polynomial", h: 1, b: 1, m: 2, x: 0 });
    expect(number(distinct)).toBe(1);
    expect(distinct.plot!.markers).toHaveLength(2);
    expect(fact(distinct, "Roots and multiplicities")).toBe("1: 2; -1: 1");
    expect((0.9 - 1) ** 2 * (0.9 + 1)).toBeGreaterThan(0);
    expect((1.1 - 1) ** 2 * (1.1 + 1)).toBeGreaterThan(0);
  });

  it("derives horizontal limits with positive denominator including a vanished leading numerator", () => {
    const output = evaluate("rational", { rational: "horizontal", a: 2, b: 1, c: 3, x: 2 });
    expect(number(output)).toBeCloseTo(9 / 13, 14);
    expect(fact(output, "Horizontal asymptote")).toBe("y = 2/3");
    const lowerDegree = evaluate("rational", { rational: "horizontal", a: 0, b: 2, c: 2, x: 3 });
    expect(number(lowerDegree)).toBeCloseTo(2 / 19, 14);
    expect(fact(lowerDegree, "Horizontal asymptote")).toBe("y = 0");
  });
});

describe("exponential/logarithmic domains and exact special-angle probes", () => {
  it("keeps bases below one valid and marks a strict logarithm boundary", () => {
    expect(number(evaluate("exponential", { exponential: "exp", base: "two", h: 1, x: 3 }))).toBe(4);
    expect(number(evaluate("exponential", { exponential: "exp", base: "three", h: 0, x: -4 }))).toBeCloseTo(
      1 / 81,
      14,
    );
    expect(number(evaluate("exponential", { exponential: "log", base: "half", h: 1, x: 4 }))).toBe(-1);
    for (const x of [-1, 0]) {
      const output = evaluate("exponential", { exponential: "log", x });
      expect(output.answer?.kind).toBe("undefined");
      expect(output.error).toBeNull();
      expect(
        output
          .plot!.curves.filter((curve) => curve.role === "function")
          .flatMap((curve) => curve.points)
          .every((point) => point[0] > 0),
      ).toBe(true);
    }
  });

  it("uses true zero special angles and preserves the unit-circle identity", () => {
    for (let step = -24; step <= 24; step += 1) {
      expect(sineSixth(step) ** 2 + cosineSixth(step) ** 2).toBeCloseTo(1, 14);
      if (step % 6 === 0) expect(sineSixth(step)).toBe(0);
    }
    expect(cosineSixth(3)).toBe(0);
    expect(sineSixth(1)).toBe(0.5);
    expect(sineSixth(-1)).toBe(-0.5);
  });

  it("separates phase/frequency and treats trig cancellation holes as actual exclusions", () => {
    const wave = evaluate("trigonometry", { trigonometry: "wave", a: 2, b: 3, phase: 1, d: -1, angle: 2 });
    expect(number(wave)).toBe(-2);
    expect(fact(wave, "Period")).toBe("2/3π");
    const hole = evaluate("trigonometry", { trigonometry: "identity", angle: 6 });
    expect(hole.answer?.kind).toBe("undefined");
    const cuts = [-2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI];
    noBridging(hole, cuts);
    expect(hole.plot!.markers).toHaveLength(5);
    expect(hole.plot!.markers.every((marker) => marker.open && marker.at[1] === 0)).toBe(true);
    expect(number(evaluate("trigonometry", { trigonometry: "identity", angle: 1 }))).toBe(0.5);
    expect(evaluate("trigonometry", { trigonometry: "identity", angle: 1 }).answer?.display).toBe("1/2");
    expect(evaluate("trigonometry", { trigonometry: "identity", angle: 2 }).answer?.display).toMatch(
      /rounded/,
    );
  });
});

describe("parameter direction and signed polar coordinates", () => {
  it("traverses the same ellipse in opposite orders without inventing speed", () => {
    const ccw = evaluate("curves", { curves: "ellipse", a: 3, b: 2, angle: 3, direction: "ccw" });
    const cw = evaluate("curves", { curves: "ellipse", a: 3, b: 2, angle: 3, direction: "cw" });
    expect(ccw.answer).toMatchObject({ kind: "vector", value: [0, 2] });
    expect(cw.answer).toMatchObject({ kind: "vector", value: [0, -2] });
    const area = (output: FunctionResult) =>
      output.plot!.curves[0]!.points.slice(1).reduce((sum, point, i) => {
        const previous = output.plot!.curves[0]!.points[i]!;
        return sum + previous[0] * point[1] - point[0] * previous[1];
      }, 0);
    expect(area(ccw)).toBeGreaterThan(0);
    expect(area(cw)).toBeLessThan(0);
    expect(ccw.plot!.curves[0]!.direction).toBe("parameter");
    expect(ccw.plot!.equalScale).toBe(true);
    expect(
      evaluate("curves", { curves: "ellipse", a: 3, b: 2, angle: -3, direction: "ccw" }).answer,
    ).toMatchObject({ kind: "vector", value: [0, -2] });
  });

  it("uses displacement arrows only for a nonzero polar radius and no unique origin angle", () => {
    const negative = evaluate("curves", { curves: "polar", radius: -3, angle: 2 });
    const equivalent = evaluate("curves", { curves: "polar", radius: 3, angle: 8 });
    expect(negative.answer).toMatchObject({ kind: "vector" });
    if (negative.answer?.kind !== "vector" || equivalent.answer?.kind !== "vector")
      throw new Error("Expected vector points");
    expect(negative.answer.value[0]).toBe(-1.5);
    expect(negative.answer.value[1]).toBeCloseTo((-3 * Math.sqrt(3)) / 2, 14);
    expect(negative.answer.value).toEqual(equivalent.answer.value);
    expect(negative.plot!.curves[0]!.direction).toBe("displacement");
    const origin = evaluate("curves", { curves: "polar", radius: 0, angle: 6 });
    expect(origin.plot!.curves).toHaveLength(0);
    expect(fact(origin, "Angle at origin")).toMatch(/Not unique/);
    expect(origin.plot!.markers[0]!.at.every((value) => value === 0)).toBe(true);
  });
});

describe("all-later strict accuracy is exact and not inferred from finite points", () => {
  it("rejects a floating-point-near boundary exactly and checks N−1", () => {
    const output = evaluate("sequences", { sequence: "rational", a: 3, b: 0, c: 3, d: 1, p: 1, q: 10, n: 5 });
    expect(index(output)).toBe(4);
    expect(output.table!.rows[2]).toEqual(["3", "9/10", "1/10", "No (on the excluded boundary)"]);
    expect(output.table!.rows[3]![3]).toBe("Yes");
    // A naive floating subtraction would wrongly mark this as strictly inside.
    expect(Math.abs(0.9 - 1) < 0.1).toBe(true);
  });

  it("gives N=11 for 1/n<1/10 and states when a proven tail is offscreen", () => {
    const harmonic = evaluate("sequences", {
      sequence: "rational",
      a: 0,
      b: 1,
      c: 1,
      d: 0,
      p: 1,
      q: 10,
      n: 15,
    });
    expect(index(harmonic)).toBe(11);
    expect(harmonic.table!.rows[9]).toEqual(["10", "1/10", "1/10", "No (on the excluded boundary)"]);
    const beyond = evaluate("sequences", {
      sequence: "rational",
      a: 0,
      b: 3,
      c: 1,
      d: 0,
      p: 1,
      q: 20,
      n: 12,
    });
    expect(index(beyond)).toBe(61);
    expect(beyond.observations.join(" ")).toMatch(/beyond the 12 displayed/);
    expect(
      beyond
        .plot!.curves.filter((curve) => curve.role === "function")
        .every((curve) => curve.style === "points"),
    ).toBe(true);
    expect(beyond.plot!.curves.some((curve) => curve.label === "First eventual index N")).toBe(false);
  });

  it("matches independent integer inequalities across a signed rational-family corpus", () => {
    for (const a of [-2, 0, 2])
      for (const b of [-2, 0, 2])
        for (const c of [1, 2])
          for (const d of [0, 2])
            for (const q of [2, 5]) {
              const inside = (n: number) => Math.abs((a * n + b) * c - a * (c * n + d)) * q < c * (c * n + d);
              let expected = 1;
              while (!inside(expected)) expected += 1;
              const output = evaluate("sequences", { sequence: "rational", a, b, c, d, p: 1, q, n: 5 });
              expect(index(output)).toBe(expected);
              expect(inside(expected)).toBe(true);
              if (expected > 1) expect(inside(expected - 1)).toBe(false);
              expect(inside(expected + 100)).toBe(true);
            }
  });

  it("uses exact alternating recurrence terms and excludes equality at the previous index", () => {
    const output = evaluate("sequences", {
      sequence: "recurrence",
      ratio: "negative-half",
      a: 2,
      b: 0,
      p: 1,
      q: 2,
      n: 6,
    });
    expect(index(output)).toBe(4);
    expect(output.table!.rows.map((row) => row[1])).toEqual(["2", "-1", "1/2", "-1/4", "1/8", "-1/16"]);
    expect(output.table!.rows[2]![3]).toBe("No (on the excluded boundary)");
    expect(output.table!.rows[3]![3]).toBe("Yes");
    expect(output.observations.join(" ")).toMatch(/not a convergence proof/);
  });

  it("distinguishes a loose accuracy band from convergence of a two-cycle", () => {
    const tight = evaluate("sequences", {
      sequence: "recurrence",
      ratio: "negative-one",
      a: 1,
      b: 0,
      p: 1,
      q: 1,
      n: 4,
    });
    expect(index(tight)).toBeNull();
    const loose = evaluate("sequences", {
      sequence: "recurrence",
      ratio: "negative-one",
      a: 1,
      b: 0,
      p: 2,
      q: 1,
      n: 4,
    });
    expect(index(loose)).toBe(1);
    expect(fact(loose, "Convergence")).toMatch(/Does not converge/);
    expect(fact(loose, "Reference fixed point L")).toBe("0");
    expect(loose.table!.rows.map((row) => row[1])).toEqual(["1", "-1", "1", "-1"]);
    expect(loose.table!.rows.every((row) => row[3] === "Yes")).toBe(true);
    expect(loose.observations.join(" ")).toMatch(/not the sequence's limit/);
  });

  it("preserves constant fixed-point cases and handles zero ratio's initial term", () => {
    for (const [ratio, a, b] of [
      ["half", 2, 1],
      ["negative-half", 2, 3],
      ["negative-one", 1, 2],
      ["zero", 2, 2],
    ] as const) {
      const output = evaluate("sequences", { sequence: "recurrence", ratio, a, b, p: 1, q: 20, n: 4 });
      expect(index(output)).toBe(1);
      expect(fact(output, "Convergence")).toMatch(/^Converges/);
      expect(new Set(output.table!.rows.map((row) => row[1])).size).toBe(1);
    }
    const zero = evaluate("sequences", {
      sequence: "recurrence",
      ratio: "zero",
      a: 3,
      b: -1,
      p: 4,
      q: 1,
      n: 4,
    });
    expect(index(zero)).toBe(2);
    expect(zero.table!.rows.map((row) => row[1])).toEqual(["3", "-1", "-1", "-1"]);
    expect(zero.table!.rows[0]![3]).toBe("No (on the excluded boundary)");
  });
});
