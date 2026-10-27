import type { Metadata } from "next";
import Link from "next/link";
import { Blocks, CodeXml, Layers3, TerminalSquare } from "lucide-react";
import { ChallengeCatalog } from "@/components/challenges/challenge-catalog";
import { challengeCounts, codingChallenges } from "@/lib/challenges";

export const metadata: Metadata = {
  title: "Coding Challenges — BrainHub",
  description: "Solve 120 algorithm and 30 low-level design challenges in Python, Java, and C++.",
};

export default function ChallengesPage() {
  const challengeSummaries = codingChallenges.map(
    ({ number, slug, title, difficulty, category, topics, summary }) => ({
      number,
      slug,
      title,
      difficulty,
      category,
      topics,
      summary,
    }),
  );

  return (
    <div>
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-[#8995a7] hover:text-white">
        ← BrainHub training floor
      </Link>
      <section className="grid gap-7 lg:grid-cols-[1fr_420px]">
        <div>
          <p className="metric mb-4 text-[#c084fc]">Coding challenges</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-.04em] sm:text-6xl">
            Read the problem.
            <br />
            <span className="text-[#778398]">Prove the solution.</span>
          </h1>
          <p className="mt-5 max-w-2xl leading-7 text-[#98a4b5]">
            One hundred twenty researched algorithm challenges plus thirty low-level design exercises, with
            original wording, twenty tests each, language-specific starter code, real execution, and visible
            stdout. Every algorithm selection sits outside the NeetCode 150.
          </p>
        </div>
        <div className="panel grid grid-cols-2 gap-px overflow-hidden bg-[#202937]">
          <ChallengeMetric icon={CodeXml} value={challengeCounts.total} label="Challenges" />
          <ChallengeMetric icon={Layers3} value={challengeCounts.algorithms} label="Algorithms" />
          <ChallengeMetric icon={Blocks} value={challengeCounts.designs} label="LLD problems" />
          <ChallengeMetric icon={TerminalSquare} value="3" label="Languages" />
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="metric text-[#c084fc]">Problem library</p>
            <h2 className="mt-1 text-2xl font-semibold">
              {challengeCounts.easy} Easy · {challengeCounts.medium} Medium · {challengeCounts.hard} Hard ·{" "}
              {challengeCounts.designs} Design
            </h2>
          </div>
          <p className="max-w-lg text-right text-xs leading-5 text-[#66758a]">
            Algorithm metadata was checked against LeetCode and the current NeetCode 150 catalog. LLD
            scenarios, all problem prose, and all tests are original BrainHub material.
          </p>
        </div>
        <ChallengeCatalog challenges={challengeSummaries} />
      </section>
    </div>
  );
}

function ChallengeMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof CodeXml;
  value: string | number;
  label: string;
}) {
  return (
    <div className="bg-[#0d1118] p-5">
      <Icon size={17} className="mb-5 text-[#657287]" />
      <p className="text-2xl font-semibold">{value}</p>
      <p className="metric mt-1">{label}</p>
    </div>
  );
}
