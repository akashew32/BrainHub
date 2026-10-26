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
  "bayes-updating": dynamic(() =>
    import("@/components/games/bayes-updating-game").then((module) => module.BayesUpdatingGame),
  ),
  "expected-value": dynamic(() =>
    import("@/components/games/expected-value-game").then((module) => module.ExpectedValueGame),
  ),
  "order-book": dynamic(() =>
    import("@/components/games/order-book-game").then((module) => module.OrderBookGame),
  ),
  "options-payoff": dynamic(() =>
    import("@/components/games/options-payoff-game").then((module) => module.OptionsPayoffGame),
  ),
  "portfolio-risk": dynamic(() =>
    import("@/components/games/portfolio-risk-game").then((module) => module.PortfolioRiskGame),
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
