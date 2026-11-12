import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { MistakeReview } from "@/components/roadmaps/mistake-review";

export const metadata: Metadata = {
  title: "Roadmap Review Queue — BrainHub",
  description: "Continue unfinished mathematics lessons and revisit weak or aging concepts.",
};

export default function RoadmapReviewPage() {
  return (
    <div>
      <Link
        className="mb-7 inline-flex items-center gap-2 text-sm text-[#8995a7] hover:text-white"
        href="/roadmaps"
      >
        <ArrowLeft size={15} /> All roadmaps
      </Link>
      <section className="mb-8 max-w-3xl">
        <p className="metric flex items-center gap-2 text-[#c084fc]">
          <RotateCcw size={15} /> Adaptive review
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] sm:text-6xl">
          Return at the right time.
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#98a4b5]">
          Practice the concepts behind your recent mistakes. Recommendations use individual answers and
          retrieval dates, so revisiting a lesson page does not reset your review schedule.
        </p>
      </section>
      <MistakeReview />
    </div>
  );
}
