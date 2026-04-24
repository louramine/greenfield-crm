import { useState, useMemo } from "react";

interface Acheteur {
  id: number;
  nom: string;
  contact: string;
  type: string;
  statut: string;
  zones: string;
  ticketMin: string;
  ticketMax: string;
  usage: string;
  notes: string;
  urbas_cibles?: string[];
}

interface Props {
  state: { acheteurs: Acheteur[] };
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

const TYPES   = ["Promoteur", "Fonds", "HNWI", "Entreprise", "Investisseur"];
const USAGES  = ["Tertiaire", "Résidentiel", "Mixte", "Hôtellerie", "Industriel", "Balnéaire", "Logistique"];
const URBAS   = ["B5", "B4", "B3", "B2", "B1", "BT2S1", "BT2", "A7", "A10", "C4S", "D3S", "E3", "I2S1", "RA", "RMD RFD", "Mix Used", "B3s"];

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  Promoteur:    { bg: "#e8f4fd", color: "#2980b9" },
  Fonds:        { bg: "#fef9e7", color: "#c9a84c" },
  HNWI:         { bg: "#fdf2f8", color: "#8e44ad" },
  Entreprise:   { bg: "#e8f5e9", color: "#2e7d32" },
  Investisseur: { bg: "#fef0f0", color: "#c0392b" },
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 8,
  border: "1px solid rgba(45,158,95,0.25)",
  background: "rgba(255,255,255,0.06)", color: "#f8faf9",
  fontSize: 13, boxSizing: "border-box", outline: "none",
  marginBottom: 14, fontFamily: "DM Sans, sans-serif",
};
const labelStyle: React.CSSProperties = {
  fontSize: 12, color: "#8aab97", marginBottom: 4, display: "block", letterSpacing: "0.05em",
};
const btnPrimary: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
  background: `linear-gradient(135deg, #2d9e5f, #4eca82)`,
  color: "#071a0f", fontWeight: 600, fontSize: 13, fontFamily: "DM Sans, sans-serif",
};
const btnGhost: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 8, cursor: "pointer",
  background: "rgba(45,158,95,0.12)", color: "#4eca82",
  border: "1px solid rgba(45,158,95,0.25)", fontSize: 13,
  fontFamily: "DM Sans, sans-serif",
};
const btnDanger: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 8, cursor: "pointer",
  background: "rgba(231,76,60,0.1)", color: "#e74c3c",
  border: "1px solid rgba(231,76,60,0.3)", fontSize: 13,
  fontFamily: "DM Sans, sans-serif",
};

// ─── Urbas selector ───────────────────────────────────────────────────────────

function UrbasSelector({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
      {URBAS.map(u => {
        const isSel = selected.includes(u);
        return (
          <button key={u} type="button"
            onClick={() => onChange(isSel ? selected.filter(x => x !== u) : [...selected, u])}
            style={{
              padding: "4px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              fontWeight: isSel ? 700 : 400,
              background: isSel ? "#1565c0" : "rgba(255,255,255,0.06)",
              color: isSel ? "#fff" : "#8aab97",
              border: `1px solid ${isSel ? "#1565c0" : "rgba(45,158,95,0.2)"}`,
              transition: "all 0.15s",
            }}
          >
            {u}
          </button>
        );
      })}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface FormState {
  nom: string; contact: string; type: string; statut: string;
  zones: string; ticketMin: string; ticketMax: string;
  usage: string; notes: string; urbas_cibles: string[];
}

const EMPTY: FormState = {
  nom: "", contact: "", type: "Promoteur", statut: "Froid",
  zones: "", ticketMin: "", ticketMax: "",
  usage: "Tertiaire", notes: "", urbas_cibles: [],
};

function acheteurToForm(a: Acheteur): FormState {
  return {
    nom: a.nom, contact: a.contact, type: a.type, statut: a.statut,
    zones: a.zones, ticketMin: a.ticketMin, ticketMax: a.ticketMax,
    usage: a.usage, notes: a.notes, urbas_cibles: a.urbas_cibles ?? [],
  };
}

function AcheteurModal({
  acheteur, onSave, onDelete, onClose,
}: {
  acheteur?: Acheteur;
  onSave: (a: any) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const isEdit = !!acheteur;
  const [form, setForm] = useState<FormState>(acheteur ? acheteurToForm(acheteur) : EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof FormState) => (e: React.ChangeEvent<any>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.nom.trim()) { setError("Nom obligatoire."); return; }
    setError("");
    onSave({ ...form, nom: form.nom.trim() });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#0d3320", border: "1px solid rgba(45,158,95,0.25)", borderRadius: 18, padding: 32, width: "100%", maxWidth: 560, color: T.white, boxShadow: "0 12px 48px rgba(10,46,26,0.4)", maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 24, color: "#4eca82" }}>
          {isEdit ? "Modifier l'Acheteur" : "Nouvel Acheteur"}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div><label style={labelStyle}>Nom / Société *</label><input style={inputStyle} value={form.nom} onChange={set("nom")} placeholder="Redal Group" /></div>
          <div><label style={labelStyle}>Contact</label><input style={inputStyle} value={form.contact} onChange={set("contact")} placeholder="Nom du contact" /></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select style={inputStyle} value={form.type} onChange={set("type")}>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Usage recherché</label>
            <select style={inputStyle} value={form.usage} onChange={set("usage")}>
              {USAGES.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <label style={labelStyle}>Zones d'intérêt</label>
        <input style={inputStyle} value={form.zones} onChange={set("zones")} placeholder="Casablanca, Rabat..." />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div><label style={labelStyle}>Budget min (M MAD)</label><input style={inputStyle} type="number" value={form.ticketMin} onChange={set("ticketMin")} placeholder="50" /></div>
          <div><label style={labelStyle}>Budget max (M MAD)</label><input style={inputStyle} type="number" value={form.ticketMax} onChange={set("ticketMax")} placeholder="400" /></div>
        </div>

        <label style={labelStyle}>Définitions urbanistiques cibles</label>
        <UrbasSelector selected={form.urbas_cibles} onChange={v => setForm(f => ({ ...f, urbas_cibles: v }))} />

        <label style={labelStyle}>Notes</label>
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={set("notes")} placeholder="Remarques, conditions..." />

        {error && <div style={{ color: "#e74c3c", fontSize: 12, marginBottom: 12 }}>{error}</div>}

        {confirmDelete && (
          <div style={{ background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#e74c3c", marginBottom: 10 }}>Confirmer la suppression ?</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={btnDanger} onClick={onDelete}>Oui, supprimer</button>
              <button style={btnGhost} onClick={() => setConfirmDelete(false)}>Annuler</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
          {isEdit && !confirmDelete
            ? <button style={btnDanger} onClick={() => setConfirmDelete(true)}>Supprimer</button>
            : <div />
          }
          <div style={{ display: "flex", gap: 10 }}>
            <button style={btnGhost} onClick={onClose}>Annuler</button>
            <button style={btnPrimary} onClick={handleSave}>{isEdit ? "Enregistrer" : "Créer"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AcheteursPage({ state, dispatch }: Props) {
  const [showModal, setShowModal]     = useState(false);
  const [editAcheteur, setEditAcheteur] = useState<Acheteur | undefined>();
  const [search, setSearch]           = useState("");
  const { acheteurs } = state;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return acheteurs;
    return acheteurs.filter(a =>
      [a.nom, a.contact, a.type, a.zones, a.usage, a.notes]
        .some(v => (v ?? "").toLowerCase().includes(q))
    );
  }, [acheteurs, search]);

  const handleSave = (payload: any) => {
    if (editAcheteur) {
      dispatch({ type: "UPDATE_ACHETEUR", payload: { ...payload, id: editAcheteur.id } });
    } else {
      dispatch({ type: "ADD_ACHETEUR", payload });
    }
    setShowModal(false);
    setEditAcheteur(undefined);
  };

  const handleDelete = (id: number) => {
    dispatch({ type: "DELETE_ACHETEUR", payload: id });
    setShowModal(false);
    setEditAcheteur(undefined);
  };

  const thStyle: React.CSSProperties = {
    padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700,
    color: T.grayMid, textTransform: "uppercase", letterSpacing: "0.07em",
    whiteSpace: "nowrap", background: "#f7faf8",
  };
  const tdStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 12 };

  return (
    <>
      <div style={{ padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(45,158,95,0.12)", background: "rgba(7,26,15,0.6)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div>
          <span style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, color: T.white }}>Base Acheteurs</span>
          <span style={{ marginLeft: 10, fontSize: 12, color: T.grayMid }}>{filtered.length} acheteur{filtered.length > 1 ? "s" : ""}</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(45,158,95,0.25)", background: "rgba(255,255,255,0.06)", color: T.white, fontSize: 12, outline: "none", width: 200 }} />
          <button style={btnPrimary} onClick={() => { setEditAcheteur(undefined); setShowModal(true); }}>+ Nouvel Acheteur</button>
        </div>
      </div>

      <div style={{ padding: "16px 28px" }}>
        <div style={{ background: T.cardBg, borderRadius: 14, overflow: "hidden", boxShadow: "0 4px 24px rgba(10,46,26,0.10)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e8f0ec" }}>
                {["Nom / Société", "Type", "Zones d'intérêt", "Budget (M MAD)", "Urbas cibles", ""].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "40px 0", color: "#aaa", fontSize: 13 }}>
                  {search ? "Aucun résultat." : "Aucun acheteur."}
                </td></tr>
              ) : filtered.map(a => {
                const tc = TYPE_COLORS[a.type] ?? { bg: "#f5f5f5", color: "#666" };
                const urbas = a.urbas_cibles ?? [];
                return (
                  <tr key={a.id}
                    style={{ borderBottom: "1px solid #f0f4f2", transition: "background 0.15s", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f7fbf8")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    onClick={() => { setEditAcheteur(a); setShowModal(true); }}
                  >
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: T.dark }}>{a.nom}</div>
                      {a.contact && <div style={{ fontSize: 11, color: "#888" }}>{a.contact}</div>}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: tc.bg, color: tc.color }}>{a.type}</span>
                    </td>
                    <td style={{ ...tdStyle, color: "#555", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.zones || "—"}</td>
                    <td style={{ ...tdStyle, color: T.dark, whiteSpace: "nowrap" }}>
                      {a.ticketMin || a.ticketMax ? `${a.ticketMin || "?"} — ${a.ticketMax || "?"} M` : "—"}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {urbas.length === 0 ? <span style={{ color: "#aaa", fontSize: 11 }}>—</span>
                          : urbas.slice(0, 4).map(u => (
                            <span key={u} style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, background: "#e3f2fd", color: "#1565c0", fontWeight: 600 }}>{u}</span>
                          ))}
                        {urbas.length > 4 && <span style={{ fontSize: 10, color: "#888" }}>+{urbas.length - 4}</span>}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 11, color: T.grayMid }}>✎</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AcheteurModal
          acheteur={editAcheteur}
          onSave={handleSave}
          onDelete={editAcheteur ? () => handleDelete(editAcheteur.id) : undefined}
          onClose={() => { setShowModal(false); setEditAcheteur(undefined); }}
        />
      )}
    </>
  );
}