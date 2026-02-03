import { LogOut, Mail, UserCircle } from "lucide-react";
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

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        badge="Profile"
        title="Your account"
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

        {stats ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-400">Attempts</p>
              <p className="text-lg font-semibold text-white">{stats.total_attempts}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-400">Average score</p>
              <p className="text-lg font-semibold text-white">{stats.avg_score_percent}%</p>
            </div>
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
                {stats.strongest_topic ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-400">🎯 Weakest topic</p>
              <p className="text-lg font-semibold text-white">
                {stats.weakest_topic ?? "—"}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex">
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut size={16} />
            Log out
          </Button>
        </div>
      </Card>
    </div>
  );
}
