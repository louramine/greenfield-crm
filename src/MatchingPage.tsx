import { useState, useMemo } from "react";

interface Terrain {
  id: number;
  localisation: string;
  urba: string;
  superficie: number;
  prix: number;
  tf: string;
  usage: string;
  statut: string;
  notes: string;
}

interface Acheteur {
  id: number;
  nom: string;
  contact: string;
  type: string;
  zones: string;
  ticketMin: string;
  ticketMax: string;
  usage: string;
  urbas_cibles?: string[];
}

interface Match {
  terrain: Terrain;
  acheteur: Acheteur;
  score: number;
  forfait: number;
  reasons: string[];
}

const T = {
  greenDeep:   "#0a2e1a",
  greenMid:    "#1a5c35",
  greenBright: "#2d9e5f",
  greenLight:  "#4eca82",
  white:       "#f8faf9",
  grayMid:     "#8aab97",
  dark:        "#071a0f",
};

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  Promoteur:    { bg: "#e8f4fd", color: "#2980b9" },
  Fonds:        { bg: "#fef9e7", color: "#c9a84c" },
  HNWI:         { bg: "#fdf2f8", color: "#8e44ad" },
  Entreprise:   { bg: "#e8f5e9", color: "#2e7d32" },
  Investisseur: { bg: "#fef0f0", color: "#c0392b" },
};

// ─── Score matching ───────────────────────────────────────────────────────────

function computeMatches(terrains: Terrain[], acheteurs: Acheteur[]): Match[] {
  const matches: Match[] = [];

  for (const terrain of terrains) {
    const forfait = terrain.superficie && terrain.prix
      ? Math.round(terrain.superficie * terrain.prix / 1_000_000)
      : 0;

    for (const acheteur of acheteurs) {
      let score = 0;
      const reasons: string[] = [];

      const tMin = parseFloat(acheteur.ticketMin) || 0;
      const tMax = parseFloat(acheteur.ticketMax) || Infinity;

      // Critère 1 — Budget (40 pts)
      if (forfait > 0 && forfait >= tMin && forfait <= tMax) {
        score += 40;
        reasons.push(`Forfait ${forfait} M dans budget (${tMin}–${tMax} M)`);
      } else if (forfait > 0 && tMax < Infinity) {
        // Budget proche — pénalité partielle
        const ratio = forfait < tMin ? forfait / tMin : tMax / forfait;
        if (ratio >= 0.7) {
          score += Math.round(20 * ratio);
          reasons.push(`Forfait ${forfait} M proche du budget`);
        }
      }

      // Critère 2 — Urba (35 pts)
      const urbas = acheteur.urbas_cibles ?? [];
      if (urbas.length > 0 && terrain.urba) {
        if (urbas.includes(terrain.urba)) {
          score += 35;
          reasons.push(`Urba ${terrain.urba} correspond`);
        }
      } else if (urbas.length === 0) {
        // Pas de préférence urba → bonus neutre
        score += 10;
      }

      // Critère 3 — Zone géographique (25 pts)
      if (acheteur.zones && terrain.localisation) {
        const zones = acheteur.zones.toLowerCase().split(/[,;]+/).map(z => z.trim());
        const loc   = terrain.localisation.toLowerCase();
        const match = zones.some(z => z && loc.includes(z));
        if (match) {
          score += 25;
          reasons.push(`Zone ${terrain.localisation} dans les zones cibles`);
        }
      }

      if (score >= 30) {
        matches.push({ terrain, acheteur, score, forfait, reasons });
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

// ─── Score badge ─────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#2ecc71" : score >= 50 ? "#f39c12" : "#95a5a6";
  return (
    <div style={{
      width: 44, height: 44, borderRadius: "50%",
      border: `3px solid ${color}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <span style={{ fontFamily: "Syne, sans-serif", fontSize: 13, fontWeight: 800, color }}>{score}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchingPage({ state, dispatch }: { state: any; dispatch: (a: any) => void }) {
  const [filterAcheteur, setFilterAcheteur] = useState("");
  const [filterTerrain,  setFilterTerrain]  = useState("");
  const [minScore,       setMinScore]       = useState(30);
  const [expanded,       setExpanded]       = useState<string | null>(null);

  const { terrains, acheteurs } = state;

  const allMatches = useMemo(
    () => computeMatches(terrains, acheteurs),
    [terrains, acheteurs]
  );

  const filtered = useMemo(() => {
    return allMatches.filter(m => {
      if (m.score < minScore) return false;
      if (filterAcheteur && !m.acheteur.nom.toLowerCase().includes(filterAcheteur.toLowerCase())) return false;
      if (filterTerrain  && !m.terrain.localisation.toLowerCase().includes(filterTerrain.toLowerCase())) return false;
      return true;
    });
  }, [allMatches, filterAcheteur, filterTerrain, minScore]);

  const topMatches  = filtered.filter(m => m.score >= 80);
  const goodMatches = filtered.filter(m => m.score >= 50 && m.score < 80);
  const lowMatches  = filtered.filter(m => m.score < 50);

  const handleCreateDeal = (match: Match) => {
    dispatch({
      type: "ADD_DEAL",
      payload: {
        terrainId:  match.terrain.id,
        acheteurId: match.acheteur.id,
        etape:      "teaser",
        montant:    match.forfait,
        sourceurs:  [],
        notes:      `Match auto — score ${match.score}/100`,
        date_contact: "", prochaine_action: "", date_action: "",
      },
    });
    alert(`Deal créé : ${match.terrain.localisation} × ${match.acheteur.nom}`);
  };

  return (
    <>
      {/* Topbar */}
      <div style={{ padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(45,158,95,0.12)", background: "rgba(7,26,15,0.6)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div>
          <span style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, color: T.white }}>Matching Terrains × Acheteurs</span>
          <span style={{ marginLeft: 10, fontSize: 12, color: T.grayMid }}>{filtered.length} correspondance{filtered.length > 1 ? "s" : ""}</span>
        </div>
      </div>

      <div style={{ padding: "16px 28px" }}>

        {/* Filtres */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <input value={filterTerrain} onChange={e => setFilterTerrain(e.target.value)} placeholder="Filtrer par terrain..."
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(45,158,95,0.25)", background: "rgba(255,255,255,0.06)", color: T.white, fontSize: 12, outline: "none", width: 180 }} />
          <input value={filterAcheteur} onChange={e => setFilterAcheteur(e.target.value)} placeholder="Filtrer par acheteur..."
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(45,158,95,0.25)", background: "rgba(255,255,255,0.06)", color: T.white, fontSize: 12, outline: "none", width: 180 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: T.grayMid }}>Score min :</span>
            {[30, 50, 70, 80].map(s => (
              <button key={s} onClick={() => setMinScore(s)}
                style={{ padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: minScore === s ? 700 : 400, background: minScore === s ? "#2d9e5f" : "rgba(255,255,255,0.08)", color: minScore === s ? "#fff" : T.grayMid }}>
                {s}+
              </button>
            ))}
          </div>
        </div>

        {/* Stats rapides */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Excellent (80+)", count: topMatches.length, color: "#2ecc71" },
            { label: "Bon (50–79)", count: goodMatches.length, color: "#f39c12" },
            { label: "Possible (30–49)", count: lowMatches.length, color: "#95a5a6" },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.97)", borderRadius: 12, padding: "16px 20px", boxShadow: "0 2px 12px rgba(10,46,26,0.08)", borderTop: `3px solid ${color}` }}>
              <div style={{ fontFamily: "Syne, sans-serif", fontSize: 26, fontWeight: 800, color }}>{count}</div>
              <div style={{ fontSize: 11, color: T.grayMid, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Liste des matches */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: T.grayMid, fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
            Aucun matching — ajoutez des urbas cibles et des budgets aux acheteurs.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((m, i) => {
              const key  = `${m.terrain.id}-${m.acheteur.id}`;
              const tc   = TYPE_COLORS[m.acheteur.type] ?? { bg: "#f5f5f5", color: "#666" };
              const isEx = expanded === key;

              return (
                <div key={key} style={{ background: "rgba(255,255,255,0.97)", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(10,46,26,0.08)" }}>
                  {/* Main row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", cursor: "pointer" }}
                    onClick={() => setExpanded(isEx ? null : key)}>
                    <ScoreBadge score={m.score} />

                    {/* Terrain */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: T.dark }}>{m.terrain.localisation}</div>
                      <div style={{ fontSize: 10, color: "#888" }}>
                        {m.terrain.tf && `TF ${m.terrain.tf} · `}
                        <span style={{ padding: "1px 6px", borderRadius: 4, background: "#e3f2fd", color: "#1565c0", fontWeight: 600, fontSize: 10 }}>{m.terrain.urba}</span>
                        {m.forfait > 0 && ` · ${m.forfait} M MAD`}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div style={{ fontSize: 18, color: "#2d9e5f", fontWeight: 700, flexShrink: 0 }}>→</div>

                    {/* Acheteur */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: T.dark }}>{m.acheteur.nom}</div>
                      <div style={{ fontSize: 10, color: "#888", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: tc.bg, color: tc.color }}>{m.acheteur.type}</span>
                        {(m.acheteur.ticketMin || m.acheteur.ticketMax) && (
                          <span>Budget {m.acheteur.ticketMin || "?"} – {m.acheteur.ticketMax || "?"} M</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={e => { e.stopPropagation(); handleCreateDeal(m); }}
                        style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #2d9e5f, #4eca82)", color: "#071a0f", fontSize: 11, fontWeight: 600 }}>
                        Créer Deal
                      </button>
                      <button onClick={() => setExpanded(isEx ? null : key)}
                        style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #e0e0e0", background: "transparent", cursor: "pointer", color: "#888", fontSize: 11 }}>
                        {isEx ? "▲" : "▼"}
                      </button>
                    </div>
                  </div>

                  {/* Détail expandable */}
                  {isEx && (
                    <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #f0f4f2", background: "#f9fcfa" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.greenMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                        Raisons du matching
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {m.reasons.map((r, ri) => (
                          <div key={ri} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#333" }}>
                            <span style={{ color: "#2ecc71", fontSize: 14 }}>✓</span>
                            {r}
                          </div>
                        ))}
                      </div>
                      {m.acheteur.zones && (
                        <div style={{ marginTop: 10, fontSize: 11, color: "#666" }}>
                          Zones acheteur : {m.acheteur.zones}
                        </div>
                      )}
                      {(m.acheteur.urbas_cibles ?? []).length > 0 && (
                        <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: "#666", marginRight: 4 }}>Urbas cibles :</span>
                          {(m.acheteur.urbas_cibles ?? []).map(u => (
                            <span key={u} style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, background: "#e3f2fd", color: "#1565c0", fontWeight: 600 }}>{u}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}