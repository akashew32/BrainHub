import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CountingLab } from "@/components/roadmaps/counting-lab";
import { CountingGroups } from "@/components/roadmaps/counting-groups";
import { defaultCountingScene, evaluateCounting } from "@/lib/counting-lab";
import {
  COUNTING_FIELDS,
  COUNTING_LESSONS,
  COUNTING_MODES,
  type CountingMode,
  type CountingScene,
} from "@/lib/counting-lab-types";

function edit(label: string, value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value } });
}
function choose(label: string, value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value } });
}
function setValues(values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) edit(label, value);
}
function reveal() {
  fireEvent.click(screen.getByRole("button", { name: "Reveal result" }));
}
function expectCount(mode: CountingMode, count: number) {
  expect(
    screen.getByText(
      (_, element) =>
        element?.tagName === "P" && element.textContent === `${COUNTING_LESSONS[mode].quantity}: ${count}`,
    ),
  ).toBeVisible();
}
function boundedScene(mode: CountingMode, values: Partial<CountingScene>) {
  return { ...defaultCountingScene(mode), ...values };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Counting exploration must stay local")));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("interactive counting lab", () => {
  it("offers six labelled native experiments and requires an explicit reveal without reading or writing storage", () => {
    const storage = ["getItem", "setItem", "removeItem"].map((method) =>
      vi.spyOn(Storage.prototype, method as "getItem"),
    );
    render(<CountingLab />);
    const selector = screen.getByRole("combobox", { name: "Experiment" });
    expect(selector.tagName).toBe("SELECT");
    expect(within(selector).getAllByRole("option")).toHaveLength(6);
    for (const mode of COUNTING_MODES)
      expect(
        within(selector).getByRole("option", { name: COUNTING_LESSONS[mode].title }),
      ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your count prediction" })).toHaveValue("");
    expect(screen.queryByRole("textbox", { name: "Explain your reasoning" })).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Reveal result" });
    button.focus();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("type", "button");
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toBeVisible();
    expect(screen.queryByText("Your prediction matches the exact count.")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    storage.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it("separates disjoint alternatives from successive choices, including an empty stage", () => {
    render(<CountingLab initialMode="rules" />);
    setValues({ "Choices in A": "2", "Choices in B": "3" });
    choose("Counting rule", "sum");
    reveal();
    expectCount("rules", 5);
    choose("Counting rule", "product");
    reveal();
    expectCount("rules", 6);
    edit("Choices in A", "0");
    reveal();
    expectCount("rules", 0);
    choose("Counting rule", "sum");
    reveal();
    expectCount("rules", 3);
  });

  it("selects distinct tokens with and without order and treats the empty selection as one outcome", () => {
    render(<CountingLab initialMode="selection" />);
    setValues({ "Available distinct tokens n": "4", "Tokens to select r": "2" });
    choose("Ordering", "ordered");
    reveal();
    expectCount("selection", 12);
    choose("Ordering", "unordered");
    reveal();
    expectCount("selection", 6);
    edit("Tokens to select r", "5");
    reveal();
    expectCount("selection", 0);
    setValues({ "Available distinct tokens n": "0", "Tokens to select r": "0" });
    reveal();
    expectCount("selection", 1);
  });

  it("counts repeated-symbol words without treating equal copies as distinct and includes the empty word", () => {
    render(<CountingLab initialMode="multinomial" />);
    setValues({ "Copies of A": "2", "Copies of B": "1", "Copies of C": "1" });
    reveal();
    expectCount("multinomial", 12);
    setValues({ "Copies of A": "0", "Copies of B": "0", "Copies of C": "0" });
    reveal();
    expectCount("multinomial", 1);
  });

  it("uses labelled boxes and handles lower-bound equality and infeasibility", () => {
    render(<CountingLab initialMode="allocations" />);
    setValues({ "Identical objects n": "5", "Labelled boxes k": "3", "Minimum in each box": "1" });
    reveal();
    expectCount("allocations", 6);
    edit("Identical objects n", "3");
    reveal();
    expectCount("allocations", 1);
    edit("Identical objects n", "2");
    reveal();
    expectCount("allocations", 0);
    setValues({ "Identical objects n": "0", "Labelled boxes k": "6", "Minimum in each box": "0" });
    reveal();
    expectCount("allocations", 1);
  });

  it("uses a finite positive universe and genuine overlaps instead of independent set-size assumptions", () => {
    render(<CountingLab initialMode="inclusion" />);
    setValues({ "Universe size N": "12", "Divisor for A": "2", "Divisor for B": "3", "Divisor for C": "4" });
    reveal();
    expectCount("inclusion", 8);
    setValues({ "Divisor for A": "2", "Divisor for B": "2", "Divisor for C": "2" });
    reveal();
    expectCount("inclusion", 6);
    edit("Universe size N", "0");
    reveal();
    expectCount("inclusion", 0);
  });

  it("shows the sharp minimum largest occupancy and explicitly labels only one balanced witness", () => {
    render(<CountingLab initialMode="pigeonhole" />);
    setValues({ "Number of objects N": "7", "Number of labelled boxes k": "3" });
    reveal();
    expectCount("pigeonhole", 3);
    expect(screen.getByText(/^One balanced witness;/)).toBeVisible();
    expect(screen.queryByText(/Complete list: .*outcomes/)).not.toBeInTheDocument();
    edit("Number of objects N", "0");
    reveal();
    expectCount("pigeonhole", 0);
  });

  it("accepts integer expressions, distinguishes prediction from truth, and retains noninteger raw text", () => {
    render(<CountingLab initialMode="selection" />);
    setValues({ "Available distinct tokens n": "4", "Tokens to select r": "2" });
    choose("Ordering", "unordered");
    for (const expression of ["2^3-2", "12/2"]) {
      edit("Your count prediction", expression);
      reveal();
      expect(screen.getByText("Your prediction matches the exact count.")).toBeVisible();
    }
    edit("Your count prediction", "5");
    expect(screen.queryByText("Your prediction matches the exact count.")).not.toBeInTheDocument();
    reveal();
    expect(
      screen.getByText(
        "Your prediction differs from the exact count. Compare the counting steps and try again.",
      ),
    ).toBeVisible();
    edit("Your count prediction", "1/2");
    expect(screen.getByRole("textbox", { name: "Your count prediction" })).toHaveValue("1/2");
    expect(screen.getByRole("textbox", { name: "Your count prediction" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
  });

  it.each(["-1", "sqrt(-1)", "1e101", "9007199254740993", "2.0001"])(
    "does not compare invalid or imprecise prediction %s",
    (raw) => {
      render(<CountingLab />);
      edit("Your count prediction", raw);
      expect(screen.getByRole("textbox", { name: "Your count prediction" })).toHaveValue(raw);
      expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
    },
  );

  it("preserves per-mode control, prediction and reflection drafts while invalidating stale revealed comparisons", () => {
    render(<CountingLab initialMode="rules" />);
    setValues({ "Choices in A": "2", "Choices in B": "3", "Your count prediction": "5" });
    choose("Counting rule", "sum");
    reveal();
    edit("Explain your reasoning", "The alternatives have distinct labels, so their counts add.");
    edit("Choices in A", "-");
    expect(screen.queryByText("Your prediction matches the exact count.")).not.toBeInTheDocument();
    choose("Experiment", "selection");
    edit("Available distinct tokens n", "3");
    edit("Your count prediction", "3");
    reveal();
    edit("Explain your reasoning", "Ignoring order identifies repeated representations.");
    choose("Experiment", "rules");
    expect(screen.getByRole("textbox", { name: "Choices in A" })).toHaveValue("-");
    expect(screen.getByRole("textbox", { name: "Your count prediction" })).toHaveValue("5");
    edit("Choices in A", "2");
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue(
      "The alternatives have distinct labels, so their counts add.",
    );
    choose("Experiment", "selection");
    expect(screen.getByRole("textbox", { name: "Available distinct tokens n" })).toHaveValue("3");
    expect(screen.getByRole("textbox", { name: "Your count prediction" })).toHaveValue("3");
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue(
      "Ignoring order identifies repeated representations.",
    );
  });

  it("clears the current prediction on preset/reset, retaining the reflection and other modes", () => {
    render(<CountingLab initialMode="rules" />);
    const original = (screen.getByRole("textbox", { name: "Choices in A" }) as HTMLInputElement).value;
    reveal();
    edit("Explain your reasoning", "Keep this explanation during the visit.");
    edit("Your count prediction", "9");
    const options = within(screen.getByRole("combobox", { name: "Preset" })).getAllByRole(
      "option",
    ) as HTMLOptionElement[];
    choose("Preset", options.filter((item) => item.value !== "custom").at(-1)!.value);
    expect(screen.getByRole("textbox", { name: "Your count prediction" })).toHaveValue("");
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue(
      "Keep this explanation during the visit.",
    );
    edit("Choices in A", "6");
    edit("Your count prediction", "9");
    fireEvent.click(screen.getByRole("button", { name: "Reset experiment" }));
    expect(screen.getByRole("textbox", { name: "Choices in A" })).toHaveValue(original);
    expect(screen.getByRole("textbox", { name: "Your count prediction" })).toHaveValue("");
    reveal();
    expect(screen.getByRole("textbox", { name: "Explain your reasoning" })).toHaveValue(
      "Keep this explanation during the visit.",
    );
  });

  it.each(COUNTING_MODES)(
    "enforces all active %s field boundaries without coercing unfinished text",
    (mode) => {
      render(<CountingLab initialMode={mode} />);
      for (const field of COUNTING_FIELDS[mode]) {
        for (const invalid of [
          "",
          "-",
          "1.5",
          "NaN",
          "Infinity",
          String(field.min - 1),
          String(field.max + 1),
        ]) {
          edit(field.label, invalid);
          expect(screen.getByRole("textbox", { name: field.label })).toHaveValue(invalid);
          expect(screen.getByRole("textbox", { name: field.label })).toHaveAttribute("aria-invalid", "true");
          expect(screen.getByRole("button", { name: "Reveal result" })).toBeDisabled();
        }
        edit(field.label, String(field.min));
        expect(screen.getByRole("textbox", { name: field.label })).not.toHaveAttribute(
          "aria-invalid",
          "true",
        );
        edit(field.label, String(field.max));
        expect(screen.getByRole("textbox", { name: field.label })).not.toHaveAttribute(
          "aria-invalid",
          "true",
        );
        edit(field.label, String(defaultCountingScene(mode)[field.key]));
      }
      expect(screen.getByRole("button", { name: "Reveal result" })).toBeEnabled();
    },
  );

  it("distinguishes a full small listing from the first40 outcomes in a large set", () => {
    render(<CountingLab initialMode="selection" />);
    setValues({ "Available distinct tokens n": "3", "Tokens to select r": "2" });
    choose("Ordering", "ordered");
    reveal();
    expect(screen.getByText("Complete list: 6 outcomes.")).toBeVisible();
    setValues({ "Available distinct tokens n": "8", "Tokens to select r": "4" });
    reveal();
    expectCount("selection", 1680);
    expect(screen.getByText(/^First 40 of 1680 outcomes[,\.]/)).toBeVisible();
    expect(screen.queryByText("Complete list: 1680 outcomes.")).not.toBeInTheDocument();
  });

  it.each(COUNTING_MODES)("keeps every %s group count identical in the table and labelled chart", (mode) => {
    const result = evaluateCounting(mode, defaultCountingScene(mode));
    render(<CountingGroups groups={result.groups} caption={result.groupCaption} />);
    const table = screen.getByRole("table", { name: "Counts represented in the diagram" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(result.groups.length);
    result.groups.forEach((group, index) => {
      const cells = within(rows[index]!).getAllByRole("cell");
      expect(within(rows[index]!).getByRole("rowheader")).toHaveTextContent(group.label);
      expect(Number(cells[0]!.textContent!.replaceAll(",", ""))).toBe(group.total);
      const chart = screen.getByRole("img", { name: `${group.label}: ${group.total}` });
      expect(chart).toBeVisible();
      expect(chart.querySelector("rect[data-total]")).toHaveAttribute("data-total", String(group.total));
      expect(chart.outerHTML).not.toMatch(/NaN|Infinity/);
    });
    expect(screen.getByText(result.groupCaption)).toBeVisible();
  });

  it("does not confuse partition sizes or box loads with the quantity being counted", () => {
    const inclusion = evaluateCounting("inclusion", boundedScene("inclusion", { n: 12, a: 2, b: 3, c: 4 }));
    expect(inclusion.groups.reduce((sum, group) => sum + group.total, 0)).toBe(12);
    expect(
      inclusion.groups.filter((group) => group.included).reduce((sum, group) => sum + group.total, 0),
    ).toBe(8);
    const pigeon = evaluateCounting("pigeonhole", boundedScene("pigeonhole", { n: 7, k: 3 }));
    expect(pigeon.groups.reduce((sum, group) => sum + group.total, 0)).toBe(7);
    expect(Math.max(...pigeon.groups.map((group) => group.total))).toBe(3);
    expect(pigeon.count).toBe(3);
    const allocations = evaluateCounting(
      "allocations",
      boundedScene("allocations", { n: 12, k: 2, minimum: 0 }),
    );
    expect(allocations.groups).toHaveLength(13);
    expect(allocations.groups.reduce((sum, group) => sum + group.total, 0)).toBe(allocations.count);
  });

  it("distinguishes an unrevealed chart from a revealed infeasible count of zero", () => {
    render(<CountingLab initialMode="allocations" />);
    expect(screen.getByText("Reveal the result to display the counting groups.")).toBeVisible();
    setValues({ "Identical objects n": "2", "Labelled boxes k": "3", "Minimum in each box": "1" });
    reveal();
    expectCount("allocations", 0);
    expect(screen.getByText(/No feasible outcome groups were found/)).toBeVisible();
    expect(screen.queryByText("Reveal the result to display the counting groups.")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Complete list: 0 outcomes.")).toBeVisible();
  });

  it("distinguishes a nonempty group omitted from the listing prefix from an empty excluded group", () => {
    render(
      <CountingGroups
        caption="Counts are complete; listed examples are only a prefix."
        groups={[
          { label: "Not reached by the prefix", total: 5, items: [], included: true },
          { label: "Empty outside region", total: 0, items: [], included: false },
        ]}
      />,
    );
    expect(screen.getByText("No examples from this group in the displayed prefix.")).toBeVisible();
    expect(screen.getByText("None (empty group)")).toBeVisible();
    const nonempty = screen
      .getByRole("img", { name: "Not reached by the prefix: 5" })
      .querySelector("rect[data-total]")!;
    const zero = screen
      .getByRole("img", { name: "Empty outside region: 0" })
      .querySelector("rect[data-total]")!;
    expect(nonempty).toHaveAttribute("width", "400");
    expect(zero).toHaveAttribute("width", "0");
    expect(zero).toHaveAttribute("data-included", "false");
    expect(zero.getAttribute("fill")).toMatch(/^url\(#/);
  });

  it.each(COUNTING_MODES)(
    "hydrates the default %s after a browser HTML parse and reveals safely",
    async (mode) => {
      const errors: unknown[] = [];
      const messages = vi.spyOn(console, "error").mockImplementation(() => {});
      const container = document.createElement("div");
      container.innerHTML = renderToString(<CountingLab initialMode={mode} />);
      document.body.appendChild(container);
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, <CountingLab initialMode={mode} />, {
            onRecoverableError: (error) => {
              errors.push(error);
            },
          });
        });
        expect(errors).toEqual([]);
        expect(messages).not.toHaveBeenCalled();
        fireEvent.click(within(container).getByRole("button", { name: "Reveal result" }));
        expect(within(container).getByRole("textbox", { name: "Explain your reasoning" })).toBeVisible();
        for (const svg of container.querySelectorAll("svg"))
          expect(svg.outerHTML).not.toMatch(/NaN|Infinity/);
        expect(messages).not.toHaveBeenCalled();
      } finally {
        await act(async () => {
          root?.unmount();
        });
        container.remove();
      }
    },
  );

  it.each(COUNTING_MODES)("hydrates the revealed %s group visuals after a real HTML parse", async (mode) => {
    const result = evaluateCounting(mode, defaultCountingScene(mode));
    const element = <CountingGroups groups={result.groups} caption={result.groupCaption} />;
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
      expect(errors).toEqual([]);
      expect(messages).not.toHaveBeenCalled();
      expect(
        within(container).getByRole("table", { name: "Counts represented in the diagram" }),
      ).toBeInTheDocument();
      expect(within(container).getAllByRole("img")).toHaveLength(result.groups.length);
      for (const svg of container.querySelectorAll("svg")) expect(svg.outerHTML).not.toMatch(/NaN|Infinity/);
    } finally {
      await act(async () => {
        root?.unmount();
      });
      container.remove();
    }
  });
});

describe("independent counting-model review", () => {
  // Count concrete objects by traversal, without binomial/factorial formulas.
  function selections(n: number, r: number, ordered: boolean) {
    let count = 0;
    function visit(chosen: number[]) {
      if (chosen.length === r) {
        count += 1;
        return;
      }
      for (let token = 1; token <= n; token += 1)
        if (!chosen.includes(token) && (ordered || chosen.length === 0 || token > chosen.at(-1)!))
          visit([...chosen, token]);
    }
    visit([]);
    return count;
  }
  function words(remaining: number[]): number {
    if (remaining.every((value) => value === 0)) return 1;
    let result = 0;
    remaining.forEach((value, index) => {
      if (value > 0) {
        const next = [...remaining];
        next[index] = value - 1;
        result += words(next);
      }
    });
    return result;
  }
  function allocations(total: number, boxes: number, minimum: number): number {
    if (boxes === 1) return total >= minimum ? 1 : 0;
    let count = 0;
    for (let first = minimum; first <= total; first += 1)
      count += allocations(total - first, boxes - 1, minimum);
    return count;
  }
  function sharpLargest(n: number, k: number) {
    const loads = Array(k).fill(0) as number[];
    let least = Infinity;
    function assign(remaining: number) {
      if (remaining === 0) {
        least = Math.min(least, Math.max(...loads));
        return;
      }
      for (let box = 0; box < k; box += 1) {
        loads[box]! += 1;
        assign(remaining - 1);
        loads[box]! -= 1;
      }
    }
    assign(n);
    return least;
  }

  it("matches traversal of selected tokens, repeated words, allocations, unions and all small pigeon assignments", () => {
    for (let n = 0; n <= 5; n += 1)
      for (let r = 0; r <= 6; r += 1)
        for (const ordered of [true, false])
          expect(
            evaluateCounting(
              "selection",
              boundedScene("selection", { n, r, selection: ordered ? "ordered" : "unordered" }),
            ).count,
          ).toBe(selections(n, r, ordered));
    for (let a = 0; a <= 2; a += 1)
      for (let b = 0; b <= 2; b += 1)
        for (let c = 0; c <= 2; c += 1)
          expect(evaluateCounting("multinomial", boundedScene("multinomial", { a, b, c })).count).toBe(
            words([a, b, c]),
          );
    for (let n = 0; n <= 8; n += 1)
      for (let k = 1; k <= 4; k += 1)
        for (let minimum = 0; minimum <= 2; minimum += 1)
          expect(evaluateCounting("allocations", boundedScene("allocations", { n, k, minimum })).count).toBe(
            allocations(n, k, minimum),
          );
    for (let n = 0; n <= 20; n += 1)
      for (let a = 1; a <= 4; a += 1)
        for (let b = 1; b <= 4; b += 1) {
          const c = 3;
          const expected = Array.from({ length: n }, (_, i) => i + 1).filter(
            (value) => value % a === 0 || value % b === 0 || value % c === 0,
          ).length;
          expect(evaluateCounting("inclusion", boundedScene("inclusion", { n, a, b, c })).count).toBe(
            expected,
          );
        }
    for (let n = 0; n <= 6; n += 1)
      for (let k = 1; k <= 3; k += 1)
        expect(evaluateCounting("pigeonhole", boundedScene("pigeonhole", { n, k })).count).toBe(
          sharpLargest(n, k),
        );
  });
});
