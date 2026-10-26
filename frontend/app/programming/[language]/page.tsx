import { notFound } from "next/navigation";
import { ProgrammingTrivia } from "@/components/programming/programming-trivia";
import { programmingMap, programmingTracks, type ProgrammingLanguage } from "@/lib/programming";

export function generateStaticParams() {
  return programmingTracks.map((track) => ({ language: track.slug }));
}

export default async function ProgrammingLanguagePage({ params }: { params: Promise<{ language: string }> }) {
  const { language } = await params;
  if (!(language in programmingMap)) notFound();
  return <ProgrammingTrivia track={programmingMap[language as ProgrammingLanguage]} />;
}
