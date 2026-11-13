"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { evaluateScene, defaultScene, LAB_PRESETS, formatVector } from "@/lib/linear-algebra-lab";
import {
  LAB_LESSONS,
  LAB_MODES,
  type GeometryOperation,
  type LabExperiment,
  type LabMode,
  type LabScene,
  type PlotPoint,
  type PlotVector,
  type Vec2,
} from "@/lib/linear-algebra-lab-types";
import { parseMathInput } from "@/lib/math-input";
import { LinearPlane } from "@/components/roadmaps/linear-plane";
import { MathText } from "@/components/roadmaps/math-text";

type RawVec = [string, string];
type RawScene = {
  u: RawVec;
  v: RawVec;
  a: string;
  b: string;
  A: [RawVec, RawVec];
  B: [RawVec, RawVec];
  t: RawVec;
  order: LabScene["order"];
  operation: GeometryOperation;
};
type Revealed = { experiment: LabExperiment; scene: LabScene; prediction: string | null };
const OPERATIONS: Array<{ value: GeometryOperation; label: string }> = [
  { value: "rotate90", label: "Rotate 90° counterclockwise" },
  { value: "rotate180", label: "Rotate 180°" },
  { value: "reflect-x", label: "Reflect across the x-axis" },
  { value: "reflect-diagonal", label: "Reflect across y = x" },
  { value: "shear-x", label: "Horizontal shear" },
  { value: "shear-y", label: "Vertical shear" },
  { value: "project-line", label: "Project onto the line in direction v" },
];
const REFLECTIONS: Record<LabMode, string> = {
  combinations:
    "How do the coefficients change the directions and lengths of the two contributions? Explain why their sum is in the span.",
  projection:
    "Why is the residual perpendicular to the line direction? Explain why a zero direction does not specify a line.",
  matrices:
    "Which matrix acts first in this product? Explain why swapping the factors can change the result.",
  maps: "Use the two basis-image columns to explain whether the transformed grid keeps two directions or collapses to a line or point.",
  geometry:
    "Explain a property this transformation preserves and one it may change. Use a computed coordinate as evidence.",
  affine: "Why does the translation disappear from F(v) − F(u), even when the point map is not linear?",
};

function raw(scene: LabScene): RawScene {
  const vector = (value: Vec2): RawVec => [String(value[0]), String(value[1])];
  return {
    u: vector(scene.u),
    v: vector(scene.v),
    a: String(scene.a),
    b: String(scene.b),
    A: [vector(scene.A[0]), vector(scene.A[1])],
    B: [vector(scene.B[0]), vector(scene.B[1])],
    t: vector(scene.t),
    order: scene.order,
    operation: scene.operation,
  };
}

function integer(value: string, limit: number): number | null {
  if (!/^[+-]?\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && Math.abs(number) <= limit ? number : null;
}

function parsedScene(mode: LabMode, draft: RawScene): LabScene | null {
  const result = { ...defaultScene(mode), order: draft.order, operation: draft.operation };
  const vector = (values: RawVec, limit: number): Vec2 | null => {
    const x = integer(values[0], limit),
      y = integer(values[1], limit);
    return x === null || y === null ? null : [x, y];
  };
  const u = vector(draft.u, 4);
  if (!u) return null;
  result.u = u;
  if (
    ["combinations", "projection", "affine"].includes(mode) ||
    (mode === "geometry" && draft.operation === "project-line")
  ) {
    const v = vector(draft.v, 4);
    if (!v) return null;
    result.v = v;
  }
  if (mode === "combinations" || (mode === "geometry" && ["shear-x", "shear-y"].includes(draft.operation))) {
    const a = integer(draft.a, 3);
    if (a === null) return null;
    result.a = a;
  }
  if (mode === "combinations") {
    const b = integer(draft.b, 3);
    if (b === null) return null;
    result.b = b;
  }
  if (["matrices", "maps", "affine"].includes(mode)) {
    const top = vector(draft.A[0], 3),
      bottom = vector(draft.A[1], 3);
    if (!top || !bottom) return null;
    result.A = [top, bottom];
  }
  if (mode === "matrices") {
    const top = vector(draft.B[0], 3),
      bottom = vector(draft.B[1], 3);
    if (!top || !bottom) return null;
    result.B = [top, bottom];
  }
  if (mode === "affine") {
    const t = vector(draft.t, 4);
    if (!t) return null;
    result.t = t;
  }
  return result;
}

function IntegerField({
  label,
  value,
  limit,
  onChange,
}: {
  label: string;
  value: string;
  limit: number;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const valid = integer(value, limit) !== null;
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm text-[#c4d3e6]" htmlFor={id}>
        {label}
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
        className="min-h-11 w-full rounded-lg border border-[#3b506a] bg-[#091421] px-3 py-2 text-base text-white outline-offset-4 focus:outline-2 focus:outline-[#8ccfff]"
      />
      <p
        id={`${id}-help`}
        className={`mt-1 text-xs leading-5 ${valid ? "text-[#8fa5bf]" : "text-[#ffc2ad]"}`}
      >
        {valid ? `Whole number, −${limit} to ${limit}.` : `Enter a whole number from -${limit} to ${limit}.`}
      </p>
    </div>
  );
}

export function LinearAlgebraLab({ initialMode = "combinations" }: { initialMode?: LabMode }) {
  const [mode, setMode] = useState<LabMode>(initialMode);
  const [drafts, setDrafts] = useState<Record<LabMode, RawScene>>(
    () =>
      Object.fromEntries(LAB_MODES.map((item) => [item, raw(defaultScene(item))])) as Record<
        LabMode,
        RawScene
      >,
  );
  const [presetIds, setPresetIds] = useState<Record<LabMode, string>>(
    () =>
      Object.fromEntries(
        LAB_MODES.map((item) => [item, LAB_PRESETS.find((preset) => preset.mode === item)?.id ?? "custom"]),
      ) as Record<LabMode, string>,
  );
  const [predictions, setPredictions] = useState<Record<LabMode, string>>(
    () => Object.fromEntries(LAB_MODES.map((item) => [item, ""])) as Record<LabMode, string>,
  );
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [notes, setNotes] = useState<Record<LabMode, string>>(
    () => Object.fromEntries(LAB_MODES.map((item) => [item, ""])) as Record<LabMode, string>,
  );
  const predictionId = useId();
  const reasoningId = useId();
  const draft = drafts[mode];
  const prediction = predictions[mode];
  const scene = parsedScene(mode, draft);
  const experiment = scene ? evaluateScene(mode, scene) : null;
  let parsedPrediction: Vec2 | null = null;
  let predictionError: string | null = null;
  if (prediction.trim()) {
    try {
      const value = parseMathInput("vector", prediction);
      if (!Array.isArray(value) || value.length !== 2 || value.some((entry) => typeof entry !== "number"))
        throw new Error("Enter exactly two coordinates, such as [1/2, -2].");
      parsedPrediction = value as unknown as Vec2;
    } catch (error) {
      predictionError = error instanceof Error ? error.message : "Enter a valid two-coordinate vector.";
    }
  }
  const invalid = !scene || Boolean(experiment?.error) || Boolean(predictionError);
  const selectedPreset = LAB_PRESETS.find((preset) => preset.id === presetIds[mode] && preset.mode === mode);

  function invalidate(clearPrediction = false) {
    setRevealed(null);
    if (clearPrediction) setPredictions((current) => ({ ...current, [mode]: "" }));
    setAnnouncement("");
  }
  function change(update: (current: RawScene) => RawScene) {
    setDrafts((current) => ({ ...current, [mode]: update(current[mode]) }));
    setPresetIds((current) => ({ ...current, [mode]: "custom" }));
    invalidate();
  }
  function setVector(field: "u" | "v" | "t", coordinate: 0 | 1, value: string) {
    change((current) => ({
      ...current,
      [field]: current[field].map((item, index) => (index === coordinate ? value : item)) as RawVec,
    }));
  }
  function setMatrix(field: "A" | "B", row: 0 | 1, column: 0 | 1, value: string) {
    change((current) => ({
      ...current,
      [field]: current[field].map((values, i) =>
        values.map((item, j) => (i === row && j === column ? value : item)),
      ) as [RawVec, RawVec],
    }));
  }
  function reveal() {
    if (invalid || !scene || !experiment) return;
    let feedback: string | null = null;
    if (parsedPrediction && experiment.output) {
      const matches = parsedPrediction.every(
        (value, index) => Math.abs(value - experiment.output![index]) <= 1e-6,
      );
      feedback = matches
        ? "Your prediction matches the model."
        : "Your prediction differs from the model. Compare the steps and try another experiment.";
    }
    setRevealed({ scene, experiment, prediction: feedback });
    setAnnouncement(
      experiment.output
        ? `Result coordinates ${formatVector(experiment.output)}. ${feedback ?? "The worked explanation is available."}`
        : "The worked explanation is available.",
    );
  }
  const vectors: PlotVector[] = revealed
    ? revealed.experiment.vectors
    : scene && mode !== "affine"
      ? [
          { label: "u", from: [0, 0], to: scene.u, tone: "input" },
          ...(["combinations", "projection"].includes(mode) ||
          (mode === "geometry" && draft.operation === "project-line")
            ? [{ label: "v", from: [0, 0] as Vec2, to: scene.v, tone: "secondary" as const, dashed: true }]
            : []),
        ]
      : [];
  const points: PlotPoint[] = revealed
    ? revealed.experiment.points
    : scene && mode === "affine"
      ? [
          { label: "u", at: scene.u, tone: "input" },
          { label: "v", at: scene.v, tone: "secondary" },
        ]
      : [];

  return (
    <div className="space-y-6">
      <section className="panel p-5 sm:p-8" aria-labelledby="lab-controls-title">
        <h2 id="lab-controls-title" className="text-2xl font-semibold">
          Choose an experiment
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#9eb2c9]">
          Change the controls, optionally predict two coordinates, then reveal the result. This local
          exploration does not record mastery or assessment time.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="block text-sm text-[#c4d3e6]">
            Experiment
            <select
              aria-label="Experiment"
              value={mode}
              onChange={(event) => {
                const value = event.target.value as LabMode;
                if (LAB_MODES.includes(value)) {
                  setMode(value);
                  invalidate();
                }
              }}
              className="mt-2 min-h-11 w-full rounded-lg border border-[#3b506a] bg-[#091421] px-3 py-2 text-white"
            >
              {LAB_MODES.map((item) => (
                <option key={item} value={item}>
                  {LAB_LESSONS[item].title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-[#c4d3e6]">
            Preset
            <select
              aria-label="Preset"
              value={presetIds[mode]}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setPresetIds((current) => ({ ...current, [mode]: "custom" }));
                  invalidate(true);
                  return;
                }
                const preset = LAB_PRESETS.find(
                  (item) => item.id === event.target.value && item.mode === mode,
                );
                if (preset) {
                  setDrafts((current) => ({ ...current, [mode]: raw(preset.scene) }));
                  setPresetIds((current) => ({ ...current, [mode]: preset.id }));
                  invalidate(true);
                }
              }}
              className="mt-2 min-h-11 w-full rounded-lg border border-[#3b506a] bg-[#091421] px-3 py-2 text-white"
            >
              <option value="custom">Custom controls</option>
              {LAB_PRESETS.filter((preset) => preset.mode === mode).map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm leading-7 text-[#9eb2c9]">
          {selectedPreset?.description ??
            "Your custom values are retained for this experiment during this visit."}
        </p>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <fieldset>
            <legend className="mb-3 font-medium">{mode === "affine" ? "Point u" : "Vector u"}</legend>
            <div className="grid grid-cols-2 gap-3">
              {([0, 1] as const).map((index) => (
                <IntegerField
                  key={index}
                  label={`u ${index === 0 ? "x" : "y"}`}
                  value={draft.u[index]}
                  limit={4}
                  onChange={(value) => setVector("u", index, value)}
                />
              ))}
            </div>
          </fieldset>
          {["combinations", "projection", "affine"].includes(mode) ||
          (mode === "geometry" && draft.operation === "project-line") ? (
            <fieldset>
              <legend className="mb-3 font-medium">
                {mode === "affine"
                  ? "Point v"
                  : mode === "projection" || mode === "geometry"
                    ? "Line direction v"
                    : "Vector v"}
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {([0, 1] as const).map((index) => (
                  <IntegerField
                    key={index}
                    label={`v ${index === 0 ? "x" : "y"}`}
                    value={draft.v[index]}
                    limit={4}
                    onChange={(value) => setVector("v", index, value)}
                  />
                ))}
              </div>
            </fieldset>
          ) : null}
          {mode === "combinations" ? (
            <fieldset>
              <legend className="mb-3 font-medium">Combination coefficients</legend>
              <div className="grid grid-cols-2 gap-3">
                {(["a", "b"] as const).map((field) => (
                  <IntegerField
                    key={field}
                    label={field}
                    value={draft[field]}
                    limit={3}
                    onChange={(value) => change((current) => ({ ...current, [field]: value }))}
                  />
                ))}
              </div>
            </fieldset>
          ) : null}
          {["matrices", "maps", "affine"].includes(mode) ? (
            <fieldset>
              <legend className="mb-3 font-medium">Matrix A</legend>
              <div className="grid grid-cols-2 gap-3">
                {([0, 1] as const).flatMap((row) =>
                  ([0, 1] as const).map((column) => (
                    <IntegerField
                      key={`${row}-${column}`}
                      label={`A row ${row + 1} column ${column + 1}`}
                      value={draft.A[row][column]}
                      limit={3}
                      onChange={(value) => setMatrix("A", row, column, value)}
                    />
                  )),
                )}
              </div>
            </fieldset>
          ) : null}
          {mode === "matrices" ? (
            <>
              <fieldset>
                <legend className="mb-3 font-medium">Matrix B</legend>
                <div className="grid grid-cols-2 gap-3">
                  {([0, 1] as const).flatMap((row) =>
                    ([0, 1] as const).map((column) => (
                      <IntegerField
                        key={`${row}-${column}`}
                        label={`B row ${row + 1} column ${column + 1}`}
                        value={draft.B[row][column]}
                        limit={3}
                        onChange={(value) => setMatrix("B", row, column, value)}
                      />
                    )),
                  )}
                </div>
              </fieldset>
              <label className="text-sm text-[#c4d3e6]">
                Composition order
                <select
                  aria-label="Composition order"
                  className="mt-2 block min-h-11 w-full rounded-lg border border-[#3b506a] bg-[#091421] px-3 py-2"
                  value={draft.order}
                  onChange={(event) =>
                    change((current) => ({ ...current, order: event.target.value === "AB" ? "AB" : "BA" }))
                  }
                >
                  <option value="AB">AB · B acts first</option>
                  <option value="BA">BA · A acts first</option>
                </select>
              </label>
            </>
          ) : null}
          {mode === "geometry" ? (
            <>
              <label className="text-sm text-[#c4d3e6]">
                Geometric operation
                <select
                  aria-label="Geometric operation"
                  className="mt-2 block min-h-11 w-full rounded-lg border border-[#3b506a] bg-[#091421] px-3 py-2"
                  value={draft.operation}
                  onChange={(event) => {
                    const operation = OPERATIONS.find((item) => item.value === event.target.value)?.value;
                    if (operation) change((current) => ({ ...current, operation }));
                  }}
                >
                  {OPERATIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              {["shear-x", "shear-y"].includes(draft.operation) ? (
                <IntegerField
                  label="a"
                  value={draft.a}
                  limit={3}
                  onChange={(value) => change((current) => ({ ...current, a: value }))}
                />
              ) : null}
            </>
          ) : null}
          {mode === "affine" ? (
            <fieldset>
              <legend className="mb-3 font-medium">Translation t</legend>
              <div className="grid grid-cols-2 gap-3">
                {([0, 1] as const).map((index) => (
                  <IntegerField
                    key={index}
                    label={`Translation ${index === 0 ? "x" : "y"}`}
                    value={draft.t[index]}
                    limit={4}
                    onChange={(value) => setVector("t", index, value)}
                  />
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
        <div className="mt-7 rounded-xl border border-[#314760] bg-[#0b1727] p-4 sm:p-5">
          <label htmlFor={predictionId} className="block font-medium">
            Your coordinate prediction <span className="font-normal text-[#9eb2c9]">(optional)</span>
          </label>
          <p id={`${predictionId}-help`} className="mt-2 text-sm leading-7 text-[#a9bdd4]">
            {LAB_LESSONS[mode].prediction} Enter two coordinates, such as [1/2, -2], or leave this blank to
            explore without a prediction. Fractions and the bounded math-input grammar are supported.
          </p>
          <input
            id={predictionId}
            aria-label="Your coordinate prediction"
            type="text"
            value={prediction}
            onChange={(event) => {
              setPredictions((current) => ({ ...current, [mode]: event.target.value }));
              setRevealed(null);
              setAnnouncement("");
            }}
            maxLength={4000}
            aria-invalid={Boolean(predictionError)}
            aria-describedby={`${predictionId}-help${predictionError ? ` ${predictionId}-error` : ""}`}
            className="mt-3 min-h-11 w-full rounded-lg border border-[#3b506a] bg-[#091421] px-3 py-2 text-base text-white"
            placeholder="[x, y]"
          />
          {predictionError ? (
            <p id={`${predictionId}-error`} className="mt-2 text-sm text-[#ffc2ad]">
              {predictionError}
            </p>
          ) : null}
        </div>
        {!scene ? (
          <p className="mt-4 text-sm leading-7 text-[#ffc2ad]">
            Correct the highlighted controls before revealing the result. Empty and partial input stays
            available to edit.
          </p>
        ) : experiment?.error ? (
          <p className="mt-4 text-sm leading-7 text-[#ffc2ad]">{experiment.error}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary min-h-11" onClick={reveal} disabled={invalid}>
            Reveal result
          </button>
          <button
            type="button"
            className="btn min-h-11"
            onClick={() => {
              setDrafts((current) => ({ ...current, [mode]: raw(defaultScene(mode)) }));
              setPresetIds((current) => ({
                ...current,
                [mode]: LAB_PRESETS.find((preset) => preset.mode === mode)?.id ?? "custom",
              }));
              invalidate(true);
            }}
          >
            Reset experiment
          </button>
          <Link
            className="btn inline-flex min-h-11 items-center"
            href={`/roadmaps/linear-algebra/${LAB_LESSONS[mode].topic}`}
          >
            Read the lesson
          </Link>
        </div>
      </section>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <LinearPlane
          vectors={vectors}
          points={points}
          gridMatrix={revealed?.experiment.gridMatrix}
          gridOffset={mode === "affine" && revealed ? revealed.scene.t : undefined}
          lineDirection={revealed?.experiment.lineDirection}
          description={
            revealed
              ? "Revealed experiment. The same numerical values appear in the text table."
              : "Input quantities only. Reveal the result to see transformed quantities and the worked explanation."
          }
        />
        {revealed ? (
          <section className="panel min-w-0 space-y-6 p-5 sm:p-7" aria-labelledby="lab-result-title">
            <div>
              <h2 id="lab-result-title" className="text-2xl font-semibold">
                Experiment result
              </h2>
              {revealed.experiment.output ? (
                <p className="mt-3 text-lg text-[#f7d18b]">
                  Result coordinates: <strong>{formatVector(revealed.experiment.output)}</strong>
                </p>
              ) : null}
              {revealed.prediction ? (
                <p className="mt-3 text-sm leading-7 text-[#c3d5ed]">{revealed.prediction}</p>
              ) : null}
              <p className="mt-2 text-xs leading-6 text-[#91a8c2]">
                Displayed decimals may be rounded. Prediction comparison uses the computed values with an
                absolute tolerance of 0.000001 per coordinate and is local feedback.
              </p>
            </div>
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-7 text-[#b8c9de]">
              {revealed.experiment.steps.map((step, index) => (
                <li key={index}>
                  <MathText className="block max-w-full overflow-x-auto pb-1">{step}</MathText>
                </li>
              ))}
            </ol>
            <dl className="grid gap-4 sm:grid-cols-2">
              {revealed.experiment.facts.map((fact) => (
                <div key={fact.label} className="min-w-0 rounded-lg bg-[#0b1727] p-3">
                  <dt className="text-xs text-[#95acc6]">{fact.label}</dt>
                  <dd className="mt-1 break-words text-sm text-[#d5e2f3]">{fact.value}</dd>
                </div>
              ))}
            </dl>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-[#a9bdd4]">
              {revealed.experiment.observations.map((observation, index) => (
                <li key={index}>
                  <MathText>{observation}</MathText>
                </li>
              ))}
            </ul>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="mb-3 text-left font-medium">Coordinates shown in the diagram</caption>
                <thead className="text-[#9eb4ce]">
                  <tr>
                    <th scope="col" className="p-2">
                      Quantity
                    </th>
                    <th scope="col" className="p-2">
                      From
                    </th>
                    <th scope="col" className="p-2">
                      To / point
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {revealed.experiment.vectors.map((vector, index) => (
                    <tr key={`${vector.label}-${index}`} className="border-t border-[#26394e]">
                      <th scope="row" className="p-2 font-medium">
                        {vector.label}
                      </th>
                      <td className="whitespace-nowrap p-2">{formatVector(vector.from)}</td>
                      <td className="whitespace-nowrap p-2">{formatVector(vector.to)}</td>
                    </tr>
                  ))}
                  {revealed.experiment.points.map((point, index) => (
                    <tr key={`${point.label}-${index}`} className="border-t border-[#26394e]">
                      <th scope="row" className="p-2 font-medium">
                        {point.label}
                      </th>
                      <td className="p-2">Point</td>
                      <td className="whitespace-nowrap p-2">{formatVector(point.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <label htmlFor={reasoningId} className="block font-medium">
                Explain your reasoning
              </label>
              <p id={`${reasoningId}-prompt`} className="mt-2 text-sm leading-7 text-[#a9bdd4]">
                {REFLECTIONS[mode]}
              </p>
              <textarea
                id={reasoningId}
                value={notes[mode]}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [mode]: event.target.value.slice(0, 4000) }))
                }
                maxLength={4000}
                rows={4}
                aria-describedby={`${reasoningId}-prompt ${reasoningId}-privacy`}
                className="mt-3 w-full rounded-lg border border-[#3b506a] bg-[#091421] p-3 text-base text-white"
              />
              <p id={`${reasoningId}-privacy`} className="mt-2 text-xs leading-6 text-[#91a8c2]">
                Kept for this visit only. Your explanation is not graded or saved to your account.{" "}
                {notes[mode].length}/4000 characters.
              </p>
            </div>
          </section>
        ) : (
          <section className="panel p-6 text-sm leading-8 text-[#a9bdd4]">
            <h2 className="text-xl font-semibold text-white">Predict, then inspect</h2>
            <p className="mt-3">
              The diagram currently shows only your input quantities. Reveal the result when you are ready to
              compare coordinates, read the calculation, and explain the idea in your own words.
            </p>
            <p className="mt-3">
              These experiments use two-dimensional vectors and small matrices. They illustrate the authored
              lessons; they are not a symbolic algebra system or a complete proof from a few plotted examples.
            </p>
          </section>
        )}
      </div>
      <nav className="panel p-5 sm:p-7" aria-label="Linear algebra lab lessons">
        <h2 className="font-semibold">Connect the experiment to a lesson</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LAB_MODES.map((item) => (
            <li key={item}>
              <Link
                className="inline-block py-2 text-sm leading-6 text-[#a7cdfa] underline underline-offset-4"
                href={`/roadmaps/linear-algebra/${LAB_LESSONS[item].topic}`}
              >
                {LAB_LESSONS[item].title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
