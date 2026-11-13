import type { MathQuestion } from "@/lib/curriculum";
import { InputError, PrecisionError, parseMathInput, type MathInputValue } from "@/lib/math-input";

function displayValue(value: MathInputValue): string {
  if (typeof value === "number") return value.toString();
  return (
    "[" +
    value.map((entry) => (Array.isArray(entry) ? displayValue(entry) : entry.toString())).join(", ") +
    "]"
  );
}

export function MathAnswerPreview({
  question,
  value,
  id,
}: {
  question: Pick<MathQuestion, "kind" | "answer_format" | "math_input_version">;
  value: string;
  id: string;
}) {
  if (!["number", "vector", "matrix"].includes(question.kind) || !value.trim()) return <span id={id} />;
  if (question.math_input_version !== undefined && question.math_input_version !== 1)
    return (
      <p id={id} className="mt-2 text-xs leading-6 text-[#91a5bd]">
        Submit this notation for grading; a preview is unavailable.
      </p>
    );
  let interpreted: MathInputValue | undefined;
  let issue: { message: string; precision: boolean } | undefined;
  try {
    interpreted = parseMathInput(question.kind as "number" | "vector" | "matrix", value);
  } catch (problem) {
    issue = {
      message: problem instanceof InputError ? problem.message : "Check the expression format.",
      precision: problem instanceof PrecisionError,
    };
  }
  if (issue) {
    return (
      <p id={id} className="mt-3 text-xs leading-6 text-[#f8cf93]" aria-live="polite">
        {issue.precision ? "Precision preview: " : "Input format: "}
        {issue.message} Your draft is kept while you edit.
      </p>
    );
  }
  if (interpreted === undefined) return <span id={id} />;
  const integerExpected =
    question.answer_format === "integer" && typeof interpreted === "number" && !Number.isInteger(interpreted);
  return (
    <div
      id={id}
      className="mt-3 rounded-lg border border-[#31465a] bg-[#0b1721] px-3 py-2 text-xs leading-6 text-[#a8c5da]"
      aria-live="polite"
    >
      <p>
        Interpreted value: <code className="break-all">{displayValue(interpreted)}</code>
      </p>
      <p className="text-[#829bb1]">This preview checks notation only. Decimal values are approximate.</p>
      {integerExpected ? (
        <p className="text-[#facc15]">
          This question asks for an integer result. Use an exact whole-number answer.
        </p>
      ) : null}
    </div>
  );
}
