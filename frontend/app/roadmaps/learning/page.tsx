import type { Metadata } from "next";
import Link from "next/link";
import { LearningDashboard } from "@/components/roadmaps/learning-dashboard";

export const metadata: Metadata = {
  title: "Your Mathematics Learning — BrainHub",
  description:
    "Continue saved mathematics sessions, review due questions, and choose your next independent practice lesson.",
};

export default function LearningPage() {
  return (
    <div>
      <nav className="mb-7 flex flex-wrap gap-5 text-sm text-[#a6b6cb]" aria-label="Learning destinations">
        <Link href="/roadmaps">All roadmaps</Link>
        <Link href="/roadmaps/review">Daily review</Link>
        <Link href="/roadmaps/notebook">Mathematics notebook</Link>
      </nav>
      <header className="mb-8 max-w-3xl">
        <p className="metric text-[#63e6be]">Your mathematics learning</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] sm:text-6xl">
          Know what to work on next.
        </h1>
        <p className="mt-4 leading-7 text-[#98a4b5]">
          Bring your recall schedule, unfinished work, independent performance, and assessment history
          together. Every subject keeps its own path through the foundations.
        </p>
      </header>
      <LearningDashboard />
    </div>
  );
}
