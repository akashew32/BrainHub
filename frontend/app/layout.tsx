import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, BrainCircuit } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrainHub — Quant Training",
  description: "Build the instincts quantitative interviews demand.",
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
            <nav className="flex gap-5 text-sm text-[#aeb8c6]">
              <Link href="/">Train</Link>
              <Link href="/stats" className="flex items-center gap-1.5">
                <BarChart3 size={16} />
                Statistics
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-65px)] max-w-7xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
