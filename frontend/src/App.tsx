import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { useAuth } from "./context/AuthContext";
import Home from "./pages/Home";
import History from "./pages/History";
import Favorites from "./pages/Favorites";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Quiz from "./pages/Quiz";
import Results from "./pages/Results";
import AuthCallback from "./pages/AuthCallback";

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
      </Routes>
    </AppShell>
  );
}
