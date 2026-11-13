import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExamReadiness } from "@/components/roadmaps/exam-readiness";
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
          Earn at least 75% independent practice in every lesson to start a new exam. There are no hints, and
          solutions are revealed after submission. Existing exams can still be resumed.
        </p>
        <Link className="mt-4 inline-block text-sm text-[#c4a5ff]" href={`/roadmaps/${slug}/diagnostic`}>
          Need a starting point? Try the foundation diagnostic sample →
        </Link>
      </header>
      <ExamReadiness roadmapSlug={slug} />
    </div>
  );
}
