import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { useAuth } from "./context/AuthContext";
import Home from "./pages/Home";
import History from "./pages/History";
import Favorites from "./pages/Favorites";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import RepeatMistakes from "./pages/RepeatMistakes";
import Quiz from "./pages/Quiz";
import Results from "./pages/Results";
import AuthCallback from "./pages/AuthCallback";
import AdminCandidatesPage from "./pages/AdminCandidatesPage";
import { getAdminUser } from "./api/adminCandidatesApi";
import type { ApiError } from "./api/types";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="h-24 animate-pulse rounded-2xl bg-white/[0.03]" />
      </div>
    );
  }
  if (!user || status === "guest") {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }
  return children;
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const [status, setStatus] = useState<
    "loading" | "allowed" | "forbidden" | "unauthorized"
  >("loading");
  const location = useLocation();

  useEffect(() => {
    let active = true;
    const checkAdmin = async () => {
      try {
        const current = await getAdminUser();
        const isAdmin = Boolean(current?.is_admin || current?.role === "admin");
        if (active) {
          setStatus(isAdmin ? "allowed" : "forbidden");
        }
      } catch (err) {
        const apiError = err as ApiError;
        if (active) {
          if (apiError?.status === 401) {
            setStatus("unauthorized");
            return;
          }
          if (apiError?.status === 403) {
            setStatus("forbidden");
            return;
          }
          setStatus("forbidden");
        }
      }
    };

    checkAdmin();
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="h-24 animate-pulse rounded-2xl bg-white/[0.03]" />
      </div>
    );
  }
  if (status === "unauthorized") {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }
  if (status === "forbidden") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-slate-200">
          <h2 className="text-lg font-semibold text-white">No access</h2>
          <p className="mt-2 text-sm text-slate-400">
            You do not have permission to view this page.
          </p>
          <div className="mt-4">
            <Link
              to="/"
              className="text-sm font-semibold text-indigo-300 hover:text-indigo-200"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/history"
          element={
            <RequireAuth>
              <History />
            </RequireAuth>
          }
        />
        <Route
          path="/favorites"
          element={
            <RequireAuth>
              <Favorites />
            </RequireAuth>
          }
        />
        <Route
          path="/quiz"
          element={
            <RequireAuth>
              <Quiz />
            </RequireAuth>
          }
        />
        <Route
          path="/results"
          element={
            <RequireAuth>
              <Results />
            </RequireAuth>
          }
        />
        <Route
          path="/results/:attemptId"
          element={
            <RequireAuth>
              <Results />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        <Route
          path="/repeat-mistakes"
          element={
            <RequireAuth>
              <RepeatMistakes />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminRoute>
                <AdminCandidatesPage />
              </AdminRoute>
            </RequireAuth>
          }
        />
      </Routes>
    </AppShell>
  );
}
