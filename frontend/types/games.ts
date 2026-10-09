export type Difficulty = "easy" | "medium" | "hard" | "expert";
export type GameSlug =
  | "pattern-recognition"
  | "market-making"
  | "mental-math"
  | "reaction"
  | "fermi"
  | "liars-dice"
  | "optimal-stopping"
  | "probability-betting"
  | "auction-arena"
  | "bayesian-trader"
  | "order-book-challenge"
  | "sequential-strategy";
export interface GameDefinition {
  slug: GameSlug;
  name: string;
  shortName: string;
  description: string;
  category: string;
  icon: string;
  timed: boolean;
  scoring: string;
  accent: string;
  instructions: string;
  supportedModes: string[];
  difficulties: Difficulty[];
  defaultDifficulty: Difficulty;
}
export interface Attempt {
  id: number;
  game_slug: string;
  difficulty: Difficulty;
  score: number;
  duration_ms: number;
  won: boolean | null;
  metrics: Record<string, number | string>;
  created_at: string;
}
