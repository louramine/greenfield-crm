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

async function patch(table: string, id: number, body: object, token?: string) {
  const r = await fetch(`${URL_BASE}/${table}?id=eq.${id}`, {
    method: "PATCH", headers: headers(token), body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`update ${table}: ${r.status} ${r.statusText}`)
}

// Tables WhatsApp : si la migration n'est pas encore passée, le CRM continue de fonctionner
async function getOptionnel(table: string, token?: string, extra = "") {
  try {
    return await get(table, token, extra)
  } catch {
    return []
  }
}

// Appel des fonctions serveur WhatsApp (/api/whatsapp/...)
export async function apiWhatsApp(route: string, body: object, token?: string) {
  const r = await fetch(`/api/whatsapp/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.erreur ?? `Erreur ${r.status}`)
  return data
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
  const [waMessages,  setWaMessages]  = useState<any[]>([])
  const [waReponses,  setWaReponses]  = useState<any[]>([])
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const token = user?.access_token;

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [t, a, d, logs, msgs, reps] = await Promise.all([
        get("terrains",    token),
        get("acheteurs",   token),
        get("deals",       token),
        get("activity_log", token, "&order=created_at.desc&limit=50"),
        getOptionnel("whatsapp_messages", token, "&limit=2000"),
        getOptionnel("acheteur_terrain_reponses", token),
      ]);
      setWaMessages(msgs)
      setWaReponses(reps)
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
  // Modification sur place : l'identifiant ne change pas, l'historique WhatsApp et les deals restent liés
  const updateAcheteur = async (id: number, a: object) => {
    await patch("acheteurs", id, a, token)
    await fetchAll()
  }

  // Rafraîchit uniquement les données WhatsApp (sans écran de chargement)
  const refreshWhatsApp = useCallback(async () => {
    if (!user) return
    const [msgs, reps, a] = await Promise.all([
      getOptionnel("whatsapp_messages", token, "&limit=2000"),
      getOptionnel("acheteur_terrain_reponses", token),
      getOptionnel("acheteurs", token),
    ])
    setWaMessages(msgs)
    setWaReponses(reps)
    if (a.length) setAcheteurs(a)
  }, [user, token])

  // ── Deals ──────────────────────────────────────────────────────────────────
  const addDeal = async (d: object) => {
    await post("deals", { ...d, user_id: user?.id }, token);
    await fetchAll();
  };
  const deleteDeal = async (id: number) => { await del("deals", id, token); await fetchAll(); };

  return {
    terrains, acheteurs, deals, activityLog,
    waMessages, waReponses, refreshWhatsApp, token,
    loading, error, fetchAll,
    logActivity,
    addTerrain,    deleteTerrain,
    addAcheteur,   deleteAcheteur, updateAcheteur,
    addDeal,       deleteDeal,
  };
}