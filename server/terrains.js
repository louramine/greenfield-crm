// Mise en forme des terrains du CRM pour WhatsApp
const nf = new Intl.NumberFormat('fr-FR')
const esp = (s) => s.replace(/ /g, ' ').replace(/ /g, ' ')

export function refTerrain(t) {
  return t?.ref ? t.ref : `N° ${t?.id}`
}

export function lieuTerrain(t) {
  return t?.quartier ? t.quartier : (t?.localisation ? t.localisation : 'Casablanca')
}

export function fmtSurface(m2) {
  const v = Number(m2 ?? 0)
  if (!v) return 'superficie à confirmer'
  if (v >= 10000) return esp(`${nf.format(v)} m² (${nf.format(Math.round(v / 1000) / 10)} ha)`)
  return esp(`${nf.format(v)} m²`)
}

// Prix global en M DH (colonne forfait du CRM, sinon superficie x prix)
export function prixGlobalM(t) {
  if (t.forfait) return Number(t.forfait)
  if (t.superficie && t.prix) return Math.round((t.superficie * t.prix) / 100000) / 10
  return null
}

export function fmtPrix(t) {
  if (!t.prix) return 'sur demande'
  const g = prixGlobalM(t)
  return esp(`${nf.format(t.prix)} DH/m²${g ? ` (${nf.format(g)} M DH)` : ''}`)
}

export function titreTerrain(t) {
  return `${refTerrain(t)} ${lieuTerrain(t)} (${t.urba ? t.urba : 'zonage NC'})`
}

export function estVendu(t) {
  return String(t?.statut ?? '').toLowerCase().includes('vendu')
}

export function ficheTerrain(t) {
  return [
    `*${refTerrain(t)} ${lieuTerrain(t)}*`,
    '',
    `Superficie : ${fmtSurface(t.superficie)}`,
    `Zonage : ${t.urba ? t.urba : 'NC'}`,
    `Prix : ${fmtPrix(t)}`,
    '',
    'Le titre foncier, la note de renseignement et la localisation exacte sont communiqués après signature d\'un accord de confidentialité.',
  ].join('\n')
}

// Repère une référence de terrain citée dans un message : GF-26-0123 ou GF26-123
export function refCitee(texte) {
  const m = String(texte ?? '').toUpperCase().match(/GF-?(\d{2})-(\d{1,5})\b/)
  if (m) return `GF-${m[1]}-${m[2].padStart(4, '0')}`
  return null
}
