"use client";
import Link from "next/link";
import { ChevronLeft, RotateCcw } from "lucide-react";
import type { Difficulty, GameSlug } from "@/types/games";
import { gameMap } from "@/lib/games";
export function GameShell({
  slug,
  difficulty,
  setDifficulty,
  onRestart,
  children,
}: {
  slug: GameSlug;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  onRestart?: () => void;
  children: React.ReactNode;
}) {
  const game = gameMap[slug];
  return (
    <div>
      <Link href="/" className="mb-5 inline-flex items-center gap-1 text-sm text-[#8995a7]">
        <ChevronLeft size={16} />
        Training floor
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="metric" style={{ color: game.accent }}>
            {game.category}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{game.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#8995a7]">{game.description}</p>
          <details className="mt-3 max-w-2xl text-sm text-[#8995a7]">
            <summary className="cursor-pointer font-medium text-[#c5cdd8]">How to play</summary>
            <p className="mt-2 leading-6">{game.instructions}</p>
          </details>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Difficulty"
            className="input w-auto capitalize"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          >
            {game.difficulties.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          {onRestart ? (
            <button className="btn" onClick={onRestart} aria-label="Restart game">
              <RotateCcw size={17} />
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}
export function ScoreRow({ items }: { items: Array<[string, string | number]> }) {
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div className="panel px-4 py-3" key={label}>
          <p className="text-lg font-semibold">{value}</p>
          <p className="metric">{label}</p>
        </div>
      ))}
    </div>
  );
}
