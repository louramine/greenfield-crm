/* Greenfield CRM : terrains liés entre eux (même propriétaire, terrains contigus, autre raison).
   Section « Terrains liés » de la fiche terrain. Table Supabase terrain_liens (supabase/terrain-liens.sql).
   Un lien n'a pas de sens : il apparaît sur la fiche des deux terrains. */

const TL_MOTIFS = [
  { k: 'meme_proprietaire', l: 'Même propriétaire' },
  { k: 'contigus', l: 'Contigus' },
  { k: 'autre', l: 'Autre' }
]
let tlLiens = []
let tlPour = null
let tlChoix = null
let tlIndispo = false

function tlLabel (k) {
  const m = TL_MOTIFS.find(x => x.k === k)
  return m ? m.l : k
}

function tlListe () {
  return Array.isArray(state.terrains) ? state.terrains : []
}

function tlNom (t) {
  return t.ref ? t.ref : t.localisation
}

function tlTerrain (id) {
  return tlListe().find(t => String(t.id) === String(id))
}

function tlAutre (l, id) {
  return String(l.terrain_a) === String(id) ? l.terrain_b : l.terrain_a
}

function tlSup (n) {
  n = Number(n) ? Number(n) : 0
  return n > 0 ? Math.round(n).toLocaleString('fr-FR') + ' m²' : 'superficie n.c.'
}

async function tlLoad (id) {
  tlPour = id
  tlLiens = []
  tlChoix = null
  tlIndispo = false
  const f = document.getElementById('tl-form')
  if (f) f.open = false
  tlResetForm()
  tlRender()
  try {
    const q = `${SUPA_URL}/rest/v1/terrain_liens?or=(terrain_a.eq.${encodeURIComponent(id)},terrain_b.eq.${encodeURIComponent(id)})&select=*&order=created_at.asc`
    const r = await fetch(q, { headers: SUPA_HEADERS })
    if (!r.ok) throw new Error(String(r.status))
    const j = await r.json()
    if (String(tlPour) !== String(id)) return
    tlLiens = j
  } catch (e) {
    if (String(tlPour) !== String(id)) return
    tlIndispo = true
  }
  tlRender()
}

function tlRender () {
  const box = document.getElementById('tl-list')
  const nb = document.getElementById('tl-nb')
  if (nb) nb.textContent = tlLiens.length ? '(' + tlLiens.length + ')' : ''
  if (!box) return
  if (tlIndispo) {
    box.innerHTML = '<div class="tl-vide">Liens indisponibles pour le moment.</div>'
    return
  }
  if (!tlLiens.length) {
    box.innerHTML = '<div class="tl-vide">Aucun terrain lié.</div>'
    return
  }
  box.innerHTML = tlLiens.map(l => {
    const oid = tlAutre(l, tlPour)
    const t = tlTerrain(oid)
    const titre = t ? `<b>${escH(t.ref)}</b> ${escH(t.localisation)}` : '<b>Terrain non visible</b>'
    const info = t ? `${tlSup(t.superficie)}, ${escH(t.statut ? t.statut : 'À qualifier')}${t.tf && t.tf !== 'nan' ? ', TF ' + escH(t.tf) : ''}` : ''
    const chips = (l.motifs ? l.motifs : []).map(k => `<span class="tl-chip">${escH(tlLabel(k))}</span>`).join('')
    const note = l.note ? `<div class="tl-note">${escH(l.note)}</div>` : ''
    const qui = l.cree_par ? `<span class="tl-qui">par ${escH(l.cree_par)}</span>` : ''
    const ouvrir = t ? `<button type="button" class="btn btn-ghost btn-sm" onclick="tlOuvrir(${Number(oid)})">Ouvrir</button>` : ''
    return `<div class="tl-item">
      <div class="tl-txt">
        <div class="tl-titre">${titre}</div>
        <div class="tl-info">${info}</div>
        <div class="tl-chips">${chips}${qui}</div>
        ${note}
      </div>
      <div class="tl-acts">${ouvrir}<button type="button" class="btn btn-ghost btn-sm tl-del" onclick="tlRetirer(${Number(l.id)})">Retirer</button></div>
    </div>`
  }).join('')
}

// Recherche du terrain à lier : référence, TF, quartier
function tlNorm (s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function tlChercher () {
  const inp = document.getElementById('tl-q')
  const out = document.getElementById('tl-sugg')
  if (!inp) return
  if (!out) return
  tlChoix = null
  document.getElementById('tl-choix').textContent = ''
  const q = tlNorm(inp.value.trim())
  if (q.length < 2) {
    out.innerHTML = ''
    return
  }
  const deja = new Set(tlLiens.map(l => String(tlAutre(l, tlPour))))
  const res = tlListe().filter(t => String(t.id) !== String(tlPour) && !deja.has(String(t.id)))
    .filter(t => tlNorm([t.ref, t.tf, t.localisation, t.quartier].join(' ')).includes(q))
    .slice(0, 8)
  out.innerHTML = res.length
    ? res.map(t => `<button type="button" class="tl-s" onclick="tlChoisir(${Number(t.id)})"><b>${escH(t.ref)}</b> ${escH(t.localisation)} <span>${tlSup(t.superficie)}${t.tf && t.tf !== 'nan' ? ', TF ' + escH(t.tf) : ''}</span></button>`).join('')
    : '<div class="tl-vide">Aucun terrain trouvé.</div>'
}

function tlChoisir (id) {
  const t = tlTerrain(id)
  if (!t) return
  tlChoix = t.id
  document.getElementById('tl-q').value = ''
  document.getElementById('tl-sugg').innerHTML = ''
  document.getElementById('tl-choix').innerHTML = `Terrain choisi : <b>${escH(t.ref)}</b> ${escH(t.localisation)}`
}

function tlResetForm () {
  const ids = ['tl-q', 'tl-note']
  ids.forEach(i => {
    const e = document.getElementById(i)
    if (e) e.value = ''
  })
  TL_MOTIFS.forEach(m => {
    const c = document.getElementById('tl-m-' + m.k)
    if (c) c.checked = false
  })
  const s = document.getElementById('tl-sugg')
  if (s) s.innerHTML = ''
  const c = document.getElementById('tl-choix')
  if (c) c.textContent = ''
}

async function tlLier () {
  if (tlPour == null) return
  if (tlChoix == null) {
    showNotif('Choisissez le terrain à lier.', true)
    return
  }
  const motifs = TL_MOTIFS.filter(m => document.getElementById('tl-m-' + m.k).checked).map(m => m.k)
  const note = document.getElementById('tl-note').value.trim()
  if (!motifs.length) {
    showNotif('Cochez au moins une raison.', true)
    return
  }
  if (motifs.includes('autre') && !note) {
    showNotif('Précisez la raison dans la note.', true)
    return
  }
  const a = Math.min(Number(tlPour), Number(tlChoix))
  const b = Math.max(Number(tlPour), Number(tlChoix))
  const row = { terrain_a: a, terrain_b: b, motifs, note: note ? note : null, cree_par: currentAssocie ? currentAssocie : null }
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/terrain_liens`, { method: 'POST', headers: { ...SUPA_HEADERS, Prefer: 'return=representation' }, body: JSON.stringify(row) })
    if (r.status === 409) throw new Error('ces deux terrains sont déjà liés')
    if (!r.ok) throw new Error('enregistrement refusé (' + r.status + ')')
    const j = await r.json()
    tlLiens.push(j[0] ? j[0] : row)
    const t1 = tlTerrain(tlPour)
    const t2 = tlTerrain(tlChoix)
    if (typeof addActivity === 'function' && t1 && t2) addActivity(`Terrains liés : ${tlNom(t1)} et ${tlNom(t2)}`)
    tlChoix = null
    tlResetForm()
    document.getElementById('tl-form').open = false
    tlRender()
    showNotif('Terrains liés.')
  } catch (e) {
    showNotif('Échec : ' + e.message, true)
  }
}

async function tlRetirer (lienId) {
  const l = tlLiens.find(x => Number(x.id) === Number(lienId))
  if (!l) return
  const t = tlTerrain(tlAutre(l, tlPour))
  if (!confirm('Retirer le lien avec ' + (t ? tlNom(t) : 'ce terrain') + ' ? Les deux terrains ne sont pas modifiés.')) return
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/terrain_liens?id=eq.${Number(lienId)}`, { method: 'DELETE', headers: { ...SUPA_HEADERS, Prefer: 'return=representation' } })
    const j = r.ok ? await r.json() : []
    if (!j.length) throw new Error('seul l\'auteur du lien ou un associé peut le retirer')
    tlLiens = tlLiens.filter(x => Number(x.id) !== Number(lienId))
    tlRender()
    showNotif('Lien retiré.')
  } catch (e) {
    showNotif('Échec : ' + e.message, true)
  }
}

// Ouvre la fiche du terrain lié à la place de la fiche courante
function tlOuvrir (id) {
  if (typeof tdModifiee === 'function' && tdModifiee() && !confirm('Ouvrir l\'autre terrain sans enregistrer vos modifications ?')) return
  openTerrainDetail(id)
  const m = document.querySelector('#modal-terrain-detail .modal')
  if (m) m.scrollTop = 0
}
