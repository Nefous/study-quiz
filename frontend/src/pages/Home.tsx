import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Code2, LineChart, Sparkles } from "lucide-react";
import { getMeta, topicLabels, difficultyLabels, modeLabels } from "../api";
import type { Difficulty, MetaResponse, QuizMode, Topic } from "../api/types";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Segmented from "../components/ui/Segmented";
import Slider from "../components/ui/Slider";
import TopicCards from "../components/ui/TopicCards";

const STORAGE_KEY = "quizSetup";
const FALLBACK_DEFAULT_SIZE = 10;
const FALLBACK_MAX_SIZE = 20;

export default function Home() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState<Topic>("python_core");
  const [difficulty, setDifficulty] = useState<Difficulty>("junior");
  const [mode, setMode] = useState<QuizMode>("practice");
  const [size, setSize] = useState<number>(FALLBACK_DEFAULT_SIZE);
  const [maxSize, setMaxSize] = useState<number>(FALLBACK_MAX_SIZE);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => Boolean(topic && difficulty && mode && size > 0),
    [topic, difficulty, mode, size]
  );

  const startQuiz = () => {
    const params = new URLSearchParams({
      topic,
      difficulty,
      mode,
      size: String(size)
    });
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
          topic: Topic;
          difficulty: Difficulty;
          mode: QuizMode;
          size: number;
        };
        setTopic(parsed.topic);
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
      JSON.stringify({ topic, difficulty, mode, size })
    );
  }, [topic, difficulty, mode, size]);

  useEffect(() => {
    if (size > maxSize) {
      setSize(maxSize);
    }
  }, [maxSize, size]);

  const topicOptions = (meta?.topics || Object.keys(topicLabels)) as Topic[];
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
            <span className="text-sm font-medium text-slate-200">Topic</span>
            <TopicCards
              value={topic}
              onChange={(value) => setTopic(value as Topic)}
              options={topicOptions.map((value) => ({
                value,
                title: topicLabels[value] ?? value,
                description:
                  value === "python_core"
                    ? "Syntax, data types, and idioms"
                    : value === "big_o"
                      ? "Complexity and trade-offs"
                      : value === "algorithms"
                        ? "Sorting, searching, patterns"
                        : "Lists, stacks, queues, trees",
                icon:
                  value === "python_core" ? <Code2 size={18} /> :
                  value === "big_o" ? <LineChart size={18} /> :
                  value === "algorithms" ? <Sparkles size={18} /> :
                  <BookOpen size={18} />
              }))}
            />
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
            <Slider
              min={1}
              max={maxSize}
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            />
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={maxSize}
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
              />
              <span className="text-xs text-slate-400">questions</span>
            </div>
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
            <p className="text-xs text-rose-200">Select a topic, difficulty, mode, and size.</p>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
