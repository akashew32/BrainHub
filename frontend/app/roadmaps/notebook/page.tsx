import type { Metadata } from "next";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { MistakeNotebook } from "@/components/roadmaps/mistake-notebook";

export const metadata: Metadata = {
  title: "Mathematics Notebook — BrainHub",
  description:
    "Keep your historical feedback, personal reflections, and independent concept performance together.",
};

export default function NotebookPage() {
  return (
    <div>
      <div className="mb-7 flex flex-wrap gap-5 text-sm text-[#a6b6cb]">
        <Link href="/roadmaps">← All roadmaps</Link>
        <Link href="/roadmaps/review">Daily review plan →</Link>
      </div>
      <section className="mb-8 max-w-3xl">
        <p className="metric flex items-center gap-2 text-[#c084fc]">
          <NotebookPen size={15} /> Mathematics notebook
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] sm:text-6xl">
          Make each mistake useful.
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#98a4b5]">
          Keep the reasoning behind your progress. Revisit your own completed attempts, record what changed
          your understanding, and see how independently you solve each concept.
        </p>
      </section>
      <MistakeNotebook />
    </div>
  );
}
