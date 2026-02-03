import { LogOut, UserCircle } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAttemptStats } from "../api";
import type { AttemptStats } from "../api/types";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<AttemptStats | null>(null);

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

  const handleLogout = async () => {
    await logout();
    navigate("/login");
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
