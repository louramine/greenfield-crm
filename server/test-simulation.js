// Simulation de bout en bout sans WhatsApp ni Supabase réels
// Lancer avec : node server/test-simulation.js
import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import assert from 'node:assert/strict'

process.env.DRY_RUN = '1'
process.env.SB_MOCK = '1'
process.env.WA_APP_SECRET = 'secret-test'
process.env.WA_VERIFY_TOKEN = 'verif'
process.env.TEAM_NUMBERS = '212600000099'

const { mockDb } = await import('./supabase.js')
const { outbox } = await import('./whatsapp.js')
const { default: webhook } = await import('../api/whatsapp/webhook.js')
const { default: teaser } = await import('../api/whatsapp/teaser.js')
const { default: envoyer } = await import('../api/whatsapp/send.js')

const db = mockDb()
db.seq = 100
db.tables.terrains = [
  { id: 12, localisation: 'Californie', quartier: 'Californie', urba: 'C4s', superficie: 42710, prix: 4800, forfait: 205 },
  { id: 13, localisation: 'Oulad Saleh', quartier: 'Oulad Saleh', urba: 'I2', superficie: 168524, prix: 900, forfait: 152 },
]
db.tables.acheteurs = [
  { id: 1, nom: 'Promo Atlas', contact: 'Karim', type: 'Promoteur', telephone: '212661000001', urbas_cibles: ['C4S'] },
  { id: 2, nom: 'Immo Nord', type: 'Promoteur', telephone: null },
]
db.tables.deals = []

function fauxRes() {
  const r = { code: 0, corps: null }
  r.status = (c) => {
    r.code = c
    return r
  }
  r.send = (b) => {
    r.corps = b
    return r
  }
  r.json = (b) => {
    r.corps = b
    return r
  }
  return r
}

function requete(corps, headers) {
  const req = Readable.from([Buffer.from(corps)])
  req.method = 'POST'
  req.headers = headers
  return req
}

async function recu(from, message, nom = 'Karim') {
  const corps = JSON.stringify({ entry: [{ changes: [{ value: { contacts: [{ wa_id: from, profile: { name: nom } }], messages: [{ id: 'wamid.' + Math.random(), from, ...message }] } }] }] })
  const sig = 'sha256=' + crypto.createHmac('sha256', 'secret-test').update(corps).digest('hex')
  const res = fauxRes()
  outbox.length = 0
  await webhook(requete(corps, { 'x-hub-signature-256': sig }), res)
  assert.equal(res.code, 200)
  return outbox.filter((m) => m.type)
}

const bouton = (id) => ({ type: 'interactive', interactive: { type: 'button_reply', button_reply: { id, title: id } } })

// 1. Envoi du teaser depuis le CRM
let res = fauxRes()
await teaser(requete(JSON.stringify({ terrain_id: 12, acheteur_ids: [1, 2] }), { authorization: 'Bearer jeton-test' }), res)
assert.equal(res.corps.envoyes, 1)
assert.equal(res.corps.resultats[1].raison, 'Pas de numéro WhatsApp')
assert.equal(db.tables.deals.length, 1)
assert.equal(db.tables.deals[0].etape, 'teaser')

// Sans session : refusé
res = fauxRes()
await teaser(requete('{}', { authorization: 'Bearer faux' }), res)
assert.equal(res.code, 401)

// 2. Parcours promoteur
await recu('212661000001', { type: 'button', button: { payload: 'INTERESSE:12', text: 'Ça m\'intéresse' } })
await recu('212661000001', bouton('INFOS:12'))
let envois = await recu('212661000001', bouton('VISITE:12'))
const ligne = envois[0].interactive.action.sections[0].rows[0]
await recu('212661000001', { type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: ligne.id, title: ligne.title } } })

const rep12 = db.tables.acheteur_terrain_reponses.find((r) => r.terrain_id === 12)
assert.equal(rep12.statut, 'visite_demandee')
assert.ok(rep12.creneau_visite)
assert.ok(db.tables.deals[0].prochaine_action.startsWith('Confirmer la visite'))

// Un clic tardif sur "Plus d'infos" ne fait pas reculer le statut
await recu('212661000001', bouton('INFOS:12'))
assert.equal(rep12.statut, 'visite_demandee')

// 3. Refus avec raison sur un autre terrain
await recu('212661000001', { type: 'button', button: { payload: 'NON:13', text: 'Pas intéressé' } })
await recu('212661000001', bouton('RAISON:13:PRIX'))
const rep13 = db.tables.acheteur_terrain_reponses.find((r) => r.terrain_id === 13)
assert.equal(rep13.statut, 'refuse')
assert.equal(rep13.raison_refus, 'Prix trop élevé')

// 4. Un inconnu écrit : fiche acheteur créée automatiquement
envois = await recu('212662222222', { type: 'text', text: { body: 'Bonjour, vous avez des terrains à Bouskoura ?' } }, 'Yassine')
const nouveau = db.tables.acheteurs.find((a) => a.telephone === '212662222222')
assert.equal(nouveau.nom, 'Yassine')
assert.equal(nouveau.source, 'WhatsApp')
assert.ok(envois.some((m) => m.to === '212662222222'))

// 5. Réponse d'un conseiller depuis le CRM, puis le bot se tait sur le message libre suivant
res = fauxRes()
await envoyer(requete(JSON.stringify({ acheteur_id: nouveau.id, texte: 'Bonjour Yassine, oui, je vous envoie une sélection.' }), { authorization: 'Bearer jeton-test' }), res)
assert.equal(res.code, 200)
envois = await recu('212662222222', { type: 'text', text: { body: 'Merci, j\'attends' } }, 'Yassine')
assert.ok(!envois.some((m) => m.to === '212662222222'), 'le bot ne doit pas répondre pendant un échange avec un conseiller')

// 6. STOP
await recu('212661000001', { type: 'text', text: { body: 'STOP' } })
assert.equal(db.tables.acheteurs[0].whatsapp_stop, true)
res = fauxRes()
await teaser(requete(JSON.stringify({ terrain_id: 13, acheteur_ids: [1] }), { authorization: 'Bearer jeton-test' }), res)
assert.equal(res.corps.resultats[0].raison, 'Désinscrit (STOP)')

// Historique
const msgs = db.tables.whatsapp_messages
console.log(`Historique : ${msgs.length} messages`)
for (const m of msgs.filter((x) => x.acheteur_id === 1).slice(0, 8)) {
  console.log(`${m.direction === 'entrant' ? '<' : '>'} [${m.auteur}] ${m.contenu.split('\n')[0].slice(0, 90)}`)
}
assert.ok(msgs.every((m) => m.telephone !== '212600000099'), 'les alertes équipe ne vont pas dans l\'historique')
assert.ok(msgs.filter((m) => m.acheteur_id === 1).length >= 10)
console.log('Activités :', db.tables.activity_log.map((a) => a.action).join(' / '))
console.log('\nTous les tests sont passés.')
