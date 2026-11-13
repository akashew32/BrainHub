import katex from "katex";
import { describe, expect, it } from "vitest";
import {
  LAB_PRESETS,
  add2,
  apply2,
  defaultScene,
  determinant2,
  dot2,
  evaluateScene,
  formatScalar,
  formatVector,
  multiply2,
  scale2,
} from "@/lib/linear-algebra-lab";
import {
  LAB_MODES,
  type GeometryOperation,
  type LabExperiment,
  type LabMode,
  type LabScene,
  type Mat2,
  type Vec2,
} from "@/lib/linear-algebra-lab-types";

// Reference calculations deliberately do not call the model's arithmetic helpers.
const mv = (M: Mat2, x: Vec2): Vec2 => [M[0][0] * x[0] + M[0][1] * x[1], M[1][0] * x[0] + M[1][1] * x[1]];
const det = (M: Mat2) => M[0][0] * M[1][1] - M[1][0] * M[0][1];
const fact = (result: LabExperiment, label: string) => {
  const item = result.facts.find((entry) => entry.label === label);
  expect(item, `Missing fact ${label}`).toBeDefined();
  return item!.value;
};
const scene = (mode: LabMode, overrides: Partial<LabScene> = {}) => ({ ...defaultScene(mode), ...overrides });
function close(actual: Vec2 | null, expected: Vec2) {
  expect(actual).not.toBeNull();
  expect(actual![0]).toBeCloseTo(expected[0], 11);
  expect(actual![1]).toBeCloseTo(expected[1], 11);
}
const smallVectors: Vec2[] = Array.from({ length: 81 }, (_, index) => [
  Math.floor(index / 9) - 4,
  (index % 9) - 4,
]);
const smallMatrices: Mat2[] = Array.from({ length: 81 }, (_, index) => [
  [Math.floor(index / 27) - 1, (Math.floor(index / 9) % 3) - 1],
  [(Math.floor(index / 3) % 3) - 1, (index % 3) - 1],
]);

describe("linear algebra lab arithmetic and combinations", () => {
  it("uses coordinate arithmetic and row-by-column multiplication", () => {
    expect(add2([2, -3], [-4, 1])).toEqual([-2, -2]);
    expect(scale2(-2, [3, -1])).toEqual([-6, 2]);
    expect(dot2([2, -3], [-4, 1])).toBe(-11);
    const A: Mat2 = [
        [1, 2],
        [-1, 0],
      ],
      B: Mat2 = [
        [2, -1],
        [3, 1],
      ];
    expect(apply2(A, [3, -2])).toEqual([-1, -3]);
    expect(multiply2(A, B)).toEqual([
      [8, 1],
      [-2, 1],
    ]);
    expect(determinant2(A)).toBe(2);
  });

  it("distinguishes plane, line and zero spans, including nontrivial cancellation", () => {
    expect(
      evaluateScene("combinations", scene("combinations", { u: [2, -1], v: [-2, 1], a: 1, b: 1 })).output,
    ).toEqual([0, 0]);
    expect(
      fact(
        evaluateScene("combinations", scene("combinations", { u: [1, 0], v: [0, 1] })),
        "Span of the input directions",
      ),
    ).toBe("The whole coordinate plane");
    expect(
      fact(
        evaluateScene("combinations", scene("combinations", { u: [0, 0], v: [2, -3] })),
        "Span of the input directions",
      ),
    ).toBe("A line through the origin");
    expect(
      fact(
        evaluateScene("combinations", scene("combinations", { u: [0, 0], v: [0, 0] })),
        "Span of the input directions",
      ),
    ).toBe("Only the zero vector");
    for (const u of smallVectors) {
      const result = evaluateScene("combinations", scene("combinations", { u, v: [-1, 2], a: -3, b: 2 }));
      close(result.output, [-3 * u[0] - 2, -3 * u[1] + 4]);
      const shifted = result.vectors.find((arrow) => arrow.label === "shifted b v")!;
      close([shifted.to[0] - shifted.from[0], shifted.to[1] - shifted.from[1]], [-2, 4]);
    }
  });
});

describe("orthogonal projection", () => {
  it("retains exact rational coordinates and the perpendicular residual", () => {
    const result = evaluateScene("projection", scene("projection", { u: [3, 4], v: [2, -1] }));
    close(result.output, [4 / 5, -2 / 5]);
    expect(fact(result, "Projection p")).toBe("(4/5, -2/5)");
    expect(fact(result, "Residual u − p")).toBe("(11/5, 22/5)");
    expect(fact(result, "Projection coefficient")).toBe("2/5");
    expect(result.steps.join(" ")).toContain("\\frac{4}{5}");
    expect(fact(result, "Projection p")).not.toContain("rounded");
  });

  it("checks projection, perpendicularity and closest-point identities on all bounded vector pairs", () => {
    for (const u of smallVectors)
      for (const v of smallVectors) {
        if (v[0] === 0 && v[1] === 0) continue;
        const n = u[0] * v[0] + u[1] * v[1],
          d = v[0] ** 2 + v[1] ** 2;
        const result = evaluateScene("projection", scene("projection", { u, v }));
        const expected: Vec2 = [(n * v[0]) / d, (n * v[1]) / d];
        close(result.output, expected);
        expect(fact(result, "Residual dot direction")).toBe("0");
        // Any point p + v on the line is farther away by exactly ||v||².
        const r: Vec2 = [u[0] - expected[0], u[1] - expected[1]];
        const distance = r[0] ** 2 + r[1] ** 2;
        expect((r[0] - v[0]) ** 2 + (r[1] - v[1]) ** 2 - distance).toBeCloseTo(d, 10);
        close(evaluateScene("projection", scene("projection", { u, v: [-v[0], -v[1]] })).output, expected);
      }
  });

  it("allows zero input, distinguishes a missing line direction, and scales directions", () => {
    const zero = evaluateScene("projection", scene("projection", { u: [0, 0], v: [2, -1] }));
    expect(zero.output).toEqual([0, 0]);
    expect(zero.error).toBeNull();
    const invalid = evaluateScene("projection", scene("projection", { v: [0, 0] }));
    expect(invalid.output).toBeNull();
    expect(invalid.error).toMatch(/no line direction/i);
    expect(invalid.error).not.toMatch(/projection.*undefined/i);
    close(
      evaluateScene("projection", scene("projection", { u: [3, 1], v: [1, -2] })).output,
      evaluateScene("projection", scene("projection", { u: [3, 1], v: [-2, 4] })).output!,
    );
  });

  it("shows exact norms, approximate right/obtuse angles and no angle for zero input", () => {
    const right = evaluateScene("projection", scene("projection", { u: [3, 4], v: [4, -3] }));
    expect(fact(right, "Norm of u")).toBe("5");
    expect(fact(right, "Norm of v")).toBe("5");
    expect(fact(right, "Angle between u and v")).toBe("approximately 90° (rounded)");
    const obtuse = evaluateScene("projection", scene("projection", { u: [1, 0], v: [-1, 1] }));
    expect(fact(obtuse, "Norm of v")).toBe("√2 (exact)");
    expect(fact(obtuse, "Angle between u and v")).toBe("approximately 135° (rounded)");
    expect(
      fact(
        evaluateScene("projection", scene("projection", { u: [0, 0], v: [1, 1] })),
        "Angle between u and v",
      ),
    ).toMatch(/undefined.*zero/i);
    expect(
      fact(
        evaluateScene("projection", scene("projection", { u: [-2, -2], v: [1, 1] })),
        "Angle between u and v",
      ),
    ).toBe("approximately 180° (rounded)");
  });
});

describe("composition, rank and kernels", () => {
  it("applies the rightmost matrix first and reports concrete entry arithmetic", () => {
    const input = scene("matrices", { u: [1, 2] });
    const AB = evaluateScene("matrices", input),
      BA = evaluateScene("matrices", { ...input, order: "BA" });
    expect(AB.output).toEqual([4, 2]);
    expect(BA.output).toEqual([6, 2]);
    expect(fact(AB, "Intermediate Bu")).toBe("(2, 2)");
    expect(fact(BA, "Intermediate Au")).toBe("(3, 2)");
    expect(AB.steps[0]).toContain("(AB)_{11}=(1)(2)+(1)(0)=2");
    const coincident = evaluateScene("matrices", { ...input, u: [0, 0] });
    expect(fact(coincident, "Do these matrices commute?")).toBe("No");
    expect(coincident.observations.join(" ")).toContain("One matching input does not prove commutativity");
  });

  it("checks composition and determinant multiplication for every pair of small integer matrices", () => {
    for (const A of smallMatrices)
      for (const B of smallMatrices) {
        const x: Vec2 = [2, -3],
          expected = mv(A, mv(B, x));
        const product = multiply2(A, B);
        close(apply2(product, x), expected);
        expect(det(product)).toBeCloseTo(det(A) * det(B), 12);
      }
  });

  it("checks exact 2D ranks, null directions and image lines for every small integer matrix", () => {
    for (const A of smallMatrices) {
      const result = evaluateScene("maps", scene("maps", { A, u: [2, -1] }));
      const zero = A.flat().every((entry) => entry === 0),
        rank = zero ? 0 : det(A) === 0 ? 1 : 2;
      expect(fact(result, "Rank")).toBe(String(rank));
      expect(fact(result, "Area scale")).toBe(String(Math.abs(det(A))));
      close(result.output, mv(A, [2, -1]));
      if (rank === 1) {
        const kernel = result.vectors.find((arrow) => arrow.label === "kernel direction")!.to;
        expect(kernel.some((coordinate) => coordinate !== 0)).toBe(true);
        close(mv(A, kernel), [0, 0]);
        const direction = result.lineDirection!;
        for (const column of [
          [A[0][0], A[1][0]],
          [A[0][1], A[1][1]],
        ])
          expect(column[0]! * direction[1] - column[1]! * direction[0]).toBeCloseTo(0, 12);
      } else if (rank === 0) {
        expect(fact(result, "Kernel")).toBe("The whole coordinate plane");
        expect(fact(result, "Image")).toBe("{(0, 0)}");
      } else {
        expect(fact(result, "Kernel")).toBe("{(0, 0)}");
        expect(fact(result, "Image")).toBe("The whole coordinate plane");
      }
      expect(fact(result, "Orientation")).toBe(
        det(A) > 0 ? "Preserved" : det(A) < 0 ? "Reversed" : "Collapsed; no two-dimensional orientation",
      );
    }
  });
});

describe("geometric and affine transformations", () => {
  it.each<[GeometryOperation, Vec2, Mat2]>([
    [
      "rotate90",
      [2, 3],
      [
        [0, -1],
        [1, 0],
      ],
    ],
    [
      "rotate180",
      [-3, 2],
      [
        [-1, 0],
        [0, -1],
      ],
    ],
    [
      "reflect-x",
      [3, 2],
      [
        [1, 0],
        [0, -1],
      ],
    ],
    [
      "reflect-diagonal",
      [-2, 3],
      [
        [0, 1],
        [1, 0],
      ],
    ],
    [
      "shear-x",
      [-1, -2],
      [
        [1, 2],
        [0, 1],
      ],
    ],
    [
      "shear-y",
      [3, 4],
      [
        [1, 0],
        [2, 1],
      ],
    ],
  ])("uses exact coordinates for %s", (operation, expected, matrix) => {
    const result = evaluateScene("geometry", scene("geometry", { u: [3, -2], a: 2, operation }));
    expect(result.output).toEqual(expected);
    expect(result.gridMatrix).toEqual(matrix);
    expect(fact(result, "Area scale")).toBe("1");
    if (!operation.startsWith("shear")) expect(fact(result, "Squared output length")).toBe("13");
  });

  it("makes the projection matrix symmetric/idempotent and fixes its line", () => {
    for (const v of smallVectors) {
      if (v[0] === 0 && v[1] === 0) continue;
      const result = evaluateScene(
        "geometry",
        scene("geometry", { v, u: [3, -2], operation: "project-line" }),
      );
      const P = result.gridMatrix!;
      expect(P[0][1]).toBe(P[1][0]);
      close(mv(P, v), v);
      close(mv(P, [-v[1], v[0]]), [0, 0]);
      for (const x of [
        [1, 0],
        [0, 1],
      ] as Vec2[])
        close(mv(P, mv(P, x)), mv(P, x));
      expect(fact(result, "Area scale")).toBe("0");
    }
  });

  it("does not mistake an unchanged shear vector for length preservation of the map", () => {
    const same = evaluateScene("geometry", scene("geometry", { u: [3, 0], a: 2, operation: "shear-x" }));
    expect(same.output).toEqual([3, 0]);
    expect(same.observations.join(" ")).toContain("does not preserve every length");
    const identity = evaluateScene("geometry", scene("geometry", { a: 0, operation: "shear-y" }));
    expect(identity.observations.join(" ")).toContain("identity");
  });

  it("cancels translation in displacements and maps endpoint midpoints, even when singular", () => {
    const A: Mat2 = [
        [1, 1],
        [0, 2],
      ],
      u: Vec2 = [1, -1],
      v: Vec2 = [3, 2];
    for (const t of smallVectors) {
      const result = evaluateScene("affine", scene("affine", { A, u, v, t }));
      expect(result.output).toEqual([5, 6]);
      const point = (label: string) => result.points.find((entry) => entry.label === label)!.at;
      const Fu = point("F(u)"),
        Fv = point("F(v)");
      close(Fu, [t[0], t[1] - 2]);
      close(Fv, [t[0] + 5, t[1] + 4]);
      close(point("F(midpoint)"), [(Fu[0] + Fv[0]) / 2, (Fu[1] + Fv[1]) / 2]);
      expect(fact(result, "F(0)")).toBe(formatVector(t));
      expect(fact(result, "Is F linear?").startsWith("Yes")).toBe(t[0] === 0 && t[1] === 0);
    }
    const singular = evaluateScene(
      "affine",
      LAB_PRESETS.find((item) => item.id === "singular-affine")!.scene,
    );
    expect(singular.output).toEqual([0, 0]);
    expect(fact(singular, "F(u)")).toBe("(3, 3)");
    expect(fact(singular, "F(v)")).toBe("(3, 3)");
    expect(fact(singular, "Mapped midpoint")).toBe("(3, 3)");
  });
});

describe("lab safety, original presets and presentation", () => {
  it("validates only the active inputs, with exact integer bounds", () => {
    const irrelevant = {
      ...scene("projection"),
      A: null,
      B: null,
      a: NaN,
      b: Infinity,
      t: [],
      order: "bad",
      operation: "bad",
    } as unknown as LabScene;
    expect(evaluateScene("projection", irrelevant).error).toBeNull();
    expect(
      evaluateScene("geometry", { ...irrelevant, v: null, operation: "rotate90" } as unknown as LabScene)
        .error,
    ).toBeNull();
    for (const value of [4, -4, 1.5, NaN, Infinity]) {
      expect(evaluateScene("combinations", scene("combinations", { a: value })).error).toMatch(/a must/);
      expect(evaluateScene("geometry", scene("geometry", { operation: "shear-x", a: value })).error).toMatch(
        /a must/,
      );
    }
    for (const value of [5, -5, 1.5, NaN, Infinity])
      for (const mode of LAB_MODES)
        expect(evaluateScene(mode, scene(mode, { u: [value, 0] })).error).toMatch(/u must/);
    expect(
      evaluateScene(
        "maps",
        scene("maps", {
          A: [
            [4, 0],
            [0, 1],
          ],
        }),
      ).error,
    ).toMatch(/A must/);
    expect(
      evaluateScene("matrices", scene("matrices", { order: "bad" } as unknown as Partial<LabScene>)).error,
    ).toMatch(/AB or BA/);
    expect(
      evaluateScene("geometry", scene("geometry", { operation: "project-line", v: [0, 0] })).error,
    ).toMatch(/no line direction/);
    expect(evaluateScene("affine", scene("affine", { t: [5, 0] })).error).toMatch(/t must/);
    expect(evaluateScene("maps", null as unknown as LabScene).error).toBeTruthy();
    expect(evaluateScene("bad" as LabMode, scene("maps")).error).toBeTruthy();
    for (const mode of LAB_MODES) expect(evaluateScene(mode, scene(mode, { u: [-4, 4] })).error).toBeNull();
  });

  it("provides independent fresh defaults and does not mutate original scenes", () => {
    expect(new Set(LAB_PRESETS.map((item) => item.id)).size).toBe(LAB_PRESETS.length);
    for (const mode of LAB_MODES) {
      expect(LAB_PRESETS.filter((item) => item.mode === mode).length).toBeGreaterThanOrEqual(2);
      const first = defaultScene(mode),
        second = defaultScene(mode);
      expect(first).toEqual(second);
      expect(first.u).not.toBe(second.u);
      expect(first.A[0]).not.toBe(second.A[0]);
      const before = JSON.stringify(first);
      evaluateScene(mode, first);
      expect(JSON.stringify(first)).toBe(before);
    }
    for (const item of LAB_PRESETS) {
      const result = evaluateScene(item.mode, item.scene);
      if (item.id === "zero-direction") expect(result.error).toMatch(/no line direction/);
      else {
        expect(result.error).toBeNull();
        expect(result.output!.every(Number.isFinite)).toBe(true);
      }
    }
  });

  it("marks approximations while keeping small rational outputs exact", () => {
    expect(formatScalar(-0)).toBe("0");
    expect(formatScalar(1 / 3)).toBe("1/3");
    expect(formatScalar(-7 / 5)).toBe("-7/5");
    expect(formatVector([16 / 5, 8 / 5])).toBe("(16/5, 8/5)");
    expect(formatScalar(Math.sqrt(2))).toMatch(/rounded/);
    expect(formatVector([Math.sqrt(2), 1])).toMatch(/^approximately .*rounded/);
    expect(formatScalar(1e-12)).toBe("1e-12 (rounded)");
    expect(formatScalar(Number.MAX_SAFE_INTEGER + 1)).toMatch(/rounded/);
    expect(formatScalar(Infinity)).toBe("not finite");
  });

  it("strictly renders every displayed math fragment in every preset", () => {
    let rendered = 0;
    const additional: LabExperiment[] = [
      ...(["rotate180", "reflect-x", "shear-y"] as GeometryOperation[]).map((operation) =>
        evaluateScene("geometry", scene("geometry", { operation })),
      ),
      evaluateScene("matrices", scene("matrices", { order: "BA" })),
      evaluateScene("projection", scene("projection", { u: [1, 0], v: [-1, 1] })),
    ];
    for (const result of [
      ...LAB_PRESETS.map((item) => evaluateScene(item.mode, item.scene)),
      ...additional,
    ]) {
      const text = [
        ...result.steps,
        ...result.observations,
        ...result.facts.flatMap((item) => [item.label, item.value]),
      ];
      for (const fragment of text) {
        // This is MathText's actual inline/display delimiter grammar.
        for (const part of fragment.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g)) {
          if (!part.startsWith("$")) {
            expect(part).not.toContain("$");
            continue;
          }
          const displayMode = part.startsWith("$$"),
            delimiter = displayMode ? 2 : 1;
          expect(
            () =>
              katex.renderToString(part.slice(delimiter, -delimiter), {
                displayMode,
                throwOnError: true,
                strict: "error",
                trust: false,
                maxExpand: 500,
              }),
            fragment,
          ).not.toThrow();
          rendered += 1;
        }
      }
    }
    expect(rendered).toBeGreaterThan(70);
  });
});
