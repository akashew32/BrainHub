import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogicLab } from "@/components/roadmaps/logic-lab";
import { logicExperimentForTopic } from "@/lib/roadmap-explorations";

export const metadata: Metadata = {
  title: "Logic and Proof Lab — BrainHub",
  description:
    "Explore quantifiers, counterexamples, proof dependencies, induction, finite maps, diagonal arguments, bounds and invariants with precise domains and explicit reasoning.",
};

export default async function LogicLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const subject =
    query.subject === "real-analysis" || query.subject === "discrete-math" ? query.subject : null;
  const mode = logicExperimentForTopic(query.lesson, query.subject);
  return (
    <div className="space-y-6">
      <nav aria-label="Logic lab curricula" className="flex flex-wrap gap-x-6 gap-y-2">
        {(!subject || subject === "real-analysis") && (
          <Link
            href="/roadmaps/real-analysis"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-[#9eacc0] hover:text-white"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Real analysis curriculum
          </Link>
        )}
        {(!subject || subject === "discrete-math") && (
          <Link
            href="/roadmaps/discrete-math"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-[#9eacc0] hover:text-white"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Discrete math curriculum
          </Link>
        )}
      </nav>
      <header className="panel p-6 sm:p-9">
        <p className="metric text-[#fbbf24]">State the domain · Find a witness · Justify the claim</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Logic and Proof Lab</h1>
        <p className="mt-4 max-w-3xl leading-8 text-[#a6b7cc]">
          Explore nine constructions connected to the real analysis and discrete math foundations. Make a
          prediction, inspect a complete finite model or an explicit argument, then explain which assumptions
          the conclusion needs.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#91a4bb]">
          Finite checks settle claims about the stated finite domains. A universal claim about an infinite set
          needs an argument covering that domain; one valid counterexample is enough to refute it. This local
          lab does not save scores, record study time, complete lessons, or unlock exams.
        </p>
      </header>
      <LogicLab key={`${subject ?? "all"}:${mode}`} initialMode={mode} />
    </div>
  );
}
