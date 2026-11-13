"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useClientReady } from "@/lib/use-client-ready";
import type { StudyPreferences } from "@/lib/curriculum";
import { learningRoadmaps, roadmapMap } from "@/lib/roadmaps";

type FormValues = { goal: string; budget: string; subject: string };
type FormDraft = { version: 1; values: FormValues; base_revision: number; updated_at: number };
const memoryDrafts = new Map<string, FormDraft>();
const valuesFor = (preferences: StudyPreferences): FormValues => ({
  goal: String(preferences.goal_minutes),
  budget: String(preferences.session_minutes),
  subject: preferences.preferred_roadmap_slug ?? "",
});
const sameValues = (a: FormValues, b: FormValues) =>
  a.goal === b.goal && a.budget === b.budget && a.subject === b.subject;
function readDraft(key: string): FormDraft | null {
  const memory = memoryDrafts.get(key);
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? (JSON.parse(raw) as Partial<FormDraft>) : null;
    if (
      value?.version === 1 &&
      value.values &&
      typeof value.values.goal === "string" &&
      value.values.goal.length <= 16 &&
      typeof value.values.budget === "string" &&
      value.values.budget.length <= 16 &&
      typeof value.values.subject === "string" &&
      (value.values.subject === "" || Boolean(roadmapMap[value.values.subject])) &&
      Number.isInteger(value.base_revision) &&
      (value.base_revision ?? -1) >= 0 &&
      typeof value.updated_at === "number" &&
      Number.isFinite(value.updated_at)
    )
      return memory && memory.updated_at >= value.updated_at ? memory : (value as FormDraft);
  } catch {
    /* Keep the in-memory draft when storage cannot be read. */
  }
  return memory ?? null;
}

export function StudyPreferencesEditor({
  onSaved,
  onServerPreferences,
  storageScope = "local-quant",
}: {
  onSaved?: (preferences: StudyPreferences) => void;
  onServerPreferences?: (preferences: StudyPreferences) => void;
  storageScope?: string;
}) {
  const ready = useClientReady();
  if (!ready)
    return (
      <p className="panel p-6" role="status">
        Loading your study preferences…
      </p>
    );
  return (
    <PreferencesWorkspace
      key={storageScope}
      onSaved={onSaved}
      onServerPreferences={onServerPreferences}
      storageScope={storageScope}
    />
  );
}

function PreferencesWorkspace({
  onSaved,
  onServerPreferences,
  storageScope,
}: {
  onSaved?: (preferences: StudyPreferences) => void;
  onServerPreferences?: (preferences: StudyPreferences) => void;
  storageScope: string;
}) {
  const storageKey = `brainhub:study-preferences:v1:${storageScope}`;
  const [initialDraft] = useState(() => readDraft(storageKey));
  const [form, setForm] = useState<FormValues>(
    () => initialDraft?.values ?? { goal: "", budget: "", subject: "" },
  );
  const [saved, setSaved] = useState<StudyPreferences | null>(null);
  const [conflict, setConflict] = useState<StudyPreferences | null>(null);
  const [loaded, setLoaded] = useState(Boolean(initialDraft));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const [message, setMessage] = useState(
    initialDraft
      ? "Unsaved preference edits restored from this device."
      : "Changes apply when you save your preferences.",
  );
  const [revision, setRevision] = useState(0);
  const mounted = useRef(false);
  const pending = useRef(false);
  const latestValues = useRef(form);
  const baseRevision = useRef(initialDraft?.base_revision ?? 0);
  const savedRef = useRef<StudyPreferences | null>(null);
  const savedCallback = useRef(onSaved);
  const serverPreferencesCallback = useRef(onServerPreferences);
  useEffect(() => {
    savedCallback.current = onSaved;
  }, [onSaved]);
  useEffect(() => {
    serverPreferencesCallback.current = onServerPreferences;
  }, [onServerPreferences]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    api
      .studyPreferences()
      .then((preferences) => {
        if (!active || (savedRef.current && preferences.revision < savedRef.current.revision)) return;
        savedRef.current = preferences;
        setSaved(preferences);
        setError(null);
        setLoaded(true);
        const draft = readDraft(storageKey);
        if (draft && !sameValues(draft.values, valuesFor(preferences))) {
          latestValues.current = draft.values;
          baseRevision.current = draft.base_revision;
          setForm(draft.values);
          if (draft.base_revision !== preferences.revision) {
            setConflict(preferences);
            serverPreferencesCallback.current?.(preferences);
          }
        } else {
          const values = valuesFor(preferences);
          latestValues.current = values;
          baseRevision.current = preferences.revision;
          setForm(values);
        }
      })
      .catch((problem: unknown) => {
        if (active)
          setError(problem instanceof Error ? problem.message : "Unable to load study preferences.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [storageKey, revision]);

  const persist = useCallback(
    (values: FormValues, base: number) => {
      const draft: FormDraft = {
        version: 1,
        values,
        base_revision: base,
        updated_at: Math.max(Date.now(), (memoryDrafts.get(storageKey)?.updated_at ?? 0) + 1),
      };
      memoryDrafts.set(storageKey, draft);
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
        setStorageFailed(false);
      } catch {
        setStorageFailed(true);
      }
    },
    [storageKey],
  );
  function clearMatching(values: FormValues, base: number) {
    const memory = memoryDrafts.get(storageKey);
    if (memory && sameValues(memory.values, values) && memory.base_revision === base)
      memoryDrafts.delete(storageKey);
    try {
      const raw = localStorage.getItem(storageKey);
      const current = raw ? (JSON.parse(raw) as Partial<FormDraft>) : null;
      if (current?.values && sameValues(current.values, values) && current.base_revision === base)
        localStorage.removeItem(storageKey);
    } catch {
      setStorageFailed(true);
    }
  }
  function change(field: keyof FormValues, value: string) {
    const next = { ...latestValues.current, [field]: value };
    latestValues.current = next;
    setForm(next);
    persist(next, baseRevision.current);
    setMessage("Unsaved changes kept on this device. Save to update your study preferences.");
  }
  function acknowledge(preferences: StudyPreferences, submitted: FormValues, submittedRevision: number) {
    savedRef.current = preferences;
    setSaved(preferences);
    baseRevision.current = preferences.revision;
    setConflict(null);
    setError(null);
    if (sameValues(latestValues.current, submitted)) {
      clearMatching(submitted, submittedRevision);
      const canonical = valuesFor(preferences);
      latestValues.current = canonical;
      setForm(canonical);
      setMessage(`Study preferences saved (revision ${preferences.revision}).`);
    } else {
      persist(latestValues.current, preferences.revision);
      setMessage("Submitted preferences were saved. Your newer edits are still unsaved.");
    }
    savedCallback.current?.(preferences);
  }
  async function save(expectedRevision = baseRevision.current) {
    if (pending.current) return;
    const submitted = { ...latestValues.current };
    if (
      !/^\d+$/.test(submitted.goal) ||
      Number(submitted.goal) < 5 ||
      Number(submitted.goal) > 120 ||
      !/^\d+$/.test(submitted.budget) ||
      Number(submitted.budget) < 5 ||
      Number(submitted.budget) > 60
    ) {
      setError(
        "Enter a whole-number daily goal from 5 to 120 minutes and a session budget from 5 to 60 minutes.",
      );
      return;
    }
    if (submitted.subject && !roadmapMap[submitted.subject]) {
      setError("Choose an available subject or automatic selection.");
      return;
    }
    pending.current = true;
    setSaving(true);
    setError(null);
    persist(submitted, expectedRevision);
    try {
      const preferences = await api.saveStudyPreferences({
        goal_minutes: Number(submitted.goal),
        session_minutes: Number(submitted.budget),
        preferred_roadmap_slug: submitted.subject || null,
        revision: expectedRevision,
      });
      if (mounted.current) acknowledge(preferences, submitted, expectedRevision);
    } catch (problem) {
      if (!mounted.current) return;
      try {
        const latest = await api.studyPreferences();
        if (!mounted.current) return;
        const normalized = {
          goal: String(Number(submitted.goal)),
          budget: String(Number(submitted.budget)),
          subject: submitted.subject,
        };
        if (sameValues(valuesFor(latest), normalized)) {
          acknowledge(latest, submitted, expectedRevision);
          return;
        }
        savedRef.current = latest;
        setSaved(latest);
        if ((problem instanceof ApiError && problem.status === 409) || latest.revision !== expectedRevision) {
          setConflict(latest);
          serverPreferencesCallback.current?.(latest);
        }
      } catch {
        /* The full form remains available for an idempotent retry. */
      }
      if (mounted.current)
        setError(
          problem instanceof Error ? problem.message : "Unable to save preferences. Your edits remain here.",
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
    clearMatching(latestValues.current, baseRevision.current);
    const values = valuesFor(conflict);
    latestValues.current = values;
    baseRevision.current = conflict.revision;
    savedRef.current = conflict;
    setSaved(conflict);
    setForm(values);
    setConflict(null);
    setError(null);
    setMessage("Using the latest saved study preferences.");
    savedCallback.current?.(conflict);
  }

  return (
    <section className="panel p-5 sm:p-7" aria-labelledby="study-preferences-heading">
      <h2 className="text-2xl font-semibold" id="study-preferences-heading">
        Your study preferences
      </h2>
      <p className="mt-3 text-sm leading-7 text-[#9baec6]">
        A daily goal can span several sets. Session budgets guide estimated question selection; individual
        solving times vary.
      </p>
      {loading ? (
        <p className="mt-3 text-sm text-[#91a4bb]" role="status">
          Loading saved study preferences…
        </p>
      ) : null}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          Daily goal in minutes
          <input
            className="input mt-2 block"
            type="text"
            inputMode="numeric"
            maxLength={16}
            value={form.goal}
            disabled={!loaded}
            onChange={(event) => change("goal", event.target.value)}
          />
        </label>
        <label className="text-sm">
          Default session budget in minutes
          <input
            className="input mt-2 block"
            type="text"
            inputMode="numeric"
            maxLength={16}
            value={form.budget}
            disabled={!loaded}
            onChange={(event) => change("budget", event.target.value)}
          />
        </label>
        <label className="text-sm">
          Preferred study subject
          <select
            className="input mt-2 block"
            value={form.subject}
            disabled={!loaded}
            onChange={(event) => change("subject", event.target.value)}
          >
            <option value="">Automatic selection</option>
            {learningRoadmaps.map((roadmap) => (
              <option key={roadmap.slug} value={roadmap.slug}>
                {roadmap.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-4 text-sm leading-7 text-[#a6b6cb]" role="status">
        {message}
      </p>
      {storageFailed ? (
        <p className="mt-2 text-sm leading-7 text-[#e4bd92]">
          Device storage is unavailable. This page keeps your edits; save them before leaving.
        </p>
      ) : null}
      {conflict ? (
        <div className="mt-4 rounded-xl border border-[#705933] p-4" role="alert">
          <h3 className="font-semibold">Saved preferences changed elsewhere</h3>
          <p className="mt-2 text-sm leading-7">
            Your edits are preserved above. Saved revision {conflict.revision}: {conflict.goal_minutes}-minute
            daily goal, {conflict.session_minutes}-minute sessions,{" "}
            {conflict.preferred_roadmap_slug
              ? (roadmapMap[conflict.preferred_roadmap_slug]?.title ?? conflict.preferred_roadmap_slug)
              : "automatic subject selection"}
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button className="btn" type="button" disabled={saving} onClick={() => save(conflict.revision)}>
              Save my edits using latest revision
            </button>
            <button className="btn" type="button" disabled={saving} onClick={useSaved}>
              Use saved preferences
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 text-sm leading-7 text-[#fdba9a]" role="alert">
          <p>{error} Your current edits have been kept.</p>
          {!conflict ? (
            <button
              className="btn mt-3"
              type="button"
              disabled={loading || saving}
              onClick={() => {
                setLoading(true);
                setRevision((value) => value + 1);
              }}
            >
              Retry loading preferences
            </button>
          ) : null}
        </div>
      ) : null}
      <button
        className="btn btn-primary mt-4"
        type="button"
        disabled={
          !loaded || saving || Boolean(conflict) || (saved !== null && sameValues(form, valuesFor(saved)))
        }
        onClick={() => save()}
      >
        {saving ? "Saving preferences…" : "Save study preferences"}
      </button>
    </section>
  );
}
