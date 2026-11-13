import katex from "katex";
import { describe, expect, it } from "vitest";
import { defaultLogicScene, evaluateLogic, LOGIC_PRESETS, LOGIC_PROOFS } from "@/lib/logic-lab";
import {
  LOGIC_MODES,
  logicChoices,
  logicFields,
  type LogicMode,
  type LogicResult,
  type LogicScene,
} from "@/lib/logic-lab-types";

const range = (n: number, first = 0) => Array.from({ length: n }, (_, i) => i + first);
function model(mode: LogicMode, patch: Partial<LogicScene> = {}): LogicResult {
  const result = evaluateLogic(mode, { ...defaultLogicScene(mode), ...patch });
  expect(result.error).toBeNull();
  return result;
}
function value(mode: LogicMode, patch: Partial<LogicScene> = {}): boolean {
  const answer = model(mode, patch).answer;
  expect(answer?.kind).toBe("boolean");
  if (answer?.kind !== "boolean") throw new Error("Expected a Boolean answer");
  return answer.value;
}
function fact(result: LogicResult, label: string) {
  const found = result.facts.find((item) => item.label === label);
  expect(found, `Missing ${label}`).toBeDefined();
  return found!.value;
}
function permutations(items: string[]): string[][] {
  return items.length === 0
    ? [[]]
    : items.flatMap((id, index) =>
        permutations(items.filter((_, i) => i !== index)).map((tail) => [id, ...tail]),
      );
}
function primeByDivisors(n: number): boolean {
  return n >= 2 && range(n - 2, 2).every((d) => n % d !== 0);
}
function allText(result: LogicResult): string[] {
  return [
    ...result.setup,
    result.target,
    result.answer?.display ?? "",
    ...result.steps,
    ...result.observations,
    result.reflection,
    ...result.facts.flatMap((item) => [item.label, item.value]),
    ...result.tables.flatMap((table) => [table.caption, ...table.headers, ...table.rows.flat()]),
  ];
}

describe("public logic experiment contract and bounded inputs", () => {
  it("starts every mode with exactly its first described preset and independent mutable drafts", () => {
    expect(new Set(LOGIC_PRESETS.map((item) => item.id)).size).toBe(LOGIC_PRESETS.length);
    for (const mode of LOGIC_MODES) {
      const presets = LOGIC_PRESETS.filter((item) => item.mode === mode);
      expect(presets.length).toBeGreaterThanOrEqual(3);
      expect(defaultLogicScene(mode)).toEqual(presets[0].scene);
      const original = defaultLogicScene(mode);
      const copy = structuredClone(original);
      Object.freeze(original.words);
      Object.freeze(original.proofOrder);
      evaluateLogic(mode, Object.freeze(original));
      expect(original).toEqual(copy);
      const changed = defaultLogicScene(mode);
      changed.words[0] = "111111";
      changed.proofOrder.reverse();
      expect(defaultLogicScene(mode)).toEqual(copy);
      expect(presets[0].scene).toEqual(copy);
    }
  });

  it("has strict KaTeX in every preset, revealed table and supplied proof step", () => {
    const texts: string[] = [];
    for (const preset of LOGIC_PRESETS) {
      const result = evaluateLogic(preset.mode, preset.scene);
      expect(result.error, preset.id).toBeNull();
      expect(result.setup.length).toBeGreaterThan(0);
      expect(result.target.length).toBeGreaterThan(20);
      expect(result.answer).not.toBeNull();
      expect(result.reflection.length).toBeGreaterThan(30);
      texts.push(...allText(result));
    }
    texts.push(...Object.values(LOGIC_PROOFS).flatMap((proof) => proof.steps.map((step) => step.text)));
    let expressions = 0;
    for (const text of texts) {
      expect((text.match(/\$/g) ?? []).length % 2, text).toBe(0);
      for (const match of text.matchAll(/\$([^$\n]+)\$/g)) {
        expressions++;
        expect(
          () =>
            katex.renderToString(match[1], {
              throwOnError: true,
              strict: "error",
              trust: false,
              maxExpand: 500,
            }),
          match[1],
        ).not.toThrow();
      }
    }
    expect(expressions).toBeGreaterThan(100);
  });

  it("keeps complete bounded tables rectangular and every Boolean answer contextual", () => {
    for (const preset of LOGIC_PRESETS) {
      const output = model(preset.mode, preset.scene);
      for (const table of output.tables) {
        expect(table.rows.length).toBeLessThanOrEqual(41);
        expect(
          table.rows.every((row) => row.length === table.headers.length),
          `${preset.id}: ${table.caption}`,
        ).toBe(true);
      }
      if (output.answer?.kind === "boolean") {
        expect(output.answer.display.length).toBeGreaterThan(15);
        expect(output.setup.join(" ")).not.toContain(output.answer.display);
      }
    }
  });

  it("validates every active numerical bound and choice without coercion", () => {
    for (const preset of LOGIC_PRESETS) {
      for (const field of logicFields(preset.mode, preset.scene)) {
        for (const invalid of [field.min - 1, field.max + 1, 0.5, NaN, Infinity, "1", true]) {
          const result = evaluateLogic(preset.mode, { ...preset.scene, [field.key]: invalid } as LogicScene);
          expect(result.error, `${preset.id}: ${field.key} ${String(invalid)}`).toMatch(/whole number/);
          expect(result.answer).toBeNull();
          expect(result.tables).toEqual([]);
        }
      }
      for (const choice of logicChoices(preset.mode, preset.scene)) {
        expect(
          evaluateLogic(preset.mode, { ...preset.scene, [choice.key]: "unknown" } as LogicScene).error,
        ).toMatch(/valid/);
      }
    }
    expect(evaluateLogic("bad" as LogicMode, defaultLogicScene("truth")).error).toMatch(/supported/);
    expect(evaluateLogic("truth", null as unknown as LogicScene).error).toMatch(/controls/);
  });

  it("ignores inactive controls while preserving exact active proof and binary-word validation", () => {
    expect(model("truth", { xSize: NaN, words: [], proofOrder: [] }).error).toBeNull();
    expect(model("induction", { induction: "false-step", baseIndex: NaN }).error).toBeNull();
    expect(
      model("order", { orderFamily: "reciprocal", right: NaN, leftEnd: "bad" as LogicScene["leftEnd"] })
        .error,
    ).toBeNull();
    expect(model("invariants", { invariant: "graph", start: NaN, target: NaN }).error).toBeNull();
    const proof = defaultLogicScene("proof");
    for (const order of [
      [],
      [...proof.proofOrder, "extra"],
      proof.proofOrder.map(() => "assume-even"),
      [1, ...proof.proofOrder.slice(1)],
    ]) {
      expect(evaluateLogic("proof", { ...proof, proofOrder: order } as LogicScene).error).toMatch(
        /exactly once/,
      );
    }
    const diagonal = defaultLogicScene("diagonal");
    for (const words of [
      [],
      ["000", "111"],
      ["000", "111", "01x"],
      ["000", "111", "0111"],
      ["000", "111", 101],
    ]) {
      expect(evaluateLogic("diagonal", { ...diagonal, words } as LogicScene).error).toMatch(/binary words/);
    }
  });
});

describe("complete truth tables and exact finite quantifiers", () => {
  it.each([
    ["converse", false, 2, 4],
    ["contrapositive", true, 0, 4],
    ["demorgan", true, 0, 4],
    ["distributivity", true, 0, 8],
    ["xor", false, 1, 4],
  ] as const)("exhausts assignments for %s", (truthPair, expected, mismatchCount, rows) => {
    const output = model("truth", { truthPair });
    expect(output.answer).toMatchObject({ kind: "boolean", value: expected });
    const table = output.tables[0];
    expect(table.rows).toHaveLength(rows);
    const arity = rows === 8 ? 3 : 2;
    expect(new Set(table.rows.map((row) => row.slice(0, arity).join())).size).toBe(rows);
    expect(table.rows.filter((row) => row.at(-1) === "No")).toHaveLength(mismatchCount);
  });

  it("matches closed-form equality-quantifier conditions, including both empty domains", () => {
    for (let xSize = 0; xSize <= 6; xSize++)
      for (let ySize = 0; ySize <= 6; ySize++) {
        const expected = {
          "forall-forall": xSize === 0 || ySize === 0 || (xSize === 1 && ySize === 1),
          "forall-exists": xSize === 0 || xSize <= ySize,
          "exists-forall": xSize > 0 && ySize <= 1,
          "exists-exists": xSize > 0 && ySize > 0,
        };
        for (const quantifier of Object.keys(expected) as LogicScene["quantifier"][]) {
          const output = model("quantifiers", { xSize, ySize, quantifier, predicate: "equal" });
          expect(output.answer?.value).toBe(expected[quantifier]);
          expect(fact(output, "Negation's truth value")).toBe(expected[quantifier] ? "False" : "True");
        }
      }
  });

  it("uses extremal witnesses for strict inequalities and non-strict bounded sums", () => {
    for (let xSize = 0; xSize <= 6; xSize++)
      for (let ySize = 0; ySize <= 6; ySize++) {
        const less = {
          "forall-forall": xSize === 0 || ySize === 0,
          "forall-exists": xSize === 0 || ySize > xSize,
          "exists-forall": xSize > 0 && ySize === 0,
          "exists-exists": xSize > 0 && ySize >= 2,
        };
        for (const quantifier of Object.keys(less) as LogicScene["quantifier"][]) {
          expect(value("quantifiers", { xSize, ySize, quantifier, predicate: "less" })).toBe(
            less[quantifier],
          );
        }
        for (const threshold of [0, 1, 5, 10, 12]) {
          const sum = {
            "forall-forall": xSize === 0 || ySize === 0 || threshold >= xSize + ySize - 2,
            "forall-exists": xSize === 0 || (ySize > 0 && threshold >= xSize - 1),
            "exists-forall": xSize > 0 && (ySize === 0 || threshold >= ySize - 1),
            "exists-exists": xSize > 0 && ySize > 0,
          };
          for (const quantifier of Object.keys(sum) as LogicScene["quantifier"][]) {
            expect(
              value("quantifiers", { xSize, ySize, quantifier, threshold, predicate: "sum-at-most" }),
            ).toBe(sum[quantifier]);
          }
        }
      }
  });

  it("does not confuse dependent witnesses with one common witness", () => {
    expect(
      value("quantifiers", { predicate: "equal", xSize: 3, ySize: 3, quantifier: "forall-exists" }),
    ).toBe(true);
    expect(
      value("quantifiers", { predicate: "equal", xSize: 3, ySize: 3, quantifier: "exists-forall" }),
    ).toBe(false);
    const witnesses = model("quantifiers", {
      predicate: "equal",
      xSize: 3,
      ySize: 3,
      quantifier: "forall-exists",
    }).tables[1].rows;
    expect(witnesses.map((row) => row[2])).toEqual(["Witness y = 0", "Witness y = 1", "Witness y = 2"]);
  });
});

describe("proof dependencies and induction coverage", () => {
  it("accepts exactly the independent branch permutations and keeps proof metadata well formed", () => {
    const expectedCounts = { "even-sum": 4, "square-parity": 2, "no-largest-integer": 2 };
    for (const proof of Object.keys(LOGIC_PROOFS) as LogicScene["proof"][]) {
      const definition = LOGIC_PROOFS[proof];
      const ids = definition.steps.map((step) => step.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(
        definition.steps.every((step) => step.requires.every((id) => ids.includes(id) && id !== step.id)),
      ).toBe(true);
      let accepted = 0;
      for (const proofOrder of permutations(ids)) {
        const reference = definition.steps.every((step) =>
          step.requires.every((id) => proofOrder.indexOf(id) < proofOrder.indexOf(step.id)),
        );
        const output = model("proof", { proof, proofOrder });
        expect(output.answer?.value).toBe(reference);
        if (reference) accepted++;
      }
      expect(accepted).toBe(expectedCounts[proof]);
      expect(value("proof", { proof, proofOrder: definition.defaultOrder })).toBe(false);
    }
  });

  it("does not establish a dependent conclusion using an earlier unjustified rewrite", () => {
    const output = model("proof", {
      proof: "even-sum",
      proofOrder: ["assume-even", "write-a", "rewrite", "write-b", "integer", "conclude"],
    });
    expect(output.proofFeedback?.[2]).toEqual({
      id: "rewrite",
      position: 3,
      missing: ["write-b"],
      valid: false,
    });
    expect(output.proofFeedback?.[4].valid).toBe(true);
    expect(output.proofFeedback?.[5]).toEqual({
      id: "conclude",
      position: 6,
      missing: ["rewrite"],
      valid: false,
    });
    expect(output.steps.join(" ")).toMatch(/earlier unjustified/);
  });

  it("separates a true odd-sum claim from missing induction coverage", () => {
    for (let baseIndex = 1; baseIndex <= 5; baseIndex++) {
      const output = model("induction", { induction: "odd-sum", baseIndex, displayTerms: 12 });
      expect(output.answer?.value).toBe(baseIndex === 1);
      expect(fact(output, "Supplied base case holds")).toBe("Yes");
      expect(fact(output, "Proposed inductive step is valid")).toBe("Yes");
      expect(fact(output, "Advertised universal claim is true")).toBe("Yes");
      expect(output.tables[0].rows.every((row) => row[1] === row[2])).toBe(true);
      if (baseIndex > 1) expect(output.steps.join(" ")).toContain(`1 through ${baseIndex - 1}`);
    }
  });

  it("rejects a false shifted claim even when a later base and forward step hold", () => {
    for (let baseIndex = 1; baseIndex <= 5; baseIndex++) {
      const output = model("induction", { induction: "shifted-base", baseIndex });
      expect(output.answer?.value).toBe(false);
      expect(fact(output, "Supplied base case holds")).toBe(baseIndex === 1 ? "No" : "Yes");
      expect(fact(output, "Proposed inductive step is valid")).toBe("Yes");
      expect(output.tables[0].rows[0].at(-1)).toBe("No");
    }
  });

  it("finds the missing cross-term in the false n² = n induction", () => {
    const output = model("induction", { induction: "false-step" });
    expect(output.answer?.value).toBe(false);
    expect(fact(output, "Supplied base case holds")).toBe("Yes");
    expect(fact(output, "Proposed inductive step is valid")).toBe("No");
    expect(output.tables[0].rows.slice(0, 2).map((row) => row.at(-1))).toEqual(["Yes", "No"]);
    expect(output.steps.join(" ")).toContain("2k");
    for (let k = 1; k <= 12; k++) expect((k + 1) ** 2 - (k * k + 1)).toBe(2 * k);
  });
});

describe("finite functions, diagonals and real bounds", () => {
  it("uses complete residue blocks to decide injectivity and surjectivity for every bounded map", () => {
    for (let domainSize = 0; domainSize <= 8; domainSize++)
      for (let modulus = 1; modulus <= 6; modulus++)
        for (let shift = -5; shift <= 5; shift++) {
          const output = model("sets", { domainSize, modulus, shift });
          expect(fact(output, "Injective")).toBe(domainSize <= modulus ? "Yes" : "No");
          expect(fact(output, "Surjective onto C")).toBe(domainSize >= modulus ? "Yes" : "No");
          expect(fact(output, "Bijective")).toBe(domainSize === modulus ? "Yes" : "No");
          for (const row of output.tables[0].rows) {
            const x = Number(row[0]),
              y = Number(row[1]);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThan(modulus);
            expect((x + shift - y) / modulus).toBe(Math.trunc((x + shift - y) / modulus));
          }
        }
  });

  it("distinguishes one selected subset's equality from global map properties", () => {
    const base = { domainSize: 6, modulus: 4, shift: 1 };
    const emptyA = model("sets", { ...base, cut: 0, property: "preimage-equality" });
    expect(emptyA.answer?.value).toBe(true);
    expect(fact(emptyA, "Injective")).toBe("No");
    const emptyB = model("sets", { domainSize: 1, modulus: 4, target: -1, property: "image-equality" });
    expect(emptyB.answer?.value).toBe(true);
    expect(fact(emptyB, "Surjective onto C")).toBe("No");
    const expanded = model("sets", {
      domainSize: 6,
      modulus: 3,
      shift: -1,
      cut: 2,
      property: "preimage-equality",
    });
    expect(expanded.answer?.value).toBe(false);
    expect(expanded.tables[1].rows.find((row) => row[0] === "f⁻¹(f(A))")?.[1]).toBe("{0, 1, 3, 4}");
    expect(expanded.steps.join(" ")).toMatch(/particular chosen subset/);
  });

  it("constructs antidiagonals by an independently checked difference at every row", () => {
    for (let n = 1; n <= 6; n++) {
      const words = range(n).map((row) =>
        range(n)
          .map((column) => ((row + column * 2) % 3 === 0 ? "1" : "0"))
          .join(""),
      );
      const output = model("diagonal", { wordSize: n, words });
      expect(output.answer?.kind).toBe("word");
      const word = String(output.answer?.value);
      expect(word).toHaveLength(n);
      words.forEach((row, index) => {
        expect(word[index]).not.toBe(row[index]);
        expect(word).not.toBe(row);
      });
      expect(output.steps.join(" ")).toMatch(/not uncountability by itself/);
    }
    expect(model("diagonal", { wordSize: 3, words: ["000", "000", "000"] }).answer?.value).toBe("111");
  });

  it("distinguishes empty intervals, singletons and endpoint attainment throughout the bounded domain", () => {
    for (let left = -4; left <= 4; left++)
      for (let right = -4; right <= 4; right++)
        for (const leftEnd of ["open", "closed"] as const)
          for (const rightEnd of ["open", "closed"] as const) {
            const nonempty =
              left < right || (left === right && leftEnd === "closed" && rightEnd === "closed");
            const output = model("order", {
              left,
              right,
              leftEnd,
              rightEnd,
              orderFamily: "interval",
              orderProperty: "nonempty",
            });
            expect(output.answer?.value).toBe(nonempty);
            expect(fact(output, "Infimum in ℝ")).toBe(nonempty ? String(left) : "Does not exist");
            expect(fact(output, "Supremum in ℝ")).toBe(nonempty ? String(right) : "Does not exist");
            expect(fact(output, "Minimum")).toBe(
              nonempty && leftEnd === "closed" ? String(left) : "Does not exist",
            );
            expect(fact(output, "Maximum")).toBe(
              nonempty && rightEnd === "closed" ? String(right) : "Does not exist",
            );
            if (!nonempty)
              expect(output.steps.join(" ")).toContain(
                "Every real number is an upper bound and a lower bound",
              );
          }
  });

  it("derives reciprocal extrema analytically and never assigns the prefix minimum to the infinite set", () => {
    for (let left = -3; left <= 3; left++)
      for (let start = 1; start <= 5; start++) {
        const output = model("order", {
          orderFamily: "reciprocal",
          left,
          start,
          displayTerms: 12,
          orderProperty: "minimum",
        });
        expect(output.answer?.value).toBe(false);
        expect(fact(output, "Infimum in ℝ")).toBe(String(left));
        expect(fact(output, "Minimum")).toBe("Does not exist");
        const parse = (s: string) =>
          s.includes("/") ? Number(s.split("/")[0]) / Number(s.split("/")[1]) : Number(s);
        expect(parse(fact(output, "Supremum in ℝ"))).toBeCloseTo(left + 1 / start, 12);
        const rows = output.tables[0].rows;
        expect(rows[0][2]).toBe("Yes");
        for (let i = 0; i < rows.length; i++) {
          expect(parse(rows[i][1])).toBeCloseTo(left + 1 / (start + i), 12);
          expect(rows[i][3]).toBe("No");
        }
        expect(output.steps.join(" ")).toContain("n > 1/ε");
        expect(value("order", { orderFamily: "reciprocal", left, start, orderProperty: "maximum" })).toBe(
          true,
        );
      }
  });
});

describe("constructive invariants and honest finite counterexample searches", () => {
  it("constructs legal nonnegative paths for matching parity, including zero moves", () => {
    for (let start = 0; start <= 20; start++)
      for (let target = 0; target <= 20; target++) {
        const output = model("invariants", { invariant: "parity", start, target });
        const reachable = (start + target) % 2 === 0;
        expect(output.answer?.value).toBe(reachable);
        if (reachable) {
          const states = output.tables[0].rows.map((row) => Number(row[1]));
          expect(states[0]).toBe(start);
          expect(states.at(-1)).toBe(target);
          expect(states.every((state) => state >= 0)).toBe(true);
          expect(states.slice(1).every((state, index) => Math.abs(state - states[index]) === 2)).toBe(true);
          expect(states.length - 1).toBe(Math.abs(target - start) / 2);
        }
      }
  });

  it("checks all bounded graph families against an independent transitive-closure cycle detector", () => {
    for (let graphSize = 0; graphSize <= 8; graphSize++)
      for (const wrap of ["no", "yes"] as const) {
        const reach = range(graphSize).map((i) =>
          range(graphSize).map(
            (j) => j - i === 1 || j - i === 2 || (wrap === "yes" && i === graphSize - 1 && j === 0),
          ),
        );
        for (let k = 0; k < graphSize; k++)
          for (let i = 0; i < graphSize; i++)
            for (let j = 0; j < graphSize; j++) reach[i][j] ||= reach[i][k] && reach[k][j];
        const expected = range(graphSize).some((i) => reach[i][i]);
        const output = model("invariants", { invariant: "graph", graphSize, wrap });
        expect(output.answer?.value).toBe(expected);
        if (graphSize === 0) expect(output.tables[0].rows).toEqual([]);
        if (graphSize === 1 && wrap === "yes") expect(output.tables[0].rows).toEqual([["0", "0", "0", "No"]]);
      }
  });

  it("checks polynomial primes independently and treats index zero as a genuine first failure", () => {
    for (let primeOffset = 2; primeOffset <= 41; primeOffset++) {
      const output = model("counterexamples", {
        counterexample: "prime-quadratic",
        primeOffset,
        searchLimit: 40,
      });
      const first = range(41).find((n) => !primeByDivisors(n * n + n + primeOffset));
      expect(output.answer?.value).toBe(first !== undefined);
      expect(fact(output, "First failure in displayed prefix")).toBe(
        `n = ${first}, value = ${first! * first! + first! + primeOffset}`,
      );
      expect(
        output.tables[0].rows.every((row) => (row[2] === "Yes") === primeByDivisors(Number(row[1]))),
      ).toBe(true);
      expect((primeOffset - 1) ** 2 + primeOffset - 1 + primeOffset).toBe(primeOffset ** 2);
      expect(primeByDivisors(primeOffset ** 2)).toBe(false);
    }
    expect(
      value("counterexamples", { counterexample: "prime-quadratic", primeOffset: 4, searchLimit: 0 }),
    ).toBe(true);
    expect(
      value("counterexamples", { counterexample: "prime-quadratic", primeOffset: 41, searchLimit: 39 }),
    ).toBe(false);
    expect(
      value("counterexamples", { counterexample: "prime-quadratic", primeOffset: 41, searchLimit: 40 }),
    ).toBe(true);
  });

  it("keeps outside-search witnesses separate from the prefix's Boolean result", () => {
    for (const searchLimit of [0, 1, 8, 40]) {
      const output = model("counterexamples", { counterexample: "integer-implication", searchLimit });
      expect(output.answer?.value).toBe(false);
      expect(output.tables[0].rows).toHaveLength(searchLimit + 1);
      expect(output.tables[0].rows.every((row) => Number(row[0]) >= 0 && row.at(-1) === "No")).toBe(true);
      expect(output.steps.join(" ")).toContain("n = −1");
      expect((-1) ** 2 >= -1 && !(-1 >= 0)).toBe(true);
    }
  });

  it("handles an empty positive prefix without mistaking no failures for a universal proof", () => {
    const empty = model("counterexamples", { counterexample: "odd-sum", searchLimit: 0 });
    expect(empty.answer?.value).toBe(false);
    expect(empty.tables[0].rows).toEqual([]);
    expect(fact(empty, "Values checked")).toBe("0");
    expect(empty.steps.join(" ")).toContain("finite observation alone is not a proof");
    const full = model("counterexamples", { counterexample: "odd-sum", searchLimit: 40 });
    expect(full.tables[0].rows.every((row) => row[1] === row[2])).toBe(true);
    expect(full.steps.join(" ")).toContain("Induction proves");
  });
});
