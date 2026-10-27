import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, BrainCircuit, Code2, Map, TerminalSquare } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrainHub — Quant & Programming Training",
  description: "Train quantitative instincts and programming fundamentals.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-40 border-b border-[#202937] bg-[#07090de8] backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              <span className="rounded-lg bg-[#63e6be] p-1.5 text-black">
                <BrainCircuit size={20} />
              </span>
              BrainHub
            </Link>
            <nav className="flex items-center gap-2 text-sm text-[#aeb8c6] sm:gap-5">
              <Link href="/">Quant</Link>
              <Link href="/programming" aria-label="Programming" className="flex items-center gap-1.5">
                <Code2 size={16} />
                <span className="hidden md:inline">Programming</span>
              </Link>
              <Link href="/challenges" aria-label="Challenges" className="flex items-center gap-1.5">
                <TerminalSquare size={16} />
                <span className="hidden md:inline">Challenges</span>
              </Link>
              <Link href="/roadmaps" aria-label="Roadmaps" className="flex items-center gap-1.5">
                <Map size={16} />
                <span className="hidden lg:inline">Roadmaps</span>
              </Link>
              <Link href="/stats" aria-label="Statistics" className="flex items-center gap-1.5">
                <BarChart3 size={16} />
                <span className="hidden md:inline">Statistics</span>
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-65px)] max-w-7xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
