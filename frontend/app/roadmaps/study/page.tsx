import type { Metadata } from "next";
import Link from "next/link";
import { StudyPlanner } from "@/components/roadmaps/study-planner";

export const metadata: Metadata = {
  title: "Plan Your Mathematics Study — BrainHub",
  description:
    "Choose a manageable study budget, save your preferences, and follow your recorded daily study time.",
};

export default function StudyPage() {
  return (
    <div className="space-y-7">
      <nav className="flex flex-wrap gap-5 text-sm text-[#93a8c1]" aria-label="Study planning navigation">
        <Link href="/roadmaps/learning">← Learning dashboard</Link>
        <Link href="/roadmaps/review">Daily review</Link>
        <Link href="/roadmaps/sessions">Saved sessions</Link>
      </nav>
      <header className="max-w-3xl">
        <p className="metric text-[#63e6be]">A manageable next set</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Make time for the next step.</h1>
        <p className="mt-4 leading-7 text-[#98a4b5]">
          Plan a five- or ten-minute study set, or choose a longer budget. Work on one subject at a time, with
          due recall and independent practice guiding the selection.
        </p>
      </header>
      <StudyPlanner />
    </div>
  );
}
