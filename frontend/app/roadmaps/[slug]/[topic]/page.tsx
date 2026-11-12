import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AuthoredLesson } from "@/components/roadmaps/authored-lesson";
import {
  getAdjacentLessons,
  getRoadmapLesson,
  roadmapLessons,
  type RoadmapLesson,
} from "@/lib/roadmap-lessons";
import { roadmapMap } from "@/lib/roadmaps";

export const dynamicParams = false;

export function generateStaticParams() {
  return roadmapLessons.map((lesson) => ({ slug: lesson.roadmapSlug, topic: lesson.topicSlug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; topic: string }>;
}): Promise<Metadata> {
  const { slug, topic } = await params;
  const lesson = getRoadmapLesson(slug, topic);
  if (!lesson) return {};
  return {
    title: `${lesson.title} · ${lesson.roadmapTitle} — BrainHub`,
    description: lesson.summary,
  };
}

function navItem(lesson: RoadmapLesson | null) {
  return lesson
    ? {
        title: lesson.title,
        href: `/roadmaps/${lesson.roadmapSlug}/${lesson.topicSlug}`,
        stageIndex: lesson.stageIndex,
      }
    : null;
}

export default async function RoadmapLessonPage({
  params,
}: {
  params: Promise<{ slug: string; topic: string }>;
}) {
  const { slug, topic } = await params;
  const lesson = getRoadmapLesson(slug, topic);
  const roadmap = roadmapMap[slug];
  if (!lesson || !roadmap) notFound();
  const adjacent = getAdjacentLessons(lesson);

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-2 text-sm text-[#7f8b9d]">
        <Link className="hover:text-white" href="/roadmaps">
          Roadmaps
        </Link>
        <ChevronRight size={13} />
        <Link className="hover:text-white" href={`/roadmaps/${roadmap.slug}`}>
          {roadmap.title}
        </Link>
        <ChevronRight size={13} />
        <span aria-current="page" className="text-[#c2cad4]">
          {lesson.title}
        </span>
      </nav>
      {lesson.stageIndex === 0 ? (
        <AuthoredLesson
          key={slug + ":" + topic}
          roadmapSlug={slug}
          topicSlug={topic}
          accent={roadmap.accent}
        />
      ) : (
        <section className="panel p-8 sm:p-12">
          <p className="metric" style={{ color: roadmap.accent }}>
            Stage {lesson.stageIndex + 1} · Curriculum outline
          </p>
          <h1 className="mt-3 text-4xl font-semibold">{lesson.title}</h1>
          <p className="mt-5 leading-8 text-[#a4b4c8]">{lesson.summary}</p>
          <p className="mt-4 leading-8 text-[#a4b4c8]">
            The authored release currently covers the first six lessons in each subject. This advanced topic
            is a study outline; worked lessons and graded assessments will be added in a later curriculum
            release.
          </p>
          <h2 className="mt-6 text-xl font-semibold">Stage learning goal</h2>
          <p className="mt-3 leading-8 text-[#a4b4c8]">{roadmap.stages[lesson.stageIndex]!.checkpoint}</p>
          <Link className="btn mt-6 inline-block" href={`/roadmaps/${slug}`}>
            Return to the curriculum
          </Link>
        </section>
      )}
      <nav className="mt-6 flex flex-wrap justify-between gap-4" aria-label="Lesson navigation">
        {[navItem(adjacent.previous), navItem(adjacent.next)].map((item) =>
          item ? (
            <Link key={item.href} className="btn" href={item.href}>
              {item.title}
            </Link>
          ) : null,
        )}
      </nav>
    </div>
  );
}
