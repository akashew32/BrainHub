"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Play, RotateCcw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { AssessmentResult, AssessmentSession, HintReveal, MathQuestion } from "@/lib/curriculum";
import { MathText } from "@/components/roadmaps/math-text";
import { MathAnswerPreview } from "@/components/roadmaps/math-answer-preview";
import { ProofBuilder, parseProofOrder } from "@/components/roadmaps/proof-builder";
import { QuestionHints } from "@/components/roadmaps/question-hints";
import { useRoadmapProgress } from "@/components/roadmaps/roadmap-progress-provider";

type Mode = "practice" | "exam" | "review";
type AnswerMap = Record<string, string>;
type AssessmentProps = {
  roadmapSlug: string;
  topicSlug?: string;
  stageIndex?: number;
  mode?: Mode;
  onCompleted?: (result: AssessmentResult) => void;
  reviewAvailable?: boolean;
};
type SavedDraft = {
  version: 2;
  sessionId: string;
  roadmapSlug: string;
  topicSlug: string | null;
  stageIndex: number;
  mode: Mode;
  answers: AnswerMap;
  startedAt: number;
  revision: number;
  session: AssessmentSession;
};

const MAX_TIME_SECONDS = 7200;
const MAX_REVISION = 2_147_483_647;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function publicSession(value: unknown): value is AssessmentSession {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.roadmap_slug === "string" &&
    ["practice", "exam", "review"].includes(String(value.mode)) &&
    (value.topic_slug === null || typeof value.topic_slug === "string") &&
    typeof value.expires_at === "string" &&
    Number.isFinite(Date.parse(value.expires_at)) &&
    typeof value.pass_score === "number" &&
    Array.isArray(value.questions) &&
    value.questions.length > 0 &&
    value.questions.length <= 60 &&
    (value.hint_usage === undefined ||
      value.hint_usage === null ||
      (isRecord(value.hint_usage) &&
        Object.values(value.hint_usage).every(
          (count) => typeof count === "number" && Number.isInteger(count) && count >= 0 && count <= 64,
        ))) &&
    new Set(value.questions.map((question) => (isRecord(question) ? question.id : null))).size ===
      value.questions.length &&
    value.questions.every(
      (question) =>
        isRecord(question) &&
        typeof question.id === "string" &&
        typeof question.prompt === "string" &&
        ["number", "vector", "matrix", "choice", "proof"].includes(String(question.kind)) &&
        typeof question.concept === "string" &&
        typeof question.difficulty === "string" &&
        (question.math_input_version === undefined || question.math_input_version === 1) &&
        (question.answer_format === undefined ||
          ["integer", "number", "vector", "matrix", "choice", "proof"].includes(
            String(question.answer_format),
          )) &&
        (question.tolerance === undefined ||
          (typeof question.tolerance === "number" &&
            Number.isFinite(question.tolerance) &&
            question.tolerance >= 0)) &&
        (question.numeric_tolerance === undefined ||
          (isRecord(question.numeric_tolerance) &&
            typeof question.numeric_tolerance.absolute === "number" &&
            Number.isFinite(question.numeric_tolerance.absolute) &&
            question.numeric_tolerance.absolute >= 0 &&
            typeof question.numeric_tolerance.relative === "number" &&
            Number.isFinite(question.numeric_tolerance.relative) &&
            question.numeric_tolerance.relative >= 0)) &&
        Array.isArray(question.hints) &&
        question.hints.every((hint) => typeof hint === "string") &&
        (question.hint_count === undefined ||
          (typeof question.hint_count === "number" &&
            Number.isInteger(question.hint_count) &&
            question.hint_count >= question.hints.length &&
            question.hint_count <= 64)) &&
        (question.choices === undefined ||
          (Array.isArray(question.choices) &&
            question.choices.every((choice) => typeof choice === "string"))) &&
        (!["choice", "proof"].includes(String(question.kind)) ||
          (Array.isArray(question.choices) &&
            question.choices.length >= 2 &&
            question.choices.every((choice) => typeof choice === "string" && choice.trim().length > 0) &&
            new Set(question.choices).size === question.choices.length)),
    )
  );
}

function safeAnswers(value: unknown, current: AssessmentSession): AnswerMap {
  if (!isRecord(value)) return {};
  const allowed = new Set(current.questions.map((question) => question.id));
  return Object.fromEntries(
    Object.entries(value).filter(
      ([id, answer]) => allowed.has(id) && typeof answer === "string" && answer.length <= 4000,
    ),
  ) as AnswerMap;
}

function readDraft(key: string): SavedDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.version !== 2 ||
      typeof value.sessionId !== "string" ||
      typeof value.roadmapSlug !== "string" ||
      (value.topicSlug !== null && typeof value.topicSlug !== "string") ||
      !["practice", "exam", "review"].includes(String(value.mode)) ||
      !Number.isInteger(value.stageIndex) ||
      typeof value.startedAt !== "number" ||
      !Number.isFinite(value.startedAt) ||
      typeof value.revision !== "number" ||
      !Number.isInteger(value.revision) ||
      value.revision < 0 ||
      value.revision > MAX_REVISION ||
      !publicSession(value.session) ||
      value.session.id !== value.sessionId
    ) {
      return null;
    }
    return { ...value, answers: safeAnswers(value.answers, value.session) } as SavedDraft;
  } catch {
    return null;
  }
}

function sessionSnapshot(current: AssessmentSession): AssessmentSession {
  return {
    id: current.id,
    mode: current.mode,
    roadmap_slug: current.roadmap_slug,
    topic_slug: current.topic_slug,
    expires_at: current.expires_at,
    pass_score: current.pass_score,
    hint_usage: current.hint_usage ?? null,
    questions: current.questions.map((question) => ({
      id: question.id,
      kind: question.kind,
      prompt: question.prompt,
      choices: question.choices,
      hints: question.hints,
      hint_count: question.hint_count,
      concept: question.concept,
      difficulty: question.difficulty,
      topic_slug: question.topic_slug,
      lesson_title: question.lesson_title,
      math_input_version: question.math_input_version,
      answer_format: question.answer_format,
      tolerance: question.tolerance,
      numeric_tolerance: question.numeric_tolerance,
    })),
  };
}

function elapsedSeconds(origin: number) {
  return Math.min(MAX_TIME_SECONDS, Math.max(0, Math.floor((Date.now() - origin) / 1000)));
}

function answerHelp(question: MathQuestion) {
  if (question.kind === "vector")
    return 'Enter [1/2, sqrt(2)] or 1/2, sqrt(2). Entries may be fractions or expressions; quoted entries such as ["1/2", 3] also work.';
  if (question.kind === "matrix")
    return "Enter rows as [[1, 2], [3, 4]] or 1,2;3,4. Each entry accepts fractions, sqrt(...), pi, and powers.";
  if (question.kind === "proof")
    return "Put the numbered steps in logical order, for example [3, 1, 2]. Use each step once.";
  if (question.answer_format === "integer")
    return "Enter an exact whole-number answer. Arithmetic expressions such as 2^5 or 12/3 are accepted; the result must be an integer.";
  const precision = question.numeric_tolerance
    ? "The absolute tolerance is " +
      question.numeric_tolerance.absolute +
      " and relative tolerance is " +
      question.numeric_tolerance.relative +
      "."
    : question.tolerance === undefined
      ? "Decimal answers are accepted within the stated precision."
      : "The comparison tolerance is " + question.tolerance + ".";
  return (
    "Enter a number or expression such as 3/4, sqrt(2), pi/3, or 2^5. Use * for multiplication. " + precision
  );
}

function questionAnswered(question: MathQuestion, value: string | undefined) {
  if (!value?.trim()) return false;
  if (question.kind !== "proof") return true;
  const parsed = parseProofOrder(value, question.choices?.length ?? 0);
  return parsed.issue === null && parsed.order.length === question.choices?.length;
}

function resultMessage(result: AssessmentResult, mode: Mode) {
  if (!result.passed)
    return "Review the worked feedback, then try a new session. Your mistakes are saved for targeted practice.";
  if (mode !== "practice") return "Assessment passed. Your responses have been saved.";
  if (result.independent_passed === true) return "Independent practice passed. Your progress has been saved.";
  if (result.assistance === "assisted")
    return "Practice passed with hints. Try another session without hints to strengthen independent work.";
  return "Practice passed. Your progress has been saved.";
}

function answerAssistance(item: AssessmentResult["feedback"][number]) {
  if (item.assistance === "independent" && item.hints_used === 0) return "Independent answer · No hints used";
  if (item.assistance === "assisted" || (typeof item.hints_used === "number" && item.hints_used > 0))
    return (
      "Assisted answer" +
      (typeof item.hints_used === "number"
        ? " · " + item.hints_used + (item.hints_used === 1 ? " hint used" : " hints used")
        : "")
    );
  return "Hint usage untracked";
}

export function AssessmentPanel({
  roadmapSlug,
  topicSlug,
  stageIndex = 0,
  mode = "practice",
  onCompleted,
  reviewAvailable = true,
}: AssessmentProps) {
  const scopedTopic = mode === "practice" ? topicSlug : undefined;
  const draftKey =
    "brainhub:assessment:v2:" + roadmapSlug + ":" + mode + ":" + (scopedTopic ?? "stage-" + stageIndex);
  return (
    <AssessmentWorkspace
      key={draftKey}
      draftKey={draftKey}
      roadmapSlug={roadmapSlug}
      topicSlug={scopedTopic}
      stageIndex={stageIndex}
      mode={mode}
      onCompleted={onCompleted}
      reviewAvailable={reviewAvailable}
    />
  );
}

function AssessmentWorkspace({
  roadmapSlug,
  topicSlug,
  stageIndex,
  mode,
  draftKey,
  onCompleted,
  reviewAvailable,
}: Required<Pick<AssessmentProps, "roadmapSlug" | "stageIndex" | "mode">> & {
  topicSlug?: string;
  draftKey: string;
  onCompleted?: (result: AssessmentResult) => void;
  reviewAvailable: boolean;
}) {
  const { acceptProgress } = useRoadmapProgress();
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(true);
  const [expired, setExpired] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [needsResume, setNeedsResume] = useState(false);
  const [draftStatus, setDraftStatus] = useState("Answers are saved on this device while you work.");
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [hintPending, setHintPending] = useState(false);
  const mounted = useRef(true);
  const startedAt = useRef(0);
  const submitting = useRef(false);
  const currentSession = useRef<AssessmentSession | null>(null);
  const currentAnswers = useRef<AnswerMap>({});
  const pendingHints = useRef(new Set<string>());
  const cached = useRef<SavedDraft | null>(null);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const finished = useRef(false);
  const notifiedResults = useRef(new Set<string>());
  const completedCallback = useRef(onCompleted);

  useEffect(() => {
    completedCallback.current = onCompleted;
  }, [onCompleted]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const matchesScope = useCallback(
    (candidate: AssessmentSession) =>
      candidate.roadmap_slug === roadmapSlug &&
      candidate.mode === mode &&
      candidate.topic_slug === (topicSlug ?? null),
    [mode, roadmapSlug, topicSlug],
  );

  const remember = useCallback(
    (activeSession: AssessmentSession, values: AnswerMap, currentRevision: number) => {
      const next: SavedDraft = {
        version: 2,
        sessionId: activeSession.id,
        roadmapSlug,
        topicSlug: topicSlug ?? null,
        stageIndex,
        mode,
        answers: values,
        startedAt: startedAt.current,
        revision: currentRevision,
        session: sessionSnapshot(activeSession),
      };
      cached.current = next;
      try {
        localStorage.setItem(draftKey, JSON.stringify(next));
        return true;
      } catch {
        return false;
      }
    },
    [draftKey, mode, roadmapSlug, stageIndex, topicSlug],
  );

  const markHintPending = useCallback((questionId: string, pending: boolean) => {
    if (pending) pendingHints.current.add(questionId);
    else pendingHints.current.delete(questionId);
    if (mounted.current) setHintPending(pendingHints.current.size > 0);
  }, []);

  const acceptHints = useCallback(
    (sessionId: string, response: HintReveal) => {
      const active = currentSession.current;
      if (!mounted.current || finished.current || active?.id !== sessionId || active.hint_usage == null)
        return;
      const hintUsage = { ...active.hint_usage };
      for (const [id, count] of Object.entries(response.hint_usage))
        hintUsage[id] = Math.max(hintUsage[id] ?? 0, count);
      const next: AssessmentSession = {
        ...active,
        hint_usage: hintUsage,
        questions: active.questions.map((question) =>
          question.id === response.question_id &&
          response.hints_used >= (active.hint_usage?.[question.id] ?? 0)
            ? { ...question, hints: response.hints, hint_count: response.hint_count }
            : question,
        ),
      };
      currentSession.current = next;
      setSession(next);
      remember(next, currentAnswers.current, revision.current);
    },
    [remember],
  );

  const clearMatchingDraft = useCallback(
    (sessionId: string) => {
      try {
        const stored = readDraft(draftKey);
        if (stored?.sessionId === sessionId) localStorage.removeItem(draftKey);
      } catch {
        // A confirmed server result remains recoverable if local removal fails.
      }
      if (cached.current?.sessionId === sessionId) cached.current = null;
      setSavedSessionId(null);
    },
    [draftKey],
  );

  const showResult = useCallback(
    (next: AssessmentResult, sessionId: string) => {
      finished.current = true;
      setResult(next);
      setExpired(false);
      setNeedsResume(false);
      setError(null);
      clearMatchingDraft(sessionId);
      if (next.progress) acceptProgress(next.progress);
      if (!notifiedResults.current.has(sessionId)) {
        notifiedResults.current.add(sessionId);
        completedCallback.current?.(next);
      }
    },
    [acceptProgress, clearMatchingDraft],
  );

  const restore = useCallback(
    (restored: AssessmentSession, local: SavedDraft | null) => {
      if (!publicSession(restored) || !matchesScope(restored)) {
        throw new Error("The saved assessment belongs to a different lesson or assessment mode.");
      }
      currentSession.current = restored;
      setSession(restored);
      setSavedSessionId(restored.id);
      if (restored.result) {
        showResult(restored.result, restored.id);
        return;
      }
      const serverRevision = restored.draft?.revision ?? 0;
      const applicableLocal = local?.sessionId === restored.id && matchesScope(local.session) ? local : null;
      const serverValues = Object.fromEntries(
        (restored.draft?.answers ?? []).map((answer) => [
          answer.question_id,
          typeof answer.answer === "string" ? answer.answer : JSON.stringify(answer.answer),
        ]),
      );
      const nextAnswers =
        applicableLocal && applicableLocal.revision > serverRevision
          ? safeAnswers(applicableLocal.answers, restored)
          : safeAnswers(serverValues, restored);
      revision.current = Math.max(serverRevision, applicableLocal?.revision ?? 0);
      savedRevision.current = serverRevision;
      const timeAlreadySpent = Math.max(
        restored.draft?.time_spent_seconds ?? 0,
        applicableLocal ? elapsedSeconds(applicableLocal.startedAt) : 0,
      );
      startedAt.current = Date.now() - Math.min(MAX_TIME_SECONDS, timeAlreadySpent) * 1000;
      finished.current = false;
      currentAnswers.current = nextAnswers;
      setAnswers(nextAnswers);
      setResult(null);
      setNeedsResume(false);
      setExpired(Date.parse(restored.expires_at) <= Date.now());
      setError(null);
      remember(restored, nextAnswers, revision.current);
      setDraftStatus(
        revision.current > serverRevision
          ? "Restored your latest device answers. Profile sync will retry."
          : "Restored your saved assessment and answers.",
      );
    },
    [matchesScope, remember, showResult],
  );

  const keepUnavailableDraft = useCallback((local: SavedDraft, problem: unknown) => {
    currentSession.current = local.session;
    revision.current = local.revision;
    savedRevision.current = -1;
    startedAt.current = Date.now() - elapsedSeconds(local.startedAt) * 1000;
    setSession(local.session);
    currentAnswers.current = local.answers;
    setAnswers(local.answers);
    const noLongerOpen =
      (problem instanceof ApiError && [404, 409, 410].includes(problem.status)) ||
      Date.parse(local.session.expires_at) <= Date.now();
    setExpired(noLongerOpen);
    setNeedsResume(!noLongerOpen);
    setDraftStatus("Your answers were restored from this device.");
    setError(
      problem instanceof ApiError && problem.status === 409
        ? "The curriculum changed since this assessment started. Your saved answers are preserved below. Start a fresh session when ready."
        : noLongerOpen
          ? "This assessment is no longer open. Your saved answers are preserved below. Start a fresh session when ready."
          : "Profile sync is unavailable. Your saved answers are still here; retry reopening the session when connected.",
    );
  }, []);

  useEffect(() => {
    let active = true;
    async function recover() {
      const local = readDraft(draftKey);
      if (
        local &&
        local.roadmapSlug === roadmapSlug &&
        local.topicSlug === (topicSlug ?? null) &&
        local.stageIndex === stageIndex &&
        local.mode === mode &&
        matchesScope(local.session)
      ) {
        cached.current = local;
        setSavedSessionId(local.sessionId);
        try {
          const restored = await api.resumeAssessment(local.sessionId);
          if (active) restore(restored, local);
        } catch (problem) {
          if (active) keepUnavailableDraft(local, problem);
        }
      }
      if (active) setRecovering(false);
    }
    void recover();
    return () => {
      active = false;
    };
  }, [draftKey, keepUnavailableDraft, matchesScope, mode, restore, roadmapSlug, stageIndex, topicSlug]);

  useEffect(() => {
    if (!session || result || expired || recovering || revision.current <= savedRevision.current) return;
    let active = true;
    const savingRevision = revision.current;
    const timer = window.setTimeout(async () => {
      try {
        const saved = await api.saveAssessmentDraft(session.id, {
          answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer })),
          time_spent_seconds: elapsedSeconds(startedAt.current),
          revision: savingRevision,
        });
        if (!active || finished.current || revision.current !== savingRevision) return;
        savedRevision.current = saved.draft?.revision ?? savingRevision;
        setNeedsResume(false);
        setDraftStatus("Draft saved to your profile.");
      } catch (problem) {
        if (!active || finished.current || revision.current !== savingRevision) return;
        if (problem instanceof ApiError && problem.status === 410) {
          setExpired(true);
          setError(
            "This assessment expired. Your answers are preserved below. Start a fresh session when ready.",
          );
          return;
        }
        if (problem instanceof ApiError && problem.status === 409) {
          try {
            const latest = await api.resumeAssessment(session.id);
            if (active && revision.current === savingRevision) restore(latest, cached.current);
            return;
          } catch (reopenProblem) {
            if (
              active &&
              revision.current === savingRevision &&
              cached.current &&
              reopenProblem instanceof ApiError &&
              [404, 409, 410].includes(reopenProblem.status)
            ) {
              keepUnavailableDraft(cached.current, reopenProblem);
              return;
            }
            // Keep the editable device draft if the profile cannot be reopened.
          }
        }
        setNeedsResume(true);
        setDraftStatus(
          "Profile sync is unavailable. Your answers are kept on this device when storage is available.",
        );
      }
    }, 700);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [answers, expired, keepUnavailableDraft, recovering, restore, result, saveAttempt, session]);

  useEffect(() => {
    function retryOnline() {
      setSaveAttempt((attempt) => attempt + 1);
    }
    window.addEventListener("online", retryOnline);
    return () => window.removeEventListener("online", retryOnline);
  }, []);

  function updateAnswer(questionId: string, value: string) {
    if (submitting.current || !session || expired) return;
    const next = { ...answers, [questionId]: value.slice(0, 4000) };
    currentAnswers.current = next;
    revision.current = Math.min(MAX_REVISION, revision.current + 1);
    setAnswers(next);
    const savedLocally = remember(currentSession.current ?? session, next, revision.current);
    setDraftStatus(
      savedLocally
        ? "Saved on this device. Syncing to your profile…"
        : "Device storage is unavailable. Trying profile backup…",
    );
  }

  async function resumeSaved() {
    const local = cached.current;
    if (!local || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const latest = await api.resumeAssessment(local.sessionId);
      if (mounted.current) restore(latest, local);
    } catch (problem) {
      if (mounted.current) keepUnavailableDraft(local, problem);
    } finally {
      if (mounted.current) {
        submitting.current = false;
        setBusy(false);
      }
    }
  }

  async function start() {
    if (submitting.current || (mode === "review" && !reviewAvailable)) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await api.startAssessment(roadmapSlug, {
        mode,
        topic_slug: topicSlug,
        stage_index: stageIndex,
      });
      if (!mounted.current) return;
      if (!publicSession(next) || !matchesScope(next))
        throw new Error("The assessment could not be opened in this learning track.");
      currentSession.current = next;
      startedAt.current = Date.now();
      revision.current = next.draft?.revision ?? 0;
      savedRevision.current = revision.current;
      finished.current = false;
      setSession(next);
      setSavedSessionId(next.id);
      setResult(null);
      currentAnswers.current = {};
      setAnswers({});
      setExpired(false);
      setNeedsResume(false);
      const savedLocally = remember(next, {}, revision.current);
      setDraftStatus(
        savedLocally
          ? "Your session is saved on this device."
          : "Device storage is unavailable. Answers can still sync to your profile.",
      );
    } catch (problem) {
      if (mounted.current)
        setError(problem instanceof Error ? problem.message : "Unable to start. Please try again.");
    } finally {
      if (mounted.current) {
        submitting.current = false;
        setBusy(false);
      }
    }
  }

  async function submit() {
    if (!session || expired || submitting.current || pendingHints.current.size > 0) return;
    const missing = session.questions.find((question) => !questionAnswered(question, answers[question.id]));
    if (missing) {
      setError(
        missing.kind === "proof"
          ? "Select every proof step exactly once before submitting. Your order and other answers are kept."
          : "Answer every question before submitting. Your entries are kept while you complete the set.",
      );
      document.getElementById("question-" + missing.id)?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await api.submitAssessment(session.id, {
        answers: session.questions.map((question) => ({
          question_id: question.id,
          answer: answers[question.id],
        })),
        time_spent_seconds: elapsedSeconds(startedAt.current),
      });
      if (mounted.current) showResult(next, session.id);
    } catch (problem) {
      if (!mounted.current) return;
      if (problem instanceof ApiError && problem.status === 410) {
        setExpired(true);
        setError(
          "This assessment expired. Your answers are preserved below. Start a fresh session when ready.",
        );
      } else {
        // A request can commit successfully even when its response is lost.
        try {
          const latest = await api.resumeAssessment(session.id);
          if (mounted.current && latest.result) {
            showResult(latest.result, session.id);
            return;
          }
        } catch {
          // Retain the same session and answers so an idempotent retry is safe.
        }
        if (mounted.current)
          setError(
            problem instanceof Error
              ? problem.message
              : "Unable to grade. Your answers are still here; try again.",
          );
      }
    } finally {
      if (mounted.current) {
        submitting.current = false;
        setBusy(false);
      }
    }
  }

  const answered =
    session?.questions.filter((question) => questionAnswered(question, answers[question.id])).length ?? 0;
  const title =
    mode === "exam"
      ? "Stage " + (stageIndex + 1) + " examination"
      : mode === "review"
        ? "Targeted retrieval practice"
        : "Practice and mastery";
  const cannotStart = busy || (mode === "review" && !reviewAvailable);
  return (
    <section
      className="panel scroll-mt-24 p-6 sm:p-8"
      id="practice"
      aria-labelledby={"assessment-" + mode}
      aria-busy={busy || recovering}
    >
      <p className="metric text-[#63e6be]">Apply the mathematics</p>
      <h2 className="mt-2 text-2xl font-semibold" id={"assessment-" + mode}>
        {title}
      </h2>
      <p className="mt-3 leading-7 text-[#9ba8b9]">
        {mode === "exam"
          ? "Twelve reserved questions cover all six lessons. Complete each lesson practice set first. A score of 75% passes the exam."
          : mode === "review"
            ? "Revisit questions selected from your recent mistakes and due recall practice."
            : "Solve eight questions to check the lesson. A score of 75% completes it. Worked feedback appears after you submit."}
      </p>
      {recovering ? (
        <p className="mt-5 text-sm text-[#94a8c0]" role="status">
          Checking for a saved assessment…
        </p>
      ) : null}
      {!session && !recovering ? (
        <button
          className="btn btn-primary mt-5 inline-flex items-center gap-2"
          onClick={start}
          disabled={cannotStart}
          type="button"
        >
          <Play size={15} />
          {busy ? "Preparing…" : "Start " + mode}
        </button>
      ) : null}
      {mode === "review" && !reviewAvailable ? (
        <p className="mt-4 text-sm leading-7 text-[#9ba8b9]" role="status">
          No more questions are due for this subject. Your current answers and feedback remain available.
        </p>
      ) : null}
      {needsResume && savedSessionId && !expired && !result ? (
        <button className="btn mt-5" onClick={resumeSaved} disabled={busy} type="button">
          Resume saved session
        </button>
      ) : null}
      {expired && session && !result ? (
        <div
          className="mt-6 rounded-xl border border-[#705332] bg-[#211a10] p-5"
          aria-label="Saved answers from closed assessment"
        >
          <h3 className="text-lg font-semibold">Your saved answers</h3>
          <p className="mt-2 text-sm leading-7 text-[#baad96]">
            This attempt is closed. You can read and copy your responses before starting again.
          </p>
          <ol className="mt-4 space-y-4">
            {session.questions
              .filter((question) => answers[question.id] !== undefined)
              .map((question) => (
                <li key={question.id}>
                  <p className="leading-8">
                    <MathText>{question.prompt}</MathText>
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-[#0d121b] p-3 text-sm">
                    {answers[question.id]}
                  </pre>
                </li>
              ))}
          </ol>
          <button className="btn btn-primary mt-5" type="button" disabled={cannotStart} onClick={start}>
            {busy ? "Preparing…" : "Start a fresh session"}
          </button>
        </div>
      ) : null}
      {session && !result && !expired ? (
        <div className="mt-6">
          <p className="mb-3 text-sm text-[#91a1b5]" aria-live="polite">
            {answered} of {session.questions.length} answered · {session.pass_score}% to pass
          </p>
          <p className="mb-5 text-xs leading-6 text-[#91a1b5]" aria-live="polite">
            {draftStatus}
          </p>
          <div className="space-y-6">
            {session.questions.map((question, index) => (
              <fieldset
                className="rounded-xl border border-[#263449] p-4 sm:p-5"
                key={question.id}
                disabled={busy}
              >
                <legend className="px-2 text-xs text-[#8ea1bb]">
                  Question {index + 1} · {question.difficulty} · {question.concept}
                </legend>
                <p className="mb-4 leading-8">
                  <MathText>{question.prompt}</MathText>
                </p>
                {question.kind === "choice" ? (
                  <div className="grid gap-2">
                    {question.choices?.map((choice, choiceIndex) => (
                      <label
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#29384c] p-3 leading-7"
                        key={choice}
                      >
                        <input
                          className="mt-2"
                          type="radio"
                          name={question.id}
                          id={choiceIndex === 0 ? "question-" + question.id : undefined}
                          checked={answers[question.id] === choice}
                          onChange={() => updateAnswer(question.id, choice)}
                        />
                        <MathText>{choice}</MathText>
                      </label>
                    ))}
                  </div>
                ) : question.kind === "proof" ? (
                  <>
                    <ProofBuilder
                      id={"question-" + question.id}
                      choices={question.choices ?? []}
                      value={answers[question.id] ?? ""}
                      onChange={(value) => updateAnswer(question.id, value)}
                      disabled={busy}
                      label={"Answer to question " + (index + 1)}
                      describedBy={"help-" + question.id}
                    />
                    <p className="mt-2 text-xs leading-6 text-[#8396ad]" id={"help-" + question.id}>
                      {answerHelp(question)}
                    </p>
                  </>
                ) : (
                  <>
                    <label className="block text-sm text-[#b3c1d3]" htmlFor={"question-" + question.id}>
                      Answer to question {index + 1}
                    </label>
                    <input
                      className="math-answer mt-2"
                      id={"question-" + question.id}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={4000}
                      value={answers[question.id] ?? ""}
                      onChange={(event) => updateAnswer(question.id, event.target.value)}
                      aria-describedby={"help-" + question.id + " preview-" + question.id}
                    />
                    <p className="mt-2 text-xs leading-6 text-[#8396ad]" id={"help-" + question.id}>
                      {answerHelp(question)}
                    </p>
                    <MathAnswerPreview
                      question={question}
                      value={answers[question.id] ?? ""}
                      id={"preview-" + question.id}
                    />
                  </>
                )}
                {mode !== "exam" ? (
                  <QuestionHints
                    key={session.id + ":" + question.id}
                    sessionId={session.id}
                    question={question}
                    questionNumber={index + 1}
                    hintUsage={session.hint_usage}
                    disabled={busy}
                    onPendingChange={markHintPending}
                    onReveal={(response) => acceptHints(session.id, response)}
                  />
                ) : null}
              </fieldset>
            ))}
          </div>
          <button
            className="btn btn-primary mt-6"
            type="button"
            onClick={submit}
            disabled={busy || hintPending}
          >
            {busy ? "Grading…" : "Submit " + mode}
          </button>
        </div>
      ) : null}
      {result ? (
        <div className="mt-6">
          <div
            className={
              "rounded-xl border p-5 " +
              (result.passed ? "border-[#28654c] bg-[#10251c]" : "border-[#705332] bg-[#281e10]")
            }
            role="status"
          >
            <p className="flex items-center gap-2 text-xl font-semibold">
              {result.passed ? <CheckCircle2 size={21} /> : <CircleAlert size={21} />}
              {result.score}% · {result.correct}/{result.total} correct
            </p>
            <p className="mt-2 leading-7">{resultMessage(result, mode)}</p>
            <p className="mt-2 text-sm leading-7 text-[#a9c0d7]">
              {typeof result.independent_score === "number"
                ? "Independent score: " + result.independent_score + "%"
                : "Hint usage was not recorded for this older attempt."}
            </p>
            {typeof result.independent_score === "number" ? (
              <p className="mt-2 text-xs leading-6 text-[#8fa9c2]">
                Only correct answers completed without hints count toward the independent score.
              </p>
            ) : null}
            {result.assistance === "assisted" ? (
              <p className="mt-2 text-xs text-[#f5d67d]">This session included hint assistance.</p>
            ) : null}
          </div>
          <div className="mt-5 space-y-4">
            {result.feedback.map((item, index) => (
              <details
                className="rounded-xl border border-[#29374a] p-4"
                key={item.question_id}
                open={!item.correct}
              >
                <summary className="cursor-pointer font-semibold">
                  Question {index + 1}: {item.correct ? "Correct" : "Review needed"} · {item.concept}
                </summary>
                <p className="mt-3 text-xs leading-6 text-[#9db4cf]">{answerAssistance(item)}</p>
                <p className="mt-3 leading-8">
                  <MathText>{item.prompt}</MathText>
                </p>
                {item.proof_details ? (
                  <section className="mt-4 space-y-4" aria-label="Proof order feedback">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <section>
                        <h3 className="font-semibold text-[#b9c8dc]">Your submitted argument</h3>
                        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-7 text-[#a8bcd3]">
                          {item.proof_details.submitted_steps.map((step) => (
                            <li key={step.step}>
                              <span className="mr-2 font-mono text-xs text-[#a78bfa]">Step {step.step}</span>
                              <MathText>{step.text}</MathText>
                            </li>
                          ))}
                        </ol>
                      </section>
                      <section>
                        <h3 className="font-semibold text-[#63e6be]">One valid proof</h3>
                        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-7 text-[#b6d5c9]">
                          {item.proof_details.expected_steps.map((step) => (
                            <li key={step.step}>
                              <span className="mr-2 font-mono text-xs text-[#9cd8bc]">Step {step.step}</span>
                              <MathText>{step.text}</MathText>
                              {step.justification ? (
                                <p className="mt-2 text-xs leading-7 text-[#91b5a5]">
                                  <MathText>{step.justification}</MathText>
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      </section>
                    </div>
                    <p className="text-sm leading-7 text-[#a8bbd1]">
                      Correct initial steps: {item.proof_details.correct_prefix_length} of{" "}
                      {item.proof_details.total_steps}.
                      {item.proof_details.first_divergence === null
                        ? ""
                        : " The first difference is at position " + item.proof_details.first_divergence + "."}
                    </p>
                    {item.proof_details.violated_dependencies?.length ? (
                      <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-[#f8cf93]">
                        {item.proof_details.violated_dependencies.map((dependency) => (
                          <li key={dependency.step + ":" + dependency.requires}>
                            Step {dependency.step} requires step {dependency.requires} to appear earlier.
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="leading-8 text-[#b9c9dc]">
                      <MathText>{item.proof_details.explanation}</MathText>
                    </p>
                  </section>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-[#94a5ba]">
                      Your answer:{" "}
                      <code className="break-all">
                        {typeof item.submitted_answer === "string"
                          ? item.submitted_answer
                          : JSON.stringify(item.submitted_answer)}
                      </code>
                    </p>
                    <p className="mt-2 text-sm text-[#63e6be]">
                      Expected: <code className="break-all">{JSON.stringify(item.expected_answer)}</code>
                    </p>
                  </>
                )}
                <p className="mt-4 leading-8 text-[#becada]">
                  <MathText>{item.solution}</MathText>
                </p>
              </details>
            ))}
          </div>
          <button
            className="btn mt-5 inline-flex items-center gap-2"
            onClick={start}
            disabled={cannotStart}
            type="button"
          >
            <RotateCcw size={15} />
            Start another session
          </button>
        </div>
      ) : null}
      <div aria-live="assertive">
        {error ? (
          <p
            className="mt-5 rounded-xl border border-[#704533] bg-[#261611] p-4 leading-7 text-[#fdba9a]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
