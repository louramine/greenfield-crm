/* Greenfield CRM, page Rendement par catégorie (lotissement, industriel, promotion).
   Module autonome : construit la page #page-rendement, calcule les bilans en direct.
   Les derniers paramètres de chaque terrain sont gardés dans ce navigateur (localStorage). */
(function () {
  'use strict';

  var LS_KEY = 'gf-rendement-v1';
  var REF_ID = '__ref_jone';

  var DEFS = {
    promo: {
      label: 'Promotion immobilière', short: 'promotion',
      desc: 'Immeubles de logements et commerces. Bilan promoteur sur SHO et surfaces vendables.',
      groups: [
        { title: 'Terrain et foncier', params: [
          ['surf', 'Surface du terrain', 'm²', 20258, 'E'],
          ['prix', 'Prix d’acquisition', 'DH/m²', 1600, 'E'],
          ['fa', 'Frais d’acquisition', '%', 8, 'E']
        ]},
        { title: 'Urbanisme et programme', params: [
          ['cos', 'COS réglementaire', 'coef', 1.1, 'R'],
          ['sho', 'SHO logements', 'm²', 15040, 'E'],
          ['vend', 'Surface vendable appartements', 'm²', 12656, 'E'],
          ['ssol', 'Surface sous-sol', 'm²', 5008, 'E'],
          ['nbLog', 'Nombre de logements', 'u', 144, 'E'],
          ['nbPark', 'Places de parking', 'u', 144, 'E']
        ]},
        { title: 'Coûts', params: [
          ['rc', 'Construction logements', 'DH/m²', 3000, 'E'],
          ['rs', 'Construction sous-sol', 'DH/m²', 2500, 'H'],
          ['impr', 'Imprévus construction', '%', 3, 'E'],
          ['vrd', 'VRD in situ', 'DH/m²', 350, 'E'],
          ['part', 'Participation hors site', 'DH', 2828426, 'E'],
          ['cons', 'Conservation et éclatement', 'DH', 4163780, 'E'],
          ['ann', 'Frais annexes', '% CA', 1.5, 'E'],
          ['ff', 'Frais financiers', '% coût', 2, 'H']
        ]},
        { title: 'Ventes', params: [
          ['pv', 'Prix de vente logement', 'DH/m²', 12500, 'E'],
          ['pp', 'Prix d’une place de parking', 'DH', 50000, 'E'],
          ['cible', 'Marge cible promoteur', '% CA', 20, 'H']
        ]},
        { title: 'Fiscalité', params: [
          ['duree', 'Durée de l\u2019opération', 'exercices', 3, 'H']
        ]}
      ],
      land: 'prix', sale: ['pv', 'pp']
    },
    lot: {
      label: 'Lotissement', short: 'lotissement',
      desc: 'Découpage en lots viabilisés : voiries, cessions, réseaux, vente de lots nus.',
      groups: [
        { title: 'Terrain et foncier', params: [
          ['surf', 'Surface brute', 'm²', 20258, 'E'],
          ['prix', 'Prix d’acquisition', 'DH/m²', 1600, 'E'],
          ['fa', 'Frais d’acquisition', '%', 8, 'E']
        ]},
        { title: 'Voirie et cessions', params: [
          ['pvoie', 'Part voirie, espaces verts, équipements', '%', 30, 'H'],
          ['vp', 'Largeur voie principale', 'm', 20, 'R'],
          ['vd', 'Largeur voie de desserte', 'm', 12, 'R'],
          ['lot', 'Surface moyenne d’un lot', 'm²', 250, 'R'],
          ['fac', 'Façade minimale', 'm', 12, 'R']
        ]},
        { title: 'Viabilisation', params: [
          ['cv', 'Chaussée et trottoirs', 'DH/m² voie', 650, 'H'],
          ['cr', 'Réseaux eau, élec., assainissement', 'DH/m² brut', 200, 'H'],
          ['hs', 'Participation hors site', 'DH', 0, 'H'],
          ['et', 'Études, BET, topographe', '% VRD', 4, 'H'],
          ['tx', 'Taxe sur opération de lotissement', '% VRD', 4, 'H'],
          ['cl', 'Morcellement par lot', 'DH/lot', 12500, 'H']
        ]},
        { title: 'Ventes', params: [
          ['pl', 'Prix de vente des lots', 'DH/m²', 3800, 'H'],
          ['com', 'Commercialisation', '% CA', 3, 'H'],
          ['cible', 'Marge cible lotisseur', '% CA', 20, 'H']
        ]},
        { title: 'Fiscalité', params: [
          ['duree', 'Durée de l\u2019opération', 'exercices', 2, 'H']
        ]}
      ],
      land: 'prix', sale: ['pl']
    },
    indus: {
      label: 'Industriel', short: 'industriel',
      desc: 'Lots ou entrepôts en zone I ou ZI : voies poids lourds, puissance électrique, rendement locatif.',
      groups: [
        { title: 'Terrain et foncier', params: [
          ['surf', 'Surface brute', 'm²', 20258, 'E'],
          ['prix', 'Prix d’acquisition', 'DH/m²', 1600, 'E'],
          ['fa', 'Frais d’acquisition', '%', 8, 'E']
        ]},
        { title: 'Règles et gabarits', params: [
          ['pvoie', 'Part voirie et aires de manœuvre', '%', 18, 'H'],
          ['vl', 'Largeur voie poids lourds', 'm', 25, 'R'],
          ['lot', 'Surface moyenne d’un lot', 'm²', 2000, 'H'],
          ['emp', 'Emprise au sol maximale', '%', 60, 'R'],
          ['ht', 'Hauteur sous ferme', 'm', 12, 'R'],
          ['kva', 'Puissance électrique par hectare', 'kVA', 400, 'H']
        ]},
        { title: 'Coûts', params: [
          ['cv', 'Voirie renforcée poids lourds', 'DH/m² voie', 850, 'H'],
          ['cr', 'Réseaux, eaux industrielles, incendie', 'DH/m² brut', 250, 'H'],
          ['pt', 'Poste de transformation MT', 'DH', 1200000, 'H'],
          ['et', 'Études et taxes', '% VRD', 8, 'H'],
          ['cb', 'Construction entrepôt', 'DH/m²', 2600, 'H']
        ]},
        { title: 'Revenus', params: [
          ['pl', 'Prix de vente des lots', 'DH/m²', 2800, 'H'],
          ['loy', 'Loyer entrepôt', 'DH/m²/mois', 40, 'H'],
          ['com', 'Commercialisation', '% CA', 3, 'H'],
          ['cible', 'Marge cible', '% CA', 20, 'H']
        ]},
        { title: 'Fiscalité', params: [
          ['duree', 'Durée de la vente des lots', 'exercices', 2, 'H']
        ]}
      ],
      land: 'prix', sale: ['pl', 'loy']
    }
  };
  var CATS = ['promo', 'lot', 'indus'];
  var PRESET_JONE = { fa: 7.5, rs: 0, ann: 0, ff: 0 };
  var SRC_LABEL = { E: 'Étude', R: 'Règlement', H: 'Hypothèse' };

  /* ---------- outils ---------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nf(x, d) {
    d = d || 0;
    if (!isFinite(x)) return 'n.d.';
    return x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function mdh(x) { if (Math.abs(x) < 5000) x = 0; return nf(x / 1e6, 2) + ' M DH'; }
  function pct(x) { if (!isFinite(x)) return 'n.d.'; if (Math.abs(x) < 0.0005) x = 0; return nf(x * 100, 1) + ' %'; }
  function fmtIn(x) { return String(Math.round(x * 100) / 100).replace('.', ','); }
  function num(vals, k) {
    var v = parseFloat(String(vals[k] == null ? '' : vals[k]).replace(/\s/g, '').replace(',', '.'));
    return isFinite(v) ? v : 0;
  }
  function defaults(cat) {
    var o = {};
    DEFS[cat].groups.forEach(function (g) { g.params.forEach(function (p) { o[p[0]] = fmtIn(p[3]); }); });
    return o;
  }
  // Terrains du CRM hors vendus, du plus récent au plus ancien : même règle que le tri
  // « Plus récents (réf.) » de la page Terrains (référence GF-AA-NNNN décroissante, sans réf. à la fin).
  function terrains() {
    var list;
    // « state » est déclaré avec let dans index.html : il n'est pas sur window, on le lit directement.
    try { list = (typeof state !== 'undefined' && state && Array.isArray(state.terrains)) ? state.terrains.filter(function (t) { return t.statut !== 'Vendu'; }) : []; }
    catch (e) { return []; }
    return list.slice().sort(function (a, b) {
      var x = String(a.ref || ''), y = String(b.ref || '');
      if (x && y) {
        var c = y.localeCompare(x, 'fr', { numeric: true, sensitivity: 'base' });
        if (c) return c;
      } else if (x || y) return x ? -1 : 1;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }
  function catFromUrba(code) {
    var c = String(code || '').trim().toUpperCase();
    if (!c) return 'promo';
    if (/^(ZI|I|PBC)/.test(c)) return 'indus';
    if (/^(D|E)/.test(c)) return 'lot';
    return 'promo';
  }

  /* ---------- fiscalité (CGI 2026) ----------
     IS : 20 % si le bénéfice annuel est inférieur à 100 M DH, 35 % au-delà, sur la totalité.
     Contribution sociale de solidarité (2026 à 2028), non déductible : 1,5 % de 1 à 5 M DH,
     2,5 % de 5 à 10 M DH, 3,5 % de 10 à 40 M DH, 5 % au-delà, sur la totalité du bénéfice.
     Cotisation minimale : 0,25 % du CA HT, due si elle dépasse l'IS (3 000 DH minimum).
     Le résultat de l'opération est réparti à parts égales sur sa durée (exercices). */
  var DUREE_DEF = { promo: 3, lot: 2, indus: 2 };
  function cssRate(b) { return b < 1e6 ? 0 : b <= 5e6 ? 0.015 : b <= 10e6 ? 0.025 : b <= 40e6 ? 0.035 : 0.05; }
  function taxes(marge, ca, duree) {
    duree = Math.max(1, Math.round(duree) || 1);
    var bY = marge / duree, caY = ca / duree;
    var cmY = Math.max(3000, 0.0025 * caY);
    var isRate = bY >= 100e6 ? 0.35 : 0.20;
    var isY = bY > 0 ? isRate * bY : 0;
    var cmApplies = cmY > isY;
    var dueY = Math.max(isY, cmY);
    var cR = bY > 0 ? cssRate(bY) : 0;
    var cssY = cR * Math.max(0, bY);
    var is = dueY * duree, css = cssY * duree;
    var net = marge - is - css;
    return { is: is, css: css, net: net, isRate: isRate, cssRate: cR, cmApplies: cmApplies, duree: duree, bY: bY,
      rentNet: net / ca, tauxEff: marge > 0 ? (is + css) / marge : NaN };
  }
  function withTax(res, cat, v) {
    var d = num(v, 'duree') || DUREE_DEF[cat];
    res.tax = taxes(res.ca - res.cost, res.ca, d);
    return res;
  }

  /* ---------- calculs ---------- */
  function computePromo(v) {
    var n = function (k) { return num(v, k); };
    var surf = n('surf'), fa = n('fa') / 100;
    var foncier = surf * n('prix') * (1 + fa);
    var viab = n('vrd') * surf + n('part') * 1.05;
    var constr = (n('rc') * n('sho') + n('rs') * n('ssol')) * (1 + n('impr') / 100);
    var etudes = 0.01 * constr + 15 * n('sho') + 298000 + 36.6 * n('sho') + n('cons');
    var ca = n('vend') * n('pv') + n('nbPark') * n('pp');
    var annexes = n('ann') / 100 * ca;
    var base = foncier + viab + constr + etudes + annexes;
    var ff = n('ff') / 100 * base;
    var cost = base + ff;
    var cible = n('cible') / 100;
    var prixMax = (ca * (1 - cible) - (cost - foncier)) / (1 + fa) / (surf || 1);
    return {
      ca: ca, cost: cost, rent: (ca - cost) / ca, prixMax: prixMax, prix: n('prix'), cible: cible,
      costs: [['Foncier TTC', foncier], ['Viabilisation', viab], ['Construction', constr],
        ['Études, taxes, conservation', etudes], ['Frais annexes', annexes], ['Frais financiers', ff]],
      kpis: [
        ['Rentabilité brute', pct((ca - cost) / ca), 'Marge sur coût ' + pct((ca - cost) / cost)],
        ['Marge brute', mdh(ca - cost), 'Sur ' + nf(n('nbLog')) + ' logements, CA ' + mdh(ca)],
        ['Prix de revient', nf(cost / (n('vend') || 1)) + ' DH/m²', 'Par m² vendable, vente à ' + nf(n('pv')) + ' DH/m²'],
        ['Prix max du terrain', nf(prixMax) + ' DH/m²', 'Pour ' + nf(cible * 100) + ' % de marge, demandé ' + nf(n('prix'))]
      ],
      extra: { shoMax: n('cos') * surf, densite: n('sho') / (surf || 1), ratioVend: n('vend') / (n('sho') || 1) }
    };
  }
  function computeLot(v) {
    var n = function (k) { return num(v, k); };
    var surf = n('surf'), fa = n('fa') / 100;
    var foncier = surf * n('prix') * (1 + fa);
    var sVoie = surf * n('pvoie') / 100, cess = surf - sVoie;
    var nbLots = Math.floor(cess / (n('lot') || 1));
    var vrd = n('cv') * sVoie + n('cr') * surf + n('hs');
    var etudes = (n('et') + n('tx')) / 100 * vrd + n('cl') * nbLots;
    var ca = cess * n('pl'), com = n('com') / 100 * ca;
    var cost = foncier + vrd + etudes + com, cible = n('cible') / 100;
    var prixMax = (ca * (1 - cible) - (cost - foncier)) / (1 + fa) / (surf || 1);
    return {
      ca: ca, cost: cost, rent: (ca - cost) / ca, prixMax: prixMax, prix: n('prix'), cible: cible,
      costs: [['Foncier TTC', foncier], ['Voirie et réseaux', vrd], ['Études, taxes, morcellement', etudes], ['Commercialisation', com]],
      kpis: [
        ['Rentabilité brute', pct((ca - cost) / ca), 'Marge sur coût ' + pct((ca - cost) / cost)],
        ['Marge brute', mdh(ca - cost), 'Chiffre d’affaires ' + mdh(ca)],
        ['Lots commercialisables', nf(nbLots), nf(cess) + ' m² cessibles, rendement foncier ' + pct(cess / (surf || 1))],
        ['Prix max du terrain', nf(prixMax) + ' DH/m²', 'Pour ' + nf(cible * 100) + ' % de marge, demandé ' + nf(n('prix'))]
      ],
      extra: { sVoie: sVoie, lineaire: sVoie / (((n('vp') + n('vd')) / 2) || 1), nbLots: nbLots, cess: cess }
    };
  }
  function computeIndus(v) {
    var n = function (k) { return num(v, k); };
    var surf = n('surf'), fa = n('fa') / 100;
    var foncier = surf * n('prix') * (1 + fa);
    var sVoie = surf * n('pvoie') / 100, cess = surf - sVoie;
    var nbLots = Math.floor(cess / (n('lot') || 1));
    var vrd = n('cv') * sVoie + n('cr') * surf + n('pt');
    var etudes = n('et') / 100 * vrd;
    var ca = cess * n('pl'), com = n('com') / 100 * ca;
    var cost = foncier + vrd + etudes + com, cible = n('cible') / 100;
    var prixMax = (ca * (1 - cible) - (cost - foncier)) / (1 + fa) / (surf || 1);
    var bati = cess * n('emp') / 100;
    var invest = foncier + vrd + etudes + bati * n('cb');
    var loyers = bati * n('loy') * 12;
    return {
      ca: ca, cost: cost, rent: (ca - cost) / ca, prixMax: prixMax, prix: n('prix'), cible: cible,
      costs: [['Foncier TTC', foncier], ['Voirie PL et réseaux', vrd], ['Études et taxes', etudes], ['Commercialisation', com]],
      kpis: [
        ['Rentabilité vente de lots', pct((ca - cost) / ca), 'Marge ' + mdh(ca - cost) + ' sur ' + nf(nbLots) + ' lots'],
        ['Rendement locatif brut', pct(loyers / invest), 'Loyers ' + mdh(loyers) + ' par an, investissement ' + mdh(invest)],
        ['Surface bâtie possible', nf(bati) + ' m²', 'Emprise ' + nf(n('emp')) + ' %, hauteur ' + nf(n('ht')) + ' m'],
        ['Prix max du terrain', nf(prixMax) + ' DH/m²', 'Vente de lots, ' + nf(cible * 100) + ' % de marge, demandé ' + nf(n('prix'))]
      ],
      extra: { sVoie: sVoie, bati: bati, nbLots: nbLots, kvaTot: n('kva') * surf / 10000 }
    };
  }
  var COMPUTE = {
    promo: function (v) { return withTax(computePromo(v), 'promo', v); },
    lot: function (v) { return withTax(computeLot(v), 'lot', v); },
    indus: function (v) { return withTax(computeIndus(v), 'indus', v); }
  };

  /* ---------- plans d'aménagement (référentiel Supabase, voir supabase/regles-urbanisme.sql) ---------- */
  var PA = { p: null, ok: false, plans: {}, regles: [], locs: {} };
  var PA_LS = 'gf-rendement-plan-v1';
  function paLoad() {
    if (PA.p) return PA.p;
    if (typeof supaGet !== 'function') { PA.p = Promise.resolve(PA); return PA.p; }
    PA.p = Promise.all([
      supaGet('plans_amenagement', 'select=*&order=nom'),
      supaGet('regles_urbanisme', 'select=*'),
      supaGet('localisations_plan', 'select=*')
    ]).then(function (r) {
      PA.plans = {}; r[0].forEach(function (p) { PA.plans[p.code] = p; });
      PA.regles = r[1] || [];
      PA.locs = {}; (r[2] || []).forEach(function (l) { PA.locs[normLoc(l.localisation)] = l.plan; });
      PA.ok = true;
      return PA;
    }).catch(function () { PA.ok = false; return PA; });
    return PA.p;
  }
  function normLoc(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function planPicks() { try { return JSON.parse(localStorage.getItem(PA_LS) || '{}') || {}; } catch (e) { return {}; } }
  function setPlanPick(id, code) {
    try { var a = planPicks(); if (code) a[id] = code; else delete a[id]; localStorage.setItem(PA_LS, JSON.stringify(a)); } catch (e) { /* stockage indisponible */ }
  }
  // Codes de zonage saisis dans le CRM : « C2/D2S », « B3 E4 »... chaque morceau est un secteur.
  function zoneCodes(urba) {
    return String(urba || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
      .split(/[\s\/,;+&]+/).filter(function (c) { return /^[A-Z]{1,5}[0-9][A-Z0-9]*$|^[A-Z]{2,5}$/.test(c); });
  }
  function planOf(t) {
    if (!t) return null;
    var pick = planPicks()[t.id];
    if (pick && PA.plans[pick]) return pick;
    var p = PA.locs[normLoc(t.localisation)];
    return p && PA.plans[p] ? p : null;
  }
  // Secteur exact, sinon le secteur le plus long qui commence le code (I2S1 trouve I2S1, puis I2), sinon la zone.
  function findRegle(plan, code) {
    if (!plan || !code) return null;
    return findIn(plan, code) || findIn(plan + '-SECTORIEL', code); // le plan sectoriel complète le plan général
  }
  function findIn(plan, code) {
    var list = PA.regles.filter(function (x) { return x.plan === plan; });
    if (!list.length) return null;
    var ex = list.filter(function (x) { return x.secteur === code; })[0];
    if (ex) return { r: ex, exact: true };
    var best = null;
    list.forEach(function (x) { if (code.indexOf(x.secteur) === 0 && (!best || x.secteur.length > best.secteur.length)) best = x; });
    return best ? { r: best, exact: false } : null;
  }
  function regleOf(t, code) {
    var plan = planOf(t), codes = zoneCodes(t && t.urba);
    var c = code && codes.indexOf(code) >= 0 ? code : null;
    if (!c) for (var i = 0; i < codes.length; i++) { if (findRegle(plan, codes[i])) { c = codes[i]; break; } }
    c = c || codes[0] || null;
    return { plan: plan, codes: codes, code: c, m: findRegle(plan, c) };
  }
  function niveaux(rg) {
    var m = /R\s*\+\s*(\d+)/i.exec(rg.niveaux || '');
    if (m) return Number(m[1]) + 1;
    if (/RDC/i.test(rg.niveaux || '')) return 1;
    return rg.hauteur ? Math.max(1, Math.round((Number(rg.hauteur) - 0.5) / 3)) : null;
  }
  var EMP_DEF = 60; // emprise retenue quand le règlement ne fixe ni COS ni emprise (immeubles à l'alignement)
  // Reporte les règles de la zone dans les paramètres. Renvoie l'origine de chaque valeur reprise.
  function applyRegle(v, rg, surf) {
    var src = { promo: {}, lot: {}, indus: {} };
    if (!rg) return src;
    var lv = niveaux(rg), cos = null;
    if (rg.cos != null) { cos = Number(rg.cos); src.promo.cos = 'R'; }
    else if (lv) { cos = (rg.emprise != null ? Number(rg.emprise) : EMP_DEF) / 100 * lv; src.promo.cos = 'H'; }
    if (cos) {
      v.promo.cos = fmtIn(Math.round(cos * 100) / 100);
      if (surf) {
        var sho = surf * cos, vend = sho * 0.84, nbLog = Math.max(1, Math.round(vend / 88));
        v.promo.sho = fmtIn(Math.round(sho)); v.promo.vend = fmtIn(Math.round(vend));
        v.promo.nbLog = fmtIn(nbLog); v.promo.nbPark = fmtIn(nbLog); v.promo.cons = fmtIn(Math.round(nbLog * 28900));
        src.promo.sho = src.promo.vend = 'H';
      }
    }
    if (rg.lot_min != null) { v.lot.lot = fmtIn(Number(rg.lot_min)); src.lot.lot = 'R'; }
    if (rg.facade_min != null) { v.lot.fac = fmtIn(Number(rg.facade_min)); src.lot.fac = 'R'; }
    if (rg.emprise != null) { v.indus.emp = fmtIn(Number(rg.emprise)); src.indus.emp = 'R'; }
    if (rg.hauteur != null) { v.indus.ht = fmtIn(Number(rg.hauteur)); src.indus.ht = 'R'; }
    if (rg.lot_min != null && /^I/.test(rg.zone)) { v.indus.lot = fmtIn(Number(rg.lot_min)); src.indus.lot = 'R'; }
    return src;
  }

  /* ---------- état ---------- */
  var S = { terrainId: REF_ID, cat: 'promo', version: 'gf', vals: null, terrain: null, picked: false, code: null, src: null };

  function loadSaved() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save() {
    try {
      var all = loadSaved();
      all[S.terrainId] = { cat: S.cat, version: S.version, vals: S.vals, src: S.src, code: S.code, at: new Date().toISOString() };
      localStorage.setItem(LS_KEY, JSON.stringify(all));
      return true;
    } catch (e) { return false; }
  }

  function freshVals(t) {
    var v = { promo: defaults('promo'), lot: defaults('lot'), indus: defaults('indus') };
    if (!t) return v;
    var surf = Number(t.superficie) || 0, prix = Number(t.prix) || 0;
    CATS.forEach(function (c) {
      if (surf) v[c].surf = fmtIn(surf);
      v[c].prix = fmtIn(prix);
    });
    // Programme de promotion estimé à partir du COS et des ratios de l'étude de référence.
    var cos = 1.1, sho = surf * cos, vend = sho * 0.84;
    var nbLog = Math.max(1, Math.round(vend / 88));
    v.promo.sho = fmtIn(Math.round(sho));
    v.promo.vend = fmtIn(Math.round(vend));
    v.promo.ssol = fmtIn(Math.round(surf * 0.25));
    v.promo.nbLog = fmtIn(nbLog);
    v.promo.nbPark = fmtIn(nbLog);
    v.promo.part = '0';
    v.promo.cons = fmtIn(Math.round(nbLog * 28900));
    return v;
  }
  // Valeurs de départ d'un terrain, avec les règles de son plan d'aménagement quand elles sont connues.
  function startVals(t) {
    var v = freshVals(t);
    var src = { promo: {}, lot: {}, indus: {} };
    if (t && PA.ok) {
      var g = regleOf(t, S.code);
      S.code = g.code;
      if (g.m) src = applyRegle(v, g.m.r, Number(t.superficie) || 0);
    }
    if (t) { // sans règle connue, les valeurs « Règlement » par défaut ne sont que des hypothèses
      [['promo', 'cos'], ['lot', 'lot'], ['lot', 'fac'], ['indus', 'emp'], ['indus', 'ht']].forEach(function (k) {
        if (!src[k[0]][k[1]]) src[k[0]][k[1]] = 'H';
      });
    }
    return { v: v, src: src };
  }

  function selectTerrain(id) {
    S.terrainId = id;
    var t = null;
    if (id !== REF_ID) t = terrains().filter(function (x) { return String(x.id) === String(id); })[0] || null;
    S.terrain = t;
    var saved = loadSaved()[id];
    S.code = null;
    if (saved && saved.vals) {
      S.vals = saved.vals; S.cat = saved.cat || 'promo'; S.version = saved.version || 'gf';
      S.src = saved.src || { promo: {}, lot: {}, indus: {} }; S.code = saved.code || null;
    } else {
      var st = startVals(t);
      S.vals = st.v; S.src = st.src;
      S.cat = t ? catFromUrba(t.urba) : 'promo';
      S.version = 'gf';
    }
    S.fresh = !(saved && saved.vals);
  }

  function promoFromRef() { return S.terrainId === REF_ID; }

  /* ---------- rendu ---------- */
  function root() { return document.getElementById('page-rendement'); }

  function srcDot(s) {
    return '<span class="rd-dot rd-dot-' + s + '" title="' + SRC_LABEL[s] + '" aria-label="' + SRC_LABEL[s] + '"></span>';
  }

  function renderAll() {
    var el = root();
    if (!el) return;
    var mine = terrains();
    var opts = (mine.length ? '<optgroup label="Mes terrains (' + mine.length + '), du plus récent au plus ancien">' +
      mine.map(function (t) {
        var lab = typeof terrainLabel === 'function' ? terrainLabel(t) : (t.ref || '') + ' / ' + (t.localisation || '');
        return '<option value="' + esc(t.id) + '"' + (String(t.id) === String(S.terrainId) ? ' selected' : '') + '>' + esc(lab) + '</option>';
      }).join('') + '</optgroup>' : '') +
      '<optgroup label="Exemple"><option value="' + REF_ID + '"' + (S.terrainId === REF_ID ? ' selected' : '') + '>Étude de référence J-ONE Promo, TF 104996/63</option></optgroup>';

    var t = S.terrain;
    var facts = t
      ? [['Réf.', t.ref || 'n.c.'], ['Localisation', t.localisation || 'n.c.'], ['Zonage', t.urba || 'n.c.'],
         ['Surface', (Number(t.superficie) ? nf(Number(t.superficie)) + ' m²' : 'n.c.')],
         ['Prix demandé', (Number(t.prix) ? nf(Number(t.prix)) + ' DH/m²' : 'n.c.')], ['TF', t.tf || 'n.c.']]
      : [['Titre', 'TF 104996/63'], ['Surface', '20 258 m²'], ['Nette lotie', '15 173 m²'], ['Zonage', 'CS-DB3'],
         ['Prix demandé', '1 600 DH/m²'], ['Source', 'Étude J-ONE Promo']];

    el.innerHTML =
      '<div class="rd-head">' +
        '<div class="rd-pick"><label class="form-label" for="rd-terrain">Terrain</label>' +
          '<select class="form-select" id="rd-terrain">' + opts + '</select></div>' +
        '<div class="rd-facts">' + facts.map(function (f) {
          return '<div><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>';
        }).join('') + '</div>' +
      '</div>' +
      (t ? '<div class="card rd-pa" id="rd-pa"></div>' : '') +
      '<div class="rd-cats" role="tablist" aria-label="Catégorie">' + CATS.map(function (c) {
        return '<button type="button" role="tab" class="rd-cat' + (c === S.cat ? ' active' : '') + '" aria-selected="' + (c === S.cat) + '" data-cat="' + c + '">' +
          '<span class="rd-cat-t">' + DEFS[c].label + (c === S.cat ? '<em>Actif</em>' : '') + '</span>' +
          '<span class="rd-cat-d">' + DEFS[c].desc + '</span>' +
          '<span class="rd-cat-r">Brute <b data-rent="' + c + '"></b><span class="rd-sep"></span>Après impôt <b data-rentnet="' + c + '"></b></span></button>';
      }).join('') + '</div>' +
      '<div class="rd-kpis" id="rd-kpis"></div>' +
      '<div class="rd-verdict" id="rd-verdict"></div>' +
      '<div class="rd-body">' +
        '<div class="rd-params card" id="rd-params"></div>' +
        '<div class="rd-results">' +
          '<div class="card"><div class="card-title">Bilan ' + DEFS[S.cat].short + '<span class="rd-tot" id="rd-tot"></span></div><div id="rd-costs"></div>' +
            '<div class="rd-gt rd-tax-t">Après impôt</div><div id="rd-tax"></div></div>' +
          '<div class="rd-two">' +
            '<div class="card"><div class="card-title">Spécifications ' + DEFS[S.cat].short + '</div><div id="rd-specs"></div></div>' +
            '<div class="card"><div class="card-title" id="rd-watch-t"></div><div id="rd-watch"></div></div>' +
          '</div>' +
          '<div class="card"><div class="card-title">Sensibilité de la rentabilité après impôt</div>' +
            '<div class="rd-note">Prix du foncier en lignes, prix de vente en colonnes. Vert : marge brute cible atteinte.</div>' +
            '<div class="rd-sens-w"><div class="rd-sens" id="rd-sens"></div></div></div>' +
        '</div>' +
      '</div>';

    renderPa();
    renderParams();
    renderResults();
    bind();
  }

  function fdate(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; }
  function regleFacts(rg) {
    var f = [];
    if (rg.typologie) f.push(['Type', rg.typologie]);
    f.push(['COS', rg.cos != null ? nf(Number(rg.cos), 2) : 'non fixé']);
    f.push(['Emprise au sol', rg.emprise != null ? nf(Number(rg.emprise)) + ' %' : 'non fixée']);
    if (rg.hauteur != null || rg.niveaux) f.push(['Hauteur', (rg.hauteur != null ? nf(Number(rg.hauteur), 2) + ' m' : '') + (rg.niveaux ? (rg.hauteur != null ? ', ' : '') + rg.niveaux : '')]);
    if (rg.lot_min != null) f.push(['Lot minimum', nf(Number(rg.lot_min)) + ' m²' + (rg.facade_min != null ? ', façade ' + nf(Number(rg.facade_min)) + ' m' : '')]);
    return f;
  }
  // Alerte quand le plan a plus de 10 ans (effets limités à 10 ans par la loi 12-90).
  function paAlert(p) {
    if (!p || !p.fin_effets) return '';
    if (new Date(p.fin_effets + 'T00:00:00') > new Date()) return '';
    return 'Plan publié au BO le ' + fdate(p.date_bo) + ' : plus de 10 ans. Vérifier auprès de l’AUC s’il s’applique encore (prorogé, en révision ou remplacé).';
  }
  // Bloc « Plan d'aménagement » réutilisé par la fiche terrain.
  function paLinks(p, rg) {
    var a = [];
    var zu = rg && p && p.zones ? p.zones[rg.zone] : null;
    if (zu) a.push('<a href="' + esc(zu) + '" target="_blank" rel="noopener">Règlement de la zone ' + esc(rg.zone) + '</a>');
    if (p && p.planche_url) a.push('<a href="' + esc(p.planche_url) + '" target="_blank" rel="noopener">Plan graphique</a>');
    if (p && p.reglement_url) a.push('<a href="' + esc(p.reglement_url) + '" target="_blank" rel="noopener">Règlement général</a>');
    if (p && p.page_url) a.push('<a href="' + esc(p.page_url) + '" target="_blank" rel="noopener">Page AUC</a>');
    return a.length ? '<div class="rd-pa-links">' + a.join('') + '</div>' : '';
  }

  function renderPa() {
    var el = document.getElementById('rd-pa');
    var t = S.terrain;
    if (!el || !t) return;
    if (!PA.ok) {
      el.innerHTML = '<div class="card-title">Plan d’aménagement</div><div class="rd-note">' +
        (PA.p ? 'Référentiel des plans indisponible : exécutez supabase/regles-urbanisme.sql dans Supabase.' : 'Chargement du référentiel…') + '</div>';
      return;
    }
    var g = regleOf(t, S.code), p = g.plan ? PA.plans[g.plan] : null;
    var opts = '<option value="">' + (p ? 'Changer de plan' : 'Choisir le plan') + '</option>' +
      Object.keys(PA.plans).map(function (k) { return PA.plans[k]; }).sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); })
        .map(function (x) { return '<option value="' + esc(x.code) + '"' + (p && x.code === p.code ? ' selected' : '') + '>' + esc(x.nom) + '</option>'; }).join('');
    var h = '<div class="card-title">Plan d’aménagement' + (p ? ' de ' + esc(p.nom) : '') +
      '<span class="rd-acts"><select class="form-select rd-pa-sel" id="rd-pa-plan" aria-label="Plan d’aménagement">' + opts + '</select></span></div>';
    if (!p) {
      h += '<div class="rd-note">La localisation « ' + esc(t.localisation || 'non renseignée') + ' » n’est rattachée à aucun plan. Choisissez le plan dans la liste, ou saisissez les règles de la note de renseignements.</div>';
      el.innerHTML = h; return;
    }
    h += '<div class="rd-pa-sub">Décret ' + esc(p.decret || '') + ', BO du ' + fdate(p.date_bo) + '</div>';
    if (g.codes.length > 1) {
      h += '<div class="rd-pa-codes" role="group" aria-label="Secteur">' + g.codes.map(function (c) {
        return '<button type="button" data-code="' + esc(c) + '" class="' + (c === g.code ? 'active' : '') + '" aria-pressed="' + (c === g.code) + '">' + esc(c) + '</button>';
      }).join('') + '</div>';
    }
    var al = paAlert(p);
    if (!g.m) {
      h += '<div class="rd-note">' + (g.code ? 'Secteur « ' + esc(g.code) + ' » absent du référentiel pour ce plan.' : 'Zonage non renseigné sur la fiche du terrain.') +
        ' Saisissez les règles de la note de renseignements.</div>' + (al ? '<div class="rd-pa-al">' + esc(al) + '</div>' : '') + paLinks(p, null);
      el.innerHTML = h; return;
    }
    var rg = g.m.r;
    h += '<div class="rd-pa-sec">Secteur <b>' + esc(rg.secteur) + '</b>' + (g.m.exact ? '' : ' <span>(règle la plus proche du code ' + esc(g.code) + ')</span>') + '</div>' +
      '<div class="rd-pa-facts">' + regleFacts(rg).map(function (f) { return '<div><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; }).join('') + '</div>';
    if (rg.remarque) h += '<div class="rd-note">' + esc(rg.remarque) + '</div>';
    if (!rg.verifie) h += '<div class="rd-pa-al rd-pa-chk">Chiffres lus automatiquement sur le scan du règlement : à confirmer sur la note de renseignements.</div>';
    if (al) h += '<div class="rd-pa-al">' + esc(al) + '</div>';
    h += '<div class="rd-pa-foot">' + paLinks(p, rg) +
      '<button type="button" class="btn btn-ghost btn-sm" id="rd-pa-apply">Reprendre ces règles dans le calcul</button></div>';
    el.innerHTML = h;
  }
  function bindPa() {
    var el = document.getElementById('rd-pa');
    if (!el) return;
    var sel = el.querySelector('#rd-pa-plan');
    if (sel) sel.addEventListener('change', function () {
      if (!S.terrain) return;
      setPlanPick(S.terrain.id, sel.value || null);
      S.code = null; reapply();
    });
    el.querySelectorAll('[data-code]').forEach(function (b) {
      b.addEventListener('click', function () { S.code = b.getAttribute('data-code'); reapply(); });
    });
    var ap = el.querySelector('#rd-pa-apply');
    if (ap) ap.addEventListener('click', function () { reapply(); });
  }
  // Applique les règles du secteur choisi aux trois catégories, sans toucher aux autres paramètres.
  function reapply() {
    var t = S.terrain;
    if (t && PA.ok) {
      var g = regleOf(t, S.code);
      S.code = g.code;
      if (g.m) {
        var src = applyRegle(S.vals, g.m.r, num(S.vals[S.cat], 'surf') || Number(t.superficie) || 0);
        S.src = S.src || { promo: {}, lot: {}, indus: {} };
        CATS.forEach(function (c) { Object.keys(src[c]).forEach(function (k) { S.src[c][k] = src[c][k]; }); });
      }
    }
    renderPa(); bindPa(); renderParams(); renderResults(); bindParams();
  }

  function renderParams() {
    var el = document.getElementById('rd-params');
    var def = DEFS[S.cat], vals = S.vals[S.cat];
    var h = '<div class="card-title">Paramètres ' + def.short +
      '<span class="rd-acts"><button type="button" class="btn btn-ghost btn-sm" id="rd-reset">Réinitialiser</button>' +
      '<button type="button" class="btn btn-primary btn-sm" id="rd-save">Enregistrer</button></span></div>';
    if (S.cat === 'promo' && promoFromRef()) {
      h += '<div class="rd-seg" role="group" aria-label="Version de l’étude">' +
        '<button type="button" data-ver="gf" aria-pressed="' + (S.version === 'gf') + '" class="' + (S.version === 'gf' ? 'active' : '') + '">Recalée Greenfield</button>' +
        '<button type="button" data-ver="jone" aria-pressed="' + (S.version === 'jone') + '" class="' + (S.version === 'jone' ? 'active' : '') + '">Étude J-ONE telle quelle</button></div>' +
        '<div class="rd-note">' + (S.version === 'gf'
          ? 'Ajoute le sous-sol, les frais annexes, l’hypothèque et les frais financiers absents du fichier.'
          : 'Reprend exactement les chiffres du fichier, soit 41,3 % de rentabilité affichée.') + '</div>';
    } else if (S.cat === 'promo') {
      var pc = S.src && S.src.promo && S.src.promo.cos;
      h += '<div class="rd-note">' + (pc === 'R' ? 'Programme estimé à partir du COS du règlement de zone et des ratios de l’étude de référence.'
        : pc === 'H' ? 'Le règlement ne fixe pas de COS : COS équivalent estimé avec l’emprise et le nombre de niveaux autorisés. Programme à remplacer par la consistance réelle du projet.'
        : 'Programme estimé à partir du COS et des ratios de l’étude de référence. Remplacez par la consistance réelle du projet.') + '</div>';
    }
    h += '<div class="rd-legend">' + ['E', 'R', 'H'].map(function (s) { return '<span>' + srcDot(s) + SRC_LABEL[s] + '</span>'; }).join('') + '</div>';
    def.groups.forEach(function (g) {
      h += '<div class="rd-group"><div class="rd-gt">' + g.title + '</div>';
      g.params.forEach(function (p) {
        var id = 'rd-f-' + S.cat + '-' + p[0];
        var so = (S.src && S.src[S.cat] && S.src[S.cat][p[0]]) || p[4];
        h += '<div class="rd-row">' + srcDot(so) + '<label for="' + id + '">' + p[1] + '</label>' +
          '<div class="rd-in"><input class="form-input" id="' + id + '" data-k="' + p[0] + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(vals[p[0]]) + '"><span>' + p[2] + '</span></div></div>';
      });
      h += '</div>';
    });
    h += '<div class="rd-saved" id="rd-saved"></div>';
    el.innerHTML = h;
  }

  function specsFor(cat, vals, x) {
    var t = S.terrain, ref = promoFromRef();
    if (cat === 'promo') {
      var sp = [
        ['Zonage', ref ? 'CS-DB3 (fiche), CC-AN7 (frais de conservation)' : (t && t.urba) || 'À renseigner'],
        ['COS réglementaire', nf(num(vals, 'cos'), 2) + ', soit ' + nf(x.shoMax) + ' m² de SHO possible'],
        ['Densité réalisée', nf(x.densite, 2) + ' (SHO sur terrain brut)'],
        ['Logements', nf(num(vals, 'nbLog'))],
        ['Sous-sol et parkings', nf(num(vals, 'ssol')) + ' m², ' + nf(num(vals, 'nbPark')) + ' places'],
        ['Ratio vendable', pct(x.ratioVend) + ' de la SHO']
      ];
      if (ref) sp.splice(1, 0, ['Gabarit', 'R+2 en fiche, R+5 dans la réquisition'], ['Immeubles', '16 immeubles, typologie studio à F4'], ['Commerces en RDC', 'Aucun dans l’option retenue']);
      else sp.push(['Typologie et commerces', 'À définir selon la note de renseignement']);
      return sp;
    }
    if (cat === 'lot') return [
      ['Hiérarchie des voies', 'Principale ' + nf(num(vals, 'vp')) + ' m, desserte ' + nf(num(vals, 'vd')) + ' m'],
      ['Emprise voirie et cessions', nf(x.sVoie) + ' m² (' + nf(num(vals, 'pvoie')) + ' %)'],
      ['Linéaire de voirie estimé', nf(x.lineaire) + ' ml'],
      ['Surface cessible', nf(x.cess) + ' m²'],
      ['Lots', nf(x.nbLots) + ' lots de ' + nf(num(vals, 'lot')) + ' m²'],
      ['Façade minimale', nf(num(vals, 'fac')) + ' m'],
      ['Réseaux', 'Eau, électricité, assainissement, éclairage, télécom'],
      ['Procédure', 'Autorisation de lotir, réception provisoire, éclatement des titres']
    ];
    return [
      ['Zonage', (t && t.urba) ? t.urba : 'Zone I ou ZI à confirmer'],
      ['Voies poids lourds', nf(num(vals, 'vl')) + ' m de large, giration semi-remorque'],
      ['Emprise voirie et manœuvre', nf(x.sVoie) + ' m²'],
      ['Lots', nf(x.nbLots) + ' lots de ' + nf(num(vals, 'lot')) + ' m²'],
      ['Emprise au sol', nf(num(vals, 'emp')) + ' %, soit ' + nf(x.bati) + ' m² bâtis'],
      ['Hauteur sous ferme', nf(num(vals, 'ht')) + ' m'],
      ['Puissance électrique', nf(x.kvaTot) + ' kVA, poste MT'],
      ['Réseaux spécifiques', 'Eaux industrielles, défense incendie, quais']
    ];
  }

  function watchFor(cat, vals, x) {
    if (cat === 'promo' && promoFromRef()) return { t: 'Points de vigilance de l’étude', items: [
      ['late', 'Sous-sol de 5 008 m² compté dans le programme mais non chiffré (ratio vide). Hypothèse retenue : 2 500 DH/m².'],
      ['late', 'Frais annexes à zéro : les taux de 0,5 % (marketing, personnel, gestion) ne sont pas multipliés par le chiffre d’affaires.'],
      ['today', 'Frais financiers, taxe VRD et inscription d’hypothèque non calculés.'],
      ['today', 'Incohérences à lever : R+2 contre R+5, zone CS-DB3 contre CC-AN7.'],
      ['today', 'SHO de 15 040 m² pour un COS de 1,1 : environ ' + nf(Math.max(0, x.shoMax - num(vals, 'sho'))) + ' m² de droits non exploités sur la surface brute.'],
      ['todo', 'Prix de vente unique de 12 500 DH/m² sans commerces : comparer aux références du secteur.']
    ]};
    if (cat === 'promo') return { t: 'Points à vérifier', items: [
      ['todo', 'COS, hauteur et règles de la zone sur la note de renseignement.'],
      ['todo', 'Consistance réelle : SHO, surfaces vendables, sous-sol.'],
      ['todo', 'Prix de vente des appartements neufs du secteur.'],
      ['todo', 'Participation hors site et frais de conservation.']
    ]};
    if (cat === 'lot') return { t: 'Points à vérifier', items: [
      ['todo', 'Part réelle de voirie et de cessions sur le plan d’aménagement et la note de renseignement.'],
      ['todo', 'Surface et façade minimales des lots selon le règlement de zone.'],
      ['todo', 'Participation hors site demandée par la Lydec ou la régie.'],
      ['todo', 'Prix de vente des lots à caler sur les comparables Greenfield du secteur.']
    ]};
    return { t: 'Points à vérifier', items: [
      ['todo', 'Activités autorisées et interdites dans la zone, étude d’impact selon l’activité.'],
      ['todo', 'Capacité électrique disponible et délai de raccordement MT.'],
      ['todo', 'Accès poids lourds depuis la route nationale ou l’autoroute.'],
      ['todo', 'Loyers et prix de lots des zones industrielles voisines.']
    ]};
  }

  function renderResults() {
    var cat = S.cat, def = DEFS[cat], vals = S.vals[cat];
    var res = COMPUTE[cat](vals);

    CATS.forEach(function (c) {
      var b = root().querySelector('[data-rent="' + c + '"]');
      var rc = COMPUTE[c](S.vals[c]);
      if (b) b.textContent = pct(rc.rent);
      var bn = root().querySelector('[data-rentnet="' + c + '"]');
      if (bn) bn.textContent = pct(rc.tax.rentNet);
    });

    var tx = res.tax;
    var netK = [cat === 'indus' ? 'Rentabilité lots après impôt' : 'Rentabilité après impôt', pct(tx.rentNet),
      isFinite(tx.tauxEff) ? 'Impôts : ' + pct(tx.tauxEff) + ' de la marge brute' : 'Cotisation minimale due, résultat déficitaire'];
    var kp = res.kpis.slice(); kp.splice(1, 0, netK);
    var mNet = ['Marge nette', mdh(tx.net), 'Après IS et contribution de solidarité, ' + pct(tx.net / (res.cost || 1)) + ' du coût'];
    kp.splice(cat === 'indus' ? 2 : 3, 0, mNet);
    document.getElementById('rd-kpis').innerHTML = kp.map(function (k, i) {
      return '<div class="kpi-card' + (i === 1 ? ' rd-kpi-main' : '') + '"><div class="kpi-label">' + k[0] + '</div>' +
        '<div class="kpi-value">' + k[1] + '</div><div class="kpi-sub">' + k[2] + '</div></div>';
    }).join('');

    var ok = res.prixMax >= res.prix;
    var v = document.getElementById('rd-verdict');
    v.className = 'rd-verdict ' + (ok ? 'ok' : 'ko');
    v.textContent = ok
      ? 'Prix demandé tenable : cet usage supporte jusqu’à ' + nf(res.prixMax) + ' DH/m², soit ' + nf(res.prixMax - res.prix) + ' DH/m² de marge de négociation.'
      : 'Prix demandé trop élevé pour cet usage : il faudrait descendre à ' + nf(Math.max(0, res.prixMax)) + ' DH/m² pour tenir la marge cible.';

    var total = res.cost || 1;
    var max = Math.max.apply(null, res.costs.map(function (c) { return c[1]; })) || 1;
    var pal = ['#0a1410', '#1f7a4d', '#2d9e5f', '#7ee0a4', '#e3a13b', '#9cb3a3'];
    document.getElementById('rd-tot').textContent = 'Coût ' + mdh(res.cost) + ', CA ' + mdh(res.ca);
    document.getElementById('rd-costs').innerHTML = res.costs.map(function (c, i) {
      return '<div class="rd-cost"><div class="rd-cost-l"><span>' + c[0] + '</span><span><b>' + mdh(c[1]) + '</b> <i>' + pct(c[1] / total) + '</i></span></div>' +
        '<div class="rd-bar"><div style="width:' + Math.max(0, c[1] / max * 100).toFixed(1) + '%;background:' + pal[i % pal.length] + '"></div></div></div>';
    }).join('');

    var marge = res.ca - res.cost;
    var trows = [
      ['Marge brute (résultat avant impôt)', mdh(marge), ''],
      ['IS ' + (tx.cmApplies ? '(cotisation minimale 0,25 % du CA)' : pct(tx.isRate)), '- ' + mdh(tx.is), ''],
      ['Contribution sociale de solidarité ' + (tx.cssRate ? pct(tx.cssRate) : '(non due)'), '- ' + mdh(tx.css), ''],
      ['Résultat net après impôt', mdh(tx.net), 'net']
    ];
    document.getElementById('rd-tax').innerHTML = trows.map(function (r) {
      return '<div class="rd-tx' + (r[2] ? ' rd-tx-net' : '') + '"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
    }).join('') + '<div class="rd-note">Bénéfice réparti sur ' + tx.duree + ' exercice' + (tx.duree > 1 ? 's' : '') + ', soit ' + mdh(Math.max(0, tx.bY)) +
      ' par an. Barèmes 2026 : IS 20 % sous 100 M DH de bénéfice annuel, 35 % au-delà. La contribution de solidarité n\u2019est pas déductible. Estimation à valider avec votre expert-comptable.</div>';

    document.getElementById('rd-specs').innerHTML = specsFor(cat, vals, res.extra).map(function (s) {
      return '<div class="rd-spec"><span>' + esc(s[0]) + '</span><b>' + esc(s[1]) + '</b></div>';
    }).join('');

    var w = watchFor(cat, vals, res.extra);
    document.getElementById('rd-watch-t').textContent = w.t;
    document.getElementById('rd-watch').innerHTML = w.items.map(function (it) {
      return '<div class="rd-w"><span class="rd-wd rd-wd-' + it[0] + '"></span><span>' + esc(it[1]) + '</span></div>';
    }).join('');

    var steps = [-0.1, -0.05, 0, 0.05, 0.1];
    var sg = function (x) { return (x > 0 ? '+' : '') + nf(x * 100) + ' %'; };
    var h = '<span></span>' + steps.map(function (s) { return '<span class="rd-sh">Vente ' + sg(s) + '</span>'; }).join('');
    [-0.1, 0, 0.1].forEach(function (l) {
      h += '<span class="rd-sh rd-sl">Foncier ' + sg(l) + '</span>';
      steps.forEach(function (s) {
        var v2 = Object.assign({}, vals);
        v2[def.land] = String(num(vals, def.land) * (1 + l));
        def.sale.forEach(function (k) { v2[k] = String(num(vals, k) * (1 + s)); });
        var rr = COMPUTE[cat](v2), r = rr.tax.rentNet;
        var cls = rr.rent >= res.cible ? 'ok' : (r >= 0 ? 'mid' : 'ko');
        h += '<span class="rd-sc ' + cls + (l === 0 && s === 0 ? ' cur' : '') + '">' + pct(r) + '</span>';
      });
    });
    document.getElementById('rd-sens').innerHTML = h;
  }

  function bind() {
    var el = root();
    bindPa();
    el.querySelector('#rd-terrain').addEventListener('change', function () { S.picked = true; selectTerrain(this.value); renderAll(); });
    el.querySelectorAll('.rd-cat').forEach(function (b) {
      b.addEventListener('click', function () { S.cat = b.getAttribute('data-cat'); renderAll(); });
    });
    bindParams();
  }
  function bindParams() {
    var el = root();
    el.querySelectorAll('#rd-params input[data-k]').forEach(function (inp) {
      inp.addEventListener('input', function () { S.fresh = false; S.vals[S.cat][inp.getAttribute('data-k')] = inp.value; renderResults(); });
    });
    el.querySelectorAll('#rd-params [data-ver]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.version = b.getAttribute('data-ver');
        S.vals.promo = defaults('promo');
        if (S.version === 'jone') Object.keys(PRESET_JONE).forEach(function (k) { S.vals.promo[k] = fmtIn(PRESET_JONE[k]); });
        renderParams(); renderResults(); bindParams();
      });
    });
    var r = el.querySelector('#rd-reset');
    if (r) r.addEventListener('click', function () {
      var st = startVals(S.terrain);
      S.vals[S.cat] = st.v[S.cat];
      if (S.src) S.src[S.cat] = st.src[S.cat];
      if (S.cat === 'promo') S.version = 'gf';
      renderParams(); renderResults(); bindParams();
    });
    var sv = el.querySelector('#rd-save');
    if (sv) sv.addEventListener('click', function () {
      var m = document.getElementById('rd-saved');
      m.textContent = save() ? 'Scénario enregistré sur cet appareil.' : 'Enregistrement impossible sur ce navigateur.';
    });
    var saved = loadSaved()[S.terrainId];
    var m = document.getElementById('rd-saved');
    if (m && saved && saved.at) m.textContent = 'Dernier enregistrement : ' + new Date(saved.at).toLocaleString('fr-FR');
  }

  /* ---------- API publique ---------- */
  function onPaReady() {
    if (!root() || !root().classList.contains('active')) return;
    if (S.terrain && S.fresh) { var st = startVals(S.terrain); S.vals = st.v; S.src = st.src; }
    renderAll();
  }
  window.rdInit = function () {
    if (!PA.p) paLoad().then(onPaReady);
    var first = terrains()[0];
    if (!S.vals || (!S.picked && S.terrainId === REF_ID && first)) {
      selectTerrain(first ? String(first.id) : REF_ID);
    } else if (S.terrainId !== REF_ID && !S.terrain) {
      selectTerrain(S.terrainId); // données du CRM arrivées après la première ouverture
    }
    renderAll();
  };
  // Fiche terrain : bloc « Plan d'aménagement » (secteur, règles, liens), rempli quand le référentiel est chargé.
  window.rdPlanFill = function (t, el) {
    if (!el) return;
    el.style.display = 'none';
    paLoad().then(function () {
      if (!PA.ok || !t) return;
      var g = regleOf(t), p = g.plan ? PA.plans[g.plan] : null;
      if (!p) return;
      var rg = g.m ? g.m.r : null, al = paAlert(p);
      var h = '<label class="form-label">Plan d’aménagement</label><div class="rd-pa-mini"><div class="rd-pa-sub">Plan de ' + esc(p.nom) + ', décret ' + esc(p.decret || '') + ', BO du ' + fdate(p.date_bo) + '</div>';
      if (rg) h += '<div class="rd-pa-sec">Secteur <b>' + esc(rg.secteur) + '</b>' + (g.m.exact ? '' : ' <span>(règle la plus proche du code ' + esc(g.code) + ')</span>') + '</div>' +
        '<div class="rd-pa-facts">' + regleFacts(rg).map(function (f) { return '<div><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; }).join('') + '</div>';
      else h += '<div class="rd-note">' + (g.code ? 'Secteur « ' + esc(g.code) + ' » absent du référentiel.' : 'Zonage non renseigné.') + '</div>';
      if (rg && !rg.verifie) h += '<div class="rd-pa-al rd-pa-chk">Lecture automatique du scan : à confirmer sur la note de renseignements.</div>';
      if (al) h += '<div class="rd-pa-al">' + esc(al) + '</div>';
      el.innerHTML = h + paLinks(p, rg) + '</div>';
      el.style.display = '';
    });
  };
  window.rdFromTerrain = function (id) {
    paLoad().then(onPaReady);
    if (typeof closeModal === 'function') closeModal('modal-terrain-detail');
    var nav = document.querySelector('.sidebar .nav-item[onclick*="\'rendement\'"]');
    S.picked = true;
    selectTerrain(String(id));
    if (nav && typeof showPage === 'function') showPage('rendement', nav);
    else renderAll();
    window.scrollTo(0, 0);
  };
})();
