// Scénario WhatsApp de relance après teaser, branché sur le CRM
//
// Chaque bouton porte "ACTION:id_terrain[:détail]" (id du terrain dans le CRM).
// Chaque réponse met à jour : la fiche acheteur, l'historique de conversation,
// le statut du terrain pour cet acheteur, le deal du pipeline et le journal d'activité.
import { sendText, sendButtons, sendList, sendDocument, sendLocation, markAsRead, alerterEquipe } from './whatsapp.js'
import { trouverOuCreerAcheteur, majAcheteur, getTerrain, enregistrerMessage, majReponse, majDeal, journalActivite, normaliserTel } from './crm.js'
import { sbSelect } from './supabase.js'
import { refTerrain, lieuTerrain, ficheTerrain, titreTerrain, fmtSurface, estVendu } from './terrains.js'

const MOTS_STOP = ['stop', 'arret', 'arrêt', 'desabonner', 'désabonner', 'unsubscribe']
const ACTIONS = ['INTERESSE', 'INFOS', 'VISITE', 'RAPPEL', 'NON', 'RAISON', 'CRENEAU']
export const RAISONS = { PRIX: 'Prix trop élevé', ZONE: 'Localisation', TAILLE: 'Superficie ou zonage' }

// 5 prochains jours ouvrés, matin et après-midi (samedi matin seulement)
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
  const jour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${iso}T12:00:00Z`))
  return `${jour} ${moment === 'AM' ? 'matin (9h à 12h)' : 'après-midi (14h à 17h30)'}`
}

function lireAction(message) {
  if (message.type === 'button') return message.button?.payload ?? message.button?.text ?? ''
  if (message.type === 'interactive') {
    const i = message.interactive
    return i?.button_reply?.id ?? i?.list_reply?.id ?? ''
  }
  if (message.type === 'text') return message.text?.body ?? ''
  return ''
}

function texteLisible(message, brut) {
  if (message.type === 'button') return message.button?.text ?? brut
  if (message.type === 'interactive') return message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? brut
  return brut ? brut : `[${message.type}]`
}

export async function traiterMessage(message, contact) {
  const tel = message.from
  const profil = contact?.profile?.name ?? ''
  await markAsRead(message.id)

  const acheteur = await trouverOuCreerAcheteur(tel, profil)
  const nom = acheteur.contact ? acheteur.contact : (acheteur.nom ? acheteur.nom : profil)
  const brut = lireAction(message).trim()
  const [action, idTerrain, ...extra] = brut.split(':')
  const estAction = ACTIONS.includes(action)
  const terrain = estAction ? await getTerrain(idTerrain) : null

  // Historique : message entrant
  await enregistrerMessage({
    acheteur_id: acheteur.id,
    telephone: tel,
    direction: 'entrant',
    type: message.type,
    contenu: texteLisible(message, brut),
    action: estAction ? action : null,
    terrain_id: terrain?.id ?? null,
    auteur: nom,
    wa_message_id: message.id,
  })
  await majAcheteur(acheteur.id, { derniere_interaction: new Date().toISOString() })

  const meta = { acheteurId: acheteur.id, terrainId: terrain?.id ?? null }
  const qui = `${acheteur.nom} (+${tel})`
  const aujourdhui = new Date().toISOString().slice(0, 10)

  if (estAction && !terrain && action !== 'RAPPEL') {
    await alerterEquipe(`${qui} a répondu sur un terrain introuvable (${brut})`)
    return sendText(tel, 'Merci pour votre réponse. Un conseiller Greenfield revient vers vous très vite.', meta)
  }
  if (estAction && terrain && estVendu(terrain)) {
    return sendButtons(tel,
      `Merci pour votre retour. Le terrain ${refTerrain(terrain)} n'est malheureusement plus disponible.\n\nSouhaitez-vous qu'un conseiller vous propose des terrains similaires ?`,
      [{ id: `RAPPEL:${terrain.id}`, title: 'Oui, rappelez-moi' }], meta)
  }

  switch (action) {
    case 'INTERESSE': {
      await majReponse(acheteur.id, terrain.id, { statut: 'interesse' })
      await majDeal(acheteur.id, terrain.id, { prochaine_action: 'Rappeler : intéressé via WhatsApp', date_action: aujourdhui })
      await journalActivite('Intérêt WhatsApp', 'acheteur', acheteur.nom, acheteur.id, titreTerrain(terrain))
      await alerterEquipe(`${qui} est intéressé par ${titreTerrain(terrain)}`)
      return sendButtons(tel,
        `Merci ${nom}, c'est noté : le terrain ${refTerrain(terrain)} à ${lieuTerrain(terrain)} vous intéresse.\n\nQue souhaitez-vous faire maintenant ?`,
        [
          { id: `INFOS:${terrain.id}`, title: 'Plus d\'infos' },
          { id: `VISITE:${terrain.id}`, title: 'Programmer visite' },
          { id: `RAPPEL:${terrain.id}`, title: 'Être rappelé' },
        ], meta)
    }

    case 'INFOS': {
      await majReponse(acheteur.id, terrain.id, { statut: 'infos' })
      await sendText(tel, ficheTerrain(terrain), meta)
      if (terrain.teaser_url) await sendDocument(tel, terrain.teaser_url, `Teaser ${refTerrain(terrain)}.pdf`, `Teaser ${refTerrain(terrain)}`, meta)
      if (process.env.SHARE_LOCATION === '1' && terrain.lat) await sendLocation(tel, terrain.lat, terrain.lon, titreTerrain(terrain), meta)
      return sendButtons(tel, 'Souhaitez-vous aller plus loin ?', [
        { id: `VISITE:${terrain.id}`, title: 'Programmer visite' },
        { id: `RAPPEL:${terrain.id}`, title: 'Être rappelé' },
        { id: `NON:${terrain.id}`, title: 'Pas intéressé' },
      ], meta)
    }

    case 'VISITE': {
      await majReponse(acheteur.id, terrain.id, { statut: 'visite_souhaitee' })
      const rows = creneaux().map((c) => ({ id: `CRENEAU:${terrain.id}:${c.iso}:${c.moment}`, title: c.titre.slice(0, 24), description: c.description }))
      return sendList(tel,
        `Avec plaisir. Choisissez le créneau qui vous convient pour visiter le terrain ${refTerrain(terrain)} de ${fmtSurface(terrain.superficie)}.\n\nAucun ne convient ? Écrivez simplement vos disponibilités ici.`,
        'Voir les créneaux', 'Créneaux disponibles', rows, meta)
    }

    case 'CRENEAU': {
      const [iso, moment] = extra
      const libelle = libelleCreneau(iso, moment)
      await majReponse(acheteur.id, terrain.id, { statut: 'visite_demandee', creneau_visite: libelle })
      await majDeal(acheteur.id, terrain.id, { prochaine_action: `Confirmer la visite : ${libelle}`, date_action: iso })
      await journalActivite('Visite demandée via WhatsApp', 'acheteur', acheteur.nom, acheteur.id, `${titreTerrain(terrain)} : ${libelle}`)
      await alerterEquipe(`Visite demandée par ${qui} pour ${titreTerrain(terrain)} : ${libelle}. A confirmer.`)
      return sendText(tel,
        `Parfait, votre demande de visite du terrain ${refTerrain(terrain)} est enregistrée pour *${libelle}*.\n\nUn conseiller Greenfield vous confirme le rendez-vous et le point de rencontre sous 24h.`, meta)
    }

    case 'RAPPEL': {
      if (terrain) {
        await majReponse(acheteur.id, terrain.id, { statut: 'rappel' })
        await majDeal(acheteur.id, terrain.id, { prochaine_action: 'Rappeler : demande via WhatsApp', date_action: aujourdhui })
      }
      await journalActivite('Demande de rappel WhatsApp', 'acheteur', acheteur.nom, acheteur.id, terrain ? titreTerrain(terrain) : '')
      await alerterEquipe(`${qui} demande à être rappelé au sujet de ${terrain ? titreTerrain(terrain) : 'nos terrains'}`)
      return sendText(tel, 'C\'est noté. Un conseiller Greenfield vous appelle dans les meilleurs délais.', meta)
    }

    case 'NON': {
      await majReponse(acheteur.id, terrain.id, { statut: 'refuse' })
      await majDeal(acheteur.id, terrain.id, { prochaine_action: 'Refusé via WhatsApp' })
      return sendButtons(tel,
        'Merci pour votre retour. Pour mieux cibler nos prochaines propositions, qu\'est-ce qui ne correspond pas ?',
        [
          { id: `RAISON:${terrain.id}:PRIX`, title: 'Le prix' },
          { id: `RAISON:${terrain.id}:ZONE`, title: 'La localisation' },
          { id: `RAISON:${terrain.id}:TAILLE`, title: 'Superficie/zonage' },
        ], meta)
    }

    case 'RAISON': {
      const raison = RAISONS[extra[0]] ?? extra[0]
      await majReponse(acheteur.id, terrain.id, { statut: 'refuse', raison_refus: raison })
      await majDeal(acheteur.id, terrain.id, { prochaine_action: `Refusé via WhatsApp : ${raison}` })
      await journalActivite('Refus WhatsApp', 'acheteur', acheteur.nom, acheteur.id, `${titreTerrain(terrain)} : ${raison}`)
      return sendText(tel, 'Merci, c\'est noté. Nous vous enverrons uniquement des terrains qui correspondent mieux à vos critères.', meta)
    }
  }

  // Messages libres
  if (MOTS_STOP.includes(brut.toLowerCase())) {
    await majAcheteur(acheteur.id, { whatsapp_stop: true })
    await journalActivite('Désinscription WhatsApp', 'acheteur', acheteur.nom, acheteur.id)
    await alerterEquipe(`${qui} ne souhaite plus recevoir de teasers`)
    return sendText(tel, 'Vous ne recevrez plus nos propositions de terrains. Merci et à bientôt.', meta)
  }

  const ref = brut.match(/GF-?(\d+)/i)
  const cite = ref ? await getTerrain(ref[1]) : null
  if (cite && !estVendu(cite)) {
    return sendButtons(tel, `Vous parlez du terrain ${refTerrain(cite)} à ${lieuTerrain(cite)}. Que souhaitez-vous ?`, [
      { id: `INFOS:${cite.id}`, title: 'Plus d\'infos' },
      { id: `VISITE:${cite.id}`, title: 'Programmer visite' },
      { id: `RAPPEL:${cite.id}`, title: 'Être rappelé' },
    ], { acheteurId: acheteur.id, terrainId: cite.id })
  }

  await alerterEquipe(`Message de ${qui} : ${brut ? brut : message.type}`)
  // Si un conseiller échange déjà avec ce contact depuis le CRM, le bot se tait
  if (await conseillerActif(tel)) return null
  return sendText(tel, 'Merci pour votre message. Un conseiller Greenfield vous répond très vite.', meta)
}

async function conseillerActif(tel) {
  try {
    const [dernier] = await sbSelect('whatsapp_messages', `telephone=eq.${normaliserTel(tel)}&direction=eq.sortant&order=id.desc&limit=1`)
    if (!dernier ? true : dernier.auteur === 'bot') return false
    return Date.now() - new Date(dernier.created_at).getTime() < 24 * 3600 * 1000
  } catch {
    return false
  }
}
