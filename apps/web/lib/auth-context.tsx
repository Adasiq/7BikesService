"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { AuthUser, LoginResponse } from "@7bs/shared";
import { apiFetch } from "./api";

const ACCESS_KEY = "7bs_access_token";
const REFRESH_KEY = "7bs_refresh_token";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // При загрузке: если есть токен — валидируем через /auth/me.
  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem(ACCESS_KEY)
        : null;
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<AuthUser>("/auth/me", { token })
      .then(setUser)
      .catch(() => {
        window.localStorage.removeItem(ACCESS_KEY);
        window.localStorage.removeItem(REFRESH_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    window.localStorage.setItem(ACCESS_KEY, res.accessToken);
    window.localStorage.setItem(REFRESH_KEY, res.refreshToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}
