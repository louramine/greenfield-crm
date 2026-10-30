// Envoi et réception WhatsApp : 360dialog (recommandé, compatible avec l'application WhatsApp Business)
// ou API Cloud de Meta en direct. Chaque message envoyé à un contact est enregistré dans le CRM.
import { enregistrerMessage, acheteurParTel, normaliserTel } from './crm.js'

const D360 = 'https://waba-v2.360dialog.io'

// En mode test (DRY_RUN=1), les messages sont capturés au lieu d'être envoyés
export const outbox = []

function fournisseur() {
  return (process.env.WA_PROVIDER ?? '360dialog').toLowerCase()
}

function urlMessages() {
  if (fournisseur() === 'meta') {
    return `https://graph.facebook.com/${process.env.WA_API_VERSION ?? 'v24.0'}/${process.env.WA_PHONE_NUMBER_ID}/messages`
  }
  return `${D360}/messages`
}

function entetes() {
  if (fournisseur() === 'meta') return { Authorization: `Bearer ${process.env.WA_TOKEN}`, 'Content-Type': 'application/json' }
  return { 'D360-API-KEY': process.env.D360_API_KEY ?? '', 'Content-Type': 'application/json' }
}

export function numerosEquipe() {
  return (process.env.TEAM_NUMBERS ?? '').split(',').map((n) => normaliserTel(n.trim())).filter(Boolean)
}

function resume(body) {
  if (body.type === 'text') return body.text.body
  if (body.type === 'interactive') {
    const i = body.interactive
    const choix = i.type === 'button'
      ? i.action.buttons.map((b) => b.reply.title)
      : i.action.sections.flatMap((s) => s.rows.map((r) => r.title))
    return `${i.body.text}\n[${choix.join(' / ')}]`
  }
  if (body.type === 'template') {
    const params = body.template.components.flatMap((c) => (c.parameters ?? []).map((p) => p.text)).filter(Boolean)
    return `Modèle ${body.template.name} : ${params.join(' / ')}`
  }
  if (body.type === 'document') return `Document : ${body.document.filename}`
  if (body.type === 'location') return `Localisation : ${body.location.name}`
  return body.type
}

async function poster(body) {
  if (process.env.DRY_RUN === '1') {
    outbox.push(body)
    return { ok: true, data: { messages: [{ id: `wamid.test.${outbox.length}` }] } }
  }
  const res = await fetch(urlMessages(), { method: 'POST', headers: entetes(), body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) console.error('Erreur WhatsApp', res.status, JSON.stringify(data))
  return { ok: res.ok, data }
}

// meta : { acheteurId, terrainId, auteur, action }
async function envoyer(payload, meta = {}) {
  const body = { messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }
  const { ok, data } = await poster(body)
  const erreur = ok ? null : (data?.error?.message ?? data?.meta?.developer_message ?? 'Envoi refusé par WhatsApp')
  if (body.to && body.type && !numerosEquipe().includes(normaliserTel(body.to))) {
    const acheteur = meta.acheteurId ? null : await acheteurParTel(body.to).catch(() => null)
    await enregistrerMessage({
      acheteur_id: meta.acheteurId ?? acheteur?.id ?? null,
      telephone: body.to,
      direction: 'sortant',
      type: body.type,
      contenu: erreur ? `[Echec : ${erreur}] ${resume(body)}` : resume(body),
      action: meta.action ?? null,
      terrain_id: meta.terrainId ?? null,
      auteur: meta.auteur ?? 'bot',
      wa_message_id: data?.messages?.[0]?.id ?? null,
    })
  }
  return { ok, erreur, id: data?.messages?.[0]?.id ?? null }
}

export function sendText(to, text, meta) {
  return envoyer({ to, type: 'text', text: { body: String(text).slice(0, 4096), preview_url: false } }, meta)
}

// Jusqu'à 3 boutons (titre de 20 caractères max)
export function sendButtons(to, text, buttons, meta) {
  return envoyer({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  }, meta)
}

// Liste déroulante : 10 lignes max
export function sendList(to, text, buttonLabel, sectionTitle, rows, meta) {
  return envoyer({
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text },
      action: { button: buttonLabel.slice(0, 20), sections: [{ title: sectionTitle.slice(0, 24), rows: rows.slice(0, 10) }] },
    },
  }, meta)
}

export function sendDocument(to, link, filename, caption, meta) {
  return envoyer({ to, type: 'document', document: { link, filename, caption } }, meta)
}

// Modèle validé par Meta : obligatoire pour écrire en premier ou après 24h sans message du contact
export function sendTemplate(to, name, bodyParams, buttonPayloads, headerDocument, meta) {
  const components = []
  if (headerDocument) components.push({ type: 'header', parameters: [{ type: 'document', document: headerDocument }] })
  if (bodyParams?.length) components.push({ type: 'body', parameters: bodyParams.map((t) => ({ type: 'text', text: String(t) })) })
  for (const [index, payload] of (buttonPayloads ?? []).entries()) {
    components.push({ type: 'button', sub_type: 'quick_reply', index: String(index), parameters: [{ type: 'payload', payload }] })
  }
  return envoyer({
    to,
    type: 'template',
    template: { name, language: { code: process.env.WA_TEMPLATE_LANG ?? 'fr' }, components },
  }, meta)
}

// Accusé de lecture et indicateur « en train d'écrire » pendant que le bot prépare sa réponse
export async function marquerLu(messageId) {
  if (!messageId) return
  try {
    await poster({ messaging_product: 'whatsapp', status: 'read', message_id: messageId, typing_indicator: { type: 'text' } })
  } catch (e) {
    console.warn('Accusé de lecture impossible', e.message)
  }
}

// Alerte aux numéros de l'équipe (modèle "greenfield_alerte" validé par Meta, sans retour à la ligne)
export async function alerterEquipe(texte) {
  const numeros = numerosEquipe()
  if (!numeros.length) return
  const propre = String(texte).replace(/\s*\n+\s*/g, ' / ').replace(/\s{2,}/g, ' ').slice(0, 900)
  for (const n of numeros) {
    await envoyer({
      to: n,
      type: 'template',
      template: {
        name: process.env.WA_ALERT_TEMPLATE ?? 'greenfield_alerte',
        language: { code: process.env.WA_TEMPLATE_LANG ?? 'fr' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: propre }] }],
      },
    }).catch(() => null)
  }
}

// Télécharge un média reçu. Retourne { contenu: Buffer, mime }
export async function telechargerMedia(mediaId) {
  if (process.env.DRY_RUN === '1') return { contenu: Buffer.from('media-test'), mime: 'image/jpeg' }
  let info
  let fichier
  if (fournisseur() === 'meta') {
    const version = process.env.WA_API_VERSION ?? 'v24.0'
    info = await (await fetch(`https://graph.facebook.com/${version}/${mediaId}`, { headers: entetes() })).json()
    fichier = await fetch(info.url, { headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` } })
  } else {
    info = await (await fetch(`${D360}/${mediaId}`, { headers: entetes() })).json()
    const url = String(info.url ?? '').replace('https://lookaside.fbsbx.com', D360)
    fichier = await fetch(url, { headers: { 'D360-API-KEY': process.env.D360_API_KEY ?? '' } })
  }
  if (!fichier.ok) throw new Error(`Média ${mediaId} : ${fichier.status}`)
  const mime = String(info.mime_type ?? fichier.headers.get('content-type') ?? 'application/octet-stream').split(' ')[0].replace(/,$/, '')
  return { contenu: Buffer.from(await fichier.arrayBuffer()), mime: mime.split(String.fromCharCode(59))[0] }
}
