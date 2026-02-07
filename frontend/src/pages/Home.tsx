import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Binary,
  BookOpen,
  Code2,
  GitBranch,
  Lightbulb,
  Play,
  Shuffle,
  TrendingUp
} from "lucide-react";
import {
  getMeta,
  getNextQuizRecommendation,
  generateNextQuizRecommendation,
  startRecommendation,
  topicLabels,
  difficultyLabels,
  modeLabels
} from "../api";
import type {
  ApiError,
  Difficulty,
  MetaResponse,
  NextQuizRecommendationGenerated,
  QuizMode,
  Topic
} from "../api/types";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Segmented from "../components/ui/Segmented";
import TopicCard from "../components/ui/TopicCard";
import { cn } from "../components/ui/cn";
import { useAuth } from "../context/AuthContext";

const STORAGE_KEY = "quizSetup";
const FALLBACK_DEFAULT_SIZE = 10;
const FALLBACK_MAX_SIZE = 15;
const FALLBACK_TOPICS: Topic[] = [
  "python_core",
  "big_o",
  "algorithms",
  "data_structures"
];

const TOPIC_ICONS: Record<string, typeof Code2> = {
  python_core: Code2,
  big_o: TrendingUp,
  algorithms: GitBranch,
  data_structures: Binary
};

const TOPIC_DESCRIPTIONS: Record<string, string> = {
  python_core: "Syntax, data types, and Python idioms",
  big_o: "Time & space complexity analysis",
  algorithms: "Sorting, searching, and patterns",
  data_structures: "Lists, stacks, queues, and trees"
};

const formatRateLimitMessage = (retryAfterSeconds?: number) => {
  if (!retryAfterSeconds) {
    return "Rate limit reached. Try again soon.";
  }
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Rate limit reached. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
};

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>(["python_core"]);
  const [randomMix, setRandomMix] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("junior");
  const [mode, setMode] = useState<QuizMode>("practice");
  const [size, setSize] = useState<number>(FALLBACK_DEFAULT_SIZE);
  const [maxSize, setMaxSize] = useState<number>(FALLBACK_MAX_SIZE);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [metaSource, setMetaSource] = useState<"api" | "fallback" | null>(null);
  const [generatedRecommendation, setGeneratedRecommendation] = useState<
    NextQuizRecommendationGenerated | null
  >(null);
  const [generatedLoading, setGeneratedLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachCooldownUntil, setCoachCooldownUntil] = useState<number | null>(null);
  const coachCooldownActive = coachCooldownUntil !== null && coachCooldownUntil > Date.now();

  useEffect(() => {
    if (!coachCooldownUntil) return;
    const delay = coachCooldownUntil - Date.now();
    if (delay <= 0) {
      setCoachCooldownUntil(null);
      return;
    }
    const timeout = window.setTimeout(() => setCoachCooldownUntil(null), delay);
    return () => window.clearTimeout(timeout);
  }, [coachCooldownUntil]);

  const canSubmit = useMemo(() => {
    if (!difficulty || !mode || size <= 0) return false;
    if (randomMix) return true;
    return selectedTopics.length > 0;
  }, [difficulty, mode, randomMix, selectedTopics.length, size]);

  const startQuiz = () => {
    if (!isAuthenticated) {
      navigate("/login?returnUrl=%2F");
      return;
    }
    const params = new URLSearchParams({
      difficulty,
      mode,
      size: String(size)
    });

    if (randomMix) {
      params.set("topic", "random");
    } else {
      params.set("topics", selectedTopics.join(","));
    }
    navigate(`/quiz?${params.toString()}`);
  };


  const startRecommendedQuiz = async () => {
    if (!isAuthenticated) {
      navigate("/login?returnUrl=%2F");
      return;
    }
    if (!generatedRecommendation) return;
    const start = await startRecommendation(generatedRecommendation.id);
    const params = new URLSearchParams({
      difficulty: generatedRecommendation.difficulty,
      mode: "practice",
      size: String(generatedRecommendation.size)
    });
    const topic = generatedRecommendation.topic;
    if (topic === "mixed" || topic === "mix" || topic === "random") {
      params.set("topic", "random");
    } else {
      params.set("topic", topic);
    }
    navigate(`/quiz?${params.toString()}`, { state: { attemptId: start.attempt_id } });
  };

  useEffect(() => {
    let active = true;
    let hadCache = false;
    const loadMeta = async () => {
      try {
        setLoading(true);
        const response = await getMeta();
        if (active) {
          setMeta(response);
          setMaxSize(response.maxQuestionsPerQuiz || FALLBACK_MAX_SIZE);
          if (!hadCache) {
            setSize(response.defaultQuizSize || FALLBACK_DEFAULT_SIZE);
          }
          setMetaSource("api");
        }
      } catch (err) {
        if (active) {
          const apiError = err as ApiError;
          const status = apiError?.status;
          const isDev = import.meta.env.DEV;
          console.warn("meta fetch failed", status, err);
          setMeta({
            topics: FALLBACK_TOPICS,
            difficulties: ["junior", "middle"],
            modes: ["practice", "exam"],
            defaultQuizSize: FALLBACK_DEFAULT_SIZE,
            maxQuestionsPerQuiz: FALLBACK_MAX_SIZE
          });
          setMaxSize(FALLBACK_MAX_SIZE);
          if (!hadCache) {
            setSize(FALLBACK_DEFAULT_SIZE);
          }
          if (isDev && status) {
            console.warn("meta fetch status", status);
          }
          setMetaSource("fallback");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as {
          selectedTopics: Topic[];
          randomMix?: boolean;
          difficulty: Difficulty;
          mode: QuizMode;
          size: number;
        };
        setSelectedTopics(parsed.selectedTopics || []);
        setRandomMix(Boolean(parsed.randomMix));
        setDifficulty(parsed.difficulty);
        setMode(parsed.mode);
        setSize(parsed.size);
        hadCache = true;
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }

    loadMeta();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      setGeneratedRecommendation(null);
      sessionStorage.removeItem("aiCoachRecommendation");
      return () => {
        active = false;
      };
    }
    const loadActiveRecommendation = async () => {
      try {
        const response = await getNextQuizRecommendation();
        if (!active) return;
        if (response.id && response.reason && response.prep) {
          const generated = {
            id: response.id,
            topic: response.topic ?? "mixed",
            difficulty: (response.difficulty ?? "junior") as Difficulty,
            size: response.size ?? 10,
            based_on: response.based_on ?? "",
            reason: response.reason,
            prep: response.prep
          };
          setGeneratedRecommendation(generated);
          sessionStorage.setItem("aiCoachRecommendation", JSON.stringify(generated));
          return;
        }
        setGeneratedRecommendation(null);
        sessionStorage.removeItem("aiCoachRecommendation");
      } catch {
        if (active) {
          setGeneratedRecommendation(null);
        }
      }
    };
    void loadActiveRecommendation();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);


  useEffect(() => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedTopics, randomMix, difficulty, mode, size })
    );
  }, [selectedTopics, randomMix, difficulty, mode, size]);

  useEffect(() => {
    if (size > maxSize) {
      setSize(maxSize);
    }
  }, [maxSize, size]);

  useEffect(() => {
    if (![5, 10, 15].includes(size)) {
      setSize(10);
    }
  }, [size]);

  const topicOptions = (meta?.topics || FALLBACK_TOPICS) as Topic[];
  const selectableTopics = topicOptions.filter((value) => value !== "random");
  const difficultyOptions = (meta?.difficulties || Object.keys(difficultyLabels)) as Difficulty[];
  const modeOptions = (meta?.modes || Object.keys(modeLabels)) as QuizMode[];

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        badge="QuizStudy"
        title="Master your next interview"
        description="QuizStudy is an application focused on core Python concepts and essential programming skills."
      />

      {/* Main content grid */}
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left column - Topic selection */}
        <div className="space-y-6">
          {/* Random Mix toggle */}
          <Card className="space-y-4" variant="elevated">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 text-purple-300">
                  <Shuffle size={20} />
                </div>
                <div>
                  <p className="font-semibold text-white">Random Mix</p>
                  <p className="text-xs text-slate-400">
                    Mix questions from all topics
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRandomMix((prev) => !prev);
                  if (!randomMix) {
                    setSelectedTopics([]);
                  }
                }}
                className={cn(
                  "relative h-7 w-12 rounded-full transition-all",
                  randomMix
                    ? "bg-indigo-500 shadow-lg shadow-indigo-500/30"
                    : "bg-white/10"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
                    randomMix ? "left-6" : "left-1"
                  )}
                />
              </button>
            </div>
          </Card>

          {/* Topic cards */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">
              {randomMix ? "Topics (disabled)" : "Select topics"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {selectableTopics.map((topic) => {
                const Icon = TOPIC_ICONS[topic] || BookOpen;
                const checked = selectedTopics.includes(topic);
                return (
                  <TopicCard
                    key={topic}
                    label={topicLabels[topic] ?? topic}
                    description={TOPIC_DESCRIPTIONS[topic]}
                    icon={<Icon size={20} />}
                    selected={checked}
                    disabled={randomMix}
                    onClick={() => {
                      setSelectedTopics((prev) =>
                        checked
                          ? prev.filter((item) => item !== topic)
                          : [...prev, topic]
                      );
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Features */}
          <Card variant="subtle" className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              What's included
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <BookOpen size={16} className="text-indigo-400" />
                <span className="text-sm text-slate-300">MCQ & Code output questions</span>
              </div>
              <div className="flex items-center gap-3">
                <Lightbulb size={16} className="text-indigo-400" />
                <span className="text-sm text-slate-300">AI-powered</span>
              </div>
              <div className="flex items-center gap-3">
                <TrendingUp size={16} className="text-indigo-400" />
                <span className="text-sm text-slate-300">Progress tracking</span>
              </div>
              <div className="flex items-center gap-3">
                <Code2 size={16} className="text-indigo-400" />
                <span className="text-sm text-slate-300">Detailed explanations</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right column - Quiz settings */}
        <div className="space-y-6">
          <Card className="space-y-4" variant="elevated">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">AI Coach</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Tap to get a recommended next quiz
                </p>
              </div>
            </div>

            {generatedLoading ? (
              <div className="space-y-3">
                <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
                <div className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />
                <div className="h-12 animate-pulse rounded-xl bg-white/[0.03]" />
              </div>
            ) : generatedRecommendation ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                  <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-medium text-indigo-300">
                    {generatedRecommendation.topic === "mixed" || generatedRecommendation.topic === "mix"
                      ? "Mixed"
                      : topicLabels[generatedRecommendation.topic as Topic] ?? generatedRecommendation.topic}
                  </span>
                  <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
                    {difficultyLabels[generatedRecommendation.difficulty as Difficulty] ?? generatedRecommendation.difficulty}
                  </span>
                  <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
                    {generatedRecommendation.size} questions
                  </span>
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-slate-200">
                    {generatedRecommendation.reason}
                  </p>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {generatedRecommendation.prep.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <Button type="button" onClick={startRecommendedQuiz} className="w-full">
                  Start recommended quiz
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      navigate("/login?returnUrl=%2F");
                      return;
                    }
                    if (generatedLoading || coachCooldownActive) return;
                    setGeneratedLoading(true);
                    setCoachError(null);
                    generateNextQuizRecommendation()
                      .then((response) => {
                        setGeneratedRecommendation(response);
                        sessionStorage.setItem(
                          "aiCoachRecommendation",
                          JSON.stringify(response)
                        );
                      })
                      .catch((err) => {
                        const apiError = err as ApiError;
                        if (apiError?.status === 429) {
                          setCoachCooldownUntil(
                            apiError.retryAfterSeconds
                              ? Date.now() + apiError.retryAfterSeconds * 1000
                              : null
                          );
                          setCoachError(formatRateLimitMessage(apiError.retryAfterSeconds));
                          return;
                        }
                        setCoachError(apiError?.message || "Failed to load AI coach");
                      })
                      .finally(() => setGeneratedLoading(false));
                  }}
                  disabled={generatedLoading || coachCooldownActive}
                >
                  {generatedLoading ? "Loading..." : "AI Coach"}
                </Button>
                {coachError ? (
                  <p className="text-xs text-rose-200">{coachError}</p>
                ) : null}
              </div>
            )}
          </Card>

          <Card className="space-y-6" variant="elevated">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Quiz Settings</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Configure your practice session
                </p>
              </div>
              <span
                title={metaSource === "fallback" ? "Offline mode" : undefined}
                className={cn(
                  "mt-1 inline-flex h-2.5 w-2.5 rounded-full",
                  metaSource === "api" && "bg-emerald-400/80",
                  metaSource === "fallback" && "bg-slate-500/70",
                  metaSource === null && "bg-slate-700/70"
                )}
              />
            </div>

            {loading ? (
              <div className="space-y-4">
                <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
                <div className="h-12 w-full animate-pulse rounded-xl bg-white/10" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
                <div className="h-12 w-full animate-pulse rounded-xl bg-white/10" />
              </div>
            ) : null}

            <div className="space-y-5">
              {/* Difficulty */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Difficulty
                </label>
                <Segmented
                  value={difficulty}
                  onChange={(value) => setDifficulty(value as Difficulty)}
                  options={difficultyOptions.map((value) => ({
                    label: difficultyLabels[value] ?? value,
                    value
                  }))}
                />
              </div>

              {/* Mode */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Mode
                </label>
                <Segmented
                  value={mode}
                  onChange={(value) => setMode(value as QuizMode)}
                  options={modeOptions.map((value) => ({
                    label: modeLabels[value] ?? value,
                    value,
                    helper:
                      value === "practice"
                        ? "See answers after each question"
                        : "No feedback until the end"
                  }))}
                />
              </div>

              {/* Question count */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">
                    Questions
                  </label>
                  <span className="text-xs text-slate-500">Max {maxSize}</span>
                </div>
                <div className="flex gap-2">
                  {[5, 10, 15].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setSize(count)}
                      className={cn(
                        "flex-1 rounded-xl py-3 text-sm font-semibold transition-all",
                        size === count
                          ? "bg-indigo-500/20 text-indigo-200 ring-2 ring-indigo-500/40"
                          : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-300"
                      )}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <Button
                type="button"
                onClick={startQuiz}
                disabled={!canSubmit || !isAuthenticated}
                size="lg"
                className="w-full"
              >
                <Play size={18} />
                Start Quiz
              </Button>
              {!isAuthenticated ? (
                <div className="space-y-2 text-center">
                  <p className="text-xs text-slate-400">
                    Sign in to start a quiz and save progress.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/login?returnUrl=%2F")}
                  >
                    Sign in
                  </Button>
                </div>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate("/history")}
                className="w-full"
              >
                View History
              </Button>
              {!canSubmit ? (
                <p className="text-center text-xs text-rose-300/80">
                  Select at least one topic (or enable Random Mix)
                </p>
              ) : null}
            </div>
          </Card>

          {/* Quick stats preview */}
          <Card variant="subtle" className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Selection summary
            </p>
            <div className="flex flex-wrap gap-2">
              {randomMix ? (
                <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-medium text-purple-300">
                  Random Mix
                </span>
              ) : selectedTopics.length > 0 ? (
                selectedTopics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-medium text-indigo-300"
                  >
                    {topicLabels[topic]}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">No topics selected</span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>{difficultyLabels[difficulty]} level</span>
              <span>•</span>
              <span>{modeLabels[mode]} mode</span>
              <span>•</span>
              <span>{size} questions</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}


