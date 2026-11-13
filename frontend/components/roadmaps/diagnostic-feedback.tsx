import Link from "next/link";
import type { AssessmentResult } from "@/lib/curriculum";
import { DIAGNOSTIC_SAMPLE } from "@/lib/assessment-modes";

const priorityLabels = {
  start_here: "Start here",
  review: "Review this lesson",
  verify: "Verify with full practice",
};

export function DiagnosticFeedback({ result }: { result: AssessmentResult }) {
  const summary = result.diagnostic_summary;
  if (!summary)
    return <p role="alert">Diagnostic guidance could not be verified. Your answers remain saved.</p>;
  return (
    <section
      className="rounded-xl border border-[#35556e] bg-[#101e2a] p-5"
      aria-labelledby="diagnostic-feedback-heading"
    >
      <h3 className="text-xl font-semibold" id="diagnostic-feedback-heading">
        Diagnostic complete
      </h3>
      <p className="mt-3 font-semibold" role="status">
        Sample accuracy: {result.score}% · {result.correct}/{result.total} correct
      </p>
      <p className="mt-3 text-sm leading-7 text-[#b6c8d9]">{summary.notice}</p>
      <p className="mt-3 text-sm leading-7 text-[#a6b6cb]">
        Two questions per lesson give limited evidence. Continue with each lesson’s full{" "}
        {DIAGNOSTIC_SAMPLE.fullPractice}-question practice set to build independent evidence.
      </p>
      <ol className="mt-5 space-y-4" aria-label="Diagnostic topic guidance">
        {summary.topics.map((topic) => (
          <li className="rounded-xl border border-[#344658] p-4" key={topic.topic_slug}>
            <h4 className="font-semibold">{topic.title}</h4>
            <p className="mt-2 text-sm text-[#9fc5df]">
              {topic.correct}/{topic.total} in this sample · {priorityLabels[topic.priority]}
            </p>
            <p className="mt-2 text-sm leading-7 text-[#b6c8d9]">{topic.guidance}</p>
            {topic.study_url ? (
              <Link className="mt-3 inline-block text-sm font-semibold text-[#8dc8ff]" href={topic.study_url}>
                Open full lesson practice →
              </Link>
            ) : (
              <p className="mt-3 text-sm text-[#b8a789]">
                This historical lesson is archived. Its sample feedback remains available.
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
