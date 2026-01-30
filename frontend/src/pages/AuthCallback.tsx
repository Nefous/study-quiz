import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Alert from "../components/ui/Alert";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import { useAuth } from "../context/AuthContext";
import { me as apiMe } from "../api";
import type { ApiError } from "../api/types";

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const success = params.get("success") === "1";

  useEffect(() => {
    let active = true;
    const complete = async () => {
      if (!success) {
        if (active) {
          setError("Authentication failed. Please try again.");
        }
        return;
      }
      try {
        await apiMe();
        if (active) {
          navigate("/");
        }
        return;
      } catch (err) {
        const apiError = err as ApiError;
        if (apiError?.status !== 401) {
          if (active) {
            setError("Authentication failed. Please try again.");
          }
          return;
        }
      }

      const token = await refresh();
      if (!active) {
        return;
      }
      if (!token) {
        setError("Authentication failed. Please try again.");
        return;
      }

      try {
        await apiMe();
        if (active) {
          navigate("/");
        }
      } catch {
        if (active) {
          setError("Authentication failed. Please try again.");
        }
      }
    };
    void complete();
    return () => {
      active = false;
    };
  }, [navigate, refresh, success]);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader
        badge="Signing in"
        title="Completing sign-in"
        description="We’re wrapping up your OAuth sign-in."
      />
      <Card variant="elevated" className="space-y-4">
        {error ? <Alert>{error}</Alert> : <p className="text-sm text-slate-400">Please wait…</p>}
      </Card>
    </div>
  );
}
