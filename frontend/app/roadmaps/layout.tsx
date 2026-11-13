import type { ReactNode } from "react";
import { RoadmapProgressProvider } from "@/components/roadmaps/roadmap-progress-provider";
import { BookmarkProvider } from "@/components/roadmaps/bookmark-provider";

export default function RoadmapsLayout({ children }: { children: ReactNode }) {
  return (
    <RoadmapProgressProvider>
      <BookmarkProvider>{children}</BookmarkProvider>
    </RoadmapProgressProvider>
  );
}
