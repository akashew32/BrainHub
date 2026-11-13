/** Public bounded counting experiments, separate from private assessment banks. */
export const COUNTING_MODES = [
  "rules",
  "selection",
  "multinomial",
  "allocations",
  "inclusion",
  "pigeonhole",
] as const;
export type CountingMode = (typeof COUNTING_MODES)[number];
export type CountingScene = {
  a: number;
  b: number;
  c: number;
  n: number;
  k: number;
  r: number;
  minimum: number;
  rule: "sum" | "product";
  selection: "ordered" | "unordered";
};
export type CountingField = {
  key: "a" | "b" | "c" | "n" | "k" | "r" | "minimum";
  label: string;
  min: number;
  max: number;
};
export const COUNTING_FIELDS: Record<CountingMode, readonly CountingField[]> = {
  rules: [
    { key: "a", label: "Choices in A", min: 0, max: 6 },
    { key: "b", label: "Choices in B", min: 0, max: 6 },
  ],
  selection: [
    { key: "n", label: "Available distinct tokens n", min: 0, max: 8 },
    { key: "r", label: "Tokens to select r", min: 0, max: 8 },
  ],
  multinomial: [
    { key: "a", label: "Copies of A", min: 0, max: 4 },
    { key: "b", label: "Copies of B", min: 0, max: 4 },
    { key: "c", label: "Copies of C", min: 0, max: 4 },
  ],
  allocations: [
    { key: "n", label: "Identical objects n", min: 0, max: 12 },
    { key: "k", label: "Labelled boxes k", min: 1, max: 6 },
    { key: "minimum", label: "Minimum in each box", min: 0, max: 3 },
  ],
  inclusion: [
    { key: "n", label: "Universe size N", min: 0, max: 36 },
    { key: "a", label: "Divisor for A", min: 1, max: 8 },
    { key: "b", label: "Divisor for B", min: 1, max: 8 },
    { key: "c", label: "Divisor for C", min: 1, max: 8 },
  ],
  pigeonhole: [
    { key: "n", label: "Number of objects N", min: 0, max: 30 },
    { key: "k", label: "Number of labelled boxes k", min: 1, max: 8 },
  ],
};
export const COUNTING_LESSONS: Record<
  CountingMode,
  { title: string; topic: string; prediction: string; quantity: string; reflection: string }
> = {
  rules: {
    title: "Sum and product rules",
    topic: "sum-and-product-rules",
    prediction: "Predict the number of outcomes under the selected rule.",
    quantity: "Number of outcomes",
    reflection:
      "Why do disjoint alternatives add, while successive choices multiply? Describe what happens when one stage has no choices.",
  },
  selection: {
    title: "Permutations and combinations",
    topic: "permutations-and-combinations",
    prediction:
      "Predict the number of selections of r distinct tokens from n, with the selected ordering convention.",
    quantity: "Number of selections",
    reflection:
      "Which ordered selections represent the same unordered choice? Explain the factor lost when order is ignored.",
  },
  multinomial: {
    title: "Repeated-symbol arrangements",
    topic: "multinomial-coefficients",
    prediction: "Predict the number of distinct words containing exactly the stated copies of A, B and C.",
    quantity: "Distinct arrangements",
    reflection:
      "Why does swapping equal symbols not create a new word? Explain the factorials in the denominator.",
  },
  allocations: {
    title: "Stars and bars",
    topic: "stars-and-bars",
    prediction:
      "Predict the number of allocations of identical objects to labelled boxes, respecting every minimum.",
    quantity: "Feasible allocations",
    reflection:
      "How does subtracting the minimum from every box reduce the problem to nonnegative allocations? Explain an infeasible case.",
  },
  inclusion: {
    title: "Inclusion–exclusion",
    topic: "inclusion-exclusion",
    prediction: "Predict how many elements of the finite universe lie in at least one of A, B and C.",
    quantity: "Elements in the union",
    reflection:
      "Why must pair intersections be subtracted and the triple intersection added back? Explain how the disjoint membership groups avoid double counting.",
  },
  pigeonhole: {
    title: "Sharp pigeonhole bounds",
    topic: "pigeonhole-principle",
    prediction:
      "Predict the smallest possible largest box occupancy across all assignments of N objects to k boxes.",
    quantity: "Sharp guaranteed occupancy",
    reflection:
      "Why must some box reach this occupancy? Explain why the balanced witness shows that a larger occupancy is not forced.",
  },
};
export type CountingGroup = { label: string; total: number; items?: string[]; included?: boolean };
export type CountingListing = {
  title: string;
  items: string[];
  total: number;
  complete: boolean;
  kind: "outcomes" | "witness";
};
export type CountingResult = {
  count: number | null;
  steps: string[];
  facts: Array<{ label: string; value: string }>;
  observations: string[];
  groups: CountingGroup[];
  groupCaption: string;
  listing: CountingListing | null;
  error: string | null;
};
export type CountingPreset = {
  id: string;
  label: string;
  description: string;
  mode: CountingMode;
  scene: CountingScene;
};
