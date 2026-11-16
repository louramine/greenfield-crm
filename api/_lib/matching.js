// Choix des terrains à proposer à un promoteur.
// Mêmes règles de score que la page Matching du CRM (fonction prScore de index.html) :
// un terrain bien noté ici est bien noté dans le CRM, et inversement.
import { sbSelect } from './supabase.js'

const POSITIFS = ['infos', 'interesse', 'visite_souhaitee', 'visite_demandee', 'rappel']
const VILLES = [
  'Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Agadir', 'Fès', 'Meknès', 'Kénitra', 'Salé', 'Témara', 'Mohammedia', 'Bouskoura',
  'Dar Bouazza', 'Nouaceur', 'Skhirat', 'Settat', 'Berrechid', 'Benguérir', 'El Jadida', 'Tétouan', 'Oujda', 'Nador', 'Essaouira',
  'Béni Mellal', 'Ouarzazate', 'Laâyoune', 'Dakhla', 'Ifrane', 'Benslimane',
  // Hors Casablanca : sans cette liste, ces terrains seraient proposés aux promoteurs qui cherchent à Casablanca
  'Bouznika', 'Azemmour', 'Sidi Rahal', 'Ain Harrouda',
]
const USAGE_TYPO = {
  Tertiaire: ['Bureaux', 'Commerce'],
  'Résidentiel': ['Social et économique', 'Moyen standing', 'Haut standing', 'Villas et lotissements'],
  'Hôtellerie': ['Hôtellerie et tourisme'],
  'Balnéaire': ['Hôtellerie et tourisme', 'Haut standing', 'Villas et lotissements'],
  Industriel: ['Industriel et logistique'],
  Logistique: ['Industriel et logistique'],
}

const N = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}
const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : [])
const ou = (...xs) => xs.some(Boolean)

export function famille(urba) {
  const s = String(urba ?? '').trim().toUpperCase()
  if (!s) return ''
  if (s[0] === 'R') return 'R'
  return 'ABCDEI'.includes(s[0]) ? s[0] : 'Autre'
}

export function villeDe(t) {
  const q = N(t.quartier ? t.quartier : t.localisation)
  if (!q) return ''
  const hit = VILLES.find((v) => ou(q === N(v), q.startsWith(N(v))))
  return hit ?? 'Casablanca'
}

const quartierDe = (t) => String(t.quartier ? t.quartier : (t.localisation ?? '')).replace(/\s+/g, ' ').trim()
const forfait = (t) => (num(t.superficie) && num(t.prix) ? (t.superficie * t.prix) / 1e6 : null)

function villesDe(a) {
  const v = arr(a.villes)
  if (v.length) return v
  return String(a.zones ?? '').split(',').map((x) => x.trim()).filter(Boolean)
}

// Préférences apprises à partir des réponses déjà données par le promoteur
export function preferences(reponses, terrains) {
  const P = { likeQ: {}, likeZ: {}, refQ: {}, refZ: {}, prixRefus: null }
  const parId = new Map(terrains.map((t) => [String(t.id), t]))
  for (const r of reponses) {
    const t = parId.get(String(r.terrain_id))
    if (!t) continue
    const q = N(quartierDe(t))
    const z = famille(t.urba)
    if (POSITIFS.includes(r.statut)) {
      if (q) P.likeQ[q] = true
      if (z) P.likeZ[z] = true
    } else if (r.statut === 'refuse') {
      if (r.raison_refus === 'Emplacement' && q) P.refQ[q] = true
      if (r.raison_refus === 'Zonage' && z) P.refZ[z] = true
      if (r.raison_refus === 'Prix trop élevé' && num(t.prix)) P.prixRefus = P.prixRefus ? Math.min(P.prixRefus, Number(t.prix)) : Number(t.prix)
    }
  }
  return P
}

export function score(a, t, P) {
  let s = 0
  const ok = []
  const ko = []
  const gagne = (n, motif) => {
    s += n
    ok.push(motif)
  }
  const perd = (n, motif) => {
    s -= n
    ko.push(motif)
  }
  const q = quartierDe(t)
  const qn = N(q)
  const ville = villeDe(t)
  const qs = arr(a.quartiers).map(N)
  const vs = villesDe(a).map(N)
  if (qn && qs.includes(qn)) gagne(35, 'Quartier ciblé')
  else if (ville && vs.includes(N(ville))) gagne(25, 'Ville ciblée')
  else if (!qs.length && !vs.length) s += 12
  else ko.push('Hors zones ciblées')

  const fam = famille(t.urba)
  const zs = arr(a.zonages)
  if (zs.length) {
    if (fam && zs.includes(fam)) gagne(20, 'Zonage recherché')
    else ko.push('Zonage non recherché')
  } else s += 8

  const sup = num(t.superficie)
  const smin = num(a.sup_min)
  const smax = num(a.sup_max)
  if (sup && ou(smin, smax)) {
    const lo = smin ?? 0
    const hi = smax ?? Infinity
    if (sup >= lo && sup <= hi) gagne(15, 'Superficie dans la cible')
    else if (sup >= lo * 0.7 && sup <= hi * 1.3) gagne(7, 'Superficie proche')
    else ko.push('Superficie hors cible')
  } else s += 6

  const f = forfait(t)
  const tmin = num(a.ticket_min)
  const tmax = num(a.ticket_max)
  if (f && ou(tmin, tmax)) {
    const lo = tmin ?? 0
    const hi = tmax ?? Infinity
    if (f >= lo && f <= hi) gagne(12, 'Dans le budget')
    else if (f >= lo * 0.7 && f <= hi * 1.3) gagne(5, 'Budget proche')
    else ko.push('Hors budget')
  } else s += 4

  const pmax = num(a.prix_m2_max)
  const p = num(t.prix)
  if (pmax && p) {
    if (p <= pmax) gagne(8, 'Prix au m² dans la cible')
    else if (p <= pmax * 1.15) s += 3
    else ko.push('Prix au m² élevé')
  } else s += 4

  const ty = arr(a.typologies)
  const conv = USAGE_TYPO[t.usage]
  if (ty.length && conv) {
    if (conv.some((x) => ty.includes(x))) gagne(5, 'Produit compatible')
    else perd(5, 'Usage différent')
  }

  if (qn && P.likeQ[qn]) gagne(10, 'Secteur déjà apprécié')
  if (fam && P.likeZ[fam]) s += 4
  if (qn && P.refQ[qn]) perd(15, 'A refusé ce secteur')
  if (fam && P.refZ[fam]) perd(8, 'A refusé ce zonage')
  if (P.prixRefus && p && p >= P.prixRefus) perd(10, 'Prix au niveau de ses refus')
  if (a.statut === 'Chaud') s += 3
  if (a.statut === 'Client') s += 3
  return { score: Math.max(0, Math.min(99, Math.round(s))), ok, ko }
}

// Nombre de critères de recherche connus dans la fiche du promoteur
export function criteresConnus(a) {
  const zone = villesDe(a).length + arr(a.quartiers).length > 0
  const autres = [
    arr(a.zonages).length > 0,
    arr(a.typologies).length > 0,
    ou(num(a.sup_min), num(a.sup_max)),
    ou(num(a.ticket_min), num(a.ticket_max), num(a.prix_m2_max)),
  ].filter(Boolean).length
  return { zone, autres, total: (zone ? 1 : 0) + autres }
}

// Motifs qui écartent un terrain quel que soit son score : on ne propose jamais hors zone,
// ni un secteur déjà refusé, ni au-dessus d'un budget ou d'un prix déjà annoncés
const ELIMINATOIRES = ['Hors zones ciblées', 'A refusé ce secteur', 'Hors budget', 'Prix au m² élevé', 'Superficie hors cible']

export function statutsProposables() {
  const brut = process.env.PROPOSITION_STATUTS ?? 'Disponible'
  return brut.split(',').map((s) => s.trim()).filter(Boolean)
}

// Renvoie les meilleurs terrains jamais proposés à ce promoteur : [{ terrain, score, ok }]
export async function terrainsPour(acheteur, { max = 3, scoreMin = 55 } = {}) {
  if (!acheteur) return []
  const statuts = statutsProposables()
  const filtre = `statut=in.(${statuts.map((s) => encodeURIComponent(s)).join(',')})`
  const [terrains, reponses] = await Promise.all([
    sbSelect('terrains', `${filtre}&select=id,ref,localisation,quartier,superficie,prix,forfait,urba,usage,statut&limit=2000`),
    sbSelect('acheteur_terrain_reponses', `acheteur_id=eq.${acheteur.id}&limit=1000`).catch(() => []),
  ])
  const deja = new Set(reponses.map((r) => String(r.terrain_id)))
  const connus = reponses.length ? await sbSelect('terrains', `id=in.(${[...deja].join(',')})&select=id,quartier,localisation,urba,prix`).catch(() => []) : []
  const P = preferences(reponses, connus)
  return terrains
    .filter((t) => statuts.includes(t.statut))
    .filter((t) => !deja.has(String(t.id)))
    .filter((t) => num(t.superficie))
    .map((t) => ({ terrain: t, ...score(acheteur, t, P) }))
    .filter((x) => x.score >= scoreMin)
    .filter((x) => !x.ko.some((k) => ELIMINATOIRES.includes(k)))
    .sort((x, y) => y.score - x.score)
    .slice(0, max)
}
