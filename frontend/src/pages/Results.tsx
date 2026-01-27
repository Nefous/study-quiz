import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { difficultyLabels, modeLabels, topicLabels } from "../api";
import type { QuizMode, QuizQuestion } from "../api/types";
import Accordion from "../components/ui/Accordion";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import CodeBlock from "../components/ui/CodeBlock";

type ResultsState = {
  settings: {
    topic: string;
    difficulty: string;
    mode: QuizMode;
    size?: number;
  };
  quiz_id: string;
  questions: QuizQuestion[];
  answers: Record<string, string>;
  mode: QuizMode;
  raw_score_percent?: number;
  usedHintsCount?: number;
  penaltyTotal?: number;
  practiceResults?: Record<
    string,
    { correct: boolean; correctAnswer?: string; explanation?: string | null }
  >;
};

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const state = (location.state as ResultsState | null) ?? readStoredResults();

  if (!state) {
    return (
      <Card className="mx-auto max-w-3xl space-y-4">
        <p className="text-sm text-slate-300">No results to show yet.</p>
        <Link className="inline-flex text-sm text-slate-200 underline" to="/">
          Back to home
        </Link>
      </Card>
    );
  }

  const { settings, questions, answers, mode, practiceResults } = state;
  const isPractice = mode === "practice";

  const total = questions.length;
  const score = isPractice
    ? questions.reduce((acc, question) => {
        if (practiceResults?.[question.id]) {
          return acc + (practiceResults[question.id].correct ? 1 : 0);
        }
        const expected = question.correct_answer ?? "";
        const provided = answers[question.id] ?? "";
        return acc + (normalize(expected) === normalize(provided) ? 1 : 0);
      }, 0)
    : null;

  const computedScorePercent = isPractice && total ? Math.round((score! / total) * 100) : 0;
  const rawScorePercent = typeof state.raw_score_percent === "number"
    ? state.raw_score_percent
    : computedScorePercent;
  const usedHintsCount = state.usedHintsCount ?? 0;
  const penaltyTotal = state.penaltyTotal ?? 0;
  const finalScore = clamp(rawScorePercent - penaltyTotal, 0, 100);

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

  const summaryChips = [
    topicLabels[settings.topic as keyof typeof topicLabels] ?? settings.topic,
    difficultyLabels[settings.difficulty as keyof typeof difficultyLabels] ??
      settings.difficulty,
    modeLabels[mode],
    `Size ${settings.size ?? questions.length}`
  ];

  const items = questions.map((question, index) => {
    const shortPrompt = question.prompt.replace(/\s+/g, " ").slice(0, 90);
    const result = practiceResults?.[question.id];
    const isCorrect =
      result?.correct ??
      normalize(question.correct_answer ?? "") ===
        normalize(answers[question.id] ?? "");
    const { before, code, after, language } = parsePrompt(question.prompt);

    return {
      id: question.id,
      header: (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400">Question {index + 1}</p>
            <p className="text-sm font-semibold text-white">
              {shortPrompt}{shortPrompt.length >= 90 ? "…" : ""}
            </p>
          </div>
          {isPractice ? (
            <Badge tone={isCorrect ? "success" : "error"}>
              {isCorrect ? "✓" : "✗"}
            </Badge>
          ) : null}
        </div>
      ),
      content: (
        <div className="space-y-4">
          {before ? (
            <p className="whitespace-pre-wrap text-sm text-slate-200">{before}</p>
          ) : null}
          {code ? <CodeBlock code={code} language={language} /> : null}
          {after ? (
            <p className="whitespace-pre-wrap text-sm text-slate-200">{after}</p>
          ) : null}

          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Your answer</p>
            <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 font-mono text-sm text-slate-100">
              {answers[question.id] || "—"}
            </div>
          </div>

          {isPractice ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Correct answer</p>
                <div className="mt-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 font-mono text-sm text-emerald-100">
                  {result?.correctAnswer ?? question.correct_answer ?? "—"}
                </div>
              </div>
              {result?.explanation || question.explanation ? (
                <details className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  <summary className="cursor-pointer font-semibold text-slate-100">
                    Explanation
                  </summary>
                  <p className="mt-2">
                    {result?.explanation ?? question.explanation}
                  </p>
                </details>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Want feedback? Switch to practice mode for explanations.
            </p>
          )}
        </div>
      )
    };
  });

  const query = new URLSearchParams({
    topic: settings.topic,
    difficulty: settings.difficulty,
    mode: settings.mode,
    size: String(settings.size ?? questions.length)
  });

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400">Results</p>
            <h1 className="text-3xl font-semibold text-white">
              {isPractice ? `${score} / ${total}` : "Quiz submitted"}
            </h1>
            <p className="text-sm text-slate-300">
              {isPractice
                ? `You scored ${rawScorePercent}% on this quiz.`
                : "Review what you submitted and try practice mode for explanations."}
            </p>
          </div>
          {isPractice ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-xs text-slate-400">Score</p>
              <p className="text-2xl font-semibold text-white">{finalScore}%</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {summaryChips.map((chip) => (
            <Badge key={chip} tone="neutral">
              {chip}
            </Badge>
          ))}
        </div>

        {isPractice ? (
          <div className="grid gap-3 text-sm text-slate-200 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-semibold uppercase text-slate-400">Score summary</p>
              <div className="mt-2 space-y-1 text-sm text-slate-200">
                <p>Raw score: {rawScorePercent}%</p>
                <p>Hints used: {usedHintsCount}</p>
                <p>Penalty: -{penaltyTotal}</p>
                <p className="font-semibold text-white">Final score: {finalScore}%</p>
              </div>
            </div>
            {Object.entries(breakdown).map(([type, stats]) => (
              <div key={type} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold uppercase text-slate-400">{type}</p>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-200">
                  <span>
                    {stats.correct} / {stats.total} correct
                  </span>
                  <span>{Math.round((stats.correct / stats.total) * 100)}%</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-indigo-400"
                    style={{ width: `${(stats.correct / stats.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Accordion
        items={items}
        openId={openId}
        onToggle={(id) => setOpenId((prev) => (prev === id ? null : id))}
      />

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate(`/quiz?${query.toString()}`)}>Try again</Button>
        <Button variant="secondary" onClick={() => navigate("/")}>Back to home</Button>
        {mode === "exam" ? (
          <Button
            variant="ghost"
            onClick={() =>
              navigate(`/quiz?${new URLSearchParams({
                topic: settings.topic,
                difficulty: settings.difficulty,
                mode: "practice",
                size: String(settings.size ?? questions.length)
              }).toString()}`)
            }
          >
            Switch to practice
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
