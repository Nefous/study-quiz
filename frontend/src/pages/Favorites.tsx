import { useEffect, useState } from "react";
import { listFavoriteQuestions, topicLabels, difficultyLabels } from "../api";
import type { FavoriteQuestion } from "../api/types";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import CodeBlock from "../components/ui/CodeBlock";
import PageHeader from "../components/ui/PageHeader";

export default function Favorites() {
  const [favorites, setFavorites] = useState<FavoriteQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await listFavoriteQuestions(200, 0);
        if (active) {
          setFavorites(response);
        }
      } catch {
        if (active) {
          setFavorites([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        badge="Favorites"
        title="Saved questions"
        description="Review questions you've starred"
      />

      {loading ? (
        <Card variant="elevated" className="space-y-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-white/[0.03]" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-white/[0.03]" />
        </Card>
      ) : favorites.length === 0 ? (
        <Card variant="elevated" className="space-y-3 text-center">
          <p className="text-sm text-slate-400">No favorites yet.</p>
          <Button variant="secondary" onClick={() => window.history.back()}>
            Go back
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {favorites.map((question, index) => {
            const { before, code, after, language } = parsePrompt(question.prompt);
            const correctAnswer =
              question.type === "mcq"
                ? question.correct_answer_text || question.correct_answer || "—"
                : question.correct_answer || "—";
            return (
              <Card key={question.id} variant="elevated" className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">Question {index + 1}</Badge>
                  <Badge tone="neutral">{topicLabels[question.topic]}</Badge>
                  <Badge tone="neutral">{difficultyLabels[question.difficulty]}</Badge>
                  <Badge tone={question.type === "mcq" ? "info" : "primary"}>
                    {question.type === "mcq" ? "MCQ" : "Code Output"}
                  </Badge>
                </div>
                <div className="space-y-3 text-slate-100">
                  {before ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{before}</p>
                  ) : null}
                  {code ? <CodeBlock code={code} language={language} /> : null}
                  {after ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{after}</p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-200">
                    Correct answer
                  </p>
                  <p className="mt-2 text-sm text-emerald-100">{correctAnswer}</p>
                  {question.explanation ? (
                    <p className="mt-2 text-xs text-emerald-200/80">
                      {question.explanation}
                    </p>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
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
