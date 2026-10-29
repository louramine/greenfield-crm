// Réponse manuelle d'un conseiller depuis le CRM
// POST { acheteur_id, texte }
// WhatsApp n'autorise un message libre que dans les 24h qui suivent le dernier message du contact.
import { exigerUtilisateur, lireCorps } from '../../server/http.js'
import { sendText } from '../../server/whatsapp.js'
import { acheteurParId, normaliserTel } from '../../server/crm.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' })
  const user = await exigerUtilisateur(req, res)
  if (!user) return null

  const { acheteur_id: id, texte } = JSON.parse(await lireCorps(req))
  const a = await acheteurParId(id)
  if (!a ? true : !a.telephone) return res.status(400).json({ erreur: 'Cet acheteur n\'a pas de numéro WhatsApp' })
  if (!String(texte ?? '').trim()) return res.status(400).json({ erreur: 'Message vide' })

  const r = await sendText(normaliserTel(a.telephone), String(texte).trim(), { acheteurId: a.id, auteur: user.email.split('@')[0] })
  if (r?.error) return res.status(400).json({ erreur: r.error.message })
  return res.status(200).json({ ok: true })
}
