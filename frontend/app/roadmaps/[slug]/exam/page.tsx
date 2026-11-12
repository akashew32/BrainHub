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
  return { title: `${roadmapMap[slug]?.title ?? "Mathematics"} Stage Exam — BrainHub` };
}
export default async function StageExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const roadmap = roadmapMap[slug];
  if (!roadmap) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <Link className="mb-6 inline-block text-sm text-[#93a8c1]" href={`/roadmaps/${slug}`}>
        ← {roadmap.title} curriculum
      </Link>
      <header className="mb-7">
        <p className="metric" style={{ color: roadmap.accent }}>
          Foundation checkpoint
        </p>
        <h1 className="mt-3 text-4xl font-semibold">{roadmap.title}: stage 1 exam</h1>
        <p className="mt-4 leading-8 text-[#9fb1c7]">
          {roadmap.stages[0]!.checkpoint} The exam draws two reserved questions from each of the six lessons.
          Solutions are revealed only after submission.
        </p>
      </header>
      <AssessmentPanel key={slug + ":exam:0"} roadmapSlug={slug} mode="exam" />
    </div>
  );
}
