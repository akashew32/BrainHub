import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { LessonWorkspace } from "@/components/roadmaps/lesson-workspace";
import {
  getAdjacentLessons,
  getRoadmapLesson,
  roadmapLessonMap,
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
      <LessonWorkspace
        lesson={lesson}
        roadmap={roadmap}
        previous={navItem(adjacent.previous)}
        next={navItem(adjacent.next)}
        prerequisites={lesson.prerequisiteIds.map((id) => {
          const prerequisite = roadmapLessonMap[id]!;
          return {
            title: prerequisite.title,
            href: `/roadmaps/${prerequisite.roadmapSlug}/${prerequisite.topicSlug}`,
          };
        })}
      />
    </div>
  );
}
