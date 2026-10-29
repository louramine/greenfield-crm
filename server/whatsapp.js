// Envoi de messages via l'API WhatsApp Cloud de Meta.
// Chaque message envoyé à un acheteur est enregistré dans l'historique du CRM.
import { enregistrerMessage, acheteurParTel } from './crm.js'

const API_VERSION = process.env.WA_API_VERSION ?? 'v21.0'

// En mode test (DRY_RUN=1), les messages sont capturés au lieu d'être envoyés
export const outbox = []

function numerosEquipe() {
  return (process.env.TEAM_NUMBERS ?? '').split(',').map((n) => n.trim()).filter(Boolean)
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

async function send(payload, meta = {}) {
  const body = { messaging_product: 'whatsapp', ...payload }
  let data
  if (process.env.DRY_RUN === '1') {
    outbox.push(body)
    data = { messages: [{ id: 'wamid.test' }] }
  } else {
    const url = `https://graph.facebook.com/${API_VERSION}/${process.env.WA_PHONE_NUMBER_ID}/messages`
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    data = await res.json()
    if (!res.ok) console.error('Erreur WhatsApp', res.status, JSON.stringify(data))
  }

  // Historique : on n'enregistre pas les alertes envoyées à l'équipe ni les accusés de lecture
  if (body.to && body.type && !numerosEquipe().includes(body.to)) {
    const acheteur = meta.acheteurId ? null : await acheteurParTel(body.to).catch(() => null)
    await enregistrerMessage({
      acheteur_id: meta.acheteurId ?? acheteur?.id ?? null,
      telephone: body.to,
      direction: 'sortant',
      type: body.type,
      contenu: data?.error ? `[Echec : ${data.error.message}] ${resume(body)}` : resume(body),
      terrain_id: meta.terrainId ?? null,
      auteur: meta.auteur ?? 'bot',
      wa_message_id: data?.messages?.[0]?.id ?? null,
    })
  }
  return data
}

export function sendText(to, text, meta) {
  return send({ to, type: 'text', text: { body: text, preview_url: true } }, meta)
}

// Jusqu'à 3 boutons (titre de 20 caractères max)
export function sendButtons(to, text, buttons, meta) {
  return send({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: { buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  }, meta)
}

// Liste déroulante : 10 lignes max
export function sendList(to, text, buttonLabel, sectionTitle, rows, meta) {
  return send({
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
  return send({ to, type: 'document', document: { link, filename, caption } }, meta)
}

export function sendLocation(to, lat, lon, name, meta) {
  return send({ to, type: 'location', location: { latitude: lat, longitude: lon, name } }, meta)
}

// Modèle validé par Meta : obligatoire pour écrire en premier
export function sendTemplate(to, name, bodyParams, buttonPayloads, headerDocument, meta) {
  const components = []
  if (headerDocument) {
    components.push({ type: 'header', parameters: [{ type: 'document', document: headerDocument }] })
  }
  if (bodyParams?.length) {
    components.push({ type: 'body', parameters: bodyParams.map((t) => ({ type: 'text', text: String(t) })) })
  }
  const payloads = buttonPayloads ?? []
  payloads.forEach((payload, index) => {
    components.push({ type: 'button', sub_type: 'quick_reply', index: String(index), parameters: [{ type: 'payload', payload }] })
  })
  return send({
    to,
    type: 'template',
    template: { name, language: { code: process.env.WA_TEMPLATE_LANG ?? 'fr' }, components },
  }, meta)
}

export function markAsRead(messageId) {
  if (!messageId) return null
  return send({ status: 'read', message_id: messageId })
}

// Alerte aux numéros de l'équipe (modèle "greenfield_alerte", sans retour à la ligne)
export async function alerterEquipe(texte) {
  const propre = texte.replace(/\s*\n+\s*/g, ' / ').replace(/\s{2,}/g, ' ').slice(0, 900)
  for (const n of numerosEquipe()) {
    await sendTemplate(n, process.env.WA_ALERT_TEMPLATE ?? 'greenfield_alerte', [propre])
  }
}
