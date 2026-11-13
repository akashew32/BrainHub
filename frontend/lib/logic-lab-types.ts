/** Original public exploration models; no assessment keys or saved learning state. */
export const LOGIC_MODES = [
  "truth",
  "quantifiers",
  "proof",
  "induction",
  "sets",
  "diagonal",
  "order",
  "invariants",
  "counterexamples",
] as const;
export type LogicMode = (typeof LOGIC_MODES)[number];
export const LOGIC_NUMERIC_KEYS = [
  "xSize",
  "ySize",
  "threshold",
  "baseIndex",
  "displayTerms",
  "domainSize",
  "modulus",
  "shift",
  "cut",
  "target",
  "wordSize",
  "left",
  "right",
  "start",
  "graphSize",
  "searchLimit",
  "primeOffset",
] as const;
export type LogicNumericKey = (typeof LOGIC_NUMERIC_KEYS)[number];
export type LogicScene = Record<LogicNumericKey, number> & {
  truthPair: "converse" | "contrapositive" | "demorgan" | "distributivity" | "xor";
  quantifier: "forall-forall" | "forall-exists" | "exists-forall" | "exists-exists";
  predicate: "less" | "equal" | "sum-at-most";
  proof: "even-sum" | "square-parity" | "no-largest-integer";
  proofOrder: string[];
  induction: "odd-sum" | "shifted-base" | "false-step";
  property: "injective" | "surjective" | "bijective" | "image-equality" | "preimage-equality";
  words: string[];
  orderFamily: "interval" | "reciprocal";
  leftEnd: "open" | "closed";
  rightEnd: "open" | "closed";
  orderProperty: "minimum" | "maximum" | "nonempty";
  invariant: "parity" | "graph";
  wrap: "no" | "yes";
  counterexample: "prime-quadratic" | "integer-implication" | "odd-sum";
};
export const LOGIC_CHOICE_KEYS = [
  "truthPair",
  "quantifier",
  "predicate",
  "proof",
  "induction",
  "property",
  "orderFamily",
  "leftEnd",
  "rightEnd",
  "orderProperty",
  "invariant",
  "wrap",
  "counterexample",
] as const;
export type LogicChoiceKey = (typeof LOGIC_CHOICE_KEYS)[number];
export type LogicField = { key: LogicNumericKey; label: string; min: number; max: number };
export type LogicChoice = {
  key: LogicChoiceKey;
  label: string;
  options: Array<{ value: string; label: string }>;
};
export type LogicAnswer =
  { kind: "boolean"; value: boolean; display: string } | { kind: "word"; value: string; display: string };
export type LogicTable = {
  caption: string;
  headers: string[];
  rows: string[][];
};
export type LogicProofStep = { id: string; text: string; requires: string[] };
export type LogicProof = {
  title: string;
  claim: string;
  method: string;
  steps: LogicProofStep[];
  defaultOrder: string[];
};
export type LogicResult = {
  setup: string[];
  target: string;
  answer: LogicAnswer | null;
  steps: string[];
  facts: Array<{ label: string; value: string }>;
  observations: string[];
  tables: LogicTable[];
  reflection: string;
  proofFeedback?: Array<{ id: string; position: number; missing: string[]; valid: boolean }>;
  error: string | null;
};
export type LogicPreset = {
  id: string;
  label: string;
  description: string;
  mode: LogicMode;
  scene: LogicScene;
};
export type LogicLessonLink = {
  roadmap: "real-analysis" | "discrete-math";
  topic: string;
  title: string;
  mode: LogicMode;
};
export const LOGIC_LESSONS: readonly LogicLessonLink[] = [
  {
    roadmap: "real-analysis",
    topic: "propositions-quantifiers-and-negation",
    title: "Propositions, quantifiers, and negation",
    mode: "quantifiers",
  },
  {
    roadmap: "real-analysis",
    topic: "direct-contrapositive-and-contradiction-proofs",
    title: "Direct, contrapositive, and contradiction proofs",
    mode: "proof",
  },
  {
    roadmap: "real-analysis",
    topic: "induction-and-recursive-arguments",
    title: "Induction and recursive arguments",
    mode: "induction",
  },
  {
    roadmap: "real-analysis",
    topic: "sets-functions-images-and-preimages",
    title: "Sets, functions, images, and preimages",
    mode: "sets",
  },
  {
    roadmap: "real-analysis",
    topic: "countability-and-diagonal-arguments",
    title: "Countability and diagonal arguments",
    mode: "diagonal",
  },
  {
    roadmap: "real-analysis",
    topic: "suprema-infima-and-order",
    title: "Suprema, infima, and order",
    mode: "order",
  },
  {
    roadmap: "discrete-math",
    topic: "propositional-and-predicate-logic",
    title: "Propositional and predicate logic",
    mode: "truth",
  },
  {
    roadmap: "discrete-math",
    topic: "truth-tables-and-logical-equivalence",
    title: "Truth tables and logical equivalence",
    mode: "truth",
  },
  {
    roadmap: "discrete-math",
    topic: "quantifiers-and-nested-negation",
    title: "Quantifiers and nested negation",
    mode: "quantifiers",
  },
  {
    roadmap: "discrete-math",
    topic: "direct-contrapositive-and-contradiction-proofs",
    title: "Direct, contrapositive, and contradiction proofs",
    mode: "proof",
  },
  {
    roadmap: "discrete-math",
    topic: "induction-and-strong-induction",
    title: "Induction and strong induction",
    mode: "induction",
  },
  {
    roadmap: "discrete-math",
    topic: "invariants-and-extremal-arguments",
    title: "Invariants and extremal arguments",
    mode: "invariants",
  },
];
export const LOGIC_TITLES: Record<LogicMode, string> = {
  truth: "Truth tables and equivalence",
  quantifiers: "Quantifiers and witnesses",
  proof: "Proof dependencies",
  induction: "Induction and missing steps",
  sets: "Functions, images and preimages",
  diagonal: "Diagonal constructions",
  order: "Bounds and attained extrema",
  invariants: "Invariants and extremal arguments",
  counterexamples: "Counterexamples and finite checks",
};
export function logicFields(mode: LogicMode, scene: LogicScene): LogicField[] {
  const field = (key: LogicNumericKey, label: string, min: number, max: number) => ({ key, label, min, max });
  switch (mode) {
    case "quantifiers":
      return [
        field("xSize", "Size of X", 0, 6),
        field("ySize", "Size of Y", 0, 6),
        ...(scene.predicate === "sum-at-most" ? [field("threshold", "Sum threshold k", 0, 12)] : []),
      ];
    case "induction":
      return [
        ...(scene.induction !== "false-step" ? [field("baseIndex", "Supplied base index", 1, 5)] : []),
        field("displayTerms", "Terms to check", 1, 12),
      ];
    case "sets":
      return [
        field("domainSize", "Domain size m", 0, 8),
        field("modulus", "Codomain size q", 1, 6),
        field("shift", "Map shift s", -5, 5),
        field("cut", "Subset cutoff c", 0, 8),
        field("target", "Target cutoff t", -1, 6),
      ];
    case "diagonal":
      return [field("wordSize", "Word count and length n", 1, 6)];
    case "order":
      return scene.orderFamily === "interval"
        ? [field("left", "Left endpoint a", -4, 4), field("right", "Right endpoint b", -4, 4)]
        : [
            field("left", "Reciprocal offset c", -3, 3),
            field("start", "First denominator n₀", 1, 5),
            field("displayTerms", "Terms to display", 1, 12),
          ];
    case "invariants":
      return scene.invariant === "parity"
        ? [field("start", "Starting state", 0, 20), field("target", "Target state", 0, 20)]
        : [field("graphSize", "Number of vertices", 0, 8)];
    case "counterexamples":
      return [
        ...(scene.counterexample === "prime-quadratic"
          ? [field("primeOffset", "Polynomial constant k", 2, 41)]
          : []),
        field("searchLimit", "Last checked index", 0, 40),
      ];
    default:
      return [];
  }
}
export function logicChoices(mode: LogicMode, scene: LogicScene): LogicChoice[] {
  const choice = (key: LogicChoiceKey, label: string, options: Array<[string, string]>): LogicChoice => ({
    key,
    label,
    options: options.map(([value, text]) => ({ value, label: text })),
  });
  switch (mode) {
    case "truth":
      return [
        choice("truthPair", "Formula pair", [
          ["converse", "An implication and its converse"],
          ["contrapositive", "An implication and its contrapositive"],
          ["demorgan", "De Morgan's law"],
          ["distributivity", "Distributivity"],
          ["xor", "Inclusive or and exclusive or"],
        ]),
      ];
    case "quantifiers":
      return [
        choice("quantifier", "Quantifier order", [
          ["forall-forall", "For every x, for every y"],
          ["forall-exists", "For every x, there exists y"],
          ["exists-forall", "There exists x, for every y"],
          ["exists-exists", "There exists x, there exists y"],
        ]),
        choice("predicate", "Predicate", [
          ["less", "x < y"],
          ["equal", "x = y"],
          ["sum-at-most", "x + y ≤ k"],
        ]),
      ];
    case "proof":
      return [
        choice("proof", "Proof scenario", [
          ["even-sum", "The sum of two even integers is even"],
          ["square-parity", "An even square has an even integer root"],
          ["no-largest-integer", "There is no largest integer"],
        ]),
      ];
    case "induction":
      return [
        choice("induction", "Induction argument", [
          ["odd-sum", "The sum of the first n odd numbers"],
          ["shifted-base", "A shifted base for a false universal claim"],
          ["false-step", "A true base with an invalid step"],
        ]),
      ];
    case "sets":
      return [
        choice("property", "Property to predict", [
          ["injective", "Is f injective?"],
          ["surjective", "Is f surjective onto its codomain?"],
          ["bijective", "Is f bijective?"],
          ["image-equality", "Does f(f⁻¹(B)) equal B?"],
          ["preimage-equality", "Does f⁻¹(f(A)) equal A?"],
        ]),
      ];
    case "order":
      return [
        choice("orderFamily", "Set family", [
          ["interval", "A real interval"],
          ["reciprocal", "An infinite reciprocal set"],
        ]),
        ...(scene.orderFamily === "interval"
          ? [
              choice("leftEnd", "Left endpoint inclusion", [
                ["open", "Open"],
                ["closed", "Closed"],
              ]),
              choice("rightEnd", "Right endpoint inclusion", [
                ["open", "Open"],
                ["closed", "Closed"],
              ]),
            ]
          : []),
        choice("orderProperty", "Extremum question", [
          ["minimum", "Does the set have a minimum?"],
          ["maximum", "Does the set have a maximum?"],
          ["nonempty", "Is the set nonempty?"],
        ]),
      ];
    case "invariants":
      return [
        choice("invariant", "Construction", [
          ["parity", "Reachability by steps of two"],
          ["graph", "Increasing edges and a wraparound edge"],
        ]),
        ...(scene.invariant === "graph"
          ? [
              choice("wrap", "Add the wraparound edge", [
                ["no", "No"],
                ["yes", "Yes"],
              ]),
            ]
          : []),
      ];
    case "counterexamples":
      return [
        choice("counterexample", "Claim to inspect", [
          ["prime-quadratic", "A quadratic always produces a prime"],
          ["integer-implication", "An integer implication checked on a nonnegative prefix"],
          ["odd-sum", "The sum of the first n odd numbers"],
        ]),
      ];
    default:
      return [];
  }
}
