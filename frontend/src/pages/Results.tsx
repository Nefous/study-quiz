import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Award,
  ChevronDown,
  ChevronUp,
  History,
  Lightbulb,
  RefreshCw,
  Star,
  Target,
  Trophy
} from "lucide-react";
import {
  createAttempt,
  difficultyLabels,
  getAttempt,
  getAttemptAiReview,
  getAttemptReview,
  listFavoriteQuestions,
  favoriteQuestion,
  unfavoriteQuestion,
  topicLabels
} from "../api";
import type {
  AiReviewResponse,
  AttemptReviewItem,
  QuizMode,
  QuizQuestion,
  QuizSummary,
  Topic
} from "../api/types";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import CodeBlock from "../components/ui/CodeBlock";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import { cn } from "../components/ui/cn";
import { useAuth } from "../context/AuthContext";
import { PERCENT_MULTIPLIER, SCORE_THRESHOLDS } from "../config/quiz";

type ResultsState = {
  settings: {
    topic: string;
    topics?: Topic[];
    difficulty: string;
    mode: QuizMode;
    attempt_type?: "normal" | "mistakes_review";
    size?: number;
  };
  quiz_id: string;
  attempt_id?: string;
  questions: QuizQuestion[];
  answers: Record<string, string>;
  mode: QuizMode;
  raw_score_percent?: number;
  usedHintsCount?: number;
  penaltyTotal?: number;
  timed_out?: boolean;
  time_limit_seconds?: number;
  time_spent_seconds?: number;
  started_at?: string;
  finished_at?: string;
  summary?: QuizSummary;
  penaltyByQuestion?: Record<string, number>;
  practiceResults?: Record<
    string,
    { correct: boolean; correctAnswer?: string; explanation?: string | null }
  >;
};

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const createAttemptOnceRef = useRef(false);
  const lastFetchedAttemptIdRef = useRef<string | null>(null);
  const lastFetchedAiReviewIdRef = useRef<string | null>(null);
  const { status } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<QuizSummary | null>(null);
  const [attemptMode, setAttemptMode] = useState<QuizMode | null>(null);
  const [attemptType, setAttemptType] = useState<"normal" | "mistakes_review" | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [aiReview, setAiReview] = useState<AiReviewResponse | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewError, setAiReviewError] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<AttemptReviewItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [serverAttemptId, setServerAttemptId] = useState<string | null>(null);
  const [creatingAttempt, setCreatingAttempt] = useState(false);
  const [attemptReady, setAttemptReady] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<Record<string, boolean>>({});
  const state = (location.state as ResultsState | null) ?? readStoredResults();

  const settings = state?.settings;
  const questions = state?.questions ?? [];
  const answers = state?.answers ?? {};
  const mode = state?.mode ?? attemptMode ?? "practice";
  const effectiveAttemptType = state?.settings?.attempt_type ?? attemptType ?? "normal";
  const practiceResults = state?.practiceResults;
  const attemptId =
    (params.attemptId as string | undefined) ?? state?.attempt_id ?? serverAttemptId ?? null;
  const isPractice = mode === "practice";
  const isExam = mode === "exam";
  const isMistakesReview = effectiveAttemptType === "mistakes_review";
  const hasDetails = Boolean(state && settings && questions.length > 0);
  const aiReviewStatus = aiReview?.status;
  const aiReviewNotGenerated = aiReviewStatus === "not_generated" || aiReviewStatus === "pending";

  const immediateSummary = useMemo<QuizSummary | null>(() => {
    if (state?.summary) return state.summary;
    if (!state?.questions?.length) return null;
    const totalCount = state.questions.length;
    const correctCount = state.questions.reduce((acc, question) => {
      const result = state.practiceResults?.[question.id];
      if (result) return acc + (result.correct ? 1 : 0);
      const expected = normalize(question.correct_answer ?? "");
      const provided = normalize(state.answers?.[question.id] ?? "");
      return acc + (expected === provided ? 1 : 0);
    }, 0);
    const percent = totalCount ? Math.round((correctCount / totalCount) * 100) : 0;
    return {
      total: totalCount,
      correct: correctCount,
      percent,
      timeUsedSec: state.time_spent_seconds ?? undefined,
      timeLimitSec: state.time_limit_seconds ?? undefined
    };
  }, [state]);

  const effectiveSummary = summary ?? immediateSummary;
  const total = effectiveSummary?.total ?? 0;
  const correct = effectiveSummary?.correct ?? 0;
  const usedHintsCount = state?.usedHintsCount ?? 0;
  const penaltyByQuestion = state?.penaltyByQuestion ?? {};
  const finalScore = effectiveSummary ? clamp(effectiveSummary.percent, 0, 100) : 0;

  const displayTopic = settings
    ? settings.topic === "random"
      ? "Random"
      : settings.topics && settings.topics.length > 1
        ? "Mix"
        : settings.topics && settings.topics.length === 1
          ? topicLabels[settings.topics[0]]
          : topicLabels[settings.topic as keyof typeof topicLabels] ?? settings.topic
    : "Unknown";

  const timeLimit = effectiveSummary?.timeLimitSec ?? state?.time_limit_seconds ?? null;
  const timeSpent = effectiveSummary?.timeUsedSec ?? state?.time_spent_seconds ?? null;
  const timedOut = Boolean(state?.timed_out);
  const timeMessage = timeLimit !== null && timeSpent !== null
    ? `Time used: ${formatTime(timeSpent)} / ${formatTime(timeLimit)}${timedOut ? " (Timed out)" : ""}`
    : timedOut
      ? "Timed out"
      : null;

  const attemptPayload = useMemo(() => {
    if (!state || !effectiveSummary || !settings) return null;
    const totalCount = effectiveSummary.total;
    const correctCount = effectiveSummary.correct;
    const selectedTopics = settings.topics ?? [];
    const topicValue = settings.topic === "random"
      ? "random"
      : selectedTopics.length > 1
        ? "mix"
        : selectedTopics[0] ?? settings.topic;

    return {
      attempt_id: attemptId ?? undefined,
      topic: topicValue,
      meta: selectedTopics.length > 1 ? { topics: selectedTopics } : undefined,
      difficulty: settings.difficulty,
      mode: settings.mode,
      attempt_type: settings.attempt_type ?? undefined,
      size: settings.size,
      correct_count: correctCount,
      total_count: totalCount,
      answers: questions.map((question) => {
        const expected = normalize(question.correct_answer ?? "");
        const provided = normalize(answers[question.id] ?? "");
        const isCorrect = expected === provided;
        return {
          question_id: question.id,
          selected_answer: answers[question.id] ?? "",
          is_correct: isCorrect
        };
      }),
      started_at: state?.started_at ?? null,
      finished_at: state?.finished_at ?? null,
      time_limit_seconds: state?.time_limit_seconds ?? null,
      time_spent_seconds: state?.time_spent_seconds ?? null,
      timed_out: state?.timed_out ?? null
    };
  }, [answers, questions, settings, state, effectiveSummary]);

  const ensureServerAttempt = async (): Promise<string | null> => {
    if (attemptId) return attemptId;
    if (!attemptPayload || creatingAttempt) return null;
    setCreatingAttempt(true);
    try {
      const createdAttempt = await createAttempt(attemptPayload);
      setServerAttemptId(createdAttempt.id);
      setAttemptReady(true);
      window.history.replaceState(null, "", `/results/${createdAttempt.id}`);
      return createdAttempt.id;
    } finally {
      setCreatingAttempt(false);
    }
  };

  const handleAiReview = async () => {
    const id = await ensureServerAttempt();
    if (!id) return;
    lastFetchedAiReviewIdRef.current = id;
    setAiReviewLoading(true);
    setAiReviewError(null);
    try {
      const data = await getAttemptAiReview(id, true);
      setAiReview(data);
    } catch (err) {
      setAiReviewError(err instanceof Error ? err.message : "Failed to load AI review");
    } finally {
      setAiReviewLoading(false);
    }
  };

  useEffect(() => {
    setAiReview(null);
    setAiReviewError(null);
    setAttemptReady(false);
    lastFetchedAiReviewIdRef.current = null;
  }, [attemptId]);

  useEffect(() => {
    if (status !== "authed") return;
    if (!attemptId) return;
    if (state?.summary && state?.attempt_id && attemptId === state.attempt_id) {
      setSummary(state.summary);
      return;
    }
    if (lastFetchedAttemptIdRef.current === attemptId) return;
    lastFetchedAttemptIdRef.current = attemptId;
    setSummaryLoading(true);
    setSummaryError(null);
    getAttempt(attemptId)
      .then((attempt) => {
        setSummary({
          total: attempt.total_count,
          correct: attempt.correct_count,
          percent: attempt.score_percent,
          timeUsedSec: attempt.time_spent_seconds ?? undefined,
          timeLimitSec: attempt.time_limit_seconds ?? undefined
        });
        setAttemptMode(attempt.mode);
        setAttemptType((attempt as { attempt_type?: "normal" | "mistakes_review" }).attempt_type ?? null);
        setAttemptReady(true);
      })
      .catch((err) => {
        setSummaryError(err instanceof Error ? err.message : "Failed to load summary");
      })
      .finally(() => setSummaryLoading(false));
  }, [attemptId, state?.summary, status]);

  useEffect(() => {
    let active = true;
    const loadFavorites = async () => {
      try {
        const favorites = await listFavoriteQuestions(200, 0);
        if (!active) return;
        setFavoriteIds(new Set(favorites.map((item) => item.id)));
      } catch {
        if (active) {
          setFavoriteIds(new Set());
        }
      }
    };
    void loadFavorites();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status !== "authed") return;
    if (!attemptId) return;
    if (lastFetchedAiReviewIdRef.current === attemptId) return;
    lastFetchedAiReviewIdRef.current = attemptId;
    setAiReviewLoading(true);
    setAiReviewError(null);
    getAttemptAiReview(attemptId, false)
      .then((data) => setAiReview(data))
      .catch((err) => {
        setAiReviewError(err instanceof Error ? err.message : "Failed to load AI review");
      })
      .finally(() => setAiReviewLoading(false));
  }, [attemptId, status]);

  useEffect(() => {
    if (status !== "authed") return;
    if (!attemptId) return;
    if (!isMistakesReview) return;
    setReviewLoading(true);
    setReviewError(null);
    getAttemptReview(attemptId)
      .then((items) => setReviewItems(items))
      .catch((err) => {
        setReviewError(err instanceof Error ? err.message : "Failed to load review");
      })
      .finally(() => setReviewLoading(false));
  }, [attemptId, isMistakesReview, status]);

  useEffect(() => {
    if (createAttemptOnceRef.current) return;
    if (!state) return;
    if (!effectiveSummary) return;
    if (!settings) return;
    if (status !== "authed") return;
    if (attemptId) return;
    if (attemptId && state.attempt_id && attemptId !== state.attempt_id) return;
    if (attemptId && !state.attempt_id && state.quiz_id && attemptId !== state.quiz_id) return;
    if (!attemptPayload) return;
    if (params.attemptId) return;

    const storageKey = state.quiz_id
      ? `attempt_saved_${state.quiz_id}`
      : attemptId
        ? `attempt_saved_${attemptId}`
        : "attempt_saved_unknown";
    if (localStorage.getItem(storageKey)) return;

    createAttemptOnceRef.current = true;

    createAttempt(attemptPayload)
      .then((createdAttempt) => {
        localStorage.setItem(storageKey, "1");
        setServerAttemptId(createdAttempt.id);
        setAttemptReady(true);
        if (attemptId !== createdAttempt.id) {
          window.history.replaceState(null, "", `/results/${createdAttempt.id}`);
        }
      })
      .catch(() => {
        localStorage.removeItem(storageKey);
        createAttemptOnceRef.current = false;
      });
  }, [attemptId, attemptPayload, params.attemptId, settings, state, status, effectiveSummary]);

  const breakdown = useMemo(() => {
    const byType: Record<string, { correct: number; total: number }> = {};
    questions.forEach((q) => {
      const type = q.type;
      if (!byType[type]) {
        byType[type] = { correct: 0, total: 0 };
      }
      byType[type].total += 1;
      if (isPractice) {
        const correct =
          practiceResults?.[q.id]?.correct ??
          normalize(q.correct_answer ?? "") === normalize(answers[q.id] ?? "");
        if (correct) byType[type].correct += 1;
      }
    });
    return byType;
  }, [answers, isPractice, practiceResults, questions]);

  const toggleFavorite = async (questionId: string) => {
    if (favoriteLoadingIds[questionId]) return;
    setFavoriteLoadingIds((prev) => ({ ...prev, [questionId]: true }));
    const isFavorited = favoriteIds.has(questionId);
    try {
      if (isFavorited) {
        await unfavoriteQuestion(questionId);
      } else {
        await favoriteQuestion(questionId);
      }
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFavorited) {
          next.delete(questionId);
        } else {
          next.add(questionId);
        }
        return next;
      });
    } finally {
      setFavoriteLoadingIds((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const query = useMemo(() => {
    if (!settings) return null;
    const params = new URLSearchParams({
      difficulty: settings.difficulty,
      mode: settings.mode,
      size: String(settings.size ?? questions.length)
    });
    if (settings.topic === "random") {
      params.set("topic", "random");
    } else if (settings.topics && settings.topics.length > 0) {
      params.set("topics", settings.topics.join(","));
    } else {
      params.set("topic", settings.topic);
    }
    return params;
  }, [questions.length, settings]);

  const showAuthLoading = status === "loading";
  const showGuest = status === "guest";
  const showNoAttempt = !attemptId && !state;
  const showSummaryLoading = !effectiveSummary && !showNoAttempt && !showAuthLoading && !showGuest;
  const canLoadAiReview = status === "authed";
  const showGenerateButton = canLoadAiReview && aiReviewNotGenerated && !aiReviewLoading;

  if (showAuthLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card variant="elevated" className="space-y-4">
          <div className="h-6 w-1/3 animate-pulse rounded bg-white/10" />
          <div className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />
        </Card>
      </div>
    );
  }

  if (showGuest) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card variant="elevated" className="space-y-4 text-center">
          <AlertTriangle size={48} className="mx-auto text-amber-400" />
          <div>
            <p className="text-lg font-semibold text-white">Please sign in</p>
            <p className="mt-1 text-sm text-slate-400">
              Sign in to view your results.
            </p>
          </div>
          <Button onClick={() => navigate("/login")}>Go to Login</Button>
        </Card>
      </div>
    );
  }

  if (showNoAttempt) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card variant="elevated" className="space-y-4 text-center">
          <AlertTriangle size={48} className="mx-auto text-amber-400" />
          <div>
            <p className="text-lg font-semibold text-white">No attempt selected</p>
            <p className="mt-1 text-sm text-slate-400">
              Pick an attempt from your history to view results.
            </p>
          </div>
          <Button onClick={() => navigate("/history")}>Go to History</Button>
        </Card>
      </div>
    );
  }

  if (showSummaryLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card variant="elevated" className="space-y-4 text-center">
          <AlertTriangle size={48} className="mx-auto text-amber-400" />
          <div>
            <p className="text-lg font-semibold text-white">Loading results summary</p>
            <p className="mt-1 text-sm text-slate-400">
              {summaryError ?? (summaryLoading ? "Fetching attempt summary..." : "Waiting for summary.")}
            </p>
          </div>
          <Button onClick={() => navigate("/history")}>Go to History</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <PageHeader
        badge={
          isPractice
            ? "Practice Complete"
            : isMistakesReview
              ? "Repeat Mistakes"
              : "Exam Complete"
        }
        title={
          isPractice
            ? `You scored ${finalScore}%`
            : isMistakesReview
              ? `Repeat mistakes score: ${finalScore}%`
            : `Final score: ${finalScore}%`
        }
        description={
          isPractice
            ? `${correct} out of ${total} questions answered correctly.`
            : isMistakesReview
              ? `${correct} out of ${total} questions answered correctly.`
            : timeMessage ?? "Switch to practice mode to see detailed feedback."
        }
        actions={
          settings ? (
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  finalScore >= 80
                    ? "success"
                    : finalScore >= 50
                      ? "warning"
                      : "error"
                }
              >
                {displayTopic}
              </Badge>
              <Badge tone="neutral">
                {difficultyLabels[settings.difficulty as keyof typeof difficultyLabels] ?? settings.difficulty}
              </Badge>
            </div>
          ) : undefined
        }
      />

      {isExam ? (
        <p className="text-sm text-slate-400">
          {correct} out of {total} questions answered correctly.
        </p>
      ) : null}

      {isMistakesReview ? (
        <p className="text-sm text-slate-400">
          {correct} out of {total} questions answered correctly.
        </p>
      ) : null}

      {/* Stats cards */}
      {isPractice ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Final Score"
            value={`${finalScore}%`}
            icon={<Trophy size={20} />}
            trend={finalScore >= 70 ? "up" : finalScore < 50 ? "down" : "neutral"}
          />
          <StatCard
            label="Correct"
            value={`${correct}/${total}`}
            icon={<Target size={20} />}
          />
          <StatCard
            label="Hints Used"
            value={usedHintsCount}
            icon={<Lightbulb size={20} />}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Final Score"
            value={`${finalScore}%`}
            icon={<Trophy size={20} />}
            trend={finalScore >= 70 ? "up" : finalScore < 50 ? "down" : "neutral"}
          />
          <StatCard
            label="Correct"
            value={`${correct}/${total}`}
            icon={<Target size={20} />}
          />
        </div>
      )}

      {/* AI Review */}
      {canLoadAiReview && !isMistakesReview ? (
        <Card variant="elevated" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">AI Review</h2>
              <p className="text-sm text-slate-400">
                Personalized feedback based on this attempt
              </p>
            </div>
            {showGenerateButton ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleAiReview}
                disabled={!attemptId || aiReviewLoading || creatingAttempt}
              >
                Generate AI Review
              </Button>
            ) : null}
          </div>

          {aiReviewLoading ? (
            <div className="space-y-3">
              <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
              <div className="h-24 w-full animate-pulse rounded-xl bg-white/[0.03]" />
              <div className="h-16 w-full animate-pulse rounded-xl bg-white/[0.03]" />
            </div>
          ) : aiReviewError ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200">
              {aiReviewError}
            </div>
          ) : aiReviewNotGenerated ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-slate-400">
              AI review hasn’t been generated yet.
            </div>
          ) : aiReview ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Headline</p>
                <p className="mt-2 text-sm text-slate-200">
                  {aiReview.headline ?? aiReview.summary ?? ""}
                </p>
                {aiReview.score_line ? (
                  <p className="mt-2 text-xs text-slate-400">{aiReview.score_line}</p>
                ) : null}
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Top Mistakes</p>
                <div className="mt-3 space-y-3">
                  {(aiReview.top_mistakes ?? []).map((item, index) => (
                    <div key={`${item.question_ref}-${index}`} className="text-sm text-slate-200">
                      <p className="font-semibold">{item.question_ref || `Mistake ${index + 1}`}</p>
                      <p className="text-xs text-slate-400">Your answer: {item.your_answer || "—"}</p>
                      <p className="text-xs text-slate-400">Correct answer: {item.correct_answer || "—"}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.why || ""}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Strengths</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-200">
                    {(aiReview.strengths ?? []).map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Micro Drills</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-200">
                    {(aiReview.micro_drills ?? []).map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Next Quiz</p>
                <p className="mt-2 text-sm text-slate-200">
                  Topic: {aiReview.next_quiz?.topic || aiReview.next_quiz_suggestion?.topics.join(", ") || "—"}
                </p>
                <p className="text-sm text-slate-400">
                  Difficulty: {aiReview.next_quiz?.difficulty || aiReview.next_quiz_suggestion?.difficulty || "—"} · Size: {aiReview.next_quiz?.size ?? aiReview.next_quiz_suggestion?.size ?? 0}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-slate-400">
              Click “Generate AI Review” to get personalized feedback.
            </div>
          )}
        </Card>
      ) : null}

      {/* Breakdown by type */}
      {isPractice && hasDetails && Object.keys(breakdown).length > 0 ? (
        <Card variant="elevated" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Breakdown by Type</h2>
            <p className="text-sm text-slate-400">Performance across question types</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(breakdown).map(([type, stats]) => {
              const percent = Math.round((stats.correct / stats.total) * PERCENT_MULTIPLIER);
              return (
                <div
                  key={type}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div className="flex items-center justify-between">
                    <Badge tone="neutral" className="capitalize">
                      {type === "mcq" ? "Multiple Choice" : "Code Output"}
                    </Badge>
                    <span className="text-sm font-semibold text-white">
                      {percent}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {stats.correct} of {stats.total} correct
                  </p>
                  <div className="mt-3 h-1.5 rounded-full bg-white/10">
                    <div
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        percent >= SCORE_THRESHOLDS.EXCELLENT
                          ? "bg-emerald-400"
                          : percent >= SCORE_THRESHOLDS.GOOD
                            ? "bg-amber-400"
                            : "bg-rose-400"
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* Question review */}
      {isPractice && hasDetails ? (
        <Card variant="elevated" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Question Review</h2>
            <p className="text-sm text-slate-400">
              Expand each question to see details
            </p>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {questions.map((question, index) => {
              const result = practiceResults?.[question.id];
              const isCorrect =
                result?.correct ??
                normalize(question.correct_answer ?? "") ===
                  normalize(answers[question.id] ?? "");
              const isExpanded = expandedId === question.id;
              const { before, code, after, language } = parsePrompt(
                question.prompt,
                question.code ?? null
              );
              const hintPenalty = penaltyByQuestion[question.id] ?? 0;

              return (
                <div key={question.id} className="py-4 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId((prev) =>
                        prev === question.id ? null : question.id
                      )
                    }
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isPractice ? (
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold",
                            isCorrect
                              ? "bg-emerald-400/15 text-emerald-400"
                              : "bg-rose-400/15 text-rose-400"
                          )}
                        >
                          {isCorrect ? "✓" : "✗"}
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm font-bold text-slate-400">
                          {index + 1}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-white">
                          Question {index + 1}
                        </p>
                        <p className="text-xs text-slate-400">
                          {question.prompt.replace(/\s+/g, " ").slice(0, 60)}
                          {question.prompt.length > 60 ? "…" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral" className="text-xs">
                        {question.type === "mcq" ? "MCQ" : "Code"}
                      </Badge>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void toggleFavorite(question.id);
                        }}
                        className={cn(
                          "rounded-full border px-2 py-1 text-xs transition",
                          favoriteIds.has(question.id)
                            ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                            : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
                        )}
                        disabled={favoriteLoadingIds[question.id]}
                        aria-pressed={favoriteIds.has(question.id)}
                        aria-label={favoriteIds.has(question.id) ? "Remove favorite" : "Add favorite"}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Star
                            size={12}
                            className={favoriteIds.has(question.id) ? "fill-amber-400 text-amber-300" : ""}
                          />
                          {favoriteIds.has(question.id) ? "Saved" : "Save"}
                        </span>
                      </button>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="mt-4 space-y-4 pl-11">
                      {/* Question prompt */}
                      <div className="space-y-2 text-sm text-slate-300">
                        {before ? <p className="whitespace-pre-wrap">{before}</p> : null}
                        {code ? <CodeBlock code={code} language={language} /> : null}
                        {after ? <p className="whitespace-pre-wrap">{after}</p> : null}
                      </div>

                      {/* Your answer */}
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Your answer
                        </p>
                        <p className="mt-2 font-mono text-sm text-slate-200">
                          {answers[question.id] || "—"}
                        </p>
                      </div>

                      {/* Correct answer (practice mode) */}
                      {isPractice ? (
                        <div
                          className={cn(
                            "rounded-xl border p-4",
                            isCorrect
                              ? "border-emerald-400/20 bg-emerald-400/5"
                              : "border-rose-400/20 bg-rose-400/5"
                          )}
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Correct answer
                          </p>
                          <p
                            className={cn(
                              "mt-2 font-mono text-sm",
                              isCorrect ? "text-emerald-300" : "text-rose-300"
                            )}
                          >
                            {result?.correctAnswer ?? question.correct_answer ?? "—"}
                          </p>
                        </div>
                      ) : null}

                      {/* Explanation */}
                      {isPractice && (result?.explanation || question.explanation) ? (
                        <details className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                          <summary className="cursor-pointer text-sm font-medium text-slate-300 hover:text-white">
                            View explanation
                          </summary>
                          <p className="mt-3 text-sm leading-relaxed text-slate-400">
                            {result?.explanation ?? question.explanation}
                          </p>
                        </details>
                      ) : null}

                      {/* Hint penalty */}
                      {isPractice && hintPenalty > 0 ? (
                        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-amber-300">
                            Hint penalty applied
                          </p>
                          <p className="mt-2 text-sm text-amber-200">
                            -{hintPenalty}%
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {isMistakesReview ? (
        <Card variant="elevated" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Mistakes Review</h2>
            <p className="text-sm text-slate-400">
              Review how you answered each question
            </p>
          </div>

          {reviewLoading ? (
            <div className="space-y-3">
              <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
              <div className="h-24 w-full animate-pulse rounded-xl bg-white/[0.03]" />
            </div>
          ) : reviewError ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200">
              {reviewError}
            </div>
          ) : reviewItems.length > 0 ? (
            <div className="divide-y divide-white/[0.06]">
              {reviewItems.map((item) => {
                const isCorrect = item.is_correct;
                const { before, code, after, language } = parsePrompt(
                  item.prompt,
                  item.code ?? null
                );
                return (
                  <div key={item.question_id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone={isCorrect ? "success" : "error"}>
                        {isCorrect ? "Correct" : "Incorrect"}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm text-slate-200">
                      {before ? <p>{before}</p> : null}
                      {code ? <CodeBlock language={language} code={code} /> : null}
                      {after ? <p>{after}</p> : null}
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-slate-300">
                      <p>
                        <span className="text-slate-400">Your answer:</span> {item.user_answer || "—"}
                      </p>
                      <p className="mt-2">
                        <span className="text-slate-400">Correct answer:</span> {item.correct_answer_text || item.correct_answer || "—"}
                      </p>
                    </div>
                    {item.explanation ? (
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-slate-300">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Explanation</p>
                        <p className="mt-2">{item.explanation}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-slate-400">
              No review data available yet.
            </div>
          )}
        </Card>
      ) : null}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {query ? (
          <Button onClick={() => navigate(`/quiz?${query.toString()}`)}>
            <RefreshCw size={16} />
            Try Again
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => navigate("/history")}>
          <History size={16} />
          View History
        </Button>
        <Button variant="ghost" onClick={() => navigate("/")}>
          Back to Home
        </Button>
        {settings && mode === "exam" ? (
          <Button
            variant="ghost"
            onClick={() =>
              navigate(
                `/quiz?${new URLSearchParams({
                  topic: settings.topic,
                  difficulty: settings.difficulty,
                  mode: "practice",
                  size: String(settings.size ?? questions.length)
                }).toString()}`
              )
            }
          >
            <Award size={16} />
            Switch to Practice
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readStoredResults(): ResultsState | null {
  const cached = sessionStorage.getItem("quizresults:last");
  if (!cached) return null;
  try {
    return JSON.parse(cached) as ResultsState;
  } catch {
    return null;
  }
}

function parsePrompt(prompt: string, codeField: string | null) {
  const normalizedPrompt = prompt ?? "";
  const trimmedCode = codeField?.trim();
  const fenceMatch = normalizedPrompt.match(/```(\w+)?\n([\s\S]*?)```/);

  if (trimmedCode) {
    if (!fenceMatch) {
      return { before: normalizedPrompt.trim(), code: trimmedCode, after: "", language: "python" };
    }
    const [block] = fenceMatch;
    const before = normalizedPrompt.slice(0, fenceMatch.index ?? 0).trim();
    const after = normalizedPrompt
      .slice((fenceMatch.index ?? 0) + block.length)
      .trim();
    return { before, code: trimmedCode, after, language: "python" };
  }

  if (!fenceMatch) {
    return { before: normalizedPrompt, code: "", after: "", language: "python" };
  }

  const [block, lang = "python", code] = fenceMatch;
  const before = normalizedPrompt.slice(0, fenceMatch.index ?? 0).trim();
  const after = normalizedPrompt.slice((fenceMatch.index ?? 0) + block.length).trim();
  return { before, code, after, language: lang || "python" };
}