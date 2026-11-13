"use client";

import { useId } from "react";
import { bookmarkKey } from "@/lib/bookmarks";
import { useBookmarks } from "@/components/roadmaps/bookmark-provider";

export function BookmarkButton({
  roadmapSlug,
  topicSlug,
  title,
}: {
  roadmapSlug: string;
  topicSlug: string;
  title?: string;
}) {
  const bookmarks = useBookmarks(),
    id = useId(),
    label = title ?? topicSlug;
  const key = bookmarkKey(roadmapSlug, topicSlug),
    row = bookmarks?.rows.get(key),
    intent = bookmarks?.pending.get(key);
  const saved = row?.bookmarked ?? false,
    known = bookmarks?.ready ?? false,
    saving = intent?.state === "saving",
    retired = row?.available === false && !saved;
  const ariaLabel = saving
    ? `Saving bookmark: ${label}`
    : retired
      ? `Retired topic: ${label}`
      : saved
        ? `Remove bookmark: ${label}`
        : `Save bookmark: ${label}`;
  return (
    <div className="min-w-0">
      <button
        type="button"
        className="btn min-h-11 text-sm disabled:opacity-50"
        aria-label={ariaLabel}
        aria-pressed={known ? saved : undefined}
        disabled={!known || Boolean(intent) || retired}
        aria-describedby={intent ? `${id}-state` : undefined}
        title={
          retired
            ? "This retired topic cannot be bookmarked again."
            : !bookmarks
              ? "Bookmarks are unavailable in this view."
              : !known
                ? "Load saved topics before changing a bookmark."
                : undefined
        }
        onClick={() => {
          void bookmarks?.setBookmark(roadmapSlug, topicSlug, !saved);
        }}
      >
        {saving
          ? "Saving…"
          : !known
            ? "Bookmarks unavailable"
            : retired
              ? "Retired topic"
              : saved
                ? "Bookmarked"
                : "Save topic"}
      </button>
      {intent ? (
        <div
          id={`${id}-state`}
          className="mt-3 rounded-lg border border-[#554d3c] bg-[#221f1b] p-3 text-xs leading-7 text-[#dcccb4]"
          role="status"
          aria-live="polite"
        >
          <p>{intent.message}</p>
          <p className="mt-1">
            Your choice: {intent.desired ? "save this topic" : "remove this bookmark"}. Last confirmed state:{" "}
            {saved ? "bookmarked" : "not bookmarked"}.
          </p>
          {intent.state !== "saving" ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn min-h-11 text-xs"
                aria-label={`Retry my change: ${label}`}
                onClick={() => {
                  void bookmarks?.retryBookmark(roadmapSlug, topicSlug);
                }}
              >
                Retry my change
              </button>
              <button
                type="button"
                className="btn min-h-11 text-xs"
                aria-label={`Use current server state: ${label}`}
                onClick={() => bookmarks?.useServerState(roadmapSlug, topicSlug)}
              >
                Use current server state
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
