import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { gameMap } from "@/lib/games";
import type { GameSlug } from "@/types/games";
const components: Record<GameSlug, React.ComponentType> = {
  "pattern-recognition": dynamic(() =>
    import("@/components/games/pattern-game").then((module) => module.PatternGame),
  ),
  "market-making": dynamic(() =>
    import("@/components/games/market-making-game").then((module) => module.MarketMakingGame),
  ),
  "mental-math": dynamic(() =>
    import("@/components/games/mental-math-game").then((module) => module.MentalMathGame),
  ),
  reaction: dynamic(() => import("@/components/games/reaction-game").then((module) => module.ReactionGame)),
  fermi: dynamic(() =>
    import("@/components/games/fermi-training-game").then((module) => module.FermiTrainingGame),
  ),
  "liars-dice": dynamic(() =>
    import("@/components/games/liars-dice-game").then((module) => module.LiarsDiceGame),
  ),
};
export function generateStaticParams() {
  return Object.keys(gameMap).map((slug) => ({ slug }));
}
export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in components)) notFound();
  const Game = components[slug as GameSlug];
  return <Game />;
}
