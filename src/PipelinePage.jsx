import { useState } from "react";

const STAGES = [
  { id: "teaser",  label: "Teaser Envoyé",  color: "#95a5a6" },
  { id: "nda",     label: "NDA Signé",      color: "#3498db" },
  { id: "visite",  label: "Visite Terrain", color: "#f39c12" },
  { id: "offre",   label: "Offre Reçue",    color: "#9b59b6" },
  { id: "closing", label: "Closing",        color: "#2ecc71" },
];

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]));

const TAG_CLASS = {
  Promoteur: { bg: "#e8f4fd", color: "#2980b9" },
  Fonds:     { bg: "#fef9e7", color: "#c9a84c" },
  HNWI:      { bg: "#fdf2f8", color: "#8e44ad" },
  Entreprise:{ bg: "#e8f5e9", color: "#2e7d32" },
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 8,
  border: "1px solid rgba(45,158,95,0.25)",
  background: "rgba(255,255,255,0.06)", color: "#f8faf9",
  fontSize: 13, marginBottom: 14, boxSizing: "border-box", outline: "none",
  fontFamily: "DM Sans, sans-serif",
};
const labelStyle = {
  fontSize: 12, color: "#8aab97", marginBottom: 4, display: "block", letterSpacing: "0.05em",
};
const btnPrimary = {
  padding: "10px 22px", borderRadius: 8, border: "none",
  background: "linear-gradient(135deg, #2d9e5f, #4eca82)",
  color: "#071a0f", fontWeight: 600, fontSize: 13, cursor: "pointer",
  fontFamily: "DM Sans, sans-serif",
};
const btnGhost = {
  padding: "10px 22px", borderRadius: 8,
  border: "1px solid rgba(45,158,95,0.3)",
  background: "transparent", color: "#8aab97", fontSize: 13, cursor: "pointer",
  fontFamily: "DM Sans, sans-serif",
};
const btnDanger = {
  padding: "10px 22px", borderRadius: 8,
  border: "1px solid rgba(231,76,60,0.3)",
  background: "rgba(231,76,60,0.1)", color: "#e74c3c", fontSize: 13, cursor: "pointer",
  fontFamily: "DM Sans, sans-serif",
};

// ─── Modal Création ───────────────────────────────────────────────────────────

function NewDealModal({ terrains, acheteurs, onSave, onClose }) {
  const [form, setForm] = useState({
    terrainId:  terrains[0]?.id ?? "",
    acheteurId: acheteurs[0]?.id ?? "",
    etape:      "teaser",
    montant:    "",
    notes:      "",
  });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.terrainId || !form.acheteurId) { alert("Sélectionnez un terrain et un acheteur"); return; }
    onSave({ ...form, terrainId: parseInt(form.terrainId), acheteurId: parseInt(form.acheteurId), montant: parseFloat(form.montant) || 0 });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#0d3320", border: "1px solid rgba(45,158,95,0.25)", borderRadius: 18, padding: 32, width: "100%", maxWidth: 500, color: "#f8faf9", boxShadow: "0 12px 48px rgba(10,46,26,0.4)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 24, color: "#4eca82" }}>
          Nouveau Deal
        </div>

        {/* Terrain — affiche TF + localisation */}
        <label style={labelStyle}>Terrain *</label>
        <select style={inputStyle} value={form.terrainId} onChange={set("terrainId")}>
          {terrains.length === 0
            ? <option value="">Aucun terrain disponible</option>
            : terrains.map(t => (
                <option key={t.id} value={t.id}>
                  {t.tf ? `${t.tf} — ${t.localisation}` : t.localisation}
                </option>
              ))
          }
        </select>

        <label style={labelStyle}>Acheteur *</label>
        <select style={inputStyle} value={form.acheteurId} onChange={set("acheteurId")}>
          {acheteurs.length === 0
            ? <option value="">Aucun acheteur — ajoutez-en d'abord</option>
            : acheteurs.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)
          }
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Etape</label>
            <select style={inputStyle} value={form.etape} onChange={set("etape")}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Montant (M MAD)</label>
            <input style={inputStyle} type="number" value={form.montant} onChange={set("montant")} placeholder="ex: 45" />
          </div>
        </div>

        <label style={labelStyle}>Notes</label>
        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.notes} onChange={set("notes")} placeholder="Contexte, conditions particulières..." />

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
          <button style={btnGhost} onClick={onClose}>Annuler</button>
          <button style={btnPrimary} onClick={handleSave}>Créer le deal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Edition ────────────────────────────────────────────────────────────

function EditDealModal({ deal, terrain, acheteur, terrains, acheteurs, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    terrainId:  deal.terrainId ?? "",
    acheteurId: deal.acheteurId ?? "",
    etape:      deal.etape ?? "teaser",
    montant:    deal.montant ? String(deal.montant) : "",
    notes:      deal.notes ?? "",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    onSave({ ...form, id: deal.id, terrainId: parseInt(form.terrainId), acheteurId: parseInt(form.acheteurId), montant: parseFloat(form.montant) || 0 });
  };

  const stage = STAGE_MAP[form.etape];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#0d3320", border: "1px solid rgba(45,158,95,0.25)", borderRadius: 18, padding: 32, width: "100%", maxWidth: 500, color: "#f8faf9", boxShadow: "0 12px 48px rgba(10,46,26,0.4)", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header avec badge étape */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, color: "#4eca82" }}>
            Modifier le Deal
          </div>
          <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${stage?.color}22`, color: stage?.color, border: `1px solid ${stage?.color}44` }}>
            {stage?.label}
          </span>
        </div>

        {/* Terrain — TF + localisation */}
        <label style={labelStyle}>Terrain</label>
        <select style={inputStyle} value={form.terrainId} onChange={set("terrainId")}>
          {terrains.map(t => (
            <option key={t.id} value={t.id}>
              {t.tf ? `${t.tf} — ${t.localisation}` : t.localisation}
            </option>
          ))}
        </select>

        <label style={labelStyle}>Acheteur</label>
        <select style={inputStyle} value={form.acheteurId} onChange={set("acheteurId")}>
          {acheteurs.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </select>

        {/* Etape — boutons visuels */}
        <label style={labelStyle}>Etape</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {STAGES.map(s => (
            <button key={s.id}
              onClick={() => setForm(f => ({ ...f, etape: s.id }))}
              style={{
                padding: "6px 12px", borderRadius: 20, border: `1px solid ${s.color}`,
                background: form.etape === s.id ? s.color : "transparent",
                color: form.etape === s.id ? "#fff" : s.color,
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Montant (M MAD)</label>
            <input style={inputStyle} type="number" value={form.montant} onChange={set("montant")} placeholder="ex: 45" />
          </div>
        </div>

        <label style={labelStyle}>Notes</label>
        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.notes} onChange={set("notes")} placeholder="Contexte, conditions..." />

        {/* Confirmation suppression */}
        {confirmDelete && (
          <div style={{ background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#e74c3c", marginBottom: 10 }}>Confirmer la suppression de ce deal ?</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={btnDanger} onClick={onDelete}>Oui, supprimer</button>
              <button style={btnGhost} onClick={() => setConfirmDelete(false)}>Annuler</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          {!confirmDelete
            ? <button style={btnDanger} onClick={() => setConfirmDelete(true)}>Supprimer</button>
            : <div />
          }
          <div style={{ display: "flex", gap: 10 }}>
            <button style={btnGhost} onClick={onClose}>Annuler</button>
            <button style={btnPrimary} onClick={handleSave}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline Page ────────────────────────────────────────────────────────────

export default function PipelinePage({ state, dispatch }) {
  const [showNew, setShowNew]       = useState(false);
  const [editDeal, setEditDeal]     = useState(null);
  const { deals, terrains, acheteurs } = state;

  const handleCreate = form => {
    dispatch({ type: "ADD_DEAL", payload: form });
    setShowNew(false);
  };

  const handleUpdate = form => {
    dispatch({ type: "UPDATE_DEAL", payload: form });
    setEditDeal(null);
  };

  const handleDelete = id => {
    dispatch({ type: "DELETE_DEAL", payload: id });
    setEditDeal(null);
  };

  return (
    <>
      {/* Topbar */}
      <div style={{
        padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(45,158,95,0.12)",
        background: "rgba(7,26,15,0.6)", backdropFilter: "blur(8px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div>
          <span style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 700, color: "#f8faf9" }}>Pipeline Deals</span>
          <span style={{ marginLeft: 12, fontSize: 12, color: "#8aab97" }}>{deals.length} deal{deals.length > 1 ? "s" : ""} actif{deals.length > 1 ? "s" : ""}</span>
        </div>
        <button style={btnPrimary} onClick={() => setShowNew(true)}>+ Nouveau Deal</button>
      </div>

      {/* Board */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, padding: "20px 28px", overflowX: "auto" }}>
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.etape === stage.id);
          return (
            <div key={stage.id} style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(45,158,95,0.14)",
              borderRadius: 14, padding: "14px 12px", minHeight: 420,
            }}>
              {/* Colonne header */}
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", color: stage.color }}>
                {stage.label}
                <span style={{ background: "rgba(45,158,95,0.2)", color: "#4eca82", borderRadius: 20, padding: "2px 8px", fontSize: 11 }}>
                  {stageDeals.length}
                </span>
              </div>

              {stageDeals.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>○</div>
                  Aucun deal
                </div>
              ) : stageDeals.map(deal => {
                const terrain  = terrains.find(t => t.id === deal.terrainId);
                const acheteur = acheteurs.find(a => a.id === deal.acheteurId);
                const tag      = TAG_CLASS[acheteur?.type] ?? TAG_CLASS.Promoteur;

                return (
                  <div key={deal.id}
                    onClick={() => setEditDeal(deal)}
                    style={{
                      background: "rgba(255,255,255,0.96)", borderRadius: 10, padding: 13, marginBottom: 10,
                      color: "#071a0f", boxShadow: "0 2px 8px rgba(10,46,26,0.08)",
                      cursor: "pointer", transition: "all 0.2s",
                      borderLeft: `3px solid ${stage.color}`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(10,46,26,0.14)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(10,46,26,0.08)"; }}
                  >
                    {/* Localisation */}
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0a2e1a", marginBottom: 2 }}>
                      {terrain?.localisation ?? "Terrain inconnu"}
                    </div>

                    {/* TF */}
                    {terrain?.tf && (
                      <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>
                        TF {terrain.tf}
                      </div>
                    )}

                    {/* Acheteur */}
                    <div style={{ fontSize: 11.5, color: "#555", marginBottom: 6 }}>
                      {acheteur?.nom ?? "Acheteur inconnu"}
                    </div>

                    {/* Montant */}
                    <div style={{ fontFamily: "Syne, sans-serif", fontSize: 13, fontWeight: 700, color: "#1a5c35" }}>
                      {deal.montant ? `${deal.montant} M MAD` : "—"}
                    </div>

                    {/* Tag type acheteur */}
                    {acheteur && (
                      <span style={{ display: "inline-block", marginTop: 6, padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", background: tag.bg, color: tag.color }}>
                        {acheteur.type}
                      </span>
                    )}

                    {/* Hint modifier */}
                    <div style={{ marginTop: 8, fontSize: 10, color: "#aaa", textAlign: "right" }}>
                      ✎ cliquer pour modifier
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Modal nouveau deal */}
      {showNew && (
        <NewDealModal
          terrains={terrains}
          acheteurs={acheteurs}
          onSave={handleCreate}
          onClose={() => setShowNew(false)}
        />
      )}

      {/* Modal édition deal */}
      {editDeal && (
        <EditDealModal
          deal={editDeal}
          terrain={terrains.find(t => t.id === editDeal.terrainId)}
          acheteur={acheteurs.find(a => a.id === editDeal.acheteurId)}
          terrains={terrains}
          acheteurs={acheteurs}
          onSave={handleUpdate}
          onDelete={() => handleDelete(editDeal.id)}
          onClose={() => setEditDeal(null)}
        />
      )}
    </>
  );
}