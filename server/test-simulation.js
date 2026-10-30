// Simulation complète du chatbot, sans réseau : base en mémoire, WhatsApp et Claude simulés.
// Lancer : npm run test:whatsapp
import assert from 'node:assert/strict'

process.env.SB_MOCK = '1'
process.env.DRY_RUN = '1'
process.env.CLAUDE_MOCK = '1'
process.env.DEBOUNCE_SECONDS = '0.2'
process.env.TEAM_NUMBERS = ''

const { mockDb, resetMock } = await import('./supabase.js')
const { outbox } = await import('./whatsapp.js')
const { setMockClaude } = await import('./claude.js')
const { recevoir, fusionAcheteur, valeursTerrain } = await import('./bot.js')

const db = mockDb()
const T = (nom) => db.tables[nom] ?? []
let extraction = {}
let derniereConsigne = ''
let appelsReponse = 0
setMockClaude(async (req) => {
  const input = typeof extraction === 'function' ? extraction(req) : extraction
  if (req.tool_choice) return { content: [{ type: 'tool_use', name: 'mettre_a_jour_fiche', input }] }
  appelsReponse += 1
  derniereConsigne = req.system
  return { content: [{ type: 'text', text: `Réponse du bot numéro ${appelsReponse}` }] }
})

let seqWa = 1
function webhook(messages, nom = 'Contact') {
  return {
    entry: [{ changes: [{ field: 'messages', value: { contacts: [{ wa_id: messages[0].from, profile: { name: nom } }], messages } }] }],
  }
}
const texte = (from, body) => ({ from, id: `wamid.in.${seqWa++}`, type: 'text', text: { body } })
async function envoyer(data) {
  const suites = await recevoir(data)
  await Promise.all(suites.map((f) => f()))
}
const envois = (tel) => outbox.filter((m) => m.to === tel && m.type)

let ok = 0
async function scenario(nom, fn) {
  await fn()
  ok += 1
  console.log(`OK  ${nom}`)
}

function base() {
  resetMock()
  outbox.length = 0
  db.tables.acheteurs = [
    { id: 900, nom: 'Driss Fassi Fihri', societe: 'Aedge Partners', telephone: '212661430206', type: 'Promoteur', statut: 'À qualifier', associe: 'Ayoub', villes: [], quartiers: [], typologies: [], zonages: [], ticket_max: 30, whatsapp_consentement: 'À confirmer', notes: null },
  ]
  db.tables.terrains = [
    { id: 501, ref: 'GF-26-0501', localisation: 'Bouskoura Ville', quartier: 'Bouskoura', superficie: 10000, prix: 2500, urba: 'D4', statut: 'Disponible' },
  ]
  db.seq = 1000
}

// 1. Promoteur connu : critères ajoutés à sa fiche, salutation par son nom
await scenario('promoteur connu, préférences ajoutées à la fiche CRM', async () => {
  base()
  extraction = { profil: 'acheteur', langue: 'français', langue_crm: 'Français', villes: ['Bouskoura'], typologies: ['Moyen standing', 'Inventé'], resume_pour_appel: 'Cherche du moyen standing à Bouskoura', statut_qualification: 'en_cours' }
  await envoyer(webhook([texte('212661430206', 'Bonjour, nous cherchons du foncier à Bouskoura pour du moyen standing')], 'Driss'))
  const a = T('acheteurs')[0]
  assert.deepEqual(a.villes, ['Bouskoura'])
  assert.equal(a.zones, 'Bouskoura')
  assert.deepEqual(a.typologies, ['Moyen standing'])
  assert.equal(a.langue, 'Français')
  assert.equal(a.statut, 'Tiède')
  assert.ok(a.derniere_interaction)
  assert.equal(envois('212661430206').length, 1)
  assert.ok(derniereConsigne.includes('Driss Fassi Fihri'))
  assert.ok(derniereConsigne.includes('Bonjour, nous cherchons du foncier'))
  assert.ok(!derniereConsigne.includes('Zones recherchées :'), 'les zones sont connues, plus de question dessus')
  const conv = T('whatsapp_conversations')[0]
  assert.equal(conv.acheteur_id, 900)
  assert.equal(conv.profil, 'acheteur')
  const msgs = T('whatsapp_messages')
  assert.equal(msgs.filter((m) => m.direction === 'entrant').length, 1)
  assert.equal(msgs.filter((m) => m.direction === 'sortant' && m.auteur === 'bot').length, 1)
})

// 2. Information contradictoire : notée pour l'équipe, jamais écrasée
await scenario('budget contradictoire noté sans écraser la saisie', async () => {
  const a = { id: 1, nom: 'X', ticket_max: 30, villes: ['Rabat'], notes: 'Note existante', statut: 'Chaud' }
  const { patch, notees } = fusionAcheteur(a, { ticket_max: 50, villes: ['rabat', 'Témara'] }, [])
  assert.equal(patch.ticket_max, undefined)
  assert.deepEqual(patch.villes, ['Rabat', 'Témara'])
  assert.ok(patch.notes.startsWith('Note existante\n'))
  assert.ok(patch.notes.includes('Budget max (M DH)'))
  assert.equal(patch.statut, undefined, 'un statut Chaud ne redescend pas')
  const second = fusionAcheteur({ ...a, notes: patch.notes }, { ticket_max: 50 }, notees)
  assert.equal(second.patch.notes, undefined, 'la même divergence n\'est notée qu\'une fois')
})

// 3. Messages envoyés à la suite : une seule réponse
await scenario('plusieurs messages à la suite, une seule réponse', async () => {
  base()
  extraction = { profil: 'inconnu', langue: 'darija en lettres latines', resume_pour_appel: 'Premier contact', statut_qualification: 'en_cours' }
  const tel = '212600000111'
  const s1 = await recevoir(webhook([texte(tel, 'salam')]))
  const s2 = await recevoir(webhook([texte(tel, 'bghit nbi3 ard f Sidi Maarouf')]))
  await Promise.all([...s1, ...s2].map((f) => f()))
  assert.equal(envois(tel).length, 1)
  assert.equal(T('whatsapp_conversations')[0].premier_message, 'salam')
  assert.ok(derniereConsigne.includes('« salam »'))
  assert.ok(derniereConsigne.includes('Profil : souhaite-t-il vendre'))
})

// 4. Vendeur : terrain créé dans le portefeuille, document rangé dans sa fiche
await scenario('vendeur, terrain créé et note de renseignement rangée', async () => {
  base()
  const tel = '212600000222'
  extraction = { profil: 'vendeur', langue: 'français', nom: 'Karim Alaoui', role: 'propriétaire direct', ville: 'Casablanca', quartier: 'Sidi Maarouf', superficie_m2: 5000, prix_m2: 8000, statut_foncier: 'titré', numero_titre: '12345/C', resume_pour_appel: 'Terrain titré de 5000 m² à Sidi Maarouf', statut_qualification: 'en_cours' }
  const photo = { from: tel, id: `wamid.in.${seqWa++}`, type: 'image', image: { id: 'media-1', caption: 'la note' } }
  const fixe = extraction
  extraction = () => {
    const img = T('whatsapp_messages').find((m) => m.type === 'image')
    return { ...fixe, documents_recus: img ? [{ message_id: img.id, type: 'note_renseignement' }] : [] }
  }
  await envoyer(webhook([texte(tel, 'Bonjour, je vends un terrain à Sidi Maarouf')]))
  await envoyer(webhook([photo]))
  const t = T('terrains').find((x) => x.sourceur === 'WhatsApp')
  assert.ok(t, 'terrain créé')
  assert.equal(t.localisation, 'Sidi Maarouf')
  assert.equal(t.superficie, 5000)
  assert.equal(t.prix, 8000)
  assert.equal(t.forfait, 40)
  assert.equal(t.tf, '12345/C')
  assert.equal(t.statut, 'À qualifier')
  assert.ok(t.notes.startsWith('[Fiche chatbot WhatsApp]'))
  const conv = T('whatsapp_conversations').find((c) => c.telephone === tel)
  assert.equal(conv.terrain_id, t.id)
  const photoMsg = T('whatsapp_messages').find((m) => m.type === 'image')
  assert.equal(photoMsg.media_mime, 'image/jpeg')
  assert.equal(photoMsg.action, 'document:note_renseignement')
  const doc = T('terrain_documents')[0]
  assert.equal(doc.terrain_id, String(t.id))
  assert.equal(doc.type, 'note_renseignement')
  assert.ok(db.storage[`terrain-docs/${doc.chemin}`], 'fichier copié dans les documents du terrain')
  assert.equal(T('activity_log').filter((x) => x.action === 'Terrain reçu via WhatsApp').length, 1)

  // Le vendeur corrige la superficie : le terrain créé par le bot est mis à jour
  extraction = { ...fixe, superficie_m2: 5200, documents_recus: [] }
  await envoyer(webhook([texte(tel, 'pardon, 5200 m² exactement')]))
  assert.equal(T('terrains').find((x) => x.id === t.id).superficie, 5200)
  assert.equal(T('terrains').filter((x) => x.sourceur === 'WhatsApp').length, 1, 'pas de doublon de terrain')
  assert.equal(T('terrain_documents').length, 1)
})

// 5. Boutons du teaser
await scenario('boutons du teaser : intéressé, puis refus avec raison', async () => {
  base()
  const tel = '212661430206'
  db.tables.deals = [{ id: 1, acheteur_id: 900, terrain_id: 501, etape: 'teaser', notes: null }]
  const bouton = (payload, text) => ({ from: tel, id: `wamid.in.${seqWa++}`, type: 'button', button: { payload, text } })
  await envoyer(webhook([bouton('INTERESSE:501', 'Intéressé')]))
  let rep = T('acheteur_terrain_reponses')[0]
  assert.equal(rep.statut, 'interesse')
  assert.ok(T('deals')[0].notes.includes('intéressé via WhatsApp'), 'événement ajouté aux notes du deal')
  assert.equal(envois(tel).at(-1).type, 'interactive')
  await envoyer(webhook([bouton('NON:501', 'Non')]))
  assert.equal(envois(tel).at(-1).interactive.type, 'list')
  const liste = { from: tel, id: `wamid.in.${seqWa++}`, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'RAISON:501:PRIX', title: 'Prix trop élevé' } } }
  await envoyer(webhook([liste]))
  rep = T('acheteur_terrain_reponses')[0]
  assert.equal(rep.statut, 'refuse')
  assert.equal(rep.raison_refus, 'Prix trop élevé')
  assert.ok(T('deals')[0].notes.includes('Prix trop élevé'))
  assert.equal(T('activity_log').every((x) => !('user_id' in x)), true)
  assert.equal(appelsReponse > 0, true)
})

// 6. Réaction écrite à un terrain proposé
await scenario('réaction écrite à un terrain proposé', async () => {
  base()
  const tel = '212661430206'
  db.tables.acheteur_terrain_reponses = [{ id: 1, acheteur_id: 900, terrain_id: 501, statut: 'envoye', updated_at: new Date().toISOString() }]
  extraction = { profil: 'acheteur', langue: 'français', resume_pour_appel: 'Refuse Bouskoura', statut_qualification: 'en_cours', reponses_terrains: [{ terrain_id: 501, statut: 'refuse', raison_refus: 'Emplacement' }] }
  await envoyer(webhook([texte(tel, 'Merci mais Bouskoura ne nous intéresse pas')]))
  const rep = T('acheteur_terrain_reponses')[0]
  assert.equal(rep.statut, 'refuse')
  assert.equal(rep.raison_refus, 'Emplacement')
  assert.ok(derniereConsigne.includes('GF-26-0501'))
})

// 7. Un conseiller répond depuis le téléphone : le bot se tait mais la fiche continue d'être remplie
await scenario('réponse depuis l\'application WhatsApp Business, bot en pause', async () => {
  base()
  const tel = '212600000333'
  extraction = { profil: 'vendeur', langue: 'français', ville: 'Rabat', resume_pour_appel: 'Terrain à Rabat', statut_qualification: 'en_cours' }
  await envoyer(webhook([texte(tel, 'Bonjour, terrain à vendre à Rabat')]))
  assert.equal(envois(tel).length, 1)
  await envoyer({ entry: [{ changes: [{ field: 'smb_message_echoes', value: { message_echoes: [{ from: '212522000000', to: tel, id: 'wamid.echo.1', type: 'text', text: { body: 'Bonjour, je vous appelle dans 5 minutes' } }] } }] }] })
  const echo = T('whatsapp_messages').find((m) => m.wa_message_id === 'wamid.echo.1')
  assert.equal(echo.auteur, 'Conseiller (téléphone)')
  assert.ok(T('whatsapp_conversations')[0].bot_pause_jusqua)
  extraction = { ...extraction, quartier: 'Hay Riad' }
  await envoyer(webhook([texte(tel, 'Très bien, c\'est à Hay Riad')]))
  assert.equal(envois(tel).length, 1, 'aucune nouvelle réponse du bot')
  assert.equal(T('whatsapp_conversations')[0].fiche.quartier, 'Hay Riad')
})

// 8. Teaser ouvert depuis le CRM puis envoyé du téléphone : pas de doublon, pas de pause
await scenario('teaser envoyé depuis le CRM, retrouvé sans doublon', async () => {
  base()
  const tel = '212661430206'
  const contenu = 'Bonjour Driss Fassi Fihri,\n\nGREENFIELD vous propose un terrain'
  db.tables.whatsapp_messages = [{ id: 7, telephone: tel, direction: 'sortant', contenu, action: 'teaser', wa_message_id: null, created_at: new Date().toISOString() }]
  await envoyer({ entry: [{ changes: [{ field: 'smb_message_echoes', value: { message_echoes: [{ to: tel, id: 'wamid.echo.2', type: 'text', text: { body: contenu } }] } }] }] })
  assert.equal(T('whatsapp_messages').length, 1)
  assert.equal(T('whatsapp_messages')[0].wa_message_id, 'wamid.echo.2')
  assert.equal(T('whatsapp_conversations').length, 0, 'le bot n\'est pas mis en pause')
})

// 9. Désinscription et webhook rejoué
await scenario('STOP et message rejoué', async () => {
  base()
  const tel = '212661430206'
  const m = texte(tel, 'STOP')
  await envoyer(webhook([m]))
  await envoyer(webhook([m]))
  const a = T('acheteurs')[0]
  assert.equal(a.whatsapp_stop, true)
  assert.equal(a.whatsapp_consentement, 'Non')
  assert.equal(T('whatsapp_messages').filter((x) => x.direction === 'entrant').length, 1)
  assert.equal(envois(tel).length, 1)
  assert.equal(T('whatsapp_conversations')[0].bot_actif, false)
})

// 10. Fin de qualification : échange enregistré une seule fois pour préparer l'appel
await scenario('qualification terminée, échange ajouté au promoteur', async () => {
  base()
  const tel = '212661430206'
  extraction = { profil: 'acheteur', langue: 'français', resume_pour_appel: 'Promoteur moyen standing, 2 à 3 ha, 60 M DH', points_a_verifier: ['Confirmer le budget'], creneau_appel: 'mardi 10h', statut_qualification: 'complete' }
  await envoyer(webhook([texte(tel, 'Appelez-moi mardi à 10h')]))
  await envoyer(webhook([texte(tel, 'Merci')]))
  const echanges = T('interactions')
  assert.equal(echanges.length, 1)
  assert.equal(echanges[0].acheteur_id, 900)
  assert.equal(echanges[0].type, 'WhatsApp')
  assert.ok(echanges[0].retour.includes('mardi 10h'))
  assert.equal(T('whatsapp_conversations')[0].statut, 'complete')
})

// 11. Nouveau promoteur inconnu : fiche créée
await scenario('promoteur inconnu, fiche créée dans la base promoteurs', async () => {
  base()
  const tel = '212600000444'
  extraction = { profil: 'acheteur', langue: 'anglais', langue_crm: 'Anglais', nom: 'John Smith', societe: 'Atlas Dev', villes: ['Marrakech'], resume_pour_appel: 'Investisseur Marrakech', statut_qualification: 'en_cours' }
  await envoyer(webhook([texte(tel, 'Hello, we are looking for land in Marrakech')], 'John'))
  const a = T('acheteurs').find((x) => x.telephone === tel)
  assert.ok(a)
  assert.equal(a.nom, 'John Smith')
  assert.equal(a.societe, 'Atlas Dev')
  assert.equal(a.source, 'WhatsApp')
  assert.deepEqual(a.villes, ['Marrakech'])
  assert.equal(T('whatsapp_messages').filter((m) => m.telephone === tel).every((m) => m.acheteur_id === a.id), true)
})

// 12. Conversion des prix d'un terrain
await scenario('prix global converti en prix au m²', async () => {
  const v = valeursTerrain('2126', { quartier: 'Ain Diab', superficie_m2: 2000, prix_global_mdh: 30 })
  assert.equal(v.prix, 15000)
  assert.equal(v.forfait, 30)
})

// 13. Fonctions HTTP
await scenario('webhook et envoi par un conseiller', async () => {
  base()
  const { default: webhookHttp } = await import('../api/whatsapp/webhook.js')
  const { default: envoiHttp } = await import('../api/whatsapp/send.js')
  const reponse = () => {
    const r = { code: 0, corps: null }
    r.status = (c) => Object.assign(r, { code: c })
    r.send = (x) => Object.assign(r, { corps: x })
    r.json = (x) => Object.assign(r, { corps: x })
    return r
  }
  process.env.WA_WEBHOOK_SECRET = 'secret'
  let res = reponse()
  await webhookHttp({ method: 'POST', url: '/api/whatsapp/webhook?cle=mauvaise', headers: {}, body: '{}' }, res)
  assert.equal(res.code, 401)
  res = reponse()
  extraction = { profil: 'vendeur', langue: 'français', resume_pour_appel: 'x', statut_qualification: 'en_cours' }
  await webhookHttp({ method: 'POST', url: '/api/whatsapp/webhook?cle=secret', headers: {}, body: JSON.stringify(webhook([texte('212600000555', 'Bonjour')])) }, res)
  assert.equal(res.code, 200)
  await new Promise((r) => setTimeout(r, 600))
  assert.equal(envois('212600000555').length, 1)

  res = reponse()
  await envoiHttp({ method: 'POST', headers: {}, body: JSON.stringify({ telephone: '212600000555', texte: 'Bonjour' }) }, res)
  assert.equal(res.code, 401)
  res = reponse()
  db.tables.equipe = [{ id: 1, nom: 'Ayoub', email: 'ayoublyaf@gmail.com' }]
  await envoiHttp({ method: 'POST', headers: { authorization: 'Bearer jeton-test' }, body: JSON.stringify({ telephone: '0600000555', texte: 'Je vous appelle' }) }, res)
  assert.equal(res.code, 200)
  const dernier = T('whatsapp_messages').at(-1)
  assert.equal(dernier.auteur, 'Ayoub')
  assert.ok(T('whatsapp_conversations').find((c) => c.telephone === '212600000555').bot_pause_jusqua)
  delete process.env.WA_WEBHOOK_SECRET
})

console.log(`\n${ok} scénarios réussis`)
