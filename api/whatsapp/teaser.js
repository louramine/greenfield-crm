// Envoi d'un teaser par modèle WhatsApp validé par Meta, avec les boutons Intéressé, Infos, Visite, Non
// POST { terrain_id, acheteur_ids: [..], pdf_url? }
// Nécessite les modèles "greenfield_teaser" (et "greenfield_teaser_pdf" avec document) approuvés par Meta.
import { exigerUtilisateur, lireCorps, lireJson } from '../../server/http.js'
import { nomMembre } from '../../server/supabase.js'
import { sendTemplate } from '../../server/whatsapp.js'
import { getTerrain, acheteurParId, normaliserTel, majReponse, creerDealSiAbsent, journalActivite, ouvrirConversation } from '../../server/crm.js'
import { refTerrain, lieuTerrain, fmtSurface, fmtPrix, estVendu } from '../../server/terrains.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' })
  const user = await exigerUtilisateur(req, res)
  if (!user) return null

  const corps = lireJson(await lireCorps(req)) ?? {}
  const terrain = await getTerrain(corps.terrain_id)
  if (!terrain) return res.status(404).json({ erreur: 'Terrain introuvable' })
  if (estVendu(terrain)) return res.status(400).json({ erreur: 'Ce terrain est marqué vendu' })

  const qui = await nomMembre(user)
  const pdf = corps.pdf_url ?? null
  const resultats = []
  for (const id of corps.acheteur_ids ?? []) {
    const a = await acheteurParId(id)
    if (!a) {
      resultats.push({ acheteur_id: id, ok: false, raison: 'Promoteur introuvable' })
      continue
    }
    if (!a.telephone) {
      resultats.push({ acheteur_id: id, nom: a.nom, ok: false, raison: 'Pas de numéro WhatsApp' })
      continue
    }
    if (a.whatsapp_stop) {
      resultats.push({ acheteur_id: id, nom: a.nom, ok: false, raison: 'Ne souhaite plus recevoir de messages' })
      continue
    }
    const tel = normaliserTel(a.telephone)
    const nom = a.nom && a.nom !== 'Contact à identifier' ? a.nom : 'Madame, Monsieur'
    const r = await sendTemplate(
      tel,
      (process.env.WA_TEASER_TEMPLATE ?? 'greenfield_teaser') + (pdf ? '_pdf' : ''),
      [nom, lieuTerrain(terrain), fmtSurface(terrain.superficie), terrain.urba ? terrain.urba : 'NC', fmtPrix(terrain), refTerrain(terrain)],
      ['INTERESSE', 'INFOS', 'VISITE', 'NON'].map((act) => `${act}:${terrain.id}`),
      pdf ? { link: pdf, filename: `Teaser ${refTerrain(terrain)}.pdf` } : null,
      { acheteurId: a.id, terrainId: terrain.id, auteur: qui, action: 'teaser' },
    )
    if (!r.ok) {
      resultats.push({ acheteur_id: id, nom: a.nom, ok: false, raison: r.erreur })
      continue
    }
    await majReponse(a.id, terrain.id, { statut: 'envoye', teaser_envoye_le: new Date().toISOString(), canal: 'WhatsApp (modèle)', envoye_par: qui })
    await creerDealSiAbsent(a, terrain, qui)
    await ouvrirConversation(tel, { acheteur_id: a.id, profil: 'acheteur', fiche: { profil: 'acheteur' } })
    resultats.push({ acheteur_id: id, nom: a.nom, ok: true })
  }

  const envoyes = resultats.filter((r) => r.ok).length
  await journalActivite('Teaser WhatsApp envoyé', 'terrain', terrain.localisation, terrain.id, `${refTerrain(terrain)} : ${envoyes} promoteur(s)`, qui)
  return res.status(200).json({ envoyes, resultats })
}
