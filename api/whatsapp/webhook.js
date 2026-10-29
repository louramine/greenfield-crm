// Point d'entrée appelé par Meta à chaque message WhatsApp reçu
// Adresse à déclarer chez Meta : https://crm.greenfield.plus/api/whatsapp/webhook
import crypto from 'node:crypto'
import { traiterMessage } from '../../server/bot.js'
import { lireCorps } from '../../server/http.js'
import { sbPatch } from '../../server/supabase.js'

function signatureValide(corps, signature) {
  const secret = process.env.WA_APP_SECRET
  if (!secret) return true
  if (!signature) return false
  const attendu = 'sha256=' + crypto.createHmac('sha256', secret).update(corps).digest('hex')
  return attendu.length === signature.length && crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(signature))
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const q = req.query ?? Object.fromEntries(new URL(req.url, 'http://x').searchParams)
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === process.env.WA_VERIFY_TOKEN) {
      return res.status(200).send(q['hub.challenge'])
    }
    return res.status(403).send('Jeton invalide')
  }
  if (req.method !== 'POST') return res.status(405).send('Méthode non autorisée')

  const corps = await lireCorps(req)
  if (!signatureValide(corps, req.headers['x-hub-signature-256'])) return res.status(401).send('Signature invalide')

  let data
  try {
    data = JSON.parse(corps)
  } catch {
    return res.status(400).send('JSON invalide')
  }

  for (const entry of data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {}
      const contacts = v.contacts ?? []
      for (const message of v.messages ?? []) {
        const contact = contacts.find((c) => c.wa_id === message.from) ?? contacts[0]
        try {
          await traiterMessage(message, contact)
        } catch (e) {
          console.error('Erreur traitement message', e)
        }
      }
      // Message non délivré (ex. fenêtre de 24h dépassée) : signalé dans l'historique du CRM
      for (const s of v.statuses ?? []) {
        if (s.status !== 'failed') continue
        const raison = s.errors?.[0]?.code === 131047
          ? 'Non délivré : plus de 24h sans message du contact, renvoyer un teaser'
          : `Non délivré : ${s.errors?.[0]?.title ?? 'erreur WhatsApp'}`
        await sbPatch('whatsapp_messages', `wa_message_id=eq.${s.id}`, { action: raison }).catch(() => null)
      }
    }
  }
  return res.status(200).send('OK')
}
