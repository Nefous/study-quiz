import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { generateQuiz, difficultyLabels, modeLabels, topicLabels } from "../api";
import type {
  Difficulty,
  QuizGenerateRequest,
  QuizGenerateResponse,
  QuizMode,
  QuizQuestion,
  Topic
} from "../api/types";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import CodeBlock from "../components/ui/CodeBlock";
import Modal from "../components/ui/Modal";
import Progress from "../components/ui/Progress";
import Spinner from "../components/ui/Spinner";
import { cn } from "../components/ui/cn";

type PracticeResult = {
  correct: boolean;
  correctAnswer: string;
  explanation?: string | null;
};

const STORAGE_PREFIX = "quizstate";
const RESULTS_PREFIX = "quizresults";

export default function Quiz() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizGenerateResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, PracticeResult>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showQuit, setShowQuit] = useState(false);

  const settings = useMemo<QuizGenerateRequest | null>(() => {
    const topic = params.get("topic") as Topic | null;
    const difficulty = params.get("difficulty") as Difficulty | null;
    const mode = params.get("mode") as QuizMode | null;
    const sizeParam = params.get("size");
    const size = sizeParam ? Number(sizeParam) : undefined;

    const validTopics = Object.keys(topicLabels) as Topic[];
    const validDifficulties = Object.keys(difficultyLabels) as Difficulty[];
    const validModes = Object.keys(modeLabels) as QuizMode[];

    if (!topic || !difficulty || !mode) return null;
    if (!validTopics.includes(topic)) return null;
    if (!validDifficulties.includes(difficulty)) return null;
    if (!validModes.includes(mode)) return null;

    return {
      topic,
      difficulty,
      mode,
      size: Number.isFinite(size) ? Math.max(1, Number(size)) : undefined
    };
  }, [params]);

  const storageKey = useMemo(() => {
    if (!settings) return `${STORAGE_PREFIX}:invalid`;
    return `${STORAGE_PREFIX}:${settings.topic}:${settings.difficulty}:${settings.mode}:${
      settings.size ?? "default"
    }`;
  }, [settings]);

  useEffect(() => {
    if (!settings) {
      navigate("/");
    }
  }, [navigate, settings]);

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
            };
            if (parsed?.quiz?.questions?.length) {
              if (active) {
                setQuiz(parsed.quiz);
                setAnswers(parsed.answers || {});
                setSubmitted(parsed.submitted || {});
                setResults(parsed.results || {});
                setCurrentIndex(parsed.currentIndex || 0);
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
      JSON.stringify({ quiz, answers, submitted, results, currentIndex })
    );
  }, [answers, currentIndex, quiz, results, storageKey, submitted]);

  if (!settings) {
    return null;
  }

  if (loading) {
    return (
      <Card className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-3">
          <Spinner />
          <p className="text-sm text-slate-300">Preparing your quiz...</p>
        </div>
        <div className="space-y-3">
          <div className="h-4 w-1/2 rounded bg-white/10" />
          <div className="h-10 w-full rounded-xl bg-white/10" />
          <div className="h-24 w-full rounded-xl bg-white/10" />
        </div>
      </Card>
    );
  }

  if (error || !quiz) {
    return (
      <Card className="mx-auto max-w-3xl space-y-4">
        <Alert>{error ?? "Quiz could not be loaded."}</Alert>
        <Button variant="secondary" onClick={() => navigate("/")}
        >
          Back to home
        </Button>
      </Card>
    );
  }

  const questions = quiz.questions;
  const question = questions[currentIndex];
  const isPractice = settings.mode === "practice";
  const currentAnswer = answers[question.id] ?? "";
  const isSubmitted = Boolean(submitted[question.id]);
  const progress = questions.length
    ? ((currentIndex + 1) / questions.length) * 100
    : 0;

  const { before, code, after, language } = parsePrompt(question.prompt);

  const handleSubmit = () => {
    if (isSubmitted) return;
    const normalizedAnswer = normalizeAnswer(currentAnswer);
    setSubmitted((prev) => ({ ...prev, [question.id]: true }));
    if (isPractice) {
      const expected = normalizeAnswer(question.correct_answer ?? "");
      setResults((prev) => ({
        ...prev,
        [question.id]: {
          correct: normalizedAnswer === expected,
          correctAnswer: question.correct_answer ?? "",
          explanation: question.explanation
        }
      }));
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    const payload = {
      settings,
      quiz_id: quiz.quiz_id,
      questions,
      answers,
      mode: settings.mode,
      practiceResults: results
    };
    sessionStorage.setItem(`${RESULTS_PREFIX}:${quiz.quiz_id}`, JSON.stringify(payload));
    sessionStorage.setItem(`${RESULTS_PREFIX}:last`, JSON.stringify(payload));
    sessionStorage.removeItem(storageKey);
    navigate("/results", { state: payload });
  };

  const handleQuit = () => {
    sessionStorage.removeItem(storageKey);
    navigate("/");
  };

  const result = results[question.id];

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Card className="sticky top-20 z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Question</p>
            <h2 className="text-lg font-semibold text-white">
              {currentIndex + 1} of {questions.length}
            </h2>
          </div>
          <Button variant="ghost" onClick={() => setShowQuit(true)}>
            Quit
          </Button>
        </div>
        <Progress value={progress} />
      </Card>

      <Card className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <span className="uppercase tracking-wide">{question.type}</span>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{topicLabels[question.topic]}</Badge>
            <Badge tone="neutral">{difficultyLabels[question.difficulty]}</Badge>
          </div>
        </div>

        <div className="space-y-4 text-slate-100">
          {before ? <p className="whitespace-pre-wrap leading-relaxed">{before}</p> : null}
          {code ? <CodeBlock code={code} language={language} /> : null}
          {after ? <p className="whitespace-pre-wrap leading-relaxed">{after}</p> : null}
        </div>

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
                  <button
                    key={key}
                    type="button"
                    disabled={isSubmitted}
                    onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: key }))}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left text-sm transition",
                      active ? "border-indigo-400/60 bg-indigo-400/10 text-white" : "border-white/10 text-slate-200",
                      isCorrectChoice && "border-emerald-400/60 bg-emerald-400/10 text-emerald-100",
                      isIncorrectChoice && "border-rose-400/60 bg-rose-400/10 text-rose-100",
                      isSubmitted && "cursor-not-allowed opacity-70"
                    )}
                  >
                    <span className="text-xs font-semibold">{key}</span>
                    <span>{value}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              value={currentAnswer}
              onChange={(event) =>
                setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))
              }
              placeholder="Type the expected output"
              rows={5}
              readOnly={isSubmitted}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
            />
          )}
        </div>

        {isSubmitted ? (
          <Card className="space-y-3 border-white/10 bg-white/5">
            {isPractice ? (
              <div className="flex items-center gap-3">
                <Badge tone={result?.correct ? "success" : "error"}>
                  {result?.correct ? "Correct" : "Incorrect"}
                </Badge>
                <span className="text-sm text-slate-300">
                  Correct answer: {result?.correctAnswer || "—"}
                </span>
              </div>
            ) : (
              <Badge tone="neutral">Answer submitted</Badge>
            )}

            {isPractice && result?.explanation ? (
              <details className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <summary className="cursor-pointer font-semibold text-slate-100">
                  Explanation
                </summary>
                <p className="mt-2 text-slate-300">{result.explanation}</p>
              </details>
            ) : null}
          </Card>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {!isSubmitted ? (
            <Button onClick={handleSubmit} disabled={!currentAnswer.trim()}>
              Submit Answer
            </Button>
          ) : (
            <Button onClick={handleNext}>
              {currentIndex === questions.length - 1 ? "Finish Quiz" : "Next Question"}
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate("/")}>Back to setup</Button>
        </div>
      </Card>

      <Modal
        open={showQuit}
        title="Quit quiz?"
        description="Your current progress will be lost."
        confirmLabel="Quit"
        onConfirm={handleQuit}
        onClose={() => setShowQuit(false)}
      />
    </section>
  );
}

function normalizeAnswer(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
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
