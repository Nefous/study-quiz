import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Chrome, Github, Lock, Mail } from "lucide-react";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import PageHeader from "../components/ui/PageHeader";
import { useAuth } from "../context/AuthContext";
import type { ApiError } from "../api/types";
import { apiUrl } from "../api/client";

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [touched, setTouched] = useState<{ email: boolean; password: boolean; confirm: boolean }>(
    { email: false, password: false, confirm: false }
  );
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirm?: string }>({});
  const [submitted, setSubmitted] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validate = () => {
    const errors: { email?: string; password?: string; confirm?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = "Email is required";
    } else if (!emailRegex.test(trimmedEmail)) {
      errors.email = "Enter a valid email address";
    }

    const passwordBytes = new TextEncoder().encode(password).length;
    const hasLetter = /[A-Za-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    } else if (!hasLetter || !hasDigit) {
      errors.password = "Password must include at least 1 letter and 1 number";
    } else if (passwordBytes > 72) {
      errors.password = "Password is too long (max 72 bytes)";
    }

    if (mode === "signup") {
      if (!confirmPassword) {
        errors.confirm = "Confirm password is required";
      } else if (confirmPassword !== password) {
        errors.confirm = "Passwords do not match";
      }
    }

    return errors;
  };

  const isFormValid = useMemo(() => {
    const errors = validate();
    return Object.keys(errors).length === 0;
  }, [email, password, confirmPassword, mode]);

  useEffect(() => {
    if (user) {
      const returnUrl = params.get("returnUrl") || "/";
      navigate(returnUrl);
    }
  }, [navigate, params, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setTouched({ email: true, password: true, confirm: true });
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      if (mode === "signup") {
        await register(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      const returnUrl = params.get("returnUrl") || "/";
      navigate(returnUrl);
    } catch (err) {
      const apiError = err as ApiError;
      if (mode === "signup") {
        if (apiError?.status === 409 || apiError?.message === "EMAIL_TAKEN") {
          setFieldErrors((prev) => ({ ...prev, email: "This email is already taken" }));
          setTouched((prev) => ({ ...prev, email: true }));
          return;
        }
        setFormError("Something went wrong");
      } else {
        if (apiError?.status === 401 || apiError?.message === "INVALID_CREDENTIALS") {
          setFormError("Invalid email or password");
        } else {
          setFormError("Something went wrong");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: "google" | "github") => {
    const url = apiUrl(`/auth/${provider}/login`);
    window.location.href = url;
  };

  useEffect(() => {
    if (mode === "signin") {
      setConfirmPassword("");
      setTouched((prev) => ({ ...prev, confirm: false }));
      setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
    }
  }, [mode]);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader
        badge={mode === "signup" ? "Create account" : "Welcome back"}
        title={mode === "signup" ? "Create your QuizStudy account" : "Sign in to QuizStudy"}
        description={
          mode === "signup"
            ? "Start tracking your progress and history."
            : "Access your history and continue where you left off."
        }
      />

      <Card variant="elevated" className="space-y-6">
        <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === "signin"
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === "signup"
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => handleOAuthLogin("google")}
          >
            <Chrome size={16} />
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => handleOAuthLogin("github")}
          >
            <Github size={16} />
            Continue with GitHub
          </Button>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  const next = e.target.value;
                  setEmail(next);
                  setFormError(null);
                  if (touched.email || submitted) {
                    const trimmed = next.trim();
                    let nextError: string | undefined;
                    if (!trimmed) {
                      nextError = "Email is required";
                    } else if (!emailRegex.test(trimmed)) {
                      nextError = "Enter a valid email address";
                    }
                    setFieldErrors((prev) => ({ ...prev, email: nextError }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, email: true }));
                  setFieldErrors((prev) => ({ ...prev, ...validate() }));
                }}
                placeholder="you@example.com"
                className={
                  "pl-9 " +
                  (touched.email && fieldErrors.email
                    ? "border-rose-400/60 ring-2 ring-rose-400/30"
                    : "")
                }
              />
            </div>
            {touched.email && fieldErrors.email ? (
              <p className="text-xs text-rose-300">{fieldErrors.email}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  const next = e.target.value;
                  setPassword(next);
                  setFormError(null);
                  if (touched.password) {
                    const passwordBytes = new TextEncoder().encode(next).length;
                    const hasLetter = /[A-Za-z]/.test(next);
                    const hasDigit = /[0-9]/.test(next);
                    let nextError: string | undefined;
                    if (!next) {
                      nextError = "Password is required";
                    } else if (next.length < 8) {
                      nextError = "Password must be at least 8 characters";
                    } else if (!hasLetter || !hasDigit) {
                      nextError = "Password must include at least 1 letter and 1 number";
                    } else if (passwordBytes > 72) {
                      nextError = "Password is too long (max 72 bytes)";
                    }
                    setFieldErrors((prev) => ({ ...prev, password: nextError }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, password: true }));
                  setFieldErrors((prev) => ({ ...prev, ...validate() }));
                }}
                placeholder="••••••••"
                className={
                  "pl-9 " +
                  (touched.password && fieldErrors.password
                    ? "border-rose-400/60 ring-2 ring-rose-400/30"
                    : "")
                }
              />
            </div>
            {mode === "signup" ? (
              <p className="text-xs text-slate-500">
                Password must be at least 8 characters and include at least 1 letter and 1 number.
              </p>
            ) : null}
            {touched.password && fieldErrors.password ? (
              <p className="text-xs text-rose-300">{fieldErrors.password}</p>
            ) : null}
          </div>

          {mode === "signup" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Confirm password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    const next = e.target.value;
                    setConfirmPassword(next);
                    setFormError(null);
                    if (touched.confirm || submitted) {
                      let nextError: string | undefined;
                      if (!next) {
                        nextError = "Confirm password is required";
                      } else if (next !== password) {
                        nextError = "Passwords do not match";
                      }
                      setFieldErrors((prev) => ({ ...prev, confirm: nextError }));
                    }
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, confirm: true }));
                    setFieldErrors((prev) => ({ ...prev, ...validate() }));
                  }}
                  placeholder="••••••••"
                  className={
                    "pl-9 " +
                    (touched.confirm && fieldErrors.confirm
                      ? "border-rose-400/60 ring-2 ring-rose-400/30"
                      : "")
                  }
                />
              </div>
              {(touched.confirm || submitted) && fieldErrors.confirm ? (
                <p className="text-xs text-rose-300">{fieldErrors.confirm}</p>
              ) : null}
            </div>
          ) : null}

          {formError ? <Alert>{formError}</Alert> : null}

          <Button type="submit" className="w-full" disabled={loading || !isFormValid}>
            {loading
              ? mode === "signup"
                ? "Creating account..."
                : "Signing in..."
              : mode === "signup"
                ? "Create Account"
                : "Sign In"}
          </Button>
        </form>

        <div className="text-center text-sm text-slate-400">
          {mode === "signup" ? "Already have an account?" : "Don't have an account?"}
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="ml-2 text-indigo-300 hover:text-indigo-200"
          >
            {mode === "signup" ? "Sign in" : "Sign up"}
          </button>
        </div>
      </Card>
    </div>
  );
}
