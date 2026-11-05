"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FlaskConical,
  Lightbulb,
  LockKeyhole,
  RotateCcw,
  Target,
} from "lucide-react";
import { useRoadmapProgress } from "@/components/roadmaps/roadmap-progress-provider";
import { LessonNotes } from "@/components/roadmaps/lesson-notes";
import type { RoadmapLesson } from "@/lib/roadmap-lessons";
import { isCompleted, isStageUnlocked, progressKey } from "@/lib/roadmap-progress";
import type { LearningRoadmap } from "@/lib/roadmaps";

type LessonNav = { title: string; href: string; stageIndex: number } | null;
type PrerequisiteLink = { title: string; href: string };

export function LessonWorkspace({
  lesson,
  roadmap,
  previous,
  next,
  prerequisites,
}: {
  lesson: RoadmapLesson;
  roadmap: LearningRoadmap;
  previous: LessonNav;
  next: LessonNav;
  prerequisites: PrerequisiteLink[];
}) {
  const { progress, ready, recordProgress, syncState } = useRoadmapProgress();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [score, setScore] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openedAt] = useState(Date.now);
  const lastRecordedAt = useRef(openedAt);
  const unlocked = isStageUnlocked(roadmap, lesson.stageIndex, progress);
  const item = progress.get(progressKey(lesson.roadmapSlug, lesson.topicSlug));
  const complete = isCompleted(item);

  useEffect(() => {
    if (!ready || !unlocked) return;
    void recordProgress(lesson.roadmapSlug, lesson.topicSlug, {
      status: complete ? (item?.status ?? "completed") : "in_progress",
    });
    // Recording a view should happen once per lesson load, not on every progress response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, ready, unlocked]);

  useEffect(() => {
    if (!ready || !unlocked) return;
    function flushTime() {
      const now = Date.now();
      const elapsed = Math.floor((now - lastRecordedAt.current) / 1000);
      if (elapsed < 5) return;
      lastRecordedAt.current = now;
      void recordProgress(lesson.roadmapSlug, lesson.topicSlug, {
        status: complete ? (item?.status ?? "completed") : "in_progress",
        time_spent_seconds: Math.min(elapsed, 300),
      });
    }
    const interval = window.setInterval(flushTime, 60_000);
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flushTime();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flushTime();
    };
  }, [complete, item?.status, lesson.roadmapSlug, lesson.topicSlug, ready, recordProgress, unlocked]);

  if (!ready) {
    return (
      <div className="panel grid min-h-[420px] place-items-center p-8 text-sm text-[#8190a4]" role="status">
        Loading your lesson progress…
      </div>
    );
  }

  if (!unlocked) {
    const priorStage = roadmap.stages[lesson.stageIndex - 1]!;
    return (
      <section className="panel mx-auto max-w-2xl p-8 text-center sm:p-12">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#182130] text-[#8290a4]">
          <LockKeyhole size={21} />
        </span>
        <p className="metric mt-5" style={{ color: roadmap.accent }}>
          Stage {lesson.stageIndex + 1} is locked
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Complete {priorStage.title} first</h1>
        <p className="mx-auto mt-4 max-w-lg leading-7 text-[#96a2b2]">
          Finish all six lessons in the previous stage to preserve the prerequisite chain. Your saved progress
          will unlock this lesson automatically.
        </p>
        <Link
          className="btn mt-7 inline-flex items-center gap-2"
          href={`/roadmaps/${roadmap.slug}#stage-${lesson.stageIndex}`}
        >
          <ArrowLeft size={15} /> Return to stage {lesson.stageIndex}
        </Link>
      </section>
    );
  }

  async function submitQuiz() {
    if (lesson.quiz.some((question) => answers[question.id] === undefined)) {
      setMessage("Answer all three questions before submitting.");
      return;
    }
    const correct = lesson.quiz.filter((question) => answers[question.id] === question.answer).length;
    const nextScore = Math.round((correct / lesson.quiz.length) * 100);
    const passed = nextScore >= 67;
    const now = Date.now();
    const elapsed = Math.min(300, Math.max(0, Math.floor((now - lastRecordedAt.current) / 1000)));
    lastRecordedAt.current = now;
    setScore(nextScore);
    setSubmitting(true);
    await recordProgress(lesson.roadmapSlug, lesson.topicSlug, {
      status: passed ? "completed" : "in_progress",
      quiz_score: nextScore,
      time_spent_seconds: elapsed,
    });
    setSubmitting(false);
    setMessage(
      passed
        ? "Mastery check passed. The lesson is complete and your next prerequisite may now be available."
        : "Review the explanations below, revise your answers, and try again.",
    );
  }

  function retryQuiz() {
    setAnswers({});
    setScore(null);
    setMessage(null);
    document.getElementById("mastery-check")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <article>
      <header className="panel relative overflow-hidden p-6 sm:p-9">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px"
          style={{ backgroundColor: lesson.accent }}
        />
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="metric" style={{ color: lesson.accent }}>
              Stage {lesson.stageIndex + 1} · Lesson {lesson.topicIndex + 1} · {lesson.level}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-.035em] sm:text-5xl">{lesson.title}</h1>
            <p className="mt-4 max-w-2xl leading-7 text-[#a6b0be]">{lesson.summary}</p>
          </div>
          <div className="grid min-w-52 grid-cols-2 gap-2 text-sm">
            <LessonMetric icon={Clock3} label="Estimate" value={`${lesson.estimatedMinutes} min`} />
            <LessonMetric
              icon={complete ? CheckCircle2 : Target}
              label="Status"
              value={complete ? "Complete" : item ? "In progress" : "New"}
            />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#202937] pt-5 text-xs text-[#748196]">
          <span>{syncState === "offline" ? "Offline cache active" : "Progress synced"}</span>
          <span aria-hidden="true">•</span>
          <span>Best quiz: {item?.quiz_attempts ? `${item.quiz_score}%` : "Not attempted"}</span>
          <span aria-hidden="true">•</span>
          <span>{Math.round((item?.time_spent_seconds ?? 0) / 60)} saved minutes</span>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-6">
          <section className="panel p-6 sm:p-8" aria-labelledby="objectives-title">
            <p className="metric" style={{ color: lesson.accent }}>
              Lesson outcomes
            </p>
            <h2 className="mt-2 text-2xl font-semibold" id="objectives-title">
              What you should be able to do
            </h2>
            <ul className="mt-5 space-y-3">
              {lesson.objectives.map((objective) => (
                <li className="flex gap-3 leading-7 text-[#b7c0cb]" key={objective}>
                  <Check className="mt-1.5 shrink-0" size={15} style={{ color: lesson.accent }} />
                  {objective}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel overflow-hidden" aria-labelledby="explanation-title">
            <div className="border-b border-[#202937] p-6 sm:px-8">
              <p className="metric" style={{ color: lesson.accent }}>
                Concept lesson
              </p>
              <h2 className="mt-2 text-2xl font-semibold" id="explanation-title">
                Build the reasoning pattern
              </h2>
            </div>
            <div className="divide-y divide-[#202937]">
              {lesson.sections.map((section) => (
                <section className="p-6 sm:px-8" key={section.heading}>
                  <h3 className="text-lg font-semibold">{section.heading}</h3>
                  <p className="mt-3 leading-8 text-[#aeb8c6]">{section.body}</p>
                </section>
              ))}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3" aria-label="Reasoning checklist">
            {lesson.keyIdeas.map((idea, index) => (
              <div className="panel p-5" key={idea.label}>
                <p className="font-mono text-xs" style={{ color: lesson.accent }}>
                  0{index + 1}
                </p>
                <h2 className="mt-3 font-semibold">{idea.label}</h2>
                <p className="mt-2 text-sm leading-6 text-[#8f9baa]">{idea.detail}</p>
              </div>
            ))}
          </section>

          <section className="panel p-6 sm:p-8" aria-labelledby="worked-example-title">
            <p className="metric flex items-center gap-2" style={{ color: lesson.accent }}>
              <BookOpenCheck size={14} /> Worked example
            </p>
            <h2 className="mt-2 text-2xl font-semibold" id="worked-example-title">
              Apply the structure deliberately
            </h2>
            <p className="mt-4 rounded-xl border border-[#293548] bg-[#0a1018] p-4 leading-7 text-[#c5cdd7]">
              {lesson.workedExample.prompt}
            </p>
            <ol className="mt-5 space-y-4">
              {lesson.workedExample.steps.map((step, index) => (
                <li className="flex gap-4" key={step}>
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-full border font-mono text-xs"
                    style={{ borderColor: `${lesson.accent}77`, color: lesson.accent }}
                  >
                    {index + 1}
                  </span>
                  <p className="pt-0.5 leading-7 text-[#aeb8c6]">{step}</p>
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-xl border border-[#285443] bg-[#0d1d18] p-4">
              <p className="metric text-[#63e6be]">Result and interpretation</p>
              <p className="mt-2 text-sm leading-7 text-[#b8c9c2]">{lesson.workedExample.result}</p>
            </div>
          </section>

          <section className="panel p-6 sm:p-8" aria-labelledby="exercise-title">
            <p className="metric flex items-center gap-2 text-[#facc15]">
              <FlaskConical size={14} /> Independent practice
            </p>
            <h2 className="mt-2 text-2xl font-semibold" id="exercise-title">
              Computational or proof exercise
            </h2>
            <p className="mt-4 leading-8 text-[#bdc5d0]">{lesson.exercise.prompt}</p>
            <details className="mt-5 rounded-xl border border-[#293548] bg-[#0a1018] p-4">
              <summary className="cursor-pointer font-semibold text-[#facc15]">
                Show progressive hints
              </summary>
              <ol className="mt-4 space-y-2 text-sm leading-6 text-[#aab4c2]">
                {lesson.exercise.hints.map((hint, index) => (
                  <li key={hint}>
                    {index + 1}. {hint}
                  </li>
                ))}
              </ol>
            </details>
            <details className="mt-3 rounded-xl border border-[#293548] bg-[#0a1018] p-4">
              <summary className="cursor-pointer font-semibold text-[#63e6be]">
                Reveal solution rubric
              </summary>
              <p className="mt-4 text-sm leading-7 text-[#aab4c2]">{lesson.exercise.solution}</p>
            </details>
          </section>

          <LessonNotes accent={lesson.accent} lessonId={lesson.id} />

          <section
            aria-busy={submitting}
            className="panel scroll-mt-24 p-6 sm:p-8"
            id="mastery-check"
            aria-labelledby="quiz-title"
          >
            <p className="metric" style={{ color: lesson.accent }}>
              Mastery check · 2 of 3 required
            </p>
            <h2 className="mt-2 text-2xl font-semibold" id="quiz-title">
              Verify the lesson before advancing
            </h2>
            <div className="mt-6 space-y-7">
              {lesson.quiz.map((question, questionIndex) => (
                <fieldset key={question.id}>
                  <legend className="font-semibold leading-7">
                    {questionIndex + 1}. {question.prompt}
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {question.choices.map((choice, choiceIndex) => {
                      const selected = answers[question.id] === choiceIndex;
                      const reveal = score !== null;
                      const correctChoice = question.answer === choiceIndex;
                      return (
                        <label
                          className="flex cursor-pointer gap-3 rounded-xl border p-3 text-sm leading-6 transition"
                          key={choice}
                          style={{
                            borderColor:
                              reveal && correctChoice ? "#34d399" : selected ? lesson.accent : "#293548",
                            backgroundColor:
                              reveal && correctChoice ? "#0d211a" : selected ? "#111d2a" : "#090d13",
                          }}
                        >
                          <input
                            checked={selected}
                            name={question.id}
                            onChange={() => {
                              setAnswers((current) => ({ ...current, [question.id]: choiceIndex }));
                              setScore(null);
                              setMessage(null);
                            }}
                            type="radio"
                          />
                          <span>{choice}</span>
                        </label>
                      );
                    })}
                  </div>
                  {score !== null ? (
                    <p className="mt-3 flex gap-2 text-sm leading-6 text-[#91a0b3]">
                      <Lightbulb className="mt-1 shrink-0 text-[#facc15]" size={14} /> {question.explanation}
                    </p>
                  ) : null}
                </fieldset>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-[#202937] pt-5">
              <button className="btn btn-primary" disabled={submitting} onClick={submitQuiz} type="button">
                {submitting ? "Saving result…" : "Submit mastery check"}
              </button>
              {score !== null ? (
                <button className="btn flex items-center gap-2" onClick={retryQuiz} type="button">
                  <RotateCcw size={14} /> Retry
                </button>
              ) : null}
              {score !== null ? <span className="font-semibold">Score: {score}%</span> : null}
            </div>
            <div aria-live="polite" className="mt-4 min-h-6 text-sm text-[#aab4c2]">
              {message ? (
                <p className="flex gap-2">
                  {score !== null && score >= 67 ? (
                    <CheckCircle2 className="shrink-0 text-[#34d399]" size={17} />
                  ) : (
                    <CircleAlert className="shrink-0 text-[#facc15]" size={17} />
                  )}
                  {message}
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="self-start lg:sticky lg:top-24">
          <div className="panel p-5">
            <p className="metric" style={{ color: lesson.accent }}>
              Lesson map
            </p>
            <ol className="mt-4 space-y-3 text-sm text-[#8f9baa]">
              {[
                ["Outcomes", "#objectives-title"],
                ["Concept lesson", "#explanation-title"],
                ["Worked example", "#worked-example-title"],
                ["Independent practice", "#exercise-title"],
                ["Mastery check", "#mastery-check"],
              ].map(([label, href], index) => (
                <li key={label}>
                  <a className="flex items-center gap-2 hover:text-white" href={href}>
                    <span className="font-mono text-xs" style={{ color: lesson.accent }}>
                      0{index + 1}
                    </span>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
            <div className="mt-5 border-t border-[#202937] pt-5">
              <p className="metric">Prerequisite chain</p>
              {prerequisites.length ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {prerequisites.map((prerequisite) => (
                    <li key={prerequisite.href}>
                      <Link
                        className="flex items-center justify-between gap-2 text-[#8f9baa] hover:text-white"
                        href={prerequisite.href}
                      >
                        <span>{prerequisite.title}</span>
                        <Check size={13} style={{ color: lesson.accent }} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm leading-6 text-[#718096]">No prior lesson required. Start here.</p>
              )}
            </div>
            <Link className="btn mt-5 flex items-center justify-between" href={`/roadmaps/${roadmap.slug}`}>
              Full roadmap <ChevronRight size={14} />
            </Link>
          </div>
        </aside>
      </div>

      <nav aria-label="Lesson navigation" className="mt-7 grid gap-3 sm:grid-cols-2">
        {previous ? (
          <Link className="panel group p-5 hover:border-[#40516a]" href={previous.href}>
            <p className="metric">Previous lesson</p>
            <p className="mt-2 flex items-center gap-2 font-semibold">
              <ArrowLeft className="transition group-hover:-translate-x-1" size={15} /> {previous.title}
            </p>
          </Link>
        ) : (
          <div />
        )}
        {next && isStageUnlocked(roadmap, next.stageIndex, progress) ? (
          <Link className="panel group p-5 text-right hover:border-[#40516a]" href={next.href}>
            <p className="metric">Next lesson</p>
            <p className="mt-2 flex items-center justify-end gap-2 font-semibold">
              {next.title} <ArrowRight className="transition group-hover:translate-x-1" size={15} />
            </p>
          </Link>
        ) : next ? (
          <div className="panel p-5 text-right text-[#66758a]">
            <p className="metric">Next lesson locked</p>
            <p className="mt-2 flex items-center justify-end gap-2 text-sm">
              Pass the remaining stage quizzes <LockKeyhole size={14} />
            </p>
          </div>
        ) : null}
      </nav>
    </article>
  );
}

function LessonMetric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#263246] bg-[#090d13] p-4">
      <Icon className="text-[#657287]" size={15} />
      <p className="mt-3 font-semibold">{value}</p>
      <p className="metric mt-1">{label}</p>
    </div>
  );
}
