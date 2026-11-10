/* Greenfield CRM : page Carte des terrains (versions, sélection, fiche PDF, liens temporaires, import des contours).
   S'appuie sur carte.js et sur les globales du CRM : state, SUPA_URL, SUPA_HEADERS, FAV, favEnsure, favToggle, myRole, showNotif. */
(function () {
'use strict'

let api = null
let loading = false
let CONTOURS = null
let mode = 'interne'
let withSold = false

const num = v => {
  if (v === null) return null
  if (v === undefined) return null
  const n = Number(String(v).replace(/[\s  ]/g, '').replace(',', '.').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}
const esc = s => String(s ?? '').replace(/&/g, ' et ').replace(/</g, '‹').replace(/>/g, '›').replace(/"/g, '”')
function gmCoords (u) {
  const s = String(u ?? '')
  const all = [...s.matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g)]
  if (all.length) return [Number(all[all.length - 1][1]), Number(all[all.length - 1][2])]
  const m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return [Number(m[1]), Number(m[2])]
  const q = s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  return q ? [Number(q[1]), Number(q[2])] : null
}
// Même règle que la fonction SQL tf_cles : '28536/53 - R 7123/C' donne T28536/53 et R7123/C
function tfCles (txt) {
  const out = new Set()
  const re = /(\bR\s*\.?\s*)?([0-9]{2,7})\s*\/\s*([A-Za-z0-9]+)/gi
  let m = re.exec(String(txt ?? ''))
  while (m) {
    out.add((m[1] ? 'R' : 'T') + String(Number(m[2])) + '/' + m[3].toUpperCase())
    m = re.exec(String(txt ?? ''))
  }
  return [...out]
}
const H = extra => Object.assign({}, SUPA_HEADERS, extra ? extra : {})

function loadScript (src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = res
    s.onerror = rej
    document.head.appendChild(s)
  })
}
function loadCss (href) {
  if (document.querySelector('link[href="' + href + '"]')) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = href
  document.head.appendChild(l)
}

// Supabase renvoie 1 000 lignes au plus par appel : les contours sont lus par pages, dans un ordre stable
async function fetchContours () {
  const all = []
  for (let offset = 0; offset < 50000; offset += 1000) {
    const r = await fetch(SUPA_URL + '/rest/v1/rpc/carte_contours?order=terrain_id.asc,cle.asc&limit=1000&offset=' + offset, { method: 'POST', headers: H(), body: '{}' })
    if (!r.ok) throw new Error(await r.text())
    const page = await r.json()
    all.push(...page)
    if (page.length < 1000) break
  }
  return all
}

function buildTerrains () {
  const byT = {}
  const cl = CONTOURS ? CONTOURS : []
  cl.forEach(c => {
    const k = String(c.terrain_id)
    if (!byT[k]) byT[k] = []
    byT[k].push(c)
  })
  const out = []
  const tl = state.terrains ? state.terrains : []
  tl.forEach(t => {
    const cs = byT[String(t.id)]
    const gm = gmCoords(t.googleMap)
    if (!cs && !gm) return
    const s = num(t.superficie)
    const pm = num(t.prix)
    const pf = num(t.forfait) ?? (pm && s ? pm * s : null)
    const o = {
      key: String(t.id), id: t.ref ? t.ref : 'Terrain ' + t.id, q: t.quartier ? t.quartier : t.localisation, z: t.urba,
      s, pm, pf, tf: t.tf, statut: t.statut, sourceur: t.sourceur, notes: t.notes, mymaps: t.mymaps, gm: t.googleMap, pt: !cs
    }
    if (cs) {
      o.g = cs.flatMap(c => c.geom)
      o.ga = cs.flatMap(c => c.geom_approx)
      o.lat = cs.reduce((a, c) => a + c.lat, 0) / cs.length
      o.lng = cs.reduce((a, c) => a + c.lng, 0) / cs.length
      o.alat = cs.reduce((a, c) => a + c.lat_approx, 0) / cs.length
      o.alng = cs.reduce((a, c) => a + c.lng_approx, 0) / cs.length
      o.spRef = cs.some(c => /^GF-/.test(c.cle))
      o.sp = cs.reduce((a, c) => a + Number(c.surface_plan ? c.surface_plan : 0), 0)
      if (s && o.sp) {
        const r = o.sp / s
        if (r < 0.8 || r > 1.25) o.warn = 'surface plan ' + Math.round(o.sp).toLocaleString('fr-FR') + ' m² contre ' + Math.round(s).toLocaleString('fr-FR') + ' m² saisis'
      }
    } else {
      o.lat = gm[0]
      o.lng = gm[1]
    }
    out.push(o)
  })
  return out
}

function dataFor (m) {
  const all = buildTerrains()
  if (m === 'interne') return all.filter(t => withSold ? true : t.statut !== 'Vendu')
  // Versions prospect : uniquement les terrains au statut Disponible
  const base = all.filter(t => t.statut === 'Disponible')
  if (m === 'qualifie') return base.map(t => ({ key: t.key, id: t.id, q: t.q, z: t.z, s: t.s, pm: t.pm, pf: t.pf, g: t.g, lat: t.lat, lng: t.lng, pt: t.pt }))
  return base.map(t => GFCarte.versDecouverte(t))
}

function internRows (t) {
  return [['TF', t.tf], ['Statut', t.statut], ['Sourceur', t.sourceur], [t.spRef ? 'Surface du contour' : 'Surface plan CADGIS', t.sp ? Math.round(t.sp).toLocaleString('fr-FR') + ' m²' : ''], ['À vérifier', t.warn], ['Notes', t.notes], ['Infos MyMaps', t.mymaps, 'bloc']]
}

const sel = {
  has: k => FAV.has(String(k)),
  toggle: async k => { await favToggle(Number(k)) }
}

// ─── Couche MyMaps : dessins de l'ancienne carte sans terrain dans le CRM (vue Interne, admins et associés) ───
let MM = null
let mmLayer = null
let mmOn = false
const mmPolys = {}
const mmAllowed = () => typeof myRole !== 'undefined' && (myRole === 'admin' || myRole === 'associe')
const mmNum = v => Math.round(Number(v)).toLocaleString('fr-FR')

async function mmFetch () {
  const r = await fetch(SUPA_URL + '/rest/v1/mymaps_dessins?select=id,nom,note,couleur,zonage,surface,surface_dessin,prix,tf_cadgis,lat,lng,geom&terrain_id=is.null&order=id.asc&limit=3000', { headers: H() })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}
function mmLabel () {
  const el = document.getElementById('ch-mm-n')
  if (el) el.textContent = MM ? ' (' + MM.length.toLocaleString('fr-FR') + ')' : ''
}
function mmPopup (d) {
  const rows = [
    ['Surface du dessin', d.surface_dessin ? mmNum(d.surface_dessin) + ' m²' : ''],
    ['TF CADGIS à cet endroit', d.tf_cadgis],
    ['Prix lu dans la note', d.prix ? mmNum(d.prix) + ' DH/m²' : '']
  ].filter(r => r[1])
  return '<div class="mm-pop"><div class="mm-k">Ancienne carte MyMaps · hors CRM</div><b class="mm-n">' + esc(d.nom ? d.nom : 'Sans nom') + '</b>' +
    (d.note ? '<p>' + esc(d.note) + '</p>' : '') +
    rows.map(r => '<div class="mm-r"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>').join('') +
    '<div class="mm-a"><button type="button" class="mm-b1" data-mm="' + d.id + '">Créer le terrain</button>' +
    '<a class="mm-b2" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + d.lat + ',' + d.lng + '">Google Maps</a></div></div>'
}
function mmDraw () {
  if (!api || !MM) return
  if (!api.map.getPane('mymaps')) api.map.createPane('mymaps').style.zIndex = 390
  if (mmLayer) api.map.removeLayer(mmLayer)
  mmLayer = L.layerGroup()
  MM.forEach(d => {
    const noir = d.couleur === '#000000'
    const poly = L.polygon(d.geom, { pane: 'mymaps', color: d.couleur, weight: 2, dashArray: '3 4', fillColor: d.couleur, fillOpacity: noir ? 0.35 : 0.22 })
    poly.bindPopup(() => mmPopup(d), { maxWidth: 300, minWidth: 230 })
    mmPolys[d.id] = poly
    mmLayer.addLayer(poly)
  })
  mmLayer.addTo(api.map)
}
async function mmSync () {
  if (!api) return
  const want = mmOn && mode === 'interne' && mmAllowed()
  if (!want) {
    if (mmLayer) { api.map.removeLayer(mmLayer)
      mmLayer = null }
    return
  }
  try {
    if (!MM) MM = await mmFetch()
    mmLabel()
    mmDraw()
  } catch (e) {
    mmOn = false
    const ck = document.getElementById('ch-mm')
    if (ck) ck.checked = false
    showNotif('Couche MyMaps indisponible : exécutez supabase/mymaps-couche.sql dans Supabase.', true)
  }
}
// Quartier du terrain du CRM le plus proche, proposé par défaut
function mmQuartier (d) {
  let best = null
  buildTerrains().forEach(t => {
    if (!t.q || t.lat == null) return
    const dd = (t.lat - d.lat) ** 2 + ((t.lng - d.lng) * 0.83) ** 2
    if (!best || dd < best[0]) best = [dd, t.q]
  })
  return best && best[0] < 0.0004 ? best[1] : ''
}
function mmCreate (id) {
  const d = (MM ? MM : []).find(x => String(x.id) === String(id))
  if (!d) return
  api.map.closePopup()
  const qs = [...new Set((state.terrains ? state.terrains : []).map(t => t.quartier ? t.quartier : t.localisation).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const info = (d.nom ? d.nom : '') + (d.note ? ' : ' + d.note : '')
  const v = x => String(x ?? '').replace(/"/g, '”')
  api.modal('<h3>Créer le terrain</h3><p class="lk-m">' + esc(info) + '</p>' +
    '<label>Quartier</label><input id="mm-q" list="mm-ql" value="' + v(mmQuartier(d)) + '" placeholder="Quartier ou commune"><datalist id="mm-ql">' + qs.map(q => '<option value="' + v(q) + '">').join('') + '</datalist>' +
    '<label>Zonage</label><input id="mm-z" value="' + v(d.zonage) + '">' +
    '<label>Superficie (m²)</label><input id="mm-s" type="number" min="0" value="' + v(d.surface ? d.surface : d.surface_dessin) + '">' +
    '<label>Prix au m² (DH)</label><input id="mm-p" type="number" min="0" value="' + v(d.prix) + '" placeholder="Laisser vide si inconnu">' +
    '<label>TF</label><input id="mm-tf" value="' + v(d.tf_cadgis) + '" placeholder="Titre foncier">' +
    '<p class="lk-m">Le terrain est créé au statut « À qualifier ». Le dessin devient son contour sur la carte et sa note va dans la ligne Infos MyMaps.</p>' +
    '<p id="mm-err" class="lk-m" style="color:#b3261e"></p>' +
    '<div class="gfc-acts"><button class="gfc-btn gfc-b3" data-m="close">Annuler</button><button class="gfc-btn gfc-b4" id="mm-go">Créer le terrain</button></div>', (box, close) => {
    const err = box.querySelector('#mm-err')
    const go = box.querySelector('#mm-go')
    go.addEventListener('click', async () => {
      const q0 = box.querySelector('#mm-q').value.trim()
      const q = typeof normQuartier === 'function' && q0 ? normQuartier(q0) : q0
      const sup = parseFloat(box.querySelector('#mm-s').value)
      const prix = parseFloat(box.querySelector('#mm-p').value)
      if (!q || !sup) { err.textContent = 'Le quartier et la superficie sont obligatoires.'
        return }
      go.disabled = true
      go.textContent = 'Création…'
      const terrain = {
        localisation: q, quartier: q, urba: box.querySelector('#mm-z').value.trim(), superficie: sup, prix: prix ? prix : null,
        usage: 'Mixte', statut: 'À qualifier', tf: box.querySelector('#mm-tf').value.trim(), statut_juridique: 'Non renseigné',
        google_map: 'https://www.google.com/maps?q=' + d.lat + ',' + d.lng, mymaps: info,
        sourceur: typeof currentAssocie !== 'undefined' && currentAssocie ? currentAssocie : 'Équipe',
        date_sourcing: new Date().toLocaleDateString('fr-FR')
      }
      try {
        const r = await fetch(SUPA_URL + '/rest/v1/terrains', { method: 'POST', headers: H({ Prefer: 'return=representation' }), body: JSON.stringify(terrain) })
        if (!r.ok) throw new Error((await r.text()).slice(0, 200))
        const row = (await r.json())[0]
        const l = await fetch(SUPA_URL + '/rest/v1/rpc/mymaps_lier_terrain', { method: 'POST', headers: H(), body: JSON.stringify({ p_dessin: d.id, p_terrain: row.id }) })
        const lj = l.ok ? await l.json() : { ok: false, raison: (await l.text()).slice(0, 160) }
        state.terrains.push({
          id: row.id, localisation: row.localisation ? row.localisation : q, quartier: row.quartier ? row.quartier : q, urba: terrain.urba,
          superficie: sup, prix: terrain.prix, forfait: null, tf: terrain.tf, usage: terrain.usage, statut: terrain.statut,
          statut_juridique: terrain.statut_juridique, notes: '', commentaire: '', mymaps: info, sourceur: terrain.sourceur,
          dateSourcing: terrain.date_sourcing, daysOld: 0, googleMap: terrain.google_map, ref: row.ref ? row.ref : ''
        })
        if (typeof logActivity === 'function') { try { await logActivity('Ajout terrain', 'terrain', row.id, q, 'Depuis la couche MyMaps') } catch (e) { /* journal facultatif */ } }
        if (lj && lj.ok) {
          MM = MM.filter(x => x.id !== d.id)
          if (mmPolys[d.id] && mmLayer) mmLayer.removeLayer(mmPolys[d.id])
          mmLabel()
          try { CONTOURS = await fetchContours() } catch (e) { /* le contour apparaîtra au prochain chargement */ }
        }
        api.setData(mode, dataFor(mode))
        close()
        showNotif(lj && lj.ok ? 'Terrain ' + (row.ref ? row.ref : '') + ' créé avec son contour' : 'Terrain ' + (row.ref ? row.ref : '') + ' créé, mais le dessin n\'a pas pu être rattaché : ' + (lj && lj.raison ? lj.raison : 'erreur'), !(lj && lj.ok))
      } catch (e) {
        go.disabled = false
        go.textContent = 'Créer le terrain'
        err.textContent = 'Création impossible : ' + e.message
      }
    })
  })
}
document.addEventListener('click', e => {
  const b = e.target.closest ? e.target.closest('[data-mm]') : null
  if (b) mmCreate(b.dataset.mm)
})
function mmStyle () {
  const st = document.createElement('style')
  st.textContent = '.mm-pop{font-family:\'Inter Tight\',\'Inter\',system-ui,sans-serif;font-size:13px;color:#0a1410;line-height:1.4}' +
    '.mm-k{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#6b7f73;margin-bottom:3px}.mm-n{display:block;font-size:15px}' +
    '.mm-pop p{margin:5px 0 8px;white-space:pre-wrap;overflow-wrap:anywhere}.mm-r{display:flex;justify-content:space-between;gap:10px;padding:2px 0}.mm-r span{color:#4f6a5c}' +
    '.mm-a{display:flex;gap:8px;margin-top:10px}.mm-a>*{flex:1;text-align:center;border-radius:999px;padding:8px 10px;font-weight:600;font-size:12.5px;font-family:inherit;cursor:pointer;text-decoration:none}' +
    '.mm-b1{background:#0a1410;color:#7ee0a4;border:0}.mm-b2{background:#e6f2ea;color:#0a1410 !important;border:0}'
  document.head.appendChild(st)
}
mmStyle()

function header () {
  const host = document.getElementById('carte-head')
  const isAdmin = typeof myRole !== 'undefined' && myRole === 'admin'
  host.innerHTML = '<div class="ch-seg">' +
    [['interne', 'Interne'], ['qualifie', 'Qualifié'], ['decouverte', 'Découverte']].map(([k, l]) => '<button data-m="' + k + '" class="' + (mode === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' +
    (mode === 'interne' ? '<label class="ch-ck"><input type="checkbox" id="ch-sold"' + (withSold ? ' checked' : '') + '> <span class="ch-lg">Inclure les </span>vendus</label>' + (mmAllowed() ? '<label class="ch-ck"><input type="checkbox" id="ch-mm"' + (mmOn ? ' checked' : '') + '> <span class="ch-lg">Couche </span>MyMaps<span id="ch-mm-n">' + (MM ? ' (' + MM.length.toLocaleString('fr-FR') + ')' : '') + '</span></label>' : '') : '<span class="ch-hint"><span class="ch-lg">Aperçu de ce que voit le prospect</span><span class="ch-sm">Vue prospect</span></span>') +
    '<span class="ch-sp"></span>' +
    '<button class="ch-btn" id="ch-links"><span class="ch-lg">Liens envoyés</span><span class="ch-sm">Liens</span><span id="ch-badge"></span></button>' +
    (isAdmin ? '<button class="ch-btn" id="ch-import">Importer les contours</button><input type="file" id="ch-file" accept=".json,.gz" hidden>' : '')
  host.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.m
    header()
    api.setData(mode, dataFor(mode))
    mmSync()
  }))
  const mmck = document.getElementById('ch-mm')
  if (mmck) mmck.addEventListener('change', () => {
    mmOn = mmck.checked
    mmSync()
  })
  const sold = document.getElementById('ch-sold')
  if (sold) sold.addEventListener('change', () => {
    withSold = sold.checked
    api.setData(mode, dataFor(mode))
  })
  document.getElementById('ch-links').addEventListener('click', linksPanel)
  if (isAdmin) {
    document.getElementById('ch-import').addEventListener('click', () => document.getElementById('ch-file').click())
    document.getElementById('ch-file').addEventListener('change', e => importContours(e.target.files[0]))
  }
  refreshBadge()
}

async function refreshBadge () {
  try {
    const r = await fetch(SUPA_URL + '/rest/v1/carte_retours?select=id&traite=eq.false', { headers: H() })
    const rows = r.ok ? await r.json() : []
    const b = document.getElementById('ch-badge')
    if (b) b.innerHTML = rows.length ? '<span class="ch-lg"> · ' + rows.length + ' sélection' + (rows.length > 1 ? 's' : '') + ' reçue' + (rows.length > 1 ? 's' : '') + '</span><b class="ch-dot">' + rows.length + '</b>' : ''
  } catch (e) { /* table absente */ }
}

const DUREES = [['48', '48 heures'], ['168', '7 jours'], ['720', '30 jours']]
function linkUrl (token) { return location.origin + '/carte/' + token }

function achLabel (a) {
  return a.nom + (a.contact ? ' · ' + a.contact : '') + (a.type ? ' · ' + a.type : '')
}
function normTel (t) {
  const d = String(t ?? '').replace(/[^0-9]/g, '')
  if (!d) return ''
  if (d.startsWith('212')) return d
  if (d.startsWith('0')) return '212' + d.slice(1)
  return d
}

function createLink (selected, presetId) {
  const n = selected.length
  const stById = {}
  const tl0 = state.terrains ? state.terrains : []
  tl0.forEach(t => { stById[String(t.id)] = t.statut })
  const nonDispo = selected.filter(t => stById[t.key] !== 'Disponible').length
  const defV = mode === 'decouverte' ? 'decouverte' : 'qualifie'
  const achs = (state.acheteurs ? state.acheteurs : []).filter(a => a.nom).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  let chosen = presetId ? achs.find(a => String(a.id) === String(presetId)) : null
  api.modal('<h3>Lien temporaire pour un promoteur</h3>' +
    '<label>Promoteur (obligatoire)</label><input id="lk-q" placeholder="Rechercher un promoteur ou un contact" autocomplete="off">' +
    '<div id="lk-list" class="lk-list"></div><div id="lk-ch" class="lk-ch"></div>' +
    '<label>Version</label><select id="lk-v"><option value="decouverte"' + (defV === 'decouverte' ? ' selected' : '') + '>Découverte (formes et prix approximatifs)</option><option value="qualifie"' + (defV === 'qualifie' ? ' selected' : '') + '>Acheteur qualifié (contours exacts, sans TF)</option></select>' +
    '<label>Terrains</label><select id="lk-t">' + (n ? '<option value="sel">Les ' + n + ' terrain' + (n > 1 ? 's' : '') + ' de ma sélection</option>' : '') + '<option value="all">Tous les terrains disponibles</option></select>' +
    (nonDispo ? '<p id="lk-w" class="lk-m" style="color:#b25a00">' + nonDispo + ' terrain' + (nonDispo > 1 ? 's' : '') + ' de la sélection ne ' + (nonDispo > 1 ? 'sont' : 'est') + ' pas au statut Disponible : ' + (nonDispo > 1 ? 'ils seront' : 'il sera') + ' quand même visible' + (nonDispo > 1 ? 's' : '') + ' par le promoteur.</p>' : '') +
    '<label>Durée de validité</label><select id="lk-d">' + DUREES.map(([v, l]) => '<option value="' + v + '"' + (v === '168' ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
    '<label>Note interne (facultatif)</label><input id="lk-n">' +
    '<div class="gfc-acts"><button class="gfc-btn gfc-b3" data-m="close">Annuler</button><button class="gfc-btn gfc-b4" id="lk-go">Créer le lien</button></div>', (box, close) => {
    const lkw = box.querySelector('#lk-w')
    if (lkw) box.querySelector('#lk-t').addEventListener('change', e => { lkw.style.display = e.target.value === 'sel' ? '' : 'none' })
    const q = box.querySelector('#lk-q')
    const list = box.querySelector('#lk-list')
    const ch = box.querySelector('#lk-ch')
    const showChosen = () => {
      ch.innerHTML = chosen ? 'Lien personnalisé pour <b>' + esc(chosen.nom) + '</b>' + (chosen.telephone ? ' · ' + esc(chosen.telephone) : '') + ' <button class="gfc-link" id="lk-chg">changer</button>' : ''
      list.style.display = chosen ? 'none' : 'block'
      q.style.display = chosen ? 'none' : 'block'
      const chg = box.querySelector('#lk-chg')
      if (chg) chg.addEventListener('click', () => {
        chosen = null
        showChosen()
        q.focus()
      })
    }
    const draw = () => {
      const v = q.value.trim().toLowerCase()
      const m = achs.filter(a => v ? achLabel(a).toLowerCase().includes(v) : true).slice(0, 8)
      list.innerHTML = m.length ? m.map(a => '<button type="button" data-a="' + a.id + '">' + esc(achLabel(a)) + '</button>').join('') : '<div class="lk-m">Aucun promoteur trouvé. Créez-le d\'abord dans la page Promoteurs.</div>'
      list.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
        chosen = achs.find(a => String(a.id) === b.dataset.a)
        showChosen()
      }))
    }
    q.addEventListener('input', draw)
    draw()
    showChosen()
    box.querySelector('#lk-go').addEventListener('click', async () => {
      if (!chosen) {
        showNotif('Choisissez le promoteur destinataire du lien.', true)
        q.focus()
        return
      }
      const ids = box.querySelector('#lk-t').value === 'sel' ? selected.map(t => Number(t.key)) : null
      const body = {
        version: box.querySelector('#lk-v').value,
        terrain_ids: ids,
        prospect: chosen.nom,
        acheteur_id: chosen.id,
        note: box.querySelector('#lk-n').value.trim() ? box.querySelector('#lk-n').value.trim() : null,
        expire_le: new Date(Date.now() + Number(box.querySelector('#lk-d').value) * 3600e3).toISOString()
      }
      const r = await fetch(SUPA_URL + '/rest/v1/carte_liens', { method: 'POST', headers: H({ Prefer: 'return=representation' }), body: JSON.stringify(body) })
      if (!r.ok) {
        showNotif('Création du lien impossible : ' + (await r.text()).slice(0, 120), true)
        return
      }
      const row = (await r.json())[0]
      // Les terrains envoyés apparaissent sur la fiche du promoteur comme « Envoyé » (sans écraser une réponse existante)
      if (ids && ids.length) {
        const now = new Date().toISOString()
        const rows = ids.map(id => ({ acheteur_id: chosen.id, terrain_id: id, statut: 'envoye', canal: 'Lien carte', envoye_par: typeof currentAssocie !== 'undefined' ? currentAssocie : null, teaser_envoye_le: now, updated_at: now }))
        try {
          await fetch(SUPA_URL + '/rest/v1/acheteur_terrain_reponses?on_conflict=acheteur_id,terrain_id', { method: 'POST', headers: H({ Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify(rows) })
          if (typeof prLoadExtras === 'function') await prLoadExtras()
        } catch (e) { /* fiche promoteur mise à jour au prochain chargement */ }
      }
      if (typeof logActivity === 'function') logActivity('Lien carte envoyé', 'acheteur', chosen.id, chosen.nom, (ids ? ids.length + ' terrain(s)' : 'tous les terrains') + ', version ' + body.version)
      showLink(row, box, chosen)
    })
  })
}

function waText (row) {
  const d = new Date(row.expire_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  return 'Bonjour' + (row.prospect ? ' ' + row.prospect : '') + ', voici votre sélection de terrains sur Greenfield Atlas : ' + linkUrl(row.token) + ' (lien valable jusqu\'au ' + d + ').'
}

function showLink (row, box, ach) {
  const url = linkUrl(row.token)
  box.innerHTML = '<h3>Lien créé</h3><p style="font-size:13px;color:#4f6a5c">Valable jusqu\'au ' + new Date(row.expire_le).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) + '. Version ' + (row.version === 'qualifie' ? 'acheteur qualifié' : 'découverte') + '.</p>' +
    '<input id="lk-url" readonly value="' + esc(url) + '">' +
    '<div class="gfc-acts"><button class="gfc-btn gfc-b3" id="lk-copy">Copier</button><a class="gfc-btn gfc-b1" target="_blank" rel="noopener" href="https://wa.me/' + (ach && normTel(ach.telephone) ? normTel(ach.telephone) : '') + '?text=' + encodeURIComponent(waText(row)) + '">WhatsApp' + (ach && normTel(ach.telephone) ? ' ' + esc(ach.nom.split(' ')[0]) : '') + '</a><button class="gfc-btn gfc-b4" data-m="close">Fermer</button></div>'
  box.querySelector('[data-m="close"]').addEventListener('click', () => box.parentElement.classList.remove('on'))
  box.querySelector('#lk-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url)
      showNotif('Lien copié')
    } catch (e) {
      box.querySelector('#lk-url').select()
    }
  })
}

async function linksPanel () {
  const [lr, rr] = await Promise.all([
    fetch(SUPA_URL + '/rest/v1/carte_liens?select=*&order=cree_le.desc&limit=60', { headers: H() }),
    fetch(SUPA_URL + '/rest/v1/carte_retours?select=*&order=cree_le.desc&limit=60', { headers: H() })
  ])
  if (!lr.ok) {
    api.modal('<h3>Liens envoyés</h3><p>Les tables ne sont pas encore créées : exécutez le script supabase/carte-terrains.sql dans Supabase.</p><div class="gfc-acts"><button class="gfc-btn gfc-b4" data-m="close">Fermer</button></div>')
    return
  }
  const links = await lr.json()
  const rets = rr.ok ? await rr.json() : []
  const now = Date.now()
  const refById = {}
  const tl = state.terrains ? state.terrains : []
  tl.forEach(t => { refById[t.id] = t.ref })
  const lrow = l => {
    const exp = new Date(l.expire_le).getTime()
    const st = l.revoque ? 'Révoqué' : (exp < now ? 'Expiré' : 'Actif jusqu\'au ' + new Date(l.expire_le).toLocaleDateString('fr-FR'))
    const nb = l.terrain_ids ? l.terrain_ids.length + ' terrain' + (l.terrain_ids.length > 1 ? 's' : '') : 'Tous les terrains'
    const vues = l.vues ? l.vues + ' ouverture' + (l.vues > 1 ? 's' : '') + ', dernière le ' + new Date(l.derniere_vue).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'Pas encore ouvert'
    const actif = !l.revoque && exp > now
    return '<div class="lk-row"><div><b>' + esc(l.prospect ? l.prospect : 'Sans nom') + '</b> · ' + (l.version === 'qualifie' ? 'Qualifié' : 'Découverte') + ' · ' + nb +
      '<div class="lk-m">' + st + ' · ' + vues + ' · par ' + esc(l.cree_par) + '</div></div><div class="lk-a">' +
      (l.acheteur_id ? '<button data-fiche="' + l.acheteur_id + '">Fiche promoteur</button>' : '') +
      (actif ? '<button data-copy="' + l.token + '">Copier</button><button data-rev="' + l.id + '">Révoquer</button>' : '') +
      '<button data-ext="' + l.id + '">+7 j</button></div></div>'
  }
  const rrow = x => {
    const l = links.find(k => k.id === x.lien_id)
    return '<div class="lk-row' + (x.traite ? ' done' : '') + '"><div><b>' + esc(x.nom ? x.nom : 'Prospect') + '</b>' + (x.telephone ? ' · ' + esc(x.telephone) : '') + (l && l.prospect ? ' · lien ' + esc(l.prospect) : '') +
      '<div class="lk-m">' + new Date(x.cree_le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) + ' · ' + x.refs.length + ' terrain' + (x.refs.length > 1 ? 's' : '') + ' : ' + esc(x.refs.join(', ')) + '</div>' +
      (x.message ? '<div class="lk-m">« ' + esc(x.message) + ' »</div>' : '') + '<div class="lk-m">Ajouté' + (x.refs.length > 1 ? 's' : '') + ' en « Intéressé » sur la fiche du promoteur.</div></div><div class="lk-a">' + (l && l.acheteur_id ? '<button data-fiche="' + l.acheteur_id + '">Fiche promoteur</button>' : '') + (x.traite ? '' : '<button data-done="' + x.id + '">Traité</button>') + '</div></div>'
  }
  api.modal('<h3>Sélections reçues</h3>' + (rets.length ? rets.map(rrow).join('') : '<p class="lk-m">Aucune sélection reçue pour le moment.</p>') +
    '<h3 style="margin-top:16px">Liens envoyés</h3>' + (links.length ? links.map(lrow).join('') : '<p class="lk-m">Aucun lien créé.</p>') +
    '<div class="gfc-acts"><button class="gfc-btn gfc-b4" data-m="close">Fermer</button></div>', box => {
    box.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(linkUrl(b.dataset.copy))
        showNotif('Lien copié')
      } catch (e) { showNotif(linkUrl(b.dataset.copy)) }
    }))
    const patch = async (table, id, body) => {
      const r = await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, { method: 'PATCH', headers: H(), body: JSON.stringify(body) })
      if (!r.ok) showNotif('Modification impossible', true)
      linksPanel()
      refreshBadge()
    }
    box.querySelectorAll('[data-rev]').forEach(b => b.addEventListener('click', () => patch('carte_liens', b.dataset.rev, { revoque: true })))
    box.querySelectorAll('[data-ext]').forEach(b => b.addEventListener('click', () => {
      const l = links.find(k => String(k.id) === b.dataset.ext)
      const from = Math.max(Date.now(), new Date(l.expire_le).getTime())
      patch('carte_liens', b.dataset.ext, { expire_le: new Date(from + 7 * 864e5).toISOString(), revoque: false })
    }))
    box.querySelectorAll('[data-done]').forEach(b => b.addEventListener('click', () => patch('carte_retours', b.dataset.done, { traite: true })))
    box.querySelectorAll('[data-fiche]').forEach(b => b.addEventListener('click', async () => {
      box.parentElement.classList.remove('on')
      if (typeof prLoadExtras === 'function') { try { await prLoadExtras() } catch (e) { /* ignore */ } }
      if (typeof prOpen === 'function') {
        prOpen(Number(b.dataset.fiche))
        if (typeof PR !== 'undefined' && typeof prRenderFiche === 'function') {
          PR.tab = 'prop'
          prRenderFiche()
        }
      }
    }))
  })
}

async function importContours (file) {
  if (!file) return
  try {
    let text
    if (/\.gz$/i.test(file.name)) {
      const ds = file.stream().pipeThrough(new DecompressionStream('gzip'))
      text = await new Response(ds).text()
    } else {
      text = await file.text()
    }
    const all = JSON.parse(text)
    // On ne garde que les contours des TF présents dans le CRM (table légère),
    // et ceux rattachés directement à un terrain par sa référence (parcelle trouvée par position, dessin MyMaps)
    const keys = new Set()
    const tl = state.terrains ? state.terrains : []
    tl.forEach(t => { tfCles(t.tf).forEach(k => keys.add(k))
      if (t.ref) keys.add(t.ref) })
    const rows = all.filter(r => keys.has(r.cle))
    const total = rows.length
    if (!total) {
      showNotif('Aucun contour de ce fichier ne correspond à un terrain du CRM (' + all.length.toLocaleString('fr-FR') + ' parcelles lues).', true)
      return
    }
    let done = 0
    api.modal('<h3>Import des contours</h3><p class="lk-m">' + total.toLocaleString('fr-FR') + ' contours correspondent à des terrains du CRM, sur ' + all.length.toLocaleString('fr-FR') + ' parcelles dans le fichier.</p><p id="imp-p">0 sur ' + total.toLocaleString('fr-FR') + '</p>')
    const pEl = document.getElementById('imp-p')
    for (let i = 0; i < total; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const r = await fetch(SUPA_URL + '/rest/v1/terrain_contours?on_conflict=cle', { method: 'POST', headers: H({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(chunk) })
      if (!r.ok) throw new Error((await r.text()).slice(0, 200))
      done += chunk.length
      pEl.textContent = done.toLocaleString('fr-FR') + ' sur ' + total.toLocaleString('fr-FR')
    }
    pEl.textContent = total.toLocaleString('fr-FR') + ' contours importés.'
    pEl.insertAdjacentHTML('afterend', '<div class="gfc-acts"><button class="gfc-btn gfc-b4" data-m="close">Fermer</button></div>')
    pEl.parentElement.querySelector('[data-m="close"]').addEventListener('click', () => pEl.closest('.gfc-modal').classList.remove('on'))
    CONTOURS = await fetchContours()
    api.setData(mode, dataFor(mode))
    showNotif(total.toLocaleString('fr-FR') + ' contours importés')
  } catch (e) {
    showNotif('Import impossible : ' + e.message, true)
  }
}

// Mobile : la carte occupe tout l'espace entre la barre du haut et la barre d'onglets
function layoutMobile () {
  const host = document.getElementById('gfc-host')
  const head = document.getElementById('carte-head')
  if (!host || !head) return
  const m = window.matchMedia('(max-width:900px)').matches && document.body.classList.contains('on-carte')
  if (!m) {
    head.style.top = ''
    host.style.top = ''
    host.style.bottom = ''
    return
  }
  const tb = document.querySelector('.topbar')
  const top = tb ? Math.max(0, tb.getBoundingClientRect().bottom) : 54
  head.style.top = top + 'px'
  host.style.top = (top + head.offsetHeight) + 'px'
  const nav = document.querySelector('.m-nav')
  const nb = nav && getComputedStyle(nav).display !== 'none' ? Math.max(0, window.innerHeight - nav.getBoundingClientRect().top) : 0
  host.style.bottom = nb + 'px'
  if (api) api.map.invalidateSize()
}
window.addEventListener('resize', () => layoutMobile())
window.addEventListener('orientationchange', () => setTimeout(layoutMobile, 300))

async function carteInit () {
  const host = document.getElementById('gfc-host')
  if (!host) return
  setTimeout(layoutMobile, 0)
  if (api) {
    setTimeout(() => {
      layoutMobile()
      api.map.invalidateSize()
    }, 60)
    return
  }
  if (loading) return
  loading = true
  host.innerHTML = '<div class="ch-load">Chargement de la carte…</div>'
  try {
    loadCss('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css')
    if (!window.L) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js')
    if (!window.GFCarte) await loadScript('/carte.js')
    if (typeof favEnsure === 'function') await favEnsure()
    try {
      CONTOURS = await fetchContours()
    } catch (e) {
      CONTOURS = []
      showNotif('Contours indisponibles : exécutez supabase/carte-terrains.sql puis importez les contours.', true)
    }
    host.innerHTML = ''
    api = GFCarte.mount(host, {
      mode, terrains: dataFor(mode), brand: false, sel, intern: internRows,
      openCrm: t => { if (typeof openTerrainDetail === 'function') openTerrainDetail(Number(t.key)) },
      printSub: typeof currentAssocie !== 'undefined' && currentAssocie ? 'Contact : ' + currentAssocie : '',
      printLogo: location.origin + '/teaser/logo-pied-clair.png',
      actions: [{ label: 'Créer un lien prospect', short: 'Lien', cls: 'gfc-b1', always: true, onClick: s => createLink(s) }]
    })
    header()
    layoutMobile()
  } catch (e) {
    host.innerHTML = '<div class="ch-load">La carte n\'a pas pu se charger : ' + esc(e.message) + '</div>'
  }
  loading = false
}

// Rafraîchit la carte quand les terrains ou les favoris changent ailleurs dans le CRM
function carteRefresh () {
  if (api) api.setData(mode, dataFor(mode))
}

// Ouvre la fiche d'un terrain sur la carte, en vue Interne (appelé par le bouton Ouvrir sur Atlas de la fiche terrain).
// Renvoie false si le terrain n'est pas sur la carte.
async function carteOuvrir (id) {
  await carteInit()
  // carteInit rend la main quand un chargement est déjà en cours : on attend que la carte soit montée
  for (let i = 0; i < 150 && !api; i++) await new Promise(resolve => setTimeout(resolve, 100))
  if (!api) return false
  const key = String(id)
  const t = (state.terrains ? state.terrains : []).find(x => String(x.id) === key)
  let change = false
  if (mode !== 'interne') { mode = 'interne'; change = true }
  if (t && t.statut === 'Vendu' && !withSold) { withSold = true; change = true }
  if (change) {
    header()
    api.setData(mode, dataFor(mode))
    mmSync()
  }
  if (!dataFor('interne').some(x => x.key === key)) return false
  // après le redimensionnement de la carte lancé par carteInit
  await new Promise(resolve => setTimeout(resolve, 160))
  api.map.invalidateSize()
  api.select(key, true)
  return true
}

window.carteInit = carteInit
window.carteOuvrir = carteOuvrir
window.carteRefresh = carteRefresh
})()
