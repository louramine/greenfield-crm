import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

interface Props {
  state: { acheteurs: Acheteur[] };
  dispatch: (action: any) => void;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

const T = {
  greenDeep:   "#0a2e1a",
  greenMid:    "#1a5c35",
  greenBright: "#2d9e5f",
  greenLight:  "#4eca82",
  gold:        "#c9a84c",
  white:       "#f8faf9",
  grayMid:     "#8aab97",
  grayLight:   "#e2ece7",
  dark:        "#071a0f",
  cardBg:      "rgba(255,255,255,0.97)",
};

// ─── Badges ───────────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, { bg: string; color: string }> = {
  "Promoteur":  { bg: "#e3f2fd", color: "#1565c0" },
  "Fonds":      { bg: "#fef9e7", color: "#c9a84c" },
  "HNWI":       { bg: "#fdf2f8", color: "#8e44ad" },
  "Entreprise": { bg: "#e8f5e9", color: "#2e7d32" },
};

const STATUT_BADGE: Record<string, { bg: string; color: string }> = {
  "Froid":   { bg: "#f5f5f5",  color: "#666"    },
  "Tiède":   { bg: "#f5f5f5",  color: "#666"    },
  "Chaud":   { bg: "#fff3e0",  color: "#e65100" },
  "Client":  { bg: "#e0f7ec",  color: "#1a5c35" },
};

function Badge({ text, map }: { text: string; map: Record<string, { bg: string; color: string }> }) {
  const s = map[text] ?? { bg: "#f5f5f5", color: "#666" };
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, background: s.bg, color: s.color,
      letterSpacing: "0.03em",
    }}>
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
  fontSize: 12, color: T.grayMid, marginBottom: 4,
  display: "block", letterSpacing: "0.05em",
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
  padding: "4px 12px", borderRadius: 6, cursor: "pointer",
  background: "transparent", color: "#c0392b",
  border: "1px solid #fad7d0", fontSize: 11,
  fontFamily: "DM Sans, sans-serif",
};

// ─── Modal ────────────────────────────────────────────────────────────────────

interface FormState {
  nom: string;
  contact: string;
  type: string;
  statut: string;
  zones: string;
  ticketMin: string;
  ticketMax: string;
  usage: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  nom: "", contact: "",
  type: "Promoteur", statut: "Froid",
  zones: "", ticketMin: "", ticketMax: "",
  usage: "Tous", notes: "",
};

function AcheteurModal({
  onSave,
  onClose,
}: {
  onSave: (a: Omit<Acheteur, "id">) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.nom.trim()) { setError("Le nom est obligatoire."); return; }
    setError("");
    onSave({
      nom:       form.nom.trim(),
      contact:   form.contact.trim(),
      type:      form.type,
      statut:    form.statut,
      zones:     form.zones.trim(),
      ticketMin: form.ticketMin,
      ticketMax: form.ticketMax,
      usage:     form.usage,
      notes:     form.notes.trim(),
    });
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#0d3320", border: "1px solid rgba(45,158,95,0.25)",
        borderRadius: 18, padding: 32, width: "100%", maxWidth: 520,
        color: T.white, boxShadow: "0 12px 48px rgba(10,46,26,0.4)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 24, color: T.greenLight }}>
          Nouvel Acheteur
        </div>

        {/* Nom + Contact */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Nom / Société *</label>
            <input style={inputStyle} value={form.nom} onChange={set("nom")} placeholder="Ex: Groupe Addoha" />
          </div>
          <div>
            <label style={labelStyle}>Contact direct</label>
            <input style={inputStyle} value={form.contact} onChange={set("contact")} placeholder="Prénom Nom" />
          </div>
        </div>

        {/* Type + Statut */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Type *</label>
            <select style={inputStyle} value={form.type} onChange={set("type")}>
              <option value="Promoteur">Promoteur immobilier</option>
              <option value="Fonds">Fonds / REIT</option>
              <option value="HNWI">Acheteur privé (HNWI)</option>
              <option value="Entreprise">Entreprise</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Statut relation</label>
            <select style={inputStyle} value={form.statut} onChange={set("statut")}>
              <option value="Froid">Froid</option>
              <option value="Tiède">Tiède</option>
              <option value="Chaud">Chaud</option>
              <option value="Client">Client</option>
            </select>
          </div>
        </div>

        {/* Zones */}
        <label style={labelStyle}>Zones d'intérêt</label>
        <input style={inputStyle} value={form.zones} onChange={set("zones")} placeholder="Ex: Casablanca, Rabat, Marrakech" />

        {/* Ticket */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Ticket minimum (M MAD)</label>
            <input style={inputStyle} type="number" value={form.ticketMin} onChange={set("ticketMin")} placeholder="50" />
          </div>
          <div>
            <label style={labelStyle}>Ticket maximum (M MAD)</label>
            <input style={inputStyle} type="number" value={form.ticketMax} onChange={set("ticketMax")} placeholder="300" />
          </div>
        </div>

        {/* Usage */}
        <label style={labelStyle}>Usage recherché</label>
        <select style={inputStyle} value={form.usage} onChange={set("usage")}>
          <option value="Tous">Tous usages</option>
          <option value="Tertiaire">Tertiaire</option>
          <option value="Résidentiel">Résidentiel</option>
          <option value="Mixte">Mixte</option>
          <option value="Hôtellerie">Hôtellerie</option>
          <option value="Industriel">Industriel</option>
          <option value="Logistique">Logistique</option>
        </select>

        {/* Notes */}
        <label style={labelStyle}>Notes</label>
        <textarea
          style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
          value={form.notes}
          onChange={set("notes")}
          placeholder="Stratégie, historique, remarques..."
        />

        {error && (
          <div style={{ color: "#e74c3c", fontSize: 12, marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button style={btnGhost} onClick={onClose}>Annuler</button>
          <button style={btnPrimary} onClick={handleSave}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page Acheteurs ───────────────────────────────────────────────────────────

export default function AcheteursPage({ state, dispatch }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const { acheteurs } = state;

  const filtered = acheteurs.filter((a) =>
    `${a.nom} ${a.contact} ${a.type} ${a.zones} ${a.statut}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleSave = (payload: Omit<Acheteur, "id">) => {
    dispatch({ type: "ADD_ACHETEUR", payload });
    setShowModal(false);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Supprimer cet acheteur ?")) return;
    dispatch({ type: "DELETE_ACHETEUR", payload: id });
  };

  return (
    <>
      {/* Topbar */}
      <div style={{
        padding: "20px 36px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(45,158,95,0.12)",
        background: "rgba(7,26,15,0.6)", backdropFilter: "blur(8px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div>
          <span style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 700, color: T.white }}>
            Base Acheteurs
          </span>
          <span style={{ marginLeft: 12, fontSize: 12, color: T.grayMid }}>
            {filtered.length} acheteur{filtered.length > 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            style={{
              padding: "7px 14px", borderRadius: 8,
              border: "1px solid rgba(45,158,95,0.25)",
              background: "rgba(255,255,255,0.06)", color: T.white,
              fontSize: 13, outline: "none", width: 200,
            }}
          />
          <button style={btnPrimary} onClick={() => setShowModal(true)}>
            + Nouvel Acheteur
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: "24px 36px" }}>
        <div style={{
          background: T.cardBg, borderRadius: 16,
          overflow: "hidden", boxShadow: "0 4px 24px rgba(10,46,26,0.10)",
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e8f0ec" }}>
                  {["Nom / Société", "Type", "Zones d'intérêt", "Ticket (M MAD)", "Usage recherché", "Statut", ""].map((h) => (
                    <th key={h} style={{
                      padding: "14px 16px", textAlign: "left",
                      fontSize: 11, fontWeight: 700, color: T.grayMid,
                      textTransform: "uppercase", letterSpacing: "0.08em",
                      whiteSpace: "nowrap", background: "#f7faf8",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px 0", color: "#aaa", fontSize: 13 }}>
                      {search
                        ? "Aucun résultat pour cette recherche."
                        : "Aucun acheteur. Cliquez sur \"+ Nouvel Acheteur\" pour commencer."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => (
                    <tr
                      key={a.id}
                      style={{ borderBottom: "1px solid #f0f4f2", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f7fbf8")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Nom */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: T.dark }}>{a.nom}</div>
                        {a.contact && (
                          <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{a.contact}</div>
                        )}
                      </td>

                      {/* Type */}
                      <td style={{ padding: "14px 16px" }}>
                        <Badge text={a.type} map={TYPE_BADGE} />
                      </td>

                      {/* Zones */}
                      <td style={{ padding: "14px 16px", fontSize: 12, color: "#555", maxWidth: 180 }}>
                        {a.zones || "—"}
                      </td>

                      {/* Ticket */}
                      <td style={{ padding: "14px 16px", fontSize: 13, color: T.dark, whiteSpace: "nowrap" }}>
                        {a.ticketMin || "?"} – {a.ticketMax || "?"} M
                      </td>

                      {/* Usage */}
                      <td style={{ padding: "14px 16px", fontSize: 13, color: "#555" }}>
                        {a.usage || "—"}
                      </td>

                      {/* Statut */}
                      <td style={{ padding: "14px 16px" }}>
                        <Badge text={a.statut} map={STATUT_BADGE} />
                      </td>

                      {/* Suppr */}
                      <td style={{ padding: "14px 16px" }}>
                        <button style={btnDanger} onClick={() => handleDelete(a.id)}>
                          Suppr.
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <AcheteurModal
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}