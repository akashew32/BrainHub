import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Binary, Braces, Code2 } from "lucide-react";
import { programmingTracks } from "@/lib/programming";

export const metadata: Metadata = {
  title: "Programming Trivia — BrainHub",
  description: "Practice Java, Python, and C++ fundamentals and function calls.",
};

export default function ProgrammingPage() {
  const totalQuestions = programmingTracks.reduce((total, track) => total + track.questions.length, 0);

  return (
    <div>
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-[#8995a7] hover:text-white">
        ← Quant training floor
      </Link>
      <section className="grid gap-7 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="metric mb-4 text-[#60a5fa]">Programming desk</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-.04em] sm:text-6xl">
            Know the language.
            <br />
            <span className="text-[#778398]">Read the code precisely.</span>
          </h1>
          <p className="mt-5 max-w-2xl leading-7 text-[#98a4b5]">
            Focused multiple-choice rounds covering Java, core Python, C++, important non-ML Python libraries,
            computer architecture, and SQL. Each track balances concepts with applied behavior.
          </p>
        </div>
        <div className="panel grid grid-cols-2 gap-px overflow-hidden bg-[#202937]">
          <ProgrammingMetric icon={Code2} value={String(programmingTracks.length)} label="Tracks" />
          <ProgrammingMetric icon={Binary} value={String(totalQuestions)} label="Questions" />
          <ProgrammingMetric icon={Braces} value="2" label="Skill areas" />
          <ProgrammingMetric icon={Code2} value="10" label="Mixed round" />
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-5">
          <p className="metric text-[#60a5fa]">Choose a language</p>
          <h2 className="mt-1 text-2xl font-semibold">Programming trivia</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {programmingTracks.map((track, index) => (
            <article
              className="panel enter group relative overflow-hidden p-6"
              key={track.slug}
              style={{ animationDelay: String(index * 60) + "ms" }}
            >
              <div
                className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-10 blur-3xl"
                style={{ background: track.accent }}
              />
              <div className="flex items-start justify-between">
                <span
                  className="rounded-xl border border-[#2b3545] px-3 py-2 font-mono text-sm font-bold"
                  style={{ color: track.accent }}
                >
                  {track.badge}
                </span>
                <span className="metric">{track.questions.length} questions</span>
              </div>
              <h3 className="mt-8 text-2xl font-semibold">{track.name}</h3>
              <p className="mt-3 min-h-20 leading-7 text-[#8995a7]">{track.description}</p>
              <div className="mt-5 border-t border-[#202937] pt-4">
                <p className="metric">{track.focus}</p>
                <Link
                  href={"/programming/" + track.slug}
                  className="mt-5 flex items-center justify-between font-semibold group-hover:text-[#60a5fa]"
                  aria-label={"Practice " + track.name}
                >
                  Start trivia <ArrowUpRight size={18} />
                </Link>
              </div>
            </article>
          ))}
        </div>
        <div className="panel mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="metric text-[#c084fc]">Ready to write code?</p>
            <p className="mt-1 text-sm text-[#aeb8c6]">
              Move from trivia to 200 executable algorithm and design problems in Python, Java, or C++.
            </p>
          </div>
          <Link href="/challenges" className="btn">
            Open coding challenges <ArrowUpRight className="ml-2 inline" size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function ProgrammingMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Code2;
  value: string;
  label: string;
}) {
  return (
    <div className="bg-[#0d1118] p-5">
      <Icon size={17} className="mb-5 text-[#657287]" />
      <p className="text-2xl font-semibold">{value}</p>
      <p className="metric mt-1">{label}</p>
    </div>
  );
}
