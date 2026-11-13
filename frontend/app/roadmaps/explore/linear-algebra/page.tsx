import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LinearAlgebraLab } from "@/components/roadmaps/linear-algebra-lab";
import { experimentForTopic } from "@/lib/roadmap-explorations";

export const metadata: Metadata = {
  title: "Linear Algebra Lab — BrainHub",
  description:
    "Predict and explore vectors, projections, matrix products, linear maps, geometric transformations and affine displacements in two dimensions.",
};

export default async function LinearAlgebraLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const mode = experimentForTopic(query.lesson);
  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm text-[#9eacc0] hover:text-white"
        href="/roadmaps/linear-algebra"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Linear Algebra curriculum
      </Link>
      <header className="panel p-6 sm:p-9">
        <p className="metric text-[#63e6be]">Predict, experiment, explain · Two dimensions</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Linear Algebra Lab</h1>
        <p className="mt-4 max-w-3xl leading-8 text-[#a6b7cc]">
          Make a coordinate prediction, reveal the calculation, and explain what changed. Explore six
          experiments connected to the authored foundation lessons.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#91a4bb]">
          This exploration stays in your browser for this visit. It does not save a score, record study time,
          complete lessons, or unlock exams. Return to the linked lesson for server-graded practice. All
          diagrams use a two-dimensional coordinate plane.
        </p>
      </header>
      <LinearAlgebraLab key={mode} initialMode={mode} />
    </div>
  );
}
