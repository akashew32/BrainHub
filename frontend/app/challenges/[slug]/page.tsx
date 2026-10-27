import { notFound } from "next/navigation";
import { ChallengeWorkbench } from "@/components/challenges/challenge-workbench";
import { challengeMap, codingChallenges } from "@/lib/challenges";

export function generateStaticParams() {
  return codingChallenges.map((challenge) => ({ slug: challenge.slug }));
}

export default async function ChallengePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const challenge = challengeMap[slug];
  if (!challenge) notFound();
  return <ChallengeWorkbench challenge={challenge} />;
}
