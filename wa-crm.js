// ===== Page WhatsApp du CRM : conversations du chatbot, fiches d'appel, reprise par un conseiller =====
// Chargé par index.html. Utilise SUPA_URL, SUPA_HEADERS, state, prOpen, openTerrainDetail et showNotif du CRM.
(function () {
  const SC = String.fromCharCode(59)
  const ENT = { '&': '&amp', '<': '&lt', '>': '&gt', '"': '&quot', '\'': '&#39' }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ENT[c] + SC)
  const jsArg = (s) => esc(JSON.stringify(String(s ?? '')))

  const STATUTS = {
    en_cours: ['En cours', 'wa-b-cours'],
    complete: ['Prêt pour appel', 'wa-b-pret'],
    appele: ['Appelé', 'wa-b-appele'],
    a_relancer: ['À relancer', 'wa-b-relance'],
    hors_cible: ['Hors cible', 'wa-b-hors'],
  }
  const PROFILS = { acheteur: 'Promoteur ou acheteur', vendeur: 'Vendeur', intermediaire: 'Intermédiaire', autre: 'Autre' }
  const CHAMPS = [
    ['profil', 'Profil'], ['langue', 'Langue'], ['nom', 'Nom'], ['societe', 'Société'], ['fonction', 'Fonction'], ['email', 'Email'], ['role', 'Rôle'], ['mandat', 'Mandat'],
    ['villes', 'Villes recherchées'], ['quartiers', 'Quartiers recherchés'], ['typologies', 'Produits développés'], ['zonages', 'Zonages recherchés'],
    ['sup_min', 'Superficie min (m²)'], ['sup_max', 'Superficie max (m²)'], ['ticket_min', 'Budget min (M DH)'], ['ticket_max', 'Budget max (M DH)'], ['prix_m2_max', 'Prix max (DH/m²)'],
    ['horizon', 'Horizon d\'achat'], ['mode_acquisition', 'Mode d\'acquisition'], ['projet', 'Projet'],
    ['ville', 'Ville'], ['quartier', 'Quartier'], ['localisation_gps', 'Localisation'], ['superficie_m2', 'Superficie (m²)'], ['statut_foncier', 'Statut foncier'], ['numero_titre', 'N° titre ou réquisition'],
    ['proprietaires', 'Propriété'], ['urba', 'Zonage'], ['usage', 'Usage'], ['prix_m2', 'Prix demandé (DH/m²)'], ['prix_global_mdh', 'Prix global (M DH)'], ['prix_negociable', 'Négociable'],
    ['viabilisation', 'Viabilisation'], ['acces_facade', 'Accès et façade'], ['occupation', 'Occupation'], ['documents', 'Documents'], ['delai', 'Délai'],
    ['consentement_whatsapp', 'Accord WhatsApp'], ['creneau_appel', 'Créneau d\'appel'], ['telephone_appel', 'Téléphone d\'appel'],
  ]

  const WA = { convs: [], msgs: [], open: null, ok: true, charge: false, statut: '', profil: '', q: '' }

  // ----- Styles (construits sans point-virgule dans le fichier) -----
  const regle = (sel, o) => `${sel}{${Object.entries(o).map(([k, v]) => `${k}:${v}`).join(SC)}}`
  const css = [
    regle('.wa-kpis', { display: 'grid', 'grid-template-columns': 'repeat(4,1fr)', gap: '12px', 'margin-bottom': '16px' }),
    regle('.wa-kpi', { background: '#fff', 'border-radius': '14px', padding: '14px 16px', color: '#1d2b23' }),
    regle('.wa-kpi b', { display: 'block', 'font-family': '\'Syne\',sans-serif', 'font-size': '24px', color: 'var(--green-deep)' }),
    regle('.wa-kpi span', { 'font-size': '12px', color: '#6b7f73' }),
    regle('.wa-bar', { display: 'flex', gap: '10px', 'flex-wrap': 'wrap', 'margin-bottom': '14px', 'align-items': 'center' }),
    regle('.wa-bar input, .wa-bar select', { padding: '9px 12px', 'border-radius': '10px', border: '1px solid rgba(45,158,95,0.3)', background: '#0d3320', color: '#f8faf9', 'font-size': '13px' }),
    regle('.wa-bar input', { flex: '1', 'min-width': '200px' }),
    regle('.wa-liste', { display: 'grid', gap: '10px' }),
    regle('.wa-ligne', { background: '#fff', 'border-radius': '14px', padding: '12px 16px', color: '#1d2b23', cursor: 'pointer', display: 'grid', 'grid-template-columns': '1.4fr 1fr 2fr 110px 130px', gap: '12px', 'align-items': 'center', border: '1px solid transparent' }),
    regle('.wa-ligne:hover', { 'border-color': 'var(--green-bright)' }),
    regle('.wa-nom', { 'font-weight': '700', color: 'var(--green-deep)' }),
    regle('.wa-sub', { 'font-size': '12px', color: '#6b7f73' }),
    regle('.wa-resume', { 'font-size': '12.5px', color: '#33443a', overflow: 'hidden', display: '-webkit-box', '-webkit-line-clamp': '2', '-webkit-box-orient': 'vertical' }),
    regle('.wa-jauge', { height: '6px', background: '#e2ece7', 'border-radius': '3px', overflow: 'hidden' }),
    regle('.wa-jauge i', { display: 'block', height: '100%', background: 'linear-gradient(90deg,var(--green-bright),var(--green-light))' }),
    regle('.wa-b', { display: 'inline-block', padding: '3px 10px', 'border-radius': '20px', 'font-size': '11px', 'font-weight': '600' }),
    regle('.wa-b-cours', { background: '#fff3e0', color: '#a35a00' }),
    regle('.wa-b-pret', { background: '#e0f7ec', color: '#1a5c35' }),
    regle('.wa-b-appele', { background: '#e3f2fd', color: '#1565c0' }),
    regle('.wa-b-relance', { background: '#f3e8fd', color: '#7b3fb0' }),
    regle('.wa-b-hors', { background: '#f0f0f0', color: '#666' }),
    regle('.wa-b-pause', { background: '#fdecea', color: '#b3261e' }),
    regle('.wa-vide', { color: 'rgba(255,255,255,0.55)', 'text-align': 'center', padding: '40px 10px', 'font-size': '13px' }),
    regle('.wa-alerte', { background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.35)', color: 'var(--gold-light)', padding: '12px 14px', 'border-radius': '10px', 'margin-bottom': '14px', 'font-size': '13px' }),
    regle('.wa-fiche', { width: '1100px', 'max-width': '96vw', padding: '0', display: 'flex', 'flex-direction': 'column', overflow: 'hidden' }),
    regle('.wa-head', { padding: '20px 24px 14px', display: 'flex', gap: '12px', 'align-items': 'flex-start', 'flex-wrap': 'wrap', 'border-bottom': '1px solid #e2ece7' }),
    regle('.wa-head h2', { 'font-family': '\'Syne\',sans-serif', 'font-size': '20px', color: 'var(--green-deep)', margin: '0' }),
    regle('.wa-head .wa-actions', { 'margin-left': 'auto', display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }),
    regle('.wa-fiche .btn-ghost', { color: 'var(--green-mid)', border: '1.5px solid #cfe3d7', background: '#fff', 'text-decoration': 'none' }),
    regle('.wa-corps', { display: 'grid', 'grid-template-columns': '1.15fr 1fr', gap: '0', 'min-height': '0', flex: '1', overflow: 'hidden' }),
    regle('.wa-col', { padding: '16px 20px', 'overflow-y': 'auto', 'max-height': '72vh' }),
    regle('.wa-col + .wa-col', { 'border-left': '1px solid #e2ece7', background: '#f6f9f7', display: 'flex', 'flex-direction': 'column' }),
    regle('.wa-bloc', { background: '#fff', border: '1px solid #e2ece7', 'border-radius': '12px', padding: '14px', 'margin-bottom': '12px', color: '#1d2b23' }),
    regle('.wa-bloc.wa-appel', { 'border-color': '#9fd8b6', background: '#f4fbf7' }),
    regle('.wa-bloc h4', { margin: '0 0 8px', 'font-size': '11px', 'text-transform': 'uppercase', 'letter-spacing': '0.1em', color: '#6b7f73' }),
    regle('.wa-txt', { 'font-size': '13px', 'white-space': 'pre-wrap', 'line-height': '1.5' }),
    regle('.wa-kv', { display: 'grid', 'grid-template-columns': '170px 1fr', gap: '6px 10px', 'font-size': '13px' }),
    regle('.wa-kv dt', { color: '#6b7f73' }),
    regle('.wa-kv dd', { margin: '0', 'word-break': 'break-word' }),
    regle('.wa-fil', { flex: '1', 'overflow-y': 'auto', display: 'flex', 'flex-direction': 'column', gap: '8px', 'padding-bottom': '8px' }),
    regle('.wa-msg', { 'max-width': '86%', 'border-radius': '12px', padding: '8px 11px', 'font-size': '13px', color: '#1d2b23', 'white-space': 'pre-wrap', 'word-break': 'break-word' }),
    regle('.wa-msg small', { display: 'block', 'font-size': '10.5px', color: '#6b7f73', 'margin-bottom': '2px', 'white-space': 'normal' }),
    regle('.wa-in', { background: '#fff', border: '1px solid #e2ece7', 'align-self': 'flex-start' }),
    regle('.wa-bot', { background: '#dcf5e7', 'align-self': 'flex-end' }),
    regle('.wa-humain', { background: '#dbeafe', 'align-self': 'flex-end' }),
    regle('.wa-msg img, .wa-msg video', { display: 'block', 'max-width': '100%', 'max-height': '240px', 'border-radius': '8px', 'margin-top': '6px' }),
    regle('.wa-msg audio', { display: 'block', width: '230px', 'margin-top': '6px' }),
    regle('.wa-envoi', { display: 'flex', gap: '8px', 'padding-top': '10px', 'border-top': '1px solid #e2ece7' }),
    regle('.wa-envoi textarea', { flex: '1', 'min-height': '44px', 'max-height': '120px', resize: 'vertical', padding: '9px 11px', 'border-radius': '10px', border: '1.5px solid #cfe3d7', 'font-family': 'inherit', 'font-size': '13px' }),
    regle('.wa-suivi', { display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'align-items': 'center', 'font-size': '13px' }),
    regle('.wa-suivi select', { padding: '7px 10px', 'border-radius': '8px', border: '1.5px solid #cfe3d7' }),
    regle('.wa-notes', { width: '100%', 'min-height': '80px', padding: '9px 11px', 'border-radius': '10px', border: '1.5px solid #cfe3d7', 'font-family': 'inherit', 'font-size': '13px', 'margin-top': '8px', 'box-sizing': 'border-box' }),
    regle('.wa-points', { margin: '0 0 0 18px', padding: '0', 'font-size': '13px', 'line-height': '1.5' }),
    regle('.wa-fiche a.btn', { 'text-decoration': 'none' }),
    regle('.wa-droite', { 'text-align': 'right', 'margin-top': '8px' }),
    regle('.role-sourceur #wa-nav', { display: 'none !important' }),
    regle('.wa-pastille', { 'margin-left': 'auto', background: 'var(--gold)', color: 'var(--dark)', 'border-radius': '20px', padding: '1px 8px', 'font-size': '11px', 'font-weight': '700' }),
    `@media (max-width: 900px){${[
      regle('.wa-kpis', { 'grid-template-columns': '1fr 1fr' }),
      regle('.wa-ligne', { 'grid-template-columns': '1fr 1fr' }),
      regle('.wa-resume', { 'grid-column': '1 / -1' }),
      regle('.wa-corps', { 'grid-template-columns': '1fr', overflow: 'auto' }),
      regle('.wa-col', { 'max-height': 'none', overflow: 'visible' }),
      regle('.wa-col + .wa-col', { 'border-left': '0', 'border-top': '1px solid #e2ece7', 'min-height': '60vh' }),
      regle('.wa-kv', { 'grid-template-columns': '1fr' }),
    ].join('')}}`,
  ].join('\n')

  // ----- Accès aux données -----
  async function req(chemin, opts = {}) {
    const r = await fetch(`${SUPA_URL}/rest/v1/${chemin}`, { ...opts, headers: { ...SUPA_HEADERS, ...(opts.headers ?? {}) } })
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`)
    return r.status === 204 ? null : r.json().catch(() => null)
  }

  async function charger() {
    try {
      const c = await req('whatsapp_conversations?select=*&order=dernier_message_le.desc.nullslast&limit=500')
      WA.convs = Array.isArray(c) ? c : []
      WA.ok = true
    } catch (e) {
      WA.ok = false
      WA.convs = []
    }
    WA.charge = true
    pastille()
  }

  async function signer(chemin) {
    try {
      const r = await fetch(`${SUPA_URL}/storage/v1/object/sign/whatsapp-media/${chemin}`, {
        method: 'POST',
        headers: { apikey: SUPA_HEADERS.apikey, Authorization: SUPA_HEADERS.Authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 3600 }),
      })
      if (!r.ok) return null
      const j = await r.json()
      return j.signedURL ? `${SUPA_URL}/storage/v1${j.signedURL}` : null
    } catch {
      return null
    }
  }

  // ----- Aides d'affichage -----
  const conv = (tel) => WA.convs.find((c) => c.telephone === tel)
  const ach = (id) => (id == null ? null : (state.acheteurs ?? []).find((a) => String(a.id) === String(id)))
  const ter = (id) => (id == null ? null : (state.terrains ?? []).find((t) => String(t.id) === String(id)))
  const fiche = (c) => c?.fiche ?? {}
  const tel = (n) => {
    const s = String(n ?? '')
    return s.startsWith('212') && s.length === 12 ? ('0' + s.slice(3)).replace(/(\d{2})(?=\d)/g, '$1 ') : `+${s}`
  }
  function nomDe(c) {
    const a = ach(c.acheteur_id)
    if (a?.nom && !a.nom.startsWith('+') && a.nom !== 'Contact à identifier') return a.nom
    const f = fiche(c)
    if (f.nom) return f.nom
    if (c.nom_profil) return c.nom_profil
    return tel(c.telephone)
  }
  function botEtat(c) {
    if (c.bot_actif === false) return ['Bot désactivé', true]
    if (c.bot_pause_jusqua && new Date(c.bot_pause_jusqua) > new Date()) return [`En pause jusqu'au ${new Date(c.bot_pause_jusqua).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`, true]
    return ['Bot actif', false]
  }
  const badge = (s) => {
    const [l, k] = STATUTS[s] ?? [s ?? 'En cours', 'wa-b-cours']
    return `<span class="wa-b ${k}">${esc(l)}</span>`
  }
  const quand = (d) => (d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '')
  const valeur = (v) => (Array.isArray(v) ? v.join(', ') : String(v))
  const rempli = (v) => !(v == null ? true : (Array.isArray(v) ? v.length === 0 : String(v).trim() === ''))

  function pastille() {
    const nav = document.getElementById('wa-nav')
    if (!nav) return
    const n = WA.convs.filter((c) => c.statut === 'complete').length
    const p = nav.querySelector('.wa-pastille')
    p.textContent = String(n)
    p.style.display = n ? '' : 'none'
  }

  // ----- Liste des conversations -----
  function rendreListe() {
    const page = document.getElementById('page-whatsapp')
    if (!page) return
    if (!WA.ok) {
      page.innerHTML = '<div class="wa-alerte">La base n\'est pas encore prête pour le chatbot WhatsApp. Exécutez le script supabase/chatbot-whatsapp.sql dans Supabase (SQL Editor), puis rechargez la page.</div>'
      return
    }
    const tous = WA.convs
    const prets = tous.filter((c) => c.statut === 'complete').length
    const cours = tous.filter((c) => (c.statut ?? 'en_cours') === 'en_cours').length
    const pause = tous.filter((c) => botEtat(c)[1]).length
    const kpis = `<div class="wa-kpis">
      <div class="wa-kpi"><b>${tous.length}</b><span>Conversations</span></div>
      <div class="wa-kpi"><b>${prets}</b><span>Prêtes pour appel</span></div>
      <div class="wa-kpi"><b>${cours}</b><span>Qualification en cours</span></div>
      <div class="wa-kpi"><b>${pause}</b><span>Bot en pause (conseiller)</span></div></div>`
    const opts = (vals, cur, tout) => `<option value="">${tout}</option>` + Object.entries(vals).map(([k, v]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(Array.isArray(v) ? v[0] : v)}</option>`).join('')
    const barre = `<div class="wa-bar">
      <input id="wa-q" placeholder="Nom, téléphone, quartier..." value="${esc(WA.q)}" oninput="waFiltre('q', this.value)">
      <select onchange="waFiltre('statut', this.value)">${opts(STATUTS, WA.statut, 'Tous les statuts')}</select>
      <select onchange="waFiltre('profil', this.value)">${opts(PROFILS, WA.profil, 'Tous les profils')}</select></div>`
    const q = WA.q.trim().toLowerCase()
    const liste = tous.filter((c) => {
      if (WA.statut && (c.statut ?? 'en_cours') !== WA.statut) return false
      if (WA.profil && c.profil !== WA.profil) return false
      if (!q) return true
      const f = fiche(c)
      const texte = [nomDe(c), c.telephone, tel(c.telephone), f.quartier, f.ville, valeur(f.villes ?? ''), f.resume_pour_appel].join(' ').toLowerCase()
      return texte.includes(q)
    })
    const lignes = liste.map((c) => {
      const f = fiche(c)
      const [etat, enPause] = botEtat(c)
      const lieu = [f.quartier, f.ville].filter(Boolean).join(', ')
      return `<div class="wa-ligne" onclick="waOuvrir(${jsArg(c.telephone)})">
        <div><div class="wa-nom">${esc(nomDe(c))}</div><div class="wa-sub">${esc(tel(c.telephone))}, ${esc(quand(c.dernier_message_le))}</div></div>
        <div><div>${esc(PROFILS[c.profil] ?? 'Profil à identifier')}</div><div class="wa-sub">${esc(f.langue ?? '')}${lieu ? ', ' + esc(lieu) : ''}</div></div>
        <div class="wa-resume">${esc(f.resume_pour_appel ?? 'Qualification en cours.')}</div>
        <div><div class="wa-jauge"><i style="width:${Number(c.completude ?? 0)}%"></i></div><div class="wa-sub">${Number(c.completude ?? 0)} % de la fiche</div></div>
        <div>${badge(c.statut)}<div class="wa-sub">${enPause ? `<span class="wa-b wa-b-pause">${esc(etat)}</span>` : esc(etat)}</div></div></div>`
    }).join('')
    const vide = tous.length
      ? '<div class="wa-vide">Aucune conversation ne correspond aux filtres.</div>'
      : '<div class="wa-vide">Aucune conversation pour l\'instant. Les messages reçus sur le WhatsApp GREENFIELD apparaîtront ici, avec la fiche remplie par le chatbot.</div>'
    page.innerHTML = kpis + barre + `<div class="wa-liste">${lignes ? lignes : vide}</div>`
    const champ = document.getElementById('wa-q')
    if (champ && WA.focusQ) {
      champ.focus()
      champ.setSelectionRange(champ.value.length, champ.value.length)
    }
  }

  window.waFiltre = function (k, v) {
    WA[k] = v
    WA.focusQ = k === 'q'
    rendreListe()
  }

  // ----- Fiche d'une conversation -----
  window.waOuvrir = async function (t) {
    WA.open = t
    WA.msgs = []
    rendreFiche()
    openModal('modal-wa')
    await chargerMessages()
  }

  async function chargerMessages() {
    const t = WA.open
    if (!t) return
    try {
      const m = await req(`whatsapp_messages?select=*&telephone=eq.${encodeURIComponent(t)}&order=id.asc&limit=500`)
      const avecMedia = Array.isArray(m) ? m : []
      for (const x of avecMedia) {
        if (!x.media_path) continue
        const deja = WA.msgs.find((y) => y.id === x.id)
        x.url = deja?.url ? deja.url : await signer(x.media_path)
      }
      WA.msgs = avecMedia
    } catch (e) {
      WA.msgs = []
    }
    rendreFil()
  }

  function media(m) {
    if (!m.url) return ''
    const mime = String(m.media_mime ?? '')
    if (mime.startsWith('image/')) return `<a href="${esc(m.url)}" target="_blank" rel="noopener"><img src="${esc(m.url)}" alt="Photo envoyée"></a>`
    if (mime.startsWith('audio/')) return `<audio controls src="${esc(m.url)}"></audio>`
    if (mime.startsWith('video/')) return `<video controls src="${esc(m.url)}"></video>`
    return `<a href="${esc(m.url)}" target="_blank" rel="noopener">Ouvrir le fichier</a>`
  }

  function rendreFil() {
    const fil = document.getElementById('wa-fil')
    if (!fil) return
    const bas = fil.scrollHeight - fil.scrollTop - fil.clientHeight < 40
    fil.innerHTML = WA.msgs.length
      ? WA.msgs.map((m) => {
        const entrant = m.direction === 'entrant'
        const cls = entrant ? 'wa-in' : (m.auteur === 'bot' ? 'wa-bot' : 'wa-humain')
        const qui = entrant ? 'Contact' : (m.auteur === 'bot' ? 'Chatbot' : esc(m.auteur ?? 'Conseiller'))
        const note = m.action && !entrant && String(m.action).startsWith('Non délivré') ? `\n${esc(m.action)}` : ''
        return `<div class="wa-msg ${cls}"><small>${qui}, ${esc(quand(m.created_at))}</small>${esc(m.contenu ?? '')}${note}${media(m)}</div>`
      }).join('')
      : '<div class="pr-empty">Chargement de la conversation...</div>'
    if (bas) fil.scrollTop = fil.scrollHeight
  }

  function rendreFiche() {
    const c = conv(WA.open)
    const boite = document.getElementById('wa-fiche')
    if (!c) {
      boite.innerHTML = '<div class="wa-head"><h2>Conversation introuvable</h2><div class="wa-actions"><button class="btn btn-ghost btn-sm" onclick="closeModal(\'modal-wa\')">Fermer</button></div></div>'
      return
    }
    const f = fiche(c)
    const a = ach(c.acheteur_id)
    const t = ter(c.terrain_id)
    const [etat, enPause] = botEtat(c)
    const numero = f.telephone_appel ? f.telephone_appel : `+${c.telephone}`
    const points = Array.isArray(f.points_a_verifier) ? f.points_a_verifier : []
    const manquants = Array.isArray(f.manquants) ? f.manquants : []
    const kv = CHAMPS.filter(([k]) => rempli(f[k])).map(([k, l]) => {
      let v = valeur(f[k])
      if (k === 'profil') v = PROFILS[f[k]] ?? v
      const lien = k === 'localisation_gps' && String(v).startsWith('http') ? `<a href="${esc(v)}" target="_blank" rel="noopener">Ouvrir la carte</a>` : esc(v)
      return `<dt>${esc(l)}</dt><dd>${lien}</dd>`
    }).join('')
    const options = Object.entries(STATUTS).map(([k, [l]]) => `<option value="${k}" ${(c.statut ?? 'en_cours') === k ? 'selected' : ''}>${esc(l)}</option>`).join('')
    const liens = [
      a ? `<button class="btn btn-ghost btn-sm" onclick="waFichePromoteur(${Number(a.id)})">Fiche promoteur</button>` : (c.acheteur_id ? `<button class="btn btn-ghost btn-sm" onclick="waFichePromoteur(${Number(c.acheteur_id)})">Fiche promoteur</button>` : ''),
      c.terrain_id ? `<button class="btn btn-ghost btn-sm" onclick="waFicheTerrain(${Number(c.terrain_id)})">Fiche terrain${t?.ref ? ' ' + esc(t.ref) : ''}</button>` : '',
    ].join('')
    boite.innerHTML = `
      <div class="wa-head">
        <div><h2>${esc(nomDe(c))}</h2>
          <div class="wa-sub" style="margin-top:4px">${esc(tel(c.telephone))}, ${esc(PROFILS[c.profil] ?? 'profil à identifier')}${f.langue ? ', ' + esc(f.langue) : ''}</div>
          <div style="margin-top:8px">${badge(c.statut)} <span class="wa-sub">fiche remplie à ${Number(c.completude ?? 0)} %</span></div></div>
        <div class="wa-actions">
          <a class="btn btn-primary btn-sm" href="tel:${esc(numero.replace(/\s/g, ''))}">Appeler</a>
          <a class="btn btn-ghost btn-sm" href="https://wa.me/${esc(c.telephone)}" target="_blank" rel="noopener">WhatsApp</a>
          ${liens}
          <button class="btn btn-ghost btn-sm" onclick="closeModal('modal-wa')">Fermer</button>
        </div>
      </div>
      <div class="wa-corps">
        <div class="wa-col">
          <div class="wa-bloc wa-appel"><h4>Fiche d'appel</h4>
            <div class="wa-txt">${esc(f.resume_pour_appel ?? 'Le résumé apparaîtra après les premiers échanges.')}</div>
            <dl class="wa-kv" style="margin-top:10px"><dt>Créneau souhaité</dt><dd>${esc(f.creneau_appel ?? 'Non précisé')}</dd><dt>Numéro à appeler</dt><dd>${esc(numero)}</dd></dl>
            ${points.length ? `<h4 style="margin-top:12px">Points à vérifier pendant l'appel</h4><ul class="wa-points">${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
            <div class="wa-sub" style="margin-top:10px">Informations encore manquantes : ${esc(manquants.length ? manquants.join(', ') : 'aucune')}</div>
          </div>
          <div class="wa-bloc"><h4>Ce que le chatbot a recueilli</h4>${kv ? `<dl class="wa-kv">${kv}</dl>` : '<div class="pr-empty">Rien pour l\'instant.</div>'}</div>
          <div class="wa-bloc"><h4>Suivi</h4>
            <div class="wa-suivi"><select id="wa-statut" onchange="waStatut()">${options}</select>
              ${enPause ? `<span class="wa-b wa-b-pause">${esc(etat)}</span><button class="btn btn-primary btn-sm" onclick="waBot('reprendre')">Réactiver le bot</button>`
                : `<span class="wa-sub">${esc(etat)}</span><button class="btn btn-ghost btn-sm" onclick="waBot('pause')">Mettre le bot en pause</button>`}
              ${c.bot_actif === false ? '' : '<button class="btn btn-ghost btn-sm" onclick="waBot(\'off\')">Désactiver</button>'}
            </div>
            <textarea class="wa-notes" id="wa-notes" placeholder="Compte rendu de l'appel, prochaines étapes...">${esc(c.notes_appel ?? '')}</textarea>
            <div class="wa-droite"><button class="btn btn-primary btn-sm" onclick="waNotes()">Enregistrer les notes</button></div>
          </div>
        </div>
        <div class="wa-col">
          <div class="wa-fil" id="wa-fil"></div>
          <div class="wa-envoi"><textarea id="wa-texte" placeholder="Répondre en tant que conseiller (le bot se met en pause 24h)"></textarea><button class="btn btn-primary btn-sm" id="wa-envoyer" onclick="waEnvoyer()">Envoyer</button></div>
        </div>
      </div>`
    rendreFil()
  }

  async function majConv(patch, message) {
    const t = WA.open
    try {
      const r = await req(`whatsapp_conversations?telephone=eq.${encodeURIComponent(t)}`, { method: 'PATCH', body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) })
      const c = conv(t)
      if (c) Object.assign(c, Array.isArray(r) && r[0] ? r[0] : patch)
      if (message) showNotif(message)
    } catch (e) {
      showNotif('Échec : ' + e.message.slice(0, 90), true)
    }
    rendreFiche()
    rendreListe()
    pastille()
  }

  window.waStatut = () => majConv({ statut: document.getElementById('wa-statut').value }, 'Statut mis à jour.')
  window.waNotes = () => majConv({ notes_appel: document.getElementById('wa-notes').value }, 'Notes enregistrées.')
  window.waBot = function (action) {
    if (action === 'reprendre') return majConv({ bot_actif: true, bot_pause_jusqua: null }, 'Le chatbot répond de nouveau à ce contact.')
    if (action === 'pause') return majConv({ bot_pause_jusqua: new Date(Date.now() + 24 * 3600 * 1000).toISOString() }, 'Chatbot en pause 24h pour ce contact.')
    return majConv({ bot_actif: false }, 'Chatbot désactivé pour ce contact.')
  }

  window.waEnvoyer = async function () {
    const zone = document.getElementById('wa-texte')
    const texte = zone.value.trim()
    if (!texte) return
    const bouton = document.getElementById('wa-envoyer')
    bouton.disabled = true
    try {
      const r = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: SUPA_HEADERS.Authorization },
        body: JSON.stringify({ telephone: WA.open, texte }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.erreur ?? `Erreur ${r.status}`)
      zone.value = ''
      showNotif('Message envoyé. Le chatbot est en pause pour ce contact.')
      await charger()
      rendreFiche()
      await chargerMessages()
    } catch (e) {
      showNotif(e.message, true)
    }
    bouton.disabled = false
  }

  window.waFichePromoteur = async function (id) {
    if (!ach(id) && typeof loadFromSupabase === 'function') await loadFromSupabase()
    if (!ach(id)) {
      showNotif('Fiche promoteur introuvable, rechargez la page.', true)
      return
    }
    closeModal('modal-wa')
    prOpen(id)
  }

  window.waFicheTerrain = async function (id) {
    if (!ter(id) && typeof loadFromSupabase === 'function') await loadFromSupabase()
    if (!ter(id)) {
      showNotif('Terrain introuvable, rechargez la page.', true)
      return
    }
    closeModal('modal-wa')
    openTerrainDetail(id)
  }

  // ----- Mise en place dans le CRM -----
  function installer() {
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)

    const matching = document.querySelector('.sidebar .nav-item[onclick*="\'matching\'"]')
    const nav = document.createElement('div')
    nav.className = 'nav-item'
    nav.id = 'wa-nav'
    nav.innerHTML = '<span class="nav-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.6-5.4A8.5 8.5 0 1 1 21 11.5z"/></svg></span> WhatsApp <span class="wa-pastille" style="display:none">0</span>'
    nav.addEventListener('click', () => {
      showPage('whatsapp', nav)
      if (typeof gfSide === 'function') gfSide(false)
    })
    if (matching) matching.after(nav)

    const dashboard = document.getElementById('page-dashboard')
    const page = document.createElement('div')
    page.className = 'page'
    page.id = 'page-whatsapp'
    if (dashboard) dashboard.parentElement.appendChild(page)

    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.id = 'modal-wa'
    modal.innerHTML = '<div class="modal wa-fiche" id="wa-fiche"></div>'
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal('modal-wa')
    })
    document.body.appendChild(modal)

    const original = window.showPage
    window.showPage = function (p, el) {
      original(p, el)
      if (p !== 'whatsapp') return
      document.getElementById('pageTitle').textContent = 'Conversations WhatsApp'
      rendreListe()
      charger().then(rendreListe)
    }

    // Actualisation automatique toutes les 30 secondes
    setInterval(async () => {
      if (typeof supabaseReady !== 'undefined' && !supabaseReady) return
      const ouverte = document.getElementById('modal-wa').classList.contains('open')
      if (currentPage !== 'whatsapp' && !ouverte) return
      await charger()
      if (currentPage === 'whatsapp' && !(document.activeElement && document.activeElement.id === 'wa-q')) rendreListe()
      if (ouverte) await chargerMessages()
    }, 30000)

    // Pastille du menu après la connexion
    const verifier = setInterval(() => {
      if (typeof supabaseReady !== 'undefined' && supabaseReady) {
        clearInterval(verifier)
        charger()
      }
    }, 2000)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installer)
  else installer()
})()
