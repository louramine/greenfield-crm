import { useState, useCallback, useEffect } from "react";

const SUPABASE_URL = "https://hjscwsybbcjpditudssq.supabase.co";
const KEY          = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqc2N3c3liYmNqcGRpdHVkc3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTQ5MjUsImV4cCI6MjA5MTgzMDkyNX0.OccaI1Fw16ldu_PMElJvLyz7b-2EWmmXHeEEyPxeC2w";

export interface AuthUser {
  id:            string;
  email:         string;
  access_token:  string;
  refresh_token: string;
}

function save(user: AuthUser) {
  try { localStorage.setItem("gf_session", JSON.stringify(user)); } catch {}
}

function load(): AuthUser | null {
  try {
    const s = localStorage.getItem("gf_session");
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function clear() {
  try { localStorage.removeItem("gf_session"); } catch {}
}

async function refreshToken(refresh_token: string): Promise<AuthUser | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "apikey": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return {
      id:            data.user.id,
      email:         data.user.email,
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
    };
  } catch { return null; }
}

export function useAuth() {
  const [user,    setUser]    = useState<AuthUser | null>(load);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Auto-refresh token toutes les 45 minutes
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const refreshed = await refreshToken(user.refresh_token);
      if (refreshed) {
        save(refreshed);
        setUser(refreshed);
      } else {
        // Token invalide — déconnecter
        clear();
        setUser(null);
      }
    }, 45 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "apikey": KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error_description ?? data.message ?? "Identifiants incorrects");
      const u: AuthUser = {
        id:            data.user.id,
        email:         data.user.email,
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
      };
      save(u);
      setUser(u);
    } catch (e: any) {
      setError(e.message ?? "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clear();
    setUser(null);
  }, []);

  return { user, loading, error, login, logout };
}