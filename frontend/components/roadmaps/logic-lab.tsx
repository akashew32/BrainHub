"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { defaultLogicScene, evaluateLogic, LOGIC_PRESETS, LOGIC_PROOFS } from "@/lib/logic-lab";
import {
  LOGIC_CHOICE_KEYS,
  LOGIC_LESSONS,
  LOGIC_MODES,
  LOGIC_NUMERIC_KEYS,
  LOGIC_TITLES,
  logicChoices,
  logicFields,
  type LogicChoiceKey,
  type LogicField,
  type LogicMode,
  type LogicNumericKey,
  type LogicProof,
  type LogicResult,
  type LogicScene,
} from "@/lib/logic-lab-types";
import { LogicEvidence } from "@/components/roadmaps/logic-table";
import { MathText } from "@/components/roadmaps/math-text";

type RawScene = Record<LogicNumericKey, string> & Pick<LogicScene, LogicChoiceKey | "words" | "proofOrder">;
type Revealed = { result: LogicResult; feedback: string | null };
function rawScene(scene: LogicScene): RawScene {
  const draft = {
    ...scene,
    words: [...scene.words],
    proofOrder: [...scene.proofOrder],
  } as unknown as RawScene;
  for (const key of LOGIC_NUMERIC_KEYS) draft[key] = String(scene[key]);
  return draft;
}
function choiceScene(mode: LogicMode, draft: RawScene): LogicScene {
  return {
    ...defaultLogicScene(mode),
    ...Object.fromEntries(LOGIC_CHOICE_KEYS.map((key) => [key, draft[key]])),
    words: [...draft.words],
    proofOrder: [...draft.proofOrder],
  };
}
function integer(raw: string, field: LogicField): number | null {
  if (!/^[+-]?\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= field.min && value <= field.max ? value : null;
}
function parsedScene(mode: LogicMode, draft: RawScene): LogicScene | null {
  const scene = choiceScene(mode, draft);
  for (const field of logicFields(mode, scene)) {
    const value = integer(draft[field.key], field);
    if (value === null) return null;
    scene[field.key] = value;
  }
  if (mode === "diagonal")
    scene.words = Array.from({ length: scene.wordSize }, (_, index) => draft.words[index] ?? "");
  return scene;
}
function NumberField({
  field,
  value,
  onChange,
}: {
  field: LogicField;
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
function BinaryRow({
  index,
  size,
  value,
  onChange,
}: {
  index: number;
  size: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId(),
    valid = new RegExp(`^[01]{${size}}$`).test(value);
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm text-[#c7d8ec]">
        Binary row {index + 1}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={64}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={!valid}
        aria-describedby={`${id}-help`}
        className="min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 font-mono text-base tracking-widest text-white"
      />
      <p
        id={`${id}-help`}
        className={`mt-1 text-xs leading-6 ${valid ? "text-[#91a8c2]" : "text-[#ffc3ae]"}`}
      >
        Exactly {size} binary digits (0 or 1). Raw text is kept when the size changes.
      </p>
    </div>
  );
}

function ProofOrder({
  proof,
  order,
  onMove,
}: {
  proof: LogicProof;
  order: string[];
  onMove: (id: string, offset: -1 | 1) => void;
}) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const [focusRequest, setFocusRequest] = useState<{ id: string; offset: -1 | 1 } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!focusRequest) return;
    const preferred = buttons.current[`${focusRequest.id}-${focusRequest.offset}`],
      fallback = buttons.current[`${focusRequest.id}-${-focusRequest.offset}`];
    (preferred && !preferred.disabled
      ? preferred
      : fallback && !fallback.disabled
        ? fallback
        : null
    )?.focus();
  }, [focusRequest]);
  return (
    <section
      className="mt-6 rounded-xl border border-[#314a66] bg-[#0b1727] p-4 sm:p-5"
      aria-label="Arrange the proof steps"
    >
      <h3 className="font-semibold">Arrange the proof steps</h3>
      <p className="mt-2 text-sm leading-7 text-[#adc4dd]">
        <MathText>{proof.claim}</MathText>
      </p>
      <p className="mt-2 text-xs leading-7 text-[#9fb8d2]">
        Method: {proof.method}. Move all {proof.steps.length} steps into an order where each prerequisite is
        established before it is used. Use the labelled buttons with Tab and Enter.
      </p>
      <ol className="mt-4 space-y-3">
        {order.map((id, index) => {
          const number = proof.steps.findIndex((step) => step.id === id) + 1,
            step = proof.steps.find((item) => item.id === id);
          return (
            <li
              key={id}
              data-step-id={id}
              data-position={index + 1}
              className="rounded-lg border border-[#314962] bg-[#0d1c2d] p-3"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-[#96b9cf]">
                Position {index + 1} · Step {number || id}
              </div>
              <MathText className="mt-2 block max-w-full overflow-x-auto pb-1 text-sm leading-7 text-[#d2e2f3]">
                {step?.text ?? `Unrecognized step: ${id}`}
              </MathText>
              <div className="mt-3 flex flex-wrap gap-2">
                {([-1, 1] as const).map((offset) => (
                  <button
                    key={offset}
                    ref={(element) => {
                      buttons.current[`${id}-${offset}`] = element;
                    }}
                    type="button"
                    aria-label={`Move step ${number || id} ${offset === -1 ? "up" : "down"}`}
                    className="btn min-h-11 px-4 text-sm disabled:opacity-40"
                    disabled={offset === -1 ? index === 0 : index === order.length - 1}
                    onClick={() => {
                      onMove(id, offset);
                      setFocusRequest({ id, offset });
                      setAnnouncement(
                        `Step ${number || id} moved to position ${index + offset + 1} of ${order.length}.`,
                      );
                    }}
                  >
                    {offset === -1 ? "Move up" : "Move down"}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

export function LogicLab({ initialMode = "truth" }: { initialMode?: LogicMode }) {
  const [mode, setMode] = useState<LogicMode>(initialMode);
  const [drafts, setDrafts] = useState<Record<LogicMode, RawScene>>(
    () =>
      Object.fromEntries(LOGIC_MODES.map((item) => [item, rawScene(defaultLogicScene(item))])) as Record<
        LogicMode,
        RawScene
      >,
  );
  const [presets, setPresets] = useState<Record<LogicMode, string>>(
    () =>
      Object.fromEntries(
        LOGIC_MODES.map((item) => [
          item,
          LOGIC_PRESETS.find((preset) => preset.mode === item)?.id ?? "custom",
        ]),
      ) as Record<LogicMode, string>,
  );
  const [predictions, setPredictions] = useState<Record<LogicMode, string>>(
    () => Object.fromEntries(LOGIC_MODES.map((item) => [item, ""])) as Record<LogicMode, string>,
  );
  const [notes, setNotes] = useState<Record<LogicMode, string>>(
    () => Object.fromEntries(LOGIC_MODES.map((item) => [item, ""])) as Record<LogicMode, string>,
  );
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const uid = useId(),
    predictionId = useId(),
    noteId = useId();
  const draft = drafts[mode],
    prediction = predictions[mode];
  const choicesScene = useMemo(() => choiceScene(mode, draft), [mode, draft]);
  const scene = useMemo(() => parsedScene(mode, draft), [mode, draft]);
  const result = useMemo(() => (scene ? evaluateLogic(mode, scene) : null), [mode, scene]);
  const fields = logicFields(mode, choicesScene),
    choices = logicChoices(mode, choicesScene);
  const sizeField = logicFields("diagonal", choicesScene)[0]!;
  const wordSize = integer(draft.wordSize, sizeField) ?? Math.max(1, Math.min(6, draft.words.length));
  const predictionError =
    mode === "diagonal" && prediction !== "" && !new RegExp(`^[01]{${wordSize}}$`).test(prediction)
      ? `Predict exactly ${wordSize} binary digits, or leave the prediction blank.`
      : null;
  const invalid = !scene || Boolean(result?.error) || Boolean(predictionError);
  const proof = LOGIC_PROOFS[draft.proof];
  const preset = LOGIC_PRESETS.find((item) => item.mode === mode && item.id === presets[mode]);
  function invalidate(clearPrediction = false) {
    setRevealed(null);
    setAnnouncement("");
    if (clearPrediction) setPredictions((current) => ({ ...current, [mode]: "" }));
  }
  function updateDraft(update: (current: RawScene) => RawScene) {
    setDrafts((current) => ({ ...current, [mode]: update(current[mode]) }));
    setPresets((current) => ({ ...current, [mode]: "custom" }));
    invalidate();
  }
  function reveal() {
    if (invalid || !result || !result.answer) return;
    const correct =
      result.answer.kind === "word"
        ? prediction === result.answer.value
        : (prediction === "true") === result.answer.value;
    const feedback =
      prediction === ""
        ? null
        : correct
          ? "Your prediction matches the model."
          : "Your prediction differs from the model. Compare the logical evidence and try again.";
    setRevealed({ result, feedback });
    setAnnouncement(
      `Result: ${result.answer.display}. ${feedback ?? "The logical explanation is available."}`,
    );
  }
  return (
    <div className="space-y-6">
      <section className="panel p-5 sm:p-8" aria-labelledby={`${uid}-controls`}>
        <h2 id={`${uid}-controls`} className="text-2xl font-semibold">
          Choose a logic experiment
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#a7bdd5]">
          Inspect a precise claim, optionally predict its outcome, then examine the reasoning. These local
          experiments do not save grades, mastery or study time. A finite check is distinguished from a
          universal proof.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm text-[#c7d8ec]">
            Experiment
            <select
              aria-label="Experiment"
              value={mode}
              onChange={(event) => {
                const next = event.target.value as LogicMode;
                if (LOGIC_MODES.includes(next)) {
                  setMode(next);
                  invalidate();
                }
              }}
              className="mt-2 block min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 text-white"
            >
              {LOGIC_MODES.map((item) => (
                <option key={item} value={item}>
                  {LOGIC_TITLES[item]}
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
                const selected = LOGIC_PRESETS.find((item) => item.mode === mode && item.id === id);
                if (selected) {
                  setDrafts((current) => ({ ...current, [mode]: rawScene(selected.scene) }));
                  setPresets((current) => ({ ...current, [mode]: id }));
                  invalidate(true);
                }
              }}
              className="mt-2 block min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 text-white"
            >
              <option value="custom">Custom controls</option>
              {LOGIC_PRESETS.filter((item) => item.mode === mode).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm leading-7 text-[#a3b9d1]">
          {preset?.description ??
            "Custom values and predictions are retained for each experiment during this visit."}
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
                  if (!choice.options.some((item) => item.value === value)) return;
                  updateDraft((current) => ({
                    ...current,
                    [choice.key]: value,
                    ...(choice.key === "proof"
                      ? { proofOrder: [...LOGIC_PROOFS[value as LogicScene["proof"]].defaultOrder] }
                      : {}),
                  }));
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
            <NumberField
              key={`${mode}-${field.key}`}
              field={field}
              value={draft[field.key]}
              onChange={(value) => updateDraft((current) => ({ ...current, [field.key]: value }))}
            />
          ))}
        </div>
        {mode === "proof" ? (
          <ProofOrder
            key={draft.proof}
            proof={proof}
            order={draft.proofOrder}
            onMove={(id, offset) =>
              updateDraft((current) => {
                const order = [...current.proofOrder],
                  index = order.indexOf(id),
                  destination = index + offset;
                if (index < 0 || destination < 0 || destination >= order.length) return current;
                [order[index], order[destination]] = [order[destination]!, order[index]!];
                return { ...current, proofOrder: order };
              })
            }
          />
        ) : null}
        {mode === "diagonal" ? (
          <section
            className="mt-6 rounded-xl border border-[#314a66] bg-[#0b1727] p-4 sm:p-5"
            aria-labelledby={`${uid}-words`}
          >
            <h3 id={`${uid}-words`} className="font-semibold">
              Edit the finite binary list
            </h3>
            <p className="mt-2 text-sm leading-7 text-[#aec4dc]">
              Enter {wordSize} rows with {wordSize} digits each. Repeated rows are allowed. A size change
              keeps your raw rows so you can adjust them deliberately.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: wordSize }, (_, index) => (
                <BinaryRow
                  key={index}
                  index={index}
                  size={wordSize}
                  value={draft.words[index] ?? ""}
                  onChange={(value) =>
                    updateDraft((current) => {
                      const words = [...current.words];
                      words[index] = value;
                      return { ...current, words };
                    })
                  }
                />
              ))}
            </div>
          </section>
        ) : null}
        <section
          className="mt-6 rounded-xl border border-[#314a66] bg-[#0b1727] p-4 sm:p-5"
          aria-labelledby={`${uid}-setup`}
        >
          <h3 id={`${uid}-setup`} className="font-semibold">
            Claim and prediction target
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
              Complete valid controls to inspect the claim and its domain.
            </p>
          )}
          {result?.target ? (
            <p id={`${predictionId}-target`} className="mt-4 font-medium leading-7 text-[#c4d8ee]">
              <MathText className="block max-w-full overflow-x-auto">{result.target}</MathText>
            </p>
          ) : null}
          <div className="mt-4 max-w-xl">
            <label htmlFor={predictionId} className="block text-sm text-[#c7d8ec]">
              Your prediction <span className="text-[#9fb5cf]">(optional)</span>
            </label>
            {mode === "diagonal" ? (
              <input
                id={predictionId}
                aria-label="Your prediction"
                type="text"
                inputMode="numeric"
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                value={prediction}
                onChange={(event) => {
                  const value = event.target.value;
                  setPredictions((current) => ({ ...current, [mode]: value }));
                  invalidate();
                }}
                aria-invalid={Boolean(predictionError)}
                aria-describedby={`${predictionId}-help${predictionError ? ` ${predictionId}-error` : ""}`}
                className="mt-2 min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 font-mono text-base tracking-widest text-white"
              />
            ) : (
              <select
                id={predictionId}
                aria-label="Your prediction"
                value={prediction}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "" || value === "true" || value === "false") {
                    setPredictions((current) => ({ ...current, [mode]: value }));
                    invalidate();
                  }
                }}
                aria-describedby={`${predictionId}-help`}
                className="mt-2 block min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 text-white"
              >
                <option value="">No prediction</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            )}
            <p id={`${predictionId}-help`} className="mt-2 text-xs leading-7 text-[#a9bfd7]">
              {mode === "diagonal"
                ? `Enter exactly ${wordSize} binary digits. Leave blank to inspect the construction without a comparison.`
                : "Yes predicts that the displayed target statement is true; No predicts that it is false. No prediction skips the comparison."}
            </p>
            {predictionError ? (
              <p id={`${predictionId}-error`} className="mt-2 text-sm leading-7 text-[#ffc3ae]">
                {predictionError}
              </p>
            ) : null}
          </div>
        </section>
        {!scene ? (
          <p className="mt-4 text-sm leading-7 text-[#ffc3ae]">
            Correct the highlighted controls before revealing the result. Partial input is kept for editing.
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
              setDrafts((current) => ({ ...current, [mode]: rawScene(defaultLogicScene(mode)) }));
              setPresets((current) => ({
                ...current,
                [mode]: LOGIC_PRESETS.find((item) => item.mode === mode)?.id ?? "custom",
              }));
              invalidate(true);
            }}
          >
            Reset experiment
          </button>
        </div>
      </section>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {revealed ? (
          <section className="panel min-w-0 space-y-6 p-5 sm:p-7" aria-labelledby={`${uid}-result`}>
            <div>
              <h2 id={`${uid}-result`} className="text-2xl font-semibold">
                Experiment result
              </h2>
              <p data-answer-kind={revealed.result.answer?.kind} className="mt-3 text-lg text-[#f2d392]">
                Result: <strong>{revealed.result.answer?.display}</strong>
              </p>
              {revealed.feedback ? (
                <p className="mt-3 text-sm leading-7 text-[#c6d9ef]">{revealed.feedback}</p>
              ) : null}
              <p className="mt-2 text-xs leading-7 text-[#93abc5]">
                Predictions are compared exactly within the stated model. They do not earn saved assessment
                credit.
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
            <div>
              <label htmlFor={noteId} className="block font-medium">
                Explain your reasoning
              </label>
              <p id={`${noteId}-prompt`} className="mt-2 text-sm leading-7 text-[#acc1da]">
                <MathText>{revealed.result.reflection}</MathText>
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
            <h2 className="text-xl font-semibold text-white">State the domain, then reason</h2>
            <p className="mt-3">
              Differentiate a witness, a counterexample and a general argument. Empty domains, nonattained
              bounds and incomplete proof prerequisites are mathematical cases, rather than input errors.
            </p>
            <p className="mt-3">Reveal the experiment to inspect the exact evidence and its scope.</p>
          </section>
        )}
        <LogicEvidence result={revealed?.result ?? null} proof={mode === "proof" ? proof : undefined} />
      </div>
      <nav className="panel p-5 sm:p-7" aria-label="Logic lab lessons">
        <h2 className="font-semibold">Connect reasoning to a lesson</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {(["real-analysis", "discrete-math"] as const).map((roadmap) => (
            <section key={roadmap}>
              <h3 className="text-sm font-semibold text-[#d0e0f2]">
                {roadmap === "real-analysis" ? "Real Analysis" : "Discrete Math"}
              </h3>
              <ul className="mt-2 space-y-1">
                {LOGIC_LESSONS.filter((lesson) => lesson.roadmap === roadmap).map((lesson) => (
                  <li key={lesson.topic}>
                    <Link
                      className="inline-block py-2 text-sm leading-7 text-[#a8cffa] underline underline-offset-4"
                      href={`/roadmaps/${roadmap}/${lesson.topic}`}
                    >
                      {lesson.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </nav>
    </div>
  );
}
