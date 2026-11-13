import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FunctionLab } from "@/components/roadmaps/function-lab";
import { functionExperimentForTopic } from "@/lib/roadmap-explorations";

export const metadata: Metadata = {
  title: "Function and Sequence Lab — BrainHub",
  description:
    "Predict function values, domains, transformed coordinates and exact eventual-accuracy indices using bounded families from the calculus foundation lessons.",
};
export default async function FunctionLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const mode = functionExperimentForTopic(query.lesson);
  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm text-[#9eacc0] hover:text-white"
        href="/roadmaps/calculus"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Calculus curriculum
      </Link>
      <header className="panel p-6 sm:p-9">
        <p className="metric text-[#c4b5fd]">Predict, inspect, explain · Functions and sequence families</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Function and Sequence Lab</h1>
        <p className="mt-4 max-w-3xl leading-8 text-[#a6b7cc]">
          Explore six experiments connected to the authored calculus foundation lessons. State a prediction,
          inspect the domain and calculation, then explain why the result follows.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#91a4bb]">
          Plots are sampled illustrations in a labelled window. Algebra establishes the fixed-family domain
          and sequence guarantees; a finite picture is not a proof of a limit. This lab stays in the open page
          and does not save scores, record study time, complete lessons, or unlock exams.
        </p>
      </header>
      <FunctionLab key={mode} initialMode={mode} />
    </div>
  );
}
