import type { AssessmentResult } from "@/lib/curriculum";

export function StudyFeedback({ result }: { result: AssessmentResult }) {
  const summary = result.study_summary;
  if (!summary) return <p role="alert">Study feedback could not be verified. Your answers remain saved.</p>;
  const independent = result.feedback.filter((item) => item.correct && item.hints_used === 0).length;
  const assisted = result.feedback.filter(
    (item) => typeof item.hints_used === "number" && item.hints_used > 0,
  ).length;
  return (
    <section
      className="rounded-xl border border-[#35556e] bg-[#101e2a] p-5"
      aria-labelledby="study-feedback-heading"
    >
      <h3 className="text-xl font-semibold" id="study-feedback-heading">
        Study set complete
      </h3>
      <p className="mt-3 font-semibold" role="status">
        Practice accuracy: {result.score}% · {result.correct}/{result.total} correct
      </p>
      <p className="mt-3 text-sm leading-7 text-[#b6c8d9]">{summary.notice}</p>
      <p className="mt-3 text-sm leading-7 text-[#b6c8d9]">
        {independent} independently correct · {assisted} answer{assisted === 1 ? "" : "s"} with hints
      </p>
      <p className="mt-3 text-sm leading-7 text-[#a6b6cb]">
        {summary.reason_counts.due} due recall · {summary.reason_counts.weak} concepts to strengthen ·{" "}
        {summary.reason_counts.next} next-lesson questions
      </p>
      <p className="mt-3 text-sm leading-7 text-[#a6b6cb]">
        Use the worked feedback to choose your next step. A full lesson practice set establishes independent
        lesson readiness.
      </p>
    </section>
  );
}
