export type TimeRecording = {
  version: 1;
  intervals: Array<{ start_at: string; end_at: string }>;
  truncated?: boolean;
};
const MAX_INTERVALS = 256;
const ZULU = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

function utc(value: unknown): number | null {
  if (typeof value !== "string" || !ZULU.test(value) || value.startsWith("0000-")) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 19) === value.slice(0, 19)
    ? parsed
    : null;
}

export function normalizeRecording(value: unknown): TimeRecording | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== 1 ||
    !Array.isArray(candidate.intervals) ||
    candidate.intervals.length > 4096 ||
    (candidate.truncated !== undefined && typeof candidate.truncated !== "boolean")
  )
    return null;
  const intervals: Array<[number, number]> = [];
  for (const interval of candidate.intervals) {
    if (!interval || typeof interval !== "object" || Array.isArray(interval)) return null;
    const entry = interval as Record<string, unknown>;
    const start = utc(entry.start_at),
      end = utc(entry.end_at);
    if (start === null || end === null || end < start) return null;
    if (end > start) intervals.push([start, end]);
  }
  return union(intervals, candidate.truncated === true);
}

function union(intervals: Array<[number, number]>, truncated: boolean): TimeRecording {
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let merged: Array<[number, number]> = [];
  for (const [start, end] of intervals) {
    const previous = merged.at(-1);
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else merged.push([start, end]);
  }
  if (merged.length > MAX_INTERVALS) {
    truncated = true;
    merged = merged
      .sort((a, b) => b[1] - b[0] - (a[1] - a[0]) || a[0] - b[0])
      .slice(0, MAX_INTERVALS)
      .sort((a, b) => a[0] - b[0]);
  }
  return {
    version: 1,
    intervals: merged.map(([start, end]) => ({
      start_at: new Date(start).toISOString(),
      end_at: new Date(end).toISOString(),
    })),
    truncated,
  };
}

export function mergeRecordings(...values: unknown[]): TimeRecording | null {
  const known = values.map(normalizeRecording).filter((value): value is TimeRecording => value !== null);
  if (!known.length) return null;
  return union(
    known.flatMap((value) =>
      value.intervals.map((interval): [number, number] => [
        Date.parse(interval.start_at),
        Date.parse(interval.end_at),
      ]),
    ),
    known.some((value) => value.truncated === true),
  );
}

export function recordedSeconds(value: TimeRecording | null) {
  return value === null
    ? null
    : Math.floor(
        value.intervals.reduce(
          (sum, interval) => sum + Date.parse(interval.end_at) - Date.parse(interval.start_at),
          0,
        ) / 1000,
      );
}

/** A server-anchored timeline. Wall-clock epochs are never used to accrue time. */
export class VisibleTimeRecorder {
  private id: string | null = null;
  private saved: TimeRecording | null = null;
  private anchor: { utc: number; mono: number } | null = null;
  private open: number | null = null;
  private enabled = false;
  private expires = Infinity;

  restore(
    id: string,
    recordings: unknown[],
    serverNow: string | undefined,
    receivedAt: number,
    now: number,
    visible: boolean,
    active: boolean,
    expiresAt: string,
  ) {
    const existing = this.id === id ? this.snapshot(now) : null;
    this.id = id;
    this.saved = mergeRecordings(existing, ...recordings);
    this.open = null;
    const epoch = utc(serverNow);
    this.anchor = epoch === null ? null : { utc: epoch, mono: receivedAt };
    this.expires = utc(expiresAt) ?? Infinity;
    this.enabled = Boolean(active && this.anchor);
    if (this.enabled) {
      this.saved ??= { version: 1, intervals: [], truncated: false };
      if (visible) this.open = now;
    }
  }

  merge(value: unknown) {
    this.saved = mergeRecordings(this.saved, value);
  }

  setVisible(visible: boolean, now: number) {
    if (!visible) this.pause(now);
    else if (this.enabled && this.anchor && this.open === null) this.open = now;
  }

  snapshot(now: number): TimeRecording | null {
    if (this.open === null || !this.anchor) return mergeRecordings(this.saved);
    const start = Math.min(this.expires, this.anchor.utc + Math.max(0, this.open - this.anchor.mono));
    const end = Math.min(this.expires, this.anchor.utc + Math.max(0, now - this.anchor.mono));
    return mergeRecordings(this.saved, {
      version: 1,
      intervals:
        end > start ? [{ start_at: new Date(start).toISOString(), end_at: new Date(end).toISOString() }] : [],
    });
  }

  pause(now: number) {
    this.saved = this.snapshot(now);
    this.open = null;
  }
  stop(now: number) {
    this.pause(now);
    this.enabled = false;
  }
  resume(now: number, visible: boolean) {
    if (this.anchor) {
      this.enabled = true;
      if (visible) this.open = now;
    }
  }
}
