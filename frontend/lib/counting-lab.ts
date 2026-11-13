import {
  COUNTING_FIELDS,
  COUNTING_MODES,
  type CountingGroup,
  type CountingListing,
  type CountingMode,
  type CountingPreset,
  type CountingResult,
  type CountingScene,
} from "@/lib/counting-lab-types";

export const COUNTING_LIST_LIMIT = 40;

/** These bounded factorials are exact safe integers, including 0! = 1. */
export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 18) throw new RangeError("Use an integer from 0 to 18.");
  let result = 1;
  for (let factor = 2; factor <= n; factor += 1) result *= factor;
  return result;
}

export function binomial(n: number, r: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 18 || !Number.isInteger(r))
    throw new RangeError("Use bounded integer binomial arguments.");
  if (r < 0 || r > n) return 0;
  return factorial(n) / (factorial(r) * factorial(n - r));
}

function orderedCount(n: number, r: number) {
  return r > n ? 0 : factorial(n) / factorial(n - r);
}
function wordCount(a: number, b: number, c: number) {
  return factorial(a + b + c) / (factorial(a) * factorial(b) * factorial(c));
}
function allocationCount(n: number, k: number, minimum: number) {
  if (k === 0) return n === 0 ? 1 : 0;
  const residual = n - k * minimum;
  return residual < 0 ? 0 : binomial(residual + k - 1, k - 1);
}
function take<T>(iterator: Iterable<T>): T[] {
  const result: T[] = [];
  for (const item of iterator) {
    result.push(item);
    if (result.length === COUNTING_LIST_LIMIT) break;
  }
  return result;
}
function listing<T>(
  title: string,
  total: number,
  examples: readonly T[],
  format: (value: T) => string,
): CountingListing {
  return { title, total, items: examples.map(format), complete: examples.length === total, kind: "outcomes" };
}
function blank(error: string): CountingResult {
  return {
    count: null,
    steps: [],
    facts: [],
    observations: [],
    groups: [],
    groupCaption: "",
    listing: null,
    error,
  };
}
function validate(mode: CountingMode, scene: CountingScene): string | null {
  if (!(COUNTING_MODES as readonly string[]).includes(mode))
    return "Choose one of the six counting experiments.";
  if (!scene || typeof scene !== "object") return "Enter a valid counting scene.";
  for (const field of COUNTING_FIELDS[mode]) {
    const value = scene[field.key];
    if (!Number.isInteger(value) || value < field.min || value > field.max)
      return `${field.label} must be a whole number from ${field.min} to ${field.max}.`;
  }
  if (mode === "rules" && scene.rule !== "sum" && scene.rule !== "product")
    return "Choose the sum or product rule.";
  if (mode === "selection" && scene.selection !== "ordered" && scene.selection !== "unordered")
    return "Choose ordered or unordered selection.";
  return null;
}

function* ruleExamples(a: number, b: number, rule: CountingScene["rule"]) {
  if (rule === "sum") {
    for (let i = 1; i <= a; i += 1) yield `A${i}`;
    for (let j = 1; j <= b; j += 1) yield `B${j}`;
  } else {
    for (let i = 1; i <= a; i += 1) for (let j = 1; j <= b; j += 1) yield `(A${i}, B${j})`;
  }
}
function rules(scene: CountingScene): CountingResult {
  const { a, b, rule } = scene;
  const count = rule === "sum" ? a + b : a * b;
  const examples = take(ruleExamples(a, b, rule));
  const groups: CountingGroup[] =
    rule === "sum"
      ? [
          { label: "A alternatives", total: a, items: examples.filter((item) => item.startsWith("A")) },
          { label: "B alternatives", total: b, items: examples.filter((item) => item.startsWith("B")) },
        ]
      : Array.from({ length: a }, (_, index) => ({
          label: `First choice A${index + 1}`,
          total: b,
          items: examples.filter((item) => item.startsWith(`(A${index + 1}, `)),
        }));
  return {
    count,
    error: null,
    steps:
      rule === "sum"
        ? [
            "Choose one A-labelled alternative or one B-labelled alternative. The branch label is part of the outcome.",
            `$|A|+|B|=${a}+${b}=${count}$.`,
          ]
        : [
            `First choose one of ${a} A tokens, then one of ${b} B tokens; record the ordered pair.`,
            `$|A|\\cdot|B|=${a}\\cdot ${b}=${count}$.`,
          ],
    facts: [
      { label: "A choices", value: String(a) },
      { label: "B choices", value: String(b) },
      {
        label: "Selected rule",
        value: rule === "sum" ? "Disjoint alternatives add" : "Successive choices multiply",
      },
    ],
    observations: [
      rule === "sum"
        ? "A1 and B1 are different alternatives because the branch labels differ; no overlap is counted twice."
        : "The first and second positions have different roles. Each first-stage choice permits exactly the same B choices.",
      rule === "product" && (a === 0 || b === 0)
        ? "An empty required stage makes every full two-stage outcome impossible."
        : rule === "sum" && (a === 0 || b === 0)
          ? "An empty alternative contributes zero; the other branch still contributes its choices."
          : "These are outcome counts. A probability would additionally require an explicitly specified sampling model.",
    ],
    groups,
    groupCaption:
      rule === "sum"
        ? "The two groups are disjoint alternatives. Group totals count outcomes and add to the displayed count."
        : "Each group fixes the A choice. Its total counts the B completions; group totals add to the number of ordered pairs.",
    listing: listing(
      rule === "sum" ? "Labelled alternatives" : "Ordered two-stage outcomes",
      count,
      examples,
      String,
    ),
  };
}

function* orderedSelections(n: number, r: number, prefix: number[] = []): Generator<number[]> {
  if (r > n) return;
  if (prefix.length === r) {
    yield prefix;
    return;
  }
  for (let token = 1; token <= n; token += 1)
    if (!prefix.includes(token)) yield* orderedSelections(n, r, [...prefix, token]);
}
function* unorderedSelections(n: number, r: number, next = 1, prefix: number[] = []): Generator<number[]> {
  if (r > n) return;
  if (prefix.length === r) {
    yield prefix;
    return;
  }
  for (let token = next; token <= n - (r - prefix.length) + 1; token += 1)
    yield* unorderedSelections(n, r, token + 1, [...prefix, token]);
}
function selection(scene: CountingScene): CountingResult {
  const { n, r } = scene,
    ordered = scene.selection === "ordered";
  const count = ordered ? orderedCount(n, r) : binomial(n, r);
  const examples = take(ordered ? orderedSelections(n, r) : unorderedSelections(n, r));
  const format = (values: number[]) =>
    !values.length
      ? ordered
        ? "(empty ordered selection)"
        : "(empty subset)"
      : ordered
        ? `(${values.join(", ")})`
        : `{${values.join(", ")}}`;
  const groups: CountingGroup[] =
    r === 0
      ? [{ label: "The empty selection", total: 1, items: examples.map(format) }]
      : r > n
        ? []
        : Array.from({ length: n }, (_, index) => index + 1).flatMap((token) => {
            const total = ordered ? orderedCount(n - 1, r - 1) : binomial(token - 1, r - 1);
            return total === 0
              ? []
              : [
                  {
                    label: ordered ? `First token ${token}` : `Largest token ${token}`,
                    total,
                    items: examples
                      .filter((values) => (ordered ? values[0] : values.at(-1)) === token)
                      .map(format),
                  },
                ];
          });
  return {
    count,
    error: null,
    steps:
      r > n
        ? [
            "A selection without replacement cannot contain more distinct tokens than are available.",
            `$r=${r}>${n}=n$, so the count is $0$.`,
          ]
        : r === 0
          ? [
              "There is exactly one way to choose no tokens: the empty selection.",
              "$0!=1$, so the ordered and unordered formulas both give $1$.",
            ]
          : [
              `The tokens are the distinct labels 1 through ${n}, and no token is repeated.`,
              ordered
                ? `$P(${n},${r})=${n}!/(${n}-${r})!=${count}$.`
                : `$C(${n},${r})=${n}!/(${r}!(${n}-${r})!)=${count}$.`,
              ordered
                ? "Swapping two selected positions changes the ordered outcome."
                : `Each subset has exactly ${r}! internal orders, so dividing the ordered count by this common multiplicity removes order.`,
            ],
    facts: [
      { label: "Ordering convention", value: ordered ? "Ordered positions" : "Unordered subset" },
      { label: "Ordered count", value: String(orderedCount(n, r)) },
      { label: "Unordered count", value: String(binomial(n, r)) },
      {
        label: "Internal orders per feasible subset",
        value: r <= n ? String(factorial(r)) : "No feasible subsets",
      },
    ],
    observations: [
      "Token labels, rather than digit representations, determine the objects. There is no leading-digit restriction in this experiment.",
      r > n
        ? "A zero count means no feasible selections."
        : r === 0
          ? "The empty selection is one object, even when no tokens are available."
          : "A bounded listing can show only a prefix; it does not replace the exact count.",
    ],
    groups,
    groupCaption:
      r === 0
        ? "There is one group containing the single empty selection; no first or largest token is needed."
        : ordered
          ? "Groups fix the first token. Group totals count ordered selections; example members come from the first 40 listed selections."
          : "Each nonempty subset has a unique largest token, which defines its group. Group totals count subsets; only listed examples are shown as members.",
    listing: listing(ordered ? "Ordered selections" : "Unordered subsets", count, examples, format),
  };
}

function* multisetWords(counts: readonly number[], prefix = ""): Generator<string> {
  if (counts.every((count) => count === 0)) {
    yield prefix;
    return;
  }
  for (let index = 0; index < 3; index += 1)
    if (counts[index]! > 0) {
      const remaining = [...counts];
      remaining[index]!--;
      yield* multisetWords(remaining, prefix + "ABC"[index]);
    }
}
function multinomial(scene: CountingScene): CountingResult {
  const { a, b, c } = scene,
    n = a + b + c;
  const count = wordCount(a, b, c),
    examples = take(multisetWords([a, b, c]));
  const format = (word: string) => word || "(empty word)";
  const groups: CountingGroup[] =
    n === 0
      ? [{ label: "The empty word", total: 1, items: ["(empty word)"] }]
      : [a, b, c].flatMap((copies, index) => {
          if (copies === 0) return [];
          const remaining = [a, b, c];
          remaining[index]!--;
          return [
            {
              label: `First symbol ${"ABC"[index]}`,
              total: wordCount(remaining[0]!, remaining[1]!, remaining[2]!),
              items: examples.filter((word) => word[0] === "ABC"[index]).map(format),
            },
          ];
        });
  return {
    count,
    error: null,
    steps: [
      `There are ${n} positions, with prescribed counts A:${a}, B:${b}, C:${c}.`,
      `$M=${n}!/(${a}!${b}!${c}!)=${count}$.`,
      "Permuting copies of the same symbol does not change the word; divide out those internal permutations.",
    ],
    facts: [
      { label: "Positions", value: String(n) },
      { label: "Copies of A / B / C", value: `${a} / ${b} / ${c}` },
      { label: "All positions distinct before removing repetition", value: String(factorial(n)) },
    ],
    observations: [
      n === 0
        ? "All counts are zero. There is one empty word, consistent with 0! = 1."
        : "Every listed word has exactly the prescribed counts; identical copies are never assigned separate identities.",
      "The factorial quotient counts arrangements of labelled positions, not unlabeled collections of interchangeable teams.",
    ],
    groups,
    groupCaption:
      n === 0
        ? "There is one group containing the single empty word, which has no first symbol."
        : "Nonempty words are partitioned by their first symbol. Group totals are exact; example members are drawn only from the first 40 listed words.",
    listing: listing("Distinct repeated-symbol words", count, examples, format),
  };
}

function* allocations(n: number, k: number, minimum: number, prefix: number[] = []): Generator<number[]> {
  if (n < k * minimum) return;
  if (k === 1) {
    yield [...prefix, n];
    return;
  }
  for (let first = minimum; first <= n - (k - 1) * minimum; first += 1)
    yield* allocations(n - first, k - 1, minimum, [...prefix, first]);
}
function allocation(scene: CountingScene): CountingResult {
  const { n, k, minimum } = scene,
    residual = n - k * minimum;
  const count = allocationCount(n, k, minimum),
    examples = take(allocations(n, k, minimum));
  const format = (values: number[]) => `(${values.join(", ")})`;
  const groups: CountingGroup[] = [];
  if (count > 0)
    for (let first = minimum; first <= n - (k - 1) * minimum; first += 1) {
      const total = allocationCount(n - first, k - 1, minimum);
      if (total > 0)
        groups.push({
          label: `Box 1 receives ${first}`,
          total,
          items: examples.filter((values) => values[0] === first).map(format),
        });
    }
  return {
    count,
    error: null,
    steps: [
      `Reserve ${minimum} objects for each of the ${k} labelled boxes.`,
      `$R=${n}-${k}(${minimum})=${residual}$.`,
      residual < 0
        ? "The reserved minimum exceeds the available total, so no allocation is feasible."
        : `$C(R+k-1,k-1)=C(${residual + k - 1},${k - 1})=${count}$.`,
    ],
    facts: [
      { label: "Objects", value: String(n) },
      { label: "Labelled boxes", value: String(k) },
      { label: "Reserved minimum total", value: String(k * minimum) },
      { label: "Residual after reserving minima", value: String(residual) },
    ],
    observations: [
      "A tuple gives each box's allocation in label order. Identical objects do not receive separate labels.",
      residual < 0
        ? "A negative residual gives count zero; no negative factorial is evaluated."
        : n === 0
          ? "The all-zero tuple is one feasible allocation when every minimum is zero."
          : "Subtracting the common minimum gives a bijection with nonnegative allocations of the residual.",
      "Empty boxes are allowed exactly when the selected minimum is zero.",
    ],
    groups,
    groupCaption:
      "Groups fix the number in labelled box 1. Their totals count complete allocations and add to the answer; sample tuples are limited to the first 40 overall.",
    listing: listing("Allocations in labelled box order", count, examples, format),
  };
}

function inclusion(scene: CountingScene): CountingResult {
  const universe = Array.from({ length: scene.n }, (_, index) => index + 1);
  const memberships = universe.map((value) => ({
    value,
    mask: (value % scene.a === 0 ? 1 : 0) | (value % scene.b === 0 ? 2 : 0) | (value % scene.c === 0 ? 4 : 0),
  }));
  const size = (mask: number) => memberships.filter((item) => (item.mask & mask) === mask).length;
  const A = size(1),
    B = size(2),
    C = size(4),
    AB = size(3),
    AC = size(5),
    BC = size(6),
    ABC = size(7);
  const members = memberships.filter((item) => item.mask !== 0).map((item) => item.value);
  const count = members.length;
  const labels = [
    "Outside A, B and C",
    "A only",
    "B only",
    "A and B only",
    "C only",
    "A and C only",
    "B and C only",
    "A, B and C",
  ];
  const groups = labels.map((label, mask) => {
    const values = memberships.filter((item) => item.mask === mask).map((item) => String(item.value));
    return { label, total: values.length, items: values, included: mask !== 0 };
  });
  return {
    count,
    error: null,
    steps: [
      scene.n === 0
        ? "The universe is the empty set $\\varnothing$. All three sets and all their intersections are empty."
        : `The universe is the integers 1 through ${scene.n}; A, B and C contain the multiples of ${scene.a}, ${scene.b} and ${scene.c}, respectively.`,
      "$|A\\cup B\\cup C|=|A|+|B|+|C|-|A\\cap B|-|A\\cap C|-|B\\cap C|+|A\\cap B\\cap C|$.",
      `$${A}+${B}+${C}-${AB}-${AC}-${BC}+${ABC}=${count}$.`,
    ],
    facts: [
      { label: "Universe size", value: String(scene.n) },
      { label: "A / B / C sizes", value: `${A} / ${B} / ${C}` },
      { label: "A and B / A and C / B and C", value: `${AB} / ${AC} / ${BC}` },
      { label: "Triple intersection", value: String(ABC) },
      { label: "Outside the union", value: String(scene.n - count) },
    ],
    observations: [
      "Pairwise intersections include members of all three sets. Adding the triple intersection restores their final multiplicity to one.",
      "The disjoint membership groups partition the entire universe, including the outside group. Only the seven included groups contribute to the union.",
      scene.n === 0
        ? "The empty universe has no elements in any region; every count is zero."
        : "Repeated divisors and shared factors are allowed. Actual finite memberships determine every intersection without assuming the sets are disjoint.",
    ],
    groups,
    groupCaption:
      "Group totals count universe elements in disjoint membership regions. The outside group is excluded from the union; all eight groups together contain the whole universe.",
    listing: listing("Elements in at least one of A, B and C", count, members, String),
  };
}

function pigeonhole(scene: CountingScene): CountingResult {
  const { n, k } = scene,
    base = Math.floor(n / k),
    extra = n % k,
    count = Math.ceil(n / k);
  const occupancies = Array.from({ length: k }, (_, index) => base + (index < extra ? 1 : 0));
  let nextObject = 1;
  const groups = occupancies.map((total, index) => {
    const items = Array.from({ length: total }, () => `Object ${nextObject++}`);
    return { label: `Box ${index + 1}`, total, items };
  });
  const witness = `(${occupancies.join(", ")})`;
  return {
    count,
    error: null,
    steps:
      n === 0
        ? [
            "With no objects, every one of the labelled boxes has occupancy zero.",
            "The largest occupancy is zero, so its smallest possible value is zero as well.",
          ]
        : [
            `$q=\\lceil ${n}/${k}\\rceil=${count}$.`,
            `If all ${k} boxes held at most ${count - 1} objects, their capacity would be ${k * (count - 1)}, less than ${n}. Some box therefore holds at least ${count}.`,
            `Give ${extra} boxes ${base + 1} objects and the remaining ${k - extra} boxes ${base} objects. The witness ${witness} has total ${n} and largest occupancy ${count}.`,
            `This construction shows that occupancy ${count + 1} is not forced.`,
          ],
    facts: [
      { label: "Objects", value: String(n) },
      { label: "Labelled boxes", value: String(k) },
      { label: "Objects initially placed in every box", value: String(base) },
      { label: "Boxes receiving one extra object", value: String(extra) },
      { label: "Largest occupancy of the witness", value: String(count) },
    ],
    observations: [
      n === 0
        ? "No positive occupancy or collision is forced by an empty collection of objects."
        : "The guarantee concerns at least one box. It does not identify which box must be largest.",
      "The balanced assignment proves sharpness. A less balanced assignment can have a larger maximum without increasing the universal guarantee.",
    ],
    groups,
    groupCaption: `Bars show the ${n} objects in one balanced witness. They add to ${n}; the answer is the largest box occupancy, ${count}. The bars do not enumerate all assignments.`,
    listing: {
      title: "One balanced sharpness witness in box order",
      items: [witness],
      total: 1,
      complete: true,
      kind: "witness",
    },
  };
}

export function evaluateCounting(mode: CountingMode, scene: CountingScene): CountingResult {
  const error = validate(mode, scene);
  if (error) return blank(error);
  switch (mode) {
    case "rules":
      return rules(scene);
    case "selection":
      return selection(scene);
    case "multinomial":
      return multinomial(scene);
    case "allocations":
      return allocation(scene);
    case "inclusion":
      return inclusion(scene);
    case "pigeonhole":
      return pigeonhole(scene);
  }
}

const BASE: CountingScene = {
  a: 3,
  b: 2,
  c: 1,
  n: 5,
  k: 3,
  r: 3,
  minimum: 0,
  rule: "sum",
  selection: "ordered",
};
function preset(
  id: string,
  label: string,
  description: string,
  mode: CountingMode,
  scene: Partial<CountingScene>,
): CountingPreset {
  return { id, label, description, mode, scene: { ...BASE, ...scene } };
}
export const COUNTING_PRESETS: readonly CountingPreset[] = [
  preset(
    "successive-choices",
    "Two successive choices",
    "Four A choices and two B choices make ordered two-stage outcomes.",
    "rules",
    { a: 4, b: 2, rule: "product" },
  ),
  preset(
    "disjoint-branches",
    "Choose one labelled branch",
    "Two A alternatives and five B alternatives stay disjoint because their labels differ.",
    "rules",
    { a: 2, b: 5, rule: "sum" },
  ),
  preset(
    "empty-stage",
    "An empty required stage",
    "The second stage has choices, but the first stage has none.",
    "rules",
    { a: 0, b: 4, rule: "product" },
  ),
  preset(
    "ordered-tokens",
    "Three roles from five tokens",
    "Different positions give different ordered selections without replacement.",
    "selection",
    { n: 5, r: 3, selection: "ordered" },
  ),
  preset(
    "unordered-tokens",
    "Three tokens without order",
    "Group all internal orders of the same subset together.",
    "selection",
    { n: 5, r: 3, selection: "unordered" },
  ),
  preset(
    "empty-selection",
    "The empty selection",
    "Choosing zero tokens gives one outcome even when the available set is empty.",
    "selection",
    { n: 0, r: 0, selection: "unordered" },
  ),
  preset(
    "repeated-letters",
    "Arrange AAABCC",
    "A, B and C are different symbols; copies of the same symbol are indistinguishable.",
    "multinomial",
    { a: 3, b: 1, c: 2 },
  ),
  preset(
    "many-repeated-letters",
    "Many words, a short listing",
    "Four copies of each symbol demonstrate why the listing is only a prefix.",
    "multinomial",
    { a: 4, b: 4, c: 4 },
  ),
  preset(
    "empty-word",
    "One empty word",
    "Zero copies of all three symbols form exactly one empty arrangement.",
    "multinomial",
    { a: 0, b: 0, c: 0 },
  ),
  preset(
    "empty-boxes-allowed",
    "Five objects, three labelled boxes",
    "Allow boxes to be empty while keeping the total fixed.",
    "allocations",
    { n: 5, k: 3, minimum: 0 },
  ),
  preset(
    "positive-boxes",
    "Reserve one object per box",
    "The same total gives fewer allocations when every box must be nonempty.",
    "allocations",
    { n: 5, k: 3, minimum: 1 },
  ),
  preset(
    "infeasible-minima",
    "Minima exceed the supply",
    "Three minima of two require more than five objects.",
    "allocations",
    { n: 5, k: 3, minimum: 2 },
  ),
  preset(
    "three-overlapping-sets",
    "Three divisibility filters",
    "Count actual overlapping memberships in a finite universe.",
    "inclusion",
    { n: 30, a: 2, b: 3, c: 7 },
  ),
  preset(
    "coincident-sets",
    "All three sets coincide",
    "Repeated divisors still require the full inclusion-exclusion correction.",
    "inclusion",
    { n: 12, a: 3, b: 3, c: 3 },
  ),
  preset(
    "empty-universe",
    "An empty universe",
    "All eight disjoint membership groups have zero elements.",
    "inclusion",
    { n: 0, a: 2, b: 3, c: 5 },
  ),
  preset(
    "balanced-bound",
    "Four boxes, fourteen objects",
    "A balanced witness attains the sharp lower bound on the largest occupancy.",
    "pigeonhole",
    { n: 14, k: 4 },
  ),
  preset(
    "more-boxes-than-objects",
    "Some boxes stay empty",
    "Six objects in eight labelled boxes force occupancy one, not a collision.",
    "pigeonhole",
    { n: 6, k: 8 },
  ),
  preset(
    "no-objects",
    "No positive occupancy is forced",
    "An empty collection gives a sharp bound of zero.",
    "pigeonhole",
    { n: 0, k: 5 },
  ),
];

export function defaultCountingScene(mode: CountingMode): CountingScene {
  const chosen = COUNTING_PRESETS.find((item) => item.mode === mode);
  if (!chosen) throw new RangeError("Choose a supported counting experiment.");
  return { ...chosen.scene };
}
