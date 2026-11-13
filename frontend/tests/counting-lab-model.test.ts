import katex from "katex";
import { describe, expect, it } from "vitest";
import {
  binomial,
  COUNTING_PRESETS,
  defaultCountingScene,
  evaluateCounting,
  factorial,
} from "@/lib/counting-lab";
import {
  COUNTING_FIELDS,
  COUNTING_MODES,
  type CountingMode,
  type CountingScene,
} from "@/lib/counting-lab-types";

const scene = (mode: CountingMode, overrides: Partial<CountingScene> = {}) => ({
  ...defaultCountingScene(mode),
  ...overrides,
});
const run = (mode: CountingMode, overrides: Partial<CountingScene> = {}) =>
  evaluateCounting(mode, scene(mode, overrides));
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
// These finite reference enumerations deliberately use no model counting helpers.
function tuples<T>(alphabet: readonly T[], length: number): T[][] {
  let values: T[][] = [[]];
  for (let position = 0; position < length; position += 1)
    values = values.flatMap((prefix) => alphabet.map((item) => [...prefix, item]));
  return values;
}
const range = (length: number) => Array.from({ length }, (_, index) => index);
function subsets(n: number, r: number): number[][] {
  return range(2 ** n)
    .map((mask) =>
      range(n)
        .filter((index) => (mask & (1 << index)) !== 0)
        .map((index) => index + 1),
    )
    .filter((values) => values.length === r);
}
function allocationReference(n: number, k: number, minimum: number): number[][] {
  return tuples(range(n + 1), k).filter(
    (values) => sum(values) === n && values.every((value) => value >= minimum),
  );
}
function sharpBoundReference(n: number, k: number): number {
  return Math.min(
    ...tuples(range(k), n).map((assignment) => {
      const occupancy = Array.from(
        { length: k },
        (_, box) => assignment.filter((value) => value === box).length,
      );
      return Math.max(...occupancy);
    }),
  );
}

describe("bounded counting arithmetic", () => {
  it("handles factorial and binomial boundaries exactly", () => {
    expect(factorial(0)).toBe(1);
    expect(factorial(8)).toBe(40320);
    expect(factorial(18)).toBe(6402373705728000);
    expect(binomial(0, 0)).toBe(1);
    expect(binomial(17, 5)).toBe(6188);
    expect(binomial(8, 9)).toBe(0);
    expect(binomial(8, -1)).toBe(0);
    for (const value of [-1, 1.5, 19, NaN, Infinity]) expect(() => factorial(value)).toThrow(RangeError);
    expect(() => binomial(5, 1.5)).toThrow(RangeError);
  });

  it("rejects invalid active controls without partially evaluating", () => {
    for (const mode of COUNTING_MODES)
      for (const field of COUNTING_FIELDS[mode]) {
        for (const value of [field.min - 1, field.max + 1, 0.5, NaN, Infinity]) {
          const result = run(mode, { [field.key]: value });
          expect(result.count, `${mode}.${field.key}=${value}`).toBeNull();
          expect(result.error).toContain(field.label);
          expect(result.groups).toEqual([]);
          expect(result.listing).toBeNull();
        }
      }
    expect(evaluateCounting("unknown" as CountingMode, scene("rules")).error).toBeTruthy();
    expect(evaluateCounting("rules", null as unknown as CountingScene).error).toBeTruthy();
    expect(run("rules", { rule: "other" as CountingScene["rule"] }).count).toBeNull();
    expect(run("selection", { selection: "other" as CountingScene["selection"] }).count).toBeNull();
  });

  it("ignores controls that do not belong to the active experiment", () => {
    expect(run("rules", { n: NaN, k: -100, r: Infinity, minimum: 99 }).count).toBe(8);
    expect(run("pigeonhole", { a: NaN, b: Infinity, c: -1, r: 99 }).count).toBe(4);
  });
});

describe("disjoint alternatives and ordered stages", () => {
  it("agrees with direct labelled outcomes for every bounded branch size", () => {
    for (let a = 0; a <= 6; a += 1)
      for (let b = 0; b <= 6; b += 1) {
        const A = range(a).map((index) => `A${index + 1}`),
          B = range(b).map((index) => `B${index + 1}`);
        for (const rule of ["sum", "product"] as const) {
          const expected = rule === "sum" ? [...A, ...B] : A.flatMap((x) => B.map((y) => `(${x}, ${y})`));
          const result = run("rules", { a, b, rule });
          expect(result.count).toBe(expected.length);
          expect(result.listing?.items).toEqual(expected);
          expect(sum(result.groups.map((group) => group.total))).toBe(expected.length);
        }
      }
  });

  it("keeps same-numbered alternatives distinct and renders explicit multiplication", () => {
    expect(run("rules", { a: 1, b: 1, rule: "sum" }).listing?.items).toEqual(["A1", "B1"]);
    expect(run("rules", { a: 4, b: 2, rule: "product" }).steps.join(" ")).toContain("4\\cdot 2=8");
  });
});

describe("selections without replacement", () => {
  it("agrees with a Cartesian-product filter and independent bit-mask subsets", () => {
    for (let n = 0; n <= 5; n += 1)
      for (let r = 0; r <= 5; r += 1) {
        const ordered = tuples(
          range(n).map((value) => value + 1),
          r,
        ).filter((values) => new Set(values).size === r);
        const unordered = subsets(n, r);
        for (const [selection, expected] of [
          ["ordered", ordered],
          ["unordered", unordered],
        ] as const) {
          const result = run("selection", { n, r, selection });
          expect(result.count, `${selection} ${n},${r}`).toBe(expected.length);
          expect(sum(result.groups.map((group) => group.total))).toBe(expected.length);
          expect(result.listing?.items.length).toBe(Math.min(40, expected.length));
        }
        if (r <= n)
          expect(ordered.length).toBe(
            unordered.length * tuples(range(r), r).filter((values) => new Set(values).size === r).length,
          );
      }
  });

  it("lists a deterministic prefix and partitions unordered subsets by their maximum", () => {
    const expected = tuples([1, 2, 3, 4, 5, 6], 4)
      .filter((values) => new Set(values).size === 4)
      .slice(0, 40)
      .map((values) => `(${values.join(", ")})`);
    expect(run("selection", { n: 6, r: 4, selection: "ordered" }).listing?.items).toEqual(expected);
    expect(
      run("selection", { n: 5, r: 3, selection: "unordered" }).groups.map(({ label, total }) => ({
        label,
        total,
      })),
    ).toEqual([
      { label: "Largest token 3", total: 1 },
      { label: "Largest token 4", total: 3 },
      { label: "Largest token 5", total: 6 },
    ]);
    const maximum = run("selection", { n: 8, r: 8, selection: "ordered" });
    expect(maximum.count).toBe(40320);
    expect(maximum.listing?.items).toHaveLength(40);
    expect(maximum.listing?.complete).toBe(false);
    expect(maximum.listing?.items[0]).toBe("(1, 2, 3, 4, 5, 6, 7, 8)");
  });

  it("distinguishes an empty selection from no feasible selection", () => {
    for (const selection of ["ordered", "unordered"] as const) {
      expect(run("selection", { n: 0, r: 0, selection }).count).toBe(1);
      expect(run("selection", { n: 0, r: 0, selection }).listing?.items).toHaveLength(1);
      expect(run("selection", { n: 0, r: 0, selection }).groupCaption).toContain("single empty selection");
      expect(run("selection", { n: 2, r: 3, selection }).listing).toMatchObject({
        total: 0,
        items: [],
        complete: true,
      });
    }
  });
});

describe("indistinguishable repeated symbols", () => {
  it("agrees with all small alphabet words filtered by their symbol counts", () => {
    for (let a = 0; a <= 2; a += 1)
      for (let b = 0; b <= 2; b += 1)
        for (let c = 0; c <= 2; c += 1) {
          const words = tuples(["A", "B", "C"], a + b + c)
            .map((letters) => letters.join(""))
            .filter(
              (word) =>
                [...word].filter((letter) => letter === "A").length === a &&
                [...word].filter((letter) => letter === "B").length === b &&
                [...word].filter((letter) => letter === "C").length === c,
            );
          const result = run("multinomial", { a, b, c });
          expect(result.count).toBe(words.length);
          expect(result.listing?.items).toEqual(words.slice(0, 40).map((word) => word || "(empty word)"));
          expect(sum(result.groups.map((group) => group.total))).toBe(words.length);
        }
  });

  it("shows only forty distinct words for the largest multiset", () => {
    const result = run("multinomial", { a: 4, b: 4, c: 4 });
    expect(result.count).toBe(34650);
    expect(result.listing).toMatchObject({ total: 34650, complete: false });
    expect(result.listing?.items).toHaveLength(40);
    for (const word of result.listing!.items)
      for (const letter of "ABC") expect([...word].filter((value) => value === letter)).toHaveLength(4);
    expect(result.groups.map((group) => group.total)).toEqual([11550, 11550, 11550]);
    expect(run("multinomial", { a: 0, b: 0, c: 0 }).groupCaption).toContain("single empty word");
  });
});

describe("identical-object allocations to labelled boxes", () => {
  it("agrees with Cartesian occupancy tuples including infeasible minima", () => {
    for (let n = 0; n <= 5; n += 1)
      for (let k = 1; k <= 4; k += 1)
        for (let minimum = 0; minimum <= 3; minimum += 1) {
          const expected = allocationReference(n, k, minimum);
          const result = run("allocations", { n, k, minimum });
          expect(result.count, `${n} objects, ${k} boxes, min ${minimum}`).toBe(expected.length);
          expect(result.listing?.items).toEqual(
            expected.slice(0, 40).map((values) => `(${values.join(", ")})`),
          );
          expect(sum(result.groups.map((group) => group.total))).toBe(expected.length);
        }
  });

  it("keeps every first-box case visible and limits only example tuples", () => {
    const result = run("allocations", { n: 12, k: 6, minimum: 0 });
    expect(result.count).toBe(6188);
    expect(result.groups).toHaveLength(13);
    expect(result.groups.at(-1)).toMatchObject({ label: "Box 1 receives 12", total: 1 });
    expect(sum(result.groups.map((group) => group.total))).toBe(6188);
    expect(result.listing).toMatchObject({ total: 6188, complete: false });
    expect(result.listing?.items).toHaveLength(40);
    expect(result.groups.flatMap((group) => group.items ?? [])).toHaveLength(40);
  });

  it("preserves the minimum-shift bijection and the unique zero allocation", () => {
    expect(run("allocations", { n: 11, k: 3, minimum: 2 }).count).toBe(
      run("allocations", { n: 5, k: 3, minimum: 0 }).count,
    );
    expect(run("allocations", { n: 0, k: 6, minimum: 0 }).listing?.items).toEqual(["(0, 0, 0, 0, 0, 0)"]);
    expect(run("allocations", { n: 5, k: 3, minimum: 2 }).listing).toMatchObject({
      total: 0,
      complete: true,
      items: [],
    });
    expect(run("allocations", { n: 12, k: 1, minimum: 3 }).listing?.items).toEqual(["(12)"]);
  });
});

describe("finite inclusion-exclusion", () => {
  it("agrees with independent set unions for overlapping, nested and coincident divisors", () => {
    for (let n = 0; n <= 12; n += 1)
      for (let a = 1; a <= 4; a += 1)
        for (let b = 1; b <= 4; b += 1)
          for (let c = 1; c <= 4; c += 1) {
            const universe = range(n).map((value) => value + 1);
            const members = new Set(
              [a, b, c].flatMap((divisor) => universe.filter((value) => value % divisor === 0)),
            );
            const result = run("inclusion", { n, a, b, c });
            expect(result.count).toBe(members.size);
            expect(result.listing?.items).toEqual([...members].sort((x, y) => x - y).map(String));
            expect(result.groups).toHaveLength(8);
            expect(sum(result.groups.map((group) => group.total))).toBe(n);
            expect(sum(result.groups.filter((group) => group.included).map((group) => group.total))).toBe(
              members.size,
            );
            expect(
              result.groups
                .flatMap((group) => group.items ?? [])
                .map(Number)
                .sort((x, y) => x - y),
            ).toEqual(universe);
          }
  });

  it("uses the actual intersections, including the outside region", () => {
    const result = run("inclusion", { n: 30, a: 2, b: 3, c: 7 });
    expect(result.count).toBe(21);
    expect(result.facts.find((fact) => fact.label === "A and B / A and C / B and C")?.value).toBe(
      "5 / 2 / 1",
    );
    expect(result.groups.find((group) => !group.included)).toMatchObject({ total: 9 });
    expect(
      run("inclusion", { n: 12, a: 3, b: 3, c: 3 })
        .groups.filter((group) => group.total > 0)
        .map((group) => group.total),
    ).toEqual([8, 4]);
    expect(run("inclusion", { n: 0 }).steps[0]).toContain("empty set");
    expect(run("inclusion", { n: 0 }).steps.join(" ")).not.toContain("1 through 0");
  });
});

describe("sharp largest-occupancy bounds", () => {
  it("equals the minimum maximum over every assignment in small domains", () => {
    for (let n = 0; n <= 6; n += 1)
      for (let k = 1; k <= 4; k += 1)
        expect(run("pigeonhole", { n, k }).count, `${n} objects in ${k} boxes`).toBe(
          sharpBoundReference(n, k),
        );
  });

  it("constructs a balanced witness and a strict capacity contradiction for every valid positive size", () => {
    for (let n = 0; n <= 30; n += 1)
      for (let k = 1; k <= 8; k += 1) {
        const result = run("pigeonhole", { n, k }),
          loads = result.groups.map((group) => group.total);
        expect(sum(loads)).toBe(n);
        expect(Math.max(...loads)).toBe(result.count);
        expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(1);
        expect(new Set(result.groups.flatMap((group) => group.items ?? [])).size).toBe(n);
        expect(result.listing).toMatchObject({ kind: "witness", total: 1, complete: true });
        expect(result.listing?.items).toHaveLength(1);
        if (n > 0) expect(k * (result.count! - 1)).toBeLessThan(n);
        else expect(result.steps.join(" ")).not.toContain("capacity");
      }
  });

  it("does not confuse a witness count with the occupancy bound or force collisions", () => {
    expect(run("pigeonhole", { n: 14, k: 4 })).toMatchObject({
      count: 4,
      listing: { total: 1, kind: "witness", items: ["(4, 4, 3, 3)"] },
    });
    expect(run("pigeonhole", { n: 6, k: 8 }).count).toBe(1);
    expect(run("pigeonhole", { n: 0, k: 8 })).toMatchObject({
      count: 0,
      listing: { items: ["(0, 0, 0, 0, 0, 0, 0, 0)"] },
    });
  });
});

describe("preset and mathematical presentation contract", () => {
  it("has eighteen original presets with independently specified expected counts", () => {
    expect(COUNTING_PRESETS).toHaveLength(18);
    expect(new Set(COUNTING_PRESETS.map((preset) => preset.id)).size).toBe(18);
    expect(COUNTING_PRESETS.map((preset) => evaluateCounting(preset.mode, preset.scene).count)).toEqual([
      8, 7, 0, 60, 10, 1, 60, 34650, 1, 21, 6, 0, 21, 4, 0, 4, 1, 0,
    ]);
    for (const mode of COUNTING_MODES) {
      expect(COUNTING_PRESETS.filter((preset) => preset.mode === mode)).toHaveLength(3);
      const copy = defaultCountingScene(mode),
        original = defaultCountingScene(mode);
      copy.n = 999;
      expect(defaultCountingScene(mode)).toEqual(original);
    }
  });

  it("provides bounded unique deterministic listings with honest completeness labels", () => {
    for (const preset of COUNTING_PRESETS) {
      const result = evaluateCounting(preset.mode, preset.scene),
        listing = result.listing!;
      expect(result.error).toBeNull();
      expect(Number.isSafeInteger(result.count)).toBe(true);
      expect(listing.items.length).toBeLessThanOrEqual(40);
      expect(new Set(listing.items).size).toBe(listing.items.length);
      expect(listing.complete).toBe(listing.items.length === listing.total);
      expect(evaluateCounting(preset.mode, preset.scene)).toEqual(result);
      if (listing.kind === "outcomes") expect(listing.total).toBe(result.count);
      for (const group of result.groups) {
        expect(Number.isSafeInteger(group.total)).toBe(true);
        expect(group.total).toBeGreaterThanOrEqual(0);
        expect(group.items?.length ?? 0).toBeLessThanOrEqual(40);
      }
    }
  });

  it("renders every authored mathematical fragment with strict KaTeX", () => {
    for (const preset of COUNTING_PRESETS) {
      const result = evaluateCounting(preset.mode, preset.scene);
      const strings = [
        ...result.steps,
        ...result.observations,
        ...result.facts.flatMap((fact) => [fact.label, fact.value]),
        result.groupCaption,
      ];
      for (const text of strings) {
        expect((text.match(/\$/g) ?? []).length % 2).toBe(0);
        for (const match of text.matchAll(/\$([^$]+)\$/g))
          expect(
            () => katex.renderToString(match[1]!, { throwOnError: true, strict: "error" }),
            text,
          ).not.toThrow();
      }
    }
  });
});
