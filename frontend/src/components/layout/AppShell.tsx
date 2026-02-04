import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Github, History, Home, RefreshCw, Star, UserCircle } from "lucide-react";
import Background from "./Background";
import { cn } from "../ui/cn";
import BrandLogo from "../BrandLogo";
import Button from "../ui/Button";
import { useAuth } from "../../context/AuthContext";
import { generateMistakesReview, getMistakesStats } from "../../api";

const navLinks = [
  { to: "/", label: "Home", icon: Home },
  { to: "/history", label: "History", icon: History },
  { to: "/favorites", label: "Favorites", icon: Star }
];

export default function AppShell({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ message: string; tone?: "info" | "error" } | null>(null);
  const [startingMistakes, setStartingMistakes] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const showToast = (message: string, tone: "info" | "error" = "info") => {
    setToast({ message, tone });
  };

  const handleRepeatMistakes = async () => {
    if (!isAuthenticated) {
      navigate("/login?returnUrl=%2Frepeat-mistakes");
      return;
    }
    if (startingMistakes) return;
    setStartingMistakes(true);
    try {
      const stats = await getMistakesStats();
      if (!stats || stats.unique_wrong_questions === 0) {
        showToast("No mistakes to review yet.", "info");
        return;
      }
      const response = await generateMistakesReview(10);
      console.log("Repeat mistakes generate response", response);
      const attemptId =
        response.attempt_id ??
        (response as { attemptId?: string | null }).attemptId ??
        (response as { id?: string | null }).id ??
        (response as { attempt?: { id?: string | null } }).attempt?.id ??
        null;
      if (!attemptId) {
        showToast("Could not start mistakes review. Try again.", "error");
        return;
      }
      const params = new URLSearchParams({
        difficulty: "junior",
        mode: "practice",
        attempt_type: "mistakes_review",
        size: "10"
      });
      navigate(`/quiz?${params.toString()}`, {
        state: {
          preloadedQuiz: response,
          attemptId
        }
      });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        navigate("/login?returnUrl=%2Frepeat-mistakes");
        return;
      }
      showToast("Failed to start mistakes review.", "error");
    } finally {
      setStartingMistakes(false);
    }
  };
  return (
    <div className="min-h-screen text-slate-100">
      <Background />
      
      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 text-white transition hover:opacity-80"
          >
            <BrandLogo size="sm" />
            <span className="hidden font-semibold tracking-tight sm:inline">
              QuizStudy
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )
                }
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}

            <button
              type="button"
              onClick={handleRepeatMistakes}
              disabled={startingMistakes}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                "text-slate-400 hover:bg-white/5 hover:text-white",
                startingMistakes && "opacity-60 cursor-not-allowed"
              )}
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline">
                {startingMistakes ? "Starting..." : "Repeat Mistakes"}
              </span>
            </button>

            {isAuthenticated ? (
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  cn(
                    "ml-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )
                }
              >
                <UserCircle size={16} />
                <span className="hidden sm:inline">Profile</span>
              </NavLink>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="ml-2"
                onClick={() => navigate("/login")}
              >
                Login
              </Button>
            )}

            {/* GitHub link */}
            <a
              href="https://github.com/Nefous/study-quiz"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-slate-400 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
            >
              <Github size={16} />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </nav>
        </div>
      </header>

      {toast ? (
        <div className="pointer-events-none fixed right-4 top-20 z-50">
          <div
            className={cn(
              "rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur",
              toast.tone === "error"
                ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
                : "border-white/10 bg-slate-900/80 text-slate-100"
            )}
          >
            {toast.message}
          </div>
        </div>
      ) : null}

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
