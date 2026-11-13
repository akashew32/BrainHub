import { LAB_LESSONS, LAB_MODES, type LabMode } from "@/lib/linear-algebra-lab-types";
import { COUNTING_LESSONS, COUNTING_MODES, type CountingMode } from "@/lib/counting-lab-types";
import { FUNCTION_LESSONS, FUNCTION_MODES, type FunctionMode } from "@/lib/function-lab-types";
import { LOGIC_LESSONS, type LogicMode } from "@/lib/logic-lab-types";

export const LINEAR_ALGEBRA_LAB_URL = "/roadmaps/explore/linear-algebra";
export const COUNTING_LAB_URL = "/roadmaps/explore/probability";
export const FUNCTION_LAB_URL = "/roadmaps/explore/calculus";
export const LOGIC_LAB_URL = "/roadmaps/explore/logic";

const EXPLORATIONS: Array<{ slug: string; href: string; label: string; topics: string[]; subject?: string }> =
  [
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
    {
      slug: "calculus",
      href: FUNCTION_LAB_URL,
      label: "Explore functions and sequences",
      topics: Object.values(FUNCTION_LESSONS).map((lesson) => lesson.topic),
    },
    ...(["real-analysis", "discrete-math"] as const).map((subject) => ({
      slug: subject,
      subject,
      href: LOGIC_LAB_URL,
      label: "Explore logic, counterexamples and proofs",
      topics: LOGIC_LESSONS.filter((lesson) => lesson.roadmap === subject).map((lesson) => lesson.topic),
    })),
  ];

export function experimentForTopic(topic: unknown): LabMode {
  return LAB_MODES.find((mode) => LAB_LESSONS[mode].topic === topic) ?? "combinations";
}

export function explorationForLesson(roadmapSlug: string, topicSlug: string): string | null {
  const exploration = EXPLORATIONS.find(
    (item) => item.slug === roadmapSlug && item.topics.includes(topicSlug),
  );
  return exploration
    ? `${exploration.href}?${exploration.subject ? `subject=${exploration.subject}&` : ""}lesson=${encodeURIComponent(topicSlug)}`
    : null;
}

export function countingExperimentForTopic(topic: unknown): CountingMode {
  return COUNTING_MODES.find((mode) => COUNTING_LESSONS[mode].topic === topic) ?? "rules";
}

export function functionExperimentForTopic(topic: unknown): FunctionMode {
  return FUNCTION_MODES.find((mode) => FUNCTION_LESSONS[mode].topic === topic) ?? "composition";
}

export function logicExperimentForTopic(topic: unknown, subject?: unknown): LogicMode {
  if (subject !== undefined && subject !== "real-analysis" && subject !== "discrete-math") return "truth";
  return (
    LOGIC_LESSONS.find(
      (lesson) => lesson.topic === topic && (subject === undefined || lesson.roadmap === subject),
    )?.mode ?? "truth"
  );
}

export function explorationForRoadmap(roadmapSlug: string): { href: string; label: string } | null {
  const exploration = EXPLORATIONS.find((item) => item.slug === roadmapSlug);
  return exploration
    ? {
        href: exploration.subject ? `${exploration.href}?subject=${exploration.subject}` : exploration.href,
        label: exploration.label,
      }
    : null;
}
