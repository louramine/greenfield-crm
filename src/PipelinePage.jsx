import { useState, useRef } from "react";

const STAGES = [
  { id: "teaser",  label: "Teaser Envoyé",  color: "#95a5a6" },
  { id: "nda",     label: "NDA Signé",      color: "#3498db" },
  { id: "visite",  label: "Visite Terrain", color: "#f39c12" },
  { id: "offre",   label: "Offre Reçue",    color: "#9b59b6" },
  { id: "closing", label: "Closing",        color: "#2ecc71" },
];

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]));

const TAG_CLASS = {
  Promoteur:  { bg: "#e8f4fd", color: "#2980b9" },
  Fonds:      { bg: "#fef9e7", color: "#c9a84c" },
  HNWI:       { bg: "#fdf2f8", color: "#8e44ad" },
  Entreprise: { bg: "#e8f5e9", color: "#2e7d32" },
};

const ASSOCIE_COLORS = {
  Hachim:     "#c084fc",
  Abderrahim: "#f97316",
  Ayoub:      "#4eca82",
  Amine:      "#60a5fa",
  Said:       "#f43f5e",
};

const ALL_SOURCEURS = ["Ayoub", "Hachim", "Amine", "Abderrahim", "Said"];

function associeColor(nom) {
  return ASSOCIE_COLORS[nom] || "#8aab97";
}

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 8,
  border: "1px solid rgba(45,158,95,0.25)",
  background: "rgba(255,255,255,0.06)", color: "#f8faf9",
  fontSize: 13, marginBottom: 14, boxSizing: "border-box", outline: "none",
  fontFamily: "DM Sans, sans-serif",
};
const labelStyle = {
  fontSize: 12, color: "#8aab97", marginBottom: 6, display: "block", letterSpacing: "0.05em",
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

// ─── Sourceurs selector ───────────────────────────────────────────────────────

function SourceursSelector({ selected, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
      {ALL_SOURCEURS.map(s => {
        const isSelected = selected.includes(s);
        return (
          <button key={s} type="button"
            onClick={() => {
              if (isSelected) onChange(selected.filter(x => x !== s));
              else onChange([...selected, s]);
            }}
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              fontWeight: isSelected ? 700 : 400,
              background: isSelected ? associeColor(s) : "rgba(255,255,255,0.06)",
              color: isSelected ? "#fff" : "#8aab97",
              border: `1px solid ${isSelected ? associeColor(s) : "rgba(45,158,95,0.2)"}`,
              transition: "all 0.15s", fontFamily: "DM Sans, sans-serif",
            }}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

// ─── Modal Création ───────────────────────────────────────────────────────────

function NewDealModal({ terrains, acheteurs, currentUserEmail, onSave, onClose }) {
  const currentUserName = currentUserEmail?.split("@")[0] ?? "";
  const [form, setForm] = useState({
    terrainId: terrains[0]?.id ?? "", acheteurId: acheteurs[0]?.id ?? "",
    etape: "teaser", montant: "", notes: "",
    sourceurs: currentUserName ? [currentUserName] : [],
    date_contact: "", prochaine_action: "", date_action: "",
  });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.terrainId || !form.acheteurId) { alert("Sélectionnez un terrain et un acheteur"); return; }
    onSave({ ...form, terrainId: parseInt(form.terrainId), acheteurId: parseInt(form.acheteurId), montant: parseFloat(form.montant) || 0 });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#0d3320", border: "1px solid rgba(45,158,95,0.25)", borderRadius: 18, padding: 32, width: "100%", maxWidth: 520, color: "#f8faf9", boxShadow: "0 12px 48px rgba(10,46,26,0.4)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 24, color: "#4eca82" }}>Nouveau Deal</div>

        <label style={labelStyle}>Terrain *</label>
        <select style={inputStyle} value={form.terrainId} onChange={set("terrainId")}>
          {terrains.length === 0 ? <option value="">Aucun terrain</option>
            : terrains.map(t => <option key={t.id} value={t.id}>{t.tf ? `${t.tf} — ${t.localisation}` : t.localisation}</option>)}
        </select>

        <label style={labelStyle}>Acheteur *</label>
        <select style={inputStyle} value={form.acheteurId} onChange={set("acheteurId")}>
          {acheteurs.length === 0 ? <option value="">Aucun acheteur</option>
            : acheteurs.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Etape</label>
            <select style={inputStyle} value={form.etape} onChange={set("etape")}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Forfait (M MAD)</label>
            <input style={inputStyle} type="number" value={form.montant} onChange={set("montant")} placeholder="ex: 45" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Dernier contact</label>
            <input style={inputStyle} type="date" value={form.date_contact} onChange={set("date_contact")} />
          </div>
          <div>
            <label style={labelStyle}>Date prochaine action</label>
            <input style={inputStyle} type="date" value={form.date_action} onChange={set("date_action")} />
          </div>
        </div>

        <label style={labelStyle}>Prochaine action</label>
        <input style={inputStyle} value={form.prochaine_action} onChange={set("prochaine_action")} placeholder="Ex: Envoyer offre, Relancer acheteur..." />

        <label style={labelStyle}>Sourceurs</label>
        <SourceursSelector selected={form.sourceurs} onChange={v => setForm(f => ({ ...f, sourceurs: v }))} />

        <label style={labelStyle}>Notes</label>
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={set("notes")} placeholder="Contexte, conditions particulières..." />

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
          <button style={btnGhost} onClick={onClose}>Annuler</button>
          <button style={btnPrimary} onClick={handleSave}>Créer le deal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Edition ────────────────────────────────────────────────────────────

function EditDealModal({ deal, terrains, acheteurs, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    terrainId: deal.terrainId ?? "", acheteurId: deal.acheteurId ?? "",
    etape: deal.etape ?? "teaser", montant: deal.montant ? String(deal.montant) : "",
    notes: deal.notes ?? "", sourceurs: deal.sourceurs ?? [],
    date_contact: deal.date_contact ?? "", prochaine_action: deal.prochaine_action ?? "", date_action: deal.date_action ?? "",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const stage = STAGE_MAP[form.etape];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#0d3320", border: "1px solid rgba(45,158,95,0.25)", borderRadius: 18, padding: 32, width: "100%", maxWidth: 520, color: "#f8faf9", boxShadow: "0 12px 48px rgba(10,46,26,0.4)", maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, color: "#4eca82" }}>Modifier le Deal</div>
          <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${stage?.color}22`, color: stage?.color, border: `1px solid ${stage?.color}44` }}>{stage?.label}</span>
        </div>

        <label style={labelStyle}>Terrain</label>
        <select style={inputStyle} value={form.terrainId} onChange={set("terrainId")}>
          {terrains.map(t => <option key={t.id} value={t.id}>{t.tf ? `${t.tf} — ${t.localisation}` : t.localisation}</option>)}
        </select>

        <label style={labelStyle}>Acheteur</label>
        <select style={inputStyle} value={form.acheteurId} onChange={set("acheteurId")}>
          {acheteurs.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </select>

        <label style={labelStyle}>Etape</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {STAGES.map(s => (
            <button key={s.id} onClick={() => setForm(f => ({ ...f, etape: s.id }))}
              style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${s.color}`, background: form.etape === s.id ? s.color : "transparent", color: form.etape === s.id ? "#fff" : s.color, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Forfait (M MAD)</label>
            <input style={inputStyle} type="number" value={form.montant} onChange={set("montant")} placeholder="ex: 45" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Dernier contact</label>
            <input style={inputStyle} type="date" value={form.date_contact} onChange={set("date_contact")} />
          </div>
          <div>
            <label style={labelStyle}>Date prochaine action</label>
            <input style={inputStyle} type="date" value={form.date_action} onChange={set("date_action")} />
          </div>
        </div>

        <label style={labelStyle}>Prochaine action</label>
        <input style={inputStyle} value={form.prochaine_action} onChange={set("prochaine_action")} placeholder="Ex: Envoyer offre..." />

        <label style={labelStyle}>Sourceurs</label>
        <SourceursSelector selected={form.sourceurs} onChange={v => setForm(f => ({ ...f, sourceurs: v }))} />

        <label style={labelStyle}>Notes</label>
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={set("notes")} placeholder="Contexte, conditions..." />

        {confirmDelete && (
          <div style={{ background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#e74c3c", marginBottom: 10 }}>Confirmer la suppression ?</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={btnDanger} onClick={onDelete}>Oui, supprimer</button>
              <button style={btnGhost} onClick={() => setConfirmDelete(false)}>Annuler</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          {!confirmDelete ? <button style={btnDanger} onClick={() => setConfirmDelete(true)}>Supprimer</button> : <div />}
          <div style={{ display: "flex", gap: 10 }}>
            <button style={btnGhost} onClick={onClose}>Annuler</button>
            <button style={btnPrimary} onClick={() => onSave({ ...form, id: deal.id, terrainId: parseInt(form.terrainId), acheteurId: parseInt(form.acheteurId), montant: parseFloat(form.montant) || 0 })}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Deal Card ────────────────────────────────────────────────────────────────

function DealCard({ deal, terrain, acheteur, stageColor, onClick, onDragStart }) {
  const tag       = TAG_CLASS[acheteur?.type] ?? TAG_CLASS.Promoteur;
  const sourceurs = deal.sourceurs ?? [];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.96)", borderRadius: 10, padding: 13, marginBottom: 10,
        color: "#071a0f", boxShadow: "0 2px 8px rgba(10,46,26,0.08)",
        cursor: "grab", transition: "all 0.2s",
        borderLeft: `3px solid ${stageColor}`,
        userSelect: "none",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(10,46,26,0.14)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(10,46,26,0.08)"; }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, color: "#0a2e1a", marginBottom: 2 }}>
        {terrain?.localisation ?? "Terrain inconnu"}
      </div>
      {terrain?.tf && <div style={{ fontSize: 10, color: "#888", marginBottom: 3 }}>TF {terrain.tf}</div>}
      <div style={{ fontSize: 11.5, color: "#555", marginBottom: 6 }}>{acheteur?.nom ?? "Acheteur inconnu"}</div>

      {deal.montant > 0 && (
        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 13, fontWeight: 700, color: "#1a5c35", marginBottom: 6 }}>
          {deal.montant} M MAD
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        {deal.date_contact && (
          <span style={{ fontSize: 10, color: "#777", background: "#f0f4f2", padding: "2px 6px", borderRadius: 4 }}>
            Contact : {fmtDate(deal.date_contact)}
          </span>
        )}
        {deal.date_action && (
          <span style={{ fontSize: 10, color: "#9b59b6", background: "#fdf2f8", padding: "2px 6px", borderRadius: 4 }}>
            Action : {fmtDate(deal.date_action)}
          </span>
        )}
      </div>

      {deal.prochaine_action && (
        <div style={{ fontSize: 10.5, color: "#555", fontStyle: "italic", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {deal.prochaine_action}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        {acheteur && (
          <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", background: tag.bg, color: tag.color }}>
            {acheteur.type}
          </span>
        )}
        {sourceurs.length > 0 && (
          <div style={{ display: "flex", gap: 3 }}>
            {sourceurs.map(s => (
              <div key={s} title={s} style={{ width: 22, height: 22, borderRadius: 6, background: associeColor(s), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "#fff" }}>
                {s.slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: "#bbb", textAlign: "right" }}>✎ modifier</div>
    </div>
  );
}

// ─── Pipeline Page ────────────────────────────────────────────────────────────

export default function PipelinePage({ state, dispatch, currentUser }) {
  const [showNew,   setShowNew]   = useState(false);
  const [editDeal,  setEditDeal]  = useState(null);
  const [dragOver,  setDragOver]  = useState(null);
  const dragDeal = useRef(null);

  const { deals, terrains, acheteurs } = state;

  const handleCreate = form => { dispatch({ type: "ADD_DEAL", payload: form }); setShowNew(false); };
  const handleUpdate = form => { dispatch({ type: "UPDATE_DEAL", payload: form }); setEditDeal(null); };
  const handleDelete = id   => { dispatch({ type: "DELETE_DEAL", payload: id });  setEditDeal(null); };

  // ── Drag handlers ────────────────────────────────────────────────────────────
  const onDragStart = (deal) => (e) => {
    dragDeal.current = deal;
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (stageId) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(stageId);
  };

  const onDrop = (stageId) => (e) => {
    e.preventDefault();
    setDragOver(null);
    const deal = dragDeal.current;
    if (!deal || deal.etape === stageId) return;
    dispatch({ type: "UPDATE_DEAL", payload: { ...deal, etape: stageId } });
    dragDeal.current = null;
  };

  const onDragLeave = () => setDragOver(null);
  const onDragEnd   = () => { dragDeal.current = null; setDragOver(null); };

  return (
    <>
      <div style={{
        padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(45,158,95,0.12)",
        background: "rgba(7,26,15,0.6)", backdropFilter: "blur(8px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div>
          <span style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 700, color: "#f8faf9" }}>Pipeline Deals</span>
          <span style={{ marginLeft: 12, fontSize: 12, color: "#8aab97" }}>{deals.length} deal{deals.length > 1 ? "s" : ""}</span>
        </div>
        <button style={btnPrimary} onClick={() => setShowNew(true)}>+ Nouveau Deal</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, padding: "20px 28px", overflowX: "auto" }}>
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.etape === stage.id);
          const isOver     = dragOver === stage.id;

          return (
            <div key={stage.id}
              onDragOver={onDragOver(stage.id)}
              onDrop={onDrop(stage.id)}
              onDragLeave={onDragLeave}
              style={{
                background: isOver ? "rgba(45,158,95,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${isOver ? "rgba(45,158,95,0.5)" : "rgba(45,158,95,0.14)"}`,
                borderRadius: 14, padding: "14px 12px", minHeight: 420,
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", color: stage.color }}>
                {stage.label}
                <span style={{ background: "rgba(45,158,95,0.2)", color: "#4eca82", borderRadius: 20, padding: "2px 8px", fontSize: 11 }}>{stageDeals.length}</span>
              </div>

              {stageDeals.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: isOver ? "rgba(78,202,130,0.5)" : "rgba(255,255,255,0.25)", fontSize: 11, transition: "color 0.15s" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{isOver ? "↓" : "○"}</div>
                  {isOver ? "Déposer ici" : "Aucun deal"}
                </div>
              ) : stageDeals.map(deal => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  terrain={terrains.find(t => t.id === deal.terrainId)}
                  acheteur={acheteurs.find(a => a.id === deal.acheteurId)}
                  stageColor={stage.color}
                  onClick={() => setEditDeal(deal)}
                  onDragStart={onDragStart(deal)}
                  onDragEnd={onDragEnd}
                />
              ))}

              {/* Zone de drop visible quand colonne non vide */}
              {stageDeals.length > 0 && isOver && (
                <div style={{ height: 50, borderRadius: 8, border: "2px dashed rgba(78,202,130,0.4)", background: "rgba(78,202,130,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#4eca82", marginTop: 4 }}>
                  Déposer ici
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showNew && (
        <NewDealModal terrains={terrains} acheteurs={acheteurs} currentUserEmail={currentUser?.email} onSave={handleCreate} onClose={() => setShowNew(false)} />
      )}
      {editDeal && (
        <EditDealModal deal={editDeal} terrains={terrains} acheteurs={acheteurs} onSave={handleUpdate} onDelete={() => handleDelete(editDeal.id)} onClose={() => setEditDeal(null)} />
      )}
    </>
  );
}