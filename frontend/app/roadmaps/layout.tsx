import type { ReactNode } from "react";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";

export default function RoadmapsLayout({ children }: { children: ReactNode }) {
  return <RoadmapProgressProvider>{children}</RoadmapProgressProvider>;
}
