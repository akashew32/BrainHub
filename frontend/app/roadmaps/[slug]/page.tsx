import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleDot, Flag, Layers3, Network } from "lucide-react";
import { learningRoadmaps, roadmapMap } from "@/lib/roadmaps";

export function generateStaticParams() {
  return learningRoadmaps.map((roadmap) => ({ slug: roadmap.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const roadmap = roadmapMap[slug];
  if (!roadmap) return {};
  return {
    title: `${roadmap.title} Roadmap — BrainHub`,
    description: roadmap.description,
  };
}

export default async function RoadmapDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const roadmap = roadmapMap[slug];
  if (!roadmap) notFound();

  const topicCount = roadmap.stages.reduce((total, stage) => total + stage.topics.length, 0);
  const roadmapIndex = learningRoadmaps.findIndex((item) => item.slug === roadmap.slug);
  const previous = learningRoadmaps[(roadmapIndex - 1 + learningRoadmaps.length) % learningRoadmaps.length]!;
  const next = learningRoadmaps[(roadmapIndex + 1) % learningRoadmaps.length]!;

  return (
    <div>
      <Link
        href="/roadmaps"
        className="mb-8 inline-flex items-center gap-2 text-sm text-[#8995a7] hover:text-white"
      >
        <ArrowLeft size={15} /> All roadmaps
      </Link>

      <section className="panel relative overflow-hidden p-6 sm:p-9">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px"
          style={{ backgroundColor: roadmap.accent }}
        />
        <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="metric" style={{ color: roadmap.accent }}>
              Curriculum outline · Foundation to graduate
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-.04em] sm:text-6xl">{roadmap.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#a5afbd] sm:text-base">
              {roadmap.description}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SummaryMetric icon={Layers3} value={roadmap.stages.length} label="Stages" />
            <SummaryMetric icon={Network} value={topicCount} label="Topics" />
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <GuidancePanel title="Start with" items={roadmap.prerequisites} accent={roadmap.accent} />
        <GuidancePanel title="Finish able to" items={roadmap.outcomes} accent={roadmap.accent} />
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="self-start lg:sticky lg:top-24">
          <div className="panel p-5">
            <p className="metric" style={{ color: roadmap.accent }}>
              Track sequence
            </p>
            <nav aria-label={`${roadmap.title} roadmap stages`} className="mt-4">
              <ol className="space-y-1">
                {roadmap.stages.map((stage, index) => (
                  <li key={stage.title}>
                    <a
                      className="group flex items-start gap-3 rounded-lg px-2 py-2 text-sm text-[#8f9bab] hover:bg-[#151c27] hover:text-white"
                      href={`#stage-${index + 1}`}
                    >
                      <span className="mt-0.5 font-mono text-xs" style={{ color: roadmap.accent }}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{stage.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </aside>

        <section aria-labelledby="roadmap-outline-title" className="min-w-0">
          <div className="mb-5">
            <p className="metric" style={{ color: roadmap.accent }}>
              Complete outline
            </p>
            <h2 className="mt-1 text-2xl font-semibold" id="roadmap-outline-title">
              Study in dependency order
            </h2>
          </div>

          <ol className="space-y-5">
            {roadmap.stages.map((stage, stageIndex) => (
              <li
                className="panel scroll-mt-24 overflow-hidden"
                id={`stage-${stageIndex + 1}`}
                key={stage.title}
              >
                <div className="grid md:grid-cols-[92px_minmax(0,1fr)]">
                  <div className="border-b border-[#202937] p-5 md:border-b-0 md:border-r">
                    <p className="font-mono text-2xl font-semibold" style={{ color: roadmap.accent }}>
                      {String(stageIndex + 1).padStart(2, "0")}
                    </p>
                    <p className="metric mt-2">Stage</p>
                  </div>
                  <article className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="metric" style={{ color: roadmap.accent }}>
                          {stage.level}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold sm:text-2xl">{stage.title}</h3>
                      </div>
                      <span className="rounded-full border border-[#2e3a4d] bg-[#111823] px-3 py-1 text-xs text-[#91a0b3]">
                        {stage.topics.length} topics
                      </span>
                    </div>
                    <p className="mt-3 leading-7 text-[#9ca8b8]">{stage.description}</p>

                    <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                      {stage.topics.map((topic) => (
                        <li
                          className="flex gap-3 rounded-lg border border-[#202937] bg-[#090d13] px-3 py-2.5 text-sm text-[#bec7d2]"
                          key={topic}
                        >
                          <CircleDot
                            className="mt-0.5 shrink-0"
                            size={14}
                            style={{ color: roadmap.accent }}
                          />
                          <span>{topic}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-5 flex gap-3 rounded-xl border border-[#293548] bg-[#101722] p-4">
                      <Flag className="mt-0.5 shrink-0" size={17} style={{ color: roadmap.accent }} />
                      <div>
                        <p className="metric">Readiness checkpoint</p>
                        <p className="mt-1 text-sm leading-6 text-[#aeb8c6]">{stage.checkpoint}</p>
                      </div>
                    </div>
                  </article>
                </div>
              </li>
            ))}
          </ol>

          <div className="panel mt-5 p-5 sm:p-6">
            <div className="flex gap-3">
              <Check className="mt-0.5 shrink-0" size={18} style={{ color: roadmap.accent }} />
              <div>
                <h2 className="font-semibold">How to use this outline</h2>
                <p className="mt-2 text-sm leading-6 text-[#8995a7]">
                  Treat each checkpoint as a mastery gate. Study definitions and examples, solve proof and
                  computational exercises, then complete the checkpoint without notes before advancing. The
                  roadmap establishes scope and order; interactive lessons and progress tracking are separate
                  future features.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <nav aria-label="Other mathematics roadmaps" className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link className="panel group p-5 hover:border-[#40516a]" href={`/roadmaps/${previous.slug}`}>
          <p className="metric">Previous track</p>
          <p className="mt-2 flex items-center gap-2 font-semibold">
            <ArrowLeft size={15} className="transition group-hover:-translate-x-1" /> {previous.title}
          </p>
        </Link>
        <Link className="panel group p-5 text-right hover:border-[#40516a]" href={`/roadmaps/${next.slug}`}>
          <p className="metric">Next track</p>
          <p className="mt-2 flex items-center justify-end gap-2 font-semibold">
            {next.title} <ArrowRight size={15} className="transition group-hover:translate-x-1" />
          </p>
        </Link>
      </nav>
    </div>
  );
}

function SummaryMetric({ icon: Icon, value, label }: { icon: typeof Layers3; value: number; label: string }) {
  return (
    <div className="rounded-xl border border-[#263246] bg-[#090d13] p-4">
      <Icon size={15} className="mb-4 text-[#66758a]" />
      <p className="text-2xl font-semibold">{value}</p>
      <p className="metric mt-1">{label}</p>
    </div>
  );
}

function GuidancePanel({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  return (
    <div className="panel p-5 sm:p-6">
      <p className="metric" style={{ color: accent }}>
        {title}
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li className="flex gap-2 text-sm leading-6 text-[#aeb8c6]" key={item}>
            <Check className="mt-1 shrink-0" size={14} style={{ color: accent }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
