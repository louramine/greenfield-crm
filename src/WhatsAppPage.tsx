// Page WhatsApp du CRM : conversations avec les acheteurs et envoi ciblé des teasers
import { useState, useMemo, useEffect, useRef } from "react"
import { apiWhatsApp } from "./useSupabase"
import { Historique, TerrainsProposes, PreferencesApprises, Badge } from "./WhatsAppFiche"
import { scoreTerrainAcheteur, telAffiche, forfaitM, dateCourte } from "./whatsappUtils"

const C = {
  white: "#f8faf9",
  grayMid: "#8aab97",
  greenLight: "#4eca82",
  dark: "#071a0f",
  panel: "rgba(255,255,255,0.04)",
  bord: "1px solid rgba(45,158,95,0.16)",
}

const btnPrimary: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
  background: "linear-gradient(135deg, #2d9e5f, #4eca82)",
  color: "#071a0f", fontWeight: 600, fontSize: 13, fontFamily: "DM Sans, sans-serif",
}
const champ: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(45,158,95,0.25)",
  background: "rgba(255,255,255,0.06)", color: C.white, fontSize: 13, outline: "none", fontFamily: "DM Sans, sans-serif",
}
const titreBloc: React.CSSProperties = {
  fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: C.grayMid, fontWeight: 600, margin: "4px 0 10px",
}

interface Props {
  state: any
  token?: string
  onRefresh: () => Promise<void>
}

export default function WhatsAppPage({ state, token, onRefresh }: Props) {
  const [onglet, setOnglet] = useState("conversations")

  // Rafraîchissement automatique des conversations
  useEffect(() => {
    const t = setInterval(() => { onRefresh().catch(() => null) }, 20000)
    return () => clearInterval(t)
  }, [onRefresh])

  const tablesAbsentes = state.waMessages.length === 0 && state.waReponses.length === 0

  return (
    <>
      <div style={{ padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(45,158,95,0.12)", background: "rgba(7,26,15,0.6)", position: "sticky", top: 0, zIndex: 50, flexWrap: "wrap", gap: 10 }}>
        <div>
          <span style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, color: C.white }}>WhatsApp</span>
          <span style={{ marginLeft: 10, fontSize: 12, color: C.grayMid }}>Teasers, réponses et préférences des acheteurs</span>
        </div>
        <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.05)", padding: 4, borderRadius: 10 }}>
          {[["conversations", "Conversations"], ["envoi", "Envoyer un teaser"]].map(([id, label]) => (
            <button key={id} onClick={() => setOnglet(id)} style={{
              padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12.5, fontFamily: "DM Sans, sans-serif",
              background: onglet === id ? "rgba(45,158,95,0.3)" : "transparent", color: onglet === id ? C.greenLight : C.grayMid, fontWeight: onglet === id ? 600 : 400,
            }}>{label}</button>
          ))}
        </div>
      </div>
      {tablesAbsentes && (
        <div style={{ margin: "14px 28px 0", padding: "10px 14px", borderRadius: 10, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.35)", fontSize: 12.5, color: "#f0d080" }}>
          Aucun échange pour l'instant. Si c'est la première utilisation, vérifiez que le script supabase/migrations/20261029_whatsapp.sql a bien été exécuté dans Supabase.
        </div>
      )}
      {onglet === "conversations"
        ? <Conversations state={state} token={token} onRefresh={onRefresh} />
        : <EnvoiTeaser state={state} token={token} onRefresh={onRefresh} />}
    </>
  )
}

// ─── Conversations ──────────────────────────────────────────────────────────

function Conversations({ state, token, onRefresh }: Props) {
  const { acheteurs, terrains, waMessages, waReponses } = state
  const [selection, setSelection] = useState<number>(0)
  const [recherche, setRecherche] = useState("")
  const [texte, setTexte] = useState("")
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState("")
  const finRef = useRef<HTMLDivElement>(null)

  const fils = useMemo(() => {
    const parAcheteur: Record<number, any[]> = {}
    for (const m of waMessages) {
      if (!m.acheteur_id) continue
      if (!parAcheteur[m.acheteur_id]) parAcheteur[m.acheteur_id] = []
      parAcheteur[m.acheteur_id].push(m)
    }
    const q = recherche.toLowerCase().trim()
    return acheteurs
      .filter((a: any) => parAcheteur[a.id])
      .filter((a: any) => !q ? true : `${a.nom} ${a.contact} ${a.telephone}`.toLowerCase().includes(q))
      .map((a: any) => {
        const msgs = parAcheteur[a.id].sort((x, y) => x.id - y.id)
        const dernier = msgs[msgs.length - 1]
        const dernierEntrant = [...msgs].reverse().find(m => m.direction === "entrant")
        const aTraiter = dernier.direction === "entrant"
        return { a, msgs, dernier, dernierEntrant, aTraiter }
      })
      .sort((x: any, y: any) => y.dernier.id - x.dernier.id)
  }, [acheteurs, waMessages, recherche])

  const courant = fils.find((f: any) => f.a.id === selection) ?? fils[0]

  useEffect(() => { finRef.current?.scrollIntoView({ block: "end" }) }, [courant?.msgs.length, courant?.a.id])

  // Fenêtre de 24h ouverte par le dernier message du contact
  const fenetreOuverte = courant?.dernierEntrant
    ? Date.now() - new Date(courant.dernierEntrant.created_at).getTime() < 24 * 3600 * 1000
    : false

  const envoyer = async () => {
    if (!texte.trim() ? true : !courant) return
    setEnvoi(true)
    setErreur("")
    try {
      await apiWhatsApp("send", { acheteur_id: courant.a.id, texte }, token)
      setTexte("")
      await onRefresh()
    } catch (e: any) {
      setErreur(e.message)
    } finally {
      setEnvoi(false)
    }
  }

  if (!fils.length) {
    return (
      <div style={{ padding: "60px 28px", textAlign: "center", color: C.grayMid }}>
        <div style={{ fontSize: 30, marginBottom: 10, color: C.greenLight }}>✆</div>
        <div style={{ fontSize: 14 }}>Aucune conversation pour l'instant.</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>Envoyez un premier teaser depuis l'onglet « Envoyer un teaser ».</div>
      </div>
    )
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) minmax(0, 1fr) minmax(240px, 300px)", gap: 14, padding: "16px 28px", height: "calc(100vh - 130px)" }}>
      {/* Liste */}
      <div style={{ background: C.panel, border: C.bord, borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: 10 }}>
          <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher un acheteur..." style={champ} />
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {fils.map((f: any) => {
            const actif = courant?.a.id === f.a.id
            return (
              <div key={f.a.id} onClick={() => setSelection(f.a.id)} style={{
                padding: "10px 12px", cursor: "pointer", borderTop: "1px solid rgba(45,158,95,0.08)",
                background: actif ? "rgba(45,158,95,0.18)" : "transparent",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: C.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.a.nom}</span>
                  <span style={{ fontSize: 10, color: C.grayMid, whiteSpace: "nowrap" }}>{dateCourte(f.dernier.created_at)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 3, alignItems: "center" }}>
                  <span style={{ fontSize: 11.5, color: C.grayMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.dernier.direction === "sortant" ? "Vous : " : ""}{String(f.dernier.contenu).split("\n")[0]}
                  </span>
                  {f.aTraiter && <span style={{ width: 8, height: 8, borderRadius: 4, background: C.greenLight, flexShrink: 0 }} title="Dernier message du contact" />}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fil */}
      <div style={{ background: "rgba(232,247,239,0.06)", border: C.bord, borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: C.bord }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.white }}>{courant.a.nom}{courant.a.contact ? ` · ${courant.a.contact}` : ""}</div>
          <div style={{ fontSize: 11.5, color: C.grayMid, marginTop: 2 }}>
            {telAffiche(courant.a.telephone)}
            {courant.a.whatsapp_stop && <span style={{ color: "#e57373" }}> · Désinscrit (STOP)</span>}
            {courant.a.source === "WhatsApp" && <span> · Fiche créée par WhatsApp, à qualifier</span>}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          <Historique messages={courant.msgs} />
          <div ref={finRef} />
        </div>
        <div style={{ padding: 12, borderTop: C.bord }}>
          {!fenetreOuverte && (
            <div style={{ fontSize: 11.5, color: "#f0d080", marginBottom: 8 }}>
              Plus de 24h sans message de ce contact : WhatsApp n'acceptera qu'un nouveau teaser, pas un message libre.
            </div>
          )}
          {erreur && <div style={{ fontSize: 12, color: "#e74c3c", marginBottom: 8 }}>{erreur}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <textarea value={texte} onChange={e => setTexte(e.target.value)} placeholder="Répondre en tant que conseiller..." rows={2}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer() } }}
              style={{ ...champ, resize: "none" }} disabled={courant.a.whatsapp_stop} />
            <button style={{ ...btnPrimary, opacity: envoi ? 0.6 : 1 }} onClick={envoyer} disabled={envoi}>Envoyer</button>
          </div>
          <div style={{ fontSize: 10.5, color: C.grayMid, marginTop: 6 }}>Quand un conseiller répond, le bot cesse ses réponses automatiques aux messages libres pendant 24h.</div>
        </div>
      </div>

      {/* Fiche */}
      <div style={{ background: C.panel, border: C.bord, borderRadius: 14, padding: 14, overflowY: "auto", color: C.white }}>
        <div style={titreBloc}>Terrains proposés</div>
        <TerrainsProposes acheteurId={courant.a.id} reponses={waReponses} terrains={terrains} />
        <div style={{ ...titreBloc, marginTop: 18 }}>Préférences apprises</div>
        <PreferencesApprises acheteurId={courant.a.id} reponses={waReponses} terrains={terrains} />
        <div style={{ ...titreBloc, marginTop: 18 }}>Critères de la fiche</div>
        <div style={{ fontSize: 12, lineHeight: 1.7 }}>
          <div><span style={{ color: C.grayMid }}>Zones : </span>{courant.a.zones ? courant.a.zones : "non renseignées"}</div>
          <div><span style={{ color: C.grayMid }}>Budget : </span>{courant.a.ticketMin ? courant.a.ticketMin : "?"} à {courant.a.ticketMax ? courant.a.ticketMax : "?"} M MAD</div>
          <div><span style={{ color: C.grayMid }}>Zonages : </span>{(courant.a.urbas_cibles ?? []).length ? courant.a.urbas_cibles.join(", ") : "non renseignés"}</div>
        </div>
        <div style={{ fontSize: 11, color: C.grayMid, marginTop: 10 }}>Pour modifier les critères, ouvrez la fiche dans Acheteurs.</div>
      </div>
    </div>
  )
}

// ─── Envoi ciblé d'un teaser ────────────────────────────────────────────────

function EnvoiTeaser({ state, token, onRefresh }: Props) {
  const { acheteurs, terrains, waReponses } = state
  const [terrainId, setTerrainId] = useState<number>(0)
  const [filtreTerrain, setFiltreTerrain] = useState("")
  const [pdf, setPdf] = useState("")
  const [coches, setCoches] = useState<number[]>([])
  const [envoi, setEnvoi] = useState(false)
  const [resultat, setResultat] = useState<any>(null)
  const [erreur, setErreur] = useState("")

  const terrain = terrains.find((t: any) => t.id === terrainId)

  const terrainsFiltres = useMemo(() => {
    const q = filtreTerrain.toLowerCase().trim()
    return terrains
      .filter((t: any) => !q ? true : `gf-${t.id} ${t.localisation} ${t.quartier} ${t.urba}`.toLowerCase().includes(q))
      .slice(0, 300)
  }, [terrains, filtreTerrain])

  const candidats = useMemo(() => {
    if (!terrain) return []
    return acheteurs
      .map((a: any) => ({ a, ...scoreTerrainAcheteur(terrain, a, waReponses, terrains) }))
      .sort((x: any, y: any) => y.score - x.score)
  }, [terrain, acheteurs, waReponses, terrains])

  const joignable = (c: any) => c.a.telephone && !c.a.whatsapp_stop

  // Pré-sélection : bons scores, joignables, jamais sollicités pour ce terrain
  useEffect(() => {
    setCoches(candidats.filter((c: any) => joignable(c) && c.score >= 50 && !c.deja).map((c: any) => c.a.id))
    setResultat(null)
  }, [candidats])

  const basculer = (id: number) => setCoches(cs => cs.includes(id) ? cs.filter(x => x !== id) : [...cs, id])

  const envoyer = async () => {
    if (!terrain ? true : !coches.length) return
    if (!confirm(`Envoyer le teaser GF-${terrain.id} à ${coches.length} acheteur(s) sur WhatsApp ?`)) return
    setEnvoi(true)
    setErreur("")
    try {
      const r = await apiWhatsApp("teaser", { terrain_id: terrain.id, acheteur_ids: coches, pdf_url: pdf.trim() ? pdf.trim() : undefined }, token)
      setResultat(r)
      await onRefresh()
    } catch (e: any) {
      setErreur(e.message)
    } finally {
      setEnvoi(false)
    }
  }

  const sansTel = acheteurs.filter((a: any) => !a.telephone).length

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) minmax(0, 1fr)", gap: 14, padding: "16px 28px" }}>
      <div style={{ background: C.panel, border: C.bord, borderRadius: 14, padding: 14, alignSelf: "start" }}>
        <div style={titreBloc}>1. Terrain</div>
        <input value={filtreTerrain} onChange={e => setFiltreTerrain(e.target.value)} placeholder="Filtrer : quartier, zonage, GF-..." style={{ ...champ, marginBottom: 8 }} />
        <select value={terrainId} onChange={e => setTerrainId(Number(e.target.value))} style={{ ...champ, marginBottom: 12 }} size={8}>
          {terrainsFiltres.map((t: any) => (
            <option key={t.id} value={t.id} style={{ background: "#0d3320" }}>
              GF-{t.id} {t.quartier ? t.quartier : t.localisation} · {t.urba ? t.urba : "NC"} · {Number(t.superficie ?? 0).toLocaleString("fr-FR")} m²
            </option>
          ))}
        </select>
        {terrain && (
          <div style={{ fontSize: 12, lineHeight: 1.7, color: C.white, background: "rgba(45,158,95,0.1)", borderRadius: 9, padding: "8px 10px", marginBottom: 12 }}>
            <div style={{ fontWeight: 700 }}>GF-{terrain.id} {terrain.quartier ? terrain.quartier : terrain.localisation}</div>
            <div>{terrain.urba ? terrain.urba : "NC"} · {Number(terrain.superficie ?? 0).toLocaleString("fr-FR")} m²</div>
            <div>{terrain.prix ? `${Number(terrain.prix).toLocaleString("fr-FR")} MAD/m² · ` : ""}{forfaitM(terrain)} M MAD</div>
          </div>
        )}
        <div style={titreBloc}>2. PDF du teaser (facultatif)</div>
        <input value={pdf} onChange={e => setPdf(e.target.value)} placeholder="Lien public vers le PDF" style={{ ...champ, marginBottom: 6 }} />
        <div style={{ fontSize: 11, color: C.grayMid, marginBottom: 14 }}>Nécessite le modèle Meta « greenfield_teaser_pdf ».</div>
        <button style={{ ...btnPrimary, width: "100%", opacity: (!terrain ? true : !coches.length) ? 0.5 : (envoi ? 0.6 : 1) }} onClick={envoyer} disabled={envoi}>
          {envoi ? "Envoi en cours..." : `Envoyer à ${coches.length} acheteur(s)`}
        </button>
        {erreur && <div style={{ fontSize: 12, color: "#e74c3c", marginTop: 10 }}>{erreur}</div>}
        {resultat && (
          <div style={{ fontSize: 12, marginTop: 12, color: C.white }}>
            <div style={{ color: C.greenLight, fontWeight: 600, marginBottom: 6 }}>{resultat.envoyes} teaser(s) envoyé(s)</div>
            {resultat.resultats.filter((r: any) => !r.ok).map((r: any) => (
              <div key={r.acheteur_id} style={{ color: "#e57373" }}>{r.nom ? r.nom : r.acheteur_id} : {r.raison}</div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: "rgba(255,255,255,0.97)", borderRadius: 14, overflow: "hidden", color: C.dark, alignSelf: "start" }}>
        <div style={{ padding: "12px 16px", fontSize: 12.5, color: "#5f7a6b", borderBottom: "1px solid #e8f0ec" }}>
          {terrain
            ? <>Acheteurs classés par pertinence (critères de la fiche et réponses passées). {sansTel > 0 && <span>{sansTel} acheteur(s) sans numéro WhatsApp ne peuvent pas être sollicités.</span>}</>
            : "Choisissez un terrain pour voir les acheteurs à solliciter."}
        </div>
        {terrain && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["", "Acheteur", "Pertinence", "Pourquoi", "Déjà sollicité"].map(h => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, color: C.grayMid, textTransform: "uppercase", letterSpacing: "0.07em", background: "#f7faf8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidats.map((c: any) => {
                const ok = joignable(c)
                return (
                  <tr key={c.a.id} style={{ borderTop: "1px solid #f0f4f2", opacity: ok ? 1 : 0.45 }}>
                    <td style={{ padding: "8px 12px" }}>
                      <input type="checkbox" disabled={!ok} checked={coches.includes(c.a.id)} onChange={() => basculer(c.a.id)} />
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12.5 }}>
                      <div style={{ fontWeight: 600 }}>{c.a.nom}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{c.a.whatsapp_stop ? "Désinscrit (STOP)" : (c.a.telephone ? telAffiche(c.a.telephone) : "Pas de numéro")}</div>
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: c.score >= 50 ? "#1a5c35" : (c.score >= 25 ? "#c9a84c" : "#999") }}>{c.score}</span>
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 11.5, color: "#555" }}>{c.raisons.length ? c.raisons.join(", ") : "Aucun critère commun"}</td>
                    <td style={{ padding: "8px 12px" }}>{c.deja ? <Badge statut={c.deja.statut} /> : <span style={{ fontSize: 11, color: "#aaa" }}>Non</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
