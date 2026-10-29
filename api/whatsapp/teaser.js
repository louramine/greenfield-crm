// Envoi d'un teaser WhatsApp depuis le CRM
// POST { terrain_id, acheteur_ids: [..], pdf_url? }
import { exigerUtilisateur, lireCorps } from '../../server/http.js'
import { sendTemplate } from '../../server/whatsapp.js'
import { getTerrain, acheteurParId, normaliserTel, majReponse, creerDealSiAbsent, journalActivite } from '../../server/crm.js'
import { refTerrain, lieuTerrain, fmtSurface, fmtPrix, estVendu } from '../../server/terrains.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' })
  const user = await exigerUtilisateur(req, res)
  if (!user) return null

  const { terrain_id: terrainId, acheteur_ids: ids, pdf_url: pdf } = JSON.parse(await lireCorps(req))
  const terrain = await getTerrain(terrainId)
  if (!terrain) return res.status(404).json({ erreur: 'Terrain introuvable' })
  if (estVendu(terrain)) return res.status(400).json({ erreur: 'Ce terrain est marqué vendu' })

  const associe = user.email.split('@')[0]
  const resultats = []
  for (const id of ids ?? []) {
    const a = await acheteurParId(id)
    if (!a) {
      resultats.push({ acheteur_id: id, ok: false, raison: 'Acheteur introuvable' })
      continue
    }
    if (!a.telephone) {
      resultats.push({ acheteur_id: id, nom: a.nom, ok: false, raison: 'Pas de numéro WhatsApp' })
      continue
    }
    if (a.whatsapp_stop) {
      resultats.push({ acheteur_id: id, nom: a.nom, ok: false, raison: 'Désinscrit (STOP)' })
      continue
    }
    const tel = normaliserTel(a.telephone)
    const r = await sendTemplate(
      tel,
      (process.env.WA_TEASER_TEMPLATE ?? 'greenfield_teaser') + (pdf ? '_pdf' : ''),
      [a.contact ? a.contact : (a.nom ? a.nom : 'Madame, Monsieur'), lieuTerrain(terrain), fmtSurface(terrain.superficie), terrain.urba ? terrain.urba : 'NC', fmtPrix(terrain), refTerrain(terrain)],
      ['INTERESSE', 'INFOS', 'VISITE', 'NON'].map((act) => `${act}:${terrain.id}`),
      pdf ? { link: pdf, filename: `Teaser ${refTerrain(terrain)}.pdf` } : null,
      { acheteurId: a.id, terrainId: terrain.id, auteur: associe },
    )
    if (r?.error) {
      resultats.push({ acheteur_id: id, nom: a.nom, ok: false, raison: r.error.message })
      continue
    }
    await majReponse(a.id, terrain.id, { statut: 'envoye', teaser_envoye_le: new Date().toISOString() })
    await creerDealSiAbsent(a, terrain, user.id)
    resultats.push({ acheteur_id: id, nom: a.nom, ok: true })
  }

  const envoyes = resultats.filter((r) => r.ok).length
  await journalActivite('Teaser WhatsApp envoyé', 'terrain', terrain.localisation, terrain.id, `${envoyes} acheteur(s)`, associe, user.id)
  return res.status(200).json({ envoyes, resultats })
}
