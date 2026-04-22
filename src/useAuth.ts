import { useState, useEffect, useCallback } from "react";

const URL_BASE = "https://hjscwsybbcjpditudssq.supabase.co";
const KEY      = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqc2N3c3liYmNqcGRpdHVkc3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTQ5MjUsImV4cCI6MjA5MTgzMDkyNX0.OccaI1Fw16ldu_PMElJvLyz7b-2EWmmXHeEEyPxeC2w";

export interface AuthUser {
  id: string;
  email: string;
  access_token: string;
}

function saveSession(user: AuthUser) {
  try { sessionStorage.setItem("gf_session", JSON.stringify(user)); } catch {}
}

function loadSession(): AuthUser | null {
  try {
    const s = sessionStorage.getItem("gf_session");
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function clearSession() {
  try { sessionStorage.removeItem("gf_session"); } catch {}
}

export function useAuth() {
  const [user,    setUser]    = useState<AuthUser | null>(loadSession);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "apikey": KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error_description ?? data.message ?? "Identifiants incorrects");
      const u: AuthUser = {
        id:           data.user.id,
        email:        data.user.email,
        access_token: data.access_token,
      };
      saveSession(u);
      setUser(u);
    } catch (e: any) {
      setError(e.message ?? "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return { user, loading, error, login, logout };
}
