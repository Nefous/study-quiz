import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ApiError, User } from "../api/types";
import {
  login as apiLogin,
  logout as apiLogout,
  me as apiMe,
  refresh as apiRefresh,
  register as apiRegister
} from "../api";
import { setAccessToken, setRefreshHandler } from "../api/client";

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  status: "loading" | "authed" | "guest";
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAccessToken(accessToken);
  }, [accessToken]);

  const refresh = useCallback(async () => {
    try {
      const response = await apiRefresh();
      setAccessTokenState(response.access_token);
      setAccessToken(response.access_token);
      setUser(response.user);
      return response.access_token;
    } catch {
      setAccessTokenState(null);
      setAccessToken(null);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    setRefreshHandler(() => refresh);
    return () => setRefreshHandler(null);
  }, [refresh]);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const current = await apiMe();
        if (active) {
          setUser(current);
        }
      } catch (err) {
        const apiError = err as ApiError;
        if (apiError?.status === 401) {
          const token = await refresh();
          if (token) {
            try {
              const current = await apiMe();
              if (active) {
                setUser(current);
              }
            } catch {
              if (active) {
                setUser(null);
              }
            }
          } else if (active) {
            setUser(null);
          }
        } else if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    bootstrap();
    return () => {
      active = false;
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiLogin({ email, password });
    setAccessTokenState(response.access_token);
    setAccessToken(response.access_token);
    const current = await apiMe();
    setUser(current);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const response = await apiRegister({ email, password });
    setAccessTokenState(response.access_token);
    setAccessToken(response.access_token);
    const current = await apiMe();
    setUser(current);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setAccessTokenState(null);
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      loading,
      status: loading ? "loading" : user ? "authed" : "guest",
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refresh
    }),
    [user, accessToken, loading, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
