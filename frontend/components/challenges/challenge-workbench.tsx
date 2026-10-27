"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { CheckCircle2, CircleX, ExternalLink, Play, Send, TerminalSquare } from "lucide-react";
import { api } from "@/lib/api";
import type { ChallengeLanguage, ChallengeResult, ChallengeValue, CodingChallenge } from "@/lib/challenges";

const languages: Array<{ id: ChallengeLanguage; label: string }> = [
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
];

function formatValue(value: ChallengeValue) {
  return JSON.stringify(value);
}

function formatInput(challenge: CodingChallenge, values: ChallengeValue[]) {
  return values
    .map(
      (value, index) =>
        `${challenge.signature.params[index]?.name ?? `arg${index + 1}`} = ${formatValue(value)}`,
    )
    .join(", ");
}

export function ChallengeWorkbench({ challenge }: { challenge: CodingChallenge }) {
  const [language, setLanguage] = useState<ChallengeLanguage>("python");
  const [drafts, setDrafts] = useState<Record<ChallengeLanguage, string>>(() => ({
    ...challenge.starterCode,
  }));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateDraft(source: string) {
    setDrafts((current) => ({ ...current, [language]: source }));
  }

  function switchLanguage(nextLanguage: ChallengeLanguage) {
    setLanguage(nextLanguage);
    setResult(null);
    setError(null);
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab" || event.shiftKey) return;

    event.preventDefault();
    const editor = event.currentTarget;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const source = drafts[language];
    const nextSource = `${source.slice(0, start)}    ${source.slice(end)}`;
    updateDraft(nextSource);
    requestAnimationFrame(() => editor.setSelectionRange(start + 4, start + 4));
  }

  async function execute(mode: "run" | "submit") {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      setResult(
        await api.runChallenge(challenge.slug, {
          language,
          source: drafts[language],
          mode,
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Execution failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/challenges" className="text-sm text-[#8995a7] hover:text-white">
          ← Challenge library
        </Link>
        {challenge.officialUrl ? (
          <a
            href={challenge.officialUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-[#8995a7] hover:text-white"
          >
            LeetCode source <ExternalLink size={14} />
          </a>
        ) : (
          <span className="text-sm text-[#8995a7]">Original BrainHub design problem</span>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section className="panel overflow-hidden">
          <div className="border-b border-[#202937] p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm text-[#66758a]">#{challenge.number}</span>
              <span
                className="rounded-md border border-[#344153] px-2 py-1 text-xs font-semibold"
                style={{
                  color:
                    challenge.difficulty === "Easy"
                      ? "#34d399"
                      : challenge.difficulty === "Medium"
                        ? "#facc15"
                        : challenge.difficulty === "Hard"
                          ? "#fb7185"
                          : "#c084fc",
                }}
              >
                {challenge.difficulty}
              </span>
              <span className="metric">
                {challenge.category === "Low-Level Design" ? "LLD" : challenge.category}
              </span>
              <span className="metric">20 test cases</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold">{challenge.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              {challenge.topics.map((topic) => (
                <span className="rounded-md bg-[#151d28] px-2 py-1 text-xs text-[#9aa6b7]" key={topic}>
                  {topic}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-8 p-6">
            <div>
              <h2 className="metric text-[#63e6be]">Problem</h2>
              <p className="mt-3 leading-7 text-[#c0c8d3]">{challenge.summary}</p>
            </div>
            <div>
              <h2 className="metric text-[#63e6be]">Examples</h2>
              <div className="mt-3 space-y-3">
                {challenge.samples.map((sample, index) => (
                  <div className="rounded-xl border border-[#273142] bg-[#090d13] p-4" key={index}>
                    <p className="text-xs font-semibold text-[#66758a]">EXAMPLE {index + 1}</p>
                    <p className="mt-2 break-words font-mono text-sm">
                      <span className="text-[#8995a7]">Input: </span>
                      {formatInput(challenge, sample.args)}
                    </p>
                    <p className="mt-2 break-words font-mono text-sm">
                      <span className="text-[#8995a7]">Output: </span>
                      {formatValue(sample.expected)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="metric text-[#63e6be]">Constraints</h2>
              <ul className="mt-3 space-y-2 text-sm text-[#aeb8c6]">
                {challenge.constraints.map((constraint) => (
                  <li className="flex gap-3" key={constraint}>
                    <span aria-hidden="true" className="text-[#63e6be]">
                      •
                    </span>
                    {constraint}
                  </li>
                ))}
              </ul>
            </div>
            <p className="border-t border-[#202937] pt-5 text-xs leading-5 text-[#66758a]">
              {challenge.category === "Algorithm"
                ? "BrainHub uses the official title, difficulty, number, and topic metadata. The wording and test suite are original practice material, not a copy of LeetCode's statement."
                : "This low-level design exercise, its operation protocol, wording, and test suite are original BrainHub practice material."}
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#202937] px-4 py-3">
              <div className="flex gap-2" aria-label="Programming language">
                {languages.map((item) => (
                  <button
                    className="btn px-3 py-2 text-sm"
                    key={item.id}
                    aria-pressed={language === item.id}
                    onClick={() => switchLanguage(item.id)}
                    style={language === item.id ? { borderColor: "#63e6be", color: "#63e6be" } : undefined}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#66758a]">Drafts are preserved while switching languages</p>
            </div>
            <label className="block">
              <span className="sr-only">{language} solution editor</span>
              <textarea
                className="min-h-[510px] w-full resize-y bg-[#080c12] p-5 font-mono text-sm leading-6 text-[#d6deeb] outline-none"
                value={drafts[language]}
                onChange={(event) => updateDraft(event.target.value)}
                onKeyDown={handleEditorKeyDown}
                spellCheck={false}
                aria-label={`${language} solution editor`}
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#202937] px-4 py-3">
              <p className="text-xs text-[#66758a]">
                Tab inserts 4 spaces · Run checks 3 examples · Submit checks all 20 cases
              </p>
              <div className="flex gap-2">
                <button
                  className="btn flex items-center gap-2"
                  disabled={running}
                  onClick={() => execute("run")}
                >
                  <Play size={15} /> Run
                </button>
                <button
                  className="btn btn-primary flex items-center gap-2"
                  disabled={running}
                  onClick={() => execute("submit")}
                >
                  <Send size={15} /> {running ? "Running…" : "Submit"}
                </button>
              </div>
            </div>
          </div>

          <div className="panel overflow-hidden" aria-live="polite">
            <div className="flex items-center justify-between border-b border-[#202937] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <TerminalSquare size={16} className="text-[#63e6be]" /> Output terminal
              </div>
              {result ? (
                <span className="text-xs text-[#8995a7]">
                  {result.passed}/{result.total} passed · {result.status.description}
                </span>
              ) : null}
            </div>
            <pre className="min-h-32 overflow-x-auto bg-[#05080c] p-4 font-mono text-xs leading-6 text-[#aeb8c6]">
              {error
                ? error
                : result?.terminal ||
                  (running
                    ? "Compiling and running in the sandbox…"
                    : "Your print output and compiler messages appear here.")}
            </pre>
            {result?.results.length ? (
              <div className="grid gap-px border-t border-[#202937] bg-[#202937] sm:grid-cols-2">
                {result.results.map((test) => (
                  <div className="bg-[#0d1118] p-3 text-xs" key={test.index}>
                    <p className="flex items-center gap-2 font-semibold">
                      {test.passed ? (
                        <CheckCircle2 size={14} className="text-[#34d399]" />
                      ) : (
                        <CircleX size={14} className="text-[#fb7185]" />
                      )}
                      Case {test.index + 1}
                    </p>
                    {!test.passed ? (
                      <div className="mt-2 space-y-1 font-mono text-[#8995a7]">
                        <p>Expected: {test.expected}</p>
                        <p>Actual: {test.actual}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <p className="border-t border-[#202937] px-4 py-3 text-xs text-[#66758a]">
              Execution uses the public Judge0 CE sandbox. Submitted source code is sent to that service for
              compilation and execution.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
