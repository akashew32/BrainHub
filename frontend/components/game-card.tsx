import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Calculator,
  CandlestickChart,
  Dice5,
  Percent,
  PieChart,
  Shapes,
  Sigma,
  Telescope,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { GameDefinition } from "@/types/games";
const icons = {
  BookOpen,
  Calculator,
  CandlestickChart,
  Dice5,
  Percent,
  PieChart,
  Shapes,
  Sigma,
  Telescope,
  TrendingUp,
  Zap,
};
export function GameCard({
  game,
  index,
  best,
  recent,
}: {
  game: GameDefinition;
  index: number;
  best?: number;
  recent?: number;
}) {
  const Icon = icons[game.icon as keyof typeof icons];
  return (
    <article
      className="panel enter group relative overflow-hidden p-5"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div
        className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl opacity-10"
        style={{ background: game.accent }}
      />
      <div className="mb-8 flex items-start justify-between">
        <span className="rounded-xl border border-[#2b3545] p-2.5" style={{ color: game.accent }}>
          <Icon size={23} />
        </span>
        <span className="metric capitalize">
          {game.defaultDifficulty} · {game.timed ? "Timed" : "Strategy"}
        </span>
      </div>
      <p className="metric mb-2" style={{ color: game.accent }}>
        {game.category}
      </p>
      <h2 className="text-xl font-semibold">{game.name}</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-[#8995a7]">{game.description}</p>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg bg-[#090d13] p-3">
        <div>
          <p className="text-sm font-semibold">{best === undefined ? "—" : Math.round(best)}</p>
          <p className="metric">Personal best</p>
        </div>
        <div>
          <p className="text-sm font-semibold">{recent === undefined ? "—" : Math.round(recent)}</p>
          <p className="metric">Recent avg</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#202937] pt-4">
        <span className="text-xs text-[#758195]">{game.scoring}</span>
        <Link
          href={`/games/${game.slug}`}
          aria-label={`Play ${game.name}`}
          className="flex items-center gap-1 text-sm font-semibold group-hover:text-[#63e6be]"
        >
          Play <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
