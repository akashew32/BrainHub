"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { learningRoadmaps } from "@/lib/roadmaps";
import {
  DEFAULT_TOPIC_FILTERS,
  buildRoadmapSearchIndex,
  curriculumAuthoredKeys,
  filterRoadmapTopics,
  parseTopicFilters,
  serializeTopicFilters,
  topicAvailability,
  type TopicAvailability,
  type TopicFilters,
  type TopicSearchItem,
} from "@/lib/roadmap-search";
import { BookmarkButton } from "@/components/roadmaps/bookmark-button";
import { useBookmarks } from "@/components/roadmaps/bookmark-provider";

const TOPICS = buildRoadmapSearchIndex();
const TOPIC_KEYS = new Set(TOPICS.map((topic) => topic.key));
const PAGE_SIZE = 30;
const URL_CHANGE_EVENT = "brainhub:topic-library-url-change";
const currentURLSnapshot = () =>
  typeof window === "undefined"
    ? ""
    : serializeTopicFilters(parseTopicFilters(new URLSearchParams(window.location.search)));
const AVAILABILITY_LABELS: Record<TopicAvailability, string> = {
  authored: "Authored lesson",
  outline: "Curriculum outline",
  unknown: "Availability unknown",
};

function TopicCard({ topic, availability }: { topic: TopicSearchItem; availability: TopicAvailability }) {
  return (
    <article aria-label={`${topic.topicTitle} — ${topic.roadmapTitle}`} className="panel min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span style={{ color: topic.accent }} className="font-semibold">
          {topic.roadmapTitle}
        </span>
        <span className="rounded-md border border-[#344b64] px-2 py-1 text-[#b6cbe0]">
          {AVAILABILITY_LABELS[availability]}
        </span>
      </div>
      <h2 className="mt-4 text-xl font-semibold leading-8">
        <Link
          prefetch={false}
          href={topic.href}
          className="underline decoration-[#3d536b] underline-offset-4 hover:text-[#b8e3ef]"
        >
          {topic.topicTitle}
        </Link>
      </h2>
      <p className="mt-2 text-xs leading-7 text-[#93abc5]">
        Stage {topic.stageIndex + 1} · {topic.level} · {topic.stageTitle}
      </p>
      <p className="mt-3 text-sm leading-7 text-[#a9bfd7]">{topic.stageDescription}</p>
      <details className="mt-3 text-xs leading-7 text-[#a3bad3]">
        <summary className="min-h-11 cursor-pointer py-2 text-[#bfd3e7]">Stage checkpoint</summary>
        <p className="mt-2">{topic.stageCheckpoint}</p>
      </details>
      {availability === "outline" ? (
        <p className="mt-3 text-xs leading-7 text-[#b9b1a1]">
          This topic has a curriculum outline. An authored lesson and practice set are not available yet.
        </p>
      ) : availability === "unknown" ? (
        <p className="mt-3 text-xs leading-7 text-[#b9b1a1]">
          Open the curriculum topic for details. Lesson availability has not been confirmed.
        </p>
      ) : (
        <p className="mt-3 text-xs leading-7 text-[#a7c9bc]">
          Read the authored lesson, worked examples and its practice instructions.
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-start gap-3">
        <Link prefetch={false} href={topic.href} className="btn inline-flex min-h-11 items-center text-sm">
          {availability === "authored"
            ? "Open authored lesson"
            : availability === "outline"
              ? "Study outline"
              : "View curriculum topic"}
          <span className="sr-only">
            : {topic.topicTitle} — {topic.roadmapTitle}
          </span>
        </Link>
        <BookmarkButton
          roadmapSlug={topic.roadmapSlug}
          topicSlug={topic.topicSlug}
          title={`${topic.topicTitle} — ${topic.roadmapTitle}`}
        />
      </div>
    </article>
  );
}

export function TopicLibrary({ initialFilters = DEFAULT_TOPIC_FILTERS }: { initialFilters?: TopicFilters }) {
  const incoming = parseTopicFilters(initialFilters),
    incomingSignature = serializeTopicFilters(incoming);
  const [page, setPage] = useState({ signature: incomingSignature, count: PAGE_SIZE });
  const subscribeURL = useCallback((onChange: () => void) => {
    const restore = () => {
      setPage({ signature: currentURLSnapshot(), count: PAGE_SIZE });
      onChange();
    };
    window.addEventListener("popstate", restore);
    window.addEventListener("pageshow", restore);
    window.addEventListener(URL_CHANGE_EVENT, restore);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener(URL_CHANGE_EVENT, restore);
    };
  }, []);
  // Preserve server HTML for hydration, then read the actual URL even if Back happened before mounting.
  const urlSnapshot = useSyncExternalStore(subscribeURL, currentURLSnapshot, () => incomingSignature);
  const filters = useMemo(() => parseTopicFilters(new URLSearchParams(urlSnapshot)), [urlSnapshot]);
  const visibleCount = page.signature === urlSnapshot ? page.count : PAGE_SIZE;
  const [authoredKeys, setAuthoredKeys] = useState<Set<string> | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(true),
    [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const generation = useRef(0),
    active = useRef(true),
    uid = useId();
  const bookmarks = useBookmarks();
  const loadAvailability = useCallback(() => {
    const request = ++generation.current;
    return api
      .curriculumIndex()
      .then((response) => {
        const keys = curriculumAuthoredKeys(response, TOPICS);
        if (!active.current || request !== generation.current) return;
        setAuthoredKeys(keys);
        setAvailabilityError(null);
      })
      .catch((failure: unknown) => {
        if (!active.current || request !== generation.current) return;
        setAuthoredKeys(null);
        setAvailabilityError(
          failure instanceof Error ? failure.message : "Lesson availability could not be loaded.",
        );
      })
      .finally(() => {
        if (active.current && request === generation.current) setAvailabilityLoading(false);
      });
  }, []);
  useEffect(() => {
    active.current = true;
    void loadAvailability();
    return () => {
      active.current = false;
      generation.current += 1;
    };
  }, [loadAvailability]);
  const savedKeys = useMemo(
    () =>
      new Set(
        bookmarks?.items
          .filter((row) => row.bookmarked)
          .map((row) => `${row.roadmap_slug}:${row.topic_slug}`) ?? [],
      ),
    [bookmarks?.items],
  );
  const retiredKeys = useMemo(
    () =>
      new Set(
        bookmarks?.items
          .filter((row) => !row.available)
          .map((row) => `${row.roadmap_slug}:${row.topic_slug}`) ?? [],
      ),
    [bookmarks?.items],
  );
  const retired =
    bookmarks?.items.filter(
      (row) => row.bookmarked && (!row.available || !TOPIC_KEYS.has(`${row.roadmap_slug}:${row.topic_slug}`)),
    ) ?? [];
  const matches = useMemo(
    () =>
      filterRoadmapTopics(TOPICS, filters, { authoredKeys, bookmarkedKeys: savedKeys }).filter(
        (topic) => !retiredKeys.has(topic.key),
      ),
    [filters, authoredKeys, savedKeys, retiredKeys],
  );
  const shown = matches.slice(0, visibleCount),
    waitingForSaved = filters.saved === "bookmarked" && !bookmarks?.ready,
    waitingForAvailability =
      authoredKeys === null && (filters.availability === "authored" || filters.availability === "outline");
  function changeFilter<K extends keyof TopicFilters>(key: K, value: TopicFilters[K]) {
    const next = parseTopicFilters({ ...filters, [key]: value }),
      signature = serializeTopicFilters(next);
    setPage({ signature, count: PAGE_SIZE });
    const url = `${window.location.pathname}${signature ? `?${signature}` : ""}${window.location.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) {
      if (key === "q") window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
      window.dispatchEvent(new Event(URL_CHANGE_EVENT));
    }
  }
  function clearFilters() {
    setPage({ signature: "", count: PAGE_SIZE });
    window.history.pushState(null, "", `${window.location.pathname}${window.location.hash}`);
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
  }
  const controlClass =
    "mt-2 block min-h-11 w-full rounded-lg border border-[#3b526d] bg-[#091421] px-3 py-2 text-base text-white outline-offset-4 focus:outline-2 focus:outline-[#8ccfff]";
  return (
    <div className="space-y-6">
      <section className="panel p-5 sm:p-8" aria-labelledby={`${uid}-filters`}>
        <h2 id={`${uid}-filters`} className="text-2xl font-semibold">
          Find your next topic
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#a7bdd5]">
          Search all {TOPICS.length} roadmap topics by topic name, subject, stage description or checkpoint.
          Saved topics are personal bookmarks, separate from lesson completion.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Topics indexed", String(TOPICS.length)],
            ["Authored lessons", authoredKeys === null ? "Unknown" : String(authoredKeys.size)],
            [
              "Curriculum outlines",
              authoredKeys === null ? "Unknown" : String(TOPICS.length - authoredKeys.size),
            ],
            ["Saved topics", bookmarks?.ready ? String(savedKeys.size) : "Unknown"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-[#0b1727] p-3">
              <p className="text-xs leading-6 text-[#9cb2cc]">{label}</p>
              <p className="mt-1 text-xl font-semibold text-[#d5e4f5]">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="sm:col-span-2 lg:col-span-3 text-sm text-[#c7d8ec]">
            Search topics
            <input
              type="search"
              aria-label="Search topics"
              value={filters.q}
              maxLength={200}
              autoComplete="off"
              onChange={(event) => changeFilter("q", event.target.value)}
              placeholder="Try conditional probability, kernels, continuity…"
              className={controlClass}
            />
          </label>
          <label className="text-sm text-[#c7d8ec]">
            Subject
            <select
              aria-label="Subject"
              value={filters.subject}
              onChange={(event) => changeFilter("subject", event.target.value)}
              className={controlClass}
            >
              <option value="all">All subjects</option>
              {learningRoadmaps.map((roadmap) => (
                <option key={roadmap.slug} value={roadmap.slug}>
                  {roadmap.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#c7d8ec]">
            Stage
            <select
              aria-label="Stage"
              value={filters.stage}
              onChange={(event) => changeFilter("stage", event.target.value)}
              className={controlClass}
            >
              <option value="all">All stages</option>
              {Array.from({ length: 10 }, (_, index) => (
                <option key={index} value={String(index + 1)}>
                  Stage {index + 1}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#c7d8ec]">
            Level
            <select
              aria-label="Level"
              value={filters.level}
              onChange={(event) => changeFilter("level", event.target.value)}
              className={controlClass}
            >
              <option value="all">All levels</option>
              {["Foundation", "Core", "Advanced", "Graduate"].map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#c7d8ec]">
            Availability
            <select
              aria-label="Availability"
              value={filters.availability}
              onChange={(event) =>
                changeFilter("availability", event.target.value as TopicFilters["availability"])
              }
              className={controlClass}
            >
              <option value="all">All availability</option>
              <option value="authored">Authored lessons</option>
              <option value="outline">Curriculum outlines</option>
              <option value="unknown">Availability unknown</option>
            </select>
          </label>
          <label className="text-sm text-[#c7d8ec]">
            Saved topics
            <select
              aria-label="Saved topics"
              value={filters.saved}
              onChange={(event) => changeFilter("saved", event.target.value as TopicFilters["saved"])}
              className={controlClass}
            >
              <option value="all">All topics</option>
              <option value="bookmarked">Bookmarked topics</option>
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" className="btn min-h-11" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-start gap-4 text-xs leading-7">
          <div className="min-w-0 flex-1">
            <p role="status" className="text-[#a7bfd8]">
              {availabilityLoading
                ? "Checking authored lesson availability…"
                : authoredKeys === null
                  ? "Lesson availability is unknown. Public topics and saved entries remain searchable."
                  : `${authoredKeys.size} authored lessons and ${TOPICS.length - authoredKeys.size} curriculum outlines confirmed.`}
            </p>
            {availabilityError ? (
              <p role="alert" className="mt-1 text-[#e3bd9e]">
                {availabilityError}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="btn min-h-11 text-xs"
            disabled={availabilityLoading}
            onClick={() => {
              setAvailabilityLoading(true);
              setAuthoredKeys(null);
              setAvailabilityError(null);
              void loadAvailability();
            }}
          >
            {availabilityError ? "Retry availability" : "Refresh availability"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-4 border-t border-[#273d54] pt-4 text-xs leading-7">
          <div className="min-w-0 flex-1 text-[#a7bfd8]">
            {!bookmarks ? (
              <p>Bookmarks are unavailable in this view.</p>
            ) : (
              <>
                <p role="status">
                  {bookmarks.loading
                    ? "Loading saved topics…"
                    : !bookmarks.ready
                      ? "Saved topics have not loaded."
                      : bookmarks.error
                        ? "Showing the last confirmed bookmark states."
                        : "Bookmarks are confirmed by your BrainHub profile."}
                </p>
                {bookmarks.error ? (
                  <p role="alert" className="mt-1 text-[#e3bd9e]">
                    {bookmarks.error}
                  </p>
                ) : null}
                {bookmarks.pending.size ? (
                  <p className="mt-1 text-[#d7c0a3]">
                    {bookmarks.pending.size} change(s) awaiting confirmation or your review. Unacknowledged
                    changes are kept during this visit.
                  </p>
                ) : null}
              </>
            )}
          </div>
          {bookmarks ? (
            <button
              type="button"
              className="btn min-h-11 text-xs"
              disabled={bookmarks.loading}
              onClick={() => {
                void bookmarks.refresh();
              }}
            >
              {bookmarks.error || !bookmarks.ready ? "Retry bookmarks" : "Refresh bookmarks"}
            </button>
          ) : null}
        </div>
      </section>
      <section aria-labelledby={`${uid}-results`}>
        <h2 id={`${uid}-results`} className="text-xl font-semibold">
          Matching topics
        </h2>
        <p className="mt-2 text-sm leading-7 text-[#a6bdd7]" role="status" aria-live="polite">
          {waitingForSaved
            ? "Waiting for saved topics before showing bookmarked matches."
            : waitingForAvailability
              ? availabilityLoading
                ? "Confirming teaching availability before showing these filtered results…"
                : "Teaching availability is unknown. These filtered results cannot yet be confirmed."
              : `Showing ${shown.length} of ${matches.length} matching topics (${TOPICS.length} indexed).`}
        </p>
        {waitingForSaved ? (
          <p className="panel mt-5 p-6 text-sm leading-8 text-[#b5c9df]">
            Load or retry bookmarks above. An unavailable saved list is not an empty saved list.
          </p>
        ) : waitingForAvailability ? (
          <div className="panel mt-5 p-6 text-sm leading-8 text-[#b5c9df]">
            <p>
              {availabilityLoading
                ? "The authored-lesson and outline filters need a confirmed curriculum index. Public topics remain searchable while it loads."
                : "Retry lesson availability above, or include topics whose availability has not been confirmed. An unavailable index does not mean there are no matching topics."}
            </p>
            <button
              type="button"
              className="btn mt-4 min-h-11"
              onClick={() => changeFilter("availability", "all")}
            >
              Show all availability
            </button>
          </div>
        ) : shown.length ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {shown.map((topic) => (
              <TopicCard
                key={topic.key}
                topic={topic}
                availability={topicAvailability(topic, authoredKeys)}
              />
            ))}
          </div>
        ) : (
          <div className="panel mt-5 p-6 text-sm leading-8 text-[#b5c9df]">
            <p>
              {filters.saved === "bookmarked" && savedKeys.size === 0
                ? "No topics have been bookmarked yet. Choose All topics, then save a topic to return to it here."
                : "No topics match these filters. Try fewer terms, another stage or a broader availability filter."}
            </p>
            <button type="button" className="btn mt-4 min-h-11" onClick={clearFilters}>
              Clear search and filters
            </button>
          </div>
        )}
        {!waitingForSaved && !waitingForAvailability && matches.length > shown.length ? (
          <button
            type="button"
            className="btn mt-6 min-h-11"
            onClick={() => setPage({ signature: urlSnapshot, count: visibleCount + PAGE_SIZE })}
          >
            Show more topics
          </button>
        ) : null}
      </section>
      {retired.length ? (
        <section className="panel p-5 sm:p-8" aria-labelledby={`${uid}-retired`}>
          <h2 id={`${uid}-retired`} className="text-xl font-semibold">
            Retired saved topics
          </h2>
          <p className="mt-3 text-sm leading-8 text-[#a8bfd8]">
            These saved entries are outside the current topic catalog. They are not included in the results
            above. You can remove them; a study link is not available.
          </p>
          <ul className="mt-4 space-y-4">
            {retired.map((row) => (
              <li
                key={`${row.roadmap_slug}:${row.topic_slug}`}
                className="rounded-xl border border-[#3e4652] p-4"
              >
                <p className="break-words text-sm text-[#c9daee]">{row.topic_slug}</p>
                <p className="mt-1 text-xs text-[#96afc9]">
                  {learningRoadmaps.find((roadmap) => roadmap.slug === row.roadmap_slug)?.title ??
                    row.roadmap_slug}{" "}
                  · Retired topic
                </p>
                <div className="mt-3">
                  <BookmarkButton
                    roadmapSlug={row.roadmap_slug}
                    topicSlug={row.topic_slug}
                    title={`${row.topic_slug} — retired`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
