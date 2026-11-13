"use client";

import { useCallback, useEffect, useRef } from "react";
import { VisibleTimeRecorder } from "@/lib/recorded-time";

export function useRecordedTime(onCheckpoint: (persistOnly?: boolean) => void) {
  const recorder = useRef(new VisibleTimeRecorder());
  const checkpoint = useRef(onCheckpoint);
  useEffect(() => {
    checkpoint.current = onCheckpoint;
  }, [onCheckpoint]);
  useEffect(() => {
    const activeRecorder = recorder.current;
    const visibility = () => {
      activeRecorder.setVisible(document.visibilityState === "visible", performance.now());
      if (document.visibilityState !== "visible") checkpoint.current();
    };
    const leave = () => {
      activeRecorder.pause(performance.now());
      checkpoint.current();
    };
    const returnPage = () =>
      activeRecorder.setVisible(document.visibilityState === "visible", performance.now());
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", returnPage);
    const timer = window.setInterval(() => checkpoint.current(), 15_000);
    return () => {
      activeRecorder.pause(performance.now());
      checkpoint.current(true);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", returnPage);
      window.clearInterval(timer);
    };
  }, []);
  const snapshot = useCallback(() => recorder.current.snapshot(performance.now()), []);
  const restore = useCallback(
    (
      id: string,
      recordings: unknown[],
      serverNow: string | undefined,
      receivedAt: number,
      active: boolean,
      expiresAt: string,
    ) => {
      recorder.current.restore(
        id,
        recordings,
        serverNow,
        receivedAt,
        performance.now(),
        document.visibilityState === "visible",
        active,
        expiresAt,
      );
    },
    [],
  );
  const stop = useCallback(() => recorder.current.stop(performance.now()), []);
  const resume = useCallback(
    () => recorder.current.resume(performance.now(), document.visibilityState === "visible"),
    [],
  );
  const merge = useCallback((value: unknown) => recorder.current.merge(value), []);
  return { snapshot, restore, stop, resume, merge };
}
