"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import type { ChallengeDifficulty, CodingChallenge } from "@/lib/challenges";

const difficulties = ["All", "Easy", "Medium", "Hard"] as const;
const difficultyColors: Record<ChallengeDifficulty, string> = {
  Easy: "#34d399",
  Medium: "#facc15",
  Hard: "#fb7185",
};

export function ChallengeCatalog({ challenges }: { challenges: CodingChallenge[] }) {
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>("All");
  const [topic, setTopic] = useState("All topics");
  const [query, setQuery] = useState("");
  const topics = useMemo(
    () => ["All topics", ...Array.from(new Set(challenges.flatMap((item) => item.topics))).sort()],
    [challenges],
  );
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return challenges.filter(
      (challenge) =>
        (difficulty === "All" || challenge.difficulty === difficulty) &&
        (topic === "All topics" || challenge.topics.includes(topic)) &&
        (!search ||
          challenge.title.toLowerCase().includes(search) ||
          challenge.topics.some((item) => item.toLowerCase().includes(search))),
    );
  }, [challenges, difficulty, query, topic]);

  return (
    <div>
      <div className="panel mb-5 grid gap-4 p-4 lg:grid-cols-[1fr_auto_auto]">
        <label className="relative block">
          <span className="sr-only">Search coding challenges</span>
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#66758a]"
            size={17}
          />
          <input
            className="input pl-10"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or topic"
          />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Filter by difficulty">
          {difficulties.map((item) => (
            <button
              key={item}
              className="btn text-sm"
              aria-pressed={difficulty === item}
              onClick={() => setDifficulty(item)}
              style={difficulty === item ? { borderColor: "#63e6be", color: "#63e6be" } : undefined}
            >
              {item}
            </button>
          ))}
        </div>
        <label>
          <span className="sr-only">Filter by topic</span>
          <select className="input min-w-48" value={topic} onChange={(event) => setTopic(event.target.value)}>
            {topics.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="metric">{filtered.length} challenges</p>
        <p className="text-xs text-[#778398]">All selections exclude NeetCode 150</p>
      </div>
      <div className="grid gap-3">
        {filtered.map((challenge) => (
          <article className="panel group grid gap-4 p-5 md:grid-cols-[72px_1fr_auto]" key={challenge.slug}>
            <div>
              <p className="font-mono text-sm text-[#66758a]">#{challenge.number}</p>
              <p
                className="mt-2 text-xs font-semibold"
                style={{ color: difficultyColors[challenge.difficulty] }}
              >
                {challenge.difficulty}
              </p>
            </div>
            <div>
              <h2 className="text-lg font-semibold">{challenge.title}</h2>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#8995a7]">{challenge.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {challenge.topics.map((item) => (
                  <span
                    className="rounded-md border border-[#283345] px-2 py-1 text-xs text-[#9aa6b7]"
                    key={item}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href={`/challenges/${challenge.slug}`}
              prefetch={false}
              className="btn self-center text-sm group-hover:border-[#63e6be] group-hover:text-[#63e6be]"
              aria-label={`Open ${challenge.title}`}
            >
              Solve <ArrowUpRight className="ml-2 inline" size={16} />
            </Link>
          </article>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="panel py-16 text-center text-[#8995a7]">No challenges match those filters.</div>
      ) : null}
    </div>
  );
}
