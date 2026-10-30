// Point d'entrée appelé à chaque message WhatsApp reçu (360dialog ou Meta)
// Adresse à déclarer : https://crm.greenfield.plus/api/whatsapp/webhook?cle=VOTRE_WA_WEBHOOK_SECRET
import crypto from 'node:crypto'
import { waitUntil } from '@vercel/functions'
import { recevoir } from '../../server/bot.js'
import { lireCorps, lireJson, parametres } from '../../server/http.js'

function egal(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

// Signature Meta (API en direct) : vérifiée si WA_APP_SECRET est renseigné
function signatureValide(corps, signature) {
  const secret = process.env.WA_APP_SECRET
  if (!secret) return true
  if (!signature) return false
  return egal('sha256=' + crypto.createHmac('sha256', secret).update(corps).digest('hex'), signature)
}

// Clé secrète dans l'adresse du webhook (360dialog ne signe pas les appels)
function cleValide(req) {
  const attendue = process.env.WA_WEBHOOK_SECRET
  if (!attendue) return true
  return egal(parametres(req).cle ?? '', attendue)
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const q = parametres(req)
    if (q['hub.mode'] === 'subscribe' && process.env.WA_VERIFY_TOKEN && q['hub.verify_token'] === process.env.WA_VERIFY_TOKEN) {
      return res.status(200).send(q['hub.challenge'])
    }
    return res.status(200).json({ ok: true, service: 'chatbot WhatsApp GREENFIELD' })
  }
  if (req.method !== 'POST') return res.status(405).send('Méthode non autorisée')
  if (!cleValide(req)) return res.status(401).send('Clé invalide')

  const corps = await lireCorps(req)
  if (!signatureValide(corps, req.headers['x-hub-signature-256'])) return res.status(401).send('Signature invalide')
  const data = lireJson(corps)
  if (!data) return res.status(400).send('JSON invalide')

  let suites = []
  try {
    suites = await recevoir(data)
  } catch (e) {
    console.error('Webhook WhatsApp', e)
  }
  // Réponse immédiate à WhatsApp, la suite (Claude, envoi de la réponse) continue en arrière-plan
  const travail = Promise.all(suites.map((f) => f().catch((e) => console.error('Traitement WhatsApp', e))))
  waitUntil(travail)
  return res.status(200).send('OK')
}
