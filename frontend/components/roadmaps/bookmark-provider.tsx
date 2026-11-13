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
import { bookmarkKey, type TopicBookmark } from "@/lib/bookmarks";

export type BookmarkIntent = {
  id: number;
  desired: boolean;
  baseRevision: number;
  state: "saving" | "error" | "conflict";
  message: string;
};
export type BookmarkContextValue = {
  ready: boolean;
  loading: boolean;
  error: string | null;
  items: TopicBookmark[];
  rows: ReadonlyMap<string, TopicBookmark>;
  pending: ReadonlyMap<string, BookmarkIntent>;
  refresh: () => Promise<void>;
  setBookmark: (roadmapSlug: string, topicSlug: string, desired: boolean) => Promise<void>;
  retryBookmark: (roadmapSlug: string, topicSlug: string) => Promise<void>;
  useServerState: (roadmapSlug: string, topicSlug: string) => void;
};
const BookmarkContext = createContext<BookmarkContextValue | null>(null);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
function validRow(value: unknown): value is TopicBookmark {
  if (!record(value)) return false;
  return (
    typeof value.roadmap_slug === "string" &&
    value.roadmap_slug.length <= 80 &&
    /^[a-z0-9][a-z0-9-]*$/.test(value.roadmap_slug) &&
    typeof value.topic_slug === "string" &&
    value.topic_slug.length <= 160 &&
    /^[a-z0-9][a-z0-9-]*$/.test(value.topic_slug) &&
    typeof value.bookmarked === "boolean" &&
    Number.isSafeInteger(value.revision) &&
    Number(value.revision) >= 1 &&
    Number(value.revision) <= 2_147_483_647 &&
    (value.updated_at === null ||
      (typeof value.updated_at === "string" && Number.isFinite(Date.parse(value.updated_at)))) &&
    typeof value.available === "boolean" &&
    (value.available
      ? value.study_url ===
        `/roadmaps/${encodeURIComponent(value.roadmap_slug)}/${encodeURIComponent(value.topic_slug)}`
      : value.study_url === null)
  );
}
function validatedRows(value: unknown): TopicBookmark[] {
  if (!record(value) || !Array.isArray(value.items) || !value.items.every(validRow))
    throw new Error("The saved topics response is invalid. Confirmed bookmarks have been kept.");
  const keys = value.items.map((row) => bookmarkKey(row.roadmap_slug, row.topic_slug));
  if (new Set(keys).size !== keys.length)
    throw new Error("The saved topics response contains duplicate entries. Please retry.");
  return value.items;
}
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "The request could not be completed. Please retry.";
const errorStatus = (error: unknown) =>
  record(error) && typeof error.status === "number" ? error.status : null;

export function BookmarkProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<Map<string, TopicBookmark>>(() => new Map());
  const [pending, setPending] = useState<Map<string, BookmarkIntent>>(() => new Map());
  const [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const rowsRef = useRef(rows),
    pendingRef = useRef(pending),
    readyRef = useRef(false),
    mounted = useRef(true);
  const getGeneration = useRef(0),
    intentSequence = useRef(0),
    mutationClock = useRef(0),
    lastMutation = useRef(new Map<string, number>());
  const publishPending = useCallback((next: Map<string, BookmarkIntent>) => {
    pendingRef.current = next;
    if (mounted.current) setPending(next);
  }, []);
  const mergeRows = useCallback((incoming: TopicBookmark[], requestClock?: number) => {
    const next = new Map(rowsRef.current);
    for (const row of incoming) {
      const key = bookmarkKey(row.roadmap_slug, row.topic_slug),
        previous = next.get(key);
      if (previous && row.revision < previous.revision) continue;
      if (previous && row.revision === previous.revision) {
        // A revision cannot name two different saved states. Equal stale GET metadata cannot undo a PUT.
        if (
          row.bookmarked !== previous.bookmarked ||
          (requestClock !== undefined && (lastMutation.current.get(key) ?? 0) > requestClock)
        )
          continue;
      }
      next.set(key, row);
    }
    rowsRef.current = next;
    if (mounted.current) setRows(next);
    return next;
  }, []);
  const loadRows = useCallback(() => {
    const generation = ++getGeneration.current,
      startedAtMutation = mutationClock.current;
    return api
      .topicBookmarks()
      .then((payload) => {
        const response = validatedRows(payload);
        if (!mounted.current || generation !== getGeneration.current) return;
        const confirmed = mergeRows(response, startedAtMutation);
        setError(null);
        readyRef.current = true;
        setReady(true);
        // An authoritative GET can recover a lost acknowledgement, without guessing that a failed PUT saved.
        const nextPending = new Map(pendingRef.current);
        for (const [key, intent] of nextPending) {
          const row = confirmed.get(key);
          if (row && row.revision > intent.baseRevision && row.bookmarked === intent.desired)
            nextPending.delete(key);
        }
        publishPending(nextPending);
      })
      .catch((failure: unknown) => {
        if (mounted.current && generation === getGeneration.current) setError(errorMessage(failure));
      })
      .finally(() => {
        if (mounted.current && generation === getGeneration.current) setLoading(false);
      });
  }, [mergeRows, publishPending]);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await loadRows();
  }, [loadRows]);
  useEffect(() => {
    mounted.current = true;
    void loadRows();
    return () => {
      mounted.current = false;
      getGeneration.current += 1;
    };
  }, [loadRows]);
  const mutate = useCallback(
    async (roadmapSlug: string, topicSlug: string, desired: boolean, baseRevision: number) => {
      const key = bookmarkKey(roadmapSlug, topicSlug),
        id = ++intentSequence.current;
      const intent: BookmarkIntent = {
        id,
        desired,
        baseRevision,
        state: "saving",
        message: "Waiting for the server to confirm your change.",
      };
      const next = new Map(pendingRef.current);
      next.set(key, intent);
      publishPending(next);
      try {
        const row = await api.saveTopicBookmark(roadmapSlug, topicSlug, {
          bookmarked: desired,
          revision: baseRevision,
        });
        if (!validRow(row) || bookmarkKey(row.roadmap_slug, row.topic_slug) !== key)
          throw new Error(
            "The bookmark acknowledgement is invalid. Your intended change is still available to retry.",
          );
        if (!mounted.current) return;
        mutationClock.current += 1;
        lastMutation.current.set(key, mutationClock.current);
        const confirmed = mergeRows([row]);
        if (pendingRef.current.get(key)?.id !== id) return;
        const after = new Map(pendingRef.current);
        if (confirmed.get(key)?.bookmarked === desired) after.delete(key);
        else
          after.set(key, {
            ...intent,
            state: "conflict",
            message: "A newer server state has already been observed. Review it before retrying your change.",
          });
        publishPending(after);
      } catch (failure) {
        if (!mounted.current || pendingRef.current.get(key)?.id !== id) return;
        const conflict = errorStatus(failure) === 409;
        const after = new Map(pendingRef.current);
        after.set(key, {
          ...intent,
          state: conflict ? "conflict" : "error",
          message: conflict
            ? "The saved state changed elsewhere. Your intended change has been kept; review the server state before retrying."
            : errorMessage(failure),
        });
        publishPending(after);
        if (conflict) await refresh();
      }
    },
    [mergeRows, publishPending, refresh],
  );
  const setBookmark = useCallback(
    async (roadmapSlug: string, topicSlug: string, desired: boolean) => {
      const key = bookmarkKey(roadmapSlug, topicSlug);
      if (!readyRef.current || pendingRef.current.has(key)) return;
      const current = rowsRef.current.get(key);
      if ((current?.bookmarked ?? false) === desired) return;
      await mutate(roadmapSlug, topicSlug, desired, current?.revision ?? 0);
    },
    [mutate],
  );
  const retryBookmark = useCallback(
    async (roadmapSlug: string, topicSlug: string) => {
      const key = bookmarkKey(roadmapSlug, topicSlug),
        intent = pendingRef.current.get(key);
      if (!readyRef.current || !intent || intent.state === "saving") return;
      await mutate(roadmapSlug, topicSlug, intent.desired, rowsRef.current.get(key)?.revision ?? 0);
    },
    [mutate],
  );
  const useServerState = useCallback(
    (roadmapSlug: string, topicSlug: string) => {
      const key = bookmarkKey(roadmapSlug, topicSlug);
      if (pendingRef.current.get(key)?.state === "saving") return;
      const next = new Map(pendingRef.current);
      next.delete(key);
      publishPending(next);
    },
    [publishPending],
  );
  const value = useMemo<BookmarkContextValue>(
    () => ({
      ready,
      loading,
      error,
      items: [...rows.values()],
      rows,
      pending,
      refresh,
      setBookmark,
      retryBookmark,
      useServerState,
    }),
    [ready, loading, error, rows, pending, refresh, setBookmark, retryBookmark, useServerState],
  );
  return <BookmarkContext.Provider value={value}>{children}</BookmarkContext.Provider>;
}

/** Optional so standalone lesson previews never fetch or throw without the shared provider. */
export function useBookmarks(): BookmarkContextValue | null {
  return useContext(BookmarkContext);
}
