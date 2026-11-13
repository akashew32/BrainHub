export const ASSESSMENT_MODES = ["practice", "exam", "review", "diagnostic"] as const;
export type AssessmentMode = (typeof ASSESSMENT_MODES)[number];
export const DIAGNOSTIC_SAMPLE = { questions: 12, lessons: 6, perLesson: 2, fullPractice: 8 } as const;

type ModeConfig = {
  title: (stageIndex: number) => string;
  intro: string;
  supportsHints: boolean;
  diagnostic: boolean;
  sampleNotQualification: boolean;
};

export const ASSESSMENT_MODE_CONFIG: Record<AssessmentMode, ModeConfig> = {
  practice: {
    title: () => "Practice and mastery",
    intro:
      "Complete the lesson practice set to check your understanding. A score of 75% completes it. Worked feedback appears after submission.",
    supportsHints: true,
    diagnostic: false,
    sampleNotQualification: false,
  },
  exam: {
    title: (stageIndex) => `Stage ${stageIndex + 1} examination`,
    intro:
      "Reserved questions cover the stage lessons. Earn at least 75% independent practice in every lesson to start a new exam. No hints are available; a score of 75% passes.",
    supportsHints: false,
    diagnostic: false,
    sampleNotQualification: false,
  },
  review: {
    title: () => "Targeted retrieval practice",
    intro: "Revisit questions selected from your recent mistakes and due recall practice.",
    supportsHints: true,
    diagnostic: false,
    sampleNotQualification: false,
  },
  diagnostic: {
    title: () => "Foundation diagnostic",
    intro: `Answer a balanced sample of ${DIAGNOSTIC_SAMPLE.questions} practice questions: ${DIAGNOSTIC_SAMPLE.perLesson} from each of ${DIAGNOSTIC_SAMPLE.lessons} foundation lessons. No hints are available. Use this sample to choose what to study; it does not complete lessons or unlock exams.`,
    supportsHints: false,
    diagnostic: true,
    sampleNotQualification: true,
  },
};

export function isAssessmentMode(value: unknown): value is AssessmentMode {
  return typeof value === "string" && (ASSESSMENT_MODES as readonly string[]).includes(value);
}

export function assessmentTitle(mode: AssessmentMode, stageIndex = 0) {
  return ASSESSMENT_MODE_CONFIG[mode].title(stageIndex);
}
