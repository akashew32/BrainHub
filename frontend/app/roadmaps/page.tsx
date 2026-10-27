import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CircleDashed, Clock3, Map, Route } from "lucide-react";

export const metadata: Metadata = {
  title: "Learning Roadmaps — BrainHub",
  description: "Coming-soon learning roadmaps for five core mathematical subjects.",
};

const roadmaps = [
  {
    title: "Probability",
    description: "From counting and conditional probability through random variables and convergence.",
  },
  {
    title: "Linear Algebra",
    description: "Vectors, transformations, decompositions, geometry, and numerical foundations.",
  },
  {
    title: "Calculus",
    description: "Limits, derivatives, integrals, multivariable methods, and differential equations.",
  },
  {
    title: "Real Analysis",
    description: "Rigorous limits, continuity, sequences, series, differentiation, and integration.",
  },
  {
    title: "Discrete Math",
    description: "Logic, proofs, combinatorics, graph theory, recurrences, and discrete structures.",
  },
] as const;

export default function RoadmapsPage() {
  return (
    <div>
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-[#8995a7] hover:text-white">
        ← BrainHub training floor
      </Link>

      <section className="grid gap-7 lg:grid-cols-[1fr_420px]">
        <div>
          <p className="metric mb-4 flex items-center gap-2 text-[#60a5fa]">
            <Map size={15} /> Learning roadmaps
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-.04em] sm:text-6xl">
            Know what comes next.
            <br />
            <span className="text-[#778398]">Build the foundation.</span>
          </h1>
          <p className="mt-5 max-w-2xl leading-7 text-[#98a4b5]">
            Five structured mathematics tracks are planned for BrainHub. Their curricula are intentionally not
            implemented yet; this page is the launch point for future guided learning paths.
          </p>
        </div>

        <div className="panel grid grid-cols-2 gap-px overflow-hidden bg-[#202937]">
          <RoadmapMetric icon={Route} value="5" label="Planned tracks" />
          <RoadmapMetric icon={CircleDashed} value="0" label="Published" />
          <RoadmapMetric icon={BookOpen} value="—" label="Lessons" />
          <RoadmapMetric icon={Clock3} value="Soon" label="Status" />
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-5">
          <p className="metric text-[#60a5fa]">Planned curriculum</p>
          <h2 className="mt-1 text-2xl font-semibold">Choose a future learning track</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roadmaps.map((roadmap, index) => (
            <article className="panel relative overflow-hidden p-6" key={roadmap.title}>
              <div className="absolute right-5 top-5 font-mono text-xs text-[#465267]">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="mb-8 inline-flex rounded-xl border border-[#2a3a50] bg-[#111a27] p-3 text-[#60a5fa]">
                <BookOpen size={20} />
              </div>
              <h3 className="text-xl font-semibold">{roadmap.title}</h3>
              <p className="mt-3 min-h-18 text-sm leading-6 text-[#8995a7]">{roadmap.description}</p>
              <div className="mt-6 flex items-center justify-between border-t border-[#202937] pt-4">
                <span className="metric">Roadmap unavailable</span>
                <span className="rounded-full border border-[#334155] px-3 py-1 text-xs text-[#94a3b8]">
                  Coming soon
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function RoadmapMetric({ icon: Icon, value, label }: { icon: typeof Map; value: string; label: string }) {
  return (
    <div className="bg-[#0d1118] p-5">
      <Icon size={17} className="mb-5 text-[#657287]" />
      <p className="text-2xl font-semibold">{value}</p>
      <p className="metric mt-1">{label}</p>
    </div>
  );
}
