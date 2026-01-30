import type { PropsWithChildren } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Github, History, Home, UserCircle } from "lucide-react";
import Background from "./Background";
import { cn } from "../ui/cn";
import BrandLogo from "../BrandLogo";
import Button from "../ui/Button";
import { useAuth } from "../../context/AuthContext";

const navLinks = [
  { to: "/", label: "Home", icon: Home },
  { to: "/history", label: "History", icon: History }
];

export default function AppShell({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
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

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
