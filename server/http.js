// Outils communs aux fonctions /api
import { utilisateurDepuisJeton } from './supabase.js'

export async function lireCorps(req) {
  const morceaux = []
  if (req.readable) {
    for await (const m of req) morceaux.push(m)
  }
  if (morceaux.length) return Buffer.concat(morceaux).toString('utf8')
  if (typeof req.body === 'string') return req.body
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  return JSON.stringify(req.body ?? {})
}

export function lireJson(texte) {
  try {
    return JSON.parse(texte)
  } catch {
    return null
  }
}

export function parametres(req) {
  return req.query ?? Object.fromEntries(new URL(req.url, 'http://x').searchParams)
}

// Réservé aux membres de l'équipe connectés au CRM (jeton de session Supabase)
export async function exigerUtilisateur(req, res) {
  const entete = String(req.headers.authorization ?? '')
  const user = await utilisateurDepuisJeton(entete.replace(/^Bearer\s+/i, ''))
  if (!user) {
    res.status(401).json({ erreur: 'Session expirée, reconnectez-vous au CRM.' })
    return null
  }
  return user
}
