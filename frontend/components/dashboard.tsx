"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Code2, Flame, Gauge, TerminalSquare, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { games } from "@/lib/games";
import type { Attempt } from "@/types/games";
import { GameCard } from "./game-card";

type Stats = Awaited<ReturnType<typeof api.stats>>;
const empty: Stats = {
  rating: 800,
  games_played: 0,
  current_streak: 0,
  total_training_ms: 0,
  games: [],
  categories: [],
  recent_trend: [],
};

export function Dashboard() {
  const [stats, setStats] = useState<Stats>(empty);
  const [recent, setRecent] = useState<Attempt[]>([]);
  useEffect(() => {
    Promise.all([api.stats(), api.recent()])
      .then(([nextStats, attempts]) => {
        setStats(nextStats);
        setRecent(attempts);
      })
      .catch(() => undefined);
  }, []);
  const recentAverages = useMemo(
    () =>
      Object.fromEntries(
        games.map((game) => {
          const scores = recent
            .filter((item) => item.game_slug === game.slug)
            .slice(0, 5)
            .map((item) => item.score);
          return [game.slug, scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : undefined];
        }),
      ),
    [recent],
  );
  const overallAverage = stats.games.length
    ? Math.round(stats.games.reduce((sum, game) => sum + game.average_score, 0) / stats.games.length)
    : "—";
  return (
    <div>
      <section className="mb-10 grid gap-7 lg:grid-cols-[1fr_400px]">
        <div>
          <p className="metric mb-4 text-[#63e6be]">Quant interview training</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-.04em] sm:text-6xl">
            Sharper decisions.
            <br />
            <span className="text-[#778398]">Built one round at a time.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[#98a4b5]">
            Short, repeatable drills for the arithmetic, probability, estimation, and market intuition that
            interviews actually test.
          </p>
        </div>
        <div className="panel grid grid-cols-2 gap-px overflow-hidden bg-[#202937]">
          <Metric icon={Gauge} label="BrainHub rating" value={stats.rating} />
          <Metric icon={Activity} label="Games played" value={stats.games_played} />
          <Metric
            icon={Flame}
            label="Current streak"
            value={`${stats.current_streak} day${stats.current_streak === 1 ? "" : "s"}`}
          />
          <Metric icon={Trophy} label="Average score" value={overallAverage} />
        </div>
      </section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="metric text-[#63e6be]">Training floor</p>
          <h2 className="mt-1 text-2xl font-semibold">Choose your drill</h2>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/programming" className="btn flex items-center gap-2 text-sm">
            <Code2 size={16} /> Programming trivia
          </Link>
          <Link href="/challenges" className="btn flex items-center gap-2 text-sm">
            <TerminalSquare size={16} /> Coding challenges
          </Link>
          <span className="text-sm text-[#778398]">{games.length} playable drills</span>
        </div>
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {games.map((game, index) => {
          const gameStats = stats.games.find((item) => item.slug === game.slug);
          return (
            <GameCard
              key={game.slug}
              game={game}
              index={index}
              best={gameStats?.best_score}
              recent={recentAverages[game.slug]}
            />
          );
        })}
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string | number }) {
  return (
    <div className="bg-[#0d1118] p-5">
      <Icon size={17} className="mb-5 text-[#657287]" />
      <p className="text-2xl font-semibold">{value}</p>
      <p className="metric mt-1">{label}</p>
    </div>
  );
}
