export const ASSESSMENT_MODES = ["practice", "exam", "review", "diagnostic", "study"] as const;
export type AssessmentMode = (typeof ASSESSMENT_MODES)[number];
export const DIAGNOSTIC_SAMPLE = { questions: 12, lessons: 6, perLesson: 2, fullPractice: 8 } as const;

type ModeConfig = {
  title: (stageIndex: number) => string;
  intro: string;
  supportsHints: boolean;
  resultKind: "qualification" | "review" | "diagnostic" | "study";
  showsPassThreshold: boolean;
  earnsTopicMastery: boolean;
  completionTitle: string;
  progressLabel: string;
};

export const ASSESSMENT_MODE_CONFIG: Record<AssessmentMode, ModeConfig> = {
  practice: {
    title: () => "Practice and mastery",
    intro:
      "Complete eight questions covering eight distinct skills. Repeat practice varies the exercise when an alternate form is available. A score of 75% completes the lesson; exam readiness requires 75% independently correct. Worked feedback appears after submission.",
    supportsHints: true,
    resultKind: "qualification",
    showsPassThreshold: true,
    earnsTopicMastery: true,
    completionTitle: "Practice complete",
    progressLabel: "lesson practice",
  },
  exam: {
    title: (stageIndex) => `Stage ${stageIndex + 1} examination`,
    intro:
      "Reserved questions cover the stage lessons. Earn at least 75% independent practice in every lesson to start a new exam. No hints are available; a score of 75% passes.",
    supportsHints: false,
    resultKind: "qualification",
    showsPassThreshold: true,
    earnsTopicMastery: false,
    completionTitle: "Examination complete",
    progressLabel: "stage examination",
  },
  review: {
    title: () => "Targeted retrieval practice",
    intro: "Revisit questions selected from your recent mistakes and due recall practice.",
    supportsHints: true,
    resultKind: "review",
    showsPassThreshold: true,
    earnsTopicMastery: false,
    completionTitle: "Review complete",
    progressLabel: "retrieval practice",
  },
  diagnostic: {
    title: () => "Foundation diagnostic",
    intro: `Answer a balanced sample of ${DIAGNOSTIC_SAMPLE.questions} practice questions: ${DIAGNOSTIC_SAMPLE.perLesson} from each of ${DIAGNOSTIC_SAMPLE.lessons} foundation lessons. No hints are available. Use this sample to choose what to study; it does not complete lessons or unlock exams.`,
    supportsHints: false,
    resultKind: "diagnostic",
    showsPassThreshold: false,
    earnsTopicMastery: false,
    completionTitle: "Diagnostic complete",
    progressLabel: "limited diagnostic sample",
  },
  study: {
    title: () => "Guided study practice",
    intro:
      "Work through a personal mix of due recall, concepts to strengthen, and the next lesson. Hints are available and recorded. Complete a full lesson practice set to establish lesson readiness.",
    supportsHints: true,
    resultKind: "study",
    showsPassThreshold: false,
    earnsTopicMastery: false,
    completionTitle: "Study set complete",
    progressLabel: "guided study practice",
  },
};

export function isAssessmentMode(value: unknown): value is AssessmentMode {
  return typeof value === "string" && (ASSESSMENT_MODES as readonly string[]).includes(value);
}

export function assessmentTitle(mode: AssessmentMode, stageIndex = 0) {
  return ASSESSMENT_MODE_CONFIG[mode].title(stageIndex);
}
