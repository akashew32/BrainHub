"use client";

import { useEffect, useRef, useState } from "react";
import { MathText } from "@/components/roadmaps/math-text";

type ProofOrder = { order: number[]; issue: null } | { order: null; issue: string };

/** Inspect only step IDs and shape, never whether a proof order is mathematically correct. */
export function parseProofOrder(raw: string, totalSteps: number): ProofOrder {
  if (!raw.trim()) return { order: [], issue: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { order: null, issue: "The saved order is not a complete JSON array." };
  }
  if (!Array.isArray(parsed))
    return { order: null, issue: "A proof order must be an array of numbered steps." };
  if (parsed.some((step) => typeof step !== "number" || !Number.isInteger(step)))
    return { order: null, issue: "Use whole-number step labels in the proof order." };
  const order = parsed as number[];
  if (order.some((step) => step < 1 || step > totalSteps))
    return { order: null, issue: "One or more step labels are outside this question's available steps." };
  if (new Set(order).size !== order.length)
    return { order: null, issue: "The saved order repeats a step. Each step can be selected once." };
  if (!/^\s*\[\s*(?:[1-9]\d*(?:\s*,\s*[1-9]\d*)*)?\s*\]\s*$/.test(raw))
    return {
      order: null,
      issue: "Use plain integer step labels; decimal and exponent notation are not step labels.",
    };
  return { order, issue: null };
}

export function ProofBuilder({
  id,
  choices,
  value,
  onChange,
  disabled = false,
  label = "Raw proof order",
  describedBy,
}: {
  id: string;
  choices: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  describedBy?: string;
}) {
  const parsed = parseProofOrder(value, choices.length);
  const selected = parsed.order ?? [];
  const pendingFocus = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [rawOpen, setRawOpen] = useState(false);

  useEffect(() => {
    if (!disabled && pendingFocus.current) document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [disabled, value]);

  function changeOrder(order: number[], focus?: string, message = "Proof order updated.") {
    if (disabled) return;
    pendingFocus.current = focus ?? null;
    setAnnouncement(message);
    onChange(JSON.stringify(order));
  }

  function add(step: number) {
    if (disabled || parsed.issue || selected.includes(step)) return;
    changeOrder(
      [...selected, step],
      id + "-remove-" + step,
      "Added step " + step + " at position " + (selected.length + 1) + ".",
    );
  }

  function remove(step: number) {
    if (disabled || parsed.issue) return;
    changeOrder(
      selected.filter((current) => current !== step),
      id + "-add-" + step,
      "Removed step " + step + " from the proof.",
    );
  }

  function move(position: number, offset: -1 | 1) {
    if (disabled || parsed.issue || position + offset < 0 || position + offset >= selected.length) return;
    const next = [...selected];
    [next[position], next[position + offset]] = [next[position + offset]!, next[position]!];
    const step = selected[position]!;
    const newPosition = position + offset;
    const canMoveAgain = offset === -1 ? newPosition > 0 : newPosition < selected.length - 1;
    const focus = id + (canMoveAgain ? (offset === -1 ? "-up-" : "-down-") : "-remove-") + step;
    changeOrder(
      next,
      focus,
      "Moved step " + step + " to position " + (newPosition + 1) + " of " + selected.length + ".",
    );
  }

  return (
    <div id={id} tabIndex={-1} role="group" aria-labelledby={id + "-title"} aria-describedby={describedBy}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold" id={id + "-title"}>
          Build your proof order
        </h3>
        <button
          className="btn text-xs"
          type="button"
          disabled={disabled || (!parsed.issue && selected.length === 0)}
          onClick={() => changeOrder([], id + "-add-1", "Proof order reset. No steps are selected.")}
        >
          Reset proof order
        </button>
      </div>
      <p className="mt-2 text-sm leading-7 text-[#9caec4]">
        Add steps in logical order. Use the up, down, and remove buttons to revise your argument. All controls
        work with the keyboard.
      </p>
      <p className="mt-3 text-sm text-[#a8c7e3]" aria-live="polite">
        Selected {selected.length} of {choices.length} steps
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {parsed.issue ? (
        <p className="mt-3 rounded-lg border border-[#745334] bg-[#241c11] p-3 text-sm leading-7 text-[#f8cf93]">
          {parsed.issue} Your original response is unchanged. Edit the raw order below, or deliberately reset
          it before using the builder.
        </p>
      ) : null}
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section aria-labelledby={id + "-available"}>
          <h4 className="text-sm font-semibold text-[#b9c9dc]" id={id + "-available"}>
            Available numbered steps
          </h4>
          <ol className="mt-3 space-y-3" aria-label="Available proof steps">
            {choices.map((step, index) => (
              <li className="rounded-xl border border-[#2b3d54] bg-[#0d1724] p-3" key={index}>
                <p className="text-xs font-semibold text-[#a78bfa]">Step {index + 1}</p>
                <p className="mt-2 text-sm leading-7 text-[#b9c7d8]">
                  <MathText>{step}</MathText>
                </p>
                <button
                  className="btn mt-3 text-xs"
                  id={id + "-add-" + (index + 1)}
                  type="button"
                  aria-label={"Add step " + (index + 1) + " to proof"}
                  disabled={disabled || Boolean(parsed.issue) || selected.includes(index + 1)}
                  onClick={() => add(index + 1)}
                >
                  {selected.includes(index + 1) ? "Selected" : "Add to proof"}
                </button>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby={id + "-selected"}>
          <h4 className="text-sm font-semibold text-[#b9c9dc]" id={id + "-selected"}>
            Your ordered argument
          </h4>
          {selected.length ? (
            <ol className="mt-3 space-y-3" aria-label="Selected proof steps">
              {selected.map((step, position) => (
                <li className="rounded-xl border border-[#3a4767] bg-[#151a2b] p-3" key={step}>
                  <p className="text-xs font-semibold text-[#b8a8ee]">
                    Position {position + 1} · Step {step}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[#c6cfe0]">
                    <MathText>{choices[step - 1]!}</MathText>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="btn text-xs"
                      id={id + "-up-" + step}
                      type="button"
                      aria-label={"Move step " + step + " up"}
                      disabled={disabled || position === 0}
                      onClick={() => move(position, -1)}
                    >
                      ↑ Up
                    </button>
                    <button
                      className="btn text-xs"
                      id={id + "-down-" + step}
                      type="button"
                      aria-label={"Move step " + step + " down"}
                      disabled={disabled || position === selected.length - 1}
                      onClick={() => move(position, 1)}
                    >
                      ↓ Down
                    </button>
                    <button
                      className="btn text-xs"
                      id={id + "-remove-" + step}
                      type="button"
                      aria-label={"Remove step " + step + " from proof"}
                      disabled={disabled}
                      onClick={() => remove(step)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-[#35435b] p-4 text-sm leading-7 text-[#8197b0]">
              No steps selected yet. Add the first step from the available list.
            </p>
          )}
          {selected.length === choices.length && !parsed.issue ? (
            <p className="mt-3 text-xs leading-6 text-[#91aec8]">
              All steps are selected. The order will be checked when you submit.
            </p>
          ) : null}
        </section>
      </div>
      <details
        className="mt-5 rounded-lg border border-[#2d3c51] p-3"
        open={Boolean(parsed.issue) || rawOpen}
      >
        <summary
          className="cursor-pointer text-sm text-[#91a8c3]"
          aria-disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            if (!disabled) setRawOpen((open) => !open);
          }}
        >
          Raw order editor (optional)
        </summary>
        <label className="mt-3 block text-sm text-[#b3c1d3]" htmlFor={id + "-raw"}>
          {label}
        </label>
        <input
          className="math-answer mt-2"
          id={id + "-raw"}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          maxLength={4000}
          value={value}
          onChange={(event) => {
            if (!disabled) {
              setRawOpen(true);
              onChange(event.target.value);
            }
          }}
          aria-describedby={id + "-raw-help"}
        />
        <p className="mt-2 text-xs leading-6 text-[#8396ad]" id={id + "-raw-help"}>
          Put the numbered steps in logical order using a JSON array such as [3, 1, 2]. A partial order is
          saved exactly as entered. The builder never repairs or grades a raw order automatically.
        </p>
      </details>
    </div>
  );
}
