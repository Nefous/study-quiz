import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { generateMistakesReview, getMistakesStats } from "../api";
import type { MistakesStats } from "../api/types";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";

export default function RepeatMistakes() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<MistakesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await getMistakesStats();
        if (active) {
          setStats(response);
        }
      } catch {
        if (active) {
          setStats(null);
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

  const startRepeatMistakes = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const response = await generateMistakesReview(10);
      const params = new URLSearchParams({
        difficulty: "junior",
        mode: "practice",
        attempt_type: "mistakes_review",
        size: "10"
      });
      navigate(`/quiz?${params.toString()}`, {
        state: {
          preloadedQuiz: response,
          attemptId: response.attempt_id ?? null
        }
      });
    } finally {
      setStarting(false);
    }
  };

  const startMixedQuiz = () => {
    const params = new URLSearchParams({
      difficulty: "junior",
      mode: "practice",
      size: "10",
      topic: "random"
    });
    navigate(`/quiz?${params.toString()}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        badge="Repeat Mistakes"
        title="Focus on what you missed"
        description="Review questions you previously answered incorrectly."
        actions={
          <Button variant="secondary" onClick={startRepeatMistakes} disabled={starting}>
            <RefreshCw size={16} />
            {starting ? "Starting..." : "Start review"}
          </Button>
        }
      />

      {loading ? (
        <Card variant="elevated" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Your mistakes</h2>
            <p className="text-sm text-slate-400">
              See how many questions are ready for review
            </p>
          </div>
          <div className="space-y-3">
            <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
            <div className="h-12 animate-pulse rounded-xl bg-white/[0.03]" />
          </div>
        </Card>
      ) : stats && stats.total_wrong > 0 ? (
        <Card variant="elevated" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Your mistakes</h2>
            <p className="text-sm text-slate-400">
              See how many questions are ready for review
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-300">
                {stats.unique_wrong_questions} questions to revisit
              </span>
              <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
                {stats.last_30_days_wrong} wrong in 30 days
              </span>
            </div>
            <Button type="button" onClick={startRepeatMistakes} className="w-full" disabled={starting}>
              {starting ? "Starting..." : "Repeat mistakes"}
            </Button>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={<RefreshCw size={24} />}
          title="No mistakes yet"
          description="Complete a mixed quiz to start building your mistakes review list."
          action={
            <Button type="button" onClick={startMixedQuiz}>
              Start mixed quiz
            </Button>
          }
        />
      )}
    </div>
  );
}
