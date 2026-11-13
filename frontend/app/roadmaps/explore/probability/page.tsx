import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CountingLab } from "@/components/roadmaps/counting-lab";
import { countingExperimentForTopic } from "@/lib/roadmap-explorations";

export const metadata: Metadata = {
  title: "Counting Lab — BrainHub",
  description:
    "Predict exact counts and inspect finite constructions for choices, selections, repeated symbols, labelled allocations, inclusion–exclusion and sharp pigeonhole bounds.",
};

export default async function CountingLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const mode = countingExperimentForTopic(query.lesson);
  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm text-[#9eacc0] hover:text-white"
        href="/roadmaps/probability"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Probability curriculum
      </Link>
      <header className="panel p-6 sm:p-9">
        <p className="metric text-[#8ac3ff]">Predict, construct, explain · Finite counting models</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Counting Lab</h1>
        <p className="mt-4 max-w-3xl leading-8 text-[#a6b7cc]">
          Explore six constructions connected to the authored probability foundation lessons. Predict an exact
          count, reveal the construction, and explain the assumptions that make it work.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#91a4bb]">
          This exploration stays in the open page. It does not save a score, record study time, complete
          lessons, or unlock exams. Return to the linked lesson for server-graded practice. A displayed
          outcome list may be partial; a pigeonhole witness is one construction, not a list of all
          assignments.
        </p>
      </header>
      <CountingLab key={mode} initialMode={mode} />
    </div>
  );
}
