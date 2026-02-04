import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ChevronRight,
  Code2,
  HelpCircle,
  Lightbulb,
  ListChecks,
  LogOut,
  Send,
  Sparkles,
  Star
} from "lucide-react";
import {
  favoriteQuestion,
  generateQuiz,
  getHint,
  listFavoriteQuestions,
  unfavoriteQuestion,
  difficultyLabels,
  modeLabels,
  topicLabels
} from "../api";
import type {
  Difficulty,
  QuizGenerateRequest,
  QuizGenerateResponse,
  QuizMode,
  QuizQuestion,
  QuizSummary,
  Topic,
  ApiError
} from "../api/types";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import CodeBlock from "../components/ui/CodeBlock";
import Drawer from "../components/ui/Drawer";
import Modal from "../components/ui/Modal";
import OptionCard from "../components/ui/OptionCard";
import Progress from "../components/ui/Progress";
import Spinner from "../components/ui/Spinner";
import { cn } from "../components/ui/cn";
import { PERCENT_MULTIPLIER } from "../config/quiz";


type PracticeResult = {
  correct: boolean;
  correctAnswer: string;
  explanation?: string | null;
};

const STORAGE_PREFIX = "quizstate";
const RESULTS_PREFIX = "quizresults";
const TIMER_PREFIX = "quiztimer";
const MAX_HINTS = 3;
const HINT_PENALTIES: Record<number, number> = { 1: 15, 2: 25, 3: 50 };
const HINT_LEVEL_LABELS: Record<number, string> = {
  1: "Light",
  2: "Medium",
  3: "Strong"
};

export default function Quiz() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [attemptId, setAttemptId] = useState<string | null>(() => {
    const state = location.state as { attemptId?: string } | null;
    return state?.attemptId ?? null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizGenerateResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, PracticeResult>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showQuit, setShowQuit] = useState(false);
  const [showHintDrawer, setShowHintDrawer] = useState(false);
  const [hintLevel, setHintLevel] = useState(1);
  const [hintByQuestionId, setHintByQuestionId] = useState<Record<string, string>>({});
  const [hintLoadingByQuestionId, setHintLoadingByQuestionId] = useState<Record<string, boolean>>({});
  const [hintErrorByQuestionId, setHintErrorByQuestionId] = useState<Record<string, string>>({});
  const [usedHintsCount, setUsedHintsCount] = useState(0);
  const [penaltyTotal, setPenaltyTotal] = useState(0);
  const [penaltyByQuestion, setPenaltyByQuestion] = useState<Record<string, number>>({});
  const [hintsUsedByQuestion, setHintsUsedByQuestion] = useState<Record<string, number>>({});
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<Record<string, boolean>>({});
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const finishTriggeredRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);

  const settings = useMemo<QuizGenerateRequest | null>(() => {
    const topic = params.get("topic") as Topic | null;
    const topicsParam = params.get("topics");
    const difficulty = params.get("difficulty") as Difficulty | null;
    const mode = params.get("mode") as QuizMode | null;
    const sizeParam = params.get("size");
    const size = sizeParam ? Number(sizeParam) : undefined;

    const validTopics = Object.keys(topicLabels) as Topic[];
    const validDifficulties = Object.keys(difficultyLabels) as Difficulty[];
    const validModes = Object.keys(modeLabels) as QuizMode[];

    if (!difficulty || !mode) return null;

    let topics: Topic[] | null = null;
    if (topicsParam) {
      const parsed = topicsParam
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0) as Topic[];
      const filtered = parsed.filter((item) => validTopics.includes(item) && item !== "random");
      if (!filtered.length) return null;
      topics = Array.from(new Set(filtered));
    } else if (topic) {
      if (!validTopics.includes(topic)) return null;
      if (topic === "random") {
        topics = null;
      } else {
        topics = [topic];
      }
    } else {
      return null;
    }
    if (!validDifficulties.includes(difficulty)) return null;
    if (!validModes.includes(mode)) return null;

    return {
      topic: topic === "random" ? "random" : undefined,
      topics: topics ?? undefined,
      difficulty,
      mode,
      size: Number.isFinite(size) ? Math.max(1, Number(size)) : undefined
    };
  }, [params]);

  const isExamMode = settings?.mode === "exam";

  const storageKey = useMemo(() => {
    if (!settings) return `${STORAGE_PREFIX}:invalid`;
    const topicsKey = settings.topic === "random"
      ? "random"
      : settings.topics?.join("|") || "none";
    return `${STORAGE_PREFIX}:${topicsKey}:${settings.difficulty}:${settings.mode}:${
      settings.size ?? "default"
    }`;
  }, [settings]);

  const timerStorageKey = useMemo(() => {
    const key = attemptId ?? quiz?.quiz_id ?? "unknown";
    return `${TIMER_PREFIX}:${key}`;
  }, [attemptId, quiz?.quiz_id]);

  useEffect(() => {
    if (!settings) {
      navigate("/");
    }
  }, [navigate, settings]);

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
    if (!settings) return;
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const cached = sessionStorage.getItem(storageKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as {
              quiz: QuizGenerateResponse;
              answers: Record<string, string>;
              submitted: Record<string, boolean>;
              results: Record<string, PracticeResult>;
              currentIndex: number;
              hintByQuestionId?: Record<string, string>;
              hintLoadingByQuestionId?: Record<string, boolean>;
              hintErrorByQuestionId?: Record<string, string>;
              usedHintsCount?: number;
              penaltyTotal?: number;
              penaltyByQuestion?: Record<string, number>;
              hintsUsedByQuestion?: Record<string, number>;
              attemptId?: string;
              startedAt?: string | null;
              timeLimitSeconds?: number | null;
            };
            if (parsed?.quiz?.questions?.length) {
              if (active) {
                setQuiz(parsed.quiz);
                setAnswers(parsed.answers || {});
                setSubmitted(parsed.submitted || {});
                setResults(parsed.results || {});
                setCurrentIndex(parsed.currentIndex || 0);
                setHintByQuestionId(parsed.hintByQuestionId || {});
                setHintLoadingByQuestionId(parsed.hintLoadingByQuestionId || {});
                setHintErrorByQuestionId(parsed.hintErrorByQuestionId || {});
                setUsedHintsCount(parsed.usedHintsCount || 0);
                setPenaltyTotal(parsed.penaltyTotal || 0);
                setPenaltyByQuestion(parsed.penaltyByQuestion || {});
                setHintsUsedByQuestion(parsed.hintsUsedByQuestion || {});
                setStartedAt(parsed.startedAt ?? null);
                setTimeLimitSeconds(parsed.timeLimitSeconds ?? null);
                if (parsed.attemptId && parsed.attemptId !== attemptId) {
                  setAttemptId(parsed.attemptId);
                }
                setLoading(false);
              }
              return;
            }
          } catch {
            sessionStorage.removeItem(storageKey);
          }
        }

        const response = await generateQuiz(settings);
        if (active) {
          if (!response.questions.length) {
            setError("No questions available for this selection.");
            setLoading(false);
            return;
          }
          setQuiz(response);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load quiz");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [settings, storageKey]);

  useEffect(() => {
    if (!quiz) return;
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        quiz,
        answers,
        submitted,
        results,
        currentIndex,
        hintByQuestionId,
        hintLoadingByQuestionId,
        hintErrorByQuestionId,
        usedHintsCount,
        penaltyTotal,
        penaltyByQuestion,
        hintsUsedByQuestion,
        attemptId,
        startedAt,
        timeLimitSeconds
      })
    );
  }, [answers, attemptId, currentIndex, hintByQuestionId, hintErrorByQuestionId, hintLoadingByQuestionId, hintsUsedByQuestion, penaltyByQuestion, penaltyTotal, quiz, results, storageKey, submitted, usedHintsCount, startedAt, timeLimitSeconds]);

  useEffect(() => {
    finishTriggeredRef.current = false;
  }, [quiz?.quiz_id]);

  const completeQuiz = (didTimeOut: boolean) => {
    if (finishTriggeredRef.current) return;
    if (!quiz || !settings) return;
    finishTriggeredRef.current = true;

    const totalQuestions = quiz.questions.length;
    const computedResults = quiz.questions.reduce<Record<string, PracticeResult>>((acc, current) => {
      const expected = normalizeAnswer(current.correct_answer ?? "");
      const provided = normalizeAnswer(answers[current.id] ?? "");
      const isCorrect = expected === provided;
      const existing = results[current.id];
      acc[current.id] = existing ?? {
        correct: isCorrect,
        correctAnswer: current.correct_answer ?? "",
        explanation: isPractice ? current.explanation : undefined
      };
      return acc;
    }, {});
    const correctCount = Object.values(computedResults).filter((r) => r.correct).length;
    const adjustedPoints = quiz.questions.reduce((sum, current) => {
      const isCorrect = computedResults[current.id]?.correct ?? false;
      if (!isCorrect) return sum;
      const penalty = (penaltyByQuestion[current.id] ?? 0) / 100;
      return sum + Math.max(0, 1 - penalty);
    }, 0);
    const percent = totalQuestions
      ? Math.round((adjustedPoints / totalQuestions) * 100)
      : 0;
    const timeLimit = timeLimitSeconds ?? null;
    const timeSpent =
      timeLimit !== null && remainingSeconds !== null
        ? Math.max(0, timeLimit - remainingSeconds)
        : null;
    const finishedAt = new Date().toISOString();
    const summary: QuizSummary = {
      total: totalQuestions,
      correct: correctCount,
      percent,
      timeUsedSec: timeSpent ?? undefined,
      timeLimitSec: timeLimit ?? undefined
    };

    const payload = {
      settings,
      quiz_id: quiz.quiz_id,
      attempt_id: attemptId ?? undefined,
      questions: quiz.questions,
      answers,
      mode: settings.mode,
      practiceResults: isPractice ? computedResults : undefined,
      penaltyByQuestion,
      summary,
      raw_score_percent: percent,
      usedHintsCount,
      penaltyTotal,
      timed_out: didTimeOut || false,
      time_limit_seconds: timeLimit ?? undefined,
      time_spent_seconds: timeSpent ?? undefined,
      started_at: startedAt ?? undefined,
      finished_at: finishedAt
    };
    sessionStorage.setItem(`${RESULTS_PREFIX}:${quiz.quiz_id}`, JSON.stringify(payload));
    sessionStorage.setItem(`${RESULTS_PREFIX}:last`, JSON.stringify(payload));
    sessionStorage.removeItem(storageKey);
    localStorage.removeItem(timerStorageKey);
    navigate("/results", { state: payload });
  };

  useEffect(() => {
    if (!quiz || !isExamMode || !settings) return;
    const limit = getExamTimeLimit(settings.size ?? quiz.questions.length);
    setTimeLimitSeconds((prev) => prev ?? limit);
    if (!startedAt) {
      setStartedAt(new Date().toISOString());
    }

    if (remainingSeconds === null) {
      const stored = localStorage.getItem(timerStorageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { remaining: number; updatedAt: string };
          const updatedAt = new Date(parsed.updatedAt).getTime();
          const elapsed = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
          const nextRemaining = Math.max(0, Math.min(limit, parsed.remaining - elapsed));
          setRemainingSeconds(nextRemaining);
          return;
        } catch {
          localStorage.removeItem(timerStorageKey);
        }
      }
      setRemainingSeconds(limit);
    }
  }, [quiz, isExamMode, remainingSeconds, settings, startedAt, timerStorageKey]);

  useEffect(() => {
    if (!isExamMode || remainingSeconds === null) return;
    localStorage.setItem(
      timerStorageKey,
      JSON.stringify({ remaining: remainingSeconds, updatedAt: new Date().toISOString() })
    );
  }, [isExamMode, remainingSeconds, timerStorageKey]);

  useEffect(() => {
    if (!isExamMode || remainingSeconds === null) return;
    if (remainingSeconds <= 0) return;
    lastTickRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const lastTick = lastTickRef.current ?? now;
      const elapsed = Math.floor((now - lastTick) / 1000);
      if (elapsed <= 0) return;
      lastTickRef.current = now;
      setRemainingSeconds((prev) => {
        if (prev === null) return prev;
        return Math.max(0, prev - elapsed);
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isExamMode, remainingSeconds]);

  useEffect(() => {
    if (!isExamMode || remainingSeconds === null) return;
    if (remainingSeconds > 0) return;
    completeQuiz(true);
  }, [isExamMode, remainingSeconds]);

  if (!settings) {
    return null;
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="space-y-6" variant="elevated">
          <div className="flex items-center gap-3">
            <Spinner />
            <div>
              <p className="font-medium text-white">Preparing your quiz</p>
              <p className="text-sm text-slate-400">Loading questions...</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-white/10" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-white/10" />
          </div>
        </Card>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="space-y-6" variant="elevated">
          <div className="flex items-center gap-3 text-rose-400">
            <AlertTriangle size={24} />
            <div>
              <p className="font-medium text-white">Failed to load quiz</p>
              <p className="text-sm text-slate-400">{error ?? "Unknown error"}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate("/")}>
            Back to home
          </Button>
        </Card>
      </div>
    );
  }

  const questions = quiz.questions;
  const question = questions[currentIndex];
  const isPractice = settings.mode === "practice";
  const isExam = settings.mode === "exam";
  const currentAnswer = answers[question.id] ?? "";
  const isSubmitted = Boolean(submitted[question.id]);
  const progress = questions.length
  ? ((currentIndex + 1) / questions.length) * PERCENT_MULTIPLIER
  : 0;
  const timeProgress =
  isExam && timeLimitSeconds && remainingSeconds !== null
    ? (remainingSeconds / timeLimitSeconds) * PERCENT_MULTIPLIER
    : 0;

  const { before, code, after, language } = parsePrompt(question.prompt);

  const handleSubmit = () => {
    if (isSubmitted) return;
    const normalizedAnswer = normalizeAnswer(currentAnswer);
    const expected = normalizeAnswer(question.correct_answer ?? "");
    setSubmitted((prev) => ({ ...prev, [question.id]: true }));
    setResults((prev) => ({
      ...prev,
      [question.id]: {
        correct: normalizedAnswer === expected,
        correctAnswer: question.correct_answer ?? "",
        explanation: isPractice ? question.explanation : undefined
      }
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }
    completeQuiz(false);
  };

  const handleQuit = () => {
    sessionStorage.removeItem(storageKey);
    localStorage.removeItem(timerStorageKey);
    navigate("/");
  };

  const result = results[question.id];
  const hintKey = `${question.id}:${hintLevel}`;
  const hint = hintByQuestionId[hintKey];
  const hintLoading = hintLoadingByQuestionId[hintKey];
  const hintError = hintErrorByQuestionId[hintKey];

  const handleHint = async () => {
    if (hintByQuestionId[hintKey]) return;
    if (usedHintsCount >= MAX_HINTS) {
      setHintErrorByQuestionId((prev) => ({ ...prev, [hintKey]: "Hint limit reached" }));
      return;
    }

    const payload: { user_answer?: string; level: number; attempt_id?: string } = {
      attempt_id: attemptId ?? undefined,
      level: hintLevel
    };

    if (question.type === "mcq") {
      if (currentAnswer) {
        payload.user_answer = currentAnswer;
      }
    } else if (currentAnswer.trim()) {
      payload.user_answer = currentAnswer.trim();
    }

    setHintLoadingByQuestionId((prev) => ({ ...prev, [hintKey]: true }));
    setHintErrorByQuestionId((prev) => ({ ...prev, [hintKey]: "" }));

    try {
      const response = await getHint(question.id, payload);
      setHintByQuestionId((prev) => ({ ...prev, [hintKey]: response.hint }));
      const penalty = HINT_PENALTIES[hintLevel] ?? 0;
      setUsedHintsCount((prev) => prev + 1);
      setPenaltyTotal((prev) => prev + penalty);
      setPenaltyByQuestion((prev) => ({
        ...prev,
        [question.id]: (prev[question.id] ?? 0) + penalty
      }));
      setHintsUsedByQuestion((prev) => ({
        ...prev,
        [question.id]: (prev[question.id] ?? 0) + 1
      }));
    } catch (err) {
      const apiError = err as ApiError;
      const message = apiError?.message || (err instanceof Error ? err.message : "Failed to get hint");
      setHintErrorByQuestionId((prev) => ({ ...prev, [hintKey]: message }));
    } finally {
      setHintLoadingByQuestionId((prev) => ({ ...prev, [hintKey]: false }));
    }
  };

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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Progress header */}
      <Card
        variant="elevated"
        padding="md"
        className="sticky top-16 z-20 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
              <ListChecks size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Question {currentIndex + 1} of {questions.length}
              </p>
              <p className="text-xs text-slate-400">
                {isPractice ? "Practice mode" : "Exam mode"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPractice ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHintDrawer(true)}
                disabled={isSubmitted}
              >
                <Lightbulb size={16} />
                <span className="hidden sm:inline">Hint</span>
                {usedHintsCount > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 text-xs text-amber-300">
                    {usedHintsCount}/{MAX_HINTS}
                  </span>
                )}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQuit(true)}
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Quit</span>
            </Button>
          </div>
        </div>
        <Progress value={progress} className="mt-4" />
        {isExam ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Time remaining</span>
              <span className="font-semibold text-slate-200">
                {formatTime(remainingSeconds ?? timeLimitSeconds ?? 0)}
              </span>
            </div>
            <Progress value={timeProgress} />
          </div>
        ) : null}
      </Card>

      {/* Question card */}
      <Card variant="elevated" className="space-y-6">
        {/* Question header with badges */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={question.type === "mcq" ? "info" : "primary"}>
              {question.type === "mcq" ? (
                <>
                  <HelpCircle size={12} />
                  MCQ
                </>
              ) : (
                <>
                  <Code2 size={12} />
                  Code Output
                </>
              )}
            </Badge>
            <Badge tone="neutral">{topicLabels[question.topic]}</Badge>
            <Badge tone="neutral">{difficultyLabels[question.difficulty]}</Badge>
          </div>
          <button
            type="button"
            onClick={() => toggleFavorite(question.id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition",
              favoriteIds.has(question.id)
                ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
            )}
            disabled={favoriteLoadingIds[question.id]}
            aria-pressed={favoriteIds.has(question.id)}
            aria-label={favoriteIds.has(question.id) ? "Remove favorite" : "Add favorite"}
          >
            <Star
              size={14}
              className={favoriteIds.has(question.id) ? "fill-amber-400 text-amber-300" : ""}
            />
            {favoriteIds.has(question.id) ? "Favorited" : "Favorite"}
          </button>
        </div>

        {/* Question content */}
        <div className="space-y-4 text-slate-100">
          {before ? (
            <p className="whitespace-pre-wrap leading-relaxed">{before}</p>
          ) : null}
          {code ? <CodeBlock code={code} language={language} /> : null}
          {after ? (
            <p className="whitespace-pre-wrap leading-relaxed">{after}</p>
          ) : null}
        </div>

        {/* Answer options */}
        <div className="space-y-3">
          {question.type === "mcq" && question.choices ? (
            <div className="grid gap-3">
              {Object.entries(question.choices).map(([key, value]) => {
                const active = currentAnswer === key;
                const correctAnswer = result?.correctAnswer;
                const showCorrect = isPractice && isSubmitted && correctAnswer;
                const isCorrectChoice = showCorrect && correctAnswer === key;
                const isIncorrectChoice = showCorrect && active && correctAnswer !== key;

                return (
                  <OptionCard
                    key={key}
                    value={key}
                    label={value}
                    prefix={key}
                    selected={active}
                    correct={Boolean(isCorrectChoice)}
                    incorrect={Boolean(isIncorrectChoice)}
                    disabled={isSubmitted}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [question.id]: key }))
                    }
                  />
                );
              })}
            </div>
          ) : (
            <textarea
              value={currentAnswer}
              onChange={(event) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: event.target.value
                }))
              }
              placeholder="Type the expected output..."
              rows={5}
              readOnly={isSubmitted}
              className={cn(
                "w-full rounded-2xl border bg-slate-950/60 p-4 font-mono text-sm text-slate-100 transition placeholder:text-slate-500",
                "focus:outline-none focus:ring-2 focus:ring-indigo-400/40",
                isSubmitted
                  ? "cursor-not-allowed border-white/5 opacity-70"
                  : "border-white/10 hover:border-white/20"
              )}
            />
          )}
        </div>

        {/* Result feedback (practice mode) */}
        {isSubmitted && isPractice && result ? (
          <Card
            variant="subtle"
            padding="md"
            className={cn(
              "border-l-4",
              result.correct
                ? "border-l-emerald-400 bg-emerald-400/5"
                : "border-l-rose-400 bg-rose-400/5"
            )}
          >
            <div className="flex items-center gap-3">
              <Badge tone={result.correct ? "success" : "error"}>
                {result.correct ? "Correct!" : "Incorrect"}
              </Badge>
              {!result.correct && (
                <span className="text-sm text-slate-300">
                  Answer: <span className="font-mono">{result.correctAnswer}</span>
                </span>
              )}
            </div>
            {result.explanation ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-300 hover:text-white">
                  View explanation
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {result.explanation}
                </p>
              </details>
            ) : null}
          </Card>
        ) : null}

        {/* Exam mode submitted state */}
        {isSubmitted && !isPractice ? (
          <Card variant="subtle" padding="md">
            <Badge tone="neutral">Answer submitted</Badge>
          </Card>
        ) : null}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!isSubmitted ? (
            <Button onClick={handleSubmit} disabled={!currentAnswer.trim()}>
              <Send size={16} />
              Submit Answer
            </Button>
          ) : (
            <Button onClick={handleNext}>
              {currentIndex === questions.length - 1 ? "Finish Quiz" : "Next Question"}
              <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </Card>

      {/* AI Hint Drawer */}
      {isPractice ? (
        <Drawer
          open={showHintDrawer}
          onClose={() => setShowHintDrawer(false)}
          title="AI Hint"
          description="Get intelligent guidance without revealing the answer."
        >
          <div className="space-y-6">
            {/* Hint level selector */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">Hint Level</p>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setHintLevel(level)}
                    className={cn(
                      "rounded-xl py-3 text-sm font-medium transition",
                      hintLevel === level
                        ? "bg-indigo-500/20 text-indigo-200 ring-2 ring-indigo-500/40"
                        : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-300"
                    )}
                  >
                    {HINT_LEVEL_LABELS[level]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                {hintLevel === 1 && "Gentle nudge in the right direction"}
                {hintLevel === 2 && "More specific guidance"}
                {hintLevel === 3 && "Detailed explanation (higher penalty)"}
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 rounded-xl bg-white/[0.03] p-4">
              <div>
                <p className="text-xs text-slate-400">Hints used</p>
                <p className="text-lg font-semibold text-white">
                  {usedHintsCount}
                  <span className="text-sm text-slate-500">/{MAX_HINTS}</span>
                </p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <p className="text-xs text-slate-400">Current penalty</p>
                <p className="text-lg font-semibold text-amber-400">
                  {penaltyTotal > 0 ? '-' : ''}{penaltyTotal}%
                </p>
              </div>
            </div>

            {/* Get hint button */}
            <Button
              onClick={handleHint}
              disabled={hintLoading || usedHintsCount >= MAX_HINTS || Boolean(hint)}
              className="w-full"
            >
              {hintLoading ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Generating hint...
                </>
              ) : hint ? (
                "Hint received"
              ) : usedHintsCount >= MAX_HINTS ? (
                "No hints remaining"
              ) : (
                <>
                  <Sparkles size={16} />
                  Get {HINT_LEVEL_LABELS[hintLevel]} Hint (-{HINT_PENALTIES[hintLevel]}%)
                </>
              )}
            </Button>

            {/* Error */}
            {hintError ? <Alert>{hintError}</Alert> : null}

            {/* Hint response */}
            {hint ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  AI Response
                </p>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                    {hint}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </Drawer>
      ) : null}

      {/* Quit confirmation modal */}
      <Modal
        open={showQuit}
        title="Quit quiz?"
        description="Your current progress will be lost."
        confirmLabel="Quit"
        onConfirm={handleQuit}
        onClose={() => setShowQuit(false)}
      />
    </div>
  );
}

function normalizeAnswer(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getExamTimeLimit(size: number) {
  if (size <= 5) return 4 * 60;
  if (size <= 10) return 8 * 60;
  return 12 * 60;
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
