"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AuthoredLesson as Lesson } from "@/lib/curriculum";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { LessonNotes } from "@/components/roadmaps/lesson-notes";
import { MathText } from "@/components/roadmaps/math-text";
import { useRoadmapProgress } from "@/components/roadmaps/roadmap-progress-provider";
import { isCompleted, progressKey } from "@/lib/roadmap-progress";
import { readLessonCache, saveLessonCache } from "@/lib/lesson-cache";

export function AuthoredLesson({
  roadmapSlug,
  topicSlug,
  accent,
}: {
  roadmapSlug: string;
  topicSlug: string;
  accent: string;
}) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [offlineCopy, setOfflineCopy] = useState(false);
  const { progress } = useRoadmapProgress();
  const item = progress.get(progressKey(roadmapSlug, topicSlug));
  useEffect(() => {
    let active = true;
    api
      .authoredLesson(roadmapSlug, topicSlug)
      .then((response) => {
        if (active) {
          setLesson(response);
          setError(null);
          setOfflineCopy(false);
          saveLessonCache(response);
        }
      })
      .catch((problem: unknown) => {
        if (active) {
          const saved = readLessonCache(roadmapSlug, topicSlug);
          if (saved) {
            setLesson(saved);
            setOfflineCopy(true);
            setError(null);
          } else setError(problem instanceof Error ? problem.message : "Unable to load this lesson.");
        }
      });
    return () => {
      active = false;
    };
  }, [roadmapSlug, topicSlug, retry]);
  if (error)
    return (
      <section className="panel p-8" role="alert">
        <h1 className="text-2xl font-semibold">Lesson unavailable</h1>
        <p className="mt-3 leading-7 text-[#a6b6c9]">{error}</p>
        <button
          className="btn mt-5"
          onClick={() => {
            setError(null);
            setRetry((current) => current + 1);
          }}
          type="button"
        >
          Retry loading
        </button>
      </section>
    );
  if (!lesson)
    return (
      <div className="panel min-h-64 p-8 text-[#92a5bd]" role="status">
        Loading the lesson and worked examples…
      </div>
    );
  return (
    <article className="space-y-6">
      {offlineCopy ? (
        <aside
          className="rounded-xl border border-[#6b5a32] bg-[#201b10] p-4 text-sm leading-7 text-[#e3cfa4]"
          role="status"
        >
          Showing the lesson saved on this device. You can continue an existing draft; grading and new
          sessions need a connection.{" "}
          <button
            className="ml-2 underline underline-offset-4"
            type="button"
            onClick={() => setRetry((current) => current + 1)}
          >
            Retry connection
          </button>
        </aside>
      ) : null}
      <header className="panel p-6 sm:p-9">
        <p className="metric" style={{ color: accent }}>
          Foundation · Authored lesson · {lesson.question_count} questions
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">{lesson.title}</h1>
        <p className="mt-4 max-w-3xl leading-8 text-[#a6b7cc]">
          <MathText>{lesson.summary}</MathText>
        </p>
        <p className="mt-4 text-sm text-[#63e6be]">
          {isCompleted(item)
            ? `Completed · Best practice ${item?.quiz_score}%`
            : "Read, work through examples, then solve the practice set."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a className="btn btn-primary" href="#practice">
            Practice questions
          </a>
          <Link className="btn" href={`/roadmaps/${roadmapSlug}/exam`}>
            Stage examination
          </Link>
          <Link className="btn" href="/roadmaps/review">
            Review mistakes
          </Link>
        </div>
      </header>
      <section className="panel p-6 sm:p-8" aria-labelledby="learning-outcomes">
        <h2 className="text-2xl font-semibold" id="learning-outcomes">
          Learning outcomes
        </h2>
        <ul className="mt-4 list-disc space-y-3 pl-5 leading-8 text-[#b4c3d5]">
          {lesson.objectives.map((objective) => (
            <li key={objective}>
              <MathText>{objective}</MathText>
            </li>
          ))}
        </ul>
      </section>
      {lesson.sections.map((section) => (
        <section className="panel p-6 sm:p-8" key={section.heading}>
          <h2 className="text-2xl font-semibold">{section.heading}</h2>
          <p className="mt-4 leading-8 text-[#b4c3d5]">
            <MathText>{section.body}</MathText>
          </p>
        </section>
      ))}
      <section className="panel p-6 sm:p-8" aria-labelledby="worked-examples">
        <p className="metric" style={{ color: accent }}>
          Follow each calculation
        </p>
        <h2 className="mt-2 text-2xl font-semibold" id="worked-examples">
          Worked examples
        </h2>
        <div className="mt-6 space-y-8">
          {lesson.worked_examples.map((example, index) => (
            <section key={example.prompt}>
              <h3 className="font-semibold">Example {index + 1}</h3>
              <p className="mt-3 rounded-xl bg-[#0b1420] p-4 leading-8">
                <MathText>{example.prompt}</MathText>
              </p>
              <ol className="mt-4 list-decimal space-y-3 pl-6 leading-8 text-[#aebfd3]">
                {example.steps.map((step) => (
                  <li key={step}>
                    <MathText>{step}</MathText>
                  </li>
                ))}
              </ol>
              <p className="mt-4 rounded-xl border border-[#285541] bg-[#102019] p-4 leading-8 text-[#b7e2cd]">
                <MathText>{example.result}</MathText>
              </p>
            </section>
          ))}
        </div>
      </section>
      <LessonNotes lessonId={`${roadmapSlug}:${topicSlug}`} accent={accent} />
      <AssessmentPanel roadmapSlug={roadmapSlug} topicSlug={topicSlug} />
      <section className="panel p-6 text-sm leading-7 text-[#91a5bf]">
        <h2 className="font-semibold text-[#cad6e6]">Further study</h2>
        <p className="mt-2">
          These references informed the scope. BrainHub explanations and exercises are original.
        </p>
        <ul className="mt-2 list-disc pl-5">
          {lesson.sources.map((source) => (
            <li key={source.url}>
              <a
                className="text-[#8dc8ff] underline decoration-[#416486] underline-offset-4"
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.title}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
