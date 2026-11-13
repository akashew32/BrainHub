import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogicLab } from "@/components/roadmaps/logic-lab";
import { LogicEvidence } from "@/components/roadmaps/logic-table";
import { defaultLogicScene, evaluateLogic, LOGIC_PRESETS, LOGIC_PROOFS } from "@/lib/logic-lab";
import {
  LOGIC_MODES,
  LOGIC_TITLES,
  logicFields,
  type LogicMode,
  type LogicScene,
} from "@/lib/logic-lab-types";

const scene = (mode: LogicMode, values: Partial<LogicScene> = {}) => ({
  ...defaultLogicScene(mode),
  ...values,
});
function model(mode: LogicMode, values: Partial<LogicScene> = {}) {
  const result = evaluateLogic(mode, scene(mode, values));
  expect(result.error).toBeNull();
  return result;
}
function boolean(mode: LogicMode, values: Partial<LogicScene>, expected: boolean) {
  expect(model(mode, values).answer).toMatchObject({ kind: "boolean", value: expected });
}
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
function predict(value: boolean) {
  choose("Your prediction", String(value));
}
function matched() {
  expect(screen.getAllByText("Your prediction matches the model.").length).toBeGreaterThan(0);
}
function validProofOrder(proof: LogicScene["proof"], excluded?: readonly string[]) {
  const definition = LOGIC_PROOFS[proof];
  return permutations(definition.steps.map((step) => step.id)).find(
    (order) =>
      order.join() !== excluded?.join() &&
      order.every((id, position) =>
        definition.steps
          .find((step) => step.id === id)!
          .requires.every((required) => order.indexOf(required) < position),
      ),
  )!;
}
const range = (length: number) => Array.from({ length }, (_, index) => index);
function permutations<T>(items: readonly T[]): T[][] {
  return items.length === 0
    ? [[]]
    : items.flatMap((item, index) =>
        permutations(items.filter((_, other) => other !== index)).map((tail) => [item, ...tail]),
      );
}
function prime(value: number) {
  if (value < 2) return false;
  for (let divisor = 2; divisor * divisor <= value; divisor += 1) if (value % divisor === 0) return false;
  return true;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Logic exploration must remain local")));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("independent finite logic and proof review", () => {
  it("distinguishes converses, contrapositives, De Morgan, distributivity and exclusive or", () => {
    boolean("truth", { truthPair: "converse" }, false);
    boolean("truth", { truthPair: "contrapositive" }, true);
    boolean("truth", { truthPair: "demorgan" }, true);
    boolean("truth", { truthPair: "distributivity" }, true);
    boolean("truth", { truthPair: "xor" }, false);
  });

  it("agrees with direct nested every/some evaluation including all empty-domain combinations", () => {
    for (let xSize = 0; xSize <= 6; xSize += 1)
      for (let ySize = 0; ySize <= 6; ySize += 1)
        for (const predicate of ["less", "equal", "sum-at-most"] as const)
          for (const quantifier of [
            "forall-forall",
            "forall-exists",
            "exists-forall",
            "exists-exists",
          ] as const) {
            const relation = (x: number, y: number) =>
              predicate === "less" ? x < y : predicate === "equal" ? x === y : x + y <= 3;
            const row = (x: number) =>
              quantifier.endsWith("forall")
                ? range(ySize).every((y) => relation(x, y))
                : range(ySize).some((y) => relation(x, y));
            const expected = quantifier.startsWith("forall")
              ? range(xSize).every(row)
              : range(xSize).some(row);
            const result = model("quantifiers", { xSize, ySize, predicate, quantifier, threshold: 3 });
            expect(result.answer).toMatchObject({ kind: "boolean", value: expected });
            expect(result.facts.find((fact) => fact.label === "Negation's truth value")?.value).toBe(
              expected ? "False" : "True",
            );
          }
  });

  it("accepts precisely the valid topological orders and rejects duplicate or omitted proof steps", () => {
    for (const proof of ["even-sum", "square-parity", "no-largest-integer"] as const) {
      const definition = LOGIC_PROOFS[proof];
      let validOrders = 0;
      let cascadedInvalidSteps = 0;
      for (const proofOrder of permutations(definition.steps.map((step) => step.id))) {
        const expected = proofOrder.every((id, position) =>
          definition.steps
            .find((step) => step.id === id)!
            .requires.every((prerequisite) => proofOrder.indexOf(prerequisite) < position),
        );
        const result = model("proof", { proof, proofOrder });
        expect(result.answer).toMatchObject({ kind: "boolean", value: expected });
        const established = new Set<string>(),
          seen = new Set<string>();
        for (const id of proofOrder) {
          const required = definition.steps.find((step) => step.id === id)!.requires;
          const missing = required.filter((prerequisite) => !established.has(prerequisite));
          const feedback = result.proofFeedback!.find((entry) => entry.id === id)!;
          expect(feedback.valid).toBe(missing.length === 0);
          expect(feedback.missing).toEqual(missing);
          if (missing.some((prerequisite) => seen.has(prerequisite))) cascadedInvalidSteps += 1;
          if (missing.length === 0) established.add(id);
          seen.add(id);
        }
        if (expected) validOrders += 1;
      }
      expect(validOrders).toBeGreaterThan(0);
      expect(cascadedInvalidSteps).toBeGreaterThan(0);
      if (proof === "even-sum" || proof === "no-largest-integer") expect(validOrders).toBeGreaterThan(1);
      const ids = definition.steps.map((step) => step.id);
      expect(evaluateLogic("proof", scene("proof", { proof, proofOrder: ids.slice(1) })).error).toBeTruthy();
      expect(
        evaluateLogic("proof", scene("proof", { proof, proofOrder: [...ids.slice(0, -1), ids[0]!] })).error,
      ).toBeTruthy();
    }
  });

  it("separates a true odd-sum claim from validity of the supplied induction argument", () => {
    for (let baseIndex = 1; baseIndex <= 5; baseIndex += 1) {
      boolean("induction", { induction: "odd-sum", baseIndex }, baseIndex === 1);
      boolean("induction", { induction: "shifted-base", baseIndex }, false);
    }
    boolean("induction", { induction: "false-step" }, false);
    for (let n = 1; n <= 12; n += 1)
      expect(range(n).reduce((sum, index) => sum + 2 * index + 1, 0)).toBe(n * n);
  });

  it("checks finite functions and image/preimage equalities using direct set operations", () => {
    for (let domainSize = 0; domainSize <= 8; domainSize += 1)
      for (let modulus = 1; modulus <= 6; modulus += 1)
        for (const shift of [-5, -1, 0, 3, 5]) {
          const D = range(domainSize),
            C = range(modulus),
            f = (x: number) => (((x + shift) % modulus) + modulus) % modulus;
          const image = new Set(D.map(f)),
            A = D.filter((x) => x < 3),
            B = C.filter((y) => y <= 1);
          const preimageB = D.filter((x) => B.includes(f(x))),
            imagePreimageB = new Set(preimageB.map(f));
          const imageA = new Set(A.map(f)),
            preimageImageA = D.filter((x) => imageA.has(f(x)));
          for (const [property, expected] of [
            ["injective", image.size === D.length],
            ["surjective", image.size === C.length],
            ["bijective", image.size === D.length && image.size === C.length],
            [
              "image-equality",
              B.every((value) => imagePreimageB.has(value)) && imagePreimageB.size === B.length,
            ],
            [
              "preimage-equality",
              preimageImageA.length === A.length && preimageImageA.every((value) => A.includes(value)),
            ],
          ] as const)
            boolean("sets", { domainSize, modulus, shift, cut: 3, target: 1, property }, expected);
        }
  });

  it("constructs a binary antidiagonal differing from every row in its own diagonal place", () => {
    for (let wordSize = 1; wordSize <= 6; wordSize += 1) {
      const words = range(wordSize).map((row) =>
        range(wordSize)
          .map((column) => String((row + column) % 2))
          .join(""),
      );
      const expected = words.map((word, index) => (word[index] === "0" ? "1" : "0")).join("");
      const result = model("diagonal", { wordSize, words });
      expect(result.answer).toMatchObject({ kind: "word", value: expected });
      words.forEach((word, index) => expect(expected[index]).not.toBe(word[index]));
      expect(words).not.toContain(expected);
      expect([...result.steps, ...result.observations].join(" ")).toMatch(/infinite/i);
      expect(
        model("diagonal", { wordSize, words: Array(wordSize).fill("0".repeat(wordSize)) }).answer,
      ).toMatchObject({ kind: "word", value: "1".repeat(wordSize) });
    }
  });

  it("does not infer injectivity or surjectivity from one empty-subset equality", () => {
    const noninjective = { domainSize: 3, modulus: 2, shift: 0, cut: 0, target: -1 };
    boolean("sets", { ...noninjective, property: "preimage-equality" }, true); // f^-1(f(empty)) = empty.
    boolean("sets", { ...noninjective, property: "injective" }, false);
    const nonsurjective = { domainSize: 1, modulus: 3, shift: 0, cut: 0, target: -1 };
    boolean("sets", { ...nonsurjective, property: "image-equality" }, true); // f(f^-1(empty)) = empty.
    boolean("sets", { ...nonsurjective, property: "surjective" }, false);
  });

  it("handles empty, singleton, open and closed real intervals without inventing attained extrema", () => {
    for (let left = -4; left <= 4; left += 1)
      for (let right = -4; right <= 4; right += 1)
        for (const leftEnd of ["open", "closed"] as const)
          for (const rightEnd of ["open", "closed"] as const) {
            const nonempty =
              left < right || (left === right && leftEnd === "closed" && rightEnd === "closed");
            for (const [orderProperty, expected] of [
              ["nonempty", nonempty],
              ["minimum", nonempty && leftEnd === "closed"],
              ["maximum", nonempty && rightEnd === "closed"],
            ] as const)
              boolean(
                "order",
                { orderFamily: "interval", left, right, leftEnd, rightEnd, orderProperty },
                expected,
              );
          }
    for (const left of [-3, 0, 3])
      for (let start = 1; start <= 5; start += 1) {
        boolean("order", { orderFamily: "reciprocal", left, start, orderProperty: "minimum" }, false);
        boolean("order", { orderFamily: "reciprocal", left, start, orderProperty: "maximum" }, true);
        boolean("order", { orderFamily: "reciprocal", left, start, orderProperty: "nonempty" }, true);
      }
  });

  it("checks steps-of-two reachability in both directions on the nonnegative integers", () => {
    for (let start = 0; start <= 20; start += 1)
      for (let target = 0; target <= 20; target += 1)
        boolean("invariants", { invariant: "parity", start, target }, start % 2 === target % 2);
  });

  it("checks directed cycles by independent depth-first search, including empty wrap and a one-vertex self-loop", () => {
    for (let graphSize = 0; graphSize <= 8; graphSize += 1)
      for (const wrap of ["no", "yes"] as const) {
        const edges = range(graphSize).flatMap((from) =>
          range(graphSize)
            .filter((to) => to - from === 1 || to - from === 2)
            .map((to) => [from, to]),
        );
        if (wrap === "yes" && graphSize > 0) edges.push([graphSize - 1, 0]);
        const visiting = new Set<number>(),
          visited = new Set<number>();
        function cycleAt(vertex: number): boolean {
          if (visiting.has(vertex)) return true;
          if (visited.has(vertex)) return false;
          visiting.add(vertex);
          if (edges.filter(([from]) => from === vertex).some(([, to]) => cycleAt(to!))) return true;
          visiting.delete(vertex);
          visited.add(vertex);
          return false;
        }
        const expected = range(graphSize).some(cycleAt),
          result = model("invariants", { invariant: "graph", graphSize, wrap });
        expect(result.answer).toMatchObject({ kind: "boolean", value: expected });
        expect(result.tables[0]!.rows.map((row) => row.slice(0, 2).map(Number))).toEqual(edges);
      }
  });

  it("interprets finite-prefix searches as found failures rather than universal proofs", () => {
    for (const primeOffset of [2, 3, 4, 5, 11, 41])
      for (let searchLimit = 0; searchLimit <= 40; searchLimit += 1) {
        const found = range(searchLimit + 1).some((n) => !prime(n * n + n + primeOffset));
        boolean("counterexamples", { counterexample: "prime-quadratic", primeOffset, searchLimit }, found);
      }
    boolean(
      "counterexamples",
      { counterexample: "prime-quadratic", primeOffset: 41, searchLimit: 39 },
      false,
    );
    boolean("counterexamples", { counterexample: "prime-quadratic", primeOffset: 41, searchLimit: 40 }, true);
    for (let searchLimit = 0; searchLimit <= 40; searchLimit += 1) {
      boolean("counterexamples", { counterexample: "integer-implication", searchLimit }, false);
      boolean("counterexamples", { counterexample: "odd-sum", searchLimit }, false);
    }
  });
});

describe("logic explorer interactions", () => {
  it("provides nine accessible experiments, optional prediction and explicit reveal without account or storage mutations", () => {
    const storage = ["getItem", "setItem", "removeItem"].map((method) =>
      vi.spyOn(Storage.prototype, method as "getItem"),
    );
    render(<LogicLab />);
    const experiment = screen.getByRole("combobox", { name: "Experiment" });
    expect(experiment.tagName).toBe("SELECT");
    expect(within(experiment).getAllByRole("option")).toHaveLength(9);
    for (const mode of LOGIC_MODES)
      expect(within(experiment).getByRole("option", { name: LOGIC_TITLES[mode] })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Your prediction" })).toHaveValue("");
    expect(document.querySelector("[data-answer-kind]")).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Reveal result" });
    button.focus();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("type", "button");
    reveal();
    expect(document.querySelector('[data-answer-kind="boolean"]')).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toBeVisible();
    expect(screen.queryByText("Your prediction matches the model.")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    storage.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it("compares implication/converse and contrapositive with explicit truth-table results", () => {
    render(<LogicLab initialMode="truth" />);
    choose("Formula pair", "converse");
    predict(false);
    reveal();
    matched();
    choose("Formula pair", "contrapositive");
    expect(document.querySelector("[data-answer-kind]")).not.toBeInTheDocument();
    predict(true);
    reveal();
    matched();
    const tables = screen.getAllByRole("table");
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      const region = table.closest<HTMLElement>('[role="region"]');
      expect(region).toHaveAttribute("tabindex", "0");
      expect(region).toHaveAttribute("aria-labelledby", table.querySelector("caption")!.id);
      region!.focus();
      expect(region).toHaveFocus();
    }
  });

  it("uses vacuous truth and the correct nested quantifier order", () => {
    render(<LogicLab initialMode="quantifiers" />);
    fill({ "Size of X": "0", "Size of Y": "0" });
    choose("Quantifier order", "forall-exists");
    predict(true);
    reveal();
    matched();
    choose("Quantifier order", "exists-forall");
    predict(false);
    reveal();
    matched();
    fill({ "Size of X": "2", "Size of Y": "2" });
    choose("Predicate", "equal");
    choose("Quantifier order", "forall-exists");
    predict(true);
    reveal();
    matched();
    choose("Quantifier order", "exists-forall");
    predict(false);
    reveal();
    matched();
  });

  it("accepts alternative valid proof orders and invalidates feedback when a step moves", () => {
    render(<LogicLab initialMode="proof" />);
    choose("Proof scenario", "even-sum");
    const definition = LOGIC_PROOFS["even-sum"];
    const current = [...definition.defaultOrder];
    function arrange(target: string[]) {
      target.forEach((id, desired) => {
        let position = current.indexOf(id);
        while (position > desired) {
          const original = definition.steps.findIndex((step) => step.id === id) + 1;
          fireEvent.click(screen.getByRole("button", { name: `Move step ${original} up` }));
          [current[position - 1], current[position]] = [current[position]!, current[position - 1]!];
          position -= 1;
        }
      });
      expect(
        [...document.querySelectorAll("li[data-step-id]")].map((element) =>
          element.getAttribute("data-step-id"),
        ),
      ).toEqual(target);
    }
    const first = validProofOrder("even-sum"),
      alternative = validProofOrder("even-sum", first);
    arrange(first);
    predict(true);
    reveal();
    matched();
    arrange(alternative);
    expect(document.querySelector("[data-answer-kind]")).not.toBeInTheDocument();
    reveal();
    matched();
    const finalId = alternative.at(-1)!,
      original = definition.steps.findIndex((step) => step.id === finalId) + 1;
    for (let index = 0; index < alternative.length - 1; index += 1)
      fireEvent.click(screen.getByRole("button", { name: `Move step ${original} up` }));
    expect(screen.getByRole("button", { name: `Move step ${original} down` })).toHaveFocus();
    predict(false);
    reveal();
    matched();
  });

  it("separates a true sampled identity from a complete induction argument", () => {
    render(<LogicLab initialMode="induction" />);
    choose("Induction argument", "odd-sum");
    edit("Supplied base index", "2");
    predict(false);
    reveal();
    matched();
    edit("Supplied base index", "1");
    predict(true);
    reveal();
    matched();
    choose("Induction argument", "shifted-base");
    edit("Supplied base index", "2");
    predict(false);
    reveal();
    matched();
    choose("Induction argument", "false-step");
    reveal();
    matched();
  });

  it("shows how noninjectivity and nonsurjectivity affect image/preimage equalities", () => {
    render(<LogicLab initialMode="sets" />);
    fill({
      "Domain size m": "3",
      "Codomain size q": "2",
      "Map shift s": "-1",
      "Subset cutoff c": "1",
      "Target cutoff t": "1",
    });
    choose("Property to predict", "injective");
    predict(false);
    reveal();
    matched();
    choose("Property to predict", "surjective");
    predict(true);
    reveal();
    matched();
    choose("Property to predict", "preimage-equality");
    predict(false);
    reveal();
    matched();
    fill({ "Domain size m": "1", "Codomain size q": "3", "Map shift s": "0", "Target cutoff t": "2" });
    choose("Property to predict", "image-equality");
    predict(false);
    reveal();
    matched();
  });

  it("constructs an exact antidiagonal and rejects malformed binary rows without changing their raw text", () => {
    render(<LogicLab initialMode="diagonal" />);
    edit("Word count and length n", "3");
    fill({ "Binary row 1": "000", "Binary row 2": "111", "Binary row 3": "010", "Your prediction": "101" });
    reveal();
    matched();
    expect(document.querySelector('[data-answer-kind="word"]')).toHaveTextContent("101");
    edit("Binary row 2", "10x");
    expect(screen.getByRole("textbox", { name: "Binary row 2" })).toHaveValue("10x");
    expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
    expect(document.querySelector("[data-answer-kind]")).not.toBeInTheDocument();
    edit("Binary row 2", "111");
    edit("Your prediction", "10");
    expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
    edit("Your prediction", "");
    reveal();
    expect(screen.queryByText("Your prediction matches the model.")).not.toBeInTheDocument();
  });

  it("distinguishes open bounds, closed singleton extrema, an empty interval and an unattained reciprocal infimum", () => {
    render(<LogicLab initialMode="order" />);
    choose("Set family", "interval");
    fill({ "Left endpoint a": "1", "Right endpoint b": "2" });
    choose("Left endpoint inclusion", "open");
    choose("Extremum question", "minimum");
    predict(false);
    reveal();
    matched();
    edit("Right endpoint b", "1");
    choose("Left endpoint inclusion", "closed");
    choose("Right endpoint inclusion", "closed");
    predict(true);
    reveal();
    matched();
    edit("Left endpoint a", "2");
    choose("Extremum question", "nonempty");
    predict(false);
    reveal();
    matched();
    choose("Set family", "reciprocal");
    fill({ "Reciprocal offset c": "0", "First denominator n₀": "1" });
    choose("Extremum question", "minimum");
    reveal();
    matched();
    choose("Extremum question", "maximum");
    predict(true);
    reveal();
    matched();
  });

  it("uses parity as an obstruction and finds a path when the parity agrees", () => {
    render(<LogicLab initialMode="invariants" />);
    choose("Construction", "parity");
    fill({ "Starting state": "8", "Target state": "1" });
    predict(false);
    reveal();
    matched();
    edit("Target state", "0");
    predict(true);
    reveal();
    matched();
  });

  it("uses a cycle witness after wraparound and handles empty and single-vertex graphs", () => {
    render(<LogicLab initialMode="invariants" />);
    choose("Construction", "graph");
    edit("Number of vertices", "4");
    choose("Add the wraparound edge", "no");
    predict(false);
    reveal();
    matched();
    choose("Add the wraparound edge", "yes");
    predict(true);
    reveal();
    matched();
    edit("Number of vertices", "0");
    predict(false);
    reveal();
    matched();
    edit("Number of vertices", "1");
    predict(true);
    reveal();
    matched();
  });

  it("does not turn a successful finite prime prefix into a universal proof", () => {
    render(<LogicLab initialMode="counterexamples" />);
    choose("Claim to inspect", "prime-quadratic");
    fill({ "Polynomial constant k": "41", "Last checked index": "39" });
    predict(false);
    reveal();
    matched();
    edit("Last checked index", "40");
    predict(true);
    reveal();
    matched();
    choose("Claim to inspect", "integer-implication");
    predict(false);
    reveal();
    matched();
    choose("Claim to inspect", "prime-quadratic");
    fill({ "Polynomial constant k": "4", "Last checked index": "0" });
    predict(true);
    reveal();
    matched(); // The first failed check is n=0, which must not be lost through truthiness.
  });
});

describe("logic explorer raw drafts and recovery within a visit", () => {
  const numericModes = LOGIC_MODES.filter((mode) => logicFields(mode, defaultLogicScene(mode)).length > 0);
  it.each(numericModes)(
    "keeps malformed and out-of-bounds %s controls visible without revealing stale evidence",
    (mode) => {
      render(<LogicLab initialMode={mode} />);
      const field = logicFields(mode, defaultLogicScene(mode))[0]!;
      reveal();
      for (const value of ["", "Infinity", "NaN", "1.5", String(field.min - 1), String(field.max + 1)]) {
        edit(field.label, value);
        expect(screen.getByRole("textbox", { name: field.label })).toHaveValue(value);
        expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
        expect(document.querySelector("[data-answer-kind]")).not.toBeInTheDocument();
      }
      edit(field.label, String(defaultLogicScene(mode)[field.key]));
      expect(screen.getByRole("button", { name: "Reveal result" })).toBeEnabled();
    },
  );

  it("preserves per-mode raw inputs, predictions and reflections while invalidating old results", () => {
    render(<LogicLab initialMode="truth" />);
    choose("Formula pair", "contrapositive");
    predict(true);
    reveal();
    edit("Explain your reasoning", "Use the whole truth table, not one assignment.");
    choose("Experiment", "quantifiers");
    fill({ "Size of X": "2", "Size of Y": "2" });
    choose("Predicate", "equal");
    choose("Quantifier order", "forall-exists");
    predict(true);
    reveal();
    edit("Explain your reasoning", "Each x can choose its own witness y.");
    edit("Size of X", "");
    choose("Experiment", "truth");
    expect(screen.getByRole("combobox", { name: "Formula pair" })).toHaveValue("contrapositive");
    expect(screen.getByRole("combobox", { name: "Your prediction" })).toHaveValue("true");
    expect(document.querySelector("[data-answer-kind]")).not.toBeInTheDocument();
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue(
      "Use the whole truth table, not one assignment.",
    );
    choose("Experiment", "quantifiers");
    expect(screen.getByRole("textbox", { name: "Size of X" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
    edit("Size of X", "2");
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue(
      "Each x can choose its own witness y.",
    );
    edit("Explain your reasoning", "x".repeat(4100));
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue("x".repeat(4000));
  });

  it("clears only the current preset/reset prediction while preserving notes and other mode drafts", () => {
    render(<LogicLab initialMode="truth" />);
    predict(false);
    reveal();
    edit("Explain your reasoning", "A converse needs a separate argument.");
    choose("Experiment", "diagonal");
    edit("Your prediction", "0".repeat(defaultLogicScene("diagonal").wordSize));
    choose("Experiment", "truth");
    const presets = LOGIC_PRESETS.filter((preset) => preset.mode === "truth");
    expect(presets.length).toBeGreaterThan(1);
    choose("Preset", presets[1]!.id);
    expect(screen.getByRole("combobox", { name: "Your prediction" })).toHaveValue("");
    expect(document.querySelector("[data-answer-kind]")).not.toBeInTheDocument();
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue(
      "A converse needs a separate argument.",
    );
    predict(true);
    fireEvent.click(screen.getByRole("button", { name: "Reset experiment" }));
    expect(screen.getByRole("combobox", { name: "Your prediction" })).toHaveValue("");
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue(
      "A converse needs a separate argument.",
    );
    choose("Experiment", "diagonal");
    expect(screen.getByRole("textbox", { name: "Your prediction" })).toHaveValue(
      "0".repeat(defaultLogicScene("diagonal").wordSize),
    );
  });
});

describe("logic explorer SSR hydration", () => {
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

  it.each(LOGIC_MODES)("hydrates default %s controls after an actual HTML parse", async (mode) => {
    await hydrate(<LogicLab initialMode={mode} />, (container) => {
      expect(within(container).getByRole("combobox", { name: "Experiment" })).toHaveValue(mode);
      expect(within(container).getByRole("button", { name: "Reveal result" })).toBeEnabled();
    });
  });

  it.each(LOGIC_MODES)("hydrates revealed %s evidence after an actual HTML parse", async (mode) => {
    const result = model(mode),
      definition = mode === "proof" ? LOGIC_PROOFS[defaultLogicScene(mode).proof] : undefined;
    await hydrate(<LogicEvidence result={result} proof={definition} />, (container) => {
      const tables = within(container).queryAllByRole("table");
      expect(tables).toHaveLength(result.tables.length);
      tables.forEach((table, index) =>
        expect(within(table).getAllByRole("row")).toHaveLength(result.tables[index]!.rows.length + 1),
      );
      if (result.proofFeedback) {
        const review = within(container).getByRole("region", { name: "Proof dependency review" });
        expect(within(review).getAllByRole("listitem")).toHaveLength(result.proofFeedback.length);
      }
      for (const svg of container.querySelectorAll("svg")) expect(svg.outerHTML).not.toMatch(/NaN|Infinity/);
    });
  });
});
