// Lecture et écriture des données CRM liées à WhatsApp
import { sbSelect, sbInsert, sbPatch, sbUpsert } from './supabase.js'

// Format international sans "+" : 212661234567
export function normaliserTel(t) {
  let n = String(t ?? '').replace(/\D/g, '')
  if (n.startsWith('00')) n = n.slice(2)
  if (n.length === 10 && n.startsWith('0')) n = '212' + n.slice(1)
  return n
}

export async function acheteurParTel(tel) {
  const rows = await sbSelect('acheteurs', `telephone=eq.${normaliserTel(tel)}&limit=1`)
  return rows[0] ?? null
}

export async function acheteurParId(id) {
  const rows = await sbSelect('acheteurs', `id=eq.${id}&limit=1`)
  return rows[0] ?? null
}

// Un numéro inconnu qui écrit au bot devient une fiche acheteur à qualifier
export async function trouverOuCreerAcheteur(tel, nomProfil) {
  const existant = await acheteurParTel(tel)
  if (existant) return existant
  const [cree] = await sbInsert('acheteurs', {
    nom: nomProfil ? nomProfil : `+${normaliserTel(tel)}`,
    type: 'Promoteur',
    telephone: normaliserTel(tel),
    source: 'WhatsApp',
    urbas_cibles: [],
  })
  await journalActivite('Acheteur créé via WhatsApp', 'acheteur', cree.nom, cree.id)
  return cree
}

export async function majAcheteur(id, champs) {
  if (!id) return
  await sbPatch('acheteurs', `id=eq.${id}`, champs)
}

export async function getTerrain(id) {
  if (!/^\d+$/.test(String(id))) return null
  const rows = await sbSelect('terrains', `id=eq.${id}&limit=1`)
  return rows[0] ?? null
}

export async function enregistrerMessage(m) {
  try {
    await sbInsert('whatsapp_messages', { ...m, telephone: normaliserTel(m.telephone) })
  } catch (e) {
    console.error('Historique WhatsApp non enregistré', e.message)
  }
}

// Ordre d'avancement : un statut plus avancé n'est jamais écrasé par un moins avancé
const RANG = { envoye: 1, infos: 2, interesse: 3, visite_souhaitee: 4, rappel: 4, visite_demandee: 5 }

export async function majReponse(acheteurId, terrainId, champs) {
  if (!acheteurId ? true : !terrainId) return
  const [actuel] = await sbSelect('acheteur_terrain_reponses', `acheteur_id=eq.${acheteurId}&terrain_id=eq.${terrainId}&limit=1`)
  const maj = { ...champs, updated_at: new Date().toISOString() }
  const nouveau = champs.statut
  if (actuel && nouveau && nouveau !== 'refuse' && actuel.statut !== 'refuse') {
    if ((RANG[actuel.statut] ?? 0) > (RANG[nouveau] ?? 0)) delete maj.statut
  }
  await sbUpsert('acheteur_terrain_reponses', { acheteur_id: acheteurId, terrain_id: terrainId, ...maj }, 'acheteur_id,terrain_id')
}

// Met à jour le deal du pipeline correspondant (s'il existe)
export async function majDeal(acheteurId, terrainId, champs) {
  try {
    const [deal] = await sbSelect('deals', `acheteur_id=eq.${acheteurId}&terrain_id=eq.${terrainId}&limit=1`)
    if (deal) await sbPatch('deals', `id=eq.${deal.id}`, champs)
  } catch (e) {
    console.error('Deal non mis à jour', e.message)
  }
}

export async function creerDealSiAbsent(acheteur, terrain, userId) {
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
      sourceurs: [],
      date_contact: new Date().toISOString().slice(0, 10),
      prochaine_action: 'Attendre la réponse au teaser WhatsApp',
      user_id: userId ?? null,
    })
    return cree
  } catch (e) {
    console.error('Deal non créé', e.message)
    return null
  }
}

export async function journalActivite(action, entityType, label, entityId, details, associe, userId) {
  try {
    await sbInsert('activity_log', {
      associe: associe ?? 'whatsapp',
      action,
      entity_type: entityType,
      entity_label: label ?? '',
      entity_id: entityId ?? null,
      details: details ?? '',
      user_id: userId ?? null,
      created_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('Activité non enregistrée', e.message)
  }
}
