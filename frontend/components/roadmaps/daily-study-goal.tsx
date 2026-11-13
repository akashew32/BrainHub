"use client";

import type { DailyStudyGoal } from "@/lib/curriculum";

export function recordedDuration(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}m ${whole % 60}s`;
}

export function DailyStudyGoalCard({
  goal,
  loading,
  error,
  onRetry,
}: {
  goal: DailyStudyGoal | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const percentage = goal ? Math.min(100, Math.max(0, (goal.recorded_seconds / goal.goal_seconds) * 100)) : 0;
  return (
    <section className="panel p-5 sm:p-7" aria-labelledby="daily-study-goal-heading" aria-busy={loading}>
      <h2 className="text-2xl font-semibold" id="daily-study-goal-heading">
        Daily recorded study time
      </h2>
      <p className="mt-3 text-sm leading-7 text-[#9baec6]">
        Completed sessions add their recorded visible-page intervals to your UTC day. Time is added after
        submission; opening a page or saving a draft adds no goal credit.
      </p>
      {loading ? (
        <p className="mt-3 text-sm text-[#91a4bb]" role="status">
          Refreshing recorded study time…
        </p>
      ) : null}
      {error ? (
        <div className="mt-4 text-sm leading-7 text-[#e3be9d]" role="alert">
          <p>Recorded study time is unavailable. {error}</p>
          <button className="btn mt-3" type="button" disabled={loading} onClick={onRetry}>
            Retry study plan
          </button>
        </div>
      ) : goal ? (
        <>
          <p className="mt-4 text-sm text-[#91a4bb]">{goal.date} · UTC</p>
          <p className="mt-3 text-2xl font-semibold">
            {recordedDuration(goal.recorded_seconds)}{" "}
            <span className="text-base font-normal text-[#91a4bb]">
              recorded of {recordedDuration(goal.goal_seconds)} daily goal
            </span>
          </p>
          <div
            className="mt-4 h-3 overflow-hidden rounded-full bg-[#202937]"
            role="progressbar"
            aria-label="Daily recorded time goal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percentage)}
            aria-valuetext={`${recordedDuration(goal.recorded_seconds)} recorded of ${recordedDuration(goal.goal_seconds)}`}
          >
            <div className="h-full rounded-full bg-[#63e6be]" style={{ width: `${percentage}%` }} />
          </div>
          <p className="mt-3 text-sm text-[#b7c8dc]">
            {goal.goal_met ? "Daily recorded-time goal met." : "Continue at a pace that works for you."}
          </p>
          <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            {[
              ["Sessions with time records", goal.recorded_sessions],
              ["Sessions with unknown duration", goal.unknown_duration_sessions],
              ["Sessions with partial records", goal.partial_duration_sessions],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[#91a4bb]">{label}</dt>
                <dd className="mt-1 font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-6 text-[#91a4bb]">
            This measures recorded study time. Older work with unknown duration stays separate; a zero
            recorded total does not imply that no earlier work took place. Partial records may omit time.
          </p>
        </>
      ) : null}
    </section>
  );
}
