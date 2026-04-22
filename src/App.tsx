import { useState, useEffect } from "react";
import Sidebar, { SIDEBAR_FULL, SIDEBAR_COLLAPSED } from "./Sidebar";
import Dashboard from "./Dashboard";
import PipelinePage from "./PipelinePage";
import TerrainsPage from "./TerrainsPage";
import AcheteursPage from "./AcheteursPage";
import AuthPage from "./AuthPage";
import { useAuth } from "./useAuth";
import { useSupabase } from "./useSupabase";

// ─── Carte ────────────────────────────────────────────────────────────────────

function CartePage() {
  const EMBED_URL  = "https://www.google.com/maps/d/embed?mid=1eKT0j_tY2XUBYBJu-r5d7BjKGpdXWCY&ehbc=2E312F";
  const VIEWER_URL = "https://www.google.com/maps/d/viewer?mid=1eKT0j_tY2XUBYBJu-r5d7BjKGpdXWCY";
  return (
    <>
      <div style={{ padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(45,158,95,0.12)", background: "rgba(7,26,15,0.6)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 700, color: "#f8faf9" }}>Carte Interactive</div>
          <div style={{ fontSize: 13, color: "#8aab97", marginTop: 2 }}>Vue géographique de tous les terrains sourcés</div>
        </div>
        <a href={VIEWER_URL} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", background: "rgba(45,158,95,0.15)", border: "1.5px solid rgba(45,158,95,0.35)", borderRadius: 10, color: "#4eca82", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
          ↗ Ouvrir dans Google Maps
        </a>
      </div>
      <div style={{ padding: "20px 32px" }}>
        <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(10,46,26,0.25)", border: "1px solid rgba(45,158,95,0.15)" }}>
          <iframe src={EMBED_URL} style={{ width: "100%", height: "calc(100vh - 200px)", minHeight: 520, display: "block", border: "none" }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </div>
    </>
  );
}

// ─── Loading / Error ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 32, color: "#4eca82" }}>◈</div>
      <div style={{ fontFamily: "Syne, sans-serif", fontSize: 16, color: "#8aab97" }}>Chargement des données…</div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16, padding: "0 40px" }}>
      <div style={{ fontSize: 32 }}>✕</div>
      <div style={{ fontFamily: "Syne, sans-serif", fontSize: 18, color: "#e74c3c" }}>Erreur Supabase</div>
      <div style={{ fontSize: 13, color: "#aaa", maxWidth: 500, textAlign: "center", background: "rgba(255,255,255,0.05)", padding: "16px 20px", borderRadius: 10, fontFamily: "monospace", wordBreak: "break-all" }}>{message}</div>
      <button onClick={onRetry} style={{ padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer", background: "#2d9e5f", color: "#fff", fontSize: 13 }}>Réessayer</button>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

type Page = "dashboard" | "pipeline" | "terrains" | "acheteurs" | "carte";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [collapsed,   setCollapsed]   = useState(window.innerWidth < 1200);

  const { user, loading: authLoading, error: authError, login, logout } = useAuth();

  useEffect(() => {
    const fn = () => setCollapsed(window.innerWidth < 1200);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const sidebarW = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL;

  const { terrains, acheteurs, deals, loading, error, fetchAll, addTerrain, deleteTerrain, addAcheteur, deleteAcheteur, addDeal, deleteDeal } = useSupabase(user);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <>
        <style>{`*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } html, body, #root { height: 100%; width: 100%; }`}</style>
        <AuthPage onLogin={login} loading={authLoading} error={authError} />
      </>
    );
  }

  if (loading) return <LoadingScreen />;
  if (error)   return <ErrorScreen message={error} onRetry={fetchAll} />;

  // ── State adapter ──────────────────────────────────────────────────────────
  const stateForPages = {
    terrains:  terrains.map(t => ({ id: t.id, localisation: t.localisation ?? "", urba: t.urba ?? "", superficie: t.superficie ?? 0, prix: t.prix ?? 0, usage: "", statut: "Disponible", tf: t.tf ?? "", notes: "" })),
    acheteurs: acheteurs.map(a => ({ id: a.id, nom: a.nom ?? "", contact: a.contact ?? "", type: a.type ?? "", statut: "Froid", zones: a.zones ?? "", ticketMin: String(a.ticket_min ?? ""), ticketMax: String(a.ticket_max ?? ""), usage: a.usage ?? "", notes: "" })),
    deals:     deals.map(d => ({ id: d.id, terrainId: d.terrain_id ?? 0, acheteurId: d.acheteur_id ?? 0, etape: d.etape ?? "teaser", montant: 0, notes: "", date: "" })),
    activities: [],
  };

  const dispatch = async (action: any) => {
    try {
      switch (action.type) {
        case "ADD_TERRAIN":
          await addTerrain({ localisation: action.payload.localisation, urba: action.payload.urba, quartier: action.payload.localisation, superficie: action.payload.superficie, prix: action.payload.prix, forfait: Math.round(action.payload.superficie * action.payload.prix / 1_000_000), tf: action.payload.tf });
          break;
        case "DELETE_TERRAIN":  await deleteTerrain(action.payload); break;
        case "UPDATE_TERRAIN":
          await deleteTerrain(action.payload.id);
          await addTerrain({ localisation: action.payload.localisation, urba: action.payload.urba, quartier: action.payload.localisation, superficie: action.payload.superficie, prix: action.payload.prix, forfait: Math.round(action.payload.superficie * action.payload.prix / 1_000_000), tf: action.payload.tf });
          break;
        case "ADD_ACHETEUR":
          await addAcheteur({ nom: action.payload.nom, contact: action.payload.contact, type: action.payload.type, zones: action.payload.zones, ticket_min: parseFloat(action.payload.ticketMin) || null, ticket_max: parseFloat(action.payload.ticketMax) || null, usage: action.payload.usage });
          break;
        case "DELETE_ACHETEUR": await deleteAcheteur(action.payload); break;
        case "ADD_DEAL": {
          const t = terrains.find(t => t.id === action.payload.terrainId);
          const a = acheteurs.find(a => a.id === action.payload.acheteurId);
          await addDeal({ terrain_id: action.payload.terrainId, acheteur_id: action.payload.acheteurId, terrain_label: t?.localisation ?? "", acheteur_label: a?.nom ?? "", etape: action.payload.etape });
          break;
        }
        case "DELETE_DEAL": await deleteDeal(action.payload); break;
        case "UPDATE_DEAL": {
          const t = terrains.find(t => t.id === action.payload.terrainId);
          const a = acheteurs.find(a => a.id === action.payload.acheteurId);
          await deleteDeal(action.payload.id);
          await addDeal({ terrain_id: action.payload.terrainId, acheteur_id: action.payload.acheteurId, terrain_label: t?.localisation ?? "", acheteur_label: a?.nom ?? "", etape: action.payload.etape });
          break;
        }
      }
    } catch (err: any) { alert("Erreur : " + (err.message ?? "inconnue")); }
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; width: 100%; overflow: hidden; }
        body { background: #0a2e1a; font-family: 'DM Sans', sans-serif; color: #f8faf9; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(45,158,95,0.3); border-radius: 3px; }
      `}</style>

      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <main style={{
        marginLeft: sidebarW,
        width: `calc(100% - ${sidebarW}px)`,
        height: "100vh",
        overflowY: "auto", overflowX: "hidden",
        transition: "margin-left 0.25s cubic-bezier(0.4,0,0.2,1), width 0.25s cubic-bezier(0.4,0,0.2,1)",
        position: "relative",
        background: "#0a2e1a",
      }}>

        {/* User bar */}
        <div style={{ position: "absolute", top: 12, right: 20, zIndex: 60, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#8aab97" }}>{user.email}</span>
          <button
            onClick={logout}
            style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(45,158,95,0.25)", background: "rgba(45,158,95,0.08)", color: "#8aab97", fontSize: 11, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}
          >
            Déconnexion
          </button>
        </div>

        {currentPage === "dashboard" && <Dashboard />}
        {currentPage === "pipeline"  && <PipelinePage  state={stateForPages} dispatch={dispatch} />}
        {currentPage === "terrains"  && <TerrainsPage  state={stateForPages} dispatch={dispatch} />}
        {currentPage === "acheteurs" && <AcheteursPage state={stateForPages} dispatch={dispatch} />}
        {currentPage === "carte"     && <CartePage />}
      </main>
    </>
  );
}