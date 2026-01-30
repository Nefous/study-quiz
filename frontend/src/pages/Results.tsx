import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Award,
  ChevronDown,
  ChevronUp,
  History,
  Lightbulb,
  RefreshCw,
  Target,
  Trophy
} from "lucide-react";
import { createAttempt, difficultyLabels, getAttempt, topicLabels } from "../api";
import type { QuizMode, QuizQuestion, QuizSummary, Topic } from "../api/types";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import CodeBlock from "../components/ui/CodeBlock";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import { cn } from "../components/ui/cn";
import { useAuth } from "../context/AuthContext";

type ResultsState = {
  settings: {
    topic: string;
    topics?: Topic[];
    difficulty: string;
    mode: QuizMode;
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
  const { status } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<QuizSummary | null>(null);
  const [attemptMode, setAttemptMode] = useState<QuizMode | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const state = (location.state as ResultsState | null) ?? readStoredResults();

  const settings = state?.settings;
  const questions = state?.questions ?? [];
  const answers = state?.answers ?? {};
  const mode = state?.mode ?? attemptMode ?? "practice";
  const practiceResults = state?.practiceResults;
  const attemptId =
    (params.attemptId as string | undefined) ?? state?.attempt_id ?? state?.quiz_id ?? null;
  const isPractice = mode === "practice";
  const isExam = mode === "exam";
  const hasDetails = Boolean(state && settings && questions.length > 0);

  useEffect(() => {
    if (status !== "authed") return;
    if (state?.summary) {
      setSummary(state.summary);
      return;
    }
    if (!attemptId) return;
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
      })
      .catch((err) => {
        setSummaryError(err instanceof Error ? err.message : "Failed to load summary");
      })
      .finally(() => setSummaryLoading(false));
  }, [attemptId, state?.summary, status]);

  const total = summary?.total ?? 0;
  const correct = summary?.correct ?? 0;
  const usedHintsCount = state?.usedHintsCount ?? 0;
  const penaltyByQuestion = state?.penaltyByQuestion ?? {};
  const finalScore = summary ? clamp(summary.percent, 0, 100) : 0;

  const displayTopic = settings
    ? settings.topic === "random"
      ? "Random"
      : settings.topics && settings.topics.length > 1
        ? "Mix"
        : settings.topics && settings.topics.length === 1
          ? topicLabels[settings.topics[0]]
          : topicLabels[settings.topic as keyof typeof topicLabels] ?? settings.topic
    : "Unknown";

  const timeLimit = summary?.timeLimitSec ?? state?.time_limit_seconds ?? null;
  const timeSpent = summary?.timeUsedSec ?? state?.time_spent_seconds ?? null;
  const timedOut = Boolean(state?.timed_out);
  const timeMessage = timeLimit !== null && timeSpent !== null
    ? `Time used: ${formatTime(timeSpent)} / ${formatTime(timeLimit)}${timedOut ? " (Timed out)" : ""}`
    : timedOut
      ? "Timed out"
      : null;

  useEffect(() => {
    if (status !== "authed") return;
    if (!state) return;
    if (!summary) return;
    if (!settings) return;
    const storageKey = `attempt_saved_${attemptId}`;
    if (localStorage.getItem(storageKey)) return;

    const totalCount = summary.total;
    const correctCount = summary.correct;

    const selectedTopics = settings.topics ?? [];
    const topicValue = settings.topic === "random"
      ? "random"
      : selectedTopics.length > 1
        ? "mix"
        : selectedTopics[0] ?? settings.topic;

    const attemptPayload = {
      topic: topicValue,
      meta: selectedTopics.length > 1 ? { topics: selectedTopics } : undefined,
      difficulty: settings.difficulty,
      mode: settings.mode,
      size: settings.size,
      correct_count: correctCount,
      total_count: totalCount,
      answers: questions.map((question) => {
        const expected = normalize(question.correct_answer ?? "");
        const provided = normalize(answers[question.id] ?? "");
        const isCorrect = expected === provided;
        return {
          question_id: question.id,
          user_answer: answers[question.id] ?? "",
          is_correct: isCorrect
        };
      }),
      started_at: state?.started_at ?? null,
      finished_at: state?.finished_at ?? null,
      time_limit_seconds: state?.time_limit_seconds ?? null,
      time_spent_seconds: state?.time_spent_seconds ?? null,
      timed_out: state?.timed_out ?? null
    };

    createAttempt(attemptPayload)
      .then(() => {
        localStorage.setItem(storageKey, "1");
      })
      .catch(() => {
        localStorage.removeItem(storageKey);
      });
  }, [answers, attemptId, isPractice, practiceResults, questions, settings, state, status, summary]);

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
  const showSummaryLoading = !summary && !showNoAttempt && !showAuthLoading && !showGuest;

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
        badge={isPractice ? "Practice Complete" : "Exam Complete"}
        title={
          isPractice
            ? `You scored ${finalScore}%`
            : `Final score: ${finalScore}%`
        }
        description={
          isPractice
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

      {/* Breakdown by type */}
      {isPractice && hasDetails && Object.keys(breakdown).length > 0 ? (
        <Card variant="elevated" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Breakdown by Type</h2>
            <p className="text-sm text-slate-400">Performance across question types</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(breakdown).map(([type, stats]) => {
              const percent = Math.round((stats.correct / stats.total) * 100);
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
                        percent >= 70
                          ? "bg-emerald-400"
                          : percent >= 50
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
              const { before, code, after, language } = parsePrompt(question.prompt);
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

function parsePrompt(prompt: string) {
  const match = prompt.match(/```(\w+)?\n([\s\S]*?)```/);
  if (!match) {
    return { before: prompt, code: "", after: "", language: "python" };
  }

  const [block, lang = "python", code] = match;
  const before = prompt.slice(0, match.index ?? 0).trim();
  const after = prompt.slice((match.index ?? 0) + block.length).trim();
  return { before, code, after, language: lang || "python" };
}
