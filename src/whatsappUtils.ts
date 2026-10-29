// Outils partagés pour l'intégration WhatsApp du CRM

export function normaliserTel(t: any): string {
  let n = String(t ?? "").replace(/\D/g, "")
  if (n.startsWith("00")) n = n.slice(2)
  if (n.length === 10 && n.startsWith("0")) n = "212" + n.slice(1)
  return n
}

export function telAffiche(t: any): string {
  const n = normaliserTel(t)
  if (!n) return ""
  if (n.startsWith("212") && n.length === 12) return `+212 ${n.slice(3, 4)} ${n.slice(4, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)} ${n.slice(10)}`
  return `+${n}`
}

export const STATUTS: Record<string, { label: string, bg: string, color: string, rang: number }> = {
  envoye:           { label: "Teaser envoyé",    bg: "#eef2f0", color: "#5f7a6b", rang: 1 },
  infos:            { label: "A demandé des infos", bg: "#e3f2fd", color: "#1565c0", rang: 2 },
  interesse:        { label: "Intéressé",        bg: "#e0f7ec", color: "#1a5c35", rang: 3 },
  rappel:           { label: "Veut être rappelé", bg: "#fff3e0", color: "#e65100", rang: 4 },
  visite_souhaitee: { label: "Visite souhaitée", bg: "#fff3e0", color: "#e65100", rang: 4 },
  visite_demandee:  { label: "Visite demandée",  bg: "#fdf2f8", color: "#8e44ad", rang: 5 },
  refuse:           { label: "Pas intéressé",    bg: "#fdecea", color: "#c0392b", rang: 0 },
}

export function statutInfo(s: string) {
  return STATUTS[s] ?? { label: s, bg: "#f5f5f5", color: "#666", rang: 0 }
}

export function forfaitM(t: any): number {
  if (t?.forfait) return Number(t.forfait)
  if (t?.superficie && t?.prix) return Math.round(t.superficie * t.prix / 1_000_000)
  return 0
}

function lieu(t: any): string {
  return String(t?.quartier ? t.quartier : (t?.localisation ?? "")).trim()
}

function compter(liste: string[]) {
  const c: Record<string, number> = {}
  for (const v of liste) if (v) c[v] = (c[v] ?? 0) + 1
  return Object.entries(c).sort((a, b) => b[1] - a[1])
}

// Préférences déduites des réponses WhatsApp d'un acheteur
export function preferencesApprises(acheteurId: number, reponses: any[], terrains: any[]) {
  const siennes = reponses.filter(r => r.acheteur_id === acheteurId)
  const terrainDe = (r: any) => terrains.find(t => t.id === r.terrain_id)
  const positifs = siennes.filter(r => statutInfo(r.statut).rang >= 3).map(terrainDe).filter(Boolean)
  const refus = siennes.filter(r => r.statut === "refuse")
  const budgets = positifs.map(forfaitM).filter(v => v > 0)
  return {
    nbProposes: siennes.length,
    nbPositifs: positifs.length,
    nbRefus: refus.length,
    zonesAimees: compter(positifs.map(lieu)).map(([k]) => k),
    urbasAimes: compter(positifs.map(t => String(t.urba ?? "").trim().toUpperCase())).map(([k]) => k),
    budgetMin: budgets.length ? Math.min(...budgets) : null,
    budgetMax: budgets.length ? Math.max(...budgets) : null,
    raisonsRefus: compter(refus.map(r => r.raison_refus ?? "Sans raison")),
    zonesRefusees: refus.filter(r => r.raison_refus === "Localisation").map(r => lieu(terrainDe(r))).filter(Boolean),
  }
}

// Score de pertinence d'un terrain pour un acheteur (critères de la fiche + réponses passées)
export function scoreTerrainAcheteur(terrain: any, acheteur: any, reponses: any[], terrains: any[]) {
  const raisons: string[] = []
  let score = 0
  const f = forfaitM(terrain)
  const min = parseFloat(acheteur.ticketMin) ? parseFloat(acheteur.ticketMin) : 0
  const max = parseFloat(acheteur.ticketMax) ? parseFloat(acheteur.ticketMax) : Infinity
  if (f > 0 && f >= min && f <= max && (min > 0 ? true : max < Infinity)) {
    score += 35
    raisons.push("Budget")
  }
  const urba = String(terrain.urba ?? "").trim().toUpperCase()
  const urbas = (acheteur.urbas_cibles ?? []).map((u: string) => u.toUpperCase())
  if (urba && urbas.includes(urba)) {
    score += 30
    raisons.push("Zonage ciblé")
  }
  const l = lieu(terrain).toLowerCase()
  const zones = String(acheteur.zones ?? "").toLowerCase()
  if (l && zones && zones.split(",").some((z: string) => z.trim() && (l.includes(z.trim()) ? true : z.includes(l)))) {
    score += 25
    raisons.push("Zone d'intérêt")
  }
  const p = preferencesApprises(acheteur.id, reponses, terrains)
  if (p.zonesAimees.some(z => z.toLowerCase() === l)) {
    score += 15
    raisons.push("A déjà aimé ce secteur")
  }
  if (p.urbasAimes.includes(urba)) {
    score += 10
    raisons.push("A déjà aimé ce zonage")
  }
  if (p.zonesRefusees.some(z => z.toLowerCase() === l)) {
    score -= 30
    raisons.push("A refusé ce secteur")
  }
  if (p.raisonsRefus.some(([r]) => r === "Prix trop élevé") && p.budgetMax && f > p.budgetMax) {
    score -= 15
    raisons.push("Prix au-dessus de ses intérêts passés")
  }
  const deja = reponses.find(r => r.acheteur_id === acheteur.id && r.terrain_id === terrain.id)
  return { score: Math.max(0, Math.min(100, score)), raisons, deja }
}

export function dateCourte(iso: string) {
  if (!iso) return ""
  const d = new Date(iso)
  const auj = new Date()
  if (d.toDateString() === auj.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}
