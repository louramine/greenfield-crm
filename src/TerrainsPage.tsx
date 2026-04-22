import { useState, useMemo } from "react";

interface Terrain {
  id: number;
  localisation: string;
  urba: string;
  superficie: number;
  prix: number;
  usage: string;
  statut: string;
  tf: string;
  notes: string;
}

interface Props {
  state: { terrains: Terrain[] };
  dispatch: (action: any) => void;
}

const T = {
  greenDeep:   "#0a2e1a",
  greenMid:    "#1a5c35",
  greenBright: "#2d9e5f",
  greenLight:  "#4eca82",
  white:       "#f8faf9",
  grayMid:     "#8aab97",
  dark:        "#071a0f",
  cardBg:      "rgba(255,255,255,0.97)",
};

const BADGE: Record<string, { bg: string; color: string }> = {
  "Disponible":     { bg: "#e0f7ec", color: "#1a5c35" },
  "En négociation": { bg: "#fff3e0", color: "#e65100" },
  "Vendu":          { bg: "#f5f5f5", color: "#666"    },
  "Tertiaire":      { bg: "#fef9e7", color: "#c9a84c" },
  "Résidentiel":    { bg: "#fef9e7", color: "#c9a84c" },
  "Mixte":          { bg: "#fef9e7", color: "#c9a84c" },
  "Hôtellerie":     { bg: "#fef9e7", color: "#c9a84c" },
  "Industriel":     { bg: "#fef9e7", color: "#c9a84c" },
  "Balnéaire":      { bg: "#fef9e7", color: "#c9a84c" },
  "Logistique":     { bg: "#fef9e7", color: "#c9a84c" },
};

function Badge({ text, urba }: { text: string; urba?: boolean }) {
  const s = urba ? { bg: "#e3f2fd", color: "#1565c0" } : BADGE[text] ?? { bg: "#f5f5f5", color: "#666" };
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
      {text || "—"}
    </span>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 8,
  border: "1px solid rgba(45,158,95,0.25)",
  background: "rgba(255,255,255,0.06)", color: T.white,
  fontSize: 13, boxSizing: "border-box", outline: "none",
  marginBottom: 14, fontFamily: "DM Sans, sans-serif",
};
const labelStyle: React.CSSProperties = {
  fontSize: 12, color: T.grayMid, marginBottom: 4, display: "block", letterSpacing: "0.05em",
};
const btnPrimary: React.CSSProperties = {
  padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer",
  background: `linear-gradient(135deg, ${T.greenBright}, ${T.greenLight})`,
  color: T.dark, fontWeight: 600, fontSize: 13, fontFamily: "DM Sans, sans-serif",
};
const btnGhost: React.CSSProperties = {
  padding: "9px 20px", borderRadius: 8, cursor: "pointer",
  background: "rgba(45,158,95,0.12)", color: T.greenLight,
  border: "1px solid rgba(45,158,95,0.25)", fontSize: 13,
  fontFamily: "DM Sans, sans-serif",
};
const btnDanger: React.CSSProperties = {
  padding: "9px 20px", borderRadius: 8, cursor: "pointer",
  background: "rgba(231,76,60,0.1)", color: "#e74c3c",
  border: "1px solid rgba(231,76,60,0.3)", fontSize: 13,
  fontFamily: "DM Sans, sans-serif",
};
const btnEdit: React.CSSProperties = {
  padding: "3px 12px", borderRadius: 6, cursor: "pointer",
  background: "rgba(45,158,95,0.1)", color: T.greenMid,
  border: "1px solid rgba(45,158,95,0.25)", fontSize: 11,
  fontFamily: "DM Sans, sans-serif",
};

const PAGE_SIZE = 20;

// ─── Modal (Nouveau + Modifier) ───────────────────────────────────────────────

interface FormState {
  localisation: string; urba: string;
  superficie: string; prix: string;
  usage: string; statut: string; tf: string; notes: string;
}

const EMPTY: FormState = {
  localisation: "", urba: "", superficie: "", prix: "",
  usage: "Tertiaire", statut: "Disponible", tf: "", notes: "",
};

function terrainToForm(t: Terrain): FormState {
  return {
    localisation: t.localisation,
    urba:         t.urba,
    superficie:   String(t.superficie),
    prix:         String(t.prix),
    usage:        t.usage || "Tertiaire",
    statut:       t.statut || "Disponible",
    tf:           t.tf,
    notes:        t.notes,
  };
}

function TerrainModal({
  terrain,
  onSave,
  onDelete,
  onClose,
}: {
  terrain?: Terrain;
  onSave: (t: Omit<Terrain, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const isEdit = !!terrain;
  const [form, setForm] = useState<FormState>(terrain ? terrainToForm(terrain) : EMPTY);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<any>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.localisation.trim()) { setError("Localisation obligatoire."); return; }
    if (!form.superficie || isNaN(+form.superficie)) { setError("Superficie invalide."); return; }
    if (!form.prix || isNaN(+form.prix)) { setError("Prix invalide."); return; }
    setError("");
    onSave({
      localisation: form.localisation.trim(),
      urba:         form.urba.trim(),
      superficie:   parseFloat(form.superficie),
      prix:         parseFloat(form.prix),
      usage:        form.usage,
      statut:       form.statut,
      tf:           form.tf.trim(),
      notes:        form.notes.trim(),
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#0d3320", border: "1px solid rgba(45,158,95,0.25)", borderRadius: 18, padding: 32, width: "100%", maxWidth: 540, color: T.white, boxShadow: "0 12px 48px rgba(10,46,26,0.4)", maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 24, color: T.greenLight }}>
          {isEdit ? "Modifier le Terrain" : "Nouveau Terrain"}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Localisation *</label>
            <input style={inputStyle} value={form.localisation} onChange={set("localisation")} placeholder="Ex: Marrakech, Guéliz" />
          </div>
          <div>
            <label style={labelStyle}>Définition Urbanistique</label>
            <input style={inputStyle} value={form.urba} onChange={set("urba")} placeholder="Ex: Mix Used, BT2" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Superficie (m²) *</label>
            <input style={inputStyle} type="number" value={form.superficie} onChange={set("superficie")} placeholder="293046" />
          </div>
          <div>
            <label style={labelStyle}>Prix au m² (MAD) *</label>
            <input style={inputStyle} type="number" value={form.prix} onChange={set("prix")} placeholder="1300" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Usage</label>
            <select style={inputStyle} value={form.usage} onChange={set("usage")}>
              {["Tertiaire","Résidentiel","Mixte","Hôtellerie","Industriel","Balnéaire","Logistique"].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Statut</label>
            <select style={inputStyle} value={form.statut} onChange={set("statut")}>
              <option>Disponible</option>
              <option>En négociation</option>
              <option>Vendu</option>
            </select>
          </div>
        </div>

        <label style={labelStyle}>TF / Référence foncière</label>
        <input style={inputStyle} value={form.tf} onChange={set("tf")} placeholder="Ex: 23106/38" />

        <label style={labelStyle}>Notes / Potentiel</label>
        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.notes} onChange={set("notes")} placeholder="Description, points forts..." />

        {error && <div style={{ color: "#e74c3c", fontSize: 12, marginBottom: 12 }}>{error}</div>}

        {/* Confirm delete */}
        {confirmDelete && (
          <div style={{ background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#e74c3c", marginBottom: 12 }}>
              Confirmer la suppression de ce terrain ?
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={btnDanger} onClick={onDelete}>Oui, supprimer</button>
              <button style={btnGhost} onClick={() => setConfirmDelete(false)}>Annuler</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
          {/* Supprimer à gauche si mode édition */}
          {isEdit && !confirmDelete && (
            <button style={btnDanger} onClick={() => setConfirmDelete(true)}>
              Supprimer
            </button>
          )}
          {!isEdit && <div />}

          <div style={{ display: "flex", gap: 10 }}>
            <button style={btnGhost} onClick={onClose}>Annuler</button>
            <button style={btnPrimary} onClick={handleSave}>
              {isEdit ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TerrainsPage({ state, dispatch }: Props) {
  const [showModal, setShowModal]       = useState(false);
  const [editTerrain, setEditTerrain]   = useState<Terrain | undefined>();
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const { terrains } = state;

  // Recherche dans TOUS les champs
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return terrains;
    return terrains.filter(t =>
      [t.localisation, t.urba, t.usage, t.statut, t.tf, t.notes, String(t.superficie), String(t.prix)]
        .some(v => (v ?? "").toLowerCase().includes(q))
    );
  }, [terrains, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalM2    = filtered.reduce((s, t) => s + (t.superficie || 0), 0);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  const handleSave = (payload: Omit<Terrain, "id">) => {
    if (editTerrain) {
      dispatch({ type: "UPDATE_TERRAIN", payload: { ...payload, id: editTerrain.id } });
    } else {
      dispatch({ type: "ADD_TERRAIN", payload });
    }
    setShowModal(false);
    setEditTerrain(undefined);
  };

  const handleDelete = (id: number) => {
    dispatch({ type: "DELETE_TERRAIN", payload: id });
    setShowModal(false);
    setEditTerrain(undefined);
  };

  const openNew  = () => { setEditTerrain(undefined); setShowModal(true); };
  const openEdit = (t: Terrain) => { setEditTerrain(t); setShowModal(true); };

  const thStyle: React.CSSProperties = {
    padding: "10px 10px", textAlign: "left", fontSize: 10, fontWeight: 700,
    color: T.grayMid, textTransform: "uppercase", letterSpacing: "0.07em",
    whiteSpace: "nowrap", background: "#f7faf8",
  };
  const tdStyle: React.CSSProperties = { padding: "9px 10px", fontSize: 12 };

  return (
    <>
      {/* Topbar */}
      <div style={{ padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(45,158,95,0.12)", background: "rgba(7,26,15,0.6)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div>
          <span style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, color: T.white }}>Portefeuille Terrains</span>
          <span style={{ marginLeft: 10, fontSize: 12, color: T.grayMid }}>
            {filtered.length} terrain{filtered.length > 1 ? "s" : ""} · {totalM2.toLocaleString("fr-FR")} m²
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Rechercher (localisation, TF, urba…)"
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(45,158,95,0.25)", background: "rgba(255,255,255,0.06)", color: T.white, fontSize: 12, outline: "none", width: 260 }}
          />
          <button style={btnPrimary} onClick={openNew}>+ Nouveau Terrain</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: "16px 28px" }}>
        <div style={{ background: T.cardBg, borderRadius: 14, overflow: "hidden", boxShadow: "0 4px 24px rgba(10,46,26,0.10)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e8f0ec" }}>
                  <th style={{ ...thStyle, width: 36 }}>#</th>
                  <th style={thStyle}>Localisation</th>
                  <th style={thStyle}>TF</th>
                  <th style={thStyle}>Urba</th>
                  <th style={thStyle}>Superficie</th>
                  <th style={thStyle}>Prix/m²</th>
                  <th style={thStyle}>Forfait</th>
                  <th style={thStyle}>Usage</th>
                  <th style={thStyle}>Statut</th>
                  <th style={{ ...thStyle, width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "40px 0", color: "#aaa", fontSize: 13 }}>
                      {search ? `Aucun résultat pour "${search}".` : "Aucun terrain."}
                    </td>
                  </tr>
                ) : paginated.map((t, i) => {
                  const forfait = t.superficie && t.prix ? Math.round(t.superficie * t.prix / 1_000_000) : 0;
                  const idx = (page - 1) * PAGE_SIZE + i + 1;
                  return (
                    <tr key={t.id}
                      style={{ borderBottom: "1px solid #f0f4f2", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f7fbf8")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ ...tdStyle, color: T.greenMid, fontWeight: 700 }}>{idx}</td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: T.dark }}>{t.localisation || "—"}</div>
                      </td>
                      <td style={{ ...tdStyle, color: "#777", fontSize: 11 }}>
                        {t.tf || "—"}
                      </td>
                      <td style={tdStyle}>
                        <Badge text={t.urba || "—"} urba />
                      </td>
                      <td style={{ ...tdStyle, color: T.dark, whiteSpace: "nowrap" }}>
                        {(t.superficie || 0).toLocaleString("fr-FR")} m²
                      </td>
                      <td style={{ ...tdStyle, color: T.dark, whiteSpace: "nowrap" }}>
                        {(t.prix || 0).toLocaleString("fr-FR")}
                      </td>
                      <td style={tdStyle}>
                        <strong style={{ fontFamily: "Syne, sans-serif", fontSize: 12, color: T.greenMid }}>{forfait} M</strong>
                      </td>
                      <td style={tdStyle}><Badge text={t.usage || "—"} /></td>
                      <td style={tdStyle}><Badge text={t.statut || "—"} /></td>
                      <td style={tdStyle}>
                        <button style={btnEdit} onClick={() => openEdit(t)}>
                          ✎ Modifier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid #e8f0ec", background: "#f7faf8" }}>
              <span style={{ fontSize: 12, color: T.grayMid }}>
                Page {page} / {totalPages} · {filtered.length} terrains
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ ...btnGhost, padding: "5px 12px", fontSize: 12, opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? "default" : "pointer" }}>
                  ← Préc.
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`e${i}`} style={{ padding: "5px 6px", color: T.grayMid, fontSize: 12 }}>…</span>
                    ) : (
                      <button key={p} onClick={() => setPage(p as number)}
                        style={{ padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: page === p ? 700 : 400, background: page === p ? T.greenBright : "transparent", color: page === p ? "#fff" : T.grayMid }}>
                        {p}
                      </button>
                    )
                  )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ ...btnGhost, padding: "5px 12px", fontSize: 12, opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? "default" : "pointer" }}>
                  Suiv. →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <TerrainModal
          terrain={editTerrain}
          onSave={handleSave}
          onDelete={editTerrain ? () => handleDelete(editTerrain.id) : undefined}
          onClose={() => { setShowModal(false); setEditTerrain(undefined); }}
        />
      )}
    </>
  );
}