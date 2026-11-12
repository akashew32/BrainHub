export type MathQuestion = {
  id: string;
  kind: "number" | "vector" | "matrix" | "choice" | "proof";
  prompt: string;
  choices?: string[];
  hints: string[];
  concept: string;
  difficulty: "foundation" | "core" | "stretch";
  topic_slug: string;
  lesson_title: string;
};

export type AuthoredLesson = {
  roadmap_slug: string;
  topic_slug: string;
  title: string;
  summary: string;
  objectives: string[];
  sections: Array<{ heading: string; body: string }>;
  worked_examples: Array<{ prompt: string; steps: string[]; result: string }>;
  sources: Array<{ title: string; url: string }>;
  practice_count: number;
  question_count: number;
  pass_score: number;
};

export type AssessmentSession = {
  id: string;
  mode: "practice" | "exam" | "review";
  roadmap_slug: string;
  topic_slug: string | null;
  expires_at: string;
  pass_score: number;
  questions: MathQuestion[];
};

export type AssessmentResult = {
  session_id: string;
  mode: string;
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  feedback: Array<{
    question_id: string;
    prompt: string;
    concept: string;
    correct: boolean;
    submitted_answer: unknown;
    expected_answer: unknown;
    solution: string;
    topic_slug: string;
  }>;
  progress: import("@/lib/roadmap-progress").RoadmapProgressItem | null;
};

export type MistakeQueue = {
  items: Array<{
    question_id: string;
    roadmap_slug: string;
    topic_slug: string;
    lesson_title: string;
    concept: string;
    last_correct: boolean;
    attempts: number;
    last_attempt_at: string;
    due_at: string;
    reason: string;
    prompt: string;
  }>;
  total_attempts: number;
};

export type LearningStats = {
  answers: number;
  correct: number;
  accuracy: number;
  concepts_to_review: number;
  exams: Array<{
    roadmap_slug: string;
    stage_index: number;
    score: number;
    passed: boolean;
    completed_at: string;
  }>;
};
