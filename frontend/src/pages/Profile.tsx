import { LogOut, UserCircle } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAttemptStats, getNextQuizRecommendation, generateNextQuizRecommendation, startRecommendation } from "../api";
import type { AttemptStats, NextQuizRecommendationGenerated, Difficulty } from "../api/types";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<AttemptStats | null>(null);
  const [generatedRecommendation, setGeneratedRecommendation] = useState<NextQuizRecommendationGenerated | null>(null);
  const [generatedLoading, setGeneratedLoading] = useState(false);

  const createdAtLabel = useMemo(() => {
    if (!user?.created_at) return null;
    const date = new Date(user.created_at);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString();
  }, [user?.created_at]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await getAttemptStats();
        if (active) {
          setStats(response);
        }
      } catch {
        if (active) {
          setStats(null);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
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
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const startRecommendedQuiz = async () => {
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

  const recentAttempts = stats?.recent_attempts ?? [];
  const totalAttempts = stats?.total_attempts ?? recentAttempts.length;
  const startAttemptNo = Math.max(1, totalAttempts - recentAttempts.length + 1);
  const chartData = recentAttempts.map((item, index) => ({
    attempt: index + 1,
    displayAttemptNo: startAttemptNo + index,
    score: item.score_percent,
    created_at: item.created_at
  }));
  const showChart = chartData.length >= 2;
  const scoreValues = chartData.map((item) => item.score);
  const minScore = scoreValues.length ? Math.min(...scoreValues) : null;
  const maxScore = scoreValues.length ? Math.max(...scoreValues) : null;
  const lastScore = scoreValues.length ? scoreValues[scoreValues.length - 1] : null;

  const formatTopicLabel = (topic?: string | null) => {
    if (!topic) return "—";
    const mapping: Record<string, string> = {
      python_core: "Python Core",
      big_o: "Big-O",
      algorithms: "Algorithms",
      data_structures: "Data Structures",
      random: "Random",
      mix: "Mix"
    };
    if (topic === "mixed") return "Mixed";
    return mapping[topic] ?? topic;
  };

  const formatAttemptDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString();
  };

  const headerTitle = user?.first_name
    ? `${user.first_name}, your progress`
    : "Your learning dashboard";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        badge="Profile"
        title={headerTitle}
        description="Account details and stats"
      />

      <Card variant="elevated" className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04]">
            <UserCircle size={18} className="text-slate-300" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Signed in as</p>
            <p className="text-base font-semibold text-white">{user?.email ?? ""}</p>
          </div>
        </div>

        {createdAtLabel ? (
          <div className="text-sm text-slate-400">
            <span className="text-slate-500">Created</span>
            <span className="ml-2 text-slate-300">{createdAtLabel}</span>
          </div>
        ) : null}
        <div className="flex">
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut size={16} />
            Log out
          </Button>
        </div>
      </Card>

      <Card variant="elevated" className="space-y-4">
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
                {formatTopicLabel(generatedRecommendation.topic)}
              </span>
              <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
                {generatedRecommendation.difficulty}
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
            <p className="text-sm text-slate-400">
              Tap to get a recommended next quiz.
            </p>
            <Button
              type="button"
              onClick={() => {
                if (generatedLoading) return;
                setGeneratedLoading(true);
                generateNextQuizRecommendation(true)
                  .then((response) => {
                    setGeneratedRecommendation(response);
                    sessionStorage.setItem(
                      "aiCoachRecommendation",
                      JSON.stringify(response)
                    );
                  })
                  .finally(() => setGeneratedLoading(false));
              }}
              disabled={generatedLoading}
            >
              {generatedLoading ? "Loading..." : "AI Coach"}
            </Button>
          </div>
        )}
      </Card>

      {stats ? (
        <Card variant="elevated" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
              <p className="text-xs text-slate-400">Attempts</p>
              <p className="text-lg font-semibold text-white">{stats.total_attempts}</p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
              <p className="text-xs text-slate-400">Average score</p>
              <p className="text-lg font-semibold text-white">{stats.avg_score_percent}%</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-400">🔥 Current streak (days)</p>
              <p className="text-lg font-semibold text-white">
                {stats.total_attempts > 0
                  ? stats.current_streak_days ?? "—"
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-400">🧠 Strongest topic</p>
              <p className="text-lg font-semibold text-white">
                {formatTopicLabel(stats.strongest_topic)}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-400">🎯 Weakest topic</p>
              <p className="text-lg font-semibold text-white">
                {formatTopicLabel(stats.weakest_topic)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Last 20 attempts</span>
              {showChart ? (
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span>Min {minScore}%</span>
                  <span>Max {maxScore}%</span>
                  <span>Last {lastScore}%</span>
                </div>
              ) : null}
            </div>
            <div className="mt-2 h-32">
              {showChart ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="attempt" hide />
                    <YAxis hide domain={[0, 100]} />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Tooltip
                      cursor={{ stroke: "#38bdf8", strokeWidth: 1, opacity: 0.3 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const point = payload[0].payload as {
                          displayAttemptNo: number;
                          score: number;
                          created_at: string;
                        };
                        return (
                          <div className="rounded-lg border border-white/10 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 shadow-lg">
                            Attempt #{point.displayAttemptNo} — {point.score}% ({formatAttemptDate(point.created_at)})
                          </div>
                        );
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  —
                </div>
              )}
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
