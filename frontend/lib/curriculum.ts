import type { AssessmentMode } from "@/lib/assessment-modes";

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
  selection_reason?: { code: "due" | "weak" | "next"; text: string; estimated_seconds: number };
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
  time_recording?: TimeRecording | null;
};

export type TimeRecording = {
  version: 1;
  intervals: Array<{ start_at: string; end_at: string }>;
  truncated?: boolean;
};

export type AssessmentSession = {
  id: string;
  mode: AssessmentMode;
  roadmap_slug: string;
  topic_slug: string | null;
  stage_index?: number;
  expires_at: string;
  pass_score: number;
  questions: MathQuestion[];
  draft?: AssessmentDraft;
  result?: AssessmentResult | null;
  hint_usage?: Record<string, number> | null;
  request_id?: string | null;
  state?: "active" | "expired" | "completed";
  server_now?: string;
  expires_in_seconds?: number;
  questions_available?: boolean;
  study_plan?: StudyAssignmentPlan;
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
  mode: AssessmentMode;
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  assistance?: Assistance;
  independent_score?: number | null;
  independent_passed?: boolean | null;
  diagnostic_summary?: DiagnosticSummary;
  study_summary?: {
    version: 1;
    notice: string;
    correct: number;
    total: number;
    reason_counts: StudyReasonCounts;
  };
  recorded_seconds?: number | null;
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

export type DiagnosticSummary = {
  version: 1;
  notice: string;
  topics: Array<{
    topic_slug: string;
    title: string;
    correct: number;
    total: 2;
    priority: "start_here" | "review" | "verify";
    guidance: string;
    study_url: string | null;
  }>;
  recommended_topics: string[];
};

export type StudyReasonCounts = { due: number; weak: number; next: number };
export type StudyAssignmentPlan = {
  version: 1;
  budget_minutes: number;
  preferences_revision: number;
  estimated_seconds: number;
  question_count: number;
  reason_counts: StudyReasonCounts;
  notice: string;
};
export type StudyPreferences = {
  goal_minutes: number;
  session_minutes: number;
  preferred_roadmap_slug: string | null;
  revision: number;
  updated_at: string | null;
};
export type DailyStudyGoal = {
  date: string;
  timezone: "UTC";
  goal_seconds: number;
  recorded_seconds: number;
  recorded_sessions: number;
  unknown_duration_sessions: number;
  partial_duration_sessions: number;
  goal_met: boolean;
};
export type StudyPlan = {
  generated_at: string;
  preferences: StudyPreferences;
  daily_goal: DailyStudyGoal;
  recommendation: {
    roadmap_slug: string;
    budget_minutes: number;
    estimated_seconds: number;
    question_count: number;
    reason_counts: StudyReasonCounts;
    reason: string;
  } | null;
  subjects: Array<{ slug: string; due: number; weak: number; unseen: number }>;
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
  mode: AssessmentMode;
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

export type ExamReadiness = {
  roadmap_slug: string;
  stage_index: number;
  generated_at: string;
  eligible: boolean;
  ready_lessons: number;
  required_lessons: number;
  pass_score: number;
  lessons: Array<{
    topic_slug: string;
    title: string;
    practice_count: number;
    exam_count: number;
    best_score: number | null;
    best_independent_score: number | null;
    completed_attempts: number;
    untracked_attempts: number;
    outdated_attempts: number;
    status: "ready" | "practice_needed" | "independent_needed" | "untracked" | "outdated";
    reason: string;
    study_url: string;
    last_attempt_at: string | null;
  }>;
  blueprint: {
    total_questions: number;
    kinds: Record<string, number>;
    difficulties: Record<string, number>;
    hints_allowed: false;
  };
};

export type AssessmentHistoryItem = {
  id: string;
  roadmap_slug: string;
  topic_slug: string | null;
  stage_index: number;
  mode: AssessmentMode;
  state: "active" | "completed" | "expired";
  started_at: string;
  completed_at: string | null;
  expires_at: string;
  question_count: number;
  saved_entries: number;
  result_available: boolean;
  result_summary: {
    score: number;
    independent_score: number | null;
    correct: number;
    total: number;
    passed: boolean;
    assistance: Assistance;
  } | null;
  questions_available: boolean;
  open_url: string | null;
  study_url: string | null;
};

export type AssessmentHistoryPage = {
  generated_at: string;
  items: AssessmentHistoryItem[];
  next_cursor: string | null;
};
