// Chatbot WhatsApp GREENFIELD relié au CRM
//
// 1. Boutons des teasers (ACTION:id_terrain[:détail]) : réponses immédiates, sans Claude.
// 2. Messages libres : après quelques secondes de regroupement, Claude met à jour la fiche
//    (fiche promoteur, terrain vendeur, réponses aux terrains proposés) puis rédige la question suivante.
// 3. Le bot se tait quand un conseiller répond (depuis le CRM ou l'application WhatsApp Business).
import {
  normaliserTel, acheteurParTel, acheteurParId, creerAcheteur, majAcheteur,
  getTerrain, terrainParRef, creerTerrain, majTerrain, documentTerrain, ajouterDocumentTerrain,
  enregistrerMessage, majMessage, messageParWaId, messagesDe, dernierEntrantId,
  conversation, ouvrirConversation, majConversation, botPeutRepondre, pauserBot,
  majReponse, reponsesRecentes, majDeal, journalActivite, ajouterEchange,
} from './crm.js'
import { sbSelect, sbPatch, sbUpload, sbDownload } from './supabase.js'
import { sendText, sendButtons, sendList, sendDocument, marquerLu, alerterEquipe, telechargerMedia, numerosEquipe } from './whatsapp.js'
import { refTerrain, lieuTerrain, ficheTerrain, titreTerrain, fmtSurface, estVendu, refCitee } from './terrains.js'
import {
  extraireFiche, redigerReponse, questionsManquantes, completude, profilDe, nomConnu, vide, ou,
  TYPOLOGIES, ZONAGES, HORIZONS, MODES, LANGUES_CRM, USAGES, STATUTS_JURIDIQUES, DOCS_TERRAIN,
} from './qualification.js'

const BUCKET = 'whatsapp-media'
const DEBOUNCE_MS = () => Number(process.env.DEBOUNCE_SECONDS ?? '5') * 1000
const PAUSE_HEURES = () => Number(process.env.HUMAN_TAKEOVER_PAUSE_HOURS ?? '24')
const MARQUE_NOTES = '[Fiche chatbot WhatsApp]'
const MOTS_STOP = ['stop', 'arret', 'arrêt', 'desabonner', 'désabonner', 'unsubscribe', 'الغاء', 'توقف']
const ACTIONS = ['INTERESSE', 'INFOS', 'VISITE', 'RAPPEL', 'NON', 'RAISON', 'CRENEAU']
export const RAISONS = {
  PRIX: 'Prix trop élevé', ZONE: 'Emplacement', SUP: 'Superficie', ZONAGE: 'Zonage',
  VU: 'Déjà vu ailleurs', BESOIN: 'Pas de besoin actuel', AUTRE: 'Autre',
}
const EXTENSIONS = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'video/mp4': 'mp4', 'video/3gpp': '3gp',
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const aujourdhui = () => new Date().toISOString().slice(0, 10)
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

// ----- Lecture des messages WhatsApp -----
export function analyserMessage(m) {
  const t = m.type
  if (t === 'text') return { type: t, texte: m.text?.body ?? '' }
  if (t === 'location') {
    const l = m.location ?? {}
    const details = [l.name, l.address].filter(Boolean).join(', ')
    return { type: t, texte: `[Position partagée] ${details ? details + ' ' : ''}https://www.google.com/maps?q=${l.latitude},${l.longitude}` }
  }
  if (['image', 'document', 'audio', 'video', 'sticker'].includes(t)) {
    const media = m[t] ?? {}
    const libelles = {
      image: '[Photo envoyée]',
      document: `[Document envoyé : ${media.filename ?? 'sans nom'}]`,
      audio: '[Message vocal]',
      video: '[Vidéo envoyée]',
      sticker: '[Autocollant]',
    }
    return { type: t, texte: libelles[t] + (media.caption ? ` ${media.caption}` : ''), mediaId: t === 'sticker' ? null : media.id }
  }
  if (t === 'interactive') {
    const i = m.interactive ?? {}
    const choix = i.button_reply ?? i.list_reply ?? {}
    return { type: t, texte: choix.title ?? '', action: choix.id ?? '' }
  }
  if (t === 'button') return { type: t, texte: m.button?.text ?? '', action: m.button?.payload ?? '' }
  if (t === 'contacts') {
    const noms = (m.contacts ?? []).map((c) => `${c.name?.formatted_name ?? ''} ${(c.phones ?? []).map((p) => p.phone).join(' ')}`.trim())
    return { type: t, texte: `[Contact partagé] ${noms.join(', ')}` }
  }
  if (t === 'reaction') return { type: t, texte: null }
  return { type: t, texte: '[Message non pris en charge]' }
}

function lireAction(brut) {
  const [action, idTerrain, ...extra] = String(brut ?? '').trim().split(':')
  if (!ACTIONS.includes(action)) return null
  return { action, idTerrain, extra }
}

// ----- Étape 1 (rapide, dans la requête du webhook) : enregistrer le message reçu -----
export async function enregistrerEntrant(message, contact) {
  const tel = normaliserTel(message.from)
  if (!tel) return null
  const lu = analyserMessage(message)
  if (lu.texte == null) return null
  const acheteur = await acheteurParTel(tel).catch(() => null)
  const action = lireAction(lu.action)
  const ligne = await enregistrerMessage({
    acheteur_id: acheteur?.id ?? null,
    telephone: tel,
    direction: 'entrant',
    type: lu.type,
    contenu: lu.texte,
    action: action ? action.action : null,
    terrain_id: action && /^\d+$/.test(action.idTerrain ?? '') ? Number(action.idTerrain) : null,
    auteur: contact?.profile?.name ?? (acheteur?.nom ?? null),
    wa_message_id: message.id ?? null,
  })
  if (!ligne) return null

  const conv = await ouvrirConversation(tel, {
    nom_profil: contact?.profile?.name ?? null,
    acheteur_id: acheteur?.id ?? null,
    profil: acheteur ? 'acheteur' : null,
    fiche: acheteur ? { profil: 'acheteur' } : {},
  })
  const maj = { dernier_entrant: new Date().toISOString(), dernier_message_le: new Date().toISOString() }
  if (!conv.premier_message && lu.type === 'text' && lu.texte.trim()) maj.premier_message = lu.texte.trim().slice(0, 1000)
  if (!conv.nom_profil && contact?.profile?.name) maj.nom_profil = contact.profile.name
  if (!conv.acheteur_id && acheteur) maj.acheteur_id = acheteur.id
  await majConversation(tel, maj)
  if (acheteur) await majAcheteur(acheteur.id, { derniere_interaction: new Date().toISOString() }).catch(() => null)

  return { tel, ligne, lu, action, waId: message.id ?? null }
}

// ----- Étape 2 (en arrière-plan) : médias, boutons, puis qualification -----
export async function traiter(recu) {
  const { tel, ligne, lu, action, waId } = recu
  if (lu.mediaId) await sauverMedia(tel, ligne.id, lu.mediaId)

  if (action) return traiterAction(tel, action, waId)
  if (MOTS_STOP.includes(String(lu.texte).trim().toLowerCase())) return traiterStop(tel)

  const conv = await conversation(tel)
  const cite = refCitee(lu.texte)
  if (cite && conv?.profil === 'acheteur' && botPeutRepondre(conv)) {
    const t = await terrainParRef(cite).catch(() => null)
    if (t && !estVendu(t)) {
      const a = await acheteurParTel(tel)
      return sendButtons(tel, `Vous parlez du terrain ${refTerrain(t)} à ${lieuTerrain(t)}. Que souhaitez-vous ?`, [
        { id: `INFOS:${t.id}`, title: 'Plus d\'infos' },
        { id: `VISITE:${t.id}`, title: 'Programmer visite' },
        { id: `RAPPEL:${t.id}`, title: 'Être rappelé' },
      ], { acheteurId: a?.id, terrainId: t.id })
    }
  }

  // Regroupe les messages envoyés à la suite : seul le dernier déclenche la réponse
  await dormir(DEBOUNCE_MS())
  if ((await dernierEntrantId(tel)) !== ligne.id) return null
  return qualifier(tel, ligne.id, waId)
}

async function sauverMedia(tel, messageId, mediaId) {
  try {
    const { contenu, mime } = await telechargerMedia(mediaId)
    const ext = EXTENSIONS[mime] ?? 'bin'
    const chemin = `${tel}/${messageId}.${ext}`
    await sbUpload(BUCKET, chemin, contenu, mime)
    await majMessage(messageId, { media_path: chemin, media_mime: mime })
  } catch (e) {
    console.error('Média non enregistré', e.message)
  }
}

// Images et PDF reçus depuis la dernière réponse, transmis à Claude pour lecture
async function mediasRecents(messages) {
  const recents = []
  for (const m of [...messages].reverse()) {
    if (m.direction === 'sortant') break
    recents.unshift(m)
  }
  const blocs = []
  for (const m of recents) {
    if (!m.media_path) continue
    const mime = String(m.media_mime ?? '')
    const image = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)
    if (!image && mime !== 'application/pdf') continue
    try {
      const { contenu } = await sbDownload(BUCKET, m.media_path)
      if (image && contenu.length > 4_500_000) continue
      if (contenu.length > 20_000_000) continue
      const data = contenu.toString('base64')
      const bloc = image
        ? { type: 'image', source: { type: 'base64', media_type: mime, data } }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      blocs.push({ id: m.id, bloc })
    } catch (e) {
      console.warn('Média illisible', e.message)
    }
    if (blocs.length >= 5) break
  }
  return blocs
}

async function propositionsDe(acheteur) {
  if (!acheteur) return []
  const reps = await reponsesRecentes(acheteur.id)
  const res = []
  for (const r of reps) res.push({ ...r, terrain: await getTerrain(r.terrain_id).catch(() => null) })
  return res
}

// ----- Qualification par conversation libre -----
export async function qualifier(tel, messageId, waId) {
  let conv = await conversation(tel)
  let acheteur = conv?.acheteur_id ? await acheteurParId(conv.acheteur_id) : await acheteurParTel(tel)
  const messages = await messagesDe(tel, 80)
  const propositions = await propositionsDe(acheteur)
  const peutRepondre = botPeutRepondre(conv)
  if (peutRepondre) await marquerLu(waId)

  const avant = { ...(conv?.fiche ?? {}) }
  if (acheteur && !avant.profil) avant.profil = 'acheteur'
  let extraction
  try {
    extraction = await extraireFiche({ fiche: avant, acheteur, messages, propositions, medias: await mediasRecents(messages) })
  } catch (e) {
    console.error('Lecture de la fiche impossible', e.message)
    extraction = { fiche: avant, reponses: [], documents: [], stop: false }
  }
  const fiche = extraction.fiche
  if (extraction.stop) return traiterStop(tel)

  const profil = profilDe(fiche)
  const champsConv = { fiche, profil: profil ?? fiche.profil ?? null, langue: fiche.langue ?? null }

  // Promoteur ou investisseur : la fiche du CRM est complétée
  if (profil === 'acheteur') {
    if (!acheteur) {
      acheteur = await creerAcheteur({
        nom: fiche.nom ? fiche.nom : (conv?.nom_profil ? conv.nom_profil : `+${tel}`),
        societe: fiche.societe ?? null,
        telephone: tel,
        notes: 'Contact arrivé par le chatbot WhatsApp.',
      })
      await journalActivite('Promoteur créé via WhatsApp', 'acheteur', acheteur.nom, acheteur.id, `+${tel}`)
      await sbPatch('whatsapp_messages', `telephone=eq.${tel}&acheteur_id=is.null`, { acheteur_id: acheteur.id }).catch(() => null)
    }
    champsConv.acheteur_id = acheteur.id
    const { patch, notees } = fusionAcheteur(acheteur, fiche, avant.divergences_notees)
    fiche.divergences_notees = notees
    await majAcheteur(acheteur.id, patch)
    acheteur = { ...acheteur, ...patch }
  }

  // Vendeur ou intermédiaire : le terrain est créé puis complété dans le portefeuille
  if (ou(profil === 'vendeur', profil === 'intermediaire')) {
    const terrainId = await synchroniserTerrain(tel, conv, fiche)
    if (terrainId) champsConv.terrain_id = terrainId
  }

  // Réactions aux terrains proposés, exprimées en texte libre
  if (acheteur) {
    for (const r of extraction.reponses) await enregistrerReaction(acheteur, r)
  }

  // Documents reçus : classés, puis rangés dans la fiche du terrain
  await rangerDocuments(tel, champsConv.terrain_id ?? conv?.terrain_id, extraction.documents, messages, fiche)

  // Avancement de la qualification
  const pct = completude(fiche, acheteur)
  champsConv.completude = pct
  fiche.manquants = questionsManquantes(fiche, acheteur).map((q) => q.l)
  const statutAuto = ['en_cours', 'complete', 'hors_cible'].includes(conv?.statut ?? 'en_cours')
  if (statutAuto && fiche.statut_qualification) champsConv.statut = fiche.statut_qualification
  if (fiche.statut_qualification === 'complete' && !avant.echange_enregistre) {
    fiche.echange_enregistre = true
    await clotureQualification(tel, fiche, acheteur, champsConv.terrain_id ?? conv?.terrain_id)
  }
  await majConversation(tel, champsConv)

  // Réponse au contact
  conv = await conversation(tel)
  if (!botPeutRepondre(conv)) return null
  if ((await dernierEntrantId(tel)) !== messageId) return null
  let texte
  try {
    texte = await redigerReponse({ conv, fiche, acheteur, messages, propositions })
  } catch (e) {
    console.error('Réponse non rédigée', e.message)
    return null
  }
  if (!texte) return null
  conv = await conversation(tel)
  if (!botPeutRepondre(conv)) return null
  if ((await dernierEntrantId(tel)) !== messageId) return null
  return sendText(tel, texte, { acheteurId: acheteur?.id ?? null, terrainId: champsConv.terrain_id ?? null })
}

// ----- Fusion avec la fiche promoteur : on complète, on n'écrase jamais une saisie de l'équipe -----
const SCALAIRES = [
  ['societe', 'societe', 'Société'],
  ['fonction', 'fonction', 'Fonction'],
  ['email', 'email', 'Email'],
  ['sup_min', 'sup_min', 'Superficie min'],
  ['sup_max', 'sup_max', 'Superficie max'],
  ['ticket_min', 'ticket_min', 'Budget min (M DH)'],
  ['ticket_max', 'ticket_max', 'Budget max (M DH)'],
  ['prix_m2_max', 'prix_m2_max', 'Prix max au m²'],
  ['horizon', 'horizon', 'Horizon d\'achat'],
  ['mode_acquisition', 'mode_acquisition', 'Mode d\'acquisition'],
  ['langue_crm', 'langue', 'Langue'],
]
const ENUMS = { horizon: HORIZONS, mode_acquisition: MODES, langue: LANGUES_CRM }
const NUMERIQUES = ['sup_min', 'sup_max', 'ticket_min', 'ticket_max', 'prix_m2_max']

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

function union(actuel, ajout, autorises) {
  const base = Array.isArray(actuel) ? actuel.filter(Boolean) : []
  const res = [...base]
  for (const v of Array.isArray(ajout) ? ajout : []) {
    if (vide(v)) continue
    if (autorises && !autorises.includes(v)) continue
    if (!res.some((x) => norm(x) === norm(v))) res.push(v)
  }
  return res
}

export function fusionAcheteur(a, fiche, dejaNotees) {
  const patch = { derniere_interaction: new Date().toISOString() }
  const notees = Array.isArray(dejaNotees) ? [...dejaNotees] : []
  const divergences = []

  if (!nomConnu(a) && !vide(fiche.nom)) patch.nom = fiche.nom

  for (const [source, col, libelle] of SCALAIRES) {
    let v = fiche[source]
    if (vide(v)) continue
    if (NUMERIQUES.includes(col)) {
      v = num(v)
      if (!v) continue
    }
    if (ENUMS[col] && !ENUMS[col].includes(v)) continue
    const actuel = a[col]
    if (vide(actuel)) patch[col] = v
    else if (norm(actuel) !== norm(v)) {
      const cle = `${col}=${norm(v)}`
      if (!notees.includes(cle)) {
        notees.push(cle)
        divergences.push(`${libelle} : la fiche indique « ${actuel} », le contact dit « ${v} »`)
      }
    }
  }

  const listes = [['villes', null], ['quartiers', null], ['typologies', TYPOLOGIES], ['zonages', ZONAGES]]
  for (const [col, autorises] of listes) {
    const res = union(a[col], fiche[col], autorises)
    if (res.length !== (Array.isArray(a[col]) ? a[col].filter(Boolean).length : 0)) patch[col] = res
  }
  if (patch.villes) patch.zones = patch.villes.join(', ')

  if (fiche.consentement_whatsapp === 'oui' && a.whatsapp_consentement !== 'Non') patch.whatsapp_consentement = 'Oui'
  if (fiche.consentement_whatsapp === 'non') {
    patch.whatsapp_consentement = 'Non'
    patch.whatsapp_stop = true
  }

  const criteres = [
    ou(!vide(fiche.villes), !vide(fiche.quartiers)), !vide(fiche.typologies), !vide(fiche.zonages),
    ou(num(fiche.sup_min), num(fiche.sup_max)), ou(num(fiche.ticket_min), num(fiche.ticket_max), num(fiche.prix_m2_max)), !vide(fiche.horizon),
  ].filter(Boolean).length
  if (criteres >= 2 && ['À qualifier', 'Froid', '', null, undefined].includes(a.statut)) patch.statut = 'Tiède'

  if (divergences.length) {
    const date = new Date().toLocaleDateString('fr-FR')
    const ajout = divergences.map((d) => `WhatsApp ${date}, à vérifier : ${d}`).join('\n')
    patch.notes = a.notes ? `${a.notes}\n${ajout}` : ajout
  }
  return { patch, notees }
}

// ----- Terrain proposé par un vendeur ou un intermédiaire -----
function notesTerrain(tel, fiche) {
  const lignes = [
    MARQUE_NOTES,
    `Contact : ${fiche.nom ? fiche.nom : 'nom à demander'} (+${tel})${fiche.role ? ', ' + fiche.role : ''}`,
    fiche.mandat ? `Mandat : ${fiche.mandat}` : null,
    fiche.statut_foncier ? `Statut foncier : ${fiche.statut_foncier}` : null,
    fiche.proprietaires ? `Propriété : ${fiche.proprietaires}` : null,
    fiche.prix_negociable ? `Prix négociable : ${fiche.prix_negociable}` : null,
    fiche.viabilisation ? `Viabilisation : ${fiche.viabilisation}` : null,
    fiche.acces_facade ? `Accès et façade : ${fiche.acces_facade}` : null,
    fiche.occupation ? `Occupation : ${fiche.occupation}` : null,
    fiche.documents ? `Documents : ${fiche.documents}` : null,
    fiche.delai ? `Délai : ${fiche.delai}` : null,
    fiche.creneau_appel ? `Créneau d'appel : ${fiche.creneau_appel}` : null,
    fiche.resume_pour_appel ? `\n${fiche.resume_pour_appel}` : null,
  ]
  return lignes.filter(Boolean).join('\n')
}

export function valeursTerrain(tel, fiche) {
  const sup = num(fiche.superficie_m2)
  const global = num(fiche.prix_global_mdh)
  let prix = num(fiche.prix_m2)
  if (!prix && global && sup) prix = Math.round((global * 1e6) / sup)
  let forfait = global
  if (!forfait && prix && sup) forfait = Math.round((prix * sup) / 1e5) / 10
  const v = {
    localisation: fiche.quartier ? fiche.quartier : (fiche.ville ?? null),
    quartier: fiche.quartier ?? null,
    superficie: sup,
    prix,
    forfait,
    urba: fiche.urba ?? null,
    usage: USAGES.includes(fiche.usage) ? fiche.usage : null,
    tf: fiche.numero_titre ?? null,
    statut_juridique: STATUTS_JURIDIQUES.includes(fiche.statut_juridique) ? fiche.statut_juridique : null,
    google_map: fiche.localisation_gps ?? null,
    notes: notesTerrain(tel, fiche),
  }
  return Object.fromEntries(Object.entries(v).filter(([, x]) => !vide(x)))
}

async function synchroniserTerrain(tel, conv, fiche) {
  const vals = valeursTerrain(tel, fiche)
  if (!conv?.terrain_id) {
    if (!vals.localisation) return null
    if (!vals.superficie) return null
    try {
      const t = await creerTerrain(vals)
      fiche.terrain_cree_par_bot = true
      await journalActivite('Terrain reçu via WhatsApp', 'terrain', vals.localisation, t.id, `${fmtSurface(vals.superficie)}, contact +${tel}`)
      await alerterEquipe(`Nouveau terrain proposé sur WhatsApp : ${vals.localisation}, ${fmtSurface(vals.superficie)}, contact +${tel}. Fiche dans le CRM, ${refTerrain(t)}.`)
      return t.id
    } catch (e) {
      console.error('Terrain non créé', e.message)
      return null
    }
  }
  const t = await getTerrain(conv.terrain_id)
  if (!t) return conv.terrain_id
  const libre = ou(fiche.terrain_cree_par_bot === true, t.sourceur === 'WhatsApp') && t.statut === 'À qualifier'
  const patch = {}
  for (const [col, v] of Object.entries(vals)) {
    if (col === 'notes') {
      if (ou(vide(t.notes), String(t.notes).startsWith(MARQUE_NOTES)) && t.notes !== v) patch.notes = v
      continue
    }
    if (col === 'statut_juridique' && !vide(t.statut_juridique)) continue
    if (vide(t[col])) patch[col] = v
    else if (libre && String(t[col]) !== String(v)) patch[col] = v
  }
  await majTerrain(t.id, patch)
  return t.id
}

// ----- Documents envoyés par le contact -----
const LIBELLES_DOCS = { note_renseignement: 'Note de renseignement', certificat_propriete: 'Certificat de propriété', plan_cadastral: 'Plan cadastral', photo_terrain: 'Photo du terrain', autre: 'Document' }

async function rangerDocuments(tel, terrainId, documents, messages, fiche) {
  for (const d of documents ?? []) {
    const m = messages.find((x) => Number(x.id) === Number(d.message_id))
    if (!m) continue
    if (m.direction !== 'entrant') continue
    if (!m.action) await majMessage(m.id, { action: `document:${d.type}` }).catch(() => null)
    m.action = `document:${d.type}`
  }
  if (!terrainId) return
  const ranges = Array.isArray(fiche.documents_ranges) ? fiche.documents_ranges : []
  for (const m of messages) {
    const type = String(m.action ?? '').startsWith('document:') ? m.action.slice(9) : null
    if (!DOCS_TERRAIN.includes(type)) continue
    if (!m.media_path) continue
    if (ranges.includes(m.id)) continue
    const mime = String(m.media_mime ?? '')
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mime)) continue
    try {
      if (await documentTerrain(terrainId, type)) {
        ranges.push(m.id)
        continue
      }
      const { contenu } = await sbDownload(BUCKET, m.media_path)
      const ext = m.media_path.split('.').pop()
      const chemin = `${terrainId}/${type}/${Date.now()}-whatsapp.${ext}`
      await sbUpload('terrain-docs', chemin, contenu, mime)
      await ajouterDocumentTerrain({
        terrain_id: String(terrainId), type, nom_fichier: `${LIBELLES_DOCS[type]} (WhatsApp +${tel}).${ext}`,
        chemin, taille: contenu.length, mime, ajoute_par: 'Chatbot WhatsApp',
      })
      ranges.push(m.id)
    } catch (e) {
      console.error('Document non rangé', e.message)
    }
  }
  fiche.documents_ranges = ranges
}

// ----- Réaction à un terrain proposé, exprimée en texte libre -----
async function enregistrerReaction(acheteur, r) {
  const terrain = await getTerrain(r.terrain_id).catch(() => null)
  if (!terrain) return
  const champs = { statut: r.statut }
  if (r.statut === 'refuse') champs.raison_refus = r.raison_refus ?? null
  if (r.creneau_visite) champs.creneau_visite = r.creneau_visite
  await majReponse(acheteur.id, terrain.id, champs)
  const libelles = { infos: 'Demande d\'infos', interesse: 'Intéressé', visite_souhaitee: 'Visite souhaitée', rappel: 'À rappeler', refuse: 'Refusé' }
  const detail = `${titreTerrain(terrain)} : ${libelles[r.statut] ?? r.statut}${r.raison_refus ? ' (' + r.raison_refus + ')' : ''}`
  await journalActivite('Réponse promoteur', 'acheteur', acheteur.nom, acheteur.id, `${detail}, via WhatsApp`)
  if (r.statut === 'refuse') await majDeal(acheteur.id, terrain.id, { prochaine_action: `Refusé via WhatsApp${r.raison_refus ? ' : ' + r.raison_refus : ''}` })
  else {
    await majDeal(acheteur.id, terrain.id, { prochaine_action: `Rappeler : ${libelles[r.statut]} via WhatsApp`, date_action: aujourdhui() })
    await alerterEquipe(`${acheteur.nom} (+${acheteur.telephone}) : ${detail}`)
  }
}

// ----- Fin de qualification : échange enregistré dans le CRM pour préparer l'appel -----
async function clotureQualification(tel, fiche, acheteur, terrainId) {
  const points = Array.isArray(fiche.points_a_verifier) ? fiche.points_a_verifier : []
  const retour = [
    'Qualification par le chatbot WhatsApp terminée.',
    fiche.resume_pour_appel ?? '',
    fiche.creneau_appel ? `Créneau d'appel souhaité : ${fiche.creneau_appel}` : '',
    points.length ? `Points à vérifier :\n${points.map((p) => '. ' + p).join('\n')}` : '',
  ].filter(Boolean).join('\n')
  await ajouterEchange({ acheteur, terrainId, retour })
  const qui = acheteur ? acheteur.nom : (fiche.nom ? fiche.nom : `+${tel}`)
  await journalActivite('Qualification WhatsApp terminée', acheteur ? 'acheteur' : 'terrain', qui, acheteur ? acheteur.id : terrainId, fiche.creneau_appel ? `Appel souhaité : ${fiche.creneau_appel}` : '')
  await alerterEquipe(`Fiche prête pour appel : ${qui} (+${tel}). ${fiche.creneau_appel ? 'Créneau : ' + fiche.creneau_appel + '.' : ''}`)
}

// ----- Désinscription -----
async function traiterStop(tel) {
  const conv = await conversation(tel)
  const a = await acheteurParTel(tel)
  if (a) {
    await majAcheteur(a.id, { whatsapp_stop: true, whatsapp_consentement: 'Non' })
    await journalActivite('Désinscription WhatsApp', 'acheteur', a.nom, a.id)
  }
  const fiche = { ...(conv?.fiche ?? {}), stop: true }
  await majConversation(tel, { fiche, bot_actif: false, statut: 'hors_cible' })
  await alerterEquipe(`+${tel}${a ? ' (' + a.nom + ')' : ''} ne souhaite plus recevoir de messages`)
  if (conv?.fiche?.stop) return null
  return sendText(tel, 'C\'est noté, vous ne recevrez plus nos propositions. Merci et à bientôt.', { acheteurId: a?.id })
}

// ----- Boutons des teasers -----
export function creneaux(depuis = new Date()) {
  const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
  const lignes = []
  const d = new Date(Date.UTC(depuis.getUTCFullYear(), depuis.getUTCMonth(), depuis.getUTCDate(), 12))
  let jours = 0
  while (jours < 5) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() === 0) continue
    jours += 1
    const iso = d.toISOString().slice(0, 10)
    const label = fmt.format(d)
    lignes.push({ iso, moment: 'AM', titre: `${label} matin`, description: 'Entre 9h et 12h' })
    if (d.getUTCDay() !== 6) lignes.push({ iso, moment: 'PM', titre: `${label} après-midi`, description: 'Entre 14h et 17h30' })
  }
  return lignes.slice(0, 10)
}

export function libelleCreneau(iso, moment) {
  const jour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`))
  return `${jour} ${moment === 'AM' ? 'matin (9h à 12h)' : 'après-midi (14h à 17h30)'}`
}

async function traiterAction(tel, { action, idTerrain, extra }, waId) {
  await marquerLu(waId)
  let acheteur = await acheteurParTel(tel)
  if (!acheteur) {
    const conv = await conversation(tel)
    acheteur = await creerAcheteur({ nom: conv?.nom_profil ? conv.nom_profil : `+${tel}`, telephone: tel, notes: 'Contact arrivé par un bouton WhatsApp.' })
    await majConversation(tel, { acheteur_id: acheteur.id, profil: 'acheteur', fiche: { ...(conv?.fiche ?? {}), profil: 'acheteur' } })
  }
  const terrain = await getTerrain(idTerrain)
  const nom = nomConnu(acheteur) ? acheteur.nom : ''
  const meta = { acheteurId: acheteur.id, terrainId: terrain?.id ?? null }
  const qui = `${acheteur.nom} (+${tel})`

  if (!terrain && action !== 'RAPPEL') {
    await alerterEquipe(`${qui} a répondu sur un terrain introuvable (${action}:${idTerrain})`)
    return sendText(tel, 'Merci pour votre réponse. Un conseiller GREENFIELD revient vers vous très vite.', meta)
  }
  if (terrain && estVendu(terrain)) {
    return sendButtons(tel,
      `Merci pour votre retour. Le terrain ${refTerrain(terrain)} n'est malheureusement plus disponible.\n\nSouhaitez-vous qu'un conseiller vous propose des terrains similaires ?`,
      [{ id: `RAPPEL:${terrain.id}`, title: 'Oui, rappelez-moi' }], meta)
  }

  if (action === 'INTERESSE') {
    await majReponse(acheteur.id, terrain.id, { statut: 'interesse' })
    await majDeal(acheteur.id, terrain.id, { prochaine_action: 'Rappeler : intéressé via WhatsApp', date_action: aujourdhui() })
    await journalActivite('Réponse promoteur', 'acheteur', acheteur.nom, acheteur.id, `${titreTerrain(terrain)} : Intéressé, via WhatsApp`)
    await alerterEquipe(`${qui} est intéressé par ${titreTerrain(terrain)}`)
    return sendButtons(tel,
      `Merci${nom ? ' ' + nom : ''}, c'est noté : le terrain ${refTerrain(terrain)} à ${lieuTerrain(terrain)} vous intéresse.\n\nQue souhaitez-vous faire maintenant ?`,
      [
        { id: `INFOS:${terrain.id}`, title: 'Plus d\'infos' },
        { id: `VISITE:${terrain.id}`, title: 'Programmer visite' },
        { id: `RAPPEL:${terrain.id}`, title: 'Être rappelé' },
      ], meta)
  }

  if (action === 'INFOS') {
    await majReponse(acheteur.id, terrain.id, { statut: 'infos' })
    await sendText(tel, ficheTerrain(terrain), meta)
    if (terrain.teaser_url) await sendDocument(tel, terrain.teaser_url, `Teaser ${refTerrain(terrain)}.pdf`, `Teaser ${refTerrain(terrain)}`, meta)
    return sendButtons(tel, 'Souhaitez-vous aller plus loin ?', [
      { id: `VISITE:${terrain.id}`, title: 'Programmer visite' },
      { id: `RAPPEL:${terrain.id}`, title: 'Être rappelé' },
      { id: `NON:${terrain.id}`, title: 'Pas intéressé' },
    ], meta)
  }

  if (action === 'VISITE') {
    await majReponse(acheteur.id, terrain.id, { statut: 'visite_souhaitee' })
    const rows = creneaux().map((c) => ({ id: `CRENEAU:${terrain.id}:${c.iso}:${c.moment}`, title: c.titre.slice(0, 24), description: c.description }))
    return sendList(tel,
      `Avec plaisir. Choisissez le créneau qui vous convient pour visiter le terrain ${refTerrain(terrain)} (${fmtSurface(terrain.superficie)}).\n\nAucun ne convient ? Écrivez simplement vos disponibilités ici.`,
      'Voir les créneaux', 'Créneaux disponibles', rows, meta)
  }

  if (action === 'CRENEAU') {
    const [iso, moment] = extra
    const libelle = libelleCreneau(iso, moment)
    await majReponse(acheteur.id, terrain.id, { statut: 'visite_demandee', creneau_visite: libelle })
    await majDeal(acheteur.id, terrain.id, { prochaine_action: `Confirmer la visite : ${libelle}`, date_action: iso })
    await journalActivite('Visite demandée via WhatsApp', 'acheteur', acheteur.nom, acheteur.id, `${titreTerrain(terrain)} : ${libelle}`)
    await alerterEquipe(`Visite demandée par ${qui} pour ${titreTerrain(terrain)} : ${libelle}. A confirmer.`)
    return sendText(tel,
      `Parfait, votre demande de visite du terrain ${refTerrain(terrain)} est enregistrée pour *${libelle}*.\n\nUn conseiller GREENFIELD vous confirme le rendez-vous et le point de rencontre sous 24h.`, meta)
  }

  if (action === 'RAPPEL') {
    if (terrain) {
      await majReponse(acheteur.id, terrain.id, { statut: 'rappel' })
      await majDeal(acheteur.id, terrain.id, { prochaine_action: 'Rappeler : demande via WhatsApp', date_action: aujourdhui() })
    }
    await journalActivite('Demande de rappel WhatsApp', 'acheteur', acheteur.nom, acheteur.id, terrain ? titreTerrain(terrain) : '')
    await alerterEquipe(`${qui} demande à être rappelé au sujet de ${terrain ? titreTerrain(terrain) : 'nos terrains'}`)
    return sendText(tel, 'C\'est noté. Un conseiller GREENFIELD vous appelle dans les meilleurs délais.', meta)
  }

  if (action === 'NON') {
    await majReponse(acheteur.id, terrain.id, { statut: 'refuse' })
    await majDeal(acheteur.id, terrain.id, { prochaine_action: 'Refusé via WhatsApp' })
    const rows = Object.entries(RAISONS).map(([k, l]) => ({ id: `RAISON:${terrain.id}:${k}`, title: l.slice(0, 24) }))
    return sendList(tel, 'Merci pour votre retour. Pour mieux cibler nos prochaines propositions, qu\'est-ce qui ne correspond pas ?', 'Choisir une raison', 'Raison', rows, meta)
  }

  if (action === 'RAISON') {
    const raison = RAISONS[extra[0]] ?? 'Autre'
    await majReponse(acheteur.id, terrain.id, { statut: 'refuse', raison_refus: raison })
    await majDeal(acheteur.id, terrain.id, { prochaine_action: `Refusé via WhatsApp : ${raison}` })
    await journalActivite('Réponse promoteur', 'acheteur', acheteur.nom, acheteur.id, `${titreTerrain(terrain)} : Refusé (${raison}), via WhatsApp`)
    return sendText(tel, 'Merci, c\'est noté. Nous vous enverrons uniquement des terrains qui correspondent mieux à vos critères.', meta)
  }
  return null
}

// ----- Messages envoyés depuis l'application WhatsApp Business (coexistence) -----
export async function enregistrerEcho(echo) {
  const tel = normaliserTel(echo.to)
  if (!tel) return
  if (numerosEquipe().includes(tel)) return
  if (await messageParWaId(echo.id)) return
  const lu = analyserMessage(echo)
  if (lu.texte == null) return
  const acheteur = await acheteurParTel(tel).catch(() => null)

  // Teaser ouvert depuis le CRM (bouton WhatsApp) puis envoyé depuis le téléphone : déjà tracé
  const recents = await sbSelect('whatsapp_messages', `telephone=eq.${tel}&direction=eq.sortant&wa_message_id=is.null&order=id.desc&limit=5`).catch(() => [])
  const limite = Date.now() - 30 * 60 * 1000
  const deja = recents.find((m) => new Date(m.created_at).getTime() > limite && norm(m.contenu) === norm(lu.texte))
  if (deja) {
    await majMessage(deja.id, { wa_message_id: echo.id })
    if (deja.action !== 'teaser') await pauserBot(tel, PAUSE_HEURES()).catch(() => null)
    return
  }
  await enregistrerMessage({
    acheteur_id: acheteur?.id ?? null,
    telephone: tel,
    direction: 'sortant',
    type: lu.type,
    contenu: lu.texte,
    auteur: 'Conseiller (téléphone)',
    wa_message_id: echo.id ?? null,
  })
  await ouvrirConversation(tel, { acheteur_id: acheteur?.id ?? null, profil: acheteur ? 'acheteur' : null, fiche: acheteur ? { profil: 'acheteur' } : {} })
  await pauserBot(tel, PAUSE_HEURES())
}

// ----- Statuts d'envoi : échec signalé dans l'historique du CRM -----
export async function enregistrerStatut(s) {
  if (s.status !== 'failed') return
  const code = s.errors?.[0]?.code
  const raison = code === 131047
    ? 'Non délivré : plus de 24h sans message du contact, il faut un modèle validé par Meta'
    : `Non délivré : ${s.errors?.[0]?.title ?? 'erreur WhatsApp'}`
  await sbPatch('whatsapp_messages', `wa_message_id=eq.${encodeURIComponent(s.id)}`, { action: raison }).catch(() => null)
}

// ----- Point d'entrée : un appel du webhook -----
// Renvoie les traitements à poursuivre en arrière-plan, après la réponse 200 au webhook
export async function recevoir(data) {
  const suites = []
  for (const entry of data?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {}
      if (change.field === 'smb_message_echoes') {
        for (const e of v.message_echoes ?? []) await enregistrerEcho(e).catch((err) => console.error('Echo', err.message))
        continue
      }
      for (const s of v.statuses ?? []) await enregistrerStatut(s)
      const contacts = v.contacts ?? []
      for (const message of v.messages ?? []) {
        if (numerosEquipe().includes(normaliserTel(message.from))) continue
        const contact = contacts.find((c) => c.wa_id === message.from) ?? contacts[0]
        try {
          const recu = await enregistrerEntrant(message, contact)
          if (recu) suites.push(() => traiter(recu))
        } catch (e) {
          console.error('Message non enregistré', e)
        }
      }
    }
  }
  return suites
}

export { questionsManquantes }
