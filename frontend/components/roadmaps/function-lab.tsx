"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { defaultFunctionScene, evaluateFunction, FUNCTION_PRESETS } from "@/lib/function-lab";
import {
  FUNCTION_LESSONS,
  FUNCTION_MODES,
  FUNCTION_NUMERIC_TOLERANCE,
  functionChoices,
  functionFields,
  type FunctionAnswer,
  type FunctionChoiceKey,
  type FunctionField,
  type FunctionMode,
  type FunctionNumericKey,
  type FunctionResult,
  type FunctionScene,
  type FunctionVec,
} from "@/lib/function-lab-types";
import { parseMathInput } from "@/lib/math-input";
import { FunctionPlot } from "@/components/roadmaps/function-plot";
import { MathText } from "@/components/roadmaps/math-text";

type RawScene = Record<FunctionNumericKey, string> & Pick<FunctionScene, FunctionChoiceKey>;
type PredictionType = "value" | "undefined" | "no-index";
type Prediction = { type: PredictionType; raw: string };
type ParsedPrediction =
  | { kind: "number" | "integer"; value: number }
  | { kind: "vector"; value: FunctionVec }
  | { kind: "undefined" | "no-index" };
type Revealed = { result: FunctionResult; feedback: string | null };
const NUMERIC_KEYS: readonly FunctionNumericKey[] = [
  "a",
  "b",
  "c",
  "d",
  "h",
  "x",
  "m",
  "n",
  "p",
  "q",
  "angle",
  "phase",
  "radius",
];
const CHOICE_KEYS: readonly FunctionChoiceKey[] = [
  "composition",
  "rational",
  "exponential",
  "base",
  "trigonometry",
  "curves",
  "direction",
  "sequence",
  "ratio",
];
function rawScene(scene: FunctionScene): RawScene {
  const draft = { ...scene } as unknown as RawScene;
  for (const key of NUMERIC_KEYS) draft[key] = String(scene[key]);
  return draft;
}
function choiceScene(mode: FunctionMode, draft: RawScene): FunctionScene {
  return {
    ...defaultFunctionScene(mode),
    ...Object.fromEntries(CHOICE_KEYS.map((key) => [key, draft[key]])),
  };
}
function integer(raw: string, field: FunctionField): number | null {
  if (!/^[+-]?\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= field.min && value <= field.max ? value : null;
}
function parseScene(mode: FunctionMode, draft: RawScene): FunctionScene | null {
  const scene = choiceScene(mode, draft);
  for (const field of functionFields(mode, scene)) {
    const value = integer(draft[field.key], field);
    if (value === null) return null;
    scene[field.key] = value;
  }
  return scene;
}
function parsedPrediction(mode: FunctionMode, prediction: Prediction): ParsedPrediction | null {
  if (prediction.type === "undefined" && mode !== "curves" && mode !== "sequences")
    return { kind: "undefined" };
  if (prediction.type === "no-index" && mode === "sequences") return { kind: "no-index" };
  if (!prediction.raw.trim()) return null;
  if (mode === "curves") {
    const value = parseMathInput("vector", prediction.raw);
    if (!Array.isArray(value) || value.length !== 2 || value.some((entry) => typeof entry !== "number"))
      throw new Error("Enter exactly two Cartesian coordinates, for example [1/2, sqrt(3)/2].");
    return { kind: "vector", value: value as unknown as FunctionVec };
  }
  const value = parseMathInput("number", prediction.raw);
  if (typeof value !== "number") throw new Error("Enter one real number or arithmetic expression.");
  if (mode === "sequences") {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error(
        "The first qualifying index N must be a whole number at least 1. Choose No such index when no qualifying index exists.",
      );
    return { kind: "integer", value };
  }
  return { kind: "number", value };
}
const approximately = (actual: number, expected: number) =>
  Math.abs(actual - expected) <=
  Math.max(
    FUNCTION_NUMERIC_TOLERANCE,
    FUNCTION_NUMERIC_TOLERANCE * Math.max(Math.abs(actual), Math.abs(expected)),
  );
function matches(prediction: ParsedPrediction, answer: FunctionAnswer) {
  if (prediction.kind !== answer.kind) return false;
  if (prediction.kind === "undefined" || prediction.kind === "no-index") return true;
  if (prediction.kind === "integer" && answer.kind === "integer") return prediction.value === answer.value;
  if (prediction.kind === "number" && answer.kind === "number")
    return approximately(prediction.value, answer.value);
  return (
    prediction.kind === "vector" &&
    answer.kind === "vector" &&
    approximately(prediction.value[0], answer.value[0]) &&
    approximately(prediction.value[1], answer.value[1])
  );
}

function NumericField({
  field,
  value,
  onChange,
}: {
  field: FunctionField;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId(),
    valid = integer(value, field) !== null;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm text-[#c7d8ec]">
        {field.label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!valid}
        aria-describedby={`${id}-help`}
        className="min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 text-base text-white outline-offset-4 focus:outline-2 focus:outline-[#8ccfff]"
      />
      <p
        id={`${id}-help`}
        className={`mt-1 text-xs leading-6 ${valid ? "text-[#91a8c2]" : "text-[#ffc3ae]"}`}
      >
        {valid
          ? `Whole number, ${field.min} to ${field.max}.`
          : `Enter a whole number from ${field.min} to ${field.max}.`}
      </p>
    </div>
  );
}

export function FunctionLab({ initialMode = "composition" }: { initialMode?: FunctionMode }) {
  const [mode, setMode] = useState<FunctionMode>(initialMode);
  const [drafts, setDrafts] = useState<Record<FunctionMode, RawScene>>(
    () =>
      Object.fromEntries(
        FUNCTION_MODES.map((item) => [item, rawScene(defaultFunctionScene(item))]),
      ) as Record<FunctionMode, RawScene>,
  );
  const [presets, setPresets] = useState<Record<FunctionMode, string>>(
    () =>
      Object.fromEntries(
        FUNCTION_MODES.map((item) => [
          item,
          FUNCTION_PRESETS.find((preset) => preset.mode === item)?.id ?? "custom",
        ]),
      ) as Record<FunctionMode, string>,
  );
  const [predictions, setPredictions] = useState<Record<FunctionMode, Prediction>>(
    () =>
      Object.fromEntries(FUNCTION_MODES.map((item) => [item, { type: "value", raw: "" }])) as Record<
        FunctionMode,
        Prediction
      >,
  );
  const [notes, setNotes] = useState<Record<FunctionMode, string>>(
    () => Object.fromEntries(FUNCTION_MODES.map((item) => [item, ""])) as Record<FunctionMode, string>,
  );
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const uid = useId(),
    predictionId = useId(),
    noteId = useId();
  const draft = drafts[mode],
    prediction = predictions[mode],
    lesson = FUNCTION_LESSONS[mode];
  const selectedChoices = useMemo(() => choiceScene(mode, draft), [mode, draft]);
  const fields = functionFields(mode, selectedChoices),
    choices = functionChoices(mode, selectedChoices);
  const scene = useMemo(() => parseScene(mode, draft), [mode, draft]);
  const result = useMemo(() => (scene ? evaluateFunction(mode, scene) : null), [mode, scene]);
  let predictionValue: ParsedPrediction | null = null,
    predictionError: string | null = null;
  try {
    predictionValue = parsedPrediction(mode, prediction);
  } catch (error) {
    predictionError = error instanceof Error ? error.message : "Enter a valid prediction.";
  }
  const invalid = !scene || Boolean(result?.error) || Boolean(predictionError);
  const preset = FUNCTION_PRESETS.find((item) => item.mode === mode && item.id === presets[mode]);
  function invalidate(clearPrediction = false) {
    setRevealed(null);
    setAnnouncement("");
    if (clearPrediction) setPredictions((current) => ({ ...current, [mode]: { type: "value", raw: "" } }));
  }
  function updateDraft(update: (current: RawScene) => RawScene) {
    setDrafts((current) => ({ ...current, [mode]: update(current[mode]) }));
    setPresets((current) => ({ ...current, [mode]: "custom" }));
    invalidate();
  }
  function reveal() {
    if (invalid || !result || !result.answer) return;
    const feedback =
      predictionValue === null
        ? null
        : matches(predictionValue, result.answer)
          ? "Your prediction matches the model."
          : "Your prediction differs from the model. Compare the explanation and try again.";
    setRevealed({ result, feedback });
    setAnnouncement(
      `Result: ${result.answer.display}. ${feedback ?? "The explanation and plot are available."}`,
    );
  }
  return (
    <div className="space-y-6">
      <section className="panel p-5 sm:p-8" aria-labelledby={`${uid}-controls`}>
        <h2 id={`${uid}-controls`} className="text-2xl font-semibold">
          Choose a function experiment
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#a7bdd5]">
          Explore a defined family, optionally make a prediction, then reveal its domain, behavior and plot.
          This local lab does not record mastery, assessment time or progress.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm text-[#c7d8ec]">
            Experiment
            <select
              aria-label="Experiment"
              value={mode}
              onChange={(event) => {
                const next = event.target.value as FunctionMode;
                if (FUNCTION_MODES.includes(next)) {
                  setMode(next);
                  invalidate();
                }
              }}
              className="mt-2 block min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 text-white"
            >
              {FUNCTION_MODES.map((item) => (
                <option key={item} value={item}>
                  {FUNCTION_LESSONS[item].title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#c7d8ec]">
            Preset
            <select
              aria-label="Preset"
              value={presets[mode]}
              onChange={(event) => {
                const id = event.target.value;
                if (id === "custom") {
                  setPresets((current) => ({ ...current, [mode]: "custom" }));
                  invalidate(true);
                  return;
                }
                const selected = FUNCTION_PRESETS.find((item) => item.mode === mode && item.id === id);
                if (selected) {
                  setDrafts((current) => ({ ...current, [mode]: rawScene(selected.scene) }));
                  setPresets((current) => ({ ...current, [mode]: id }));
                  invalidate(true);
                }
              }}
              className="mt-2 block min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 text-white"
            >
              <option value="custom">Custom controls</option>
              {FUNCTION_PRESETS.filter((item) => item.mode === mode).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm leading-7 text-[#a3b9d1]">
          {preset?.description ??
            "Custom controls and predictions stay available for each experiment during this visit."}
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {choices.map((choice) => (
            <label key={choice.key} className="text-sm text-[#c7d8ec]">
              {choice.label}
              <select
                aria-label={choice.label}
                value={draft[choice.key]}
                onChange={(event) => {
                  const value = event.target.value;
                  if (choice.options.some((item) => item.value === value))
                    updateDraft((current) => ({ ...current, [choice.key]: value }));
                }}
                className="mt-2 block min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 text-white"
              >
                {choice.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {fields.map((field) => (
            <NumericField
              key={`${mode}-${field.key}`}
              field={field}
              value={draft[field.key]}
              onChange={(value) => updateDraft((current) => ({ ...current, [field.key]: value }))}
            />
          ))}
        </div>
        <section
          className="mt-6 rounded-xl border border-[#314a66] bg-[#0b1727] p-4 sm:p-5"
          aria-labelledby={`${uid}-setup`}
        >
          <h3 id={`${uid}-setup`} className="font-semibold">
            Function definition and prediction target
          </h3>
          {result?.setup.length ? (
            <div className="mt-3 space-y-3 text-sm leading-7 text-[#c3d6eb]">
              {result.setup.map((line, index) => (
                <MathText key={index} className="block max-w-full overflow-x-auto pb-1">
                  {line}
                </MathText>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-7 text-[#a7bdd5]">
              Complete valid controls to view the function definition.
            </p>
          )}
          <p id={`${predictionId}-help`} className="mt-4 text-sm leading-7 text-[#b0c5dd]">
            {lesson.prediction}{" "}
            {mode === "curves"
              ? "Enter a vector such as [1/2, sqrt(3)/2]."
              : mode === "sequences"
                ? "A numerical prediction must be an integer at least 1; this index is compared exactly."
                : "Enter a real number or an arithmetic expression such as sqrt(2)/2."}{" "}
            Leave a numerical prediction blank to explore without a comparison.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {mode !== "curves" ? (
              <label className="text-sm text-[#c7d8ec]">
                Prediction type
                <select
                  aria-label="Prediction type"
                  value={prediction.type}
                  onChange={(event) => {
                    const type = event.target.value as PredictionType;
                    if (type === "value" || type === (mode === "sequences" ? "no-index" : "undefined")) {
                      setPredictions((current) => ({ ...current, [mode]: { ...current[mode], type } }));
                      invalidate();
                    }
                  }}
                  className="mt-2 block min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 text-white"
                >
                  <option value="value">
                    {mode === "sequences" ? "First qualifying index N" : "Numerical value"}
                  </option>
                  <option value={mode === "sequences" ? "no-index" : "undefined"}>
                    {mode === "sequences" ? "No such index" : "Undefined"}
                  </option>
                </select>
              </label>
            ) : null}
            <div className="min-w-0">
              <label htmlFor={predictionId} className="block text-sm text-[#c7d8ec]">
                Your prediction <span className="text-[#9fb5cf]">(optional)</span>
              </label>
              <input
                id={predictionId}
                aria-label="Your prediction"
                type="text"
                value={prediction.raw}
                disabled={prediction.type !== "value"}
                maxLength={4000}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  const raw = event.target.value;
                  setPredictions((current) => ({ ...current, [mode]: { ...current[mode], raw } }));
                  invalidate();
                }}
                aria-invalid={Boolean(predictionError)}
                aria-describedby={`${predictionId}-help${predictionError ? ` ${predictionId}-error` : ""}`}
                className="mt-2 min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 text-base text-white disabled:opacity-60"
              />
            </div>
          </div>
          {predictionError ? (
            <p id={`${predictionId}-error`} className="mt-3 text-sm leading-7 text-[#ffc3ae]">
              {predictionError}
            </p>
          ) : null}
          {prediction.type !== "value" ? (
            <p className="mt-3 text-xs leading-6 text-[#b4cbe2]">
              This selection is your prediction even when the numerical field is blank.
            </p>
          ) : null}
        </section>
        {!scene ? (
          <p className="mt-4 text-sm leading-7 text-[#ffc3ae]">
            Correct the highlighted controls before revealing the result. Partial input is preserved for
            editing.
          </p>
        ) : result?.error ? (
          <p className="mt-4 text-sm leading-7 text-[#ffc3ae]">{result.error}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary min-h-11" disabled={invalid} onClick={reveal}>
            Reveal result
          </button>
          <button
            type="button"
            className="btn min-h-11"
            onClick={() => {
              setDrafts((current) => ({ ...current, [mode]: rawScene(defaultFunctionScene(mode)) }));
              setPresets((current) => ({
                ...current,
                [mode]: FUNCTION_PRESETS.find((item) => item.mode === mode)?.id ?? "custom",
              }));
              invalidate(true);
            }}
          >
            Reset experiment
          </button>
          <Link className="btn inline-flex min-h-11 items-center" href={`/roadmaps/calculus/${lesson.topic}`}>
            Read the lesson
          </Link>
        </div>
      </section>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <FunctionPlot data={revealed?.result.plot ?? null} />
        {revealed ? (
          <section className="panel min-w-0 space-y-6 p-5 sm:p-7" aria-labelledby={`${uid}-result`}>
            <div>
              <h2 id={`${uid}-result`} className="text-2xl font-semibold">
                Experiment result
              </h2>
              <p className="mt-3 text-lg text-[#f2d392]" data-answer-kind={revealed.result.answer?.kind}>
                Result: <strong>{revealed.result.answer?.display}</strong>
              </p>
              {revealed.feedback ? (
                <p className="mt-3 text-sm leading-7 text-[#c6d9ef]">{revealed.feedback}</p>
              ) : null}
              <p className="mt-2 text-xs leading-6 text-[#93abc5]">
                {mode === "sequences"
                  ? "The first qualifying index is compared exactly; a finite plot does not prove the eventual bound."
                  : "Numerical predictions use absolute or relative tolerance 10⁻⁸. This comparison is local feedback."}
              </p>
            </div>
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-7 text-[#bfd0e4]">
              {revealed.result.steps.map((step, index) => (
                <li key={index}>
                  <MathText className="block max-w-full overflow-x-auto pb-1">{step}</MathText>
                </li>
              ))}
            </ol>
            <dl className="grid gap-4 sm:grid-cols-2">
              {revealed.result.facts.map((fact) => (
                <div key={fact.label} className="min-w-0 rounded-lg bg-[#0b1727] p-3">
                  <dt className="text-xs text-[#9bb1cc]">{fact.label}</dt>
                  <dd className="mt-1 break-words text-sm text-[#d5e3f4]">
                    <MathText className="block max-w-full overflow-x-auto">{fact.value}</MathText>
                  </dd>
                </div>
              ))}
            </dl>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-[#aec3da]">
              {revealed.result.observations.map((item, index) => (
                <li key={index}>
                  <MathText>{item}</MathText>
                </li>
              ))}
            </ul>
            {revealed.result.table ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="mb-3 text-left font-medium">{revealed.result.table.caption}</caption>
                  <thead className="text-xs text-[#9fb5ce]">
                    <tr>
                      {revealed.result.table.headers.map((header, index) => (
                        <th key={index} scope="col" className="p-2">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {revealed.result.table.rows.map((row, index) => (
                      <tr key={index} className="border-t border-[#293d55]">
                        {row.map((cell, column) => (
                          <td key={column} className="whitespace-nowrap p-2 tabular-nums">
                            <MathText>{cell}</MathText>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div>
              <label htmlFor={noteId} className="block font-medium">
                Explain your reasoning
              </label>
              <p id={`${noteId}-prompt`} className="mt-2 text-sm leading-7 text-[#acc1da]">
                {lesson.reflection}
              </p>
              <textarea
                id={noteId}
                rows={4}
                maxLength={4000}
                value={notes[mode]}
                onChange={(event) => {
                  const value = event.target.value.slice(0, 4000);
                  setNotes((current) => ({ ...current, [mode]: value }));
                }}
                aria-describedby={`${noteId}-prompt ${noteId}-privacy`}
                className="mt-3 w-full rounded-lg border border-[#3b526d] bg-[#091421] p-3 text-base text-white"
              />
              <p id={`${noteId}-privacy`} className="mt-2 text-xs leading-6 text-[#93abc5]">
                Kept for this visit only. This explanation is not graded or saved to your account.{" "}
                {notes[mode].length}/4000 characters.
              </p>
            </div>
          </section>
        ) : (
          <section className="panel p-6 text-sm leading-8 text-[#acc1da]">
            <h2 className="text-xl font-semibold text-white">Define, predict, then reveal</h2>
            <p className="mt-3">
              Read the definition and its prediction target before calculating. A mathematically undefined
              value is a meaningful result; malformed controls need editing.
            </p>
            <p className="mt-3">
              Finite plots illustrate behavior. Algebraic reasoning establishes domains, inverse branches and
              bounds for every later sequence term.
            </p>
          </section>
        )}
      </div>
      <nav className="panel p-5 sm:p-7" aria-label="Function lab lessons">
        <h2 className="font-semibold">Connect functions to a lesson</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCTION_MODES.map((item) => (
            <li key={item}>
              <Link
                className="inline-block py-2 text-sm leading-6 text-[#a8cffa] underline underline-offset-4"
                href={`/roadmaps/calculus/${FUNCTION_LESSONS[item].topic}`}
              >
                {FUNCTION_LESSONS[item].title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
