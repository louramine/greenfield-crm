// Réponse d'un conseiller depuis le CRM : POST { telephone, texte } ou { acheteur_id, texte }
// WhatsApp n'autorise un message libre que dans les 24h qui suivent le dernier message du contact.
// Le chatbot se met en pause pour ce contact pendant HUMAN_TAKEOVER_PAUSE_HOURS (24h par défaut).
import { exigerUtilisateur, lireCorps, lireJson } from '../../server/http.js'
import { nomMembre } from '../../server/supabase.js'
import { sendText } from '../../server/whatsapp.js'
import { acheteurParId, acheteurParTel, normaliserTel, ouvrirConversation, pauserBot } from '../../server/crm.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' })
  const user = await exigerUtilisateur(req, res)
  if (!user) return null

  const corps = lireJson(await lireCorps(req)) ?? {}
  const texte = String(corps.texte ?? '').trim()
  if (!texte) return res.status(400).json({ erreur: 'Message vide' })
  const acheteur = corps.acheteur_id != null ? await acheteurParId(corps.acheteur_id) : await acheteurParTel(corps.telephone)
  const tel = normaliserTel(corps.telephone ?? acheteur?.telephone)
  if (!tel) return res.status(400).json({ erreur: 'Aucun numéro WhatsApp pour ce contact' })

  const r = await sendText(tel, texte, { acheteurId: acheteur?.id ?? null, auteur: await nomMembre(user) })
  if (!r.ok) {
    const fenetre = ['24', 're-engagement', '131047'].some((x) => String(r.erreur).toLowerCase().includes(x))
    return res.status(400).json({ erreur: fenetre ? 'Plus de 24h sans message du contact : WhatsApp exige un modèle validé pour lui écrire.' : r.erreur })
  }
  await ouvrirConversation(tel, { acheteur_id: acheteur?.id ?? null })
  await pauserBot(tel, Number(process.env.HUMAN_TAKEOVER_PAUSE_HOURS ?? '24'))
  return res.status(200).json({ ok: true })
}
