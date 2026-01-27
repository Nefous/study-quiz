import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAttemptStats, listAttempts, difficultyLabels, topicLabels } from "../api";
import type { AttemptOut, AttemptStats } from "../api/types";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";

export default function History() {
  const [stats, setStats] = useState<AttemptStats | null>(null);
  const [attempts, setAttempts] = useState<AttemptOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const [statsResponse, attemptsResponse] = await Promise.all([
          getAttemptStats(),
          listAttempts(20, 0)
        ]);
        if (active) {
          setStats(statsResponse);
          setAttempts(attemptsResponse);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load history");
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
  }, []);

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">History & Stats</p>
          <h1 className="text-3xl font-semibold text-white">Quiz performance</h1>
        </div>
        <Link className="text-sm text-slate-200 underline" to="/">
          Back to home
        </Link>
      </div>

      {loading ? <p className="text-sm text-slate-300">Loading history...</p> : null}
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}

      {stats ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="space-y-1">
            <p className="text-xs text-slate-400">Total attempts</p>
            <p className="text-2xl font-semibold text-white">{stats.total_attempts}</p>
          </Card>
          <Card className="space-y-1">
            <p className="text-xs text-slate-400">Average score</p>
            <p className="text-2xl font-semibold text-white">{stats.avg_score_percent}%</p>
          </Card>
          <Card className="space-y-1">
            <p className="text-xs text-slate-400">Best score</p>
            <p className="text-2xl font-semibold text-white">{stats.best_score_percent}%</p>
          </Card>
        </div>
      ) : null}

      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Recent attempts</h2>
          <p className="text-sm text-slate-400">Last 20 attempts.</p>
        </div>
        <div className="space-y-2">
          {attempts.length ? (
            attempts.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
              >
                <div>
                  <p className="text-xs text-slate-400">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">
                      {topicLabels[item.topic as keyof typeof topicLabels] ?? item.topic}
                    </Badge>
                    <Badge tone="neutral">
                      {difficultyLabels[item.difficulty as keyof typeof difficultyLabels] ?? item.difficulty}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Score</p>
                  <p className="font-semibold text-white">
                    {item.score_percent}% ({item.correct_count}/{item.total_count})
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-300">No attempts yet.</p>
          )}
        </div>
      </Card>

      {stats?.by_topic?.length ? (
        <Card className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-white">By topic</h2>
            <p className="text-sm text-slate-400">Attempts and average score.</p>
          </div>
          <div className="grid gap-2">
            {stats.by_topic.map((item) => (
              <div
                key={item.topic}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
              >
                <span>
                  {topicLabels[item.topic as keyof typeof topicLabels] ?? item.topic}
                </span>
                <span>
                  {item.attempts} attempts · {item.avg_score_percent}% avg
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </section>
  );
}
