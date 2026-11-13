import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssessmentPanel } from "@/components/roadmaps/assessment-panel";
import { learningRoadmaps, roadmapMap } from "@/lib/roadmaps";

export const dynamicParams = false;
export function generateStaticParams() {
  return learningRoadmaps.map((roadmap) => ({ slug: roadmap.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${roadmapMap[slug]?.title ?? "Mathematics"} Foundation Diagnostic — BrainHub`,
    description:
      "Sample the six authored foundation lessons, then verify your next steps with full independent practice.",
  };
}

export default async function DiagnosticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const roadmap = roadmapMap[slug];
  if (!roadmap) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <nav className="flex flex-wrap gap-5 text-sm text-[#93a8c1]" aria-label="Diagnostic navigation">
        <Link href={`/roadmaps/${slug}`}>← {roadmap.title} curriculum</Link>
        <Link href="/roadmaps/learning">Your learning dashboard</Link>
      </nav>
      <header className="panel p-6 sm:p-8">
        <p className="metric" style={{ color: roadmap.accent }}>
          Find a foundation starting point
        </p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">{roadmap.title} foundation diagnostic</h1>
        <p className="mt-4 leading-8 text-[#a6b6cb]">
          Answer a limited sample of 12 questions from the six authored foundation lessons: one foundation
          question and one core question per lesson. The diagnostic has no hints. Worked feedback and
          suggested study priorities appear after submission.
        </p>
        <p className="mt-4 rounded-xl border border-[#675530] p-4 text-sm leading-7 text-[#d9c699]">
          This sample guides your next study step. Completing it does not complete a lesson or unlock the
          stage exam. Verify each recommendation with that lesson&apos;s full eight-question independent
          practice set.
        </p>
        <p className="mt-4 text-sm leading-7 text-[#91a4bb]">
          This diagnostic covers the existing foundation lessons. Advanced roadmap topics remain curriculum
          outlines.
        </p>
      </header>
      <AssessmentPanel key={`${slug}:diagnostic:0`} roadmapSlug={slug} mode="diagnostic" />
    </div>
  );
}
