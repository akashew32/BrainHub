export type MathQuestion = {
  id: string;
  kind: "number" | "vector" | "matrix" | "choice" | "proof";
  prompt: string;
  choices?: string[];
  hints: string[];
  hint_count?: number;
  concept: string;
  difficulty: "foundation" | "core" | "stretch";
  topic_slug: string;
  lesson_title: string;
  math_input_version?: 1;
  answer_format?: "integer" | "number" | "vector" | "matrix" | "choice" | "proof";
  tolerance?: number;
  numeric_tolerance?: { absolute: number; relative: number };
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

export type AssessmentDraft = {
  answers: Array<{ question_id: string; answer: unknown }>;
  time_spent_seconds: number;
  revision: number;
};

export type AssessmentSession = {
  id: string;
  mode: "practice" | "exam" | "review";
  roadmap_slug: string;
  topic_slug: string | null;
  expires_at: string;
  pass_score: number;
  questions: MathQuestion[];
  draft?: AssessmentDraft;
  result?: AssessmentResult | null;
  hint_usage?: Record<string, number> | null;
};

export type Assistance = "independent" | "assisted" | "untracked";

export type HintReveal = {
  question_id: string;
  hint_count: number;
  hints: string[];
  hints_used: number;
  hint_usage: Record<string, number>;
};

export type ProofDetails = {
  submitted_steps: Array<{ step: number; text: string; justification?: string }>;
  expected_steps: Array<{ step: number; text: string; justification?: string }>;
  first_divergence: number | null;
  correct_prefix_length: number;
  total_steps: number;
  explanation: string;
  violated_dependencies?: Array<{ step: number; requires: number }>;
};

export type AssessmentResult = {
  session_id: string;
  mode: string;
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  assistance?: Assistance;
  independent_score?: number | null;
  independent_passed?: boolean | null;
  feedback: Array<{
    question_id: string;
    prompt: string;
    concept: string;
    correct: boolean;
    submitted_answer: unknown;
    expected_answer: unknown;
    solution: string;
    topic_slug: string;
    proof_details?: ProofDetails;
    hints_used?: number | null;
    assistance?: Assistance;
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

export type ReviewItem = MistakeQueue["items"][number] & {
  status: "mistake" | "assisted" | "untracked" | "recall";
  independent_streak: number;
  interval_days: number;
  is_due: boolean;
  last_hints_used: number | null;
};

export type ReviewPlan = {
  generated_at: string;
  policy: {
    version: 1;
    interval_days: number[];
    session_limit: number;
    timezone: "UTC";
    early_practice_advances: false;
  };
  summary: {
    due: number;
    scheduled: number;
    tracked: number;
    unseen: number;
    reviewed_today: number;
    independent_today: number;
    next_due_at: string | null;
  };
  subjects: Array<{
    slug: string;
    due: number;
    scheduled: number;
    tracked: number;
    unseen: number;
    next_due_at: string | null;
  }>;
  items: ReviewItem[];
  upcoming: ReviewItem[];
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

export type ReflectionNote = {
  text: string;
  revision: number;
  created_at: string | null;
  updated_at: string | null;
};

export type NotebookEntry = {
  roadmap_slug: string;
  question_id: string;
  topic_slug: string;
  lesson_title: string;
  concept: string;
  prompt: string;
  status: "unresolved" | "resolved";
  latest_outcome: "mistake" | "assisted" | "untracked" | "independent";
  first_flagged_at: string;
  last_attempt_at: string;
  last_attempt_id: number;
  attempts: number;
  incorrect_attempts: number;
  assisted_attempts: number;
  untracked_attempts: number;
  independent_correct_attempts: number;
  archived: boolean;
  practice_url: string | null;
  has_note: boolean;
  note_preview: string;
};

export type NotebookPage = {
  generated_at: string;
  items: NotebookEntry[];
  next_cursor: string | null;
  snapshot_max_attempt_id: number;
};

export type NotebookAttempt = {
  attempt_id: number;
  session_id: string;
  mode: string;
  created_at: string;
  correct: boolean;
  hints_used: number | null;
  assistance: Assistance;
  prompt: string;
  concept: string;
  submitted_answer: unknown;
  expected_answer: unknown;
  solution: string;
  proof_details?: ProofDetails;
};

export type NotebookDetail = {
  entry: NotebookEntry;
  note: ReflectionNote;
  history: {
    items: NotebookAttempt[];
    next_cursor: string | null;
    snapshot_max_attempt_id: number;
  };
};

export type PerformanceBucket = { answers: number; correct: number; accuracy: number | null };
export type ConceptMetrics = PerformanceBucket & {
  incorrect: number;
  questions_seen: number;
  independent: PerformanceBucket;
  assisted: PerformanceBucket;
  untracked: PerformanceBucket;
};
export type ConceptPerformance = {
  generated_at: string;
  window: { days: number; start_at: string; end_at: string; timezone: "UTC" };
  totals: ConceptMetrics;
  concepts: Array<
    ConceptMetrics & {
      roadmap_slug: string;
      topic_slug: string;
      concept: string;
      latest_attempt_at: string;
    }
  >;
  trend: Array<ConceptMetrics & { date: string }>;
};
