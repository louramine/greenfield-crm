/* Greenfield CRM : page Rendement, affichage (le moteur de calcul est dans rendement.js, objet RD).
   Ordre de lecture : terrain, verdict (prix demandé face au prix maximum), comparaison des trois usages,
   réglages essentiels, bilan. Les réglages modifiés sont gardés sur l'appareil. */
(function () {
  'use strict'
  const R = window.RD
  if (!R) return
  const S = R.S
  const esc = R.esc
  const nf = R.nf
  const mdh = R.mdh
  const pct = R.pct
  const LS_KEY = 'gf-rendement-v1'
  const LOGO = '/teaser/logo-pied-clair.png'

  // Réglages toujours visibles, par usage. Les autres paramètres sont rangés dans des groupes repliés.
  const ESS = {
    promo: ['prix', 'pv', 'rc', 'sho', 'vend', 'cible'],
    lot: ['prix', 'pl', 'pvoie', 'lot', 'cr', 'cible'],
    indus: ['prix', 'pl', 'loy', 'pvoie', 'emp', 'cible']
  }
  const PAL = ['#0a1410', '#1f7a4d', '#2d9e5f', '#7ee0a4', '#e3a13b', '#9cb3a3']
  const UI = { q: '', pickOpen: false, timer: null, savedAt: null, groups: {}, obs: null }

  function root () {
    return document.getElementById('page-rendement')
  }
  function $ (sel) {
    return root().querySelector(sel)
  }
  function $$ (sel) {
    return Array.from(root().querySelectorAll(sel))
  }
  function or (a, b) {
    return a ? a : b
  }
  function norm (s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  }
  function dh (x) {
    return nf(Math.round(x)) + ' DH/m²'
  }
  function paramOf (cat, key) {
    let found = null
    R.DEFS[cat].groups.forEach(g => g.params.forEach(p => {
      if (p[0] === key) found = p
    }))
    return found
  }
  function srcOf (cat, p) {
    const s = S.src && S.src[cat] ? S.src[cat][p[0]] : null
    return or(s, p[4])
  }
  function show (v) {
    const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'))
    if (!isFinite(n)) return ''
    return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
  }
  function stepOf (p, value) {
    const u = p[2]
    if (u.indexOf('%') >= 0) return 1
    if (u === 'DH/m²/mois') return 1
    if (u === 'm²') return value >= 20000 ? 500 : value >= 2000 ? 100 : value >= 500 ? 50 : 10
    if (u.indexOf('DH/m²') === 0) return value >= 5000 ? 250 : value >= 1000 ? 50 : 10
    return 1
  }
  function compute (cat) {
    return R.COMPUTE[cat](S.vals[cat])
  }
  function suggested () {
    const t = S.terrain
    if (!t) return null
    if (!String(or(t.urba, '')).trim()) return null
    return R.catFromUrba(t.urba)
  }

  /* ---------- enregistrement sur l'appareil ---------- */
  function touch () {
    S.fresh = false
    clearTimeout(UI.timer)
    UI.timer = setTimeout(() => {
      UI.savedAt = R.save() ? new Date() : null
      renderSaved()
    }, 500)
  }
  function forget () {
    try {
      const all = R.loadSaved()
      delete all[S.terrainId]
      localStorage.setItem(LS_KEY, JSON.stringify(all))
    } catch (e) {
      return
    }
  }
  function renderSaved () {
    const el = $('#rv-saved')
    if (!el) return
    const saved = R.loadSaved()[S.terrainId]
    const at = UI.savedAt ? UI.savedAt : (saved && saved.at ? new Date(saved.at) : null)
    el.textContent = at
      ? 'Réglages gardés sur cet appareil, ' + at.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : 'Valeurs de départ. Vos modifications seront gardées sur cet appareil.'
  }

  /* ---------- squelette de la page ---------- */
  function renderAll () {
    const el = root()
    if (!el) return
    const t = S.terrain
    blankSurface()
    el.innerHTML =
      '<div class="rv-top">' + topHtml() + '</div>' +
      '<section class="rv-verdict" id="rv-verdict" aria-live="polite"></section>' +
      '<div class="rv-uses" role="tablist" aria-label="Usage étudié" id="rv-uses"></div>' +
      '<div class="rv-grid">' +
        '<div class="rv-col rv-col-set"><div class="card rv-card" id="rv-set"></div></div>' +
        '<div class="rv-col rv-col-res">' +
          '<div class="card rv-card" id="rv-bilan"></div>' +
          '<div class="card rv-card"><div class="card-title">Si les prix bougent</div>' +
            '<p class="rv-note">Rentabilité après impôt selon le prix du terrain (lignes) et le prix de vente (colonnes). En vert, la marge cible est tenue.</p>' +
            '<div class="rv-sens-w"><div class="rv-sens" id="rv-sens"></div></div></div>' +
          (t ? '<div class="card rv-card rd-pa" id="rv-pa"></div>' : '') +
          '<div class="card rv-card" id="rv-watch"></div>' +
          '<details class="card rv-card rv-fold" id="rv-specs"></details>' +
        '</div>' +
      '</div>' +
      '<div class="rv-sticky" id="rv-sticky" hidden></div>'
    renderSet()
    renderPa()
    update()
    bind()
  }

  function topHtml () {
    const t = S.terrain
    const name = t ? or(t.localisation, 'Sans nom') : 'Étude de référence J-ONE Promo'
    const ref = t ? or(t.ref, 'Sans réf.') : 'Exemple'
    const zc = t && typeof zoneChip === 'function' ? R.regleOf(t, S.code).codes.map(c => zoneChip(c)).join(' ') : ''
    const facts = t
      ? [['Surface', Number(t.superficie) ? nf(Number(t.superficie)) + ' m²' : 'À renseigner'],
          ['Prix demandé', Number(t.prix) ? dh(Number(t.prix)) : 'À renseigner'],
          ['Zonage', zc ? zc : esc(or(t.urba, 'À renseigner'))]]
      : [['Surface', '20 258 m²'], ['Prix demandé', '1 600 DH/m²'], ['Zonage', 'CS-DB3']]
    return '<div class="rv-pick" id="rv-pick">' +
        '<button type="button" class="rv-pick-btn" id="rv-pick-btn" aria-haspopup="listbox" aria-expanded="false">' +
          '<span class="rv-pick-ref">' + esc(ref) + '</span><span class="rv-pick-name">' + esc(name) + '</span>' +
          '<span class="rv-pick-chg">Changer</span></button>' +
        '<div class="rv-pop" id="rv-pop" hidden>' +
          '<input class="form-input" id="rv-q" type="search" autocomplete="off" placeholder="Référence, quartier, TF ou zonage" aria-label="Chercher un terrain">' +
          '<div class="rv-pop-list" id="rv-pop-list" role="listbox"></div></div>' +
      '</div>' +
      '<div class="rv-facts">' + facts.map(f => '<div><span>' + f[0] + '</span><b>' + (f[0] === 'Zonage' ? f[1] : esc(f[1])) + '</b></div>').join('') + '</div>' +
      '<div class="rv-top-acts">' +
        (t ? '<button type="button" class="btn btn-ghost btn-sm" id="rv-fiche">Fiche terrain</button>' : '') +
        '<button type="button" class="btn btn-primary btn-sm" id="rv-pdf">Fiche PDF</button></div>'
  }

  /* ---------- recherche de terrain ---------- */
  function renderPop () {
    const list = $('#rv-pop-list')
    if (!list) return
    const q = norm(UI.q.trim())
    const all = R.terrains()
    const res = (q ? all.filter(t => norm([t.ref, t.localisation, t.quartier, t.tf, t.urba].join(' ')).indexOf(q) >= 0) : all).slice(0, 40)
    let h = res.map(t => {
      const sup = Number(t.superficie)
      return '<button type="button" class="rv-opt' + (String(t.id) === String(S.terrainId) ? ' cur' : '') + '" role="option" data-id="' + esc(t.id) + '">' +
        '<span class="rv-opt-ref">' + esc(or(t.ref, 'Sans réf.')) + '</span>' +
        '<span class="rv-opt-name">' + esc(or(t.localisation, 'Non renseigné')) + '</span>' +
        '<span class="rv-opt-sup">' + (sup ? nf(sup) + ' m²' : 'm² n.c.') + (t.urba ? ', ' + esc(t.urba) : '') + '</span></button>'
    }).join('')
    if (!res.length) h = '<div class="rv-pop-empty">Aucun terrain ne correspond. Essayez une référence, un quartier ou un TF.</div>'
    if (!q && all.length > res.length) h += '<div class="rv-pop-empty">Les 40 terrains les plus récents. Tapez pour chercher parmi les ' + nf(all.length) + '.</div>'
    h += '<button type="button" class="rv-opt rv-opt-ex' + (S.terrainId === R.REF_ID ? ' cur' : '') + '" role="option" data-id="' + R.REF_ID + '">' +
      '<span class="rv-opt-ref">Exemple</span><span class="rv-opt-name">Étude de référence J-ONE Promo</span><span class="rv-opt-sup">20 258 m², CS-DB3</span></button>'
    list.innerHTML = h
    list.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => pick(b.getAttribute('data-id'))))
  }
  function openPop (on) {
    UI.pickOpen = on
    const pop = $('#rv-pop')
    const btn = $('#rv-pick-btn')
    if (!pop) return
    pop.hidden = !on
    btn.setAttribute('aria-expanded', String(on))
    if (on) {
      UI.q = ''
      $('#rv-q').value = ''
      renderPop()
      $('#rv-q').focus()
    }
  }
  function pick (id) {
    S.picked = true
    UI.savedAt = null
    R.selectTerrain(id)
    renderAll()
    window.scrollTo(0, 0)
  }

  /* ---------- réglages ---------- */
  function rowHtml (cat, p, stepper) {
    const id = 'rv-f-' + cat + '-' + p[0]
    const so = srcOf(cat, p)
    const val = S.vals[cat][p[0]]
    return '<div class="rv-row' + (stepper ? ' rv-row-ess' : '') + '">' +
      '<label for="' + id + '"><span class="rd-dot rd-dot-' + so + '" title="' + R.SRC_LABEL[so] + '"></span>' + p[1] + '</label>' +
      '<div class="rv-in">' +
        (stepper ? '<button type="button" class="rv-step" data-step="-1" data-k="' + p[0] + '" aria-label="Diminuer ' + esc(p[1]) + '">−</button>' : '') +
        '<input class="form-input" id="' + id + '" data-k="' + p[0] + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(show(val)) + '">' +
        (stepper ? '<button type="button" class="rv-step" data-step="1" data-k="' + p[0] + '" aria-label="Augmenter ' + esc(p[1]) + '">+</button>' : '') +
        '<span class="rv-unit">' + p[2] + '</span></div></div>'
  }
  function renderSet () {
    const el = $('#rv-set')
    const cat = S.cat
    const def = R.DEFS[cat]
    const t = S.terrain
    let ess = ESS[cat].slice()
    // Sans surface sur la fiche, la surface devient le premier réglage à donner.
    if (!(t && Number(t.superficie))) ess = ['surf'].concat(ess)
    let h = '<div class="card-title">Réglages ' + def.short + '</div>'
    if (cat === 'promo' && R.promoFromRef()) {
      h += '<div class="rv-seg" role="group" aria-label="Version de l’étude">' +
        '<button type="button" data-ver="gf" aria-pressed="' + (S.version === 'gf') + '" class="' + (S.version === 'gf' ? 'active' : '') + '">Recalée Greenfield</button>' +
        '<button type="button" data-ver="jone" aria-pressed="' + (S.version === 'jone') + '" class="' + (S.version === 'jone' ? 'active' : '') + '">Étude J-ONE telle quelle</button></div>' +
        '<p class="rv-note">' + (S.version === 'gf'
          ? 'Ajoute le sous-sol, les frais annexes, l’hypothèque et les frais financiers absents du fichier.'
          : 'Reprend exactement les chiffres du fichier, soit 41,3 % de rentabilité affichée.') + '</p>'
    } else if (cat === 'promo') {
      const pc = S.src && S.src.promo ? S.src.promo.cos : null
      h += '<p class="rv-note">' + (pc === 'R' ? 'Programme estimé à partir du COS du règlement de zone. Remplacez la SHO et la surface vendable par celles du projet quand vous les avez.'
        : pc === 'H' ? 'Le règlement ne fixe pas de COS : programme estimé avec l’emprise et le nombre de niveaux autorisés. À remplacer par la consistance réelle du projet.'
        : 'Programme estimé avec un COS de 1,1. Remplacez la SHO et la surface vendable par celles du projet.') + '</p>'
    }
    h += '<div class="rv-ess">' + ess.map(k => rowHtml(cat, paramOf(cat, k), true)).join('') + '</div>'
    h += '<div class="rv-more-t">Tous les paramètres</div>'
    def.groups.forEach((g, i) => {
      const rest = g.params.filter(p => ess.indexOf(p[0]) < 0)
      if (!rest.length) return
      const gk = cat + '-' + i
      h += '<details class="rv-group" data-g="' + gk + '"' + (UI.groups[gk] ? ' open' : '') + '><summary><span>' + g.title + '</span><em>' + rest.length + '</em></summary>' +
        rest.map(p => rowHtml(cat, p, false)).join('') + '</details>'
    })
    h += '<div class="rv-legend">' + ['E', 'R', 'H'].map(s => '<span><span class="rd-dot rd-dot-' + s + '"></span>' + R.SRC_LABEL[s] + '</span>').join('') + '</div>' +
      '<div class="rv-set-foot"><span id="rv-saved"></span><button type="button" class="btn btn-ghost btn-sm" id="rv-reset">Revenir aux valeurs de départ</button></div>'
    el.innerHTML = h
    renderSaved()
    bindSet()
  }
  // Terrain sans surface sur sa fiche : on ne garde pas la surface de l'étude de référence comme valeur de départ.
  function blankSurface () {
    const t = S.terrain
    if (!t) return
    if (Number(t.superficie)) return
    if (!S.fresh) return
    R.CATS.forEach(c => {
      S.vals[c].surf = ''
    })
    const z = ['sho', 'vend', 'ssol', 'nbLog', 'nbPark', 'cons']
    z.forEach(k => {
      S.vals.promo[k] = '0'
    })
  }
  // Quand la surface est donnée et que le programme de promotion est vide, il est estimé avec les ratios de départ.
  function fillProgramme () {
    const v = S.vals.promo
    if (R.num(v, 'sho') > 0) return false
    const surf = R.num(v, 'surf')
    if (!(surf > 0)) return false
    const cos = or(R.num(v, 'cos'), 1.1)
    const sho = surf * cos
    const vend = sho * 0.84
    const nbLog = Math.max(1, Math.round(vend / 88))
    v.sho = R.fmtIn(Math.round(sho))
    v.vend = R.fmtIn(Math.round(vend))
    v.ssol = R.fmtIn(Math.round(surf * 0.25))
    v.nbLog = R.fmtIn(nbLog)
    v.nbPark = R.fmtIn(nbLog)
    v.cons = R.fmtIn(Math.round(nbLog * 28900))
    return true
  }
  function setVal (key, raw) {
    S.vals[S.cat][key] = raw
    if (key === 'surf' && S.terrain) {
      // la surface saisie vaut pour les trois usages
      R.CATS.forEach(c => {
        S.vals[c].surf = raw
      })
    }
    touch()
    update()
  }
  function bindSet () {
    const el = $('#rv-set')
    el.querySelectorAll('input[data-k]').forEach(inp => {
      const key = inp.getAttribute('data-k')
      inp.addEventListener('focus', () => {
        inp.value = String(S.vals[S.cat][key] == null ? '' : S.vals[S.cat][key]).replace(/\s/g, '')
        inp.select()
      })
      inp.addEventListener('input', () => setVal(key, inp.value))
      inp.addEventListener('blur', () => {
        inp.value = show(S.vals[S.cat][key])
        if (key === 'surf' && S.terrain && fillProgramme()) {
          touch()
          renderSet()
          update()
        }
      })
    })
    el.querySelectorAll('.rv-step').forEach(b => b.addEventListener('click', () => {
      const key = b.getAttribute('data-k')
      const p = paramOf(S.cat, key)
      const cur = R.num(S.vals[S.cat], key)
      const st = stepOf(p, cur)
      const next = Math.max(0, Math.round((cur + st * Number(b.getAttribute('data-step'))) / st) * st)
      S.vals[S.cat][key] = R.fmtIn(next)
      const inp = el.querySelector('input[data-k="' + key + '"]')
      if (inp) inp.value = show(next)
      touch()
      update()
    }))
    el.querySelectorAll('details[data-g]').forEach(d => d.addEventListener('toggle', () => {
      UI.groups[d.getAttribute('data-g')] = d.open
    }))
    el.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => {
      S.version = b.getAttribute('data-ver')
      S.vals.promo = R.defaults('promo')
      if (S.version === 'jone') Object.keys(R.PRESET_JONE).forEach(k => {
        S.vals.promo[k] = R.fmtIn(R.PRESET_JONE[k])
      })
      touch()
      renderSet()
      update()
    }))
    const rs = el.querySelector('#rv-reset')
    rs.addEventListener('click', () => {
      const st = R.startVals(S.terrain)
      S.vals[S.cat] = st.v[S.cat]
      if (S.src) S.src[S.cat] = st.src[S.cat]
      if (S.cat === 'promo') S.version = 'gf'
      clearTimeout(UI.timer)
      forget()
      UI.savedAt = null
      S.fresh = true
      renderSet()
      update()
    })
  }

  /* ---------- verdict, usages, bilan : recalculés à chaque frappe ---------- */
  function verdictOf (cat, res) {
    const short = R.DEFS[cat].short
    const cible = nf(res.cible * 100) + ' % de marge'
    if (!(res.ca > 0)) {
      return { st: 'na', chip: 'Calcul incomplet', title: 'Donnez la surface du terrain et un prix de vente pour obtenir le bilan.', sub: '' }
    }
    const max = Math.max(0, res.prixMax)
    if (!(res.prix > 0)) {
      return { st: 'na', chip: 'Prix demandé à renseigner', title: 'En ' + short + ', ce terrain supporte jusqu’à ' + dh(max) + '.',
        sub: 'Prix maximum pour tenir ' + cible + '. Indiquez le prix demandé pour le comparer.' }
    }
    if (res.prixMax >= res.prix) {
      return { st: 'ok', chip: 'Prix demandé tenable', title: 'En ' + short + ', ce terrain supporte jusqu’à ' + dh(max) + '.',
        sub: 'Il est demandé à ' + dh(res.prix) + ' : il reste ' + dh(res.prixMax - res.prix) + ' de marge de négociation en tenant ' + cible + '.' }
    }
    return { st: 'ko', chip: 'Prix demandé trop élevé', title: 'En ' + short + ', il faudrait descendre à ' + dh(max) + '.',
      sub: 'Il est demandé à ' + dh(res.prix) + ', soit ' + dh(res.prix - max) + ' de trop pour tenir ' + cible + '.' }
  }
  function gaugeHtml (res) {
    if (!(res.ca > 0)) return ''
    const max = Math.max(0, res.prixMax)
    const scale = Math.max(max, res.prix, 1) * 1.18
    const pm = max / scale * 100
    const pd = res.prix / scale * 100
    const side = x => (x > 72 ? ' rv-g-left' : '')
    return '<div class="rv-gauge" role="img" aria-label="Prix demandé ' + nf(res.prix) + ' DH/m², prix maximum ' + nf(max) + ' DH/m²">' +
      (res.prix > 0 ? '<div class="rv-g-ask' + side(pd) + '" style="left:' + pd.toFixed(1) + '%"><span>Demandé ' + nf(res.prix) + '</span></div>' : '') +
      '<div class="rv-g-track"><div class="rv-g-fill" style="width:' + pm.toFixed(1) + '%"></div></div>' +
      '<div class="rv-g-max' + side(pm) + '" style="left:' + pm.toFixed(1) + '%"><span>Maximum ' + nf(max) + '</span></div></div>'
  }
  function figures (cat, res) {
    const tx = res.tax
    const f = [
      [cat === 'indus' ? 'Rentabilité lots après impôt' : 'Rentabilité après impôt', pct(tx.rentNet), 'Avant impôt ' + pct(res.rent)],
      ['Marge nette', mdh(tx.net), 'Avant impôt ' + mdh(res.ca - res.cost)],
      ['Chiffre d’affaires', mdh(res.ca), 'Coût total ' + mdh(res.cost)]
    ]
    const k = cat === 'indus' ? res.kpis[1] : res.kpis[2]
    f.push([k[0], k[1], k[2]])
    return f
  }
  function update () {
    const cat = S.cat
    const res = compute(cat)
    const v = verdictOf(cat, res)
    const ve = $('#rv-verdict')
    ve.className = 'rv-verdict rv-' + v.st
    ve.innerHTML =
      '<div class="rv-v-main">' +
        '<span class="rv-chip"><i></i>' + v.chip + '</span>' +
        '<h2>' + esc(v.title) + '</h2>' +
        (v.sub ? '<p>' + esc(v.sub) + '</p>' : '') +
        gaugeHtml(res) +
      '</div>' +
      '<div class="rv-v-figs">' + figures(cat, res).map(f =>
        '<div><span>' + f[0] + '</span><b>' + f[1] + '</b><em>' + f[2] + '</em></div>').join('') + '</div>'

    const sug = suggested()
    $('#rv-uses').innerHTML = R.CATS.map(c => {
      const rc = c === cat ? res : compute(c)
      const st = !(rc.ca > 0) ? 'na' : !(rc.prix > 0) ? 'na' : rc.prixMax >= rc.prix ? 'ok' : 'ko'
      return '<button type="button" role="tab" class="rv-use rv-' + st + (c === cat ? ' active' : '') + '" aria-selected="' + (c === cat) + '" data-cat="' + c + '">' +
        '<span class="rv-use-t"><i></i>' + R.DEFS[c].label + (c === sug ? '<em>Suggéré par le zonage</em>' : '') + '</span>' +
        '<span class="rv-use-n"><b>' + (rc.ca > 0 ? nf(Math.max(0, Math.round(rc.prixMax))) : 'n.d.') + '</b> DH/m² maximum</span>' +
        '<span class="rv-use-s">Après impôt ' + pct(rc.tax.rentNet) + '</span></button>'
    }).join('')
    $$('.rv-use').forEach(b => b.addEventListener('click', () => {
      if (b.getAttribute('data-cat') === S.cat) return
      S.cat = b.getAttribute('data-cat')
      touchCat()
      renderAll()
    }))

    renderBilan(cat, res)
    renderSens(cat, res)
    renderWatch(cat, res)
    const st = $('#rv-sticky')
    st.className = 'rv-sticky rv-' + v.st
    st.innerHTML = '<i></i><span class="rv-st-a">' + R.DEFS[cat].label + '</span>' +
      '<span class="rv-st-b">Max <b>' + (res.ca > 0 ? nf(Math.max(0, Math.round(res.prixMax))) : 'n.d.') + '</b> DH/m²</span>' +
      '<span class="rv-st-b">Après impôt <b>' + pct(res.tax.rentNet) + '</b></span>'
  }
  // Changer d'usage ne modifie aucun chiffre : on garde seulement le dernier usage consulté si des réglages existent déjà.
  function touchCat () {
    if (R.loadSaved()[S.terrainId]) R.save()
  }

  function renderBilan (cat, res) {
    const tx = res.tax
    const total = or(res.cost, 1)
    const marge = res.ca - res.cost
    const bar = res.costs.map((c, i) => '<i style="width:' + Math.max(0, c[1] / total * 100).toFixed(2) + '%' + '" title="' + esc(c[0]) + '" class="rv-c' + (i % PAL.length) + '"></i>').join('')
    const rows = res.costs.map((c, i) => '<div class="rv-line"><span><i class="rv-sw rv-c' + (i % PAL.length) + '"></i>' + c[0] + '</span><b>' + mdh(c[1]) + '</b><em>' + pct(c[1] / total) + '</em></div>').join('')
    const sums = [
      ['Chiffre d’affaires', mdh(res.ca), ''],
      ['Coût total', '− ' + mdh(res.cost), ''],
      ['Marge avant impôt', mdh(marge), 'rv-sum-b'],
      ['IS ' + (tx.cmApplies ? '(cotisation minimale)' : pct(tx.isRate)), '− ' + mdh(tx.is), ''],
      ['Contribution de solidarité ' + (tx.cssRate ? pct(tx.cssRate) : '(non due)'), '− ' + mdh(tx.css), ''],
      ['Résultat net après impôt', mdh(tx.net), 'rv-sum-net']
    ]
    $('#rv-bilan').innerHTML =
      '<div class="card-title">Bilan ' + R.DEFS[cat].short + '</div>' +
      '<div class="rv-stack" aria-hidden="true">' + bar + '</div>' +
      '<div class="rv-lines">' + rows + '</div>' +
      '<div class="rv-sums">' + sums.map(s => '<div class="rv-sum ' + s[2] + '"><span>' + esc(s[0]) + '</span><b>' + s[1] + '</b></div>').join('') + '</div>' +
      '<details class="rv-tax"><summary>Comment l’impôt est estimé</summary><p class="rv-note">Bénéfice réparti sur ' + tx.duree + ' exercice' + (tx.duree > 1 ? 's' : '') + ', soit ' + mdh(Math.max(0, tx.bY)) +
      ' par an. Barèmes 2026 : IS 20 % sous 100 M DH de bénéfice annuel, 35 % au-delà. La contribution de solidarité n’est pas déductible. Estimation à valider avec votre expert-comptable.</p></details>'
  }

  function sensData (cat, res) {
    const def = R.DEFS[cat]
    const vals = S.vals[cat]
    const cols = [-0.1, -0.05, 0, 0.05, 0.1]
    const lines = [-0.1, 0, 0.1]
    return {
      cols: cols,
      lines: lines.map(l => ({
        l: l,
        cells: cols.map(s => {
          const v2 = Object.assign({}, vals)
          v2[def.land] = String(R.num(vals, def.land) * (1 + l))
          def.sale.forEach(k => {
            v2[k] = String(R.num(vals, k) * (1 + s))
          })
          const rr = R.COMPUTE[cat](v2)
          const r = rr.tax.rentNet
          return { r: r, cls: rr.rent >= res.cible ? 'ok' : (r >= 0 ? 'mid' : 'ko'), cur: l === 0 && s === 0 }
        })
      }))
    }
  }
  function sg (x) {
    return x === 0 ? 'actuel' : (x > 0 ? '+' : '−') + nf(Math.abs(x) * 100) + ' %'
  }
  function renderSens (cat, res) {
    const d = sensData(cat, res)
    let h = '<span class="rv-sh rv-sh-c">Terrain / Vente</span>' + d.cols.map(s => '<span class="rv-sh">' + sg(s) + '</span>').join('')
    d.lines.forEach(line => {
      h += '<span class="rv-sh rv-sl">' + sg(line.l) + '</span>' + line.cells.map(c => '<span class="rv-sc ' + c.cls + (c.cur ? ' cur' : '') + '">' + pct(c.r) + '</span>').join('')
    })
    $('#rv-sens').innerHTML = h
  }

  function renderWatch (cat, res) {
    const w = R.watchFor(cat, S.vals[cat], res.extra)
    $('#rv-watch').innerHTML = '<div class="card-title">' + esc(w.t) + '</div>' +
      w.items.map(it => '<div class="rv-w"><i class="rv-wd rv-wd-' + it[0] + '"></i><span>' + esc(it[1]) + '</span></div>').join('')
    const sp = $('#rv-specs')
    const open = sp.open
    sp.innerHTML = '<summary>Détail du programme ' + R.DEFS[cat].short + '</summary>' +
      R.specsFor(cat, S.vals[cat], res.extra).map(s => '<div class="rv-spec"><span>' + esc(s[0]) + '</span><b>' + esc(s[1]) + '</b></div>').join('')
    sp.open = open
  }

  /* ---------- plan d'aménagement ---------- */
  function renderPa () {
    const el = $('#rv-pa')
    const t = S.terrain
    if (!el) return
    if (!t) return
    const PA = R.PA
    if (!PA.ok) {
      el.innerHTML = '<div class="card-title">Règles d’urbanisme</div><p class="rv-note">' +
        (PA.p ? 'Chargement des plans d’aménagement…' : 'Plans d’aménagement indisponibles pour le moment.') + '</p>'
      return
    }
    const g = R.regleOf(t, S.code)
    const p = g.plan ? PA.plans[g.plan] : null
    const opts = '<option value="">' + (p ? 'Changer de plan' : 'Choisir le plan') + '</option>' +
      Object.keys(PA.plans).map(k => PA.plans[k]).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
        .map(x => '<option value="' + esc(x.code) + '"' + (p && x.code === p.code ? ' selected' : '') + '>' + esc(x.nom) + '</option>').join('')
    let h = '<div class="card-title">Règles d’urbanisme' +
      '<span class="rd-acts"><select class="form-select rd-pa-sel" id="rv-pa-plan" aria-label="Plan d’aménagement">' + opts + '</select></span></div>'
    if (!p) {
      el.innerHTML = h + '<p class="rv-note">« ' + esc(or(t.localisation, 'Localisation non renseignée')) + ' » n’est rattaché à aucun plan d’aménagement. Choisissez le plan dans la liste, ou reportez les règles de la note de renseignements dans les réglages.</p>'
      bindPa()
      return
    }
    h += '<div class="rd-pa-sub">Plan de ' + esc(p.nom) + ', décret ' + esc(or(p.decret, '')) + ', BO du ' + R.fdate(p.date_bo) + '</div>'
    if (g.codes.length > 1) {
      h += '<div class="rd-pa-codes" role="group" aria-label="Secteur">' + g.codes.map(c =>
        '<button type="button" data-code="' + esc(c) + '" class="' + (c === g.code ? 'active' : '') + '" aria-pressed="' + (c === g.code) + '">' + esc(c) + '</button>').join('') + '</div>'
    }
    const al = R.paAlert(p)
    if (!g.m) {
      h += '<p class="rv-note">' + (g.code ? 'Le secteur « ' + esc(g.code) + ' » n’est pas dans le référentiel de ce plan.' : 'Le zonage n’est pas renseigné sur la fiche du terrain.') +
        ' Reportez les règles de la note de renseignements dans les réglages.</p>' + (al ? '<div class="rd-pa-al">' + esc(al) + '</div>' : '') + R.paLinks(p, null)
      el.innerHTML = h
      bindPa()
      return
    }
    const rg = g.m.r
    h += '<div class="rd-pa-sec">Secteur <b>' + esc(rg.secteur) + '</b>' + (g.m.exact ? '' : ' <span>(règle la plus proche du code ' + esc(g.code) + ')</span>') + '</div>' +
      '<div class="rd-pa-facts">' + R.regleFacts(rg).map(f => '<div><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>').join('') + '</div>'
    if (rg.remarque) h += '<p class="rv-note">' + esc(rg.remarque) + '</p>'
    if (!rg.verifie) h += '<div class="rd-pa-al rd-pa-chk">Chiffres lus automatiquement sur le scan du règlement : à confirmer sur la note de renseignements.</div>'
    if (al) h += '<div class="rd-pa-al">' + esc(al) + '</div>'
    h += '<div class="rd-pa-foot">' + R.paLinks(p, rg) +
      '<button type="button" class="btn btn-ghost btn-sm" id="rv-pa-apply">Reprendre ces règles dans le calcul</button></div>'
    el.innerHTML = h
    bindPa()
  }
  function bindPa () {
    const el = $('#rv-pa')
    if (!el) return
    const sel = el.querySelector('#rv-pa-plan')
    if (sel) {
      sel.addEventListener('change', () => {
        if (!S.terrain) return
        R.setPlanPick(S.terrain.id, sel.value ? sel.value : null)
        S.code = null
        reapply()
      })
    }
    el.querySelectorAll('[data-code]').forEach(b => b.addEventListener('click', () => {
      S.code = b.getAttribute('data-code')
      reapply()
    }))
    const ap = el.querySelector('#rv-pa-apply')
    if (ap) ap.addEventListener('click', () => reapply())
  }
  // Applique les règles du secteur choisi aux trois usages, sans toucher aux autres paramètres.
  function reapply () {
    const t = S.terrain
    if (t && R.PA.ok) {
      const g = R.regleOf(t, S.code)
      S.code = g.code
      if (g.m) {
        const surf = or(R.num(S.vals[S.cat], 'surf'), or(Number(t.superficie), 0))
        const src = R.applyRegle(S.vals, g.m.r, surf)
        if (!S.src) S.src = { promo: {}, lot: {}, indus: {} }
        R.CATS.forEach(c => Object.keys(src[c]).forEach(k => {
          S.src[c][k] = src[c][k]
        }))
      }
    }
    renderPa()
    renderSet()
    update()
  }

  /* ---------- liaisons générales ---------- */
  function bind () {
    $('#rv-pick-btn').addEventListener('click', () => openPop(!UI.pickOpen))
    const q = $('#rv-q')
    q.addEventListener('input', () => {
      UI.q = q.value
      renderPop()
    })
    q.addEventListener('keydown', e => {
      if (e.key === 'Escape') openPop(false)
      if (e.key === 'Enter') {
        const first = $('#rv-pop-list [data-id]')
        if (first) pick(first.getAttribute('data-id'))
      }
    })
    const fi = $('#rv-fiche')
    if (fi) {
      fi.addEventListener('click', () => {
        if (S.terrain && typeof openTerrainDetail === 'function') openTerrainDetail(S.terrain.id)
      })
    }
    $('#rv-pdf').addEventListener('click', printFiche)
    // Sur téléphone, un rappel du verdict reste visible pendant qu'on règle les paramètres.
    if (UI.obs) UI.obs.disconnect()
    if ('IntersectionObserver' in window) {
      UI.obs = new IntersectionObserver(en => {
        const st = $('#rv-sticky')
        if (st) st.hidden = en[0].isIntersecting
      }, { threshold: 0.05 })
      UI.obs.observe($('#rv-verdict'))
    }
  }
  document.addEventListener('click', e => {
    if (!UI.pickOpen) return
    const p = document.getElementById('rv-pick')
    if (p && !p.contains(e.target)) openPop(false)
  })

  /* ---------- fiche PDF du bilan ----------
     Destinée à un promoteur : bilan au prix demandé, sans titre foncier, sans sourceur,
     et sans le prix maximum ni la marge de négociation, qui restent internes. */
  function rules (o) {
    return Object.keys(o).map(sel => Object.keys(o[sel]).map(k => sel + '{' + k + ':' + o[sel][k] + '}').join('')).join('')
  }
  function printFiche () {
    const cat = S.cat
    const def = R.DEFS[cat]
    const res = compute(cat)
    const tx = res.tax
    const t = S.terrain
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const who = typeof currentAssocie !== 'undefined' && currentAssocie ? currentAssocie : ''
    const name = t ? or(t.localisation, 'Terrain') : 'Étude de référence'
    const ref = t ? or(t.ref, '') : 'Exemple'
    const surf = R.num(S.vals[cat], 'surf')
    const facts = [['Référence', ref], ['Localisation', name], ['Zonage', t ? or(t.urba, 'n.c.') : 'CS-DB3'],
      ['Surface', nf(surf) + ' m²'], ['Prix du terrain', dh(res.prix)], ['Prix global', mdh(surf * res.prix)]]
    const figs = figures(cat, res)
    const total = or(res.cost, 1)
    const costRows = res.costs.map(c => '<tr><td>' + esc(c[0]) + '</td><td class="n">' + mdh(c[1]) + '</td><td class="n d">' + pct(c[1] / total) + '</td></tr>').join('')
    const sumRows = [
      ['Chiffre d’affaires', mdh(res.ca), ''], ['Coût total', mdh(res.cost), ''], ['Marge avant impôt', mdh(res.ca - res.cost), 'b'],
      ['IS', mdh(tx.is), ''], ['Contribution sociale de solidarité', mdh(tx.css), ''], ['Résultat net après impôt', mdh(tx.net), 'b net']
    ].map(r => '<tr class="' + r[2] + '"><td>' + r[0] + '</td><td class="n">' + r[1] + '</td></tr>').join('')
    const hyp = def.groups.map(g => '<div class="hg"><h3>' + g.title + '</h3>' + g.params.map(p =>
      '<div class="hr"><span>' + p[1] + '</span><b>' + show(S.vals[cat][p[0]]) + ' ' + p[2] + '</b></div>').join('') + '</div>').join('')
    const sd = sensData(cat, res)
    const sens = '<table class="sens"><tr><th>Terrain / Vente</th>' + sd.cols.map(c => '<th>' + sg(c) + '</th>').join('') + '</tr>' +
      sd.lines.map(l => '<tr><th>' + sg(l.l) + '</th>' + l.cells.map(c => '<td class="' + c.cls + (c.cur ? ' cur' : '') + '">' + pct(c.r) + '</td>').join('') + '</tr>').join('') + '</table>'
    const css = rules({
      'body': { margin: '0', 'font-family': '"Inter Tight",Inter,system-ui,sans-serif', color: '#0a1410', 'font-size': '12.5px', 'line-height': '1.4', '-webkit-print-color-adjust': 'exact', 'print-color-adjust': 'exact' },
      '.bar': { position: 'sticky', top: '0', background: '#0a1410', color: '#7ee0a4', padding: '10px 14px', display: 'flex', gap: '10px', 'align-items': 'center', 'justify-content': 'space-between', 'font-size': '13px' },
      '.bar button': { font: 'inherit', 'font-weight': '600', background: '#7ee0a4', color: '#0a1410', border: 'none', 'border-radius': '999px', padding: '8px 16px', cursor: 'pointer' },
      '.pg': { 'max-width': '780px', margin: '0 auto', padding: '22px 18px 30px' },
      '.hd': { display: 'flex', 'justify-content': 'space-between', 'align-items': 'flex-end', 'border-bottom': '2px solid #0a1410', 'padding-bottom': '10px' },
      '.hd img': { height: '30px' },
      '.hd div': { 'text-align': 'right', 'font-size': '11.5px', color: '#4f6a5c' },
      'h1': { 'font-family': 'Archivo,sans-serif', 'font-weight': '800', 'font-size': '24px', 'letter-spacing': '-0.01em', margin: '18px 0 2px' },
      '.sub': { color: '#4f6a5c', margin: '0 0 14px' },
      'h2': { 'font-family': 'Archivo,sans-serif', 'font-weight': '800', 'font-size': '13px', margin: '20px 0 8px' },
      '.facts': { display: 'grid', 'grid-template-columns': 'repeat(3,1fr)', gap: '10px 18px', background: '#f4f9f5', 'border-radius': '12px', padding: '12px 14px' },
      '.facts span': { display: 'block', 'font-size': '10.5px', color: '#4f6a5c' },
      '.facts b': { 'font-size': '13.5px' },
      '.figs': { display: 'grid', 'grid-template-columns': 'repeat(4,1fr)', gap: '10px', 'margin-top': '12px' },
      '.figs div': { border: '1px solid #cfdfd5', 'border-radius': '12px', padding: '10px 12px' },
      '.figs span': { display: 'block', 'font-size': '10.5px', color: '#4f6a5c' },
      '.figs b': { display: 'block', 'font-family': 'Archivo,sans-serif', 'font-weight': '800', 'font-size': '19px', margin: '3px 0 2px' },
      '.figs em': { 'font-style': 'normal', 'font-size': '10.5px', color: '#4f6a5c' },
      '.two': { display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '0 26px' },
      'table': { width: '100%', 'border-collapse': 'collapse' },
      'td': { padding: '5px 0', 'border-bottom': '1px solid #e3ede7' },
      'th': { padding: '5px 4px', 'font-weight': '600', 'font-size': '11px', color: '#4f6a5c' },
      '.n': { 'text-align': 'right', 'font-variant-numeric': 'tabular-nums', 'white-space': 'nowrap' },
      '.d': { color: '#4f6a5c', width: '54px' },
      'tr.b td': { 'font-weight': '700' },
      'tr.net td': { color: '#1f7a4d', 'border-bottom': 'none', 'font-size': '14px' },
      '.sens td': { 'text-align': 'center', 'border-bottom': 'none', 'border-radius': '6px', 'font-variant-numeric': 'tabular-nums' },
      '.sens .ok': { background: '#dff3e6' },
      '.sens .mid': { background: '#fdf0d9' },
      '.sens .ko': { background: '#fbe3e0' },
      '.sens .cur': { 'font-weight': '700', outline: '1.5px solid #0a1410' },
      '.hyp': { columns: '2', 'column-gap': '26px' },
      '.hg': { 'break-inside': 'avoid', 'margin-bottom': '10px' },
      'h3': { 'font-size': '11px', 'font-weight': '700', color: '#1f7a4d', margin: '0 0 3px' },
      '.hr': { display: 'flex', 'justify-content': 'space-between', gap: '10px', 'font-size': '11.5px', padding: '2px 0' },
      '.hr span': { color: '#4f6a5c' },
      '.hr b': { 'font-weight': '600', 'white-space': 'nowrap' },
      '.nt': { 'font-size': '10.5px', color: '#4f6a5c', 'margin-top': '18px', 'border-top': '1px solid #cfdfd5', 'padding-top': '8px' },
      '.brk': { 'break-inside': 'avoid' }
    }) + '@media print{.bar{display:none}.pg{padding:0}}@page{margin:12mm}'
    const body = '<div class="pg">' +
      '<div class="hd"><img src="' + location.origin + LOGO + '" alt="Greenfield"><div>Bilan ' + def.short + '<br>' + today + (who ? '<br>Préparé par ' + esc(who) : '') + '</div></div>' +
      '<h1>' + esc(name) + '</h1><p class="sub">Bilan prévisionnel en ' + def.short + ', au prix de ' + dh(res.prix) + '.</p>' +
      '<div class="facts">' + facts.map(f => '<div><span>' + f[0] + '</span><b>' + esc(f[1]) + '</b></div>').join('') + '</div>' +
      '<div class="figs">' + figs.map(f => '<div><span>' + f[0] + '</span><b>' + f[1] + '</b><em>' + esc(f[2]) + '</em></div>').join('') + '</div>' +
      '<div class="two"><div class="brk"><h2>Coûts de l’opération</h2><table>' + costRows + '</table></div>' +
      '<div class="brk"><h2>Résultat</h2><table>' + sumRows + '</table></div></div>' +
      '<div class="brk"><h2>Rentabilité après impôt si les prix bougent</h2>' + sens + '</div>' +
      '<div class="brk"><h2>Hypothèses retenues</h2><div class="hyp">' + hyp + '</div></div>' +
      '<p class="nt">Estimation indicative établie par Greenfield à partir des hypothèses ci-dessus, à confirmer par une étude détaillée et la note de renseignements. ' +
      'Impôt estimé selon les barèmes 2026, bénéfice réparti sur ' + tx.duree + ' exercice' + (tx.duree > 1 ? 's' : '') + '. Document non contractuel.</p></div>'
    const doc = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Bilan ' + esc(def.short) + ', ' + esc(name) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@800..900&family=Inter+Tight:wght@400..700&display=swap" rel="stylesheet">' +
      '<style>' + css + '</style></head><body>' +
      '<div class="bar"><span>Bilan ' + esc(def.short) + ', ' + esc(name) + '</span><button onclick="window.print()">Imprimer ou enregistrer en PDF</button></div>' +
      body + '<scr' + 'ipt>window.addEventListener("load", () => setTimeout(() => window.print(), 600))</scr' + 'ipt></body></html>'
    const w = window.open('', '_blank')
    if (!w) {
      if (typeof showNotif === 'function') showNotif('Autorisez les fenêtres pour ce site afin d’ouvrir la fiche PDF.', true)
      return
    }
    w.document.open()
    w.document.write(doc)
    w.document.close()
  }

  /* ---------- API publique (appelée par index.html) ---------- */
  function onPaReady () {
    const el = root()
    if (!el) return
    if (!el.classList.contains('active')) return
    if (S.terrain && S.fresh) {
      const st = R.startVals(S.terrain)
      S.vals = st.v
      S.src = st.src
    }
    renderAll()
  }
  window.rdInit = function () {
    if (!R.PA.p) R.paLoad().then(onPaReady)
    const first = R.terrains()[0]
    if (!S.vals) {
      R.selectTerrain(first ? String(first.id) : R.REF_ID)
    } else if (!S.picked && S.terrainId === R.REF_ID && first) {
      R.selectTerrain(String(first.id))
    } else if (S.terrainId !== R.REF_ID && !S.terrain) {
      R.selectTerrain(S.terrainId)
    }
    renderAll()
  }
  window.rdFromTerrain = function (id) {
    R.paLoad().then(onPaReady)
    if (typeof closeModal === 'function') closeModal('modal-terrain-detail')
    const nav = document.querySelector('.sidebar .nav-item[onclick*="\'rendement\'"]')
    S.picked = true
    UI.savedAt = null
    R.selectTerrain(String(id))
    if (nav && typeof showPage === 'function') showPage('rendement', nav)
    else renderAll()
    window.scrollTo(0, 0)
  }
})()
