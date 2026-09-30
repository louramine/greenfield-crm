// Publication multi-plateformes (Facebook, Instagram, LinkedIn) pour le CRM Greenfield.
// Les jetons restent cote serveur (variables d'environnement Vercel), jamais dans le navigateur.
//
// Variables requises
//   CRM_PUBLISH_SECRET      code partage, saisi dans CRM > Marketing > Connexions
//   META_PAGE_ID            identifiant de la Page Facebook
//   META_PAGE_TOKEN         jeton de Page longue duree (pages_manage_posts, instagram_content_publish)
//   META_IG_USER_ID         identifiant du compte Instagram professionnel lie a la Page
//   LINKEDIN_ACCESS_TOKEN   jeton OAuth (w_member_social ou w_organization_social)
//   LINKEDIN_AUTHOR_URN     urn:li:organization:123 ou urn:li:person:abc
// Optionnelles
//   META_GRAPH_VERSION      defaut v21.0
//   LINKEDIN_VERSION        defaut 202511 (format AAAAMM)

import { timingSafeEqual } from 'node:crypto'

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`
const LI_VERSION = process.env.LINKEDIN_VERSION || '202511'
const LIMITS = { instagram: 2200, facebook: 5000, linkedin: 3000 }

function configured() {
  const e = process.env
  return {
    facebook: Boolean(e.META_PAGE_ID && e.META_PAGE_TOKEN),
    instagram: Boolean(e.META_IG_USER_ID && e.META_PAGE_TOKEN),
    linkedin: Boolean(e.LINKEDIN_ACCESS_TOKEN && e.LINKEDIN_AUTHOR_URN),
  }
}

function sameSecret(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

function safeImageUrl(value) {
  if (!value) return null
  let u
  try { u = new URL(value) } catch { throw new Error('URL image invalide') }
  if (u.protocol !== 'https:') throw new Error('URL image : https obligatoire')
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname)) {
    throw new Error('URL image non autorisee')
  }
  return u.toString()
}

async function graph(path, params) {
  const body = new URLSearchParams({ ...params, access_token: process.env.META_PAGE_TOKEN })
  const r = await fetch(`${GRAPH}${path}`, { method: 'POST', body })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error?.message || `Meta HTTP ${r.status}`)
  return j
}

async function publishFacebook({ text, imageUrl, link }) {
  const page = process.env.META_PAGE_ID
  const j = imageUrl
    ? await graph(`/${page}/photos`, { url: imageUrl, caption: text })
    : await graph(`/${page}/feed`, link ? { message: text, link } : { message: text })
  const id = j.post_id || j.id
  return { id, url: `https://www.facebook.com/${id}` }
}

async function publishInstagram({ text, imageUrl }) {
  if (!imageUrl) throw new Error('Instagram exige une image (URL publique JPEG)')
  const ig = process.env.META_IG_USER_ID
  const { id: creation } = await graph(`/${ig}/media`, { image_url: imageUrl, caption: text })
  for (let i = 0; i < 10; i++) {
    const r = await fetch(`${GRAPH}/${creation}?fields=status_code&access_token=${encodeURIComponent(process.env.META_PAGE_TOKEN)}`)
    const j = await r.json().catch(() => ({}))
    if (j.status_code === 'FINISHED') break
    if (j.status_code === 'ERROR' || j.status_code === 'EXPIRED') throw new Error('Instagram a refuse l\'image')
    await new Promise((res) => setTimeout(res, 1500))
  }
  const { id } = await graph(`/${ig}/media_publish`, { creation_id: creation })
  let url = null
  try {
    const r = await fetch(`${GRAPH}/${id}?fields=permalink&access_token=${encodeURIComponent(process.env.META_PAGE_TOKEN)}`)
    url = (await r.json()).permalink || null
  } catch { /* le lien est facultatif */ }
  return { id, url }
}

// Caracteres reserves du format texte LinkedIn (le # reste actif pour les hashtags)
const liEscape = (s) => s.replace(/[\\{}@[\]()<>*_~|]/g, (c) => `\\${c}`)

async function linkedin(path, init) {
  const r = await fetch(`https://api.linkedin.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      'Linkedin-Version': LI_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    throw new Error(j.message || `LinkedIn HTTP ${r.status}`)
  }
  return r
}

async function uploadLinkedInImage(imageUrl, owner) {
  const init = await linkedin('/rest/images?action=initializeUpload', {
    method: 'POST',
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  })
  const { value } = await init.json()
  const img = await fetch(imageUrl)
  if (!img.ok) throw new Error('Image inaccessible')
  const put = await fetch(value.uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}` },
    body: Buffer.from(await img.arrayBuffer()),
  })
  if (!put.ok) throw new Error(`Envoi image LinkedIn HTTP ${put.status}`)
  return value.image
}

async function publishLinkedIn({ text, imageUrl }) {
  const author = process.env.LINKEDIN_AUTHOR_URN
  const payload = {
    author,
    commentary: liEscape(text),
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }
  if (imageUrl) payload.content = { media: { id: await uploadLinkedInImage(imageUrl, author) } }
  const r = await linkedin('/rest/posts', { method: 'POST', body: JSON.stringify(payload) })
  const id = r.headers.get('x-restli-id')
  return { id, url: id ? `https://www.linkedin.com/feed/update/${id}` : null }
}

const PUBLISHERS = { facebook: publishFacebook, instagram: publishInstagram, linkedin: publishLinkedIn }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const secret = process.env.CRM_PUBLISH_SECRET
  if (!secret) return res.status(500).json({ error: 'CRM_PUBLISH_SECRET non configure sur Vercel' })
  if (!sameSecret(req.headers['x-crm-secret'] || '', secret)) {
    return res.status(401).json({ error: 'Code de publication invalide' })
  }

  if (req.method === 'GET') return res.status(200).json({ configured: configured() })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Methode non autorisee' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const platforms = Array.isArray(body.platforms) ? body.platforms.filter((p) => PUBLISHERS[p]) : []
  if (!platforms.length) return res.status(400).json({ error: 'Aucune plateforme valide' })

  let imageUrl
  try { imageUrl = safeImageUrl(body.imageUrl) } catch (e) { return res.status(400).json({ error: e.message }) }
  const link = /^https?:\/\//.test(body.link || '') ? body.link : undefined

  const conf = configured()
  const results = {}
  await Promise.all(platforms.map(async (p) => {
    const text = String(body.texts?.[p] || '').trim()
    try {
      if (!conf[p]) throw new Error('Plateforme non configuree sur Vercel')
      if (!text) throw new Error('Texte vide')
      if (text.length > LIMITS[p]) throw new Error(`Texte trop long (${text.length}/${LIMITS[p]})`)
      results[p] = { ok: true, ...(await PUBLISHERS[p]({ text, imageUrl, link })) }
    } catch (e) {
      results[p] = { ok: false, error: e.message }
    }
  }))
  return res.status(200).json({ results })
}
