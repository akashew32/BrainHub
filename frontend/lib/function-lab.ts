import {
  FUNCTION_MODES,
  functionChoices,
  functionFields,
  type FunctionAnswer,
  type FunctionBounds,
  type FunctionCurve,
  type FunctionMarker,
  type FunctionMode,
  type FunctionPlotData,
  type FunctionPreset,
  type FunctionResult,
  type FunctionScene,
  type FunctionVec,
} from "@/lib/function-lab-types";

type Rational = { n: bigint; d: bigint };
const BOUNDS: FunctionBounds = { xMin: -7, xMax: 7, yMin: -7, yMax: 7 };
const ZERO: Rational = { n: 0n, d: 1n };
function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a,
    y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x;
}
function rational(n: number | bigint, d: number | bigint = 1): Rational {
  let numerator = BigInt(n),
    denominator = BigInt(d);
  if (!denominator) throw new RangeError("A rational denominator must be nonzero.");
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const divisor = gcd(numerator, denominator);
  return { n: numerator / divisor, d: denominator / divisor };
}
const plus = (a: Rational, b: Rational) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const minus = (a: Rational, b: Rational) => rational(a.n * b.d - b.n * a.d, a.d * b.d);
const times = (a: Rational, b: Rational) => rational(a.n * b.n, a.d * b.d);
const absolute = (a: Rational) => ({ n: a.n < 0n ? -a.n : a.n, d: a.d });
const less = (a: Rational, b: Rational) => a.n * b.d < b.n * a.d;
const same = (a: Rational, b: Rational) => a.n * b.d === b.n * a.d;
const valueOf = (a: Rational) => Number(a.n) / Number(a.d);
const rationalText = (a: Rational) => (a.d === 1n ? String(a.n) : `${a.n}/${a.d}`);
const rationalTex = (a: Rational) =>
  a.d === 1n ? String(a.n) : `${a.n < 0n ? "-" : ""}\\frac{${a.n < 0n ? -a.n : a.n}}{${a.d}}`;

export function formatFunctionNumber(value: number): string {
  if (!Number.isFinite(value)) return "not finite";
  if (value === 0) return "0";
  return Number.isSafeInteger(value) ? String(value) : String(Number(value.toPrecision(10)));
}
export function formatFunctionVector(value: FunctionVec): string {
  return `(${formatFunctionNumber(value[0])}, ${formatFunctionNumber(value[1])})`;
}
const numberAnswer = (value: number, display?: string): FunctionAnswer => ({
  kind: "number",
  value: value === 0 ? 0 : value,
  display: display ?? `${formatFunctionNumber(value)}${Number.isInteger(value) ? "" : " (rounded)"}`,
});
const rationalAnswer = (value: Rational): FunctionAnswer => numberAnswer(valueOf(value), rationalText(value));
const trigonometricAnswer = (value: number): FunctionAnswer =>
  Number.isInteger(2 * value) ? rationalAnswer(rational(2 * value, 2)) : numberAnswer(value);
const undefinedAnswer = (
  display = "Undefined: the input is outside the original domain",
): FunctionAnswer => ({ kind: "undefined", display });
const pointText = (point: FunctionVec) => formatFunctionVector(point);
const baseValue = (base: FunctionScene["base"]) => (base === "half" ? 0.5 : base === "two" ? 2 : 3);
const baseTex = (base: FunctionScene["base"]) => (base === "half" ? "\\frac12" : base === "two" ? "2" : "3");

function blank(error: string): FunctionResult {
  return { setup: [], answer: null, steps: [], facts: [], observations: [], plot: null, error };
}
function validate(mode: FunctionMode, scene: FunctionScene): string | null {
  if (!(FUNCTION_MODES as readonly string[]).includes(mode))
    return "Choose one of the six function experiments.";
  if (!scene || typeof scene !== "object") return "Enter a valid scene.";
  for (const choice of functionChoices(mode, scene))
    if (!choice.options.some((option) => option.value === scene[choice.key]))
      return `Choose a valid ${choice.label.toLowerCase()}.`;
  for (const field of functionFields(mode, scene))
    if (!Number.isInteger(scene[field.key]) || scene[field.key] < field.min || scene[field.key] > field.max)
      return `${field.label} must be a whole number from ${field.min} to ${field.max}.`;
  return null;
}

type Interval = { low: number; high: number; openLow?: boolean; openHigh?: boolean };
/** Split analytically first. Each returned curve stays inside one domain component. */
function sampled(
  label: string,
  fn: (x: number) => number,
  intervals: readonly Interval[],
  role: FunctionCurve["role"] = "function",
): FunctionCurve[] {
  const curves: FunctionCurve[] = [];
  intervals.forEach((interval, index) => {
    const margin = Math.min(0.0001, (interval.high - interval.low) / 10000);
    const low = interval.low + (interval.openLow ? margin : 0),
      high = interval.high - (interval.openHigh ? margin : 0);
    if (high < low) return;
    let points: FunctionVec[] = [];
    const flush = () => {
      if (points.length)
        curves.push({
          label: `${label} · component ${index + 1}`,
          points,
          role,
          style: "line",
          ...(role === "reference" ? { dashed: true } : {}),
        });
      points = [];
    };
    for (let i = 0; i <= 240; i += 1) {
      const x = low + ((high - low) * i) / 240,
        y = fn(x);
      if (Number.isFinite(y)) points.push([x, y]);
      else flush();
    }
    flush();
  });
  return curves;
}
function splitAt(cuts: readonly number[]): Interval[] {
  const internal = [...new Set(cuts.filter((x) => x > BOUNDS.xMin && x < BOUNDS.xMax))].sort((a, b) => a - b);
  const endpoints = [BOUNDS.xMin, ...internal, BOUNDS.xMax];
  return endpoints.slice(0, -1).map((low, index) => ({
    low,
    high: endpoints[index + 1]!,
    openLow: index > 0,
    openHigh: index < endpoints.length - 2,
  }));
}
function reference(label: string, from: FunctionVec, to: FunctionVec): FunctionCurve {
  return { label, points: [from, to], role: "reference", style: "line", dashed: true };
}
function plot(
  curves: FunctionCurve[],
  markers: FunctionMarker[],
  caption: string,
  options: Partial<FunctionPlotData> = {},
): FunctionPlotData {
  const bounds = options.bounds ?? BOUNDS;
  const outside = ([x, y]: FunctionVec) =>
    x < bounds.xMin || x > bounds.xMax || y < bounds.yMin || y > bounds.yMax;
  const clipped =
    curves.some((curve) => curve.points.some(outside)) ||
    markers.some((marker) => outside(marker.at)) ||
    (options.bands ?? []).some((band) => band.low < bounds.yMin || band.high > bounds.yMax);
  return {
    bounds: { ...bounds },
    curves,
    markers,
    xLabel: "x",
    yLabel: "y",
    caption,
    equalScale: true,
    ...options,
    clipped,
  };
}
function result(
  setup: string[],
  answer: FunctionAnswer,
  steps: string[],
  facts: FunctionResult["facts"],
  observations: string[],
  data: FunctionPlotData,
  rows?: string[][],
): FunctionResult {
  return {
    setup,
    answer,
    steps,
    facts,
    observations,
    plot: data,
    error: null,
    ...(rows
      ? { table: { caption: "Probe values and domain status", headers: ["Input", "Output / status"], rows } }
      : {}),
  };
}

function composition(scene: FunctionScene): FunctionResult {
  const { a, h, x, composition: operation } = scene;
  if (operation === "inverse-right" || operation === "inverse-left") {
    const sign = operation === "inverse-right" ? 1 : -1;
    const fn = (input: number) => h + sign * Math.sqrt(input);
    const inverseCurves = sampled("Selected inverse", fn, [{ low: 0, high: 7 }]);
    const original = sampled(
      "Restricted original g",
      (input) => (input - h) ** 2,
      [sign === 1 ? { low: h, high: 7 } : { low: -7, high: h }],
      "reference",
    );
    const output =
      x < 0
        ? undefinedAnswer("Undefined: an inverse-square input must satisfy y ≥ 0")
        : numberAnswer(
            fn(x),
            Number.isInteger(Math.sqrt(x)) ? String(fn(x)) : `${formatFunctionNumber(fn(x))} (rounded)`,
          );
    return result(
      [
        `$g(t)=(t-(${h}))^2$ restricted to $t${sign === 1 ? "\\ge" : "\\le"}${h}$.`,
        `The selected inverse is $g^{-1}(y)=${h}${sign === 1 ? "+" : "-"}\\sqrt y$, for $y\\ge0$.`,
        `Probe inverse input: $y=${x}$.`,
      ],
      output,
      [
        "A square is nonnegative, so the inverse accepts exactly the nonnegative outputs of the original.",
        `The ${sign === 1 ? "right" : "left"} branch chooses the ${sign === 1 ? "positive" : "negative"} square-root displacement from $${h}$.`,
        x < 0
          ? `The probe $${x}$ is negative and has no real preimage on this branch.`
          : `Solving $(t-(${h}))^2=${x}$ on the selected branch gives $t=${formatFunctionNumber(fn(x))}$.`,
      ],
      [
        { label: "Inverse domain", value: "[0, ∞)" },
        { label: "Original restricted domain", value: sign === 1 ? `[${h}, ∞)` : `(−∞, ${h}]` },
        { label: "Included boundary", value: `Inverse point (0, ${h})` },
      ],
      [
        "The inverse is a reflected graph across y = x, not a reciprocal function.",
        "The branch restriction makes each nonnegative output have one chosen preimage.",
      ],
      plot(
        [...inverseCurves, ...original, reference("Reflection line y = x", [-7, -7], [7, 7])],
        [
          { label: "Included inverse endpoint", at: [0, h], open: false },
          { label: "Included original endpoint", at: [h, 0], open: false },
        ],
        "Selected inverse and restricted original are reflected across y = x. Closed markers include both branch endpoints; values outside the fixed view are clipped.",
      ),
      [[String(x), output.display]],
    );
  }
  const fg = operation === "fg";
  const cuts = fg ? (a < 0 ? [] : a === 0 ? [h] : [h - Math.sqrt(a), h + Math.sqrt(a)]) : [a];
  const defined = fg ? (x - h) ** 2 !== a : x !== a;
  const fn = fg
    ? (input: number) => 1 / ((input - h) ** 2 - a)
    : (input: number) => (1 / (input - a) - h) ** 2;
  const output = defined
    ? fg
      ? rationalAnswer(rational(1, (x - h) ** 2 - a))
      : rationalAnswer(times(minus(rational(1, x - a), rational(h)), minus(rational(1, x - a), rational(h))))
    : undefinedAnswer();
  const domain = cuts.length
    ? `All real inputs except ${cuts.map(formatFunctionNumber).join(", ")}`
    : "All real inputs";
  const curves = sampled(fg ? "f after g" : "g after f", fn, splitAt(cuts));
  for (const pole of cuts)
    curves.push(reference(`Excluded input ${formatFunctionNumber(pole)}`, [pole, -7], [pole, 7]));
  curves.push(reference("Horizontal asymptote", [-7, fg ? 0 : h * h], [7, fg ? 0 : h * h]));
  return result(
    [
      `$f(t)=1/(t-(${a})),\\quad g(t)=(t-(${h}))^2$.`,
      `Selected operation: $${fg ? "f\\circ g" : "g\\circ f"}$; probe input $x=${x}$.`,
    ],
    output,
    [
      fg
        ? `Substitute the entire inner output: $(f\\circ g)(x)=1/((x-(${h}))^2-(${a}))$.`
        : `The inner map excludes $x=${a}$; then $(g\\circ f)(x)=(1/(x-(${a}))-(${h}))^2$.`,
      fg
        ? a < 0
          ? "The squared inner output is nonnegative, so it cannot equal the negative excluded value."
          : a === 0
            ? `Only $x=${h}$ makes the denominator zero; the double pole tends to positive infinity on both sides.`
            : `Solve $(x-(${h}))^2=${a}$, giving two excluded roots $${h}\\pm\\sqrt{${a}}$.`
        : "The outer polynomial adds no further domain exclusions.",
      `At the probe: ${output.display}.`,
    ],
    [
      { label: "Selected order", value: fg ? "g first, then f" : "f first, then g" },
      { label: "Composite domain", value: domain },
      { label: "Horizontal asymptote", value: `y = ${fg ? 0 : h * h}` },
      { label: "Excluded inputs", value: cuts.length ? cuts.map(formatFunctionNumber).join(", ") : "None" },
    ],
    [
      "Domain restrictions follow the original inner and outer maps, even after simplifying.",
      "Each plotted curve is split at every analytic exclusion before sampling; it never bridges a pole.",
    ],
    plot(
      curves,
      defined ? [{ label: "Probe", at: [x, fn(x)], open: false }] : [],
      "Composite graph with analytically split domain components and dashed asymptotes. The fixed ±7 view may clip unbounded branches.",
    ),
    [[String(x), output.display]],
  );
}

function rationalMode(scene: FunctionScene): FunctionResult {
  const { a, b, c, h, m, x } = scene;
  if (scene.rational === "polynomial") {
    const fn = (input: number) => (input - h) ** m * (input + b);
    const coincident = h === -b;
    const roots = coincident
      ? [{ root: h, multiplicity: m + 1 }]
      : [
          { root: h, multiplicity: m },
          { root: -b, multiplicity: 1 },
        ];
    const degree = m + 1;
    return result(
      [`$P(x)=(x-(${h}))^{${m}}(x+(${b}))$; probe $x=${x}$.`],
      numberAnswer(fn(x), String(fn(x))),
      [
        coincident
          ? `The factors share root $${h}$, so their multiplicities add to $${m + 1}$.`
          : `The roots are $${h}$ with multiplicity $${m}$ and $${-b}$ with multiplicity one.`,
        "Odd multiplicity changes the sign across a root; even multiplicity preserves it.",
        `The degree is $${degree}$ with positive leading coefficient. At the probe, $P(${x})=${fn(x)}$.`,
      ],
      [
        { label: "Domain", value: "All real inputs" },
        {
          label: "Roots and multiplicities",
          value: roots.map((item) => `${item.root}: ${item.multiplicity}`).join("; "),
        },
        { label: "End behavior", value: degree % 2 === 0 ? "Both ends → +∞" : "Left → −∞; right → +∞" },
      ],
      [
        "Every root is included, shown with a closed marker.",
        "Multiplicity predicts sign crossing, not the same visual flatness at every root.",
      ],
      plot(
        sampled("Polynomial", fn, splitAt([])),
        roots.map((item) => ({
          label: `Root ${item.root}, multiplicity ${item.multiplicity}`,
          at: [item.root, 0] as FunctionVec,
          open: false,
        })),
        "Continuous polynomial with included roots. Large values are clipped at the fixed view boundary; clipped edges are not horizontal portions of the graph.",
      ),
      [[String(x), String(fn(x))]],
    );
  }
  if (scene.rational === "horizontal") {
    const fn = (input: number) => (a * input * input + b) / (c * input * input + 1);
    const output = rationalAnswer(rational(a * x * x + b, c * x * x + 1));
    return result(
      [`$R(x)=(${a}x^2+(${b}))/(${c}x^2+1)$; probe $x=${x}$.`],
      output,
      [
        `The denominator is at least one, so no real input is excluded.`,
        `Dividing by $x^2$ gives the end limit $${rationalTex(rational(a, c))}$; this also gives zero when the quadratic numerator coefficient is zero.`,
        `The probe value is $${rationalTex(rational(a * x * x + b, c * x * x + 1))}$.`,
      ],
      [
        { label: "Domain", value: "All real inputs" },
        { label: "Horizontal asymptote", value: `y = ${rationalText(rational(a, c))}` },
        { label: "Denominator zeros", value: "None on the real line" },
      ],
      [
        "The ratio of dominant terms describes end behavior, not an assertion that the graph cannot cross its asymptote.",
      ],
      plot(
        [
          ...sampled("Rational function", fn, splitAt([])),
          reference("Horizontal asymptote", [-7, a / c], [7, a / c]),
        ],
        [{ label: "Probe", at: [x, fn(x)], open: false }],
        "Rational function and its analytically derived horizontal asymptote.",
      ),
      [[String(x), output.display]],
    );
  }
  const fn = (input: number) => input + b + a / (input - h);
  const output =
    x === h
      ? undefinedAnswer("Undefined: the original denominator is zero")
      : rationalAnswer(plus(rational(x + b), rational(a, x - h)));
  const curves = sampled("Original rational function", fn, splitAt([h]));
  curves.push(reference("Slant reference y = x + b", [-7, -7 + b], [7, 7 + b]));
  if (a !== 0) curves.push(reference("Vertical asymptote", [h, -7], [h, 7]));
  const markers: FunctionMarker[] = a === 0 ? [{ label: "Excluded hole", at: [h, h + b], open: true }] : [];
  if (x !== h) markers.push({ label: "Probe", at: [x, fn(x)], open: false });
  return result(
    [
      `$R(x)=\\frac{(x-(${h}))(x+(${b}))+(${a})}{x-(${h})}$, with the original denominator retained.`,
      `Probe input $x=${x}$.`,
    ],
    output,
    [
      `For $x\\ne${h}$, division gives $R(x)=x+(${b})+(${a})/(x-(${h}))$.`,
      a === 0
        ? `The canceled denominator still excludes $x=${h}$, leaving a hole at $(${h},${h + b})$.`
        : `The nonzero remainder creates a pole at $x=${h}$. The term $${a}/(x-(${h}))$ controls the one-sided signs.`,
      `The remainder tends to zero at both ends, giving slant asymptote $y=x+(${b})$.`,
      `Probe result: ${output.display}.`,
    ],
    [
      { label: "Original domain", value: `All real x except ${h}` },
      { label: "Discontinuity", value: a === 0 ? `Hole at (${h}, ${h + b})` : `Vertical asymptote x = ${h}` },
      {
        label: "One-sided pole behavior",
        value: a === 0 ? "Not a pole" : a > 0 ? "Left → −∞; right → +∞" : "Left → +∞; right → −∞",
      },
      { label: "Slant asymptote", value: `y = x + ${b}` },
    ],
    [
      "Canceling a factor never restores an input excluded by the original formula.",
      "Open markers are missing points; dashed references are not extra function values.",
    ],
    plot(
      curves,
      markers,
      "The original domain is split at x = h before sampling. Holes are open; poles are not connected across the dashed vertical reference.",
    ),
    [[String(x), output.display]],
  );
}

function exponential(scene: FunctionScene): FunctionResult {
  const base = baseValue(scene.base),
    { x, h } = scene,
    logarithm = scene.exponential === "log";
  const exp = (input: number) => base ** (input - h),
    log = (input: number) => Math.log(input) / Math.log(base) + h;
  let output: FunctionAnswer;
  if (logarithm && x <= 0)
    output = undefinedAnswer("Undefined: a real logarithm requires a strictly positive input");
  else if (!logarithm) {
    const exponent = (scene.base === "half" ? -1 : 1) * (x - h),
      integerBase = scene.base === "three" ? 3 : 2;
    output = rationalAnswer(
      exponent >= 0 ? rational(integerBase ** exponent) : rational(1, integerBase ** -exponent),
    );
  } else {
    let exact: number | null = null;
    for (let exponent = -12; exponent <= 12; exponent += 1) if (base ** exponent === x) exact = exponent + h;
    output = numberAnswer(log(x), exact === null ? undefined : String(exact));
  }
  const curves = [
    ...sampled(
      logarithm ? "Inverse exponential reference" : "Exponential",
      exp,
      splitAt([]),
      logarithm ? "reference" : "function",
    ),
    ...sampled(
      logarithm ? "Logarithmic inverse" : "Inverse logarithm reference",
      log,
      [{ low: 0, high: 7, openLow: true }],
      logarithm ? "function" : "reference",
    ),
    reference("Reflection line y = x", [-7, -7], [7, 7]),
    reference("Logarithmic vertical asymptote", [0, -7], [0, 7]),
    reference("Exponential horizontal asymptote", [-7, 0], [7, 0]),
  ];
  return result(
    [
      `$f(t)=(${baseTex(scene.base)})^{t-(${h})},\\quad f^{-1}(t)=\\log_{${baseTex(scene.base)}}t+(${h})$.`,
      `Selected ${logarithm ? "logarithmic inverse" : "exponential"}; probe input $${x}$.`,
    ],
    output,
    [
      "An exponential output is positive. Its logarithmic inverse therefore accepts strictly positive inputs.",
      `The identities $\\log_b(b^u)=u$ and $b^{\\log_b v}=v$ (for $v>0$) justify the inverse relation.`,
      base < 1
        ? "A base between zero and one makes both functions decreasing; it does not invalidate their inverses."
        : "A base greater than one makes both functions increasing.",
      `Probe result: ${output.display}.`,
    ],
    [
      { label: "Selected domain", value: logarithm ? "(0, ∞)" : "All real inputs" },
      { label: "Selected range", value: logarithm ? "All real outputs" : "(0, ∞)" },
      { label: "Base", value: scene.base === "half" ? "1/2" : String(base) },
      { label: "Direction", value: base < 1 ? "Decreasing" : "Increasing" },
    ],
    [
      "The logarithm is not defined at zero; its vertical asymptote is not an included point.",
      "The dashed inverse reference illustrates reflection across y = x. Plot samples illustrate algebraic inverse identities.",
    ],
    plot(
      curves,
      output.kind === "number" ? [{ label: "Probe", at: [x, output.value], open: false }] : [],
      "Exponential and logarithmic inverse, with strict logarithm domain x > 0. Unbounded parts extend outside the fixed view.",
    ),
    [[String(x), output.display]],
  );
}

const SIN = [
  0,
  0.5,
  Math.sqrt(3) / 2,
  1,
  Math.sqrt(3) / 2,
  0.5,
  0,
  -0.5,
  -Math.sqrt(3) / 2,
  -1,
  -Math.sqrt(3) / 2,
  -0.5,
] as const;
export const sineSixth = (step: number): number => SIN[((step % 12) + 12) % 12]!;
export const cosineSixth = (step: number): number => sineSixth(step + 3);
function trigonometry(scene: FunctionScene): FunctionResult {
  const { a, b, d, phase, angle } = scene,
    input = (angle * Math.PI) / 6,
    identity = scene.trigonometry === "identity";
  if (identity) {
    const excluded = angle % 6 === 0;
    const output = excluded
      ? undefinedAnswer("Undefined: the original denominator sin(x) is zero")
      : trigonometricAnswer(sineSixth(angle));
    const holes = Array.from({ length: 5 }, (_, i) => (i - 2) * Math.PI);
    return result(
      ["$H(x)=(1-\\cos^2x)/\\sin x$ retains its original domain.", `Probe angle $x=${angle}\\pi/6$ radians.`],
      output,
      [
        "The Pythagorean identity gives $1-\\cos^2x=\\sin^2x$.",
        "Cancellation gives $H(x)=\\sin x$ only where the original denominator is nonzero.",
        "Thus every integer multiple of pi remains excluded, even though the simplified sine graph has value zero there.",
        `Probe result: ${output.display}.`,
      ],
      [
        { label: "Original domain", value: "All real x except kπ for integer k" },
        { label: "Angle unit", value: "Radians" },
        { label: "Simplified rule on its domain", value: "sin(x)" },
      ],
      [
        "The special-angle lookup treats sin(kπ) as exactly zero; a floating-point residue never turns an excluded input into a defined value.",
      ],
      plot(
        sampled("Identity on original domain", Math.sin, splitAt(holes)),
        holes.map((hole) => ({ label: "Excluded multiple of π", at: [hole, 0], open: true })),
        "Sine restricted by the original denominator, split at all excluded multiples of π. Every missing point is marked open.",
      ),
      [[`${angle}π/6`, output.display]],
    );
  }
  const fn = (x: number) => a * Math.sin(b * x + (phase * Math.PI) / 6) + d;
  const exactOutput = a * sineSixth(b * angle + phase) + d;
  const output = trigonometricAnswer(exactOutput);
  return result(
    [`$F(x)=${a}\\sin(${b}x+(${phase})\\pi/6)+(${d})$.`, `Probe angle $x=${angle}\\pi/6$ radians.`],
    output,
    [
      `The amplitude is $${a}$, the midline is $y=${d}$, and the period is $2\\pi/${b}$.`,
      `The probe's inner angle is $(${b}\\cdot(${angle})+(${phase}))\\pi/6$. Use the unit-circle special angle before multiplying and shifting.`,
      `The resulting value is $${Number.isInteger(2 * exactOutput) ? rationalTex(rational(2 * exactOutput, 2)) : `${formatFunctionNumber(exactOutput)}\\text{ (rounded)}`}$.`,
    ],
    [
      { label: "Amplitude", value: String(a) },
      { label: "Period", value: `${rationalText(rational(2, b))}π` },
      { label: "Midline", value: `y = ${d}` },
      { label: "Angle unit", value: "Radians" },
    ],
    [
      "Positive amplitude and nonzero positive frequency are required in this bounded family, avoiding a false fundamental-period claim for a constant wave.",
      "The plotted curve is numerical; the probe uses exact zero and half-value special angles.",
    ],
    plot(
      [...sampled("Shifted sine wave", fn, splitAt([])), reference("Midline", [-7, d], [7, d])],
      [{ label: "Probe", at: [input, exactOutput], open: false }],
      "A bounded sine family with radians on the horizontal axis and a dashed midline.",
    ),
    [[`${angle}π/6`, output.display]],
  );
}

function curves(scene: FunctionScene): FunctionResult {
  const { a, b, angle, radius } = scene;
  const polar = scene.curves === "polar",
    orientation = scene.direction === "ccw" ? 1 : -1;
  const output: FunctionVec = polar
    ? [radius * cosineSixth(angle), radius * sineSixth(angle)]
    : [a * cosineSixth(angle), orientation * b * sineSixth(angle)];
  const answer: FunctionAnswer = { kind: "vector", value: output, display: formatFunctionVector(output) };
  if (polar) {
    const radial: FunctionCurve = {
      label: "Signed radius displacement",
      points: [[0, 0], output],
      role: "function",
      style: "line",
      ...(radius !== 0 ? { direction: "displacement" as const } : {}),
    };
    return result(
      [
        `Signed polar input $r=${radius},\\quad\\theta=${angle}\\pi/6$.`,
        "Cartesian conversion uses $x=r\\cos\\theta$, $y=r\\sin\\theta$.",
      ],
      answer,
      [
        `The coordinate pair is $(${radius}\\cos(${angle}\\pi/6),${radius}\\sin(${angle}\\pi/6))$.`,
        `Numerically this is $(${formatFunctionNumber(output[0])},${formatFunctionNumber(output[1])})$; irrational coordinates are rounded for display.`,
        radius === 0
          ? "The point is the origin for every angle. No unique polar angle can be recovered from that point."
          : `Changing to radius $${-radius}$ and angle $(${angle}+6)\\pi/6$ gives the same Cartesian point.`,
      ],
      [
        { label: "Cartesian point", value: pointText(output) },
        { label: "Equivalent signed representation", value: `r = ${-radius}, angle = ${angle + 6}π/6` },
        {
          label: "Angle at origin",
          value:
            radius === 0
              ? "Not unique; every angle represents the origin"
              : "The displayed angle is one representation, not unique modulo full turns",
        },
      ],
      [
        "A negative radius points opposite the specified angle.",
        "A zero radius has no displacement direction; the origin is a point, not a directed arrow.",
      ],
      plot(
        radius === 0 ? [] : [radial],
        [
          {
            label: radius === 0 ? "Origin; angle not unique" : "Selected polar point",
            at: output,
            open: false,
          },
        ],
        "Equal-scale Cartesian plane for the signed polar input. The radius segment is not a claim about a moving curve.",
      ),
      [[`r=${radius}, θ=${angle}π/6`, answer.display]],
    );
  }
  const points: FunctionVec[] = Array.from({ length: 241 }, (_, i) => {
    const t = (2 * Math.PI * i) / 240;
    return [a * Math.cos(t), orientation * b * Math.sin(t)];
  });
  return result(
    [
      `$x(t)=${a}\\cos t,\\quad y(t)=${orientation === 1 ? "" : "-"}${b}\\sin t$, defined for real $t$.`,
      `Probe $t=${angle}\\pi/6$; the graph shows one full period $0\\le t\\le2\\pi$.`,
    ],
    answer,
    [
      `The Cartesian relation is $x^2/${a * a}+y^2/${b * b}=1$.`,
      `At $t=0$ the point is $(${a},0)$; increasing t moves ${orientation === 1 ? "upward, counterclockwise" : "downward, clockwise"}.`,
      `The selected point is $(${formatFunctionNumber(output[0])},${formatFunctionNumber(output[1])})$. Negative probe parameters use the periodic extension, rather than being silently replaced in the controls.`,
    ],
    [
      { label: "Horizontal / vertical semiaxes", value: `${a}, ${b}` },
      {
        label: "Increasing-parameter direction",
        value: orientation === 1 ? "Counterclockwise" : "Clockwise",
      },
      { label: "Shown parameter interval", value: "[0, 2π], one full traversal" },
      { label: "Probe parameter", value: `${angle}π/6 radians` },
    ],
    [
      "Equal axis scales preserve the ellipse's geometric proportions.",
      "Direction arrows indicate order of traversal, not velocity or speed. The closed start and end are the same point.",
    ],
    plot(
      [{ label: "Parametric ellipse", points, role: "function", style: "line", direction: "parameter" }],
      [
        { label: "Included start/end", at: [a, 0], open: false },
        { label: "Probe", at: output, open: false },
      ],
      "One complete parametric period with traversal direction. The family is periodic for all real parameters.",
    ),
    [[`${angle}π/6`, answer.display]],
  );
}

function ratioValue(scene: FunctionScene): Rational {
  return scene.ratio === "half"
    ? rational(1, 2)
    : scene.ratio === "negative-half"
      ? rational(-1, 2)
      : scene.ratio === "zero"
        ? ZERO
        : rational(-1);
}
function sequenceMode(scene: FunctionScene): FunctionResult {
  const recurrence = scene.sequence === "recurrence",
    epsilon = rational(scene.p, scene.q);
  let referenceValue: Rational,
    term: (index: number) => Rational,
    N: number | null,
    converges = true;
  const steps: string[] = [],
    facts: FunctionResult["facts"] = [],
    observations: string[] = [];
  if (!recurrence) {
    referenceValue = rational(scene.a, scene.c);
    term = (index) => rational(scene.a * index + scene.b, scene.c * index + scene.d);
    const delta = Math.abs(scene.b * scene.c - scene.a * scene.d);
    // All quantities are bounded integers; floor implements the strict boundary.
    N = Math.max(
      1,
      Math.floor((scene.q * delta - scene.p * scene.c * scene.d) / (scene.p * scene.c * scene.c)) + 1,
    );
    steps.push(
      `Dividing numerator and denominator by n gives limit $L=${rationalTex(referenceValue)}$.`,
      `Exactly, $|a_n-L|=\\frac{|(${scene.b})\\cdot${scene.c}-(${scene.a})\\cdot${scene.d}|}{${scene.c}(${scene.c}n+${scene.d})}$.`,
      `The strict condition is $${scene.q}\\cdot${delta}<${scene.p}\\cdot${scene.c}(${scene.c}n+${scene.d})$. The smallest positive integer satisfying it is $N=${N}$.`,
      "The denominator increases with n, so this exact inequality controls every later term, not just the displayed sample.",
    );
    facts.push({ label: "Convergence", value: `Converges to ${rationalText(referenceValue)}` });
  } else {
    const rho = ratioValue(scene);
    referenceValue = rational(BigInt(scene.b) * rho.d, rho.d - rho.n);
    const error = minus(rational(scene.a), referenceValue);
    term = (index) =>
      plus(referenceValue, times(error, rational(rho.n ** BigInt(index - 1), rho.d ** BigInt(index - 1))));
    const initialError = absolute(error);
    converges = scene.ratio !== "negative-one" || error.n === 0n;
    if (scene.ratio === "negative-one") N = less(initialError, epsilon) ? 1 : null;
    else if (scene.ratio === "zero") N = less(initialError, epsilon) ? 1 : 2;
    else {
      N = 1;
      let remaining = initialError;
      while (!less(remaining, epsilon)) {
        remaining = times(remaining, rational(1, 2));
        N += 1;
      }
    }
    steps.push(
      `The fixed point is $L=${scene.b}/(1-(${rationalTex(rho)}))=${rationalTex(referenceValue)}$.`,
      `Subtracting the fixed point gives $a_{n+1}-L=(${rationalTex(rho)})(a_n-L)$.`,
      `Therefore $a_n-L=(${rationalTex(error)})(${rationalTex(rho)})^{n-1}$, with the initial term handled directly when the ratio is zero.`,
      scene.ratio === "negative-one"
        ? error.n === 0n
          ? "The initial error is zero, so this is a constant, convergent sequence."
          : "The nonzero error alternates without shrinking. There are two distinct subsequential values, so the sequence does not converge."
        : scene.ratio === "zero"
          ? "After the initial term, every term equals the fixed point."
          : "The error magnitude halves at every step; an exact rational comparison determines the first strict threshold.",
      N === null
        ? "The constant error magnitude is not strictly less than the selected tolerance, so no eventual index exists."
        : `For this tolerance, the smallest eventual index is $N=${N}$.`,
    );
    facts.push(
      { label: "Ratio ρ", value: rationalText(rho) },
      {
        label: "Convergence",
        value: converges
          ? `Converges to ${rationalText(referenceValue)}`
          : "Does not converge: a nonconstant two-cycle",
      },
    );
    if (!converges)
      observations.push(
        "The reference is a fixed point, not the sequence's limit. A loose tolerance can include both alternating values and give N = 1 without establishing convergence.",
      );
  }
  const values = Array.from({ length: scene.n }, (_, index) => term(index + 1));
  const rows = values.map((value, index) => {
    const error = absolute(minus(value, referenceValue));
    return [
      String(index + 1),
      rationalText(value),
      rationalText(error),
      less(error, epsilon) ? "Yes" : same(error, epsilon) ? "No (on the excluded boundary)" : "No",
    ];
  });
  const points: FunctionVec[] = values.map((value, index) => [index + 1, valueOf(value)]);
  const bounds = { xMin: 0.5, xMax: Math.max(2, scene.n + 0.5), yMin: -7, yMax: 7 };
  const low = valueOf(minus(referenceValue, epsilon)),
    high = valueOf(plus(referenceValue, epsilon));
  const curves: FunctionCurve[] = [
    { label: "Sequence terms at integer indices", points, role: "function", style: "points" },
    reference("Reference L", [bounds.xMin, valueOf(referenceValue)], [bounds.xMax, valueOf(referenceValue)]),
  ];
  if (N !== null && N <= scene.n) curves.push(reference("First eventual index N", [N, -7], [N, 7]));
  facts.push(
    {
      label: recurrence ? "Reference fixed point L" : "Reference limit L",
      value: rationalText(referenceValue),
    },
    { label: "Strict tolerance ε", value: rationalText(epsilon) },
    { label: "Smallest eventual index", value: N === null ? "No such index" : String(N) },
    { label: "Displayed terms", value: `First ${scene.n} terms` },
  );
  if (N !== null && N > scene.n)
    observations.push(
      `The proven index N = ${N} lies beyond the ${scene.n} displayed terms; the finite view does not show the entire eventual tail.`,
    );
  if (N !== null && N > 1) {
    const previous = absolute(minus(term(N - 1), referenceValue));
    observations.push(
      `At N − 1 = ${N - 1}, the exact error is ${rationalText(previous)}, which does not satisfy the strict tolerance. Equality is excluded.`,
    );
  }
  observations.push(
    "The plotted points are values at integer indices, not a continuous curve.",
    "Finite plotted terms illustrate the family. Algebraic error formulas justify claims about all later terms; the plot alone is not a convergence proof.",
  );
  const answer: FunctionAnswer =
    N === null
      ? { kind: "no-index", display: "No such index" }
      : { kind: "integer", value: N, display: String(N) };
  return {
    setup: recurrence
      ? [
          `$a_1=${scene.a},\\quad a_{n+1}=(${rationalTex(ratioValue(scene))})a_n+(${scene.b})$.`,
          `Reference fixed point $L=${rationalTex(referenceValue)}$; strict tolerance $\\epsilon=${scene.p}/${scene.q}$.`,
        ]
      : [
          `$a_n=(${scene.a}n+(${scene.b}))/(${scene.c}n+${scene.d})$, $n\\ge1$.`,
          `Reference $L=${rationalTex(referenceValue)}$; strict tolerance $\\epsilon=${scene.p}/${scene.q}$.`,
        ],
    answer,
    steps,
    facts,
    observations,
    error: null,
    plot: plot(
      curves,
      [],
      "Discrete sequence terms, a reference line, and a strict accuracy band whose boundaries are excluded. Only the stated first terms are shown.",
      {
        bounds,
        equalScale: false,
        xLabel: "Index n",
        yLabel: "aₙ",
        bands: [{ low, high, label: "Strict band: boundaries excluded" }],
      },
    ),
    table: {
      caption: "Exact terms and strict-band membership",
      headers: ["n", "aₙ (exact)", "|aₙ − L| (exact)", "Strictly inside band?"],
      rows,
    },
  };
}

export function evaluateFunction(mode: FunctionMode, scene: FunctionScene): FunctionResult {
  const error = validate(mode, scene);
  if (error) return blank(error);
  switch (mode) {
    case "composition":
      return composition(scene);
    case "rational":
      return rationalMode(scene);
    case "exponential":
      return exponential(scene);
    case "trigonometry":
      return trigonometry(scene);
    case "curves":
      return curves(scene);
    case "sequences":
      return sequenceMode(scene);
  }
}

const BASE: FunctionScene = {
  a: 1,
  b: 1,
  c: 1,
  d: 0,
  h: 0,
  x: 1,
  m: 2,
  n: 12,
  p: 1,
  q: 10,
  angle: 2,
  phase: 0,
  radius: 2,
  composition: "fg",
  rational: "shifted",
  exponential: "exp",
  base: "two",
  trigonometry: "wave",
  curves: "ellipse",
  direction: "ccw",
  sequence: "rational",
  ratio: "half",
};
const preset = (
  id: string,
  label: string,
  description: string,
  mode: FunctionMode,
  values: Partial<FunctionScene>,
): FunctionPreset => ({ id, label, description, mode, scene: { ...BASE, ...values } });
export const FUNCTION_PRESETS: readonly FunctionPreset[] = [
  preset(
    "f-after-square",
    "Square first, reciprocal second",
    "Follow the inner output and retain its exclusions.",
    "composition",
    { a: 1, h: 1, x: 3 },
  ),
  preset(
    "square-after-f",
    "Reciprocal first, square second",
    "Reverse the order and compare domains.",
    "composition",
    { composition: "gf", a: 1, h: 1, x: 3 },
  ),
  preset(
    "double-pole",
    "One excluded input, two positive branches",
    "A zero excluded inner value creates a double pole.",
    "composition",
    { a: 0, h: 1, x: 1 },
  ),
  preset(
    "inverse-right",
    "Choose the right square branch",
    "A nonnegative inverse input has one restricted preimage.",
    "composition",
    { composition: "inverse-right", h: 1, x: 4 },
  ),
  preset(
    "inverse-left",
    "Choose the left square branch",
    "The other branch gives a different legitimate inverse.",
    "composition",
    { composition: "inverse-left", h: 1, x: 4 },
  ),
  preset(
    "retained-hole",
    "Cancellation retains a hole",
    "The original denominator still matters.",
    "rational",
    { a: 0, h: 1, b: 2, x: 1 },
  ),
  preset(
    "genuine-pole",
    "A nonzero remainder creates a pole",
    "Compare the two one-sided branches.",
    "rational",
    { a: 2, h: -1, b: 1, x: 0 },
  ),
  preset(
    "coincident-roots",
    "Coincident roots add multiplicities",
    "A repeated factor combines with the other root.",
    "rational",
    { rational: "polynomial", h: 1, b: -1, m: 2, x: 1 },
  ),
  preset(
    "even-root",
    "An even root need not cross",
    "Compare distinct roots and their multiplicities.",
    "rational",
    { rational: "polynomial", h: -1, b: -2, m: 2, x: 0 },
  ),
  preset(
    "horizontal-ratio",
    "A horizontal end limit",
    "The denominator never vanishes on the real line.",
    "rational",
    { rational: "horizontal", a: 2, b: 1, c: 3, x: 2 },
  ),
  preset(
    "shifted-growth",
    "Shifted exponential growth",
    "Input shifts preserve positive outputs.",
    "exponential",
    { base: "two", h: 1, x: 3 },
  ),
  preset(
    "decreasing-log",
    "A logarithm with base one half",
    "A decreasing function can still have an inverse.",
    "exponential",
    { exponential: "log", base: "half", h: 1, x: 4 },
  ),
  preset(
    "excluded-log",
    "Zero is not a logarithm input",
    "An asymptote is not an included point.",
    "exponential",
    { exponential: "log", x: 0 },
  ),
  preset(
    "exponential-decay",
    "Exponential decay stays positive",
    "A base below one reverses monotonicity.",
    "exponential",
    { base: "half", x: 4 },
  ),
  preset(
    "shifted-wave",
    "A shifted, compressed sine wave",
    "Track frequency and phase separately.",
    "trigonometry",
    { a: 2, b: 3, d: -1, phase: 1, angle: 2 },
  ),
  preset(
    "missing-trig-point",
    "A simplified identity with a missing point",
    "The denominator excludes integer multiples of pi.",
    "trigonometry",
    { trigonometry: "identity", angle: 6 },
  ),
  preset(
    "defined-trig-point",
    "The identity at an allowed angle",
    "Use the original domain before canceling.",
    "trigonometry",
    { trigonometry: "identity", angle: 1 },
  ),
  preset(
    "sine-quarter-turn",
    "A unit-circle special angle",
    "All angle controls are in radians.",
    "trigonometry",
    { a: 1, b: 1, phase: 0, d: 0, angle: 3 },
  ),
  preset(
    "counterclockwise-ellipse",
    "One counterclockwise traversal",
    "Equal scales preserve the ellipse's shape.",
    "curves",
    { a: 3, b: 2, angle: 3 },
  ),
  preset(
    "clockwise-ellipse",
    "Reverse the traversal",
    "Changing a sign changes direction, not the Cartesian set.",
    "curves",
    { a: 3, b: 2, angle: 3, direction: "cw" },
  ),
  preset(
    "negative-radius",
    "A signed polar radius",
    "A negative radius points opposite the angle.",
    "curves",
    { curves: "polar", radius: -3, angle: 2 },
  ),
  preset(
    "origin-angle",
    "The origin has many polar angles",
    "A point at zero radius has no unique angular direction.",
    "curves",
    { curves: "polar", radius: 0, angle: 5 },
  ),
  preset(
    "strict-harmonic",
    "Strict accuracy at an integer boundary",
    "Check equality at the previous index.",
    "sequences",
    { a: 0, b: 1, c: 1, d: 0, n: 15, p: 1, q: 10 },
  ),
  preset(
    "alternating-decay",
    "Alternating errors that shrink",
    "The sign alternates while the error magnitude halves.",
    "sequences",
    { sequence: "recurrence", ratio: "negative-half", a: 3, b: 1, p: 1, q: 10 },
  ),
  preset(
    "nonconvergent-cycle",
    "A bounded nonconstant cycle",
    "A fixed point need not be the sequence's limit.",
    "sequences",
    { sequence: "recurrence", ratio: "negative-one", a: 1, b: 0, p: 1, q: 10 },
  ),
  preset(
    "loose-cycle-band",
    "A loose band does not prove convergence",
    "Both cycle values can satisfy one selected tolerance.",
    "sequences",
    { sequence: "recurrence", ratio: "negative-one", a: 1, b: 0, p: 2, q: 1 },
  ),
  preset(
    "constant-cycle-case",
    "The fixed-point initial value",
    "The ratio alone does not decide every initial-value case.",
    "sequences",
    { sequence: "recurrence", ratio: "negative-one", a: 1, b: 2 },
  ),
  preset(
    "zero-ratio",
    "The recurrence settles after one update",
    "Keep the initial index separate from the zero-ratio tail.",
    "sequences",
    { sequence: "recurrence", ratio: "zero", a: 3, b: -1 },
  ),
];
export function defaultFunctionScene(mode: FunctionMode): FunctionScene {
  return { ...(FUNCTION_PRESETS.find((item) => item.mode === mode)?.scene ?? BASE) };
}
