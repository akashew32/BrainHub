"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useClientReady } from "@/lib/use-client-ready";
import type { StudyPlan } from "@/lib/curriculum";
import { learningRoadmaps, roadmapMap } from "@/lib/roadmaps";
import { AssessmentPanel, type AssessmentPhase } from "@/components/roadmaps/assessment-panel";
import { StudyPreferencesEditor } from "@/components/roadmaps/study-preferences-editor";
import { DailyStudyGoalCard, recordedDuration } from "@/components/roadmaps/daily-study-goal";

type Choice = { version: 1; id: string; roadmapSlug: string; budgetMinutes: number };
type Options = { subject: string; budget: string };
const CHOICE_KEY = "brainhub:study-choice:v1:local-quant";
function readChoice(): Choice | null {
  try {
    const raw = localStorage.getItem(CHOICE_KEY);
    const value = raw ? (JSON.parse(raw) as Partial<Choice>) : null;
    return value?.version === 1 &&
      typeof value.id === "string" &&
      typeof value.roadmapSlug === "string" &&
      Boolean(roadmapMap[value.roadmapSlug]) &&
      Number.isInteger(value.budgetMinutes) &&
      (value.budgetMinutes ?? 0) >= 5 &&
      (value.budgetMinutes ?? 61) <= 60
      ? (value as Choice)
      : null;
  } catch {
    return null;
  }
}

export function StudyPlanner() {
  const ready = useClientReady();
  return ready ? (
    <StudyPlannerWorkspace />
  ) : (
    <p className="panel p-6" role="status">
      Loading your study planner…
    </p>
  );
}

function StudyPlannerWorkspace() {
  const [options, setOptions] = useState<Options>({ subject: "", budget: "" });
  const [applied, setApplied] = useState<Options>({ subject: "", budget: "" });
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [choice, setChoice] = useState<Choice | null>(readChoice);
  const [phase, setPhase] = useState<AssessmentPhase>("recovering");
  const [storageFailed, setStorageFailed] = useState(false);
  const currentChoice = useRef<Choice | null>(choice);
  const queryKey = JSON.stringify(applied);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const refresh = useCallback(() => {
    setLoading(true);
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    let active = true;
    api
      .studyPlan({
        roadmap_slug: applied.subject || undefined,
        budget_minutes: applied.budget ? Number(applied.budget) : undefined,
      })
      .then((response) => {
        if (active) {
          setPlan(response);
          setLoadedKey(queryKey);
          setError(null);
        }
      })
      .catch((problem: unknown) => {
        if (active) setError(problem instanceof Error ? problem.message : "Unable to load your study plan.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applied.subject, applied.budget, queryKey, revision]);
  const completed = useCallback(() => {
    setPhase("completed");
    const active = currentChoice.current;
    try {
      if (active && readChoice()?.id === active.id) localStorage.removeItem(CHOICE_KEY);
    } catch {
      /* Keep the current session visible if removal fails. */
    }
    refresh();
  }, [refresh]);
  const phaseChanged = useCallback((next: AssessmentPhase) => setPhase(next), []);
  const optionsChanged = options.subject !== applied.subject || options.budget !== applied.budget;
  const visiblePlan = loadedKey === queryKey ? plan : null;
  const recommendation = !loading && !error && !optionsChanged ? visiblePlan?.recommendation : null;
  const canChoose = !choice || phase === "idle" || phase === "closed" || phase === "completed";
  function choose() {
    if (!recommendation || !canChoose || !roadmapMap[recommendation.roadmap_slug]) return;
    const next: Choice = {
      version: 1,
      id: crypto.randomUUID(),
      roadmapSlug: recommendation.roadmap_slug,
      budgetMinutes: recommendation.budget_minutes,
    };
    currentChoice.current = next;
    setChoice(next);
    setPhase("recovering");
    try {
      localStorage.setItem(CHOICE_KEY, JSON.stringify(next));
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  }
  return (
    <div className="space-y-7">
      <DailyStudyGoalCard
        goal={error ? null : (visiblePlan?.daily_goal ?? null)}
        loading={loading}
        error={error}
        onRetry={refresh}
      />
      <StudyPreferencesEditor onSaved={refresh} onServerPreferences={refresh} />
      <section className="panel p-5 sm:p-7" aria-labelledby="study-preview-heading" aria-busy={loading}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-2xl font-semibold" id="study-preview-heading">
            Plan a study set
          </h2>
          <button className="btn" type="button" disabled={loading} onClick={refresh}>
            Refresh study preview
          </button>
        </div>
        <p className="mt-3 text-sm leading-7 text-[#9baec6]">
          Choose a short session budget. Selection prioritizes due questions, then weak concepts, then the
          next foundation practice. Estimates help bound a set; actual solving time varies. Study sets do not
          complete lessons or unlock exams.
        </p>
        <div className="mt-5 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            Study set subject
            <select
              className="input mt-2 block"
              value={options.subject}
              onChange={(event) => setOptions((previous) => ({ ...previous, subject: event.target.value }))}
            >
              <option value="">Use saved subject preference</option>
              {learningRoadmaps.map((roadmap) => (
                <option key={roadmap.slug} value={roadmap.slug}>
                  {roadmap.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Study set budget
            <select
              className="input mt-2 block"
              value={options.budget}
              onChange={(event) => setOptions((previous) => ({ ...previous, budget: event.target.value }))}
            >
              <option value="">Use saved session budget</option>
              {[5, 10, 15, 20, 30, 45, 60].map((minutes) => (
                <option key={minutes} value={String(minutes)}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setLoading(true);
              setApplied({ ...options });
              setRevision((value) => value + 1);
            }}
          >
            Update preview
          </button>
        </div>
        {optionsChanged ? (
          <p className="mt-3 text-sm leading-7 text-[#d2bc96]">
            Update the preview to apply these options. Your current study set stays open.
          </p>
        ) : null}
        {loading ? (
          <p className="mt-4 text-sm text-[#91a4bb]" role="status">
            Loading your study preview…
          </p>
        ) : null}
        {error ? (
          <div className="mt-4 text-sm leading-7 text-[#e3be9d]" role="alert">
            <p>Study preview unavailable. {error} Your current session remains available below.</p>
            <button className="btn mt-3" type="button" disabled={loading} onClick={refresh}>
              Retry study preview
            </button>
          </div>
        ) : null}
        {visiblePlan && !error ? (
          <>
            <p className="mt-4 text-sm text-[#91a4bb]">
              Saved default: {visiblePlan.preferences.session_minutes} minutes per set · daily goal{" "}
              {visiblePlan.preferences.goal_minutes} minutes
            </p>
            {visiblePlan.recommendation ? (
              <div className="mt-4 rounded-xl border border-[#35425a] p-5">
                <h3 className="text-xl font-semibold">
                  {roadmapMap[visiblePlan.recommendation.roadmap_slug]?.title ??
                    visiblePlan.recommendation.roadmap_slug}{" "}
                  study set
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#b4c5da]">
                  {visiblePlan.recommendation.question_count} questions · estimated{" "}
                  {recordedDuration(visiblePlan.recommendation.estimated_seconds)} within a{" "}
                  {visiblePlan.recommendation.budget_minutes}-minute budget
                </p>
                <p className="mt-2 text-sm text-[#91a4bb]">
                  {visiblePlan.recommendation.reason_counts.due} due ·{" "}
                  {visiblePlan.recommendation.reason_counts.weak} weak-concept ·{" "}
                  {visiblePlan.recommendation.reason_counts.next} next or unseen
                </p>
                <p className="mt-3 text-sm leading-7 text-[#a6b6cb]">{visiblePlan.recommendation.reason}</p>
                <button
                  className="btn btn-primary mt-4"
                  type="button"
                  disabled={!recommendation || !canChoose}
                  onClick={choose}
                >
                  {choice ? "Use preview for the next set" : "Open recommended study set"}
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-[#91a4bb]">
                No study set is available for these options. Choose another subject or visit a lesson practice
                set.
              </p>
            )}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {visiblePlan.subjects.map((subject) => (
                <div
                  className="rounded-xl border border-[#263449] p-3 text-xs leading-6 text-[#91a4bb]"
                  key={subject.slug}
                >
                  <p className="font-semibold text-[#b5c7db]">
                    {roadmapMap[subject.slug]?.title ?? subject.slug}
                  </p>
                  <p>
                    {subject.due} due · {subject.weak} weak · {subject.unseen} available skills
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : null}
        {choice && !canChoose ? (
          <p className="mt-4 text-sm leading-7 text-[#d2bc96]">
            Finish the active study set before applying another preview. Its questions, budget, and saved
            answers stay unchanged.
          </p>
        ) : null}
      </section>
      {storageFailed ? (
        <p className="rounded-xl border border-[#705933] p-4 text-sm leading-7 text-[#e3be9d]">
          Device storage is unavailable. Keep this page open to continue the current study scope; saved
          sessions can also be reopened from your history.
        </p>
      ) : null}
      {choice ? (
        <section aria-label="Current study workspace" className="space-y-4">
          <p className="text-sm text-[#a6b6cb]">
            Current set: {roadmapMap[choice.roadmapSlug]?.title} · {choice.budgetMinutes}-minute estimated
            budget
          </p>
          <AssessmentPanel
            key={choice.id}
            roadmapSlug={choice.roadmapSlug}
            mode="study"
            budgetMinutes={choice.budgetMinutes}
            onCompleted={completed}
            onSessionPhaseChange={phaseChanged}
          />
        </section>
      ) : null}
      <Link className="inline-block text-sm font-semibold text-[#8dc8ff]" href="/roadmaps/sessions">
        Reopen another saved assessment →
      </Link>
    </div>
  );
}
