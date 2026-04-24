import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "./useAuth";

const URL_BASE = "https://hjscwsybbcjpditudssq.supabase.co/rest/v1";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqc2N3c3liYmNqcGRpdHVkc3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTQ5MjUsImV4cCI6MjA5MTgzMDkyNX0.OccaI1Fw16ldu_PMElJvLyz7b-2EWmmXHeEEyPxeC2w";

function headers(token?: string) {
  return {
    "apikey":        ANON_KEY,
    "Authorization": `Bearer ${token ?? ANON_KEY}`,
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
  };
}

async function get(table: string, token?: string, extra = "") {
  const r = await fetch(`${URL_BASE}/${table}?order=id${extra}`, { headers: headers(token) });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${r.statusText}`);
  return r.json();
}

async function post(table: string, body: object, token?: string) {
  const r = await fetch(`${URL_BASE}/${table}`, {
    method: "POST", headers: headers(token), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`insert ${table}: ${r.status} ${r.statusText}`);
}

async function del(table: string, id: number, token?: string) {
  const r = await fetch(`${URL_BASE}/${table}?id=eq.${id}`, {
    method: "DELETE", headers: headers(token),
  });
  if (!r.ok) throw new Error(`delete ${table}: ${r.status} ${r.statusText}`);
}

export function useSupabase(user: AuthUser | null) {
  const [terrains,    setTerrains]    = useState<any[]>([]);
  const [acheteurs,   setAcheteurs]   = useState<any[]>([]);
  const [deals,       setDeals]       = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const token = user?.access_token;

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [t, a, d, logs] = await Promise.all([
        get("terrains",    token),
        get("acheteurs",   token),
        get("deals",       token),
        get("activity_log", token, "&order=created_at.desc&limit=50"),
      ]);
      setTerrains(t);
      setAcheteurs(a);
      setDeals(d);
      setActivityLog(logs);
    } catch (e: any) {
      setError(e.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [user, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Activity log ───────────────────────────────────────────────────────────
  const logActivity = async (
    action: string,
    entity_type: string,
    entity_label: string,
    entity_id?: number,
    details?: string,
  ) => {
    if (!user) return;
    const associe = user.email.split("@")[0];
    try {
      await post("activity_log", {
        associe,
        action,
        entity_type,
        entity_label,
        entity_id:   entity_id ?? null,
        details:     details ?? "",
        user_id:     user.id,
        created_at:  new Date().toISOString(),
      }, token);
    } catch (e) {
      console.error("logActivity error:", e);
    }
  };

  // ── Terrains ───────────────────────────────────────────────────────────────
  const addTerrain    = async (t: object)  => { await post("terrains",  t,  token); await fetchAll(); };
  const deleteTerrain = async (id: number) => { await del("terrains",   id, token); await fetchAll(); };

  // ── Acheteurs ──────────────────────────────────────────────────────────────
  const addAcheteur    = async (a: object)  => { await post("acheteurs", a,  token); await fetchAll(); };
  const deleteAcheteur = async (id: number) => { await del("acheteurs",  id, token); await fetchAll(); };

  // ── Deals ──────────────────────────────────────────────────────────────────
  const addDeal = async (d: object) => {
    await post("deals", { ...d, user_id: user?.id }, token);
    await fetchAll();
  };
  const deleteDeal = async (id: number) => { await del("deals", id, token); await fetchAll(); };

  return {
    terrains, acheteurs, deals, activityLog,
    loading, error, fetchAll,
    logActivity,
    addTerrain,    deleteTerrain,
    addAcheteur,   deleteAcheteur,
    addDeal,       deleteDeal,
  };
}