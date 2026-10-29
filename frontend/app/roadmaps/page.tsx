import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, Layers3, Map, Network } from "lucide-react";
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
            Exhaustive outlines for five mathematical foundations, sequenced from prerequisites through
            advanced undergraduate and graduate-level frontiers. Each stage states what to study and what you
            should be able to prove or build before moving on.
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
            These are curriculum outlines, not completed lessons. Use each page as a dependency-aware study
            map and readiness checklist.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {learningRoadmaps.map((roadmap, index) => {
            const topicCount = roadmap.stages.reduce((total, stage) => total + stage.topics.length, 0);
            return (
              <Link
                className="panel group relative overflow-hidden p-6 transition hover:-translate-y-1 hover:border-[#40516a]"
                href={`/roadmaps/${roadmap.slug}`}
                key={roadmap.slug}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-px opacity-80"
                  style={{ backgroundColor: roadmap.accent }}
                />
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="inline-flex rounded-xl border bg-[#111a27] p-3"
                    style={{ borderColor: `${roadmap.accent}55`, color: roadmap.accent }}
                  >
                    <BookOpenCheck size={20} />
                  </div>
                  <span className="font-mono text-xs text-[#465267]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="metric mt-8" style={{ color: roadmap.accent }}>
                  {roadmap.eyebrow}
                </p>
                <h3 className="mt-2 text-2xl font-semibold">{roadmap.title}</h3>
                <p className="mt-3 min-h-24 text-sm leading-6 text-[#8995a7]">{roadmap.description}</p>
                <div className="mt-6 grid grid-cols-2 gap-3 border-y border-[#202937] py-4">
                  <div>
                    <p className="text-lg font-semibold">{roadmap.stages.length}</p>
                    <p className="metric">Stages</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{topicCount}</p>
                    <p className="metric">Topics</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="text-[#94a3b8]">Foundation → Graduate</span>
                  <span
                    className="flex items-center gap-1 font-semibold group-hover:text-white"
                    style={{ color: roadmap.accent }}
                  >
                    View outline <ArrowUpRight size={15} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
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
