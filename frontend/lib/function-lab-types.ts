/** Bounded public families, independent of private assessments and answer keys. */
export const FUNCTION_MODES = [
  "composition",
  "rational",
  "exponential",
  "trigonometry",
  "curves",
  "sequences",
] as const;
export type FunctionMode = (typeof FUNCTION_MODES)[number];
export type FunctionScene = {
  a: number;
  b: number;
  c: number;
  d: number;
  h: number;
  x: number;
  m: number;
  n: number;
  p: number;
  q: number;
  angle: number;
  phase: number;
  radius: number;
  composition: "fg" | "gf" | "inverse-right" | "inverse-left";
  rational: "shifted" | "polynomial" | "horizontal";
  exponential: "exp" | "log";
  base: "half" | "two" | "three";
  trigonometry: "wave" | "identity";
  curves: "ellipse" | "polar";
  direction: "ccw" | "cw";
  sequence: "rational" | "recurrence";
  ratio: "half" | "negative-half" | "zero" | "negative-one";
};
export type FunctionNumericKey =
  "a" | "b" | "c" | "d" | "h" | "x" | "m" | "n" | "p" | "q" | "angle" | "phase" | "radius";
export type FunctionField = { key: FunctionNumericKey; label: string; min: number; max: number };
const field = (key: FunctionNumericKey, label: string, min: number, max: number): FunctionField => ({
  key,
  label,
  min,
  max,
});
export function functionFields(mode: FunctionMode, scene: FunctionScene): readonly FunctionField[] {
  const x = field("x", "Probe input", -4, 4),
    h = field("h", "Horizontal shift h", -3, 3);
  if (mode === "composition")
    return scene.composition === "inverse-right" || scene.composition === "inverse-left"
      ? [h, x]
      : [field("a", "Excluded value a", -3, 3), h, x];
  if (mode === "rational") {
    if (scene.rational === "polynomial")
      return [h, field("b", "Root parameter b", -3, 3), field("m", "Multiplicity m", 1, 3), x];
    if (scene.rational === "horizontal")
      return [
        field("a", "Numerator coefficient a", -3, 3),
        field("b", "Numerator constant b", -3, 3),
        field("c", "Denominator coefficient c", 1, 3),
        x,
      ];
    return [h, field("b", "Linear offset b", -3, 3), field("a", "Remainder a", -3, 3), x];
  }
  if (mode === "exponential") return [h, x];
  if (mode === "trigonometry")
    return scene.trigonometry === "identity"
      ? [field("angle", "Probe angle in multiples of π/6", -12, 12)]
      : [
          field("a", "Amplitude A", 1, 3),
          field("b", "Frequency B", 1, 3),
          field("phase", "Phase C in multiples of π/6", -6, 6),
          field("d", "Vertical shift D", -3, 3),
          field("angle", "Probe angle in multiples of π/6", -12, 12),
        ];
  if (mode === "curves")
    return scene.curves === "polar"
      ? [field("radius", "Signed radius r", -4, 4), field("angle", "Angle in multiples of π/6", -12, 12)]
      : [
          field("a", "Horizontal radius a", 1, 4),
          field("b", "Vertical radius b", 1, 4),
          field("angle", "Parameter t in multiples of π/6", -12, 12),
        ];
  const accuracy = [
    field("p", "Error numerator p", 1, 4),
    field("q", "Error denominator q", 1, 20),
    field("n", "Terms to display", 1, 40),
  ];
  return scene.sequence === "recurrence"
    ? [field("a", "Initial term a₁", -3, 3), field("b", "Recurrence offset c", -3, 3), ...accuracy]
    : [
        field("a", "Numerator slope a", -3, 3),
        field("b", "Numerator constant b", -3, 3),
        field("c", "Denominator slope c", 1, 3),
        field("d", "Denominator constant d", 0, 3),
        ...accuracy,
      ];
}
export type FunctionChoiceKey =
  | "composition"
  | "rational"
  | "exponential"
  | "base"
  | "trigonometry"
  | "curves"
  | "direction"
  | "sequence"
  | "ratio";
export type FunctionChoice = {
  key: FunctionChoiceKey;
  label: string;
  options: readonly { value: string; label: string }[];
};
export function functionChoices(mode: FunctionMode, scene: FunctionScene): readonly FunctionChoice[] {
  if (mode === "composition")
    return [
      {
        key: "composition",
        label: "Operation",
        options: [
          { value: "fg", label: "f after g" },
          { value: "gf", label: "g after f" },
          { value: "inverse-right", label: "Inverse of g on the right branch" },
          { value: "inverse-left", label: "Inverse of g on the left branch" },
        ],
      },
    ];
  if (mode === "rational")
    return [
      {
        key: "rational",
        label: "Function family",
        options: [
          { value: "shifted", label: "Rational hole or pole" },
          { value: "polynomial", label: "Polynomial roots and multiplicity" },
          { value: "horizontal", label: "Rational horizontal behavior" },
        ],
      },
    ];
  if (mode === "exponential")
    return [
      {
        key: "exponential",
        label: "Operation",
        options: [
          { value: "exp", label: "Exponential function" },
          { value: "log", label: "Logarithmic inverse" },
        ],
      },
      {
        key: "base",
        label: "Base b",
        options: [
          { value: "half", label: "1/2" },
          { value: "two", label: "2" },
          { value: "three", label: "3" },
        ],
      },
    ];
  if (mode === "trigonometry")
    return [
      {
        key: "trigonometry",
        label: "Function family",
        options: [
          { value: "wave", label: "Shifted sine wave" },
          { value: "identity", label: "Identity with excluded inputs" },
        ],
      },
    ];
  if (mode === "curves")
    return [
      {
        key: "curves",
        label: "Coordinate model",
        options: [
          { value: "ellipse", label: "Parametric ellipse" },
          { value: "polar", label: "Signed polar coordinates" },
        ],
      },
      ...(scene.curves === "ellipse"
        ? [
            {
              key: "direction" as const,
              label: "Increasing parameter direction",
              options: [
                { value: "ccw", label: "Counterclockwise" },
                { value: "cw", label: "Clockwise" },
              ],
            },
          ]
        : []),
    ];
  return [
    {
      key: "sequence",
      label: "Sequence family",
      options: [
        { value: "rational", label: "Rational sequence" },
        { value: "recurrence", label: "Affine recurrence" },
      ],
    },
    ...(scene.sequence === "recurrence"
      ? [
          {
            key: "ratio" as const,
            label: "Recurrence ratio ρ",
            options: [
              { value: "half", label: "1/2" },
              { value: "negative-half", label: "−1/2" },
              { value: "zero", label: "0" },
              { value: "negative-one", label: "−1" },
            ],
          },
        ]
      : []),
  ];
}
export const FUNCTION_LESSONS: Record<
  FunctionMode,
  { title: string; topic: string; prediction: string; reflection: string }
> = {
  composition: {
    title: "Composition and inverses",
    topic: "function-composition-and-inverses",
    prediction:
      "Predict the selected operation at the probe input, or choose Undefined if the input is outside its domain.",
    reflection:
      "How does changing the order change the domain? Why does an inverse of a square need a restricted branch?",
  },
  rational: {
    title: "Polynomial and rational behavior",
    topic: "polynomial-and-rational-behavior",
    prediction:
      "Predict the function value at the probe input, or choose Undefined. A cancelled factor does not restore an excluded input.",
    reflection:
      "Use the original formula to distinguish a hole, a pole and an included root. How does multiplicity affect crossing a root?",
  },
  exponential: {
    title: "Exponentials and logarithms",
    topic: "exponential-and-logarithmic-functions",
    prediction:
      "Predict the selected exponential or logarithmic value, or choose Undefined for an excluded logarithm input.",
    reflection:
      "Why does the logarithm require a positive input? Explain how the two functions reverse each other, including a base below one.",
  },
  trigonometry: {
    title: "Trigonometric behavior",
    topic: "trigonometric-functions-and-identities",
    prediction:
      "Predict the value at the stated multiple of π/6, or choose Undefined. All angle controls use radians.",
    reflection:
      "Which transformations change amplitude, period or midline? Why must the original domain survive an identity simplification?",
  },
  curves: {
    title: "Parametric and polar curves",
    topic: "parametric-and-polar-curves",
    prediction: "Predict the two Cartesian coordinates at the selected parameter or polar input.",
    reflection:
      "How does the parameter determine direction around an ellipse? Explain a negative radius and why the origin has no unique polar angle.",
  },
  sequences: {
    title: "Sequences and eventual accuracy",
    topic: "sequences-and-informal-limiting-behavior",
    prediction:
      "Predict the smallest integer N ≥ 1 such that every term with n ≥ N is strictly within p/q of the stated reference, or choose No such index.",
    reflection:
      "Which algebraic fact controls every later term? Explain why a finite plot or one loose tolerance does not prove convergence.",
  },
};
export type FunctionVec = readonly [number, number];
export type FunctionBounds = { xMin: number; xMax: number; yMin: number; yMax: number };
/** Each curve is one connected domain component; references can cross exclusions. */
export type FunctionCurve = {
  label: string;
  points: readonly FunctionVec[];
  role: "function" | "reference";
  style: "line" | "points";
  dashed?: boolean;
  direction?: "parameter" | "displacement";
};
export type FunctionMarker = { label: string; at: FunctionVec; open: boolean };
export type FunctionPlotData = {
  bounds: FunctionBounds;
  curves: FunctionCurve[];
  markers: FunctionMarker[];
  bands?: Array<{ low: number; high: number; label: string }>;
  xLabel: string;
  yLabel: string;
  caption: string;
  equalScale: boolean;
  clipped: boolean;
};
export type FunctionAnswer =
  | { kind: "number"; value: number; display: string }
  | { kind: "integer"; value: number; display: string }
  | { kind: "vector"; value: FunctionVec; display: string }
  | { kind: "undefined" | "no-index"; display: string };
export type FunctionResult = {
  setup: string[];
  answer: FunctionAnswer | null;
  steps: string[];
  facts: Array<{ label: string; value: string }>;
  observations: string[];
  plot: FunctionPlotData | null;
  table?: { caption: string; headers: string[]; rows: string[][] };
  error: string | null;
};
export type FunctionPreset = {
  id: string;
  label: string;
  description: string;
  mode: FunctionMode;
  scene: FunctionScene;
};
export const FUNCTION_NUMERIC_TOLERANCE = 1e-8;
