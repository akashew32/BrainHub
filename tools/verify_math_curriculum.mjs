/**
 * Validate the authored first-stage curriculum and render every math fragment.
 *
 * Run from any directory with:
 *   node tools/verify_math_curriculum.mjs
 *
 * Structural checks cover all 30 lessons and 300 questions. Independent
 * arithmetic fixtures below additionally check selected answer keys; this is
 * not a symbolic proof checker or a substitute for mathematical editorial review.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireFrontend = createRequire(join(root, "frontend", "package.json"));
const katex = requireFrontend("katex");
const directory = join(root, "backend", "app", "roadmaps", "curriculum");
const catalog = JSON.parse(
  readFileSync(
    join(root, "backend", "app", "roadmaps", "catalog.json"),
    "utf8",
  ),
).roadmaps;
const errors = [];
const warnings = [];
const banks = new Map();
const questions = new Map();
let lessonCount = 0;
let questionCount = 0;
let examCount = 0;
let mathCount = 0;
let arithmeticCount = 0;

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function escapedAt(text, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor--) {
    backslashes++;
  }
  return backslashes % 2 === 1;
}

function mathFragments(text, location) {
  const fragments = [];
  for (let cursor = 0; cursor < text.length; cursor++) {
    if (text[cursor] !== "$" || escapedAt(text, cursor)) continue;
    const display = text[cursor + 1] === "$";
    const delimiter = display ? "$$" : "$";
    const contentStart = cursor + delimiter.length;
    let closing = -1;
    for (let next = contentStart; next < text.length; next++) {
      if (text[next] !== "$" || escapedAt(text, next)) continue;
      if (display && text[next + 1] !== "$") continue;
      if (!display && text[next + 1] === "$") {
        errors.push(location + ": display delimiter nested inside inline math");
      }
      closing = next;
      break;
    }
    if (closing === -1) {
      errors.push(location + ": unclosed " + delimiter + " math delimiter");
      break;
    }
    const expression = text.slice(contentStart, closing);
    assert(expression.trim().length > 0, location + ": empty math fragment");
    fragments.push({ expression, display });
    cursor = closing + delimiter.length - 1;
  }
  return fragments;
}

function renderMathIn(value, location) {
  if (typeof value === "string") {
    for (const { expression, display } of mathFragments(value, location)) {
      mathCount++;
      try {
        katex.renderToString(expression, {
          displayMode: display,
          throwOnError: true,
          strict: "error",
          trust: false,
          output: "htmlAndMathml",
        });
      } catch (error) {
        errors.push(location + ": " + error.message);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      renderMathIn(entry, location + "[" + index + "]"),
    );
  } else if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      renderMathIn(entry, location + "." + key);
    }
  }
}

function verifyQuestion(
  question,
  lesson,
  roadmap,
  index,
  seenIds,
  seenPrompts,
) {
  const location =
    roadmap + "/" + lesson.topic_slug + "/question-" + (index + 1);
  const expectedId =
    lesson.topic_slug + "-" + String(index + 1).padStart(2, "0");
  assert(question.id === expectedId, location + ": expected id " + expectedId);
  assert(!seenIds.has(question.id), location + ": duplicate id within roadmap");
  seenIds.add(question.id);
  assert(isText(question.prompt), location + ": missing prompt");
  assert(
    !seenPrompts.has(question.prompt),
    location + ": duplicate prompt within roadmap",
  );
  seenPrompts.add(question.prompt);
  assert(isText(question.concept), location + ": missing concept label");
  assert(isText(question.solution), location + ": missing worked solution");
  assert(
    Array.isArray(question.hints) &&
      question.hints.length >= 2 &&
      question.hints.every(isText),
    location + ": at least two nonempty hints required",
  );
  assert(
    ["foundation", "core", "stretch"].includes(question.difficulty),
    location + ": invalid difficulty",
  );
  assert(
    typeof question.exam === "boolean",
    location + ": exam flag must be boolean",
  );
  assert(
    ["number", "vector", "matrix", "choice", "proof"].includes(question.kind),
    location + ": unsupported question kind",
  );

  const tolerance = question.tolerance ?? 0.000001;
  assert(
    isFiniteNumber(tolerance) && tolerance > 0 && tolerance <= 0.001,
    location +
      ": numerical tolerance must be positive and no greater than 0.001",
  );

  if (question.kind === "number") {
    assert(
      isFiniteNumber(question.answer),
      location + ": answer must be a finite number",
    );
  } else if (question.kind === "vector") {
    assert(
      Array.isArray(question.answer) &&
        question.answer.length > 0 &&
        question.answer.every(isFiniteNumber),
      location + ": answer must be a nonempty finite numeric vector",
    );
  } else if (question.kind === "matrix") {
    const answer = question.answer;
    const valid =
      Array.isArray(answer) &&
      answer.length > 0 &&
      Array.isArray(answer[0]) &&
      answer[0].length > 0 &&
      answer.every(
        (row) =>
          Array.isArray(row) &&
          row.length === answer[0].length &&
          row.every(isFiniteNumber),
      );
    assert(
      valid,
      location + ": answer must be a nonempty rectangular finite matrix",
    );
  } else if (question.kind === "choice" || question.kind === "proof") {
    const choices = question.choices;
    assert(
      Array.isArray(choices) &&
        choices.length >= 2 &&
        choices.every(isText) &&
        new Set(choices).size === choices.length,
      location + ": choices must contain at least two unique nonempty entries",
    );
    if (question.kind === "choice") {
      assert(
        isText(question.answer) && choices?.includes(question.answer),
        location + ": choice answer must exactly match one option",
      );
    } else {
      const answer = question.answer;
      assert(
        Array.isArray(answer) &&
          answer.length === choices?.length &&
          new Set(answer).size === answer.length &&
          answer.every(
            (step) =>
              Number.isInteger(step) && step >= 1 && step <= choices.length,
          ),
        location +
          ": proof answer must be a permutation of all one-based step indices",
      );
    }
  }

  if (question.exam) examCount++;
  questions.set(roadmap + ":" + question.id, question);
  questionCount++;
}

const files = readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .sort();
assert(files.length === 5, "Expected exactly five authored first-stage banks");

for (const filename of files) {
  const roadmap = filename.slice(0, -5);
  let bank;
  try {
    bank = JSON.parse(readFileSync(join(directory, filename), "utf8"));
  } catch (error) {
    errors.push(filename + ": invalid JSON: " + error.message);
    continue;
  }
  banks.set(roadmap, bank);
  assert(bank.version === 1, roadmap + ": expected content version 1");
  assert(
    bank.roadmap_slug === roadmap,
    roadmap + ": filename and roadmap_slug disagree",
  );
  assert(
    bank.stage_index === 0,
    roadmap + ": first release must cover stage zero",
  );
  assert(
    Array.isArray(catalog[roadmap]),
    roadmap + ": not present in canonical topic catalog",
  );
  assert(
    Array.isArray(bank.sources) &&
      bank.sources.length > 0 &&
      bank.sources.every(
        (source) => isText(source.title) && /^https:\/\//.test(source.url),
      ),
    roadmap + ": source provenance requires titles and HTTPS URLs",
  );
  assert(
    Array.isArray(bank.lessons) && bank.lessons.length === 6,
    roadmap + ": expected six authored lessons",
  );
  if (!Array.isArray(bank.lessons)) continue;

  const seenIds = new Set();
  const seenPrompts = new Set();
  const seenTopics = new Set();
  const expectedTopics = catalog[roadmap]?.slice(0, 6) ?? [];
  bank.lessons.forEach((lesson, lessonIndex) => {
    const location = roadmap + "/" + lesson.topic_slug;
    lessonCount++;
    assert(
      lesson.topic_slug === expectedTopics[lessonIndex],
      location + ": topic does not match the canonical stage order",
    );
    assert(
      !seenTopics.has(lesson.topic_slug),
      location + ": duplicate topic slug",
    );
    seenTopics.add(lesson.topic_slug);
    assert(
      isText(lesson.title) && slugify(lesson.title) === lesson.topic_slug,
      location + ": title does not normalize to the topic slug",
    );
    assert(isText(lesson.summary), location + ": missing summary");
    assert(
      Array.isArray(lesson.objectives) &&
        lesson.objectives.length >= 3 &&
        lesson.objectives.every(isText),
      location + ": at least three specific objectives required",
    );
    assert(
      Array.isArray(lesson.sections) &&
        lesson.sections.length >= 3 &&
        lesson.sections.every(
          (section) => isText(section.heading) && isText(section.body),
        ),
      location + ": at least three explanation sections required",
    );
    assert(
      Array.isArray(lesson.worked_examples) &&
        lesson.worked_examples.length >= 2 &&
        lesson.worked_examples.every(
          (example) =>
            isText(example.prompt) &&
            isText(example.result) &&
            Array.isArray(example.steps) &&
            example.steps.length >= 3 &&
            example.steps.every(isText),
        ),
      location +
        ": at least two fully worked examples with three steps required",
    );
    assert(
      Array.isArray(lesson.questions) && lesson.questions.length === 10,
      location + ": expected exactly ten questions",
    );
    if (!Array.isArray(lesson.questions)) return;
    assert(
      lesson.questions.filter((question) => question.exam === true).length ===
        2,
      location + ": exactly two reserved exam questions required",
    );
    assert(
      lesson.questions.filter((question) => question.exam === false).length ===
        8,
      location + ": exactly eight practice questions required",
    );
    lesson.questions.forEach((question, index) =>
      verifyQuestion(question, lesson, roadmap, index, seenIds, seenPrompts),
    );
    renderMathIn(lesson, location);
  });
}

// These are independent constructions of selected answer keys, rather than
// expressions copied from the stored solution. They intentionally identify
// individual problems, so changing their prompts requires reviewing the fixture.
function factorial(n) {
  let value = 1;
  for (let i = 2; i <= n; i++) value *= i;
  return value;
}

function choose(n, k) {
  if (k < 0 || k > n) return 0;
  return factorial(n) / (factorial(k) * factorial(n - k));
}

function multiply(left, right) {
  return left.map((row) =>
    right[0].map((_, column) =>
      row.reduce((sum, entry, index) => sum + entry * right[index][column], 0),
    ),
  );
}

function transpose(matrix) {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

function subtract(left, right) {
  return left.map((row, i) => row.map((entry, j) => entry - right[i][j]));
}

function gcd(a, b) {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function truthAssignments(size) {
  return Array.from({ length: 2 ** size }, (_, bits) =>
    Array.from({ length: size }, (_, index) => Boolean(bits & (1 << index))),
  );
}

function secondOrder(initial0, initial1, index) {
  let a = initial0;
  let b = initial1;
  for (let n = 1; n < index; n++) [a, b] = [b, a + b];
  return index === 0 ? a : b;
}

function solveTwoByTwo(matrix, target) {
  const [[a, b], [c, d]] = matrix;
  const [u, v] = target;
  const determinant = a * d - b * c;
  return [(u * d - b * v) / determinant, (a * v - u * c) / determinant];
}

function close(expected, actual, tolerance) {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((entry, index) => close(entry, actual[index], tolerance))
    );
  }
  return isFiniteNumber(actual) && Math.abs(expected - actual) <= tolerance;
}

function answer(roadmap, id, computed) {
  const question = questions.get(roadmap + ":" + id);
  assert(
    question !== undefined,
    roadmap + ":" + id + ": missing arithmetic fixture target",
  );
  if (!question) return;
  arithmeticCount++;
  assert(
    close(computed, question.answer, question.tolerance ?? 0.000001),
    roadmap +
      ":" +
      id +
      ": independently computed " +
      JSON.stringify(computed) +
      " differs from answer " +
      JSON.stringify(question.answer),
  );
}

answer("probability", "sum-and-product-rules-04", 9 * 9 * 8 * 7);
answer("probability", "sum-and-product-rules-08", 1 / (26 * 10));
answer("probability", "sum-and-product-rules-09", 5 * 5 * 4);
answer("probability", "sum-and-product-rules-10", 3 * 2 + 4 * 3);
answer(
  "probability",
  "permutations-and-combinations-06",
  factorial(11) / (factorial(4) ** 2 * 2),
);
answer(
  "probability",
  "permutations-and-combinations-09",
  (choose(5, 2) * 4) / choose(9, 3),
);
answer("probability", "permutations-and-combinations-10", 2 * factorial(5));
answer(
  "probability",
  "multinomial-coefficients-05",
  30 * 0.5 ** 2 * 0.3 ** 2 * 0.2,
);
answer(
  "probability",
  "multinomial-coefficients-06",
  factorial(6) / (2 ** 3 * factorial(3)),
);
answer(
  "probability",
  "multinomial-coefficients-09",
  factorial(10) / (factorial(4) * factorial(3) ** 2),
);
answer("probability", "multinomial-coefficients-10", 12 / 4 ** 4);
answer("probability", "stars-and-bars-07", 3 * choose(4, 1));
answer("probability", "stars-and-bars-09", choose(11, 2));
answer("probability", "stars-and-bars-10", choose(11, 2) - choose(6, 2));
answer("probability", "inclusion-exclusion-04", 30 + 20 + 12 - 10 - 6 - 4 + 2);
answer("probability", "inclusion-exclusion-05", 24 - 24 + 12 - 4 + 1);
answer("probability", "inclusion-exclusion-09", 3 ** 5 - 3 * 2 ** 5 + 3);
answer("probability", "inclusion-exclusion-10", 50 + 33 - 2 * 16);
answer("probability", "pigeonhole-principle-02", 12 * (3 - 1) + 1);
answer("probability", "pigeonhole-principle-09", Math.ceil(31 / 5));

answer("discrete-math", "propositional-and-predicate-logic-02", 2 ** 4);
answer(
  "discrete-math",
  "propositional-and-predicate-logic-03",
  [0, 1, 2, 3].filter((x) => x * x === x).length,
);
answer(
  "discrete-math",
  "truth-tables-and-logical-equivalence-03",
  truthAssignments(2).filter(([p, q]) => (!p || q) && (!q || p)).length,
);
answer(
  "discrete-math",
  "truth-tables-and-logical-equivalence-06",
  truthAssignments(3).filter(([p, q, r]) => p && (q || r)).length,
);
answer(
  "discrete-math",
  "truth-tables-and-logical-equivalence-07",
  truthAssignments(3).filter(([p, q]) => !p || q).length,
);
answer(
  "discrete-math",
  "quantifiers-and-nested-negation-09",
  Math.floor(1 / 0.1) + 1,
);
answer(
  "discrete-math",
  "direct-contrapositive-and-contradiction-proofs-05",
  3 * 5,
);
answer("discrete-math", "induction-and-strong-induction-05", 2 * 3 ** 4);
answer("discrete-math", "induction-and-strong-induction-08", (7 ** 5 - 1) / 6);
answer(
  "discrete-math",
  "induction-and-strong-induction-09",
  secondOrder(1, 1, 6),
);
answer("discrete-math", "invariants-and-extremal-arguments-04", gcd(252, 105));
answer("discrete-math", "invariants-and-extremal-arguments-09", gcd(132, 84));

answer(
  "calculus",
  "function-composition-and-inverses-01",
  2 * (2 ** 2 - 3) + 1,
);
answer(
  "calculus",
  "function-composition-and-inverses-02",
  (2 * 2 + 1) ** 2 - 3,
);
answer("calculus", "function-composition-and-inverses-07", (2 + 4) / (1 - 4));
answer("calculus", "polynomial-and-rational-behavior-07", [
  1,
  -4 + 2,
  7 + 2 * (-4 + 2),
]);
answer("calculus", "polynomial-and-rational-behavior-09", (2 + 2) / (2 + 3));
answer(
  "calculus",
  "exponential-and-logarithmic-functions-08",
  50 * (200 / 50) ** (3 / 2),
);
answer(
  "calculus",
  "exponential-and-logarithmic-functions-09",
  Math.sqrt(15 + 1),
);
answer(
  "calculus",
  "trigonometric-functions-and-identities-03",
  -Math.sqrt(1 - (3 / 5) ** 2),
);
answer(
  "calculus",
  "trigonometric-functions-and-identities-08",
  2 * (3 / 5) * (4 / 5),
);
{
  const angle = Math.asin(Math.sqrt(1 / 2)) / Math.PI;
  answer("calculus", "trigonometric-functions-and-identities-09", [
    angle,
    1 - angle,
    1 + angle,
    2 - angle,
  ]);
}
answer("calculus", "parametric-and-polar-curves-07", [6 / 2, 0, 6 / 2]);
answer("calculus", "parametric-and-polar-curves-10", [
  -4 * Math.cos(Math.PI),
  -4 * Math.sin(Math.PI),
]);
answer(
  "calculus",
  "sequences-and-informal-limiting-behavior-02",
  2 * (2 * 3 - 1) - 1,
);
answer(
  "calculus",
  "sequences-and-informal-limiting-behavior-08",
  4 / (1 - 1 / 3),
);
answer(
  "calculus",
  "sequences-and-informal-limiting-behavior-10",
  1 / (Math.sqrt(1) + 1),
);

answer(
  "linear-algebra",
  "vector-arithmetic-and-linear-combinations-01",
  [2, -1, 3].map((entry, index) => 3 * entry - 2 * [-1, 4, 2][index]),
);
answer(
  "linear-algebra",
  "vector-arithmetic-and-linear-combinations-09",
  solveTwoByTwo(
    [
      [1, 3],
      [2, -1],
    ],
    [7, 0],
  ),
);
answer("linear-algebra", "dot-products-norms-and-angles-01", 2 * 4 - 3 * 2 - 5);
answer("linear-algebra", "dot-products-norms-and-angles-04", -(3 - 2) / 2);
answer("linear-algebra", "dot-products-norms-and-angles-09", [
  4 - 2 * (7 / 5),
  1 + 7 / 5,
]);
answer(
  "linear-algebra",
  "matrix-arithmetic-03",
  multiply(
    [
      [1, 2],
      [3, 4],
    ],
    [
      [2, -1],
      [0, 3],
    ],
  ),
);
answer(
  "linear-algebra",
  "matrix-arithmetic-09",
  subtract(
    multiply(
      [
        [1, 1],
        [0, 1],
      ],
      [
        [1, 0],
        [2, 1],
      ],
    ),
    multiply(
      [
        [1, 0],
        [2, 1],
      ],
      [
        [1, 1],
        [0, 1],
      ],
    ),
  ),
);
answer(
  "linear-algebra",
  "matrix-arithmetic-10",
  transpose(
    multiply(
      [
        [1, 2],
        [0, -1],
      ],
      [
        [3, 0],
        [1, 2],
      ],
    ),
  ),
);
answer("linear-algebra", "linear-transformations-in-coordinates-02", [
  3 + 4,
  9 - 8,
]);
answer(
  "linear-algebra",
  "linear-transformations-in-coordinates-09",
  multiply(
    [
      [0, -1],
      [1, 0],
    ],
    [
      [1, 2],
      [0, 1],
    ],
  ),
);
answer("linear-algebra", "linear-transformations-in-coordinates-10", [
  2 * 3 + 1,
  2 * 1 + 5,
]);
answer("linear-algebra", "rotations-reflections-projections-and-shears-06", [
  [1 / 2, 1 / 2],
  [1 / 2, 1 / 2],
]);
answer("linear-algebra", "rotations-reflections-projections-and-shears-09", [
  -3,
  1 + 2 * 3,
]);
answer("linear-algebra", "affine-versus-linear-maps-05", [
  2 * (3 - 1) - (4 - 1),
  3 - 1 + (4 - 1),
]);
answer("linear-algebra", "affine-versus-linear-maps-09", [
  3 * (2 + 1),
  2 * 5 - 3 + 4,
]);

answer(
  "real-analysis",
  "propositions-quantifiers-and-negation-02",
  [-2, -1, 0, 1, 2].filter((x) => x * x < 2).length,
);
answer(
  "real-analysis",
  "direct-contrapositive-and-contradiction-proofs-05",
  2 + 2,
);
answer("real-analysis", "induction-and-recursive-arguments-01", (12 * 13) / 2);
answer(
  "real-analysis",
  "induction-and-recursive-arguments-03",
  2 * (2 * 2 + 3) + 3,
);
answer("real-analysis", "induction-and-recursive-arguments-07", 2 + 3);
answer(
  "real-analysis",
  "induction-and-recursive-arguments-09",
  secondOrder(0, 1, 7),
);
answer(
  "real-analysis",
  "sets-functions-images-and-preimages-01",
  new Set([-2, -1, 0, 1, 2].map((x) => x * x)).size,
);
answer("real-analysis", "sets-functions-images-and-preimages-02", [
  (3 - 1) / 2,
  (7 - 1) / 2,
]);
answer("real-analysis", "countability-and-diagonal-arguments-02", 2 ** 5);
answer(
  "real-analysis",
  "countability-and-diagonal-arguments-06",
  [0, 1, 1, 0].map((bit) => 1 - bit),
);
answer("real-analysis", "suprema-infima-and-order-06", [-2 * 5, -2 * -2]);
answer("real-analysis", "suprema-infima-and-order-08", 2 - 3);

assert(
  lessonCount === 30,
  "Expected 30 authored lessons, found " + lessonCount,
);
assert(questionCount === 300, "Expected 300 questions, found " + questionCount);
assert(
  examCount === 60,
  "Expected 60 reserved exam questions, found " + examCount,
);

for (const warning of warnings) console.warn("WARNING: " + warning);
if (errors.length) {
  errors.forEach((error) => console.error("ERROR: " + error));
  console.error(
    "FAILED: " +
      errors.length +
      " error(s); inspected " +
      mathCount +
      " math fragments.",
  );
  process.exitCode = 1;
} else {
  console.log(
    "PASS: " +
      banks.size +
      " roadmaps, " +
      lessonCount +
      " authored lessons, " +
      questionCount +
      " questions, " +
      examCount +
      " reserved exam items.",
  );
  console.log(
    "PASS: " +
      mathCount +
      " math fragments render with KaTeX; " +
      arithmeticCount +
      " answer keys independently recomputed.",
  );
  console.log(
    "Editorial review is still required for proofs and mathematical exposition.",
  );
}
