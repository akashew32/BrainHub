"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ReflectionNote } from "@/lib/curriculum";

type LocalReflection = { version: 1; text: string; base_revision: number; updated_at: number };
// Used only in browser effects/events when device storage is unavailable.
const volatileDrafts = new Map<string, LocalReflection>();

function readLocal(key: string): LocalReflection | null {
  const memory = volatileDrafts.get(key) ?? null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const candidate = JSON.parse(raw) as Partial<LocalReflection>;
      if (
        candidate.version === 1 &&
        typeof candidate.text === "string" &&
        candidate.text.length <= 4000 &&
        Number.isInteger(candidate.base_revision) &&
        (candidate.base_revision ?? -1) >= 0 &&
        typeof candidate.updated_at === "number" &&
        Number.isFinite(candidate.updated_at)
      ) {
        return memory && memory.updated_at >= candidate.updated_at ? memory : (candidate as LocalReflection);
      }
    }
  } catch {
    /* The in-memory fallback retains drafts during this browser session. */
  }
  return memory;
}

type ReflectionProps = {
  roadmapSlug: string;
  questionId: string;
  concept: string;
  initialNote: ReflectionNote;
  onSaved?: (note: ReflectionNote) => void;
};

export function QuestionReflection(props: ReflectionProps) {
  return <ReflectionEditor key={`${props.roadmapSlug}:${props.questionId}`} {...props} />;
}

function ReflectionEditor({ roadmapSlug, questionId, concept, initialNote, onSaved }: ReflectionProps) {
  const storageKey = `brainhub:question-reflection:v1:${roadmapSlug}:${questionId}`;
  const initial = useRef(initialNote);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(initialNote);
  const [conflict, setConflict] = useState<ReflectionNote | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("Your reflection is saved to your profile when you select Save.");
  const [storageFailed, setStorageFailed] = useState(false);
  const mounted = useRef(false);
  const pending = useRef(false);
  const textRef = useRef("");
  const baseRevision = useRef(initialNote.revision);

  useEffect(() => {
    mounted.current = true;
    const note = initial.current;
    const draft = readLocal(storageKey);
    const restored = draft && draft.text !== note.text ? draft : null;
    const next = restored?.text ?? note.text;
    textRef.current = next;
    baseRevision.current = restored?.base_revision ?? note.revision;
    setText(next);
    if (restored) {
      setMessage("Unsaved reflection restored from this device.");
      if (restored.base_revision !== note.revision) setConflict(note);
    }
    setLoaded(true);
    return () => {
      mounted.current = false;
    };
  }, [storageKey]);

  function persist(value: string, revision: number) {
    const next: LocalReflection = {
      version: 1,
      text: value,
      base_revision: revision,
      updated_at: Math.max(Date.now(), (volatileDrafts.get(storageKey)?.updated_at ?? 0) + 1),
    };
    volatileDrafts.set(storageKey, next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  }
  function clearLocal(expectedText: string, expectedRevision: number) {
    const memory = volatileDrafts.get(storageKey);
    if (memory?.text === expectedText && memory.base_revision === expectedRevision)
      volatileDrafts.delete(storageKey);
    try {
      const raw = localStorage.getItem(storageKey);
      const stored = raw ? (JSON.parse(raw) as Partial<LocalReflection>) : null;
      // A different tab may have written a newer draft while this request was in flight.
      if (stored?.text === expectedText && stored.base_revision === expectedRevision)
        localStorage.removeItem(storageKey);
    } catch {
      setStorageFailed(true);
    }
  }
  function acknowledge(note: ReflectionNote, submitted: string, submittedRevision: number) {
    setSaved(note);
    baseRevision.current = note.revision;
    setConflict(null);
    setError(null);
    if (textRef.current === submitted) {
      clearLocal(submitted, submittedRevision);
      setMessage(`Reflection saved to your profile (revision ${note.revision}).`);
    } else {
      persist(textRef.current, note.revision);
      setMessage("The submitted reflection was saved. Your newer edits are still unsaved.");
    }
    onSaved?.(note);
  }

  async function save(revision = baseRevision.current) {
    if (pending.current) return;
    if (textRef.current.includes("\0")) {
      setError("Remove the unsupported null character before saving.");
      return;
    }
    pending.current = true;
    setSaving(true);
    setError(null);
    const submitted = textRef.current;
    persist(submitted, revision);
    try {
      const note = await api.saveQuestionReflection(roadmapSlug, questionId, { text: submitted, revision });
      if (mounted.current) acknowledge(note, submitted, revision);
    } catch (problem) {
      if (!mounted.current) return;
      // Reconcile an acknowledged write whose response was lost, without discarding newer edits.
      try {
        const latest = (await api.notebookQuestion(roadmapSlug, questionId)).note;
        if (!mounted.current) return;
        if (latest.text === submitted) {
          acknowledge(latest, submitted, revision);
          return;
        }
        setSaved(latest);
        if ((problem instanceof ApiError && problem.status === 409) || latest.revision !== revision)
          setConflict(latest);
      } catch {
        /* A retry uses the same base revision and remains safe. */
      }
      if (mounted.current)
        setError(
          problem instanceof Error
            ? problem.message
            : "Unable to save. Your reflection is kept here; try again.",
        );
    } finally {
      if (mounted.current) {
        pending.current = false;
        setSaving(false);
      }
    }
  }

  function useSaved() {
    if (!conflict) return;
    clearLocal(textRef.current, baseRevision.current);
    textRef.current = conflict.text;
    baseRevision.current = conflict.revision;
    setText(conflict.text);
    setSaved(conflict);
    setConflict(null);
    setError(null);
    setMessage("Using the latest reflection saved to your profile.");
  }

  return (
    <section
      className="rounded-xl border border-[#35425a] bg-[#0b111a] p-5"
      aria-label={`Reflection for ${concept}`}
    >
      <h3 className="text-lg font-semibold">Your reflection</h3>
      <p className="mt-2 text-sm leading-7 text-[#9baec6]">
        Explain the misconception, the step that fixed it, and an example you can reproduce independently.
      </p>
      <label className="mt-4 block text-sm" htmlFor={`reflection-${roadmapSlug}-${questionId}`}>
        Reflection for {concept}
      </label>
      <textarea
        id={`reflection-${roadmapSlug}-${questionId}`}
        className="input mt-2 min-h-36 resize-y leading-7"
        maxLength={4000}
        disabled={!loaded}
        value={text}
        onChange={(event) => {
          const value = event.target.value;
          textRef.current = value;
          setText(value);
          persist(value, baseRevision.current);
          setMessage("Unsaved changes kept on this device. Select Save to update your profile.");
        }}
      />
      <p className="mt-2 text-right text-xs text-[#91a4bb]">{text.length}/4000</p>
      <p className="mt-2 text-sm leading-7 text-[#a6b6cb]" role="status">
        {message}
      </p>
      {storageFailed ? (
        <p className="mt-2 text-sm text-[#f8c28d]">
          Device storage is unavailable. This tab retains your text; save to your profile before closing the
          browser.
        </p>
      ) : null}
      {conflict ? (
        <div className="mt-4 rounded-xl border border-[#705933] p-4" role="alert">
          <h4 className="font-semibold">A newer saved reflection needs your review</h4>
          <p className="mt-2 text-sm leading-7">
            Your text remains in the editor. The profile contains revision {conflict.revision}:
          </p>
          <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-[#141b26] p-3 text-sm">
            {conflict.text || "(Empty reflection)"}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn" type="button" disabled={saving} onClick={() => save(conflict.revision)}>
              Save my text using latest revision
            </button>
            <button className="btn" type="button" disabled={saving} onClick={useSaved}>
              Use saved reflection
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm leading-7 text-[#fdba9a]" role="alert">
          {error} Your text has been preserved.
        </p>
      ) : null}
      <button
        className="btn btn-primary mt-4"
        type="button"
        disabled={!loaded || saving || Boolean(conflict) || text === saved.text}
        onClick={() => save()}
      >
        {saving ? "Saving reflection…" : "Save reflection"}
      </button>
    </section>
  );
}
