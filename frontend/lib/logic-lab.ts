import {
  LOGIC_MODES,
  logicChoices,
  logicFields,
  type LogicMode,
  type LogicPreset,
  type LogicProof,
  type LogicResult,
  type LogicScene,
} from "@/lib/logic-lab-types";

/** Small original public examples, independent of the assessment question banks. */
export const LOGIC_PROOFS: Record<LogicScene["proof"], LogicProof> = {
  "even-sum": {
    title: "A direct proof about even integers",
    claim: "The sum of any two even integers is even.",
    method: "Direct proof",
    steps: [
      { id: "assume-even", text: "Let a and b be arbitrary even integers.", requires: [] },
      { id: "write-a", text: "There is an integer r with $a=2r$.", requires: ["assume-even"] },
      { id: "write-b", text: "There is an integer s with $b=2s$.", requires: ["assume-even"] },
      { id: "rewrite", text: "Then $a+b=2r+2s=2(r+s)$.", requires: ["write-a", "write-b"] },
      { id: "integer", text: "The sum $r+s$ is an integer.", requires: ["write-a", "write-b"] },
      {
        id: "conclude",
        text: "Thus $a+b$ is twice an integer, so it is even.",
        requires: ["rewrite", "integer"],
      },
    ],
    defaultOrder: ["assume-even", "write-a", "rewrite", "write-b", "integer", "conclude"],
  },
  "square-parity": {
    title: "A contrapositive proof about a square",
    claim: "For every integer n, if n squared is even, then n is even.",
    method: "Contrapositive",
    steps: [
      {
        id: "contra",
        text: "It suffices to prove the contrapositive: if an integer n is odd, then n squared is odd.",
        requires: [],
      },
      { id: "odd", text: "Let $n=2k+1$ for an arbitrary integer k.", requires: ["contra"] },
      { id: "expand", text: "Expanding gives $n^2=4k^2+4k+1=2(2k^2+2k)+1$.", requires: ["odd"] },
      { id: "integer", text: "The number $2k^2+2k$ is an integer.", requires: ["odd"] },
      {
        id: "odd-square",
        text: "Therefore n squared has the form twice an integer plus one, so it is odd.",
        requires: ["expand", "integer"],
      },
      {
        id: "conclude",
        text: "The contrapositive, and hence the original implication, is proved.",
        requires: ["contra", "odd-square"],
      },
    ],
    defaultOrder: ["contra", "odd", "odd-square", "expand", "integer", "conclude"],
  },
  "no-largest-integer": {
    title: "A contradiction using a successor",
    claim: "There is no largest integer.",
    method: "Contradiction",
    steps: [
      { id: "assume", text: "Suppose, for a contradiction, that N is a largest integer.", requires: [] },
      { id: "successor", text: "Because N is an integer, $N+1$ is also an integer.", requires: ["assume"] },
      { id: "greater", text: "The order laws give $N+1>N$.", requires: ["assume"] },
      {
        id: "contradiction",
        text: "This is an integer larger than N, contradicting the assumption that N was largest.",
        requires: ["assume", "successor", "greater"],
      },
      { id: "conclude", text: "Consequently no largest integer exists.", requires: ["contradiction"] },
    ],
    defaultOrder: ["assume", "contradiction", "successor", "greater", "conclude"],
  },
};

const range = (length: number, first = 0) => Array.from({ length }, (_, i) => i + first);
const yes = (value: boolean) => (value ? "Yes" : "No");
const truth = (value: boolean) => (value ? "True" : "False");
const setText = (values: readonly number[]) => (values.length ? `{${values.join(", ")}}` : "∅");
const unique = (values: readonly number[]) => [...new Set(values)].sort((a, b) => a - b);
const equalSets = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
const paren = (n: number) => (n < 0 ? `(${n})` : String(n));
const booleanAnswer = (value: boolean, display: string): NonNullable<LogicResult["answer"]> => ({
  kind: "boolean",
  value,
  display,
});
function blank(error: string | null = null): LogicResult {
  return {
    setup: [],
    target: "",
    answer: null,
    steps: [],
    facts: [],
    observations: [],
    tables: [],
    reflection: "",
    error,
  };
}

function fraction(numerator: number, denominator: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.abs(numerator), Math.abs(denominator));
  const n = numerator / divisor;
  const d = denominator / divisor;
  return d === 1 ? String(n) : `${n}/${d}`;
}

export function defaultLogicScene(mode: LogicMode): LogicScene {
  const scene: LogicScene = {
    xSize: 3,
    ySize: 3,
    threshold: 3,
    baseIndex: 1,
    displayTerms: 6,
    domainSize: 4,
    modulus: 3,
    shift: 0,
    cut: 2,
    target: 1,
    wordSize: 3,
    left: 0,
    right: 2,
    start: 1,
    graphSize: 4,
    searchLimit: 8,
    primeOffset: 41,
    truthPair: "converse",
    quantifier: "forall-exists",
    predicate: "less",
    proof: "even-sum",
    proofOrder: [...LOGIC_PROOFS["even-sum"].defaultOrder],
    induction: "odd-sum",
    property: "preimage-equality",
    words: ["000", "111", "010"],
    orderFamily: "interval",
    leftEnd: "open",
    rightEnd: "closed",
    orderProperty: "minimum",
    invariant: "parity",
    wrap: "no",
    counterexample: "prime-quadratic",
  };
  if (mode === "invariants") {
    scene.start = 0;
    scene.target = 6;
  }
  if (mode === "quantifiers") scene.predicate = "equal";
  if (mode === "sets") {
    scene.domainSize = 6;
    scene.shift = -1;
  }
  if (mode === "counterexamples") scene.searchLimit = 39;
  return scene;
}

function validate(mode: LogicMode, scene: LogicScene): string | null {
  if (!LOGIC_MODES.includes(mode)) return "Choose a supported experiment.";
  if (!scene || typeof scene !== "object") return "Provide experiment controls.";
  for (const item of logicChoices(mode, scene)) {
    if (!item.options.some((option) => option.value === scene[item.key]))
      return `Choose a valid ${item.label.toLowerCase()}.`;
  }
  for (const item of logicFields(mode, scene)) {
    const value = scene[item.key];
    if (!Number.isInteger(value) || value < item.min || value > item.max)
      return `${item.label} must be a whole number from ${item.min} to ${item.max}.`;
  }
  if (mode === "proof") {
    const ids = LOGIC_PROOFS[scene.proof].steps.map((step) => step.id);
    if (
      !Array.isArray(scene.proofOrder) ||
      scene.proofOrder.length !== ids.length ||
      new Set(scene.proofOrder).size !== ids.length ||
      !scene.proofOrder.every((id) => typeof id === "string" && ids.includes(id))
    ) {
      return "Place every proof step exactly once in the order.";
    }
  }
  if (
    mode === "diagonal" &&
    (!Array.isArray(scene.words) ||
      scene.words.length !== scene.wordSize ||
      !scene.words.every(
        (word) => typeof word === "string" && word.length === scene.wordSize && /^[01]+$/.test(word),
      ))
  ) {
    return `Enter exactly ${scene.wordSize} binary words, each containing ${scene.wordSize} bits.`;
  }
  return null;
}

function evaluateTruth(scene: LogicScene): LogicResult {
  const result = blank();
  const pair = scene.truthPair;
  const formulas: Record<LogicScene["truthPair"], [string, string]> = {
    converse: ["p\\Rightarrow q", "q\\Rightarrow p"],
    contrapositive: ["p\\Rightarrow q", "\\neg q\\Rightarrow\\neg p"],
    demorgan: ["\\neg(p\\land q)", "\\neg p\\lor\\neg q"],
    distributivity: ["p\\land(q\\lor r)", "(p\\land q)\\lor(p\\land r)"],
    xor: ["p\\lor q", "(p\\lor q)\\land\\neg(p\\land q)"],
  };
  const [a, b] = formulas[pair];
  const three = pair === "distributivity";
  const assignments = range(three ? 8 : 4).map((mask) => {
    const p = Boolean(mask & (three ? 4 : 2));
    const q = Boolean(mask & (three ? 2 : 1));
    const r = Boolean(mask & 1);
    let first: boolean;
    let second: boolean;
    switch (pair) {
      case "converse":
        first = !p || q;
        second = !q || p;
        break;
      case "contrapositive":
        first = !p || q;
        second = q || !p;
        break;
      case "demorgan":
        first = !(p && q);
        second = !p || !q;
        break;
      case "distributivity":
        first = p && (q || r);
        second = (p && q) || (p && r);
        break;
      case "xor":
        first = p || q;
        second = (p || q) && !(p && q);
        break;
    }
    return { p, q, r, first, second };
  });
  const different = assignments.filter((row) => row.first !== row.second);
  result.setup = [
    `Formula A is $${a}$; formula B is $${b}$.`,
    `Each variable independently takes the values true and false. An implication is false only when its premise is true and its conclusion is false.`,
  ];
  result.target = "Are the two formulas logically equivalent for every truth assignment?";
  result.answer = booleanAnswer(
    different.length === 0,
    different.length === 0
      ? "Yes — the formulas are logically equivalent"
      : "No — the formulas differ on some truth assignments",
  );
  result.tables = [
    {
      caption: "Complete truth table",
      headers: [...(three ? ["p", "q", "r"] : ["p", "q"]), "Formula A", "Formula B", "Agree"],
      rows: assignments.map((row) => [
        ...(three ? [truth(row.p), truth(row.q), truth(row.r)] : [truth(row.p), truth(row.q)]),
        truth(row.first),
        truth(row.second),
        yes(row.first === row.second),
      ]),
    },
  ];
  result.facts = [
    { label: "Assignments checked", value: String(assignments.length) },
    { label: "Distinguishing assignments", value: String(different.length) },
  ];
  result.steps =
    different.length === 0
      ? [
          `All $2^{${three ? 3 : 2}}=${assignments.length}$ possible assignments have equal output columns. This exhausts the possibilities for these propositional variables, so the formulas are equivalent.`,
        ]
      : [
          `A single unequal row disproves equivalence. For example, $p=\\mathrm{${truth(different[0].p).toLowerCase()}},q=\\mathrm{${truth(different[0].q).toLowerCase()}}$ makes the two formulas disagree.`,
          pair === "xor"
            ? "Inclusive or permits both propositions to be true. Exclusive or requires exactly one true proposition."
            : "Reversing an implication changes its premise and conclusion. The converse need not have the same truth value as the original implication.",
        ];
  result.observations = [
    "A complete truth table exhausts finitely many Boolean assignments. This differs from checking a few values in an infinite integer or real domain.",
  ];
  result.reflection =
    "Which row is the most informative, and why does checking every row settle this propositional question?";
  return result;
}

function evaluateQuantifiers(scene: LogicScene): LogicResult {
  const result = blank();
  const xs = range(scene.xSize),
    ys = range(scene.ySize);
  const [outer, inner] = scene.quantifier.split("-");
  const predicate = (x: number, y: number) =>
    scene.predicate === "less" ? x < y : scene.predicate === "equal" ? x === y : x + y <= scene.threshold;
  const relation =
    scene.predicate === "less" ? "x<y" : scene.predicate === "equal" ? "x=y" : `x+y\\le ${scene.threshold}`;
  const negatedRelation =
    scene.predicate === "less"
      ? "x\\ge y"
      : scene.predicate === "equal"
        ? "x\\ne y"
        : `x+y>${scene.threshold}`;
  const quant = (name: string) => (name === "forall" ? "\\forall" : "\\exists");
  const opposite = (name: string) => (name === "forall" ? "exists" : "forall");
  const reduce = (name: string, values: boolean[]) =>
    name === "forall" ? values.every(Boolean) : values.some(Boolean);
  const innerValues = xs.map((x) =>
    reduce(
      inner,
      ys.map((y) => predicate(x, y)),
    ),
  );
  const value = reduce(outer, innerValues);
  const negation = reduce(
    opposite(outer),
    xs.map((x) =>
      reduce(
        opposite(inner),
        ys.map((y) => !predicate(x, y)),
      ),
    ),
  );
  result.setup = [
    `The finite domains are X = ${setText(xs)} and Y = ${setText(ys)}. The predicate is $${relation}$.`,
    `The statement is $${quant(outer)} x\\in X\\;${quant(inner)} y\\in Y:\\;${relation}$. The outer quantifier always chooses x first.`,
  ];
  result.target = "Is this quantified statement true on the stated finite domains?";
  result.answer = booleanAnswer(
    value,
    value
      ? "Yes — the quantified statement holds on these finite domains"
      : "No — the quantified statement fails on these finite domains",
  );
  result.tables = [
    {
      caption: "Complete predicate matrix",
      headers: ["x / y", ...(ys.length ? ys.map(String) : ["No y values"])],
      rows: xs.map((x) => [
        String(x),
        ...(ys.length ? ys.map((y) => truth(predicate(x, y))) : ["Empty row"]),
      ]),
    },
    {
      caption: "Inner statement for each x",
      headers: ["x", "Inner statement", "Witness or obstruction"],
      rows: xs.map((x, i) => {
        const witness = ys.find((y) => (inner === "exists" ? predicate(x, y) : !predicate(x, y)));
        const explanation =
          witness !== undefined
            ? `${inner === "exists" ? "Witness" : "Counterexample"} y = ${witness}`
            : ys.length === 0
              ? inner === "forall"
                ? "Vacuously true: no y can fail"
                : "False: no y can witness it"
              : inner === "forall"
                ? "Every y satisfies the predicate"
                : "No y satisfies the predicate";
        return [String(x), truth(innerValues[i]), explanation];
      }),
    },
  ];
  result.facts = [
    { label: "Original statement", value: truth(value) },
    { label: "Negated statement", value: `${opposite(outer)} x, ${opposite(inner)} y: not P(x,y)` },
    { label: "Negation's truth value", value: truth(negation) },
  ];
  result.steps = [
    `First evaluate the ${inner === "forall" ? "universal" : "existential"} inner statement separately for each x. Then apply the ${outer === "forall" ? "universal" : "existential"} outer quantifier to those results.`,
    `Negating both levels gives $${quant(opposite(outer))} x\\in X\\;${quant(opposite(inner))} y\\in Y:\\;${negatedRelation}$. Its truth value is the opposite of the original statement.`,
    "A universal assertion over an empty domain is true because there is no counterexample. An existential assertion over an empty domain is false because there is no witness.",
  ];
  result.observations = [
    outer === "forall" && inner === "exists"
      ? "A witness y may depend on x; different x values need not use the same witness."
      : outer === "exists" && inner === "forall"
        ? "One chosen x must work for every y. Choosing a new x after seeing y would change the statement."
        : "These conclusions concern exactly the displayed finite domains.",
  ];
  result.reflection =
    "What changes when the quantifiers are swapped, and what happens if either domain is empty?";
  return result;
}

function evaluateProof(scene: LogicScene): LogicResult {
  const result = blank();
  const proof = LOGIC_PROOFS[scene.proof];
  const established = new Set<string>();
  result.proofFeedback = scene.proofOrder.map((id, index) => {
    const step = proof.steps.find((item) => item.id === id)!;
    const missing = step.requires.filter((required) => !established.has(required));
    if (missing.length === 0) established.add(id);
    return { id, position: index + 1, missing, valid: missing.length === 0 };
  });
  const value = result.proofFeedback.every((step) => step.valid);
  result.setup = [
    `Claim: ${proof.claim}`,
    `Method: ${proof.method}. Arrange the supplied steps so that every required premise has been established before its use. Independent branches may be interchanged.`,
  ];
  result.target = "Does this order establish every step from its required premises?";
  result.answer = booleanAnswer(
    value,
    value
      ? "Yes — every proof step has established premises"
      : "No — this order contains unjustified proof steps",
  );
  result.tables = [
    {
      caption: "Proof dependency check",
      headers: ["Position", "Step", "Established premises?", "Missing established steps"],
      rows: result.proofFeedback.map((feedback) => [
        String(feedback.position),
        proof.steps.find((step) => step.id === feedback.id)!.text,
        yes(feedback.valid),
        feedback.missing.length ? feedback.missing.join(", ") : "None",
      ]),
    },
  ];
  result.facts = [
    { label: "Proof method", value: proof.method },
    { label: "Steps justified in this order", value: `${established.size} of ${proof.steps.length}` },
  ];
  result.steps = value
    ? [
        "Every step has all its prerequisites established. Independent branches can have more than one valid ordering; this is a complete dependency-respecting proof chain.",
      ]
    : [
        "The first unjustified step uses a premise that has not yet been established. Merely displaying that premise in an earlier unjustified step does not establish it.",
        "Move prerequisites before their uses, then reconsider every dependent conclusion. This checks the supplied proof structure, rather than claiming that every other proof of the theorem is invalid.",
      ];
  result.observations = [
    "The graph encodes the dependencies of these particular supplied steps. A different sound proof could use a different structure.",
  ];
  result.reflection =
    "Which steps are independent, and which conclusion fails if an earlier premise was only written down rather than established?";
  return result;
}

function evaluateInduction(scene: LogicScene): LogicResult {
  const result = blank();
  const family = scene.induction;
  const base = family === "false-step" ? 1 : scene.baseIndex;
  const odd = family === "odd-sum";
  const baseHolds = family !== "shifted-base" || base >= 2;
  const stepValid = family !== "false-step";
  const complete = odd && base === 1;
  const claim = odd ? "$1+3+\\cdots+(2n-1)=n^2$" : family === "shifted-base" ? "$n\\ge 2$" : "$n^2=n$";
  result.setup = [
    `The advertised claim is ${claim} for every integer $n\\ge 1$.`,
    `The supplied base case is $n=${base}$. The proposed step ${family === "false-step" ? "uses $(k+1)^2=k^2+1$ after assuming $k^2=k$." : odd ? "adds $2k+1$ to an assumed equality at k." : "uses $k\\ge2$ to conclude $k+1\\ge2$."}`,
  ];
  result.target = "Does this supplied induction argument prove the advertised claim for every integer n ≥ 1?";
  result.answer = booleanAnswer(
    complete,
    complete
      ? "Yes — the supplied argument proves the claim for all n ≥ 1"
      : "No — the supplied argument does not prove the claim for all n ≥ 1",
  );
  result.tables = [
    {
      caption: "Finite checks, not an induction proof",
      headers: [
        "n",
        odd ? "Sum of first n odd numbers" : "Left side",
        odd ? "n²" : "Required comparison",
        "Claim holds",
      ],
      rows: range(scene.displayTerms, 1).map((n) => {
        const sum = range(n, 1).reduce((total, i) => total + 2 * i - 1, 0);
        return [
          String(n),
          String(odd ? sum : family === "shifted-base" ? n : n * n),
          family === "shifted-base" ? "≥ 2" : String(odd ? n * n : n),
          yes(odd ? sum === n * n : family === "shifted-base" ? n >= 2 : n * n === n),
        ];
      }),
    },
  ];
  result.facts = [
    { label: "Supplied base case holds", value: yes(baseHolds) },
    { label: "Proposed inductive step is valid", value: yes(stepValid) },
    { label: "Advertised universal claim is true", value: yes(odd) },
  ];
  if (odd) {
    result.steps = [
      `The base at $n=${base}$ is true. From the hypothesis $1+3+\\cdots+(2k-1)=k^2$, adding the next odd number gives $k^2+(2k+1)=(k+1)^2$.`,
      base === 1
        ? "The base n = 1 and this implication for every k ≥ 1 cover all integers n ≥ 1, so this is a valid induction proof."
        : `A base at n = ${base} and subsequent steps establish only n ≥ ${base}. The missing indices 1 through ${base - 1} have not been covered by this supplied argument. The original identity is nevertheless true: use the same step with base n = 1.`,
    ];
  } else if (family === "shifted-base") {
    result.steps = [
      base === 1
        ? "The supplied base n = 1 is false: 1 is not at least 2. A valid inductive implication cannot repair a false starting case."
        : `The supplied base n = ${base} and valid forward implication cover a tail, not the advertised claim starting at n = 1.`,
      "Indeed n = 1 is a counterexample to the advertised universal claim. A correct proof for n ≥ 2 would not prove a statement for all n ≥ 1.",
    ];
  } else {
    result.steps = [
      "The base 1² = 1 is true. But the expansion is $(k+1)^2=k^2+2k+1$, not $k^2+1$. The proposed step drops the term $2k$.",
      "At k = 1, the premise 1² = 1 holds while the required next assertion 2² = 2 is false. Thus both the proposed step and the advertised universal claim fail.",
    ];
  }
  result.observations = [
    "A true claim can have an incomplete proof. A true base can also be followed by a false induction step. The finite table alone does not establish an infinite claim.",
  ];
  result.reflection =
    "Separate the truth of the claim, the truth of the supplied base, and the validity and coverage of the step. Which one controls your verdict?";
  return result;
}

function evaluateSets(scene: LogicScene): LogicResult {
  const result = blank();
  const domain = range(scene.domainSize),
    codomain = range(scene.modulus);
  const f = (x: number) => (((x + scene.shift) % scene.modulus) + scene.modulus) % scene.modulus;
  const a = domain.filter((x) => x < scene.cut),
    b = codomain.filter((y) => y <= scene.target);
  const image = (values: number[]) => unique(values.map(f));
  const preimage = (values: number[]) => domain.filter((x) => values.includes(f(x)));
  const imageD = image(domain),
    imageA = image(a),
    preimageB = preimage(b);
  const imagePreimageB = image(preimageB),
    preimageImageA = preimage(imageA);
  const injective = imageD.length === domain.length,
    surjective = equalSets(imageD, codomain);
  const values = {
    injective,
    surjective,
    bijective: injective && surjective,
    "image-equality": equalSets(imagePreimageB, b),
    "preimage-equality": equalSets(preimageImageA, a),
  };
  const targets = {
    injective: "Is f injective on its stated domain?",
    surjective: "Is f surjective onto its stated codomain?",
    bijective: "Is f bijective between the stated sets?",
    "image-equality": "For this particular B, does f(f⁻¹(B)) equal B?",
    "preimage-equality": "For this particular A, does f⁻¹(f(A)) equal A?",
  };
  result.setup = [
    `D = ${setText(domain)} and C = ${setText(codomain)}. Define $f(x)=(x+${paren(scene.shift)})\\bmod ${scene.modulus}$, using the nonnegative remainder in C.`,
    `A consists of domain elements x < ${scene.cut}; B consists of codomain elements y ≤ ${scene.target}. The inverse-image notation f⁻¹(B) denotes a set, not an inverse function.`,
  ];
  result.target = targets[scene.property];
  const value = values[scene.property];
  const display =
    scene.property === "image-equality"
      ? value
        ? "Yes — f(f⁻¹(B)) equals this chosen B"
        : "No — f(f⁻¹(B)) is a proper subset of this B"
      : scene.property === "preimage-equality"
        ? value
          ? "Yes — f⁻¹(f(A)) equals this chosen A"
          : "No — f⁻¹(f(A)) strictly contains this A"
        : `${yes(value)} — f is ${value ? "" : "not "}${scene.property === "injective" ? "injective on D" : scene.property === "surjective" ? "surjective onto C" : "bijective"}`;
  result.answer = booleanAnswer(value, display);
  result.tables = [
    {
      caption: "Complete function table",
      headers: ["x in D", "f(x)", "x in A", "f(x) in B"],
      rows: domain.map((x) => [String(x), String(f(x)), yes(a.includes(x)), yes(b.includes(f(x)))]),
    },
    {
      caption: "Images and inverse images",
      headers: ["Set", "Elements"],
      rows: [
        ["D", setText(domain)],
        ["C", setText(codomain)],
        ["A", setText(a)],
        ["B", setText(b)],
        ["f(D)", setText(imageD)],
        ["f(A)", setText(imageA)],
        ["f⁻¹(B)", setText(preimageB)],
        ["f(f⁻¹(B))", setText(imagePreimageB)],
        ["f⁻¹(f(A))", setText(preimageImageA)],
      ],
    },
  ];
  result.facts = [
    { label: "Injective", value: yes(injective) },
    { label: "Surjective onto C", value: yes(surjective) },
    { label: "Bijective", value: yes(injective && surjective) },
  ];
  result.steps = [
    "For an image, collect all outputs of the input set. For an inverse image, collect every domain input whose output belongs to the target set.",
    "$f(f^{-1}(B))=B\\cap f(D)$: target elements outside the range have no preimages. Meanwhile $A\\subseteq f^{-1}(f(A))$: an inverse image may add other inputs sharing an output with A.",
    "Equality for a particular chosen subset need not imply global injectivity or surjectivity. For instance the empty subset can give equality even for a non-bijective map.",
  ];
  result.observations = [
    domain.length === 0
      ? "The empty-domain function is injective vacuously. Its nonempty codomain is not covered, so it is not surjective."
      : "The complete finite mapping table settles these properties for this stated map and these stated subsets.",
  ];
  result.reflection =
    "Which fibers (sets of inputs with the same output) explain any extra elements in f⁻¹(f(A))?";
  return result;
}

function evaluateDiagonal(scene: LogicScene): LogicResult {
  const result = blank();
  const word = scene.words.map((row, i) => (row[i] === "0" ? "1" : "0")).join("");
  result.setup = [
    `There are ${scene.wordSize} binary words, each of length ${scene.wordSize}. Number rows and positions starting at 1.`,
    "Construct a word d by flipping position i of row i: 0 becomes 1 and 1 becomes 0.",
  ];
  result.target = "What binary word does this antidiagonal construction produce?";
  result.answer = { kind: "word", value: word, display: word };
  result.tables = [
    {
      caption: "Antidiagonal differences",
      headers: ["Row i", "Supplied word", "Diagonal bit", "d at position i", "Guaranteed difference"],
      rows: scene.words.map((row, i) => [String(i + 1), row, row[i], word[i], `Position ${i + 1}`]),
    },
  ];
  result.facts = [
    { label: "Constructed word", value: word },
    { label: "Equal to a displayed row", value: "No" },
    { label: "Finite words under discussion", value: `${scene.wordSize} rows of ${scene.wordSize} bits` },
  ];
  result.steps = [
    "For every displayed row i, the constructed word differs at position i. Consequently it is not any of those rows; repeated supplied rows do not change this argument.",
    "The finite experiment shows an omission from a finite list, not uncountability by itself.",
    "For the separate infinite argument, suppose an entire list $s_1,s_2,\\ldots$ contains every infinite binary sequence. Define $d_i=1-s_i(i)$ for every positive integer i. For every row i, d differs from sᵢ at position i, contradicting the supposed completeness of the list. This statement concerns infinite binary sequences directly, avoiding ambiguities of real-number expansions.",
  ];
  result.observations = [
    "A larger finite display cannot replace the general infinite argument. The reason the argument extends is the definition of a differing bit for every positive index.",
  ];
  result.reflection =
    "Which specific position excludes each displayed row, and which extra universal step is needed for the infinite argument?";
  return result;
}

function evaluateOrder(scene: LogicScene): LogicResult {
  const result = blank();
  if (scene.orderFamily === "interval") {
    const { left: a, right: b } = scene;
    const closedLeft = scene.leftEnd === "closed",
      closedRight = scene.rightEnd === "closed";
    const nonempty = a < b || (a === b && closedLeft && closedRight);
    const minimum = nonempty && closedLeft,
      maximum = nonempty && closedRight;
    const contains = (x: number) =>
      nonempty && (x > a || (closedLeft && x === a)) && (x < b || (closedRight && x === b));
    const notation = `${closedLeft ? "[" : "("}${a}, ${b}${closedRight ? "]" : ")"}`;
    result.setup = [
      `The real set is S = ${notation}: include the left endpoint only when closed, and likewise the right endpoint.`,
      "If the left endpoint exceeds the right endpoint, the inequalities define the empty set. A minimum or maximum must be an element of S.",
    ];
    const value =
      scene.orderProperty === "minimum" ? minimum : scene.orderProperty === "maximum" ? maximum : nonempty;
    const propertyText =
      scene.orderProperty === "nonempty"
        ? `the set is ${value ? "nonempty" : "empty"}`
        : `the set ${value ? "has" : "does not have"} a ${scene.orderProperty}`;
    result.answer = booleanAnswer(value, `${yes(value)} — ${propertyText}`);
    result.tables = [
      {
        caption: "Selected membership checks, not an enumeration of a real interval",
        headers: ["Real value", "Belongs to S"],
        rows: unique([a - 1, a, (a + b) / 2, b, b + 1]).map((x) => [String(x), yes(contains(x))]),
      },
    ];
    result.facts = [
      { label: "Nonempty", value: yes(nonempty) },
      { label: "Infimum in ℝ", value: nonempty ? String(a) : "Does not exist" },
      { label: "Supremum in ℝ", value: nonempty ? String(b) : "Does not exist" },
      { label: "Minimum", value: minimum ? String(a) : "Does not exist" },
      { label: "Maximum", value: maximum ? String(b) : "Does not exist" },
    ];
    result.steps = nonempty
      ? [
          a === b
            ? `Both endpoints are included, so S is the singleton {${a}}. Its one element is simultaneously the minimum, maximum, infimum and supremum.`
            : `Every element lies between ${a} and ${b}, and elements can be chosen arbitrarily close to either endpoint from inside. Thus the infimum is ${a} and the supremum is ${b}, whether or not the endpoints are included.`,
          "A bound is attained exactly when the corresponding endpoint belongs to S. An excluded endpoint remains the infimum or supremum but is not a minimum or maximum.",
        ]
      : [
          "The defining inequalities have no common real solution, so S is empty. Every real number is an upper bound and a lower bound of the empty set.",
          "There is no least real upper bound: any proposed one has a smaller real upper bound. Likewise there is no greatest real lower bound. Thus the empty set has no supremum or infimum in ℝ, and has no attained extrema. It is not an unbounded set.",
        ];
  } else {
    const { left: c, start } = scene;
    const sup = fraction(c * start + 1, start);
    result.setup = [
      `The infinite real set is $S=\\{${paren(c)}+1/n:n\\in\\mathbb{N},\\;n\\ge ${start}\\}$. Here the natural denominators are positive.`,
      `Only the first ${scene.displayTerms} terms will be displayed; the set continues through every later denominator.`,
    ];
    result.answer = booleanAnswer(
      scene.orderProperty !== "minimum",
      scene.orderProperty === "minimum"
        ? "No — the infinite reciprocal set has no minimum"
        : scene.orderProperty === "maximum"
          ? "Yes — the first reciprocal term is a maximum"
          : "Yes — the infinite reciprocal set is nonempty",
    );
    result.tables = [
      {
        caption: "Finite prefix of an infinite reciprocal set",
        headers: [
          "Denominator n",
          "Exact value",
          "Attains infinite-set supremum",
          "Attains infinite-set infimum",
        ],
        rows: range(scene.displayTerms, start).map((n) => [
          String(n),
          fraction(c * n + 1, n),
          yes(n === start),
          "No",
        ]),
      },
    ];
    result.facts = [
      { label: "Nonempty", value: "Yes" },
      { label: "Infimum in ℝ", value: String(c) },
      { label: "Supremum in ℝ", value: sup },
      { label: "Minimum", value: "Does not exist" },
      { label: "Maximum", value: sup },
    ];
    result.steps = [
      `The denominators start at ${start}, so $1/n\\le1/${start}$. Hence ${sup} is an upper bound, attained at n = ${start}, and therefore it is the maximum and supremum.`,
      `Every term is strictly greater than ${c}. Given any positive ε, choose an integer n ≥ ${start} with n > 1/ε; then 0 < 1/n < ε. Thus no number greater than ${c} is a lower bound, so ${c} is the infimum.`,
      "The infimum is never attained because 1/n is positive for every finite denominator. The last visible term is the smallest displayed term, but a later denominator always gives a smaller member of the infinite set.",
    ];
  }
  result.target =
    scene.orderProperty === "minimum"
      ? "Does this set have a minimum element?"
      : scene.orderProperty === "maximum"
        ? "Does this set have a maximum element?"
        : "Is this set nonempty?";
  result.observations = [
    "Bounds describe the whole set; extrema additionally require membership. A finite list of samples does not determine the bounds of an infinite set without an argument.",
  ];
  result.reflection =
    "Why is being a bound different from being an attained extremum, and what would go wrong if you used only the displayed samples?";
  return result;
}

function evaluateInvariants(scene: LogicScene): LogicResult {
  const result = blank();
  if (scene.invariant === "parity") {
    const { start, target } = scene;
    const reachable = start % 2 === target % 2;
    const path = reachable
      ? range(Math.abs(target - start) / 2 + 1).map((i) => start + i * (target >= start ? 2 : -2))
      : [];
    result.setup = [
      `States are nonnegative integers. Start at ${start} and aim for ${target}. A move adds 2, or subtracts 2 when the current state is at least 2.`,
      "Zero moves are permitted if the target already equals the starting state.",
    ];
    result.target = "Is the target reachable by these allowed moves?";
    result.answer = booleanAnswer(
      reachable,
      reachable
        ? "Yes — the target is reachable by allowed steps of two"
        : "No — the target has a different parity and is unreachable",
    );
    result.tables = [
      {
        caption: reachable ? "Constructive allowed path" : "Parity obstruction",
        headers: reachable ? ["Move number", "State", "Parity"] : ["Role", "State", "Parity"],
        rows: reachable
          ? path.map((state, i) => [String(i), String(state), state % 2 ? "Odd" : "Even"])
          : [
              ["Start", String(start), start % 2 ? "Odd" : "Even"],
              ["Target", String(target), target % 2 ? "Odd" : "Even"],
            ],
      },
    ];
    result.facts = [
      { label: "Starting parity", value: start % 2 ? "Odd" : "Even" },
      { label: "Target parity", value: target % 2 ? "Odd" : "Even" },
      { label: "Constructive path", value: reachable ? path.join(" → ") : "No path: parities differ" },
    ];
    result.steps = [
      "Both allowed moves change a state by an even number, preserving its remainder modulo 2. Different parities therefore make the target impossible.",
      reachable
        ? `Equal parity is also sufficient here: ${target >= start ? "add" : "subtract"} 2 repeatedly along the displayed path. Every state stays between the nonnegative endpoints, so every subtraction is legal. The path uses ${path.length - 1} moves.`
        : "Preservation alone is normally only a necessary condition. In this specific system, matching parity is sufficient because a monotone path of steps of two stays between the endpoints.",
    ];
  } else {
    const n = scene.graphSize;
    const edges = range(n).flatMap((i) => [i + 1, i + 2].filter((j) => j < n).map((j) => [i, j] as const));
    if (scene.wrap === "yes" && n > 0) edges.push([n - 1, 0]);
    const cycle = scene.wrap === "yes" && n > 0;
    const witness = cycle ? [...range(n), 0] : [];
    result.setup = [
      `The vertices are ${setText(range(n))}. Include edges i → i + 1 and i → i + 2 whenever both endpoints are vertices.`,
      scene.wrap === "yes"
        ? "Also add the edge from the last vertex to 0 when a last vertex exists. For one vertex this is a self-loop; for no vertices no edge is added."
        : "No wraparound edge is added. Consider the vertex number as a potential along a directed walk.",
    ];
    result.target = "Does this directed graph contain a directed cycle?";
    result.answer = booleanAnswer(
      cycle,
      cycle ? "Yes — this directed graph has a cycle" : "No — this directed graph has no cycle",
    );
    result.tables = [
      {
        caption: "Complete directed edge list",
        headers: ["From", "To", "Change in vertex potential", "Strictly increases"],
        rows: edges.map(([i, j]) => [String(i), String(j), String(j - i), yes(j > i)]),
      },
    ];
    result.facts = [
      { label: "Vertices", value: String(n) },
      { label: "Edges", value: String(edges.length) },
      { label: "Cycle witness", value: cycle ? witness.join(" → ") : "None" },
    ];
    result.steps = cycle
      ? [
          `The path ${witness.join(" → ")} is a cycle: each consecutive increase by one is an edge, and the wraparound edge returns to 0. For one vertex the wrap itself is a self-cycle.`,
          "The wrap edge fails strict increase of the vertex potential. The cycle witness, rather than that failure alone, establishes a cycle.",
        ]
      : [
          n === 0
            ? "The empty graph has no edges or directed cycle. Asking to add a wrap edge creates nothing because there is no last vertex."
            : "Every edge strictly increases the integer vertex number. A directed cycle would return to its starting number while strictly increasing it, a contradiction.",
          n === 0
            ? "There is no vertex to choose for an extremal argument in the empty graph."
            : `Equivalently, choose the largest-numbered vertex on a hypothetical cycle. Its outgoing cycle edge would have to lead to a still larger vertex on the same cycle, a contradiction. In the whole graph, the greatest vertex ${n - 1} has no outgoing edge and is a sink.`,
          "On this finite bounded vertex set, strictly increasing walks also have bounded length. This potential argument uses every allowed edge, rather than a finite sample of walks.",
        ];
  }
  result.observations = [
    "An invariant can obstruct a construction. Sufficiency needs a construction or a separate argument; failure of an invariant-based obstruction alone does not prove reachability or a cycle.",
  ];
  result.reflection =
    "Which quantity is preserved or forced to increase, and what additional construction makes your conclusion sufficient?";
  return result;
}

function prime(n: number): boolean {
  if (n < 2) return false;
  for (let divisor = 2; divisor * divisor <= n; divisor++) if (n % divisor === 0) return false;
  return true;
}

function evaluateCounterexamples(scene: LogicScene): LogicResult {
  const result = blank();
  const limit = scene.searchLimit;
  const family = scene.counterexample;
  const indices = family === "odd-sum" ? range(limit, 1) : range(limit + 1);
  result.target = "Does the displayed finite prefix contain a counterexample to the claim?";
  if (family === "prime-quadratic") {
    const k = scene.primeOffset;
    const rows = indices.map((n) => ({ n, value: n * n + n + k, holds: prime(n * n + n + k) }));
    const first = rows.find((row) => !row.holds);
    result.setup = [
      `The claim is: $n^2+n+${k}$ is prime for every integer $n\\ge0$.`,
      `The displayed search checks exactly n = 0 through ${limit}, including both endpoints. A prime is an integer greater than 1 with no positive divisors other than 1 and itself.`,
    ];
    result.answer = booleanAnswer(
      first !== undefined,
      first === undefined
        ? "No counterexample in the displayed prefix"
        : "A counterexample occurs in the displayed prefix",
    );
    result.tables = [
      {
        caption: "Displayed nonnegative prefix",
        headers: ["n", "n² + n + k", "Prime", "Counterexample in prefix"],
        rows: rows.map((row) => [String(row.n), String(row.value), yes(row.holds), yes(!row.holds)]),
      },
    ];
    result.facts = [
      { label: "Values checked", value: String(rows.length) },
      {
        label: "First failure in displayed prefix",
        value: first === undefined ? "None" : `n = ${first.n}, value = ${first.value}`,
      },
      { label: "Guaranteed counterexample to the universal claim", value: `n = ${k - 1}, value = ${k * k}` },
    ];
    result.steps = [
      first === undefined
        ? "No checked value is composite. This only describes the displayed prefix, and does not prove the universal claim."
        : `The first failure in the displayed prefix occurs at n = ${first.n}, yielding the composite integer ${first.value}. One failure suffices to refute the universal claim.`,
      `Independently of the search, take $n=k-1=${k - 1}$. Then $(k-1)^2+(k-1)+k=k^2=${k * k}$, which is composite since $k=${k}\\ge2$. This counterexample ${k - 1 > limit ? "lies outside" : "lies inside"} the displayed prefix; earlier failures can also occur.`,
    ];
  } else if (family === "integer-implication") {
    result.setup = [
      "The claim is $\\forall n\\in\\mathbb{Z}: (n^2\\ge n\\Rightarrow n\\ge0)$.",
      `The displayed search checks only the nonnegative integers 0 through ${limit}. An implication fails when its premise is true and its conclusion is false.`,
    ];
    result.answer = booleanAnswer(false, "No counterexample in the displayed nonnegative prefix");
    result.tables = [
      {
        caption: "Displayed nonnegative prefix",
        headers: ["n", "n² ≥ n", "n ≥ 0", "Implication", "Counterexample in prefix"],
        rows: indices.map((n) => [
          String(n),
          yes(n * n >= n),
          yes(n >= 0),
          truth(!(n * n >= n) || n >= 0),
          "No",
        ]),
      },
    ];
    result.facts = [
      { label: "Values checked", value: String(indices.length) },
      { label: "First failure in displayed prefix", value: "None" },
      {
        label: "Outside-domain-of-search counterexample",
        value: "n = −1: 1 ≥ −1 is true, but −1 ≥ 0 is false",
      },
    ];
    result.steps = [
      "Every displayed value is nonnegative, so the conclusion holds and no displayed value refutes the implication.",
      "The universal domain is all integers, not just the search domain. At n = −1 the premise holds but the conclusion fails. Therefore the universal claim is false even though every displayed test passes.",
    ];
  } else {
    result.setup = [
      "The claim is $1+3+\\cdots+(2n-1)=n^2$ for every integer $n\\ge1$.",
      limit === 0
        ? "The displayed prefix has no checked indices: its requested last index is 0, below the domain's first index 1."
        : `The displayed search checks exactly n = 1 through ${limit}.`,
    ];
    result.answer = booleanAnswer(false, "No counterexample in the displayed positive prefix");
    result.tables = [
      {
        caption: "Displayed positive prefix",
        headers: ["n", "Sum of first n odd numbers", "n²", "Counterexample in prefix"],
        rows: indices.map((n) => [
          String(n),
          String(range(n, 1).reduce((sum, i) => sum + 2 * i - 1, 0)),
          String(n * n),
          "No",
        ]),
      },
    ];
    result.facts = [
      { label: "Values checked", value: String(indices.length) },
      { label: "First failure in displayed prefix", value: "None" },
      { label: "Universal claim", value: "True by induction, not by these finite checks" },
    ];
    result.steps = [
      "There is no failure among the displayed checks, including when there are no checks at all. That finite observation alone is not a proof of the universal identity.",
      "An actual proof uses the base 1 = 1². If the sum through the k-th odd number is k², adding the next odd number gives $k^2+(2k+1)=(k+1)^2$. Induction proves the identity for every positive integer n.",
    ];
  }
  result.observations = [
    "The prediction concerns only whether this displayed prefix finds a failure. A universal claim requires a proof or a counterexample in its full advertised domain.",
  ];
  result.reflection =
    "What is the domain of the claim, what was actually searched, and which analytic argument or witness settles the universal statement?";
  return result;
}

export function evaluateLogic(mode: LogicMode, scene: LogicScene): LogicResult {
  const error = validate(mode, scene);
  if (error) return blank(error);
  switch (mode) {
    case "truth":
      return evaluateTruth(scene);
    case "quantifiers":
      return evaluateQuantifiers(scene);
    case "proof":
      return evaluateProof(scene);
    case "induction":
      return evaluateInduction(scene);
    case "sets":
      return evaluateSets(scene);
    case "diagonal":
      return evaluateDiagonal(scene);
    case "order":
      return evaluateOrder(scene);
    case "invariants":
      return evaluateInvariants(scene);
    case "counterexamples":
      return evaluateCounterexamples(scene);
  }
}

function preset(
  mode: LogicMode,
  id: string,
  label: string,
  description: string,
  patch: Partial<LogicScene>,
): LogicPreset {
  const scene = { ...defaultLogicScene(mode), ...patch };
  scene.words = [...scene.words];
  scene.proofOrder = [...scene.proofOrder];
  return { id, label, description, mode, scene };
}

export const LOGIC_PRESETS: readonly LogicPreset[] = [
  preset("truth", "converse", "Reversing an implication", "Compare an implication with its converse.", {
    truthPair: "converse",
  }),
  preset("truth", "contrapositive", "Negate and reverse", "Compare an implication with its contrapositive.", {
    truthPair: "contrapositive",
  }),
  preset("truth", "demorgan", "Negating a conjunction", "Check both columns on every truth assignment.", {
    truthPair: "demorgan",
  }),
  preset("truth", "distributivity", "Three independent propositions", "Use all eight Boolean assignments.", {
    truthPair: "distributivity",
  }),
  preset("truth", "xor", "One or both?", "Distinguish inclusive from exclusive or.", { truthPair: "xor" }),
  preset(
    "quantifiers",
    "dependent-witness",
    "A witness may depend on x",
    "Check equality with a separate witness for each x.",
    { quantifier: "forall-exists", predicate: "equal" },
  ),
  preset(
    "quantifiers",
    "one-witness",
    "One x for every y",
    "Change the order while keeping the same equality relation.",
    { quantifier: "exists-forall", predicate: "equal" },
  ),
  preset(
    "quantifiers",
    "empty-inner",
    "An empty inner domain",
    "Inspect a universal inner assertion with no y values.",
    { quantifier: "exists-forall", xSize: 2, ySize: 0 },
  ),
  preset(
    "quantifiers",
    "empty-outer",
    "An empty outer domain",
    "Inspect an outer universal assertion with no x values.",
    { quantifier: "forall-exists", xSize: 0, ySize: 3 },
  ),
  preset(
    "quantifiers",
    "sum-bound",
    "A bounded sum relation",
    "Use a non-strict predicate and negate it carefully.",
    { predicate: "sum-at-most", threshold: 3, quantifier: "forall-forall" },
  ),
  preset(
    "proof",
    "even-order-gap",
    "A rewrite before its premises",
    "Find an unjustified use in a direct proof.",
    {},
  ),
  preset(
    "proof",
    "even-valid-order",
    "Interchange independent branches",
    "Try another dependency-respecting order.",
    { proofOrder: ["assume-even", "write-b", "write-a", "integer", "rewrite", "conclude"] },
  ),
  preset("proof", "square-contra", "Reason by contraposition", "An odd root gives an odd square.", {
    proof: "square-parity",
    proofOrder: ["contra", "odd", "integer", "expand", "odd-square", "conclude"],
  }),
  preset(
    "proof",
    "successor-contradiction",
    "A larger integer",
    "Supply both facts required for the contradiction.",
    { proof: "no-largest-integer", proofOrder: [...LOGIC_PROOFS["no-largest-integer"].defaultOrder] },
  ),
  preset(
    "induction",
    "odd-base-one",
    "The intended first base",
    "Separate a general step from finite checks.",
    { induction: "odd-sum", baseIndex: 1 },
  ),
  preset(
    "induction",
    "odd-late-base",
    "A true claim, incomplete coverage",
    "Start a valid step later in the domain.",
    { induction: "odd-sum", baseIndex: 3 },
  ),
  preset(
    "induction",
    "shifted-base",
    "A base beyond a counterexample",
    "Check the advertised claim's starting index.",
    { induction: "shifted-base", baseIndex: 2 },
  ),
  preset(
    "induction",
    "false-step",
    "A true base with missing algebra",
    "Inspect the expansion in the proposed step.",
    { induction: "false-step" },
  ),
  preset(
    "sets",
    "fibers",
    "An image can collect whole fibers",
    "Compare A with the inverse image of its image.",
    { domainSize: 6, modulus: 3, shift: -1, cut: 2, property: "preimage-equality" },
  ),
  preset("sets", "empty-domain", "An empty domain", "Distinguish injectivity and covering the codomain.", {
    domainSize: 0,
    property: "injective",
  }),
  preset(
    "sets",
    "modular-bijection",
    "A shifted complete residue system",
    "Use a negative shift with nonnegative remainders.",
    { domainSize: 3, modulus: 3, shift: -2, property: "bijective" },
  ),
  preset(
    "sets",
    "missing-output",
    "A target outside the range",
    "Compare B with the image of its inverse image.",
    { domainSize: 2, modulus: 4, shift: 0, target: 3, property: "image-equality" },
  ),
  preset(
    "diagonal",
    "three-rows",
    "Flip three diagonal bits",
    "Exclude each row at a different position.",
    {},
  ),
  preset("diagonal", "one-row", "A one-bit construction", "The finite rule already works for a single row.", {
    wordSize: 1,
    words: ["0"],
  }),
  preset(
    "diagonal",
    "repeated-rows",
    "Repeated rows are permitted",
    "Every row still differs in its indexed bit.",
    { words: ["000", "000", "000"] },
  ),
  preset("order", "open-infimum", "A bound that is not attained", "Inspect the open left endpoint.", {
    orderProperty: "minimum",
  }),
  preset("order", "closed-maximum", "A closed upper endpoint", "Inspect the right endpoint separately.", {
    orderProperty: "maximum",
  }),
  preset("order", "singleton", "Coincident included endpoints", "A real interval can consist of one point.", {
    left: 2,
    right: 2,
    leftEnd: "closed",
    rightEnd: "closed",
    orderProperty: "nonempty",
  }),
  preset(
    "order",
    "reversed",
    "Reversed endpoint inequalities",
    "Use the definition even when no point can satisfy it.",
    { left: 3, right: -1, orderProperty: "nonempty" },
  ),
  preset(
    "order",
    "reciprocal",
    "An infinite tail after the display",
    "Distinguish the smallest displayed term from a minimum of the entire set.",
    { orderFamily: "reciprocal", left: -1, start: 2, orderProperty: "minimum" },
  ),
  preset(
    "invariants",
    "even-path",
    "A constructive steps-of-two path",
    "Check both preservation and sufficiency.",
    { start: 0, target: 6 },
  ),
  preset("invariants", "parity-obstruction", "Different parities", "An invariant can rule out a target.", {
    start: 1,
    target: 6,
  }),
  preset(
    "invariants",
    "increasing-graph",
    "An increasing potential",
    "Every edge must satisfy the proposed order property.",
    { invariant: "graph", graphSize: 4, wrap: "no" },
  ),
  preset(
    "invariants",
    "wrap-cycle",
    "Close a path with one edge",
    "Distinguish failure of an obstruction from an explicit cycle.",
    { invariant: "graph", graphSize: 4, wrap: "yes" },
  ),
  preset(
    "invariants",
    "empty-graph",
    "No last vertex exists",
    "An optional wrap edge needs an actual vertex.",
    { invariant: "graph", graphSize: 0, wrap: "yes" },
  ),
  preset(
    "counterexamples",
    "prime-before-failure",
    "A long successful prefix",
    "Keep the finite search distinct from the universal claim.",
    { primeOffset: 41, searchLimit: 39 },
  ),
  preset(
    "counterexamples",
    "prime-at-failure",
    "Extend the prefix by one",
    "Check the next value of the same polynomial.",
    { primeOffset: 41, searchLimit: 40 },
  ),
  preset(
    "counterexamples",
    "integer-outside-search",
    "A domain wider than the search",
    "The advertised integer domain includes negative values.",
    { counterexample: "integer-implication", searchLimit: 8 },
  ),
  preset(
    "counterexamples",
    "odd-identity",
    "Checks and a separate proof",
    "An analytic induction argument is stronger than a prefix.",
    { counterexample: "odd-sum", searchLimit: 12 },
  ),
];
