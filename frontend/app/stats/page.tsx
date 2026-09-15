"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { gameMap } from "@/lib/games";

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
const tooltipStyle = { background: "#0d1118", border: "1px solid #202937", borderRadius: 8 };

export default function StatsPage() {
  const [stats, setStats] = useState<Stats>(empty);
  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch(() => undefined);
  }, []);
  const gameData = stats.games.map((item) => ({
    ...item,
    name: gameMap[item.slug as keyof typeof gameMap]?.shortName ?? item.slug,
  }));
  return (
    <div>
      <p className="metric text-[#63e6be]">Performance desk</p>
      <h1 className="mt-2 text-4xl font-semibold">Statistics</h1>
      <p className="mt-2 text-[#8b97a8]">Trend the habits that compound.</p>
      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          ["BrainHub rating", stats.rating],
          ["Games played", stats.games_played],
          ["Current streak", `${stats.current_streak} day${stats.current_streak === 1 ? "" : "s"}`],
          ["Training time", `${Math.round(stats.total_training_ms / 60000)} min`],
        ].map(([label, value]) => (
          <div className="panel p-5" key={label}>
            <p className="text-2xl font-semibold">{value}</p>
            <p className="metric mt-1">{label}</p>
          </div>
        ))}
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Chart title="Recent score trend" empty={!stats.recent_trend.length}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.recent_trend}>
              <CartesianGrid stroke="#202937" vertical={false} />
              <XAxis dataKey="date" stroke="#758195" />
              <YAxis stroke="#758195" />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#63e6be"
                strokeWidth={2}
                dot={{ fill: "#63e6be" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Chart>
        <Chart title="Category rating" empty={!stats.categories.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.categories} layout="vertical">
              <CartesianGrid stroke="#202937" horizontal={false} />
              <XAxis type="number" domain={[700, 2200]} stroke="#758195" />
              <YAxis type="category" dataKey="name" width={115} stroke="#758195" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="rating" fill="#9b87f5" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Chart>
      </section>
      <section className="panel mt-5 overflow-hidden">
        <div className="border-b border-[#202937] p-6">
          <h2 className="text-lg font-semibold">Per-game performance</h2>
        </div>
        {gameData.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="metric">
                <tr>
                  {["Game", "Attempts", "Personal best", "Rolling average", "Accuracy", "Training time"].map(
                    (item) => (
                      <th className="px-6 py-3" key={item}>
                        {item}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {gameData.map((item) => (
                  <tr key={item.slug} className="border-t border-[#202937]">
                    <td className="px-6 py-4 font-semibold">{item.name}</td>
                    <td className="px-6 py-4">{item.attempts}</td>
                    <td className="px-6 py-4">{Math.round(item.best_score)}</td>
                    <td className="px-6 py-4">{Math.round(item.average_score)}</td>
                    <td className="px-6 py-4">{item.accuracy === null ? "—" : `${item.accuracy}%`}</td>
                    <td className="px-6 py-4">{Math.round(item.total_duration_ms / 60000)}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid h-44 place-items-center text-[#758195]">
            Complete a game to begin your performance history.
          </div>
        )}
      </section>
    </div>
  );
}

function Chart({
  title,
  empty: isEmpty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-6 h-64">
        {isEmpty ? (
          <div className="grid h-full place-items-center text-sm text-[#758195]">
            No completed sessions yet
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
