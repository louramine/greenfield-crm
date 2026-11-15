/* Assistant GREENFIELD : questions en langage courant sur les terrains, promoteurs et deals du CRM.
   Deux moteurs : une recherche locale (rien ne sort du CRM) et Claude, via la fonction Supabase "assistant",
   qui traduit la question en critères. Dans les deux cas, les résultats sont calculés ici, sur les données déjà chargées. */
void (function () {
  const CH = c => String.fromCharCode(c)
  const ALT = arr => '(?:' + arr.join(CH(124)) + ')'
  const RX = (src, fl) => new RegExp(src, fl ?? 'i')
  const RX_ACC = new RegExp('[' + CH(0x300) + '-' + CH(0x36f) + ']', 'g')
  const RX_NB = new RegExp('[' + CH(160) + CH(8239) + ']', 'g')
  const empty = v => v === undefined ? true : v === null ? true : v === '' ? true : (typeof v === 'number' && isNaN(v))
  const orv = (a, b) => empty(a) ? b : a
  const numv = v => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(RX_NB, '').replace(/\s/g, '').replace(',', '.'))
    return isNaN(n) ? null : n }
  const fmt = (n, d) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d ?? 0, maximumFractionDigits: d ?? 0 }).replace(RX_NB, ' ')
  const esc = s => { const d = document.createElement('div')
    d.textContent = String(s ?? '')
    return d.innerHTML }
  const norm = s => String(s ?? '').normalize('NFD').replace(RX_ACC, '').toLowerCase().replace(RX_NB, ' ')
    .replace(/²/g, '2').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[’'`"()]/g, ' ').replace(/[?!]/g, ' ')
    .replace(/([a-z])-(?=[a-z])/g, '$1 ').replace(/,(?!\d)/g, ' ').replace(/\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim()
  const st = () => typeof state === 'undefined' ? { terrains: [], acheteurs: [], deals: [] } : state
  const fn = name => { try { return typeof window[name] === 'function' ? window[name] : null } catch (e) { return null } }
  const call = (name, ...a) => { const f = fn(name)
    return f ? f(...a) : null }

  /* ---------- critères ---------- */
  const blankSpec = () => ({
    cible:'terrains', quartiers:[], horsQuartiers:[], zonages:[], familles:[], supMin:null, supMax:null, prixMin:null, prixMax:null,
    forfaitMin:null, forfaitMax:null, statuts:[], juridique:[], sourceurs:[], etapes:[], sansPrix:false, sansTF:false, sansCarte:false,
    joursMax:null, tri:'', ordre:'', limite:null, terrain:'', promoteur:'', texte:[], compte:false, message:'', reste:[]
  })
  const NUM = ALT(['\\d{1,3}(?: \\d{3})+(?:[.,]\\d+)?', '\\d+(?:[.,]\\d+)?'])
  const toNum = s => parseFloat(String(s).replace(/ /g, '').replace(',', '.'))
  const UNIT = ALT(['mdhs?', 'm dhs?', 'millions? de dhs?', 'millions? dhs?', 'millions?', 'dhs? ?/ ?m2', 'dhs? ' + ALT(['le', 'par', 'du', 'au']) + ' m2', 'dhs? le metre(?: carre)?', 'mad ?/ ?m2', 'dhs?', 'mad', 'hectares?', 'ha', 'm2', 'metres? carres?'])
  const CMP_MIN = ALT(['plus de', 'plus d', '\\+ ?de', '\\+ ?d', 'au dela de', 'superieur a', 'superieurs a', 'au moins', 'superieure?s? a', 'minimum', 'mini', 'min', 'a partir de', 'au dessus de', 'au-dessus de', 'depassant', '>=', '>'])
  const CMP_MAX = ALT(['moins de', 'au plus', 'au maximum', 'maximum', 'maxi', 'max', 'inferieure?s? a', 'sous les', 'sous', 'jusqu a', 'en dessous de', 'en-dessous de', 'pas plus de', 'ne depassant pas', '- ?de', '<=', '<'])
  const B0 = '(?<![a-z0-9])'
  const B1 = '(?![a-z0-9])'
  const unitOf = (u, v) => {
    if (RX('^(?:mdh' + CH(124) + 'm dh' + CH(124) + 'million)').test(u)) return { k:'forfait', v: v * 1e6 }
    if (RX('dh' + CH(124) + 'mad').test(u)) return RX('m2' + CH(124) + 'metre').test(u) ? { k:'prix', v } : (v >= 100000 ? { k:'forfait', v } : { k:'prix', v })
    if (RX('^h').test(u)) return { k:'sup', v: v * 10000 }
    return { k:'sup', v }
  }
  const KEY = { sup:['supMin', 'supMax'], prix:['prixMin', 'prixMax'], forfait:['forfaitMin', 'forfaitMax'] }
  const FAM_WORDS = [
    ['Villa', ['villas?']], ['Immeuble', ['immeubles?', 'collectifs?']],
    ['Industriel', ['industriel(?:le)?s?', 'logistiques?', 'entrepots?', 'usines?', 'zone d activites?', 'activites?']],
    ['Tourisme', ['touristiques?', 'tourisme', 'hoteliers?', 'hotelieres?', 'hotels?', 'balneaires?']],
    ['Rural', ['agricoles?', 'rural', 'rurale', 'ruraux', 'fermes?']]
  ]
  const ETAPES = { teaser:['teasers? envoyes?', 'teasers?'], nda:['nda'], visite:['visites?'], offre:['offres?'], closing:['closing', 'signature'] }
  const ETAPE_LABEL = { teaser:'Teaser', nda:'NDA', visite:'Visite', offre:'Offre', closing:'Closing' }
  const STOP = new Set(('le la les l un une des de du d a au aux en et ou pour avec sur dans qui que quoi quel quelle quels quelles est sont y il elle ils ont as ai avons ' +
    'moi me montre montrez montrer affiche affichez afficher donne donnez liste listez lister cherche cherchez chercher trouve trouvez trouver voir vois veux voudrais voudrait je j tu nous on vous ' +
    'terrain terrains foncier fonciers lot lots parcelle parcelles tous toutes tout toute plus moins zone zonage zonee zonees zones zones prix superficie superficies surface surfaces budget budgets ' +
    'situe situes situee situees proche proches pres cote quartier quartiers ville villes region secteur secteurs combien nombre svp stp merci bonjour salut bonsoir dh dhs m2 ha ' +
    'ce cet cette ces ses son sa leur leurs mon ma mes notre nos votre vos se si ne pas ni mais donc car par vers chez entre comme dont ou the of ' +
    'peux peut pouvez sais sait avoir etre fait faire aussi seulement uniquement juste encore bien tres actuellement aujourd hui maintenant existe existent ya a-t-il t ' +
    'crm greenfield base disponibles disponible dispo dispos vente vendre achat acheter interesses interesse interessant interessants compatibles compatible correspondant correspondent ' +
    'quels meilleurs meilleur meilleures top premiers premier dernier derniers recents recent nouveaux nouveau dessus dessous environ autour niveau taille titre rentres rentre ajoutes ajoute sources recus ci eux ceux').split(' '))

  const SRC_IGNORE = new Set(['moi', 'ras', 'a qualifier', 'inconnu', 'autre', 'nc', 'non renseigne'])
  /* clé phonétique : Ouled Salah = Oulad Saleh, Bouskora = Bouskoura */
  const phon = w => { const x = w.replace(/y/g, 'i').replace(/(.)\1+/g, '$1')
    return x[0] + x.slice(1).replace(/[aeiou]/g, '') }
  const phonKey = v => v.split(' ').map(phon).join(' ')
  const AIDE = 'Je lis uniquement les données du CRM. Posez une question de recherche, par exemple : terrains de plus de 2 ha à Oulad Saleh, terrains industriels sous 1 500 DH/m², terrains de Hachim sans prix, promoteurs compatibles avec GF-25-0123. Un sourceur n est filtré que si vous écrivez son nom.'
  function vocab () {
    const S = st()
    const q = new Set()
    const add = v => { const n = norm(v)
      if (n.length >= 4 && n.split(' ').length <= 3 && !STOP.has(n) && n !== 'non renseigne') q.add(n) }
    S.terrains.forEach(t => { add(t.quartier)
      add(call('prQuartier', t))
      add(call('prVille', t))
      add(t.localisation) })
    try { if (typeof VILLES_BASE !== 'undefined') VILLES_BASE.forEach(add) } catch (e) { /* liste absente */ }
    const uniq = arr => [...new Set(arr.map(x => String(x ?? '').trim()).filter(Boolean))]
    return {
      quartiers: [...q].sort((a, b) => b.length - a.length),
      statuts: uniq(S.terrains.map(t => t.statut).concat(S.acheteurs.map(a => a.statut))),
      sourceurs: uniq(S.terrains.map(t => t.sourceur)),
      zonages: uniq(S.terrains.map(t => String(t.urba ?? '').toUpperCase().split(/[\s/,]+/)[0])),
      promoteurs: uniq(S.acheteurs.map(a => a.nom))
    }
  }

  /* ---------- moteur local : la question devient une liste de critères ---------- */
  function parse (raw, prev) {
    const V = vocab()
    let q = ' ' + norm(raw) + ' '
    const sp = blankSpec()
    const eat = (rx, f) => { q = q.replace(rx, (...a) => { const r = f ? f(...a) : true
      return r === false ? a[0] : ' ' }) }
    if (RX('^ ' + ALT(['pourquoi', 'comment ca marche', 'comment tu', 'comment fonctionne', 'explique', 'c est quoi', 'qui es tu', 'aide', 'help']) + B1).test(q)) {
      sp.cible = 'aide'
      sp.message = AIDE
      return sp }
    const suite = prev && RX('^ ' + ALT(['et', 'parmi', 'seulement', 'uniquement', 'dont', 'puis', 'pareil', 'meme chose', 'idem']) + B1).test(q) ? true : (prev ? RX(ALT(['parmi eux', 'parmi ceux', 'ceux ci', 'ceux-ci', 'ces terrains', 'ces promoteurs'])).test(q) : false)

    /* fourchettes : entre 1 et 3 ha, de 2 000 à 5 000 m2 */
    eat(RX(B0 + ALT(['entre', 'de']) + '? ?(' + NUM + ') ?(' + UNIT + ')? ?' + ALT(['et', 'a', '-']) + ' ?(' + NUM + ') ?(' + UNIT + ')' + B1, 'gi'), (m, n1, u1, n2, u2) => {
      const b = unitOf(u2, toNum(n2))
      const a = unitOf(u1 ?? u2, toNum(n1))
      if (a.k !== b.k ? true : a.v >= b.v) return false
      sp[KEY[a.k][0]] = a.v
      sp[KEY[a.k][1]] = b.v
    })
    /* valeurs simples avec ou sans comparateur */
    eat(RX(B0 + '(' + CMP_MIN + ')? ?(' + CMP_MAX + ')? ?(?:de )?(' + NUM + ') ?(' + UNIT + ')' + B1, 'gi'), (m, cmin, cmax, n, u) => {
      const a = unitOf(u, toNum(n))
      if (cmin) sp[KEY[a.k][0]] = a.v
      else if (cmax) sp[KEY[a.k][1]] = a.v
      else if (a.k === 'forfait') sp.forfaitMax = a.v
      else if (a.k === 'sup') { sp.supMin = Math.round(a.v * 0.75)
        sp.supMax = Math.round(a.v * 1.3) }
      else { sp.prixMin = Math.round(a.v * 0.85)
        sp.prixMax = Math.round(a.v * 1.15) }
    })
    /* nombre sans unité, si la question parle de prix ou de superficie */
    const hint = RX(B0 + ALT(['prix', 'tarif']) + B1).test(q) ? 'prix' : RX(B0 + ALT(['superficie', 'surface', 'taille']) + B1).test(q) ? 'sup' : ''
    if (hint) eat(RX(B0 + '(' + CMP_MIN + ')? ?(' + CMP_MAX + ')? ?(?:de )?(' + NUM + ')(?! ?[a-z0-9+°])', 'gi'), (m, cmin, cmax, n) => {
      if (!cmin && !cmax) return false
      const v = toNum(n)
      const k = hint === 'prix' && v >= 100000 ? 'forfait' : hint
      sp[KEY[k][cmin ? 0 : 1]] = v
    })

    /* cible */
    if (RX(B0 + ALT(['promoteurs?', 'acheteurs?', 'clients?', 'investisseurs?']) + B1).test(q)) sp.cible = 'promoteurs'
    else if (RX(B0 + ALT(['deals?', 'pipeline', 'closing', 'nda', 'offres? recues?', 'en cours de negociation']) + B1).test(q)) sp.cible = 'deals'
    eat(RX(B0 + ALT(['promoteurs?', 'acheteurs?', 'clients?', 'investisseurs?', 'deals?', 'pipeline']) + B1, 'gi'))
    if (sp.cible === 'deals') Object.entries(ETAPES).forEach(([k, w]) => eat(RX(B0 + ALT(w) + B1, 'gi'), () => { sp.etapes.push(k) }))

    /* référence de terrain */
    eat(RX(B0 + 'gf ?-? ?(\\d{2}) ?-? ?(\\d{3,4})(?![0-9])', 'gi'), (m, a, b) => { sp.terrain = 'GF-' + a + '-' + b.padStart(4, '0') })
    eat(RX(B0 + ALT(['n°', 'n o', 'no', 'numero', 'ref', 'reference', 'terrain']) + ' ?(\\d{2,4})(?![0-9])', 'gi'), (m, n) => { if (sp.terrain) return false
      sp.terrain = n })

    /* zonage */
    const Z = ALT(['r\\+\\d+', '[a-e]\\d[a-z0-9]*', 'i\\d?', 'zi', 'za', 'ra', 'sd\\d?', 'bt\\d?', '[a-e]'])
    eat(RX(B0 + ALT(['zone', 'zonage', 'zonee?s?', 'zones', 'secteur', 'en']) + ' (' + Z + ')' + B1, 'gi'), (m, z) => { sp.zonages.push(z.toUpperCase()) })
    eat(RX(B0 + '(' + ALT(['r\\+\\d+', '[b-e]\\d[a-z]?', 'i\\d', 'zi']) + ')' + B1, 'gi'), (m, z) => { sp.zonages.push(z.toUpperCase()) })
    FAM_WORDS.forEach(([f, w]) => eat(RX(B0 + ALT(w) + B1, 'gi'), () => { if (!sp.familles.includes(f)) sp.familles.push(f) }))
    sp.zonages = sp.zonages.filter(z => { if (z === 'ZI' ? true : z === 'ZA') { if (!sp.familles.includes('Industriel')) sp.familles.push('Industriel')
      return false }
      return true })

    /* manques, statut juridique, ancienneté, tri, limite */
    eat(RX(B0 + 'sans ' + ALT(['prix', 'tarif']) + B1, 'gi'), () => { sp.sansPrix = true })
    eat(RX(B0 + 'sans ' + ALT(['tf', 'titre foncier', 'titre']) + B1, 'gi'), () => { sp.sansTF = true })
    eat(RX(B0 + ALT(['sans', 'pas sur', 'absents? de', 'hors']) + ' (?:la )?' + ALT(['lien maps', 'google maps', 'maps', 'localisation', 'carte atlas', 'carte', 'atlas', 'contour']) + B1, 'gi'), () => { sp.sansCarte = true })
    const JUR = [['titre', ['titres?', 'titree?s?']], ['melk', ['melk', 'melkia']], ['indivision', ['indivision', 'indivis', 'heritiers?']], ['requisition', ['requisitions?', 'immatriculation', 'en cours d immatriculation']], ['collectif', ['terres? collectives?', 'soulaliyates?']]]
    JUR.forEach(([k, w]) => { if (k === 'titre' && sp.sansTF) return
      eat(RX(B0 + ALT(w) + B1, 'gi'), () => { sp.juridique.push(k) }) })
    eat(RX(B0 + '(\\d{1,3}) derniers jours' + B1, 'gi'), (m, n) => { sp.joursMax = +n })
    eat(RX(B0 + ALT(['cette semaine', 'depuis une semaine', 'de la semaine']) + B1, 'gi'), () => { sp.joursMax = 7 })
    eat(RX(B0 + ALT(['ce mois ci', 'ce mois-ci', 'ce mois', 'du mois', 'depuis un mois']) + B1, 'gi'), () => { sp.joursMax = 30 })
    eat(RX(B0 + ALT(['aujourd hui', 'du jour']) + B1, 'gi'), () => { sp.joursMax = 1 })
    eat(RX(B0 + ALT(['les ', '']) + 'moins chers?' + B1, 'gi'), () => { sp.tri = 'prix'
      sp.ordre = 'asc' })
    eat(RX(B0 + ALT(['les ', '']) + 'plus chers?' + B1, 'gi'), () => { sp.tri = 'prix'
      sp.ordre = 'desc' })
    eat(RX(B0 + ALT(['les ', '']) + 'plus grande?s?' + B1, 'gi'), () => { sp.tri = 'superficie'
      sp.ordre = 'desc' })
    eat(RX(B0 + ALT(['les ', '']) + 'plus petite?s?' + B1, 'gi'), () => { sp.tri = 'superficie'
      sp.ordre = 'asc' })
    eat(RX(B0 + ALT(['recents?', 'recentes?', 'nouveaux', 'nouveautes', 'derniers? (?:terrains? )?' + ALT(['rentres?', 'ajoutes?', 'sources?', 'recus?'])]) + B1, 'gi'), () => { if (!sp.tri) { sp.tri = 'recent'
      sp.ordre = 'desc' } })
    eat(RX(B0 + ALT(['top', 'les', 'premiers?']) + ' (\\d{1,2})' + B1, 'gi'), (m, n) => { sp.limite = +n })
    eat(RX('^ (\\d{1,2}) (?=' + ALT(['terrains?', 'lots?', 'parcelles?', 'meilleurs?']) + ')', 'i'), (m, n) => { sp.limite = +n })
    if (RX(B0 + ALT(['combien', 'nombre de', 'total']) + B1).test(q)) sp.compte = true

    /* promoteur nommé, statuts, sourceurs */
    const whole = v => q.indexOf(' ' + v + ' ')
    V.promoteurs.map(n => [n, norm(n)]).filter(x => x[1].length >= 4).sort((a, b) => b[1].length - a[1].length).forEach(([nom, n]) => {
      if (sp.promoteur ? true : whole(n) < 0) return
      sp.promoteur = nom
      q = q.replace(' ' + n + ' ', '  ')
    })
    V.statuts.forEach(s => { const n = norm(s)
      if (n.length < 3) return
      eat(RX(B0 + n.replace(/[.*+?^${}()[\]\\]/g, '\\$&') + 's?' + B1, 'gi'), () => { if (!sp.statuts.includes(s)) sp.statuts.push(s) }) })
    eat(RX(B0 + 'dispos?' + B1, 'gi'), () => { const d = V.statuts.find(s => norm(s) === 'disponible')
      if (d && !sp.statuts.includes(d)) sp.statuts.push(d) })
    V.sourceurs.forEach(s => { const n = norm(s)
      if (n.length < 3 ? true : (STOP.has(n) ? true : (SRC_IGNORE.has(n) ? true : whole(n) < 0))) return
      sp.sourceurs.push(s)
      q = q.replace(' ' + n + ' ', '  ') })

    /* quartiers et villes, avec exclusion : hors Bouskoura, sauf Dar Bouazza */
    const HORS = RX(B0 + ALT(['hors', 'sauf', 'excepte', 'pas a', 'pas au', 'pas en', 'en dehors de', 'autre que']) + ' (?:' + ALT(['de', 'du', 'd', 'a', 'au', 'le', 'la', 'les']) + ' )*$', 'i')
    const proche = v => {
      if (v.replace(/ /g, '').length < 6) return -1
      const k = phonKey(v)
      const n = v.split(' ').length
      const W = q.trim().split(' ')
      for (let j = 0; j + n <= W.length; j++) {
        const seg = W.slice(j, j + n).join(' ')
        if (seg.replace(/ /g, '').length >= 5 && phonKey(seg) === k) {
          const i = whole(seg)
          if (i >= 0) { q = q.slice(0, i + 1) + v + q.slice(i + 1 + seg.length)
            return i }
        }
      }
      return -1
    }
    V.quartiers.forEach(v => {
      let i = whole(v)
      if (i < 0) i = proche(v)
      if (i < 0) return
      const before = q.slice(0, i + 1)
      const m = before.match(HORS)
      if (m) { sp.horsQuartiers.push(v)
        q = before.slice(0, m.index) + ' ' + q.slice(i + v.length + 1) }
      else { sp.quartiers.push(v)
        q = before + ' ' + q.slice(i + v.length + 1) }
    })

    sp.reste = [...new Set(q.split(' ').map(w => w.replace(/^[-<>=/+°]+/, '').replace(/[-<>=/+°]+$/, '')).filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)))]
    return suite ? merge(prev, sp) : sp
  }
  function merge (prev, sp) {
    const out = Object.assign(blankSpec(), JSON.parse(JSON.stringify(prev)))
    Object.keys(sp).forEach(k => {
      const v = sp[k]
      if (k === 'cible') { if (v !== 'terrains') out.cible = v
        return }
      if (Array.isArray(v) ? v.length > 0 : (v === false ? false : !empty(v))) out[k] = v
    })
    out.reste = sp.reste
    out.message = ''
    return out
  }
  /* critères reçus de Claude : on ne garde que les champs connus, au bon type */
  function sanitize (o) {
    const sp = blankSpec()
    const src = o && typeof o === 'object' ? o : {}
    Object.keys(sp).forEach(k => {
      const v = src[k]
      if (empty(v)) return
      if (Array.isArray(sp[k])) sp[k] = (Array.isArray(v) ? v : [v]).map(x => String(x).trim()).filter(Boolean).slice(0, 12)
      else if (typeof sp[k] === 'boolean') sp[k] = v === true
      else if (sp[k] === null) sp[k] = numv(v)
      else sp[k] = String(v).slice(0, 400)
    })
    if (!['terrains', 'promoteurs', 'deals', 'aide'].includes(sp.cible)) sp.cible = 'terrains'
    sp.quartiers = sp.quartiers.map(norm)
    sp.horsQuartiers = sp.horsQuartiers.map(norm)
    sp.zonages = sp.zonages.map(z => z.toUpperCase().replace(/\s/g, ''))
    sp.texte = sp.texte.map(norm)
    sp.reste = []
    return sp
  }

  /* ---------- exécution sur les données du CRM ---------- */
  const famOf = t => orv(call('mvFam', t.urba), call('mvFamUsage', t.usage))
  const coordsOk = t => RX('^https?:').test(String(t.googleMap ?? ''))
  const forfaitOf = t => { const f = numv(t.forfait)
    const s = numv(t.superficie)
    const p = numv(t.prix)
    return f && f > 0 ? (f < 100000 ? f * 1e6 : f) : (s && p ? s * p : null) }
  const joursOf = t => { const d = t.dateSourcing ? new Date(t.dateSourcing) : null
    return d && !isNaN(d) ? Math.floor((Date.now() - d.getTime()) / 864e5) : null }
  const median = a => { const s = a.slice().sort((x, y) => x - y)
    return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null }
  const lieu = t => norm([t.quartier, t.localisation, call('prVille', t)].filter(Boolean).join(' '))
  function findTerrain (ref) {
    const T = st().terrains
    const r = String(ref).toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!r) return null
    const exact = T.find(t => String(t.ref ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') === r)
    if (exact) return exact
    if (!/^\d+$/.test(r)) return null
    return T.find(t => +(String(t.ref ?? '').match(/(\d+)$/) ?? [])[1] === +r) ?? T.find(t => String(t.id) === String(+r)) ?? null
  }
  const findPromoteur = nom => { const n = norm(nom)
    const A = st().acheteurs
    return n ? (A.find(a => norm(a.nom) === n) ?? A.find(a => norm(a.nom).includes(n)) ?? null) : null }

  function filtreTerrains (sp, notes) {
    let L = st().terrains.slice()
    if (sp.statuts.length) L = L.filter(t => sp.statuts.some(s => norm(s) === norm(t.statut)))
    else { L = L.filter(t => t.statut !== 'Vendu')
      notes.push('hors vendus') }
    if (sp.quartiers.length) L = L.filter(t => { const b = ' ' + lieu(t) + ' '
      return sp.quartiers.some(v => b.includes(v)) })
    if (sp.horsQuartiers.length) L = L.filter(t => { const b = lieu(t)
      return !sp.horsQuartiers.some(v => b.includes(v)) })
    if (sp.zonages.length) L = L.filter(t => { const parts = String(t.urba ?? '').toUpperCase().split(/[\s/,]+/).filter(Boolean)
      return sp.zonages.some(z => parts.some(p => p.replace(/^FB(?=\d)/, '').startsWith(z))) })
    if (sp.familles.length) L = L.filter(t => sp.familles.includes(famOf(t)))
    const rng = (get, lo, hi) => { if (empty(lo) && empty(hi)) return
      L = L.filter(t => { const v = get(t)
        return !empty(v) && v > 0 && (empty(lo) ? true : v >= lo) && (empty(hi) ? true : v <= hi) }) }
    rng(t => numv(t.superficie), sp.supMin, sp.supMax)
    rng(t => numv(t.prix), sp.prixMin, sp.prixMax)
    rng(forfaitOf, sp.forfaitMin, sp.forfaitMax)
    if (sp.sansPrix) L = L.filter(t => !(numv(t.prix) > 0) && !(numv(t.forfait) > 0))
    if (sp.sansTF) L = L.filter(t => !String(t.tf ?? '').trim())
    if (sp.sansCarte) L = L.filter(t => !coordsOk(t))
    if (sp.juridique.length) { const J = { titre:'titr', melk:'melk', indivision:'indivis', requisition:'immatricul', collectif:'collecti' }
      L = L.filter(t => { const j = norm(t.statut_juridique)
        return sp.juridique.some(k => j.includes(J[k] ?? k) ? true : (k === 'requisition' && j.includes('requisition'))) }) }
    if (sp.sourceurs.length) L = L.filter(t => sp.sourceurs.some(s => norm(s) === norm(t.sourceur)))
    if (!empty(sp.joursMax)) L = L.filter(t => { const j = joursOf(t)
      return j != null && j <= sp.joursMax })
    if (sp.texte.length) L = L.filter(t => { const b = norm([t.ref, t.quartier, t.localisation, t.notes, t.commentaire, t.mymaps, t.tf, t.usage, t.urba, t.sourceur].join(' '))
      return sp.texte.every(w => b.includes(w)) })
    const key = { prix: t => numv(t.prix), superficie: t => numv(t.superficie), forfait: forfaitOf, recent: t => { const j = joursOf(t)
      return j == null ? null : -j } }[sp.tri]
    if (key) { const dir = sp.ordre === 'desc' ? -1 : 1
      L = L.filter(t => { const v = key(t)
        return !empty(v) && (sp.tri === 'recent' ? true : v > 0) }).sort((a, b) => (key(a) - key(b)) * dir) }
    return L
  }
  function chips (sp) {
    const c = []
    const r = (lab, lo, hi, u, f) => { const F = f ?? (v => fmt(v))
      if (!empty(lo) && !empty(hi)) c.push(`${lab} ${F(lo)} à ${F(hi)} ${u}`)
      else if (!empty(lo)) c.push(`${lab} ≥ ${F(lo)} ${u}`)
      else if (!empty(hi)) c.push(`${lab} ≤ ${F(hi)} ${u}`) }
    if (sp.terrain) c.push('terrain ' + sp.terrain)
    if (sp.promoteur) c.push('promoteur ' + sp.promoteur)
    sp.quartiers.forEach(v => c.push(v))
    sp.horsQuartiers.forEach(v => c.push('hors ' + v))
    sp.zonages.forEach(z => c.push('zone ' + z))
    sp.familles.forEach(f => c.push(f.toLowerCase()))
    r('superficie', sp.supMin, sp.supMax, 'm²')
    r('prix', sp.prixMin, sp.prixMax, 'DH/m²')
    r('montant', sp.forfaitMin, sp.forfaitMax, 'MDH', v => fmt(v / 1e6, v % 1e6 ? 1 : 0))
    sp.statuts.forEach(s => c.push(s))
    sp.juridique.forEach(s => c.push(s))
    sp.sourceurs.forEach(s => c.push('sourceur ' + s))
    sp.etapes.forEach(s => c.push('étape ' + ETAPE_LABEL[s]))
    if (sp.sansPrix) c.push('sans prix')
    if (sp.sansTF) c.push('sans TF')
    if (sp.sansCarte) c.push('sans lien carte')
    if (!empty(sp.joursMax)) c.push(`${sp.joursMax} derniers jours`)
    sp.texte.forEach(w => c.push('« ' + w + ' »'))
    if (sp.tri) c.push('tri ' + ({ prix:'prix', superficie:'superficie', forfait:'montant', recent:'date' }[sp.tri] ?? sp.tri) + (sp.ordre === 'desc' ? ' décroissant' : ' croissant'))
    return c
  }
  function run (sp) {
    const S = st()
    const out = { spec: sp, chips: chips(sp), kind:'terrains', items: [], head:'', stats:'', notes: [], suggest: [] }
    if (sp.cible === 'aide' ? true : (sp.message && !out.chips.length)) { out.kind = 'texte'
      out.head = orv(sp.message, 'Posez une question sur les terrains, les promoteurs ou les deals.')
      return out }
    const T = sp.terrain ? findTerrain(sp.terrain) : null
    const P = sp.promoteur ? findPromoteur(sp.promoteur) : null
    if (sp.terrain && !T) { out.kind = 'texte'
      out.head = `Je ne trouve pas le terrain ${sp.terrain} dans le CRM.`
      return out }

    /* promoteurs compatibles avec un terrain */
    if (T && sp.cible === 'promoteurs') {
      const sc = fn('prScore')
      out.kind = 'match-p'
      out.items = S.acheteurs.map(a => ({ a, r: sc ? sc(a, T) : { score: 0, ok: [], ko: [] } })).filter(x => x.r.score >= 40).sort((x, y) => y.r.score - x.r.score)
      out.head = out.items.length ? `${out.items.length} promoteur${out.items.length > 1 ? 's' : ''} compatible${out.items.length > 1 ? 's' : ''} avec ${T.ref ? T.ref : 'ce terrain'} (${orv(T.quartier, T.localisation)}), score de 40 et plus.` : `Aucun promoteur n’atteint un score de 40 pour ${T.ref ? T.ref : 'ce terrain'}.`
      out.terrain = T
      return out
    }
    if (T && !P) { out.items = [T]
      out.head = 'Voici le terrain demandé.'
      out.suggest = [`Promoteurs pour ${T.ref ? T.ref : 'terrain ' + T.id}`]
      return out }

    /* terrains à proposer à un promoteur */
    if (P && sp.cible !== 'deals' && (sp.cible === 'terrains' ? true : out.chips.length > 1)) {
      const sc = fn('prScore')
      const notes = []
      const base = filtreTerrains(Object.assign({}, sp, { tri:'' }), notes)
      out.kind = 'match-t'
      out.items = base.map(t => ({ t, r: sc ? sc(P, t) : { score: 0, ok: [], ko: [] } })).filter(x => x.r.score >= 40).sort((x, y) => y.r.score - x.r.score)
      out.head = out.items.length ? `${out.items.length} terrain${out.items.length > 1 ? 's' : ''} à proposer à ${P.nom}, score de 40 et plus.` : `Aucun terrain n’atteint un score de 40 pour ${P.nom}.`
      out.promoteur = P
      return out
    }
    if (P && sp.cible === 'promoteurs') { out.kind = 'promoteurs'
      out.items = [P]
      out.head = 'Voici la fiche du promoteur.'
      out.suggest = [`Terrains pour ${P.nom}`]
      return out }

    if (sp.cible === 'promoteurs') {
      out.kind = 'promoteurs'
      let L = S.acheteurs.slice()
      const blob = a => norm([a.nom, a.type, a.statut, a.zones, (a.villes ?? []).join(' '), [].concat(a.quartiers ?? []).join(' '), [].concat(a.typologies ?? []).join(' '), a.usage, a.notes, a.contact].join(' '))
      if (sp.statuts.length) L = L.filter(a => sp.statuts.some(s => norm(s) === norm(a.statut)))
      if (sp.quartiers.length) L = L.filter(a => sp.quartiers.some(v => blob(a).includes(v)))
      if (sp.familles.length) L = L.filter(a => sp.familles.some(f => blob(a).includes(norm(f === 'Industriel' ? 'industri' : f === 'Tourisme' ? 'touris' : f))))
      if (!empty(sp.forfaitMin)) L = L.filter(a => (numv(orv(a.ticketMax, a.ticketMin)) ?? 0) * 1e6 >= sp.forfaitMin)
      if (!empty(sp.forfaitMax)) L = L.filter(a => (numv(a.ticketMin) ?? 0) * 1e6 <= sp.forfaitMax && (numv(a.ticketMin) ? true : !!numv(a.ticketMax)))
      if (sp.texte.length) L = L.filter(a => sp.texte.every(w => blob(a).includes(w)))
      out.items = L
      out.head = `${L.length} promoteur${L.length > 1 ? 's' : ''}${out.chips.length ? ' pour ces critères' : ' dans le CRM'}.`
      return out
    }
    if (sp.cible === 'deals') {
      out.kind = 'deals'
      let L = S.deals.slice()
      if (sp.etapes.length) L = L.filter(d => sp.etapes.includes(d.etape))
      if (P) L = L.filter(d => String(d.acheteurId) === String(P.id))
      if (T) L = L.filter(d => String(d.terrainId) === String(T.id))
      if (sp.quartiers.length) L = L.filter(d => sp.quartiers.some(v => norm(d.terrainLabel).includes(v)))
      if (!empty(sp.forfaitMin)) L = L.filter(d => (numv(d.montant) ?? 0) >= sp.forfaitMin)
      if (!empty(sp.forfaitMax)) L = L.filter(d => (numv(d.montant) ?? 0) <= sp.forfaitMax)
      if (sp.texte.length) L = L.filter(d => sp.texte.every(w => norm([d.terrainLabel, d.acheteurLabel, d.notes, d.associe].join(' ')).includes(w)))
      out.items = L
      const tot = L.reduce((a, d) => a + (numv(d.montant) ?? 0), 0)
      out.head = `${L.length} deal${L.length > 1 ? 's' : ''}${out.chips.length ? ' pour ces critères' : ' en cours'}.`
      out.stats = tot ? `Montant cumulé : ${fmt(tot / 1e6, 1)} MDH` : ''
      return out
    }

    const L = filtreTerrains(sp, out.notes)
    out.items = L
    const sups = L.map(t => numv(t.superficie)).filter(v => v > 0)
    const prix = L.map(t => numv(t.prix)).filter(v => v > 0)
    const val = L.reduce((a, t) => a + (forfaitOf(t) ?? 0), 0)
    out.head = L.length ? `${fmt(L.length)} terrain${L.length > 1 ? 's' : ''}${out.chips.length ? ' pour ces critères' : ' dans le CRM'}.` : 'Aucun terrain ne correspond à ces critères.'
    out.stats = L.length ? [sups.length ? `${fmt(sups.reduce((a, b) => a + b, 0) / 10000, 1)} ha au total` : '', prix.length ? `prix médian ${fmt(median(prix))} DH/m² (${prix.length} avec prix)` : '', val ? `valeur demandée ${fmt(val / 1e6, 0)} MDH` : ''].filter(Boolean).join(', ') : ''
    return out
  }

  /* ---------- Claude, via la fonction Supabase ---------- */
  let claude = 'inconnu'
  let absentDepuis = 0
  async function askClaude (question, prev) {
    if (claude === 'absent' && Date.now() - absentDepuis < 120000) return null
    let headers = null
    let url = ''
    try { headers = Object.assign({}, SUPA_HEADERS)
      url = SUPA_URL + '/functions/v1/assistant' } catch (e) { return null }
    const V = vocab()
    const ctl = new AbortController()
    const to = setTimeout(() => ctl.abort(), 15000)
    try {
      const r = await fetch(url, { method:'POST', headers, signal: ctl.signal, body: JSON.stringify({
        question: String(question).slice(0, 400), precedent: prev ? Object.assign({}, prev, { reste: undefined }) : null,
        vocabulaire: { quartiers: V.quartiers.slice(0, 400), zonages: V.zonages.slice(0, 80), statuts: V.statuts, sourceurs: V.sourceurs.slice(0, 60) } }) })
      if (r.status === 503 ? true : r.status === 404) { claude = 'absent'
        absentDepuis = Date.now()
        return null }
      if (!r.ok) return null
      const j = await r.json()
      claude = 'actif'
      return j && j.spec ? sanitize(j.spec) : null
    } catch (e) { return null } finally { clearTimeout(to) }
  }

  /* ---------- interface ---------- */
  const CSS = `
#ga-btn{position:fixed;right:22px;bottom:22px;z-index:85;width:54px;height:54px;border-radius:999px;border:1px solid rgba(126,224,164,.45);background:#122a1f;color:#7ee0a4;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}
#ga-btn:hover{background:#17382a}
#ga-btn svg{width:24px;height:24px}
#ga-panel{position:fixed;right:22px;bottom:22px;z-index:890;width:min(430px,calc(100vw - 24px));height:min(680px,calc(100vh - 44px));background:#0f2219;color:#e8f2ea;border:1px solid rgba(126,224,164,.28);border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.6);display:none;flex-direction:column;overflow:hidden;font-family:'Inter Tight', Inter, Arial, sans-serif;font-size:14px}
#ga-panel.open{display:flex}
#ga-panel *{box-sizing:border-box}
#ga-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(126,224,164,.16)}
#ga-head b{font-family:Archivo, Arial, sans-serif;font-weight:800;font-size:15px;flex:1}
#ga-head small{font-family:'JetBrains Mono', monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#9cb3a3}
#ga-head button{border:0;background:transparent;color:#9cb3a3;cursor:pointer;font-size:13px;padding:6px 8px;border-radius:8px}
#ga-head button:hover{background:rgba(126,224,164,.1);color:#e8f2ea}
#ga-log{flex:1;overflow-y:auto;padding:14px 14px 6px;display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain}
.ga-q{align-self:flex-end;max-width:86%;background:#7ee0a4;color:#0a1410;border-radius:14px 14px 4px 14px;padding:8px 12px;font-weight:500;overflow-wrap:anywhere}
.ga-a{align-self:stretch;background:#16302397;border:1px solid rgba(126,224,164,.14);border-radius:14px 14px 14px 4px;padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0}
.ga-a p{margin:0;line-height:1.45}
.ga-a .sub{color:#9cb3a3;font-size:12.5px}
.ga-chips{display:flex;flex-wrap:wrap;gap:5px}
.ga-chip{font-size:11.5px;border-radius:999px;padding:2px 9px;background:rgba(126,224,164,.12);color:#b9e9cb;white-space:nowrap}
.ga-row{display:flex;gap:10px;align-items:center;width:100%;text-align:left;border:0;border-top:1px solid rgba(126,224,164,.12);background:transparent;color:inherit;padding:9px 2px;cursor:pointer;font:inherit}
.ga-row:hover{background:rgba(126,224,164,.07)}
.ga-row .m{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.ga-row .l1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ga-row .l1 b{font-weight:600;margin-right:6px}
.ga-row .l2{font-size:12px;color:#9cb3a3;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ga-row .z{font-family:'JetBrains Mono', monospace;font-size:11px;border:1px solid rgba(126,224,164,.3);border-radius:6px;padding:2px 6px;color:#7ee0a4;flex:none}
.ga-row .sc{font-family:Archivo, Arial, sans-serif;font-weight:800;font-size:15px;color:#7ee0a4;flex:none;width:34px;text-align:right}
.ga-acts{display:flex;flex-wrap:wrap;gap:6px;padding-top:4px}
.ga-acts button,.ga-sugg button{border:1px solid rgba(126,224,164,.3);background:transparent;color:#b9e9cb;border-radius:999px;padding:5px 11px;font:inherit;font-size:12.5px;cursor:pointer}
.ga-acts button:hover,.ga-sugg button:hover{background:rgba(126,224,164,.12)}
.ga-sugg{display:flex;flex-direction:column;align-items:flex-start;gap:6px}
#ga-form{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(126,224,164,.16)}
#ga-in{flex:1;min-width:0;border:1px solid rgba(126,224,164,.25);background:#0a1410;color:#e8f2ea;border-radius:12px;padding:10px 12px;font:inherit;font-size:16px}
#ga-in:focus-visible,#ga-btn:focus-visible,#ga-form button:focus-visible,.ga-row:focus-visible{outline:2px solid #7ee0a4;outline-offset:2px}
#ga-form button{border:0;background:#7ee0a4;color:#0a1410;border-radius:12px;padding:0 16px;font:inherit;font-weight:600;cursor:pointer}
#ga-form button:disabled{opacity:.5;cursor:default}
@media(max-width:768px){#ga-btn{display:none !important}#ga-panel{right:0;bottom:0;width:100vw;height:100dvh;border-radius:0;border:0}}
@media print{#ga-btn,#ga-panel{display:none !important}}
`
  let panel = null
  let last = null
  let busy = false
  const M = v => fmt(v / 1e6, v >= 1e7 ? 0 : 1)
  const rowT = (t, r) => { const s = numv(t.superficie)
    const p = numv(t.prix)
    const f = forfaitOf(t)
    const l2 = [s ? fmt(s) + ' m²' : '', p ? fmt(p) + ' DH/m²' : 'prix nc', f ? M(f) + ' MDH' : '', t.statut && t.statut !== 'Disponible' ? t.statut : ''].filter(Boolean).join(' · ')
    return `<button type="button" class="ga-row" data-t="${esc(t.id)}"><span class="m"><span class="l1"><b>${esc(t.ref ? t.ref : 'N° ' + t.id)}</b>${esc(orv(t.quartier, t.localisation) ?? '')}</span><span class="l2">${esc(r && r.ok.length ? r.ok.slice(0, 3).join(', ') : l2)}</span></span>${t.urba ? `<span class="z">${esc(String(t.urba).split(/[\s/,]+/)[0])}</span>` : ''}${r ? `<span class="sc">${r.score}</span>` : ''}</button>` }
  const rowP = (a, r) => { const lo = numv(a.ticketMin)
    const hi = numv(a.ticketMax)
    const tk = lo && hi ? `${fmt(lo)} à ${fmt(hi)} MDH` : hi ? `jusqu’à ${fmt(hi)} MDH` : lo ? `dès ${fmt(lo)} MDH` : ''
    const zones = (Array.isArray(a.villes) && a.villes.length ? a.villes.join(', ') : String(a.zones ?? ''))
    const l2 = r ? r.ok.slice(0, 3).join(', ') : [a.type, a.statut, zones, tk].filter(Boolean).join(' · ')
    return `<button type="button" class="ga-row" data-p="${esc(a.id)}"><span class="m"><span class="l1"><b>${esc(a.nom)}</b></span><span class="l2">${esc(l2)}</span></span>${r ? `<span class="sc">${r.score}</span>` : ''}</button>` }
  const rowD = d => `<button type="button" class="ga-row" data-d="${esc(d.id)}"><span class="m"><span class="l1"><b>${esc(orv(d.acheteurLabel, 'Promoteur nc'))}</b>${esc(orv(d.terrainLabel, ''))}</span><span class="l2">${esc([ETAPE_LABEL[d.etape] ?? d.etape, numv(d.montant) ? M(numv(d.montant)) + ' MDH' : '', d.associe].filter(Boolean).join(' · '))}</span></span></button>`
  const rows = (res, from, n) => res.items.slice(from, from + n).map(x => res.kind === 'terrains' ? rowT(x) : res.kind === 'match-t' ? rowT(x.t, x.r) : res.kind === 'promoteurs' ? rowP(x) : res.kind === 'match-p' ? rowP(x.a, x.r) : rowD(x)).join('')
  function textOf (res) {
    const line = x => { if (res.kind === 'terrains' ? true : res.kind === 'match-t') { const t = res.kind === 'terrains' ? x : x.t
      return [t.ref ? t.ref : 'N° ' + t.id, orv(t.quartier, t.localisation), numv(t.superficie) ? fmt(numv(t.superficie)) + ' m²' : '', numv(t.prix) ? fmt(numv(t.prix)) + ' DH/m²' : '', t.urba].filter(Boolean).join(', ') }
      if (res.kind === 'deals') return [x.acheteurLabel, x.terrainLabel, ETAPE_LABEL[x.etape] ?? x.etape].filter(Boolean).join(', ')
      const a = res.kind === 'promoteurs' ? x : x.a
      return [a.nom, a.type, a.statut].filter(Boolean).join(', ') }
    return [res.head, res.stats].filter(Boolean).concat(res.items.slice(0, 60).map(x => '- ' + line(x))).join('\n')
  }
  function show (res, moteur) {
    const el = document.createElement('div')
    el.className = 'ga-a'
    const lim = res.spec && res.spec.limite ? res.spec.limite : 8
    const head = `<p>${esc(res.head)}</p>` + (res.stats ? `<p class="sub">${esc(res.stats)}</p>` : '')
    const ch = res.chips.length ? `<div class="ga-chips">${res.chips.map(c => `<span class="ga-chip">${esc(c)}</span>`).join('')}</div>` : ''
    const ign = res.spec && res.spec.reste && res.spec.reste.length ? `<p class="sub">Mots non compris : ${esc(res.spec.reste.join(', '))}.</p>` : ''
    const more = res.items.length > lim ? `<button type="button" data-more="${lim}">Afficher la suite (${res.items.length - lim})</button>` : ''
    const acts = res.items.length ? `<div class="ga-acts">${more}<button type="button" data-copy>Copier la liste</button>${res.suggest.map(s => `<button type="button" data-ask="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : (res.suggest.length ? `<div class="ga-acts">${res.suggest.map(s => `<button type="button" data-ask="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : '')
    el.innerHTML = head + ch + ign + `<div class="ga-list">${rows(res, 0, lim)}</div>` + acts + `<p class="sub" style="font-size:11px">${moteur === 'claude' ? 'Question comprise par Claude, résultats calculés dans le CRM' : 'Recherche locale'}${res.notes.length ? ', ' + esc(res.notes.join(', ')) : ''}</p>`
    el.res = res
    return el
  }
  function push (node) { const log = panel.querySelector('#ga-log')
    log.appendChild(node)
    node.scrollIntoView({ block:'start', behavior:'smooth' }) }
  function welcome () {
    const V = vocab()
    const count = {}
    st().terrains.forEach(t => { const k = String(orv(t.quartier, '')).trim()
      if (k) count[k] = (count[k] ?? 0) + 1 })
    const topQ = Object.keys(count).sort((a, b) => count[b] - count[a])[0] ?? 'Bouskoura'
    const ex = [`Terrains de plus de 2 ha à ${topQ}`, 'Terrains industriels sous 1 500 DH/m²', 'Les 5 terrains les moins chers en zone E', 'Terrains sans prix rentrés ce mois', V.promoteurs[0] ? `Terrains pour ${V.promoteurs[0]}` : 'Combien de promoteurs']
    const el = document.createElement('div')
    el.className = 'ga-a'
    el.innerHTML = `<p>Posez une question sur les terrains, les promoteurs ou les deals. Je cherche dans les données du CRM auxquelles vous avez accès, sans rien modifier.</p><div class="ga-sugg">${ex.map(s => `<button type="button" data-ask="${esc(s)}">${esc(s)}</button>`).join('')}</div>`
    return el
  }
  async function ask (question) {
    const q = String(question ?? '').trim()
    if (!q ? true : busy) return
    busy = true
    const send = panel.querySelector('#ga-form button')
    send.disabled = true
    const qn = document.createElement('div')
    qn.className = 'ga-q'
    qn.textContent = q
    push(qn)
    let moteur = 'local'
    let sp = parse(q, last)
    try {
      if (sp.reste.length) {
        const wait = document.createElement('div')
        wait.className = 'ga-a'
        wait.innerHTML = '<p class="sub">Analyse de la question...</p>'
        if (claude !== 'absent') push(wait)
        const cs = await askClaude(q, last)
        wait.remove()
        if (cs) { sp = cs
          moteur = 'claude' }
        else {
          /* sans Claude : les mots non reconnus servent de recherche plein texte, abandonnée si elle ne donne rien */
          const essai = Object.assign({}, sp, { texte: sp.reste.slice(0, 4), reste: [] })
          const r = run(essai)
          if (r.items.length) sp = essai
        }
      }
      const res = run(sp)
      if (res.kind !== 'texte') last = sp
      push(show(res, moteur))
    } catch (e) {
      const er = document.createElement('div')
      er.className = 'ga-a'
      er.innerHTML = '<p>La recherche a échoué. Rechargez la page puis réessayez.</p>'
      push(er)
    } finally { busy = false
      send.disabled = false }
  }
  function onClick (e) {
    const b = e.target.closest('button')
    if (!b) return
    const box = b.closest('.ga-a')
    if (b.dataset.ask) { ask(b.dataset.ask)
      return }
    if (b.dataset.more) { const from = +b.dataset.more
      box.querySelector('.ga-list').insertAdjacentHTML('beforeend', rows(box.res, from, 20))
      if (box.res.items.length > from + 20) { b.dataset.more = from + 20
        b.textContent = `Afficher la suite (${box.res.items.length - from - 20})` }
      else b.remove()
      return }
    if ('copy' in b.dataset) { const txt = textOf(box.res)
      const done = () => { b.textContent = 'Liste copiée' }
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done).catch(() => { b.textContent = 'Copie impossible' })
      return }
    const small = window.matchMedia('(max-width:768px)').matches
    const idOf = v => isNaN(+v) ? v : +v
    if (b.dataset.t) { if (small) toggle(false)
      call('openTerrainDetail', idOf(b.dataset.t)) }
    else if (b.dataset.p) { if (small) toggle(false)
      call('prOpen', idOf(b.dataset.p)) }
    else if (b.dataset.d) { if (small) toggle(false)
      call('openDealEdit', idOf(b.dataset.d)) }
  }
  function toggle (open) {
    const on = open ?? !panel.classList.contains('open')
    panel.classList.toggle('open', on)
    document.getElementById('ga-btn').style.display = on ? 'none' : ''
    if (on) { if (!panel.querySelector('#ga-log').children.length) push(welcome())
      if (!window.matchMedia('(max-width:768px)').matches) panel.querySelector('#ga-in').focus() }
  }
  function mount () {
    if (document.getElementById('ga-btn')) return
    const s = document.createElement('style')
    s.id = 'ga-css'
    s.textContent = CSS
    document.head.appendChild(s)
    const btn = document.createElement('button')
    btn.id = 'ga-btn'
    btn.type = 'button'
    btn.title = 'Assistant GREENFIELD'
    btn.setAttribute('aria-label', 'Ouvrir l’assistant')
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M10 3.5c.6 3.7 2.8 5.9 6.5 6.5-3.7.6-5.9 2.8-6.5 6.5-.6-3.7-2.8-5.9-6.5-6.5 3.7-.6 5.9-2.8 6.5-6.5z"/><path d="M18 14.5c.3 1.7 1.3 2.7 3 3-1.7.3-2.7 1.3-3 3-.3-1.7-1.3-2.7-3-3 1.7-.3 2.7-1.3 3-3z"/></svg>'
    document.body.appendChild(btn)
    panel = document.createElement('section')
    panel.id = 'ga-panel'
    panel.setAttribute('aria-label', 'Assistant GREENFIELD')
    panel.innerHTML = '<div id="ga-head"><b>Assistant</b><small>lecture seule</small><button type="button" id="ga-reset">Effacer</button><button type="button" id="ga-close" aria-label="Fermer">Fermer</button></div><div id="ga-log" aria-live="polite"></div><form id="ga-form"><input id="ga-in" type="text" autocomplete="off" placeholder="Terrains de plus de 2 ha à Bouskoura..." aria-label="Votre question"><button type="submit">Envoyer</button></form>'
    document.body.appendChild(panel)
    btn.addEventListener('click', () => toggle(true))
    const ICO = btn.innerHTML
    const addTop = n => {
      const top = document.querySelector('.m-top')
      if (!top) { if (n < 40) setTimeout(() => addTop(n + 1), 250)
        return }
      if (top.querySelector('.ga-top')) return
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'ga-top'
      b.setAttribute('aria-label', 'Ouvrir l’assistant')
      b.innerHTML = ICO
      b.addEventListener('click', () => toggle(true))
      top.insertBefore(b, top.firstChild)
    }
    addTop(0)
    panel.querySelector('#ga-close').addEventListener('click', () => toggle(false))
    panel.querySelector('#ga-reset').addEventListener('click', () => { last = null
      panel.querySelector('#ga-log').innerHTML = ''
      push(welcome()) })
    panel.querySelector('#ga-form').addEventListener('submit', e => { e.preventDefault()
      const inp = panel.querySelector('#ga-in')
      const v = inp.value
      inp.value = ''
      ask(v) })
    panel.addEventListener('click', onClick)
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) toggle(false) })
  }
  window.gfAssistant = { parse, run, sanitize, open: () => toggle(true) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
})()
