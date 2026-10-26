"use client";

import Link from "next/link";
import { useState } from "react";
import {
  selectProgrammingQuestions,
  type ProgrammingQuestion,
  type ProgrammingTopic,
  type ProgrammingTrack,
  type TriviaMode,
} from "@/lib/programming";

type Phase = "intro" | "quiz" | "results";
type RecordedAnswer = { topic: ProgrammingTopic; correct: boolean };

const modeLabels: Record<TriviaMode, string> = {
  mixed: "Mixed",
  fundamentals: "Fundamentals",
  "function-calls": "Function calls",
};

function topicLabel(topic: ProgrammingTopic) {
  return topic === "fundamentals" ? "Fundamentals" : "Function calls";
}

export function ProgrammingTrivia({ track }: { track: ProgrammingTrack }) {
  const [mode, setMode] = useState<TriviaMode>("mixed");
  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<ProgrammingQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<RecordedAnswer[]>([]);
  const question = questions[index];
  const correctCount = answers.filter((answer) => answer.correct).length;

  function start() {
    setQuestions(selectProgrammingQuestions(track, mode));
    setIndex(0);
    setSelected(null);
    setAnswers([]);
    setPhase("quiz");
  }

  function choose(choice: number) {
    if (!question || selected !== null) return;
    setSelected(choice);
    setAnswers((current) => [...current, { topic: question.topic, correct: choice === question.answer }]);
  }

  function advance() {
    if (selected === null) return;
    if (index + 1 >= questions.length) {
      setPhase("results");
      return;
    }
    setIndex((current) => current + 1);
    setSelected(null);
  }

  function reset() {
    setPhase("intro");
    setQuestions([]);
    setIndex(0);
    setSelected(null);
    setAnswers([]);
  }

  if (phase === "intro") {
    const roundLength = mode === "mixed" ? 10 : 5;
    return (
      <div>
        <ProgrammingHeader track={track} />
        <div className="mb-4 flex flex-wrap gap-2" aria-label="Question mode">
          {(Object.keys(modeLabels) as TriviaMode[]).map((item) => (
            <button
              key={item}
              className="btn"
              style={mode === item ? { borderColor: track.accent, color: track.accent } : undefined}
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
            >
              {modeLabels[item]}
            </button>
          ))}
        </div>
        <div className="panel grid min-h-[420px] place-items-center p-8 text-center">
          <div className="max-w-2xl">
            <p className="metric" style={{ color: track.accent }}>
              {roundLength}-question {modeLabels[mode].toLowerCase()} round
            </p>
            <h2 className="mt-4 text-3xl font-semibold">Test what the code actually does.</h2>
            <p className="mt-3 leading-7 text-[#8995a7]">
              Every answer includes a concise explanation. Mixed rounds balance language fundamentals with
              standard function and method calls.
            </p>
            <button className="btn btn-primary mt-7" onClick={start}>
              Start {track.name} trivia
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "results") {
    const fundamentals = answers.filter((answer) => answer.topic === "fundamentals");
    const functionCalls = answers.filter((answer) => answer.topic === "function-calls");
    const score = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
    return (
      <div>
        <ProgrammingHeader track={track} />
        <div className="panel grid min-h-[440px] place-items-center p-8 text-center">
          <div>
            <p className="metric" style={{ color: track.accent }}>
              Round complete
            </p>
            <h2 className="mt-4 text-6xl font-semibold">{score}%</h2>
            <p className="mt-3 text-[#98a4b5]">
              {correctCount} of {questions.length} correct
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <ResultMetric label="Fundamentals" answers={fundamentals} />
              <ResultMetric label="Function calls" answers={functionCalls} />
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button className="btn btn-primary" onClick={start}>
                Try another round
              </button>
              <button className="btn" onClick={reset}>
                Change mode
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!question) return null;
  const answered = selected !== null;

  return (
    <div>
      <ProgrammingHeader track={track} />
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <QuizMetric label="Question" value={String(index + 1) + "/" + String(questions.length)} />
        <QuizMetric label="Correct" value={correctCount} />
        <QuizMetric label="Mode" value={modeLabels[mode]} />
        <QuizMetric label="Topic" value={topicLabel(question.topic)} />
      </div>
      <section className="panel overflow-hidden">
        <div className="h-1 bg-[#151d28]">
          <div
            className="h-full transition-all"
            style={{
              background: track.accent,
              width: String(((index + 1) / questions.length) * 100) + "%",
            }}
          />
        </div>
        <div className="p-6 sm:p-10">
          <p className="metric" style={{ color: track.accent }}>
            {topicLabel(question.topic)}
          </p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight">{question.prompt}</h2>
          {question.code ? (
            <pre className="mt-6 overflow-x-auto rounded-xl border border-[#263244] bg-[#080c12] p-5 text-sm leading-7 text-[#d6deeb]">
              <code>{question.code}</code>
            </pre>
          ) : null}
          <div className="mt-7 grid gap-3" aria-label="Answer choices">
            {question.choices.map((choice, choiceIndex) => {
              const isCorrect = choiceIndex === question.answer;
              const isSelected = choiceIndex === selected;
              const feedbackClass = answered
                ? isCorrect
                  ? "border-[#34d399] bg-[#34d39912]"
                  : isSelected
                    ? "border-[#fb7185] bg-[#fb718512]"
                    : "opacity-60"
                : "hover:border-[#64748b]";
              return (
                <button
                  key={choice}
                  className={[
                    "flex items-start gap-4 rounded-xl border border-[#2b3545] bg-[#0a0f16] p-4 text-left transition",
                    feedbackClass,
                  ].join(" ")}
                  onClick={() => choose(choiceIndex)}
                  disabled={answered}
                  aria-label={"Answer " + String.fromCharCode(65 + choiceIndex) + ": " + choice}
                >
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#3a4658] font-mono text-xs"
                    style={
                      answered && isCorrect ? { borderColor: track.accent, color: track.accent } : undefined
                    }
                  >
                    {String.fromCharCode(65 + choiceIndex)}
                  </span>
                  <span className="pt-0.5">{choice}</span>
                </button>
              );
            })}
          </div>
          {answered ? (
            <div className="enter mt-7 border-t border-[#202937] pt-6" role="status">
              <p
                className="font-semibold"
                style={{ color: selected === question.answer ? "#34d399" : "#fb7185" }}
              >
                {selected === question.answer ? "Correct" : "Not quite"}
              </p>
              <h3 className="metric mt-4">Why this is right</h3>
              <p className="mt-2 max-w-3xl leading-7 text-[#aab4c2]">{question.explanation}</p>
              <button className="btn mt-6" onClick={advance}>
                {index + 1 >= questions.length ? "View results" : "Next question"}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ProgrammingHeader({ track }: { track: ProgrammingTrack }) {
  return (
    <>
      <Link
        href="/programming"
        className="mb-5 inline-flex items-center gap-2 text-sm text-[#8995a7] hover:text-white"
      >
        ← Programming desk
      </Link>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="metric" style={{ color: track.accent }}>
            Programming trivia
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{track.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#8995a7]">{track.description}</p>
        </div>
        <span
          className="rounded-xl border border-[#2b3545] px-4 py-2 font-mono text-sm font-bold"
          style={{ color: track.accent }}
        >
          {track.badge}
        </span>
      </div>
    </>
  );
}

function QuizMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel px-4 py-3">
      <p className="text-lg font-semibold">{value}</p>
      <p className="metric">{label}</p>
    </div>
  );
}

function ResultMetric({ label, answers }: { label: string; answers: RecordedAnswer[] }) {
  const correct = answers.filter((answer) => answer.correct).length;
  return (
    <div className="rounded-xl border border-[#273142] bg-[#090d13] px-5 py-4 text-left">
      <p className="text-xl font-semibold">{answers.length ? `${correct}/${answers.length}` : "—"}</p>
      <p className="metric mt-1">{label}</p>
    </div>
  );
}
