// Mise en forme des terrains du CRM pour WhatsApp
const nf = new Intl.NumberFormat('fr-FR')

export function refTerrain(t) {
  return `GF-${t.id}`
}

export function lieuTerrain(t) {
  return t.quartier ? t.quartier : (t.localisation ? t.localisation : 'Casablanca')
}

export function fmtSurface(m2) {
  const v = Number(m2 ?? 0)
  if (v >= 10000) return `${nf.format(v)} m² (${nf.format(Math.round(v / 1000) / 10)} ha)`
  return `${nf.format(v)} m²`
}

// Prix global en M MAD (colonne forfait du CRM, sinon superficie x prix)
export function prixGlobalM(t) {
  if (t.forfait) return Number(t.forfait)
  if (t.superficie && t.prix) return Math.round((t.superficie * t.prix) / 100000) / 10
  return null
}

export function fmtPrix(t) {
  if (!t.prix) return 'sur demande'
  const g = prixGlobalM(t)
  return `${nf.format(t.prix)} MAD/m²${g ? ` (${nf.format(g)} M MAD)` : ''}`
}

export function titreTerrain(t) {
  return `${refTerrain(t)} ${lieuTerrain(t)} (${t.urba ? t.urba : 'NC'})`
}

export function estVendu(t) {
  return String(t.statut ?? '').toLowerCase().includes('vendu')
}

export function ficheTerrain(t) {
  return [
    `*${refTerrain(t)} ${lieuTerrain(t)}*`,
    '',
    `Superficie : ${fmtSurface(t.superficie)}`,
    `Zonage : ${t.urba ? t.urba : 'NC'}`,
    `Prix : ${fmtPrix(t)}`,
    '',
    'Le titre foncier, la note de renseignement et la localisation exacte sont communiqués après signature d\'un accord de confidentialité (NDA).',
  ].join('\n')
}
