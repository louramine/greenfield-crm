// Blocs d'affichage WhatsApp réutilisés dans la page WhatsApp et la fiche acheteur
import { statutInfo, preferencesApprises, forfaitM, dateCourte } from "./whatsappUtils"

const C = {
  dark: "#071a0f",
  grayMid: "#8aab97",
  greenLight: "#4eca82",
  greenDeep: "#0a2e1a",
}

export function Badge({ statut }: { statut: string }) {
  const s = statutInfo(statut)
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  )
}

export function Historique({ messages, hauteur }: { messages: any[], hauteur?: number }) {
  if (!messages.length) {
    return <div style={{ color: C.grayMid, fontSize: 12, padding: "24px 0", textAlign: "center" }}>Aucun échange WhatsApp pour le moment.</div>
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: hauteur, overflowY: hauteur ? "auto" : "visible", padding: "4px 2px" }}>
      {messages.map(m => {
        const sortant = m.direction === "sortant"
        const echec = String(m.action ?? "").startsWith("Non délivré")
        return (
          <div key={m.id} style={{ alignSelf: sortant ? "flex-end" : "flex-start", maxWidth: "78%" }}>
            <div style={{
              background: sortant ? "#d9f7e6" : "#ffffff",
              color: C.dark, borderRadius: sortant ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              padding: "8px 11px", fontSize: 12.5, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word",
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              border: echec ? "1px solid #e74c3c" : "none",
            }}>
              {m.contenu}
            </div>
            <div style={{ fontSize: 10, color: C.grayMid, marginTop: 3, textAlign: sortant ? "right" : "left" }}>
              {sortant ? (m.auteur === "bot" ? "Bot" : m.auteur) : m.auteur} · {dateCourte(m.created_at)}
              {echec && <span style={{ color: "#e74c3c" }}> · {m.action}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TerrainsProposes({ acheteurId, reponses, terrains }: { acheteurId: number, reponses: any[], terrains: any[] }) {
  const siennes = reponses
    .filter(r => r.acheteur_id === acheteurId)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
  if (!siennes.length) return <div style={{ color: C.grayMid, fontSize: 12 }}>Aucun terrain proposé via WhatsApp.</div>
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {siennes.map(r => {
        const t = terrains.find(x => x.id === r.terrain_id)
        return (
          <div key={r.id} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(45,158,95,0.15)", borderRadius: 9, padding: "8px 10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>GF-{r.terrain_id} {t ? (t.quartier ? t.quartier : t.localisation) : ""}</span>
              <Badge statut={r.statut} />
            </div>
            <div style={{ fontSize: 11, color: C.grayMid, marginTop: 3 }}>
              {t ? `${t.urba ? t.urba : "NC"} · ${Number(t.superficie ?? 0).toLocaleString("fr-FR")} m² · ${forfaitM(t)} M MAD` : "Terrain supprimé du CRM"}
            </div>
            {r.raison_refus && <div style={{ fontSize: 11, color: "#e57373", marginTop: 3 }}>Raison : {r.raison_refus}</div>}
            {r.creneau_visite && <div style={{ fontSize: 11, color: "#ce93d8", marginTop: 3 }}>Créneau : {r.creneau_visite}</div>}
          </div>
        )
      })}
    </div>
  )
}

export function PreferencesApprises({ acheteurId, reponses, terrains, onAppliquer }: { acheteurId: number, reponses: any[], terrains: any[], onAppliquer?: (p: any) => void }) {
  const p = preferencesApprises(acheteurId, reponses, terrains)
  if (!p.nbProposes) return <div style={{ color: C.grayMid, fontSize: 12 }}>Les préférences se construisent à partir des réponses aux teasers.</div>
  const ligne = (titre: string, valeur: any) => (
    <div style={{ display: "flex", gap: 8, fontSize: 12, marginBottom: 5 }}>
      <span style={{ color: C.grayMid, minWidth: 118 }}>{titre}</span>
      <span>{valeur}</span>
    </div>
  )
  const rien = <span style={{ color: C.grayMid }}>pas encore</span>
  return (
    <div>
      {ligne("Réponses", `${p.nbPositifs} positive(s), ${p.nbRefus} refus sur ${p.nbProposes} terrain(s)`)}
      {ligne("Secteurs appréciés", p.zonesAimees.length ? p.zonesAimees.join(", ") : rien)}
      {ligne("Zonages appréciés", p.urbasAimes.length ? p.urbasAimes.join(", ") : rien)}
      {ligne("Budget constaté", p.budgetMin !== null ? `${p.budgetMin} à ${p.budgetMax} M MAD` : rien)}
      {ligne("Motifs de refus", p.raisonsRefus.length ? p.raisonsRefus.map(([r, n]) => `${r} (${n})`).join(", ") : rien)}
      {onAppliquer && p.nbPositifs > 0 && (
        <button type="button" onClick={() => onAppliquer(p)} style={{
          marginTop: 6, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12,
          background: "rgba(45,158,95,0.15)", color: C.greenLight, border: "1px solid rgba(45,158,95,0.35)",
        }}>
          Ajouter ces préférences aux critères de la fiche
        </button>
      )}
    </div>
  )
}
