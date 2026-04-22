import { useState, useEffect } from "react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  greenDeep:   "#0a2e1a",
  greenMid:    "#1a5c35",
  greenBright: "#2d9e5f",
  greenLight:  "#4eca82",
  greenPale:   "#e8f7ef",
  gold:        "#c9a84c",
  goldLight:   "#f0d080",
  white:       "#f8faf9",
  grayLight:   "#e2ece7",
  grayMid:     "#8aab97",
  dark:        "#071a0f",
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_STATE = {
  terrains: Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    localisation: ["Casablanca", "Marrakech", "Rabat", "Agadir", "Tanger"][i % 5],
    def_urba: ["B5", "I2S1", "E3", "B4", "Mix Used"][i % 5],
    superficie: Math.round(1000 + Math.random() * 50000),
    prix_m2: Math.round(500 + Math.random() * 30000),
    statut: ["Disponible", "En négociation", "Vendu"][i % 3],
    daysOld: Math.round(Math.random() * 14),
  })),
  deals: Array.from({ length: 7 }, (_, i) => ({
    id: i + 1,
    terrain: ["Casablanca Centre", "Guéliz Sud", "Rabat Hassan", "Tanger Bay"][i % 4],
    acheteur: ["Redal Group", "Atlas Invest", "MedBuild", "Kénitra Dev"][i % 4],
    montant: Math.round(5 + Math.random() * 200) + "M",
    etape: ["teaser", "nda", "visite", "offre", "closing"][i % 5],
  })),
  activityLog: [
    { id: 1, associe: "Ayoub",      action: "Deal créé",        entity_label: "Casablanca Centre", created_at: new Date(Date.now() - 1e6).toISOString() },
    { id: 2, associe: "Hachim",     action: "Terrain ajouté",   entity_label: "Guéliz Sud",        created_at: new Date(Date.now() - 3e6).toISOString() },
    { id: 3, associe: "Amine",      action: "Acheteur modifié", entity_label: "Redal Group",       created_at: new Date(Date.now() - 8e6).toISOString() },
    { id: 4, associe: "Ayoub",      action: "Offre reçue",      entity_label: "Tanger Bay",        created_at: new Date(Date.now() - 2e7).toISOString() },
    { id: 5, associe: "Abderrahim", action: "NDA signé",        entity_label: "Rabat Hassan",      created_at: new Date(Date.now() - 5e7).toISOString() },
    { id: 6, associe: "Hachim",     action: "Score modifié",    entity_label: "Atlas Invest",      created_at: new Date(Date.now() - 9e7).toISOString() },
  ],
  interactions: Array.from({ length: 11 }, (_, i) => ({
    id: i + 1,
    type: ["Appel", "Email", "RDV", "WhatsApp"][i % 4],
    acheteur_nom: ["Redal Group", "Atlas Invest", "MedBuild"][i % 3],
    associe: ["Ayoub", "Hachim", "Amine"][i % 3],
    date: new Date(Date.now() - i * 2e6).toISOString(),
    created_at: new Date(Date.now() - i * 2e6).toISOString(),
  })),
};

const ASSOCIE_COLORS = {
  Hachim:     "#c084fc",
  Abderrahim: "#f97316",
  Ayoub:      "#4eca82",
  Amine:      "#60a5fa",
  Said:       "#f43f5e",
};

const TYPE_COLORS = {
  Appel:    { bg: "#e8f5e9", color: "#2e7d32" },
  Email:    { bg: "#e3f2fd", color: "#1565c0" },
  RDV:      { bg: "#fdf2f8", color: "#8e44ad" },
  WhatsApp: { bg: "#e0f7ec", color: "#1a5c35" },
};

function associeColor(nom) { return ASSOCIE_COLORS[nom] || T.grayMid; }
function fmtDate(iso) { return new Date(iso).toLocaleDateString("fr-FR"); }
function fmtRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1)  return "< 1h";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, highlight, animate }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), animate || 0); return () => clearTimeout(t); }, [animate]);
  return (
    <div style={{
      background: "rgba(255,255,255,0.97)", borderRadius: 16, padding: "22px 20px",
      color: T.dark, boxShadow: "0 4px 24px rgba(10,46,26,0.10)",
      position: "relative", overflow: "hidden",
      transition: "transform 0.2s, box-shadow 0.2s, opacity 0.5s",
      transform: vis ? "translateY(0)" : "translateY(14px)", opacity: vis ? 1 : 0,
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 48px rgba(10,46,26,0.16)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(10,46,26,0.10)"; }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${T.gold},${T.goldLight})` }} />
      <div style={{ position: "absolute", right: 16, top: 16, fontSize: 22, opacity: 0.14 }}>{icon}</div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: T.grayMid, fontWeight: 500, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, lineHeight: 1, color: T.gold }}>{value}</div>
      <div style={{ fontSize: 11.5, color: T.grayMid, marginTop: 6 }} dangerouslySetInnerHTML={{ __html: sub }} />
    </div>
  );
}

// ─── Interactions de la semaine ───────────────────────────────────────────────

function InteractionsSemaine({ interactions }) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const items = interactions.filter(i => new Date(i.created_at) >= weekAgo);

  return (
    <div style={{ background: "rgba(255,255,255,0.97)", borderRadius: 16, boxShadow: "0 4px 24px rgba(10,46,26,0.10)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #f0f4f2", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: T.greenDeep, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Interactions
          </div>
          <div style={{ fontSize: 11.5, color: T.grayMid, marginTop: 2 }}>Cette semaine · {items.length} contact{items.length > 1 ? "s" : ""}</div>
        </div>
        <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: T.greenBright }}>{items.length}</span>
      </div>

      {/* List */}
      <div style={{ padding: "8px 0" }}>
        {!items.length ? (
          <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "24px 0" }}>Aucune interaction cette semaine</div>
        ) : items.slice(0, 8).map((item, i) => {
          const typeStyle = TYPE_COLORS[item.type] ?? { bg: "#f5f5f5", color: "#666" };
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 22px",
              borderBottom: i < items.length - 1 ? "1px solid #f7faf8" : "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#f7fbf8"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {/* Avatar associé */}
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: associeColor(item.associe),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0,
              }}>
                {(item.associe || "?").slice(0, 2).toUpperCase()}
              </div>

              {/* Infos */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.dark }}>{item.acheteur_nom}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: typeStyle.bg, color: typeStyle.color }}>
                    {item.type}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: T.grayMid }}>{item.associe}</div>
              </div>

              {/* Temps */}
              <div style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>{fmtRelative(item.created_at)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Journal d'activité ───────────────────────────────────────────────────────

function ActivityLog({ logs }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.97)", borderRadius: 16, boxShadow: "0 4px 24px rgba(10,46,26,0.10)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #f0f4f2", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: T.greenDeep, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Journal d'activité
          </div>
          <div style={{ fontSize: 11.5, color: T.grayMid, marginTop: 2 }}>Dernières actions — Équipe</div>
        </div>
        <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: T.greenMid }}>{logs.length}</span>
      </div>

      {/* List */}
      <div style={{ padding: "8px 0" }}>
        {!logs.length ? (
          <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "24px 0" }}>Aucune activité enregistrée</div>
        ) : logs.map((l, i) => (
          <div key={l.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 22px",
            borderBottom: i < logs.length - 1 ? "1px solid #f7faf8" : "none",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#f7fbf8"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: associeColor(l.associe),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0,
            }}>
              {(l.associe || "?").slice(0, 2).toUpperCase()}
            </div>

            {/* Infos */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.dark, marginBottom: 2 }}>{l.action}</div>
              <div style={{ fontSize: 11.5, color: T.grayMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {l.entity_label} · <span style={{ color: associeColor(l.associe), fontWeight: 600 }}>{l.associe}</span>
              </div>
            </div>

            {/* Temps */}
            <div style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>{fmtRelative(l.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Background ───────────────────────────────────────────────────────────────
const BG_STYLE = {
  position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
  background: `
    radial-gradient(ellipse 80% 60% at 10% 0%, rgba(45,158,95,0.18) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 90% 100%, rgba(78,202,130,0.10) 0%, transparent 55%),
    repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(45,158,95,0.04) 40px),
    repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(45,158,95,0.04) 40px)
  `,
};

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [state] = useState(MOCK_STATE);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${T.greenDeep}; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ fontFamily: "'DM Sans',sans-serif", color: T.white, position: "relative", animation: "fadeIn 0.4s ease" }}>
        <div style={BG_STYLE} />

        <div style={{ position: "relative", zIndex: 1, padding: "28px 32px" }}>

          {/* Header */}
          <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800 }}>Dashboard</div>
              <div style={{ fontSize: 12.5, color: T.grayMid, marginTop: 3 }}>Vue d'ensemble — GREENFIELD CRM Foncier</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={ghostBtn}>⟳ Sync</button>
              <button style={ghostBtn}>↓ Export</button>
            </div>
          </div>

          {/* KPI Row : Top Def. Urba. */}
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: T.grayMid, fontWeight: 600, marginBottom: 10 }}>
            Top 4 — Déf. Urbanistiques
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
            <KpiCard animate={0}   icon="🥇" label={<>B5 <span style={{ fontSize: 10, color: T.grayMid, fontWeight: 400 }}>— Résidentiel standing</span></>}    value="58" sub="terrains · moy. <strong>26 134 MAD/m²</strong>" />
            <KpiCard animate={80}  icon="🥈" label={<>I2S1 <span style={{ fontSize: 10, color: T.grayMid, fontWeight: 400 }}>— Industriel logistique</span></>}  value="26" sub="terrains · moy. <strong>1 824 MAD/m²</strong>" />
            <KpiCard animate={160} icon="🥉" label={<>E3 <span style={{ fontSize: 10, color: T.grayMid, fontWeight: 400 }}>— Équipement 3</span></>}            value="26" sub="terrains · moy. <strong>1 853 MAD/m²</strong>" />
            <KpiCard animate={240} icon="④"  label={<>B4 <span style={{ fontSize: 10, color: T.grayMid, fontWeight: 400 }}>— Résidentiel collectif</span></>}   value="25" sub="terrains · moy. <strong>10 887 MAD/m²</strong>" />
          </div>

          {/* Interactions + Journal */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <InteractionsSemaine interactions={state.interactions} />
            <ActivityLog logs={state.activityLog} />
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ghostBtn = {
  padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
  cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
  background: "rgba(45,158,95,0.12)", color: T.greenLight,
  border: "1px solid rgba(45,158,95,0.25)", transition: "background 0.2s",
};