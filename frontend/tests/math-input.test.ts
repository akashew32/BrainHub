import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import fixtures from "../../fixtures/math-input.json";
import {
  InputError,
  PrecisionError,
  parseMathInput,
  type MathInputKind,
  type MathInputValue,
} from "@/lib/math-input";
import { MathAnswerPreview } from "@/components/roadmaps/math-answer-preview";

type Fixture = {
  name: string;
  kind: MathInputKind;
  input: string;
  expected?: MathInputValue;
  error?: boolean;
  preview_error?: boolean;
};

function expectSameValues(actual: MathInputValue, expected: MathInputValue) {
  if (typeof expected === "number") {
    expect(typeof actual).toBe("number");
    if (expected === 0) expect(actual).toBe(0);
    else expect(Math.abs((actual as number) - expected) / Math.abs(expected)).toBeLessThan(2e-14);
    return;
  }
  expect(Array.isArray(actual)).toBe(true);
  const values = actual as number[] | number[][];
  expect(values).toHaveLength(expected.length);
  expected.forEach((entry, index) => expectSameValues(values[index]!, entry));
}

afterEach(cleanup);

describe("shared mathematics input grammar", () => {
  it.each(fixtures.cases as Fixture[])("$name", (example) => {
    if (example.preview_error) {
      expect(() => parseMathInput(example.kind, example.input)).toThrow(PrecisionError);
    } else if (example.error) {
      expect(() => parseMathInput(example.kind, example.input)).toThrow(InputError);
    } else {
      expect(example.expected).toBeDefined();
      expectSameValues(parseMathInput(example.kind, example.input), example.expected!);
    }
  });

  it("accepts the nesting boundary and rejects one additional level", () => {
    expect(parseMathInput("number", "(".repeat(12) + "1" + ")".repeat(12))).toBe(1);
    expect(() => parseMathInput("number", "(".repeat(13) + "1" + ")".repeat(13))).toThrow(InputError);
  });

  it("accepts 64 matrix entries and rejects an additional row", () => {
    const row = "[" + Array(8).fill("1/2").join(",") + "]";
    const accepted = "[" + Array(8).fill(row).join(",") + "]";
    const rejected = "[" + Array(9).fill(row).join(",") + "]";
    const values = parseMathInput("matrix", accepted);
    expect(values).toHaveLength(8);
    expect((values as number[][])[0]).toEqual(Array(8).fill(0.5));
    expect(() => parseMathInput("matrix", rejected)).toThrow(InputError);
  });

  it.each([
    ["number", "1 trailing"],
    ["number", "sqrt(4)+alert(1)"],
    ["vector", "[1,2] + 3"],
    ["matrix", "[[1,2],[3,4]] junk"],
    ["matrix", "[[1,2],[3,4,]]"],
  ] as const)("rejects trailing or executable text in %s input %s", (kind, input) => {
    expect(() => parseMathInput(kind, input)).toThrow(InputError);
  });

  it("rejects a raw answer longer than the API input limit", () => {
    expect(() => parseMathInput("vector", "[" + " ".repeat(4000) + "1]")).toThrow(InputError);
  });

  it.each(["9007199254740993-9007199254740992", "9999999999999999-9999999999999998", "(2^53+1)-2^53"])(
    "refuses a silently rounded large-integer preview for %s",
    (input) => {
      expect(() => parseMathInput("number", input)).toThrow(PrecisionError);
    },
  );
});

describe("mathematics answer previews", () => {
  it("shows interpreted expressions without grading them", () => {
    render(
      createElement(MathAnswerPreview, {
        question: { kind: "vector", answer_format: "vector", math_input_version: 1 },
        value: "1/2, sqrt(2)",
        id: "vector-preview",
      }),
    );
    expect(screen.getByText("[0.5, 1.4142135623730951]")).toBeInTheDocument();
    expect(screen.getByText(/This preview checks notation only/)).toBeInTheDocument();
    expect(screen.queryByText(/Correct|Incorrect|Expected answer/)).not.toBeInTheDocument();
  });

  it("keeps incomplete expressions as format feedback instead of a grading failure", () => {
    render(
      createElement(MathAnswerPreview, {
        question: { kind: "number" },
        value: "sqrt(",
        id: "partial-preview",
      }),
    );
    expect(screen.getByText(/Input format:/)).toBeInTheDocument();
    expect(screen.getByText(/Your draft is kept while you edit/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains the whole-number requirement without asserting correctness", () => {
    render(
      createElement(MathAnswerPreview, {
        question: { kind: "number", answer_format: "integer" },
        value: "1/2",
        id: "integer-preview",
      }),
    );
    expect(screen.getByText(/This question asks for an integer result/)).toBeInTheDocument();
    expect(screen.getByText("0.5")).toBeInTheDocument();
  });

  it("warns that large integer previews are approximate", () => {
    render(
      createElement(MathAnswerPreview, {
        question: { kind: "number", answer_format: "integer" },
        value: "9007199254740993",
        id: "large-preview",
      }),
    );
    expect(screen.getByText(/Precision preview:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Your original answer can still be submitted for exact server grading/),
    ).toBeInTheDocument();
  });

  it("does not reinterpret choices or proof permutations", () => {
    const { container } = render(
      createElement(MathAnswerPreview, {
        question: { kind: "proof", answer_format: "proof" },
        value: "[2, 1]",
        id: "proof-preview",
      }),
    );
    expect(container.textContent).toBe("");
  });
});
