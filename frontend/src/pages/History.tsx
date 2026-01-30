import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Filter,
  Play,
  Target,
  Trophy,
  X
} from "lucide-react";
import { getAttemptStats, listAttempts, difficultyLabels, modeLabels, topicLabels } from "../api";
import type { AttemptOut, AttemptStats, Difficulty, QuizMode, Topic } from "../api/types";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import { cn } from "../components/ui/cn";
import { useAuth } from "../context/AuthContext";

type FilterState = {
  topics: Topic[];
  difficulties: Difficulty[];
  modes: QuizMode[];
};

const ALL_TOPICS: Topic[] = ["python_core", "big_o", "algorithms", "data_structures"];
const TOPIC_BADGE_LABELS: Record<string, string> = {
  python_core: "Python Core",
  big_o: "Big O",
  algorithms: "Algorithms",
  data_structures: "Data Structures",
  random: "Random",
  mix: "Mix"
};
const ALL_DIFFICULTIES: Difficulty[] = ["junior", "middle"];
const ALL_MODES: QuizMode[] = ["practice", "exam"];

export default function History() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const [stats, setStats] = useState<AttemptStats | null>(null);
  const [attempts, setAttempts] = useState<AttemptOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    topics: [],
    difficulties: [],
    modes: []
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (status !== "authed") return;
        setLoading(true);
        const [statsResponse, attemptsResponse] = await Promise.all([
          getAttemptStats(),
          listAttempts(50, 0)
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
  }, [status]);

  useEffect(() => {
    if (status === "guest") {
      navigate("/login", { replace: true });
    }
  }, [navigate, status]);

  const filteredAttempts = useMemo(() => {
    return attempts.filter((attempt) => {
      if (filters.topics.length > 0 && !filters.topics.includes(attempt.topic as Topic)) {
        return false;
      }
      if (filters.difficulties.length > 0 && !filters.difficulties.includes(attempt.difficulty as Difficulty)) {
        return false;
      }
      if (filters.modes.length > 0 && !filters.modes.includes(attempt.mode as QuizMode)) {
        return false;
      }
      return true;
    });
  }, [attempts, filters]);

  const activeFilterCount = filters.topics.length + filters.difficulties.length + filters.modes.length;

  const toggleTopicFilter = (topic: Topic) => {
    setFilters((prev) => ({
      ...prev,
      topics: prev.topics.includes(topic)
        ? prev.topics.filter((t) => t !== topic)
        : [...prev.topics, topic]
    }));
  };

  const toggleDifficultyFilter = (diff: Difficulty) => {
    setFilters((prev) => ({
      ...prev,
      difficulties: prev.difficulties.includes(diff)
        ? prev.difficulties.filter((d) => d !== diff)
        : [...prev.difficulties, diff]
    }));
  };

  const toggleModeFilter = (mode: QuizMode) => {
    setFilters((prev) => ({
      ...prev,
      modes: prev.modes.includes(mode)
        ? prev.modes.filter((m) => m !== mode)
        : [...prev.modes, mode]
    }));
  };

  const clearFilters = () => {
    setFilters({ topics: [], difficulties: [], modes: [] });
  };

  if (loading || status === "loading") {
    return (
      <div className="space-y-8">
        <PageHeader
          badge="History & Stats"
          title="Your Performance"
          description="Loading your quiz history..."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-white/[0.03]"
            />
          ))}
        </div>
        <Card variant="elevated" className="space-y-4">
          <div className="h-6 w-1/3 animate-pulse rounded bg-white/10" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-white/[0.03]"
              />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader
          badge="History & Stats"
          title="Your Performance"
          description="Track your progress over time"
        />
        <Card variant="elevated" className="space-y-4">
          <div className="flex items-center gap-3 text-rose-400">
            <X size={24} />
            <p className="text-white">{error}</p>
          </div>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        badge="History & Stats"
        title="Your Performance"
        description="Track your progress and review past attempts"
        actions={
          <Button onClick={() => navigate("/")}>
            <Play size={16} />
            Start Quiz
          </Button>
        }
      />

      {/* Stats cards */}
      {stats ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Attempts"
            value={stats.total_attempts}
            icon={<BarChart3 size={20} />}
          />
          <StatCard
            label="Average Score"
            value={`${stats.avg_score_percent}%`}
            icon={<Target size={20} />}
            trend={
              stats.avg_score_percent >= 70
                ? "up"
                : stats.avg_score_percent >= 50
                  ? "neutral"
                  : "down"
            }
          />
          <StatCard
            label="Best Score"
            value={`${stats.best_score_percent}%`}
            icon={<Trophy size={20} />}
            trend="up"
          />
        </div>
      ) : null}

      {/* By topic breakdown */}
      {stats?.by_topic?.length ? (
        <Card variant="elevated" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Performance by Topic</h2>
            <p className="text-sm text-slate-400">Your average scores across topics</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {stats.by_topic.map((item) => {
              const percent = item.avg_score_percent;
              return (
                <div
                  key={item.topic}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">
                      {topicLabels[item.topic as keyof typeof topicLabels] ?? item.topic}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        percent >= 70
                          ? "text-emerald-400"
                          : percent >= 50
                            ? "text-amber-400"
                            : "text-rose-400"
                      )}
                    >
                      {percent}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.attempts} attempt{item.attempts !== 1 ? "s" : ""}
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

      {/* Attempts list */}
      <Card variant="elevated" className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Recent Attempts</h2>
            <p className="text-sm text-slate-400">
              {filteredAttempts.length} of {attempts.length} attempts
            </p>
          </div>
          <Button
            variant={showFilters ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowFilters((prev) => !prev)}
          >
            <Filter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-indigo-500/20 px-1.5 text-xs text-indigo-300">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              size={14}
              className={cn("transition-transform", showFilters && "rotate-180")}
            />
          </Button>
        </div>

        {/* Filter panel */}
        {showFilters ? (
          <div className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            {/* Topic filters */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Topics
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_TOPICS.map((topic) => {
                  const active = filters.topics.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopicFilter(topic)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        active
                          ? "border-indigo-400/40 bg-indigo-400/15 text-indigo-200"
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-300"
                      )}
                    >
                      {topicLabels[topic]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty filters */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Difficulty
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_DIFFICULTIES.map((diff) => {
                  const active = filters.difficulties.includes(diff);
                  return (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => toggleDifficultyFilter(diff)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        active
                          ? "border-indigo-400/40 bg-indigo-400/15 text-indigo-200"
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-300"
                      )}
                    >
                      {difficultyLabels[diff]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode filters */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Mode
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_MODES.map((mode) => {
                  const active = filters.modes.includes(mode);
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => toggleModeFilter(mode)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        active
                          ? "border-indigo-400/40 bg-indigo-400/15 text-indigo-200"
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-300"
                      )}
                    >
                      {modeLabels[mode]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clear filters */}
            {activeFilterCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X size={14} />
                Clear all filters
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* Attempts list */}
        {filteredAttempts.length > 0 ? (
          <div className="divide-y divide-white/[0.06]">
            {filteredAttempts.map((attempt) => {
              const scoreColor =
                attempt.score_percent >= 70
                  ? "text-emerald-400"
                  : attempt.score_percent >= 50
                    ? "text-amber-400"
                    : "text-rose-400";
              const metaTopics = attempt.meta?.topics ?? [];
              const topicLabelsList = metaTopics.map(
                (topic) => TOPIC_BADGE_LABELS[topic] ?? topic
              );
              const showCondensedTopics = topicLabelsList.length > 2;
              const condensedLabel = showCondensedTopics
                ? `${topicLabelsList[0]} +${topicLabelsList.length - 1}`
                : "";

              return (
                <div
                  key={attempt.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Calendar size={12} />
                      {new Date(attempt.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {topicLabelsList.length > 0 ? (
                        showCondensedTopics ? (
                          <Badge tone="neutral">{condensedLabel}</Badge>
                        ) : (
                          topicLabelsList.map((label) => (
                            <Badge tone="neutral" key={label}>
                              {label}
                            </Badge>
                          ))
                        )
                      ) : (
                        <Badge tone="neutral">
                          {TOPIC_BADGE_LABELS[attempt.topic] ??
                            topicLabels[attempt.topic as keyof typeof topicLabels] ??
                            attempt.topic}
                        </Badge>
                      )}
                      <Badge tone="neutral">
                        {difficultyLabels[attempt.difficulty as keyof typeof difficultyLabels] ?? attempt.difficulty}
                      </Badge>
                      <Badge tone="neutral">
                        {modeLabels[attempt.mode as keyof typeof modeLabels] ?? attempt.mode}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={cn("text-lg font-semibold", scoreColor)}>
                        {attempt.score_percent}%
                      </p>
                      <p className="text-xs text-slate-400">
                        {attempt.correct_count}/{attempt.total_count} correct
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/results/${attempt.id}`)}
                    >
                      View
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : attempts.length > 0 ? (
          <EmptyState
            icon={<Filter size={24} />}
            title="No matching attempts"
            description="Try adjusting your filters to see more results."
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<BarChart3 size={24} />}
            title="No attempts yet"
            description="Complete a quiz to start tracking your progress."
            action={
              <Button onClick={() => navigate("/")}>
                <Play size={16} />
                Start a Quiz
              </Button>
            }
          />
        )}
      </Card>
    </div>
  );
}
