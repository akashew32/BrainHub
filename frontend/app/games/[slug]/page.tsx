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
  "optimal-stopping": dynamic(() =>
    import("@/components/games/optimal-stopping-game").then((module) => module.OptimalStoppingGame),
  ),
  "probability-betting": dynamic(() =>
    import("@/components/games/probability-betting-game").then((module) => module.ProbabilityBettingGame),
  ),
  "auction-arena": dynamic(() =>
    import("@/components/games/auction-arena-game").then((module) => module.AuctionArenaGame),
  ),
  "bayesian-trader": dynamic(() =>
    import("@/components/games/bayesian-trader-game").then((module) => module.BayesianTraderGame),
  ),
  "order-book-challenge": dynamic(() =>
    import("@/components/games/order-book-challenge-game").then((module) => module.OrderBookChallengeGame),
  ),
  "sequential-strategy": dynamic(() =>
    import("@/components/games/sequential-strategy-game").then((module) => module.SequentialStrategyGame),
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
