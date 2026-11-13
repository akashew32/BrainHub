import type { Metadata } from "next";
import Link from "next/link";
import { TopicLibrary } from "@/components/roadmaps/topic-library";
import { parseTopicFilters } from "@/lib/roadmap-search";

export const metadata: Metadata = {
  title: "Topic Library — BrainHub",
  description:
    "Search all 300 mathematics topics, distinguish authored lessons from curriculum outlines, and save study bookmarks to your local BrainHub profile.",
};
export default async function TopicLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseTopicFilters(await searchParams);
  return (
    <div className="space-y-6">
      <nav aria-label="Topic library navigation" className="flex flex-wrap gap-x-6 gap-y-2">
        <Link
          href="/roadmaps"
          className="inline-flex min-h-11 items-center text-sm text-[#9eacc0] hover:text-white"
        >
          All roadmaps
        </Link>
        <Link
          href="/roadmaps/learning"
          className="inline-flex min-h-11 items-center text-sm text-[#9eacc0] hover:text-white"
        >
          Learning dashboard
        </Link>
      </nav>
      <header className="panel p-6 sm:p-9">
        <p className="metric text-[#60a5fa]">Find a topic · Save a study intention</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Topic Library</h1>
        <p className="mt-4 max-w-3xl leading-8 text-[#a6b7cc]">
          Search 300 topics across five mathematics roadmaps. Filter by subject, stage, level and available
          teaching content, or return to your saved study bookmarks.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#91a4bb]">
          Authored lessons include explanations and graded practice. Curriculum outlines describe later study.
          Bookmarks are saved to the current local BrainHub profile and do not record mastery or study time.
        </p>
      </header>
      <TopicLibrary initialFilters={filters} />
    </div>
  );
}
