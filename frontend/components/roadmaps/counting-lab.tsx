"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { COUNTING_PRESETS, defaultCountingScene, evaluateCounting } from "@/lib/counting-lab";
import {
  COUNTING_FIELDS,
  COUNTING_LESSONS,
  COUNTING_MODES,
  type CountingField,
  type CountingMode,
  type CountingResult,
  type CountingScene,
} from "@/lib/counting-lab-types";
import { parseMathInput } from "@/lib/math-input";
import { CountingGroups } from "@/components/roadmaps/counting-groups";
import { MathText } from "@/components/roadmaps/math-text";

type NumericKey = CountingField["key"];
type RawScene = Record<NumericKey, string> & Pick<CountingScene, "rule" | "selection">;
type Reveal = { result: CountingResult; feedback: string | null };
const NUMERIC_KEYS: readonly NumericKey[] = ["a", "b", "c", "n", "k", "r", "minimum"];

function raw(scene: CountingScene): RawScene {
  return {
    ...Object.fromEntries(NUMERIC_KEYS.map((key) => [key, String(scene[key])])),
    rule: scene.rule,
    selection: scene.selection,
  } as RawScene;
}
function integer(value: string, min: number, max: number): number | null {
  if (!/^[+-]?\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}
function parsedScene(mode: CountingMode, draft: RawScene): CountingScene | null {
  const scene = { ...defaultCountingScene(mode), rule: draft.rule, selection: draft.selection };
  for (const field of COUNTING_FIELDS[mode]) {
    const value = integer(draft[field.key], field.min, field.max);
    if (value === null) return null;
    scene[field.key] = value;
  }
  return scene;
}
function NumberField({
  field,
  value,
  onChange,
}: {
  field: CountingField;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const valid = integer(value, field.min, field.max) !== null;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm text-[#c7d8ec]">
        {field.label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        spellCheck={false}
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

export function CountingLab({ initialMode = "rules" }: { initialMode?: CountingMode }) {
  const [mode, setMode] = useState<CountingMode>(initialMode);
  const [drafts, setDrafts] = useState<Record<CountingMode, RawScene>>(
    () =>
      Object.fromEntries(COUNTING_MODES.map((item) => [item, raw(defaultCountingScene(item))])) as Record<
        CountingMode,
        RawScene
      >,
  );
  const [presets, setPresets] = useState<Record<CountingMode, string>>(
    () =>
      Object.fromEntries(
        COUNTING_MODES.map((item) => [
          item,
          COUNTING_PRESETS.find((preset) => preset.mode === item)?.id ?? "custom",
        ]),
      ) as Record<CountingMode, string>,
  );
  const [predictions, setPredictions] = useState<Record<CountingMode, string>>(
    () => Object.fromEntries(COUNTING_MODES.map((item) => [item, ""])) as Record<CountingMode, string>,
  );
  const [notes, setNotes] = useState<Record<CountingMode, string>>(
    () => Object.fromEntries(COUNTING_MODES.map((item) => [item, ""])) as Record<CountingMode, string>,
  );
  const [revealed, setRevealed] = useState<Reveal | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const predictionId = useId(),
    noteId = useId();
  const draft = drafts[mode],
    prediction = predictions[mode],
    lesson = COUNTING_LESSONS[mode];
  const scene = parsedScene(mode, draft);
  const result = scene ? evaluateCounting(mode, scene) : null;
  let predictionValue: number | null = null,
    predictionError: string | null = null;
  if (prediction.trim()) {
    try {
      const value = parseMathInput("number", prediction);
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
        throw new Error("Enter a nonnegative whole count within the safe integer range.");
      predictionValue = value;
    } catch (error) {
      predictionError = error instanceof Error ? error.message : "Enter a valid nonnegative whole count.";
    }
  }
  const invalid = !scene || Boolean(result?.error) || Boolean(predictionError);
  const preset = COUNTING_PRESETS.find((item) => item.id === presets[mode] && item.mode === mode);

  function invalidate(clearPrediction = false) {
    setRevealed(null);
    setAnnouncement("");
    if (clearPrediction) setPredictions((current) => ({ ...current, [mode]: "" }));
  }
  function change(update: (current: RawScene) => RawScene) {
    setDrafts((current) => ({ ...current, [mode]: update(current[mode]) }));
    setPresets((current) => ({ ...current, [mode]: "custom" }));
    invalidate();
  }
  function reveal() {
    if (invalid || !result || result.count === null) return;
    const feedback =
      predictionValue === null
        ? null
        : predictionValue === result.count
          ? "Your prediction matches the exact count."
          : "Your prediction differs from the exact count. Compare the counting steps and try again.";
    setRevealed({ result, feedback });
    setAnnouncement(
      `${lesson.quantity}: ${result.count}. ${feedback ?? "The counting explanation is available."}`,
    );
  }
  const listing = revealed?.result.listing;

  return (
    <div className="space-y-6">
      <section className="panel p-5 sm:p-8" aria-labelledby="counting-controls-title">
        <h2 id="counting-controls-title" className="text-2xl font-semibold">
          Choose a counting experiment
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#a3b9d1]">
          Adjust a small finite problem, optionally predict its count, then reveal the reasoning. This local
          exploration does not record mastery or assessment time.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm text-[#c7d8ec]">
            Experiment
            <select
              aria-label="Experiment"
              value={mode}
              onChange={(event) => {
                const next = event.target.value as CountingMode;
                if (COUNTING_MODES.includes(next)) {
                  setMode(next);
                  invalidate();
                }
              }}
              className="mt-2 block min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 text-white"
            >
              {COUNTING_MODES.map((item) => (
                <option key={item} value={item}>
                  {COUNTING_LESSONS[item].title}
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
                const chosen = COUNTING_PRESETS.find((item) => item.mode === mode && item.id === id);
                if (chosen) {
                  setDrafts((current) => ({ ...current, [mode]: raw(chosen.scene) }));
                  setPresets((current) => ({ ...current, [mode]: id }));
                  invalidate(true);
                }
              }}
              className="mt-2 block min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 text-white"
            >
              <option value="custom">Custom controls</option>
              {COUNTING_PRESETS.filter((item) => item.mode === mode).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm leading-7 text-[#a3b9d1]">
          {preset?.description ?? "Your custom values are retained for this experiment during this visit."}
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {COUNTING_FIELDS[mode].map((field) => (
            <NumberField
              key={`${mode}-${field.key}`}
              field={field}
              value={draft[field.key]}
              onChange={(value) => change((current) => ({ ...current, [field.key]: value }))}
            />
          ))}
          {mode === "rules" ? (
            <label className="text-sm text-[#c7d8ec]">
              Counting rule
              <select
                aria-label="Counting rule"
                value={draft.rule}
                onChange={(event) => {
                  const rule = event.target.value === "product" ? "product" : "sum";
                  change((current) => ({ ...current, rule }));
                }}
                className="mt-2 block min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2"
              >
                <option value="sum">Sum · disjoint alternatives</option>
                <option value="product">Product · successive choices</option>
              </select>
            </label>
          ) : null}
          {mode === "selection" ? (
            <label className="text-sm text-[#c7d8ec]">
              Ordering
              <select
                aria-label="Ordering"
                value={draft.selection}
                onChange={(event) => {
                  const selection = event.target.value === "ordered" ? "ordered" : "unordered";
                  change((current) => ({ ...current, selection }));
                }}
                className="mt-2 block min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2"
              >
                <option value="ordered">Ordered · without replacement</option>
                <option value="unordered">Unordered · without replacement</option>
              </select>
            </label>
          ) : null}
        </div>
        <div className="mt-6 rounded-xl border border-[#314a66] bg-[#0b1727] p-4 sm:p-5">
          <label htmlFor={predictionId} className="block font-medium">
            Your count prediction <span className="font-normal text-[#9fb5cf]">(optional)</span>
          </label>
          <p id={`${predictionId}-help`} className="mt-2 text-sm leading-7 text-[#acc1da]">
            {lesson.prediction} Enter a nonnegative whole count or an arithmetic expression such as 6*5/2.
            Leave blank to explore without a prediction.
          </p>
          <input
            id={predictionId}
            aria-label="Your count prediction"
            type="text"
            value={prediction}
            maxLength={4000}
            onChange={(event) => {
              const value = event.target.value;
              setPredictions((current) => ({ ...current, [mode]: value }));
              invalidate();
            }}
            aria-invalid={Boolean(predictionError)}
            aria-describedby={`${predictionId}-help${predictionError ? ` ${predictionId}-error` : ""}`}
            className="mt-3 min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 text-base text-white"
            placeholder="Exact count"
          />
          {predictionError ? (
            <p id={`${predictionId}-error`} className="mt-2 text-sm text-[#ffc3ae]">
              {predictionError}
            </p>
          ) : null}
        </div>
        {!scene ? (
          <p className="mt-4 text-sm leading-7 text-[#ffc3ae]">
            Correct the highlighted controls before revealing the result. Empty and partial input stays
            available to edit.
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
              setDrafts((current) => ({ ...current, [mode]: raw(defaultCountingScene(mode)) }));
              setPresets((current) => ({
                ...current,
                [mode]: COUNTING_PRESETS.find((item) => item.mode === mode)?.id ?? "custom",
              }));
              invalidate(true);
            }}
          >
            Reset experiment
          </button>
          <Link
            className="btn inline-flex min-h-11 items-center"
            href={`/roadmaps/probability/${lesson.topic}`}
          >
            Read the lesson
          </Link>
        </div>
      </section>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <CountingGroups
          groups={revealed?.result.groups ?? []}
          hasResult={Boolean(revealed)}
          caption={
            revealed?.result.groupCaption ??
            "Reveal the result to inspect the groups and their counts. Group units depend on the selected experiment."
          }
        />
        {revealed ? (
          <section className="panel min-w-0 space-y-6 p-5 sm:p-7" aria-labelledby="counting-result-title">
            <div>
              <h2 id="counting-result-title" className="text-2xl font-semibold">
                Experiment result
              </h2>
              <p className="mt-3 text-lg text-[#f2d392]">
                {lesson.quantity}: <strong>{revealed.result.count}</strong>
              </p>
              {revealed.feedback ? (
                <p className="mt-3 text-sm leading-7 text-[#c6d9ef]">{revealed.feedback}</p>
              ) : null}
              <p className="mt-2 text-xs leading-6 text-[#93abc5]">
                Counts and prediction comparisons are exact for these bounded experiments. Matching a
                prediction is local feedback.
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
                  <dd className="mt-1 break-words text-sm text-[#d5e3f4]">{fact.value}</dd>
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
            {listing ? (
              <section aria-labelledby="counting-listing-title">
                <h3 id="counting-listing-title" className="font-semibold">
                  {listing.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-[#aec3da]">
                  {listing.kind === "witness"
                    ? "One balanced witness; other assignments are not enumerated."
                    : listing.complete
                      ? `Complete list: ${listing.total} outcomes.`
                      : `First ${Math.min(listing.items.length, 40)} of ${listing.total} outcomes. These follow deterministic construction order, not a random sample.`}
                </p>
                {listing.items.length ? (
                  <ol className="mt-3 grid list-inside list-decimal gap-2 rounded-lg bg-[#0b1727] p-4 text-sm leading-7 sm:grid-cols-2">
                    {listing.items.slice(0, 40).map((item, index) => (
                      <li key={index} className="min-w-0 break-words">
                        {item || "Empty outcome (one possibility)"}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-[#9fb6d0]">No outcomes satisfy these constraints.</p>
                )}
              </section>
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
                value={notes[mode]}
                maxLength={4000}
                rows={4}
                onChange={(event) => {
                  const value = event.target.value.slice(0, 4000);
                  setNotes((current) => ({ ...current, [mode]: value }));
                }}
                aria-describedby={`${noteId}-prompt ${noteId}-privacy`}
                className="mt-3 w-full rounded-lg border border-[#3b526d] bg-[#091421] p-3 text-base text-white"
              />
              <p id={`${noteId}-privacy`} className="mt-2 text-xs leading-6 text-[#93abc5]">
                Kept for this visit only. Your explanation is not graded or saved to your account.{" "}
                {notes[mode].length}/4000 characters.
              </p>
            </div>
          </section>
        ) : (
          <section className="panel p-6 text-sm leading-8 text-[#acc1da]">
            <h2 className="text-xl font-semibold text-white">Predict, then count</h2>
            <p className="mt-3">
              Choose the counting rule before enumerating. Reveal a valid experiment to inspect its exact
              formula, bounded examples, and a text equivalent of the diagram.
            </p>
            <p className="mt-3">
              When the complete set is larger, the first forty outcomes follow the construction order; they
              are not a random sample. A pigeonhole witness demonstrates sharpness and is not an enumeration
              of all assignments.
            </p>
          </section>
        )}
      </div>
      <nav className="panel p-5 sm:p-7" aria-label="Counting lab lessons">
        <h2 className="font-semibold">Connect counting to a lesson</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COUNTING_MODES.map((item) => (
            <li key={item}>
              <Link
                className="inline-block py-2 text-sm leading-6 text-[#a8cffa] underline underline-offset-4"
                href={`/roadmaps/probability/${COUNTING_LESSONS[item].topic}`}
              >
                {COUNTING_LESSONS[item].title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
