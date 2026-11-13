import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LinearAlgebraLab } from "@/components/roadmaps/linear-algebra-lab";
import { LinearPlane } from "@/components/roadmaps/linear-plane";
import { defaultScene, evaluateScene } from "@/lib/linear-algebra-lab";
import { LAB_MODES } from "@/lib/linear-algebra-lab-types";

function edit(label: string, value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value } });
}
function values(inputs: Record<string, string>) {
  for (const [label, value] of Object.entries(inputs)) edit(label, value);
}
function choose(label: string, value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value } });
}
function reveal() {
  fireEvent.click(screen.getByRole("button", { name: "Reveal result" }));
}
function output() {
  const element = screen.getByText(/^Result coordinates:/);
  const pair = element.textContent!.match(/\(([^()]*)\)/)![1]!;
  return pair.split(",").map((entry) => {
    const [numerator, denominator] = entry.trim().split("/").map(Number);
    return numerator! / (denominator ?? 1);
  });
}
function vectorGroups() {
  return Array.from(
    screen
      .getByRole("img", { name: "Coordinate plane" })
      .querySelectorAll<SVGGElement>("g[data-vector-label]"),
  );
}
function endpoints(group: Element) {
  return ["from-x", "from-y", "to-x", "to-y"].map((name) => Number(group.getAttribute("data-" + name)));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("The local lab must not fetch")));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("interactive linear algebra lab", () => {
  it("offers six accessible experiments, waits for reveal, and works without a provider or server mutations", () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<LinearAlgebraLab />);
    expect(within(screen.getByRole("combobox", { name: "Experiment" })).getAllByRole("option")).toHaveLength(
      6,
    );
    expect(screen.getByRole("textbox", { name: "u x" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Your coordinate prediction" })).toHaveValue("");
    expect(screen.queryByRole("heading", { name: "Experiment result" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal result" })).toBeEnabled();
    reveal();
    expect(screen.getByRole("heading", { name: "Experiment result" })).toBeVisible();
    expect(screen.queryByText("Your prediction matches the model.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Your prediction differs from the model/)).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  });

  it("keeps numerical text, the coordinate table, and an equal-scale y-up diagram consistent", () => {
    render(<LinearAlgebraLab />);
    values({ "u x": "2", "u y": "-1", "v x": "-1", "v y": "3", a: "2", b: "-1" });
    reveal();
    expect(output()).toEqual([5, -5]);
    const groups = vectorGroups();
    expect(
      groups.some((group) =>
        endpoints(group)
          .slice(2)
          .every((value, index) => value === [5, -5][index]),
      ),
    ).toBe(true);
    const u = groups.find((group) => group.getAttribute("data-vector-label") === "u")!;
    expect(endpoints(u)).toEqual([0, 0, 2, -1]);
    const line = u.querySelector("line")!;
    const dx = Number(line.getAttribute("x2")) - Number(line.getAttribute("x1"));
    const dy = Number(line.getAttribute("y2")) - Number(line.getAttribute("y1"));
    expect(dx).toBeGreaterThan(0);
    expect(dy).toBeGreaterThan(0); // Negative mathematical y points down in SVG coordinates.
    expect(Math.abs(dx / 2)).toBeCloseTo(Math.abs(dy), 10);
    const svg = screen.getByRole("img", { name: "Coordinate plane" });
    expect(svg).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
    const extent = Number(svg.getAttribute("data-extent"));
    for (const group of groups) {
      for (const value of endpoints(group)) expect(Math.abs(value)).toBeLessThan(extent);
    }
    expect(screen.getByRole("table", { name: "Coordinates shown in the diagram" })).toBeVisible();
    expect(svg.outerHTML).not.toMatch(/NaN|Infinity/);
  });

  it("invalidates comparisons while preserving per-mode prediction and control drafts", () => {
    render(<LinearAlgebraLab />);
    values({ "u x": "2", "u y": "-1", "v x": "-1", "v y": "3", a: "2", b: "-1" });
    edit("Your coordinate prediction", "[5,-5]");
    reveal();
    expect(screen.getByText("Your prediction matches the model.")).toBeVisible();
    edit("a", "1");
    expect(screen.queryByRole("heading", { name: "Experiment result" })).not.toBeInTheDocument();
    expect(screen.queryByText("Your prediction matches the model.")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your coordinate prediction" })).toHaveValue("[5,-5]");
    choose("Experiment", "maps");
    edit("Your coordinate prediction", "[3,4]");
    choose("Experiment", "combinations");
    expect(screen.getByRole("textbox", { name: "a" })).toHaveValue("1");
    expect(screen.getByRole("textbox", { name: "Your coordinate prediction" })).toHaveValue("[5,-5]");
    choose("Experiment", "maps");
    expect(screen.getByRole("textbox", { name: "Your coordinate prediction" })).toHaveValue("[3,4]");
  });

  it.each(["", "-", "5", "NaN", "Infinity", "1e309"])(
    "retains invalid control text %j and disables reveal",
    (raw) => {
      render(<LinearAlgebraLab />);
      edit("u x", raw);
      expect(screen.getByRole("textbox", { name: "u x" })).toHaveValue(raw);
      expect(screen.getByRole("textbox", { name: "u x" })).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
      expect(screen.queryByRole("heading", { name: "Experiment result" })).not.toBeInTheDocument();
    },
  );

  it.each(["[1,2,3]", "[sqrt(-1),0]", "[1e101,0]"])(
    "retains malformed prediction %s and prevents a misleading reveal",
    (prediction) => {
      render(<LinearAlgebraLab />);
      edit("Your coordinate prediction", prediction);
      expect(screen.getByRole("textbox", { name: "Your coordinate prediction" })).toHaveValue(prediction);
      expect(screen.getByRole("textbox", { name: "Your coordinate prediction" })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
    },
  );

  it("accepts an exact fractional projection prediction through the shared parser", () => {
    render(<LinearAlgebraLab initialMode="projection" />);
    values({ "u x": "1", "u y": "0", "v x": "1", "v y": "1" });
    edit("Your coordinate prediction", "[1/2,1/2]");
    reveal();
    expect(output()).toEqual([0.5, 0.5]);
    expect(screen.getByText("Your prediction matches the model.")).toBeVisible();
    edit("Your coordinate prediction", "[1/2,0]");
    expect(screen.queryByRole("heading", { name: "Experiment result" })).not.toBeInTheDocument();
    reveal();
    expect(
      screen.getByText(
        "Your prediction differs from the model. Compare the steps and try another experiment.",
      ),
    ).toBeVisible();
  });

  it.each(["projection", "geometry"] as const)(
    "requires a nonzero line direction in %s but permits a zero input vector",
    (mode) => {
      render(<LinearAlgebraLab initialMode={mode} />);
      if (mode === "geometry") choose("Geometric operation", "project-line");
      values({ "v x": "0", "v y": "0" });
      expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
      expect(
        screen.getByText(/zero.*direction|nonzero.*direction|zero.*line|nonzero.*line/i, { selector: "p" }),
      ).toBeVisible();
      values({ "v x": "1", "v y": "1", "u x": "0", "u y": "0" });
      expect(screen.getByRole("button", { name: "Reveal result" })).toBeEnabled();
      reveal();
      expect(output()).toEqual([0, 0]);
      expect(
        screen.getByText("Angle between u and v", { selector: "dt" }).nextElementSibling,
      ).toHaveTextContent("Undefined: the zero input has no angle");
      expect(screen.getByRole("img", { name: "Coordinate plane" }).outerHTML).not.toMatch(/NaN|Infinity/);
    },
  );

  it("uses the selected composition order and invalidates the old product when it changes", () => {
    render(<LinearAlgebraLab initialMode="matrices" />);
    values({
      "u x": "1",
      "u y": "2",
      "A row 1 column 1": "1",
      "A row 1 column 2": "1",
      "A row 2 column 1": "0",
      "A row 2 column 2": "1",
      "B row 1 column 1": "0",
      "B row 1 column 2": "-1",
      "B row 2 column 1": "1",
      "B row 2 column 2": "0",
    });
    choose("Composition order", "AB");
    reveal();
    expect(output()).toEqual([-1, 1]);
    choose("Composition order", "BA");
    expect(screen.queryByRole("heading", { name: "Experiment result" })).not.toBeInTheDocument();
    reveal();
    expect(output()).toEqual([-2, 3]);
  });

  it("shows singular line and zero-map collapses without nonfinite SVG coordinates", () => {
    render(<LinearAlgebraLab initialMode="maps" />);
    values({
      "u x": "1",
      "u y": "1",
      "A row 1 column 1": "1",
      "A row 1 column 2": "2",
      "A row 2 column 1": "1",
      "A row 2 column 2": "2",
    });
    reveal();
    expect(output()).toEqual([3, 3]);
    expect(screen.getByText("Rank", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Image", { selector: "dt" }).nextElementSibling).toHaveTextContent("(1, 1)");
    expect(screen.getByText("Area scale", { selector: "dt" }).nextElementSibling).toHaveTextContent("0");
    values({
      "A row 1 column 1": "0",
      "A row 1 column 2": "0",
      "A row 2 column 1": "0",
      "A row 2 column 2": "0",
    });
    reveal();
    expect(output()).toEqual([0, 0]);
    expect(screen.getByText("Rank", { selector: "dt" }).nextElementSibling).toHaveTextContent("0");
    expect(screen.getByText("Image", { selector: "dt" }).nextElementSibling).toHaveTextContent("(0, 0)");
    expect(screen.getByText("Kernel", { selector: "dt" }).nextElementSibling).toHaveTextContent(
      "The whole coordinate plane",
    );
    expect(screen.getByRole("img", { name: "Coordinate plane" }).outerHTML).not.toMatch(/NaN|Infinity/);
  });

  it("preserves vector length under rotation and applies a horizontal shear in the documented direction", () => {
    render(<LinearAlgebraLab initialMode="geometry" />);
    values({ "u x": "2", "u y": "1" });
    choose("Geometric operation", "rotate90");
    reveal();
    expect(output()).toEqual([-1, 2]);
    expect(output().reduce((sum, value) => sum + value * value, 0)).toBe(5);
    choose("Geometric operation", "reflect-x");
    reveal();
    expect(output()).toEqual([2, -1]);
    choose("Geometric operation", "shear-x");
    edit("a", "2");
    reveal();
    expect(output()).toEqual([4, 1]);
    expect(screen.getByText("Area scale", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");
  });

  it("separates translated points from displacement and keeps the diagram's endpoint arithmetic consistent", () => {
    render(<LinearAlgebraLab initialMode="affine" />);
    values({
      "u x": "1",
      "u y": "2",
      "v x": "4",
      "v y": "-1",
      "A row 1 column 1": "2",
      "A row 1 column 2": "0",
      "A row 2 column 1": "0",
      "A row 2 column 2": "3",
      "Translation x": "3",
      "Translation y": "-2",
    });
    reveal();
    expect(output()).toEqual([6, -9]);
    expect(
      vectorGroups().some((group) =>
        endpoints(group).every((value, index) => value === [5, 4, 11, -5][index]),
      ),
    ).toBe(true);
    values({ "Translation x": "-2", "Translation y": "4" });
    expect(screen.queryByRole("heading", { name: "Experiment result" })).not.toBeInTheDocument();
    reveal();
    expect(output()).toEqual([6, -9]);
    expect(
      vectorGroups().some((group) =>
        endpoints(group).every((value, index) => value === [0, 10, 6, 1][index]),
      ),
    ).toBe(true);
  });

  it("clears only the current prediction on preset/reset and preserves per-mode reasoning notes for the visit", () => {
    render(<LinearAlgebraLab />);
    const defaultX = (screen.getByRole("textbox", { name: "u x" }) as HTMLInputElement).value;
    reveal();
    edit("Explain your reasoning", "Coefficients scale each contribution before adding.");
    edit("Your coordinate prediction", "[1,2]");
    const options = within(screen.getByRole("combobox", { name: "Preset" })).getAllByRole(
      "option",
    ) as HTMLOptionElement[];
    const selected = options.filter((option) => option.value !== "custom").at(-1)!;
    choose("Preset", selected.value);
    expect(screen.getByRole("textbox", { name: "Your coordinate prediction" })).toHaveValue("");
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue(
      "Coefficients scale each contribution before adding.",
    );
    const presetX = (screen.getByRole("textbox", { name: "u x" }) as HTMLInputElement).value;
    edit("Your coordinate prediction", "[9,9]");
    choose("Preset", "custom");
    expect(screen.getByRole("combobox", { name: "Preset" })).toHaveValue("custom");
    expect(screen.getByRole("textbox", { name: "u x" })).toHaveValue(presetX);
    expect(screen.getByRole("textbox", { name: "Your coordinate prediction" })).toHaveValue("");
    expect(screen.queryByRole("heading", { name: "Experiment result" })).not.toBeInTheDocument();
    edit("u x", "4");
    edit("Your coordinate prediction", "[3,4]");
    fireEvent.click(screen.getByRole("button", { name: "Reset experiment" }));
    expect(screen.getByRole("textbox", { name: "u x" })).toHaveValue(defaultX);
    expect(screen.getByRole("textbox", { name: "Your coordinate prediction" })).toHaveValue("");
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue(
      "Coefficients scale each contribution before adding.",
    );
    expect(screen.getByText(/Kept for this visit only/)).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(LAB_MODES)(
    "hydrates the %s experiment after a real HTML parse without recovering from mismatched SVG titles",
    async (mode) => {
      const errors: unknown[] = [];
      const messages = vi.spyOn(console, "error").mockImplementation(() => {});
      const container = document.createElement("div");
      container.innerHTML = renderToString(<LinearAlgebraLab initialMode={mode} />);
      document.body.appendChild(container);
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, <LinearAlgebraLab initialMode={mode} />, {
            onRecoverableError: (error) => {
              errors.push(error);
            },
          });
        });
        expect(within(container).getByRole("img", { name: "Coordinate plane" })).toBeInTheDocument();
        expect(errors).toEqual([]);
        expect(messages).not.toHaveBeenCalled();
        fireEvent.click(within(container).getByRole("button", { name: "Reveal result" }));
        expect(within(container).getByRole("heading", { name: "Experiment result" })).toBeVisible();
      } finally {
        await act(async () => {
          root?.unmount();
        });
        container.remove();
      }
    },
  );

  it.each(LAB_MODES)(
    "hydrates a server-rendered revealed %s plane with its numerical vector labels intact",
    async (mode) => {
      const scene = defaultScene(mode),
        result = evaluateScene(mode, scene);
      const element = (
        <LinearPlane
          vectors={result.vectors}
          points={result.points}
          gridMatrix={result.gridMatrix}
          lineDirection={result.lineDirection}
          gridOffset={mode === "affine" ? scene.t : undefined}
        />
      );
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
        expect(container.querySelectorAll("g[data-vector-label]")).toHaveLength(result.vectors.length);
        expect(container.querySelectorAll("g[data-point-label]")).toHaveLength(result.points.length);
        expect(errors).toEqual([]);
        expect(messages).not.toHaveBeenCalled();
      } finally {
        await act(async () => {
          root?.unmount();
        });
        container.remove();
      }
    },
  );

  it("satisfies projection and isometry identities on independently enumerated integer vectors", () => {
    for (let x = -4; x <= 4; x += 1)
      for (let y = -4; y <= 4; y += 1) {
        for (const operation of ["rotate90", "rotate180", "reflect-x", "reflect-diagonal"] as const) {
          const result = evaluateScene("geometry", { ...defaultScene("geometry"), u: [x, y], operation });
          expect(result.error).toBeNull();
          expect(result.output![0] ** 2 + result.output![1] ** 2).toBe(x * x + y * y);
        }
        for (const [vx, vy] of [
          [1, 2],
          [-2, 1],
          [-1, -2],
        ]) {
          const scene = { ...defaultScene("projection"), u: [x, y] as const, v: [vx!, vy!] as const };
          const result = evaluateScene("projection", scene);
          const [px, py] = result.output!;
          expect(px * vy! - py * vx!).toBeCloseTo(0, 10); // Membership in the line.
          expect((x - px) * vx! + (y - py) * vy!).toBeCloseTo(0, 10); // Orthogonal residual.
          const reversed = evaluateScene("projection", { ...scene, v: [-vx!, -vy!] });
          expect(reversed.output![0]).toBeCloseTo(px, 10);
          expect(reversed.output![1]).toBeCloseTo(py, 10);
          const geometry = evaluateScene("geometry", { ...scene, operation: "project-line" });
          const p = geometry.gridMatrix!;
          expect(p[0][1]).toBe(p[1][0]);
          for (let row = 0; row < 2; row += 1)
            for (let column = 0; column < 2; column += 1)
              expect(p[row]![0] * p[0][column]! + p[row]![1] * p[1][column]!).toBeCloseTo(
                p[row]![column]!,
                10,
              );
        }
      }
  });

  it("uses the image line rather than the kernel for a rank-one map and distinguishes the valid zero map", () => {
    const result = evaluateScene("maps", {
      ...defaultScene("maps"),
      A: [
        [0, 2],
        [0, -1],
      ],
      u: [-1, 2],
    });
    expect(result.output).toEqual([4, -2]);
    expect(result.lineDirection).toEqual([2, -1]);
    const kernel = result.vectors.find((vector) => vector.label === "kernel direction")!.to;
    expect(kernel).toEqual([1, 0]);
    expect(2 * kernel[1]).toBe(0);
    expect(-kernel[1]).toBeCloseTo(0, 10);
    const zero = evaluateScene("affine", {
      ...defaultScene("affine"),
      A: [
        [0, 0],
        [0, 0],
      ],
      t: [2, 3],
    });
    expect(zero.output).toEqual([0, 0]);
    expect(zero.facts.find((fact) => fact.label === "Is F linear?")!.value).toBe("No: the origin moves");
    const linearZero = evaluateScene("affine", {
      ...defaultScene("affine"),
      A: [
        [0, 0],
        [0, 0],
      ],
      t: [0, 0],
    });
    expect(linearZero.facts.find((fact) => fact.label === "Is F linear?")!.value).toBe(
      "Yes: the translation is zero",
    );
  });
});
