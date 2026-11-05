"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { progressKey, type RoadmapProgressItem, type RoadmapProgressUpdate } from "@/lib/roadmap-progress";

const CACHE_KEY = "brainhub:roadmap-progress:v1";
const PENDING_KEY = "brainhub:roadmap-progress-pending:v1";

type SyncState = "loading" | "synced" | "offline";

type PendingUpdate = {
  id: string;
  roadmapSlug: string;
  topicSlug: string;
  update: RoadmapProgressUpdate;
};

type ProgressContextValue = {
  items: RoadmapProgressItem[];
  progress: ReadonlyMap<string, RoadmapProgressItem>;
  ready: boolean;
  syncState: SyncState;
  recordProgress: (
    roadmapSlug: string,
    topicSlug: string,
    update: RoadmapProgressUpdate,
  ) => Promise<RoadmapProgressItem>;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProgressItem(value: unknown): value is RoadmapProgressItem {
  return (
    isRecord(value) &&
    typeof value.roadmap_slug === "string" &&
    typeof value.topic_slug === "string" &&
    ["in_progress", "completed", "review"].includes(String(value.status)) &&
    typeof value.quiz_score === "number" &&
    typeof value.quiz_attempts === "number" &&
    typeof value.time_spent_seconds === "number" &&
    typeof value.last_viewed_at === "string"
  );
}

function isPendingUpdate(value: unknown): value is PendingUpdate {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.roadmapSlug === "string" &&
    typeof value.topicSlug === "string" &&
    isRecord(value.update) &&
    ["in_progress", "completed", "review"].includes(String(value.update.status))
  );
}

function readList<T>(key: string, validate: (value: unknown) => value is T) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(validate) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, value: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The server remains authoritative when local storage is unavailable.
  }
}

function statusRank(status: RoadmapProgressItem["status"]) {
  return status === "review" ? 3 : status === "completed" ? 2 : 1;
}

function mergeSnapshots(existing: RoadmapProgressItem | undefined, incoming: RoadmapProgressItem) {
  if (!existing) return incoming;
  const preferredStatus =
    statusRank(incoming.status) >= statusRank(existing.status) ? incoming.status : existing.status;
  return {
    ...incoming,
    status: preferredStatus,
    quiz_score: Math.max(existing.quiz_score, incoming.quiz_score),
    quiz_attempts: Math.max(existing.quiz_attempts, incoming.quiz_attempts),
    time_spent_seconds: Math.max(existing.time_spent_seconds, incoming.time_spent_seconds),
    last_viewed_at:
      Date.parse(incoming.last_viewed_at) >= Date.parse(existing.last_viewed_at)
        ? incoming.last_viewed_at
        : existing.last_viewed_at,
    completed_at: existing.completed_at ?? incoming.completed_at,
  } satisfies RoadmapProgressItem;
}

function mergeItem(items: RoadmapProgressItem[], incoming: RoadmapProgressItem) {
  const key = progressKey(incoming.roadmap_slug, incoming.topic_slug);
  const existing = items.find((item) => progressKey(item.roadmap_slug, item.topic_slug) === key);
  return [
    ...items.filter((item) => progressKey(item.roadmap_slug, item.topic_slug) !== key),
    mergeSnapshots(existing, incoming),
  ];
}

export function RoadmapProgressProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<RoadmapProgressItem[]>([]);
  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const itemsRef = useRef<RoadmapProgressItem[]>([]);
  const pendingRef = useRef<PendingUpdate[]>([]);
  const flushingRef = useRef(false);

  const commitItems = useCallback((update: (current: RoadmapProgressItem[]) => RoadmapProgressItem[]) => {
    setItems((current) => {
      const next = update(current);
      itemsRef.current = next;
      return next;
    });
  }, []);

  const flushPending = useCallback(async () => {
    if (flushingRef.current || pendingRef.current.length === 0) return;
    flushingRef.current = true;
    try {
      for (const pending of [...pendingRef.current]) {
        const saved = await api.updateRoadmapProgress(pending.roadmapSlug, pending.topicSlug, pending.update);
        commitItems((current) => mergeItem(current, saved));
        pendingRef.current = pendingRef.current.filter((item) => item.id !== pending.id);
        writeList(PENDING_KEY, pendingRef.current);
      }
      setSyncState("synced");
    } catch {
      setSyncState("offline");
    } finally {
      flushingRef.current = false;
    }
  }, [commitItems]);

  useEffect(() => {
    const cached = readList(CACHE_KEY, isProgressItem);
    pendingRef.current = readList(PENDING_KEY, isPendingUpdate);
    if (cached.length) commitItems(() => cached);
    api
      .roadmapProgress()
      .then((response) => {
        commitItems((current) => response.items.reduce((merged, item) => mergeItem(merged, item), current));
        setSyncState("synced");
        return flushPending();
      })
      .catch(() => setSyncState("offline"))
      .finally(() => setReady(true));
  }, [commitItems, flushPending]);

  useEffect(() => {
    if (!ready) return;
    writeList(CACHE_KEY, items);
  }, [items, ready]);

  useEffect(() => {
    function syncFromOtherTab(event: StorageEvent) {
      if (event.key === CACHE_KEY) commitItems(() => readList(CACHE_KEY, isProgressItem));
    }
    function retryWhenOnline() {
      void flushPending();
    }
    window.addEventListener("storage", syncFromOtherTab);
    window.addEventListener("online", retryWhenOnline);
    return () => {
      window.removeEventListener("storage", syncFromOtherTab);
      window.removeEventListener("online", retryWhenOnline);
    };
  }, [commitItems, flushPending]);

  const recordProgress = useCallback(
    async (roadmapSlug: string, topicSlug: string, update: RoadmapProgressUpdate) => {
      const existing = itemsRef.current.find(
        (item) => item.roadmap_slug === roadmapSlug && item.topic_slug === topicSlug,
      );
      const now = new Date().toISOString();
      const optimistic: RoadmapProgressItem = {
        roadmap_slug: roadmapSlug,
        topic_slug: topicSlug,
        status:
          existing && statusRank(existing.status) > statusRank(update.status)
            ? existing.status
            : update.status,
        quiz_score: Math.max(existing?.quiz_score ?? 0, update.quiz_score ?? 0),
        quiz_attempts: (existing?.quiz_attempts ?? 0) + (update.quiz_score === undefined ? 0 : 1),
        time_spent_seconds: (existing?.time_spent_seconds ?? 0) + (update.time_spent_seconds ?? 0),
        last_viewed_at: now,
        completed_at:
          update.status === "completed" || update.status === "review"
            ? (existing?.completed_at ?? now)
            : (existing?.completed_at ?? null),
      };
      commitItems((current) => mergeItem(current, optimistic));
      try {
        const saved = await api.updateRoadmapProgress(roadmapSlug, topicSlug, update);
        commitItems((current) => mergeItem(current, saved));
        if (pendingRef.current.length) {
          // A successful write proves connectivity is back even when the browser
          // did not emit an `online` event. Drain older queued writes now so the
          // UI cannot remain stuck in its offline state indefinitely.
          await flushPending();
        } else {
          setSyncState("synced");
        }
        return mergeSnapshots(optimistic, saved);
      } catch {
        const pending: PendingUpdate = {
          id: `${Date.now()}:${crypto.randomUUID()}`,
          roadmapSlug,
          topicSlug,
          update,
        };
        pendingRef.current = [...pendingRef.current, pending];
        writeList(PENDING_KEY, pendingRef.current);
        setSyncState("offline");
        return optimistic;
      }
    },
    [commitItems, flushPending],
  );

  const progress = useMemo(
    () => new Map(items.map((item) => [progressKey(item.roadmap_slug, item.topic_slug), item])),
    [items],
  );
  const value = useMemo(
    () => ({ items, progress, ready, syncState, recordProgress }),
    [items, progress, ready, recordProgress, syncState],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useRoadmapProgress() {
  const context = useContext(ProgressContext);
  if (!context) throw new Error("useRoadmapProgress must be used inside RoadmapProgressProvider");
  return context;
}
