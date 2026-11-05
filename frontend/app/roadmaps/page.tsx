import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, Layers3, Map, Network } from "lucide-react";
import { RoadmapCatalog } from "@/components/roadmaps/roadmap-catalog";
import { learningRoadmaps, roadmapCounts } from "@/lib/roadmaps";

export const metadata: Metadata = {
  title: "Learning Roadmaps — BrainHub",
  description:
    "Exhaustive mathematics roadmaps from foundations through advanced probability, algebra, calculus, analysis, and discrete mathematics.",
};

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
            See the whole field.
            <br />
            <span className="text-[#778398]">Then master it in order.</span>
          </h1>
          <p className="mt-5 max-w-2xl leading-7 text-[#98a4b5]">
            Five complete, dependency-aware learning tracks with 300 interactive lessons, worked examples,
            exercises, mastery quizzes, durable progress, and review recommendations from foundations through
            graduate-level frontiers.
          </p>
        </div>

        <div className="panel grid grid-cols-2 gap-px overflow-hidden bg-[#202937]">
          <RoadmapMetric icon={Map} value={roadmapCounts.roadmaps} label="Roadmaps" />
          <RoadmapMetric icon={Layers3} value={roadmapCounts.stages} label="Stages" />
          <RoadmapMetric icon={Network} value={roadmapCounts.topics} label="Topics" />
          <RoadmapMetric icon={BookOpenCheck} value="Graduate" label="Depth" />
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="metric text-[#60a5fa]">Structured curriculum</p>
            <h2 className="mt-1 text-2xl font-semibold">Choose a mathematical track</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#778398]">
            Each lesson combines explanation with deliberate practice. Pass a stage&apos;s quizzes to unlock
            the next stage, then use the review queue to revisit weak or aging material.
          </p>
        </div>
        <RoadmapCatalog roadmaps={learningRoadmaps} />
      </section>
    </div>
  );
}

function RoadmapMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Map;
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
