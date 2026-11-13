import { LAB_LESSONS, LAB_MODES, type LabMode } from "@/lib/linear-algebra-lab-types";
import { COUNTING_LESSONS, COUNTING_MODES, type CountingMode } from "@/lib/counting-lab-types";

export const LINEAR_ALGEBRA_LAB_URL = "/roadmaps/explore/linear-algebra";
export const COUNTING_LAB_URL = "/roadmaps/explore/probability";

const EXPLORATIONS = [
  {
    slug: "linear-algebra",
    href: LINEAR_ALGEBRA_LAB_URL,
    label: "Explore vectors and transformations",
    topics: Object.values(LAB_LESSONS).map((lesson) => lesson.topic),
  },
  {
    slug: "probability",
    href: COUNTING_LAB_URL,
    label: "Explore counting constructions",
    topics: Object.values(COUNTING_LESSONS).map((lesson) => lesson.topic),
  },
];

export function experimentForTopic(topic: unknown): LabMode {
  return LAB_MODES.find((mode) => LAB_LESSONS[mode].topic === topic) ?? "combinations";
}

export function explorationForLesson(roadmapSlug: string, topicSlug: string): string | null {
  const exploration = EXPLORATIONS.find(
    (item) => item.slug === roadmapSlug && item.topics.includes(topicSlug),
  );
  return exploration ? `${exploration.href}?lesson=${encodeURIComponent(topicSlug)}` : null;
}

export function countingExperimentForTopic(topic: unknown): CountingMode {
  return COUNTING_MODES.find((mode) => COUNTING_LESSONS[mode].topic === topic) ?? "rules";
}

export function explorationForRoadmap(roadmapSlug: string): { href: string; label: string } | null {
  const exploration = EXPLORATIONS.find((item) => item.slug === roadmapSlug);
  return exploration ? { href: exploration.href, label: exploration.label } : null;
}
