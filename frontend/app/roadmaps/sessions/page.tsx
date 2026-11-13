import type { Metadata } from "next";
import Link from "next/link";
import { AssessmentHistory } from "@/components/roadmaps/assessment-history";

export const metadata: Metadata = {
  title: "Mathematics Assessment History — BrainHub",
  description: "Find and reopen your saved mathematics assignments and completed feedback.",
};

export default function AssessmentSessionsPage() {
  return (
    <div className="space-y-7">
      <nav className="flex flex-wrap gap-5 text-sm text-[#a6b6cb]" aria-label="Assessment history navigation">
        <Link href="/roadmaps/learning">← Your learning dashboard</Link>
        <Link href="/roadmaps">All roadmaps</Link>
      </nav>
      <header>
        <p className="metric text-[#c084fc]">Your saved work</p>
        <h1 className="mt-3 text-4xl font-semibold">Assessment history</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#98a4b5]">
          Continue an active draft or revisit the feedback from a completed assignment. Opening a session
          keeps its original questions and saved answers.
        </p>
      </header>
      <AssessmentHistory />
    </div>
  );
}
