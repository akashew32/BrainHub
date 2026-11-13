import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mergeRecordings,
  normalizeRecording,
  recordedSeconds,
  VisibleTimeRecorder,
} from "@/lib/recorded-time";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import type { AssessmentSession } from "@/lib/curriculum";

const epoch = "2026-11-12T12:00:00.000Z";
const deadline = "2026-11-12T14:00:00.000Z";
function clock() {
  const value = new VisibleTimeRecorder();
  value.restore("session", [], epoch, 0, 0, true, true, deadline);
  return value;
}
function interval(start: string, end: string) {
  return { version: 1, intervals: [{ start_at: start, end_at: end }] };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("visible server-anchored time recording", () => {
  it("accrues only monotonic elapsed time despite wall-clock jumps", () => {
    const value = clock();
    vi.spyOn(Date, "now").mockReturnValue(0);
    expect(recordedSeconds(value.snapshot(3000))).toBe(3);
    vi.mocked(Date.now).mockReturnValue(9_999_999_999_999);
    expect(recordedSeconds(value.snapshot(4000))).toBe(4);
    expect(value.snapshot(4000)!.intervals[0]!.end_at).toBe("2026-11-12T12:00:04.000Z");
  });
  it("excludes hidden gaps and starts a fresh visible segment", () => {
    const value = clock();
    value.setVisible(false, 1000);
    value.setVisible(true, 11_000);
    expect(recordedSeconds(value.snapshot(13_000))).toBe(3);
    expect(value.snapshot(13_000)!.intervals).toHaveLength(2);
  });
  it("does not restart a cached timeline offline or invent a reload gap", () => {
    const original = clock().snapshot(2000);
    const value = new VisibleTimeRecorder();
    value.restore("session", [original], undefined, 0, 0, true, false, deadline);
    expect(recordedSeconds(value.snapshot(60_000))).toBe(2);
    value.restore("session", [original], "2026-11-12T12:01:00.000Z", 60_000, 60_000, true, true, deadline);
    expect(recordedSeconds(value.snapshot(61_000))).toBe(3);
  });
  it("keeps unknown cached time unknown until a fresh owned server anchor", () => {
    const value = new VisibleTimeRecorder();
    value.restore("session", [{ version: 1, intervals: "bad data" }], undefined, 0, 0, true, false, deadline);
    expect(value.snapshot(60_000)).toBeNull();
    value.restore("session", [], epoch, 60_000, 60_000, true, true, deadline);
    expect(recordedSeconds(value.snapshot(61_000))).toBe(1);
  });
  it("unions overlapping intervals across UTC midnight without double counting", () => {
    const value = mergeRecordings(
      interval("2026-11-12T23:59:55Z", "2026-11-13T00:00:05Z"),
      interval("2026-11-12T23:59:58Z", "2026-11-13T00:00:10Z"),
    );
    expect(recordedSeconds(value)).toBe(15);
    expect(value!.intervals).toHaveLength(1);
  });
  it("retains the longest 256 disjoint segments and marks honest truncation", () => {
    const start = Date.parse(epoch);
    const intervals = Array.from({ length: 257 }, (_, index) => ({
      start_at: new Date(start + index * 10_000).toISOString(),
      end_at: new Date(start + index * 10_000 + index + 1).toISOString(),
    }));
    const value = normalizeRecording({ version: 1, intervals });
    expect(value!.intervals).toHaveLength(256);
    expect(value!.truncated).toBe(true);
    expect(value!.intervals[0]!.start_at).toBe(new Date(start + 10_000).toISOString());
    expect(value!.intervals.at(-1)).toEqual(intervals.at(-1));
  });
  it.each([
    { version: 2, intervals: [] },
    interval("2026-11-12T12:00:00+00:00", "2026-11-12T12:00:01Z"),
    interval("2026-11-12T12:00:02Z", "2026-11-12T12:00:01Z"),
    interval("2026-02-30T12:00:00Z", "2026-03-01T12:00:01Z"),
  ])("rejects malformed recording metadata without guessing elapsed time", (value) => {
    expect(normalizeRecording(value)).toBeNull();
  });
  it("clips a visible segment at the deadline", () => {
    const value = new VisibleTimeRecorder();
    value.restore("session", [], epoch, 0, 0, true, true, "2026-11-12T12:00:01Z");
    expect(recordedSeconds(value.snapshot(10_000))).toBe(1);
  });
  it("never carries intervals to a different selected session", () => {
    const value = clock();
    value.restore("other", [], "2026-11-12T12:01:00Z", 60_000, 60_000, true, true, deadline);
    expect(recordedSeconds(value.snapshot(61_000))).toBe(1);
  });
  it("excludes submission wait time when a failed request resumes", () => {
    const value = clock();
    value.stop(2000);
    expect(recordedSeconds(value.snapshot(20_000))).toBe(2);
    value.resume(20_000, true);
    expect(recordedSeconds(value.snapshot(21_000))).toBe(3);
  });
  it("does not add repeated open-segment snapshots twice", () => {
    const value = clock();
    value.merge(value.snapshot(2000));
    value.pause(3000);
    expect(recordedSeconds(value.snapshot(10_000))).toBe(3);
  });
});

const topic = "vector-arithmetic-and-linear-combinations";
const key = `brainhub:assessment:v2:linear-algebra:practice:${topic}`;
const assessment: AssessmentSession = {
  id: "visible-time-session",
  mode: "practice",
  roadmap_slug: "linear-algebra",
  topic_slug: topic,
  state: "active",
  expires_at: deadline,
  server_now: epoch,
  expires_in_seconds: 7200,
  hint_usage: {},
  pass_score: 75,
  draft: { answers: [], revision: 0, time_spent_seconds: 0, time_recording: null },
  questions: [
    {
      id: "fraction",
      kind: "number",
      prompt: "Solve $2x=1$.",
      hints: [],
      hint_count: 2,
      concept: "Fractions",
      difficulty: "foundation",
      topic_slug: topic,
      lesson_title: "Vectors",
    },
  ],
};
function response(value: unknown) {
  return { ok: true, status: 200, json: async () => value };
}
function mount() {
  return render(
    <RoadmapProgressProvider>
      <AssessmentPanel roadmapSlug="linear-algebra" topicSlug={topic} />
    </RoadmapProgressProvider>,
  );
}
describe("recording checkpoints preserve current raw answers", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({
      toFake: ["Date", "performance", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    vi.setSystemTime(new Date(epoch));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 2,
        sessionId: assessment.id,
        roadmapSlug: "linear-algebra",
        topicSlug: topic,
        stageIndex: 0,
        mode: "practice",
        answers: { fraction: "1/2" },
        revision: 1,
        startedAt: Date.now(),
        session: assessment,
      }),
    );
  });
  function mock() {
    const request = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/roadmaps/progress")) return response({ items: [], summary: {} });
      if (url.endsWith("/assessments/" + assessment.id)) return response(assessment);
      if (url.endsWith("/draft")) return response({ ...assessment, draft: JSON.parse(String(init?.body)) });
      if (url.endsWith("/submit"))
        return response({
          session_id: assessment.id,
          mode: "practice",
          score: 100,
          passed: true,
          correct: 1,
          total: 1,
          progress: null,
          feedback: [
            {
              question_id: "fraction",
              prompt: "Solve $2x=1$.",
              concept: "Fractions",
              correct: true,
              submitted_answer: "1/2",
              expected_answer: 0.5,
              solution: "Divide by two.",
              topic_slug: topic,
            },
          ],
        });
      throw new Error("Unexpected recorded-time request: " + url);
    });
    vi.stubGlobal("fetch", request);
    return request;
  }
  it("backs up a periodic time snapshot with the latest answer and revision", async () => {
    const request = mock();
    await act(async () => {
      mount();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Answer to question 1" }), {
      target: { value: " 7 / 11 " },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    const saves = request.mock.calls.filter(([url]) => String(url).endsWith("/draft"));
    const body = JSON.parse(String(saves.at(-1)![1]?.body));
    expect(body.answers).toEqual([{ question_id: "fraction", answer: " 7 / 11 " }]);
    expect(recordedSeconds(body.time_recording)).toBe(15);
    expect(JSON.parse(localStorage.getItem(key)!).answers.fraction).toBe(" 7 / 11 ");
  });
  it("pauses while hidden and submits only visible monotonic intervals", async () => {
    const request = mock();
    await act(async () => {
      mount();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    vi.mocked(Object.getOwnPropertyDescriptor(document, "visibilityState")!.get!).mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    vi.mocked(Object.getOwnPropertyDescriptor(document, "visibilityState")!.get!).mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    vi.setSystemTime(new Date("2099-01-01T00:00:00Z"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    });
    const submit = request.mock.calls.find(([url]) => String(url).endsWith("/submit"))!;
    expect(recordedSeconds(JSON.parse(String(submit[1]?.body)).time_recording)).toBe(3);
  });

  it("resumes a back-forward cached page without crediting the frozen pagehide gap", async () => {
    const request = mock();
    await act(async () => {
      mount();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    fireEvent(window, new Event("pagehide"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    fireEvent(window, new Event("pageshow"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit practice" }));
    });
    const submit = request.mock.calls.find(([url]) => String(url).endsWith("/submit"))!;
    expect(recordedSeconds(JSON.parse(String(submit[1]?.body)).time_recording)).toBe(3);
  });

  it("persists the closing interval and latest raw answer when unmounting", async () => {
    mock();
    let view!: ReturnType<typeof mount>;
    await act(async () => {
      view = mount();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Answer to question 1" }), {
      target: { value: " 11 / 17 " },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    view.unmount();
    const saved = JSON.parse(localStorage.getItem(key)!);
    expect(recordedSeconds(saved.time_recording)).toBe(3);
    expect(saved.answers.fraction).toBe(" 11 / 17 ");
  });
});
