import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Code2, LineChart, Sparkles } from "lucide-react";
import { getMeta, topicLabels, difficultyLabels, modeLabels } from "../api";
import type { Difficulty, MetaResponse, QuizMode, Topic } from "../api/types";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import ChoiceChips from "../components/ui/ChoiceChips";
import Segmented from "../components/ui/Segmented";

const STORAGE_KEY = "quizSetup";
const FALLBACK_DEFAULT_SIZE = 10;
const FALLBACK_MAX_SIZE = 20;

export default function Home() {
  const navigate = useNavigate();
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>(["python_core"]);
  const [randomMix, setRandomMix] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("junior");
  const [mode, setMode] = useState<QuizMode>("practice");
  const [size, setSize] = useState<number>(FALLBACK_DEFAULT_SIZE);
  const [maxSize, setMaxSize] = useState<number>(FALLBACK_MAX_SIZE);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!difficulty || !mode || size <= 0) return false;
    if (randomMix) return true;
    return selectedTopics.length > 0;
  }, [difficulty, mode, randomMix, selectedTopics.length, size]);

  const startQuiz = () => {
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
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load defaults");
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

  const topicOptions = (meta?.topics || Object.keys(topicLabels)) as Topic[];
  const selectableTopics = topicOptions.filter((value) => value !== "random");
  const difficultyOptions = (meta?.difficulties || Object.keys(difficultyLabels)) as Difficulty[];
  const modeOptions = (meta?.modes || Object.keys(modeLabels)) as QuizMode[];

  return (
    <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-200">Python Interview Prep</p>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">
            Build confidence with focused interview practice.
          </h1>
          <p className="text-sm text-slate-300">
            Curated questions across core Python, algorithms, and data structures.
          </p>
        </div>

        <div className="grid gap-3 text-sm text-slate-200">
          <div className="flex items-center gap-3">
            <BookOpen size={18} className="text-indigo-300" />
            <span>Realistic questions (MCQ + Code output)</span>
          </div>
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-indigo-300" />
            <span>Practice or Exam mode</span>
          </div>
          <div className="flex items-center gap-3">
            <LineChart size={18} className="text-indigo-300" />
            <span>Junior → Middle progression</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs text-slate-400">Topics</p>
            <p className="text-lg font-semibold text-white">{topicOptions.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs text-slate-400">Modes</p>
            <p className="text-lg font-semibold text-white">{modeOptions.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs text-slate-400">Questions</p>
            <p className="text-lg font-semibold text-white">20+</p>
          </div>
        </div>
      </div>

      <Card className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Quiz setup</h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose what you want to practice today.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-1/3 rounded bg-white/10" />
            <div className="h-20 w-full rounded-2xl bg-white/10" />
            <div className="h-4 w-1/2 rounded bg-white/10" />
            <div className="h-12 w-full rounded-2xl bg-white/10" />
          </div>
        ) : null}

        {error ? <Alert>{error}</Alert> : null}

        <div className="space-y-5">
          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Topics</span>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setRandomMix((prev) => !prev);
                  if (!randomMix) {
                    setSelectedTopics([]);
                  }
                }}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  randomMix
                    ? "border-indigo-400/60 bg-indigo-400/10 text-white"
                    : "border-white/10 text-slate-200 hover:border-white/30"
                }`}
              >
                <div>
                  <p className="font-semibold">Random Mix</p>
                  <p className="text-xs text-slate-400">Mix questions from all topics.</p>
                </div>
                <span className="text-xs font-semibold">{randomMix ? "On" : "Off"}</span>
              </button>

              <div className="grid gap-2">
                {selectableTopics.map((value) => {
                  const checked = selectedTopics.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={randomMix}
                      onClick={() => {
                        setSelectedTopics((prev) =>
                          checked
                            ? prev.filter((item) => item !== value)
                            : [...prev, value]
                        );
                      }}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        checked
                          ? "border-indigo-400/60 bg-indigo-400/10 text-white"
                          : "border-white/10 text-slate-200 hover:border-white/30"
                      } ${randomMix ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20">
                        {checked ? "✓" : ""}
                      </div>
                      <div>
                        <p className="font-semibold">{topicLabels[value] ?? value}</p>
                        <p className="text-xs text-slate-400">
                          {value === "python_core"
                            ? "Syntax, data types, and idioms"
                            : value === "big_o"
                              ? "Complexity and trade-offs"
                              : value === "algorithms"
                                ? "Sorting, searching, patterns"
                                : "Lists, stacks, queues, trees"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Difficulty</span>
            <Segmented
              value={difficulty}
              onChange={(value) => setDifficulty(value as Difficulty)}
              options={difficultyOptions.map((value) => ({
                label: difficultyLabels[value] ?? value,
                value
              }))}
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Mode</span>
            <Segmented
              value={mode}
              onChange={(value) => setMode(value as QuizMode)}
              options={modeOptions.map((value) => ({
                label: modeLabels[value] ?? value,
                value,
                helper:
                  value === "practice"
                    ? "Immediate feedback + explanations."
                    : "No answers shown during the quiz."
              }))}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <span className="font-medium">Number of questions</span>
              <span className="text-xs text-slate-400">Max {maxSize}</span>
            </div>
            <ChoiceChips
              value={size}
              onChange={setSize}
              options={[
                { label: "5", value: 5 },
                { label: "10", value: 10 },
                { label: "15", value: 15 }
              ]}
            />
            <p className="text-xs text-slate-400">Questions per quiz</p>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            onClick={startQuiz}
            disabled={!canSubmit}
            size="lg"
            className="w-full"
          >
            Start Quiz
          </Button>
          {!canSubmit ? (
            <p className="text-xs text-rose-200">
              Select at least one topic (or enable Random Mix), difficulty, mode, and size.
            </p>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
