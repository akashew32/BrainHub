import { LAB_LESSONS, LAB_MODES, type LabMode } from "@/lib/linear-algebra-lab-types";

export const LINEAR_ALGEBRA_LAB_URL = "/roadmaps/explore/linear-algebra";

export function experimentForTopic(topic: unknown): LabMode {
  return LAB_MODES.find((mode) => LAB_LESSONS[mode].topic === topic) ?? "combinations";
}

export function explorationForLesson(roadmapSlug: string, topicSlug: string): string | null {
  if (roadmapSlug !== "linear-algebra") return null;
  const mode = LAB_MODES.find((item) => LAB_LESSONS[item].topic === topicSlug);
  return mode ? `${LINEAR_ALGEBRA_LAB_URL}?lesson=${encodeURIComponent(topicSlug)}` : null;
}
