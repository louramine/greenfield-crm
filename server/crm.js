// Lecture et écriture des données du CRM utilisées par le chatbot WhatsApp
import { sbSelect, sbInsert, sbInsertUnique, sbPatch, sbUpsert } from './supabase.js'

// Format international sans "+" : 212661234567 (même règle que la page Promoteurs du CRM)
export function normaliserTel(t) {
  let n = String(t ?? '').replace(/\D/g, '')
  if (n.startsWith('00')) n = n.slice(2)
  if (n.length === 10 && n.startsWith('0')) n = '212' + n.slice(1)
  if (n.length === 9 && ['5', '6', '7'].includes(n[0])) n = '212' + n
  return n
}

const maintenant = () => new Date().toISOString()

// ----- Promoteurs et acheteurs -----
export async function acheteurParTel(tel) {
  const n = normaliserTel(tel)
  if (!n) return null
  const rows = await sbSelect('acheteurs', `telephone=eq.${n}&limit=1`)
  return rows[0] ?? null
}

export async function acheteurParId(id) {
  if (id == null) return null
  const rows = await sbSelect('acheteurs', `id=eq.${id}&limit=1`)
  return rows[0] ?? null
}

export async function creerAcheteur(champs) {
  const [cree] = await sbInsert('acheteurs', {
    type: 'Promoteur',
    statut: 'À qualifier',
    usage: 'Tous',
    villes: [],
    zones: '',
    score: 0,
    source: 'WhatsApp',
    whatsapp_consentement: 'À confirmer',
    ...champs,
    telephone: normaliserTel(champs.telephone),
  })
  return cree
}

export async function majAcheteur(id, champs) {
  if (id == null) return
  if (!Object.keys(champs).length) return
  await sbPatch('acheteurs', `id=eq.${id}`, champs)
}

// ----- Terrains -----
export async function getTerrain(id) {
  if (!/^\d+$/.test(String(id ?? ''))) return null
  const rows = await sbSelect('terrains', `id=eq.${id}&limit=1`)
  return rows[0] ?? null
}

export async function terrainParRef(ref) {
  const rows = await sbSelect('terrains', `ref=eq.${encodeURIComponent(String(ref).toUpperCase())}&limit=1`)
  return rows[0] ?? null
}

export async function creerTerrain(champs) {
  const [cree] = await sbInsert('terrains', {
    statut: 'À qualifier',
    statut_juridique: 'Non renseigné',
    sourceur: 'WhatsApp',
    date_sourcing: new Date().toLocaleDateString('fr-FR'),
    ...champs,
  })
  return cree
}

export async function majTerrain(id, champs) {
  if (id == null) return
  if (!Object.keys(champs).length) return
  await sbPatch('terrains', `id=eq.${id}`, champs)
}

export async function documentTerrain(terrainId, type) {
  const rows = await sbSelect('terrain_documents', `terrain_id=eq.${terrainId}&type=eq.${type}&limit=1`).catch(() => [])
  return rows[0] ?? null
}

export async function ajouterDocumentTerrain(row) {
  return sbUpsert('terrain_documents', row, 'terrain_id,type')
}

// ----- Historique des messages -----
// Renvoie la ligne créée, ou null si ce message WhatsApp est déjà enregistré (webhook rejoué)
export async function enregistrerMessage(m) {
  try {
    const ligne = { ...m, telephone: normaliserTel(m.telephone) }
    const res = ligne.wa_message_id
      ? await sbInsertUnique('whatsapp_messages', ligne, 'wa_message_id')
      : await sbInsert('whatsapp_messages', ligne)
    return res?.[0] ?? null
  } catch (e) {
    console.error('Historique WhatsApp non enregistré', e.message)
    return null
  }
}

export async function majMessage(id, champs) {
  await sbPatch('whatsapp_messages', `id=eq.${id}`, champs)
}

export async function messageParWaId(waId) {
  if (!waId) return null
  const rows = await sbSelect('whatsapp_messages', `wa_message_id=eq.${encodeURIComponent(waId)}&limit=1`)
  return rows[0] ?? null
}

export async function messagesDe(tel, limite = 60) {
  const rows = await sbSelect('whatsapp_messages', `telephone=eq.${normaliserTel(tel)}&order=id.desc&limit=${limite}`)
  return rows.reverse()
}

export async function dernierEntrantId(tel) {
  const [m] = await sbSelect('whatsapp_messages', `telephone=eq.${normaliserTel(tel)}&direction=eq.entrant&order=id.desc&limit=1`)
  return m?.id ?? null
}

// ----- Conversations du chatbot -----
export async function conversation(tel) {
  const [c] = await sbSelect('whatsapp_conversations', `telephone=eq.${normaliserTel(tel)}&limit=1`)
  return c ?? null
}

export async function ouvrirConversation(tel, champs) {
  const n = normaliserTel(tel)
  const existante = await conversation(n)
  if (existante) return existante
  const [c] = await sbUpsert('whatsapp_conversations', { telephone: n, fiche: {}, statut: 'en_cours', bot_actif: true, ...champs, created_at: maintenant(), updated_at: maintenant() }, 'telephone')
  return c
}

export async function majConversation(tel, champs) {
  await sbPatch('whatsapp_conversations', `telephone=eq.${normaliserTel(tel)}`, { ...champs, updated_at: maintenant() })
}

export function botPeutRepondre(conv) {
  if (!conv) return true
  if (conv.bot_actif === false) return false
  if (conv.bot_pause_jusqua && new Date(conv.bot_pause_jusqua) > new Date()) return false
  return true
}

export async function pauserBot(tel, heures) {
  const fin = new Date(Date.now() + heures * 3600 * 1000).toISOString()
  await majConversation(tel, { bot_pause_jusqua: fin })
}

// ----- Réponses des promoteurs aux terrains proposés -----
// Un statut plus avancé n'est jamais écrasé par un statut moins avancé (sauf refus explicite)
const RANG = { envoye: 1, infos: 2, interesse: 3, visite_souhaitee: 4, rappel: 4, visite_demandee: 5 }

export async function majReponse(acheteurId, terrainId, champs) {
  if (acheteurId == null) return
  if (terrainId == null) return
  const [actuel] = await sbSelect('acheteur_terrain_reponses', `acheteur_id=eq.${acheteurId}&terrain_id=eq.${terrainId}&limit=1`)
  const maj = { ...champs, updated_at: maintenant() }
  const nouveau = champs.statut
  if (actuel && nouveau && nouveau !== 'refuse' && actuel.statut !== 'refuse') {
    if ((RANG[actuel.statut] ?? 0) > (RANG[nouveau] ?? 0)) delete maj.statut
  }
  if (!actuel) maj.canal = maj.canal ?? 'WhatsApp (chatbot)'
  await sbUpsert('acheteur_terrain_reponses', { acheteur_id: acheteurId, terrain_id: terrainId, ...maj }, 'acheteur_id,terrain_id')
}

export async function reponsesRecentes(acheteurId, limite = 8) {
  if (acheteurId == null) return []
  return sbSelect('acheteur_terrain_reponses', `acheteur_id=eq.${acheteurId}&order=updated_at.desc&limit=${limite}`).catch(() => [])
}

// ----- Pipeline -----
// Les colonnes du pipeline sont : terrain_id, acheteur_id, terrain_label, acheteur_label, etape, montant, notes, layer, associe.
// Les événements WhatsApp sont ajoutés aux notes du deal, datés.
export async function majDeal(acheteurId, terrainId, champs) {
  try {
    const [deal] = await sbSelect('deals', `acheteur_id=eq.${acheteurId}&terrain_id=eq.${terrainId}&limit=1`)
    if (!deal) return
    const texte = champs?.prochaine_action
    if (!texte) return
    const ligne = `${new Date().toLocaleDateString('fr-FR')} : ${texte}`
    if (String(deal.notes ?? '').includes(ligne)) return
    await sbPatch('deals', `id=eq.${deal.id}`, { notes: deal.notes ? `${deal.notes}\n${ligne}` : ligne })
  } catch (e) {
    console.error('Deal non mis à jour', e.message)
  }
}

export async function creerDealSiAbsent(acheteur, terrain, associe) {
  try {
    const [deal] = await sbSelect('deals', `acheteur_id=eq.${acheteur.id}&terrain_id=eq.${terrain.id}&limit=1`)
    if (deal) return deal
    const [cree] = await sbInsert('deals', {
      terrain_id: terrain.id,
      acheteur_id: acheteur.id,
      terrain_label: terrain.localisation ?? '',
      acheteur_label: acheteur.nom ?? '',
      etape: 'teaser',
      montant: 0,
      notes: `${new Date().toLocaleDateString('fr-FR')} : teaser envoyé par WhatsApp, en attente de réponse`,
      layer: 1,
      associe: associe ?? 'Équipe',
    })
    return cree
  } catch (e) {
    console.error('Deal non créé', e.message)
    return null
  }
}

// ----- Journal et échanges -----
export async function journalActivite(action, entityType, label, entityId, details, associe) {
  try {
    await sbInsert('activity_log', {
      associe: associe ?? 'Chatbot WhatsApp',
      action,
      entity_type: entityType,
      entity_label: label ?? '',
      entity_id: entityId ?? null,
      details: details ?? '',
    })
  } catch (e) {
    console.error('Activité non enregistrée', e.message)
  }
}

// Échange visible dans l'onglet « Échanges » du promoteur, ou dans l'historique du terrain
export async function ajouterEchange({ acheteur, terrainId, retour, notes }) {
  try {
    await sbInsert('interactions', {
      acheteur_id: acheteur?.id ?? null,
      acheteur_nom: acheteur?.nom ?? 'Contact WhatsApp',
      terrain_id: terrainId ?? null,
      associe: 'Chatbot WhatsApp',
      type: 'WhatsApp',
      canal: 'WhatsApp',
      date: maintenant().slice(0, 10),
      retour,
      notes: notes ?? '',
    })
  } catch (e) {
    console.error('Échange non enregistré', e.message)
  }
}
