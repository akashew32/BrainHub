"use client";

import { useEffect, useState } from "react";
import { NotebookPen } from "lucide-react";

const MAX_NOTES_LENGTH = 4_000;

export function LessonNotes({ lessonId, accent }: { lessonId: string; accent: string }) {
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const storageKey = `brainhub:lesson-notes:v1:${lessonId}`;

  useEffect(() => {
    try {
      setNotes(localStorage.getItem(storageKey) ?? "");
    } finally {
      setLoaded(true);
    }
  }, [storageKey]);

  function updateNotes(value: string) {
    const next = value.slice(0, MAX_NOTES_LENGTH);
    setNotes(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // The editor remains usable when private browsing or storage quotas block persistence.
    }
  }

  return (
    <section className="panel p-6 sm:p-8" aria-labelledby="notes-title">
      <p className="metric flex items-center gap-2" style={{ color: accent }}>
        <NotebookPen size={14} /> Personal notes
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-2xl font-semibold" id="notes-title">
          Explain it in your own words
        </h2>
        <span className="text-xs text-[#718096]">Saved locally on this device</span>
      </div>
      <textarea
        aria-label="Personal lesson notes"
        className="input mt-5 min-h-40 resize-y leading-7"
        disabled={!loaded}
        maxLength={MAX_NOTES_LENGTH}
        onChange={(event) => updateNotes(event.target.value)}
        placeholder="Write the definition, the step you found hardest, and one example you can reproduce without notes."
        value={notes}
      />
      <p className="mt-2 text-right text-xs text-[#64748b]">
        {notes.length}/{MAX_NOTES_LENGTH}
      </p>
    </section>
  );
}
