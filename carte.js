/* Greenfield : module carte des terrains, partagé par la page Carte du CRM et la page des liens prospects.
   Nécessite Leaflet (window.L). Point d'entrée : GFCarte.mount(element, options) */
(function () {
'use strict'

const POIS = [
  { n: 'Aéroport Mohammed V', lat: 33.3675, lng: -7.5898 },
  { n: 'Port de Casablanca', lat: 33.6060, lng: -7.6140 },
  { n: 'Gare Casa Voyageurs', lat: 33.5893, lng: -7.5912 },
  { n: 'Morocco Mall', lat: 33.5762, lng: -7.7064 },
  { n: 'Centre-ville', lat: 33.5928, lng: -7.6190 }
]
const FAM = [
  { k: 'A', l: 'Zone A (immeubles)', col: '#78d6cb' },
  { k: 'B', l: 'Zone B et BT', col: '#7ee0a4' },
  { k: 'C', l: 'Zone C', col: '#c3b2ff' },
  { k: 'D', l: 'Zone D (villas)', col: '#cde88f' },
  { k: 'E', l: 'Zone E', col: '#9fcaff' },
  { k: 'I', l: 'Industriel (I)', col: '#f2b860' },
  { k: 'R', l: 'Rural, agricole (R)', col: '#e2cf9e' },
  { k: 'X', l: 'Autres ou non renseigné', col: '#d3dcd6' }
]
const FAMC = {}
FAM.forEach(f => { FAMC[f.k] = f })
const fam = z => {
  const c = String(z ?? '').trim().charAt(0).toUpperCase()
  return FAMC[c] ? c : 'X'
}
const MODES = {
  decouverte: { label: 'Découverte', note: 'Localisation et forme volontairement approximatives. Superficie et prix indiqués en fourchette. Les détails sont communiqués après engagement de confidentialité. Document non contractuel.' },
  qualifie: { label: 'Acheteur qualifié', note: 'Informations indicatives communiquées par Greenfield. Superficie, zonage et prix à confirmer (note de renseignement, plan du géomètre). Document non contractuel.' },
  interne: { label: 'Interne', note: 'Usage interne Greenfield, ne pas diffuser.' }
}

const fmt = n => Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ')
const dec1 = n => String(Math.round(n * 10) / 10).replace('.', ',')
const mdh = n => (n >= 1e8 ? fmt(n / 1e6) : dec1(n / 1e6)) + ' MDH'
const ha = s => s >= 10000 ? dec1(s / 10000) + ' ha' : fmt(s) + ' m²'
const esc = s => String(s ?? '').replace(/&/g, ' et ').replace(/</g, '‹').replace(/>/g, '›').replace(/"/g, '”')
const escUrl = s => String(s ?? '').replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E')
const km = (a, b, c, d) => {
  const R = 6371
  const r = Math.PI / 180
  const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

// Arrondis de la version découverte (mêmes règles que la fonction carte_publique côté serveur)
function arrondiSurface (s) {
  if (!s) return null
  if (s < 10000) return Math.round(s / 500) * 500
  if (s < 100000) return Math.round(s / 5000) * 5000
  return Math.round(s / 10000) * 10000
}
function fourchette (v, steps) {
  let st = steps[steps.length - 1][1]
  for (const [lim, step] of steps) { if (v < lim) { st = step
    break } }
  return [Math.floor(v * 0.9 / st) * st, Math.ceil(v * 1.1 / st) * st]
}
function versDecouverte (t) {
  const o = { key: t.key, id: t.id, q: t.q, z: t.z, s: arrondiSurface(t.s), pt: !t.ga }
  if (t.pm > 0) { const [a, b] = fourchette(t.pm, [[2000, 100], [5000, 250], [1e12, 1000]])
    o.pmlo = a
    o.pmhi = b }
  if (t.pf > 0) { const [a, b] = fourchette(t.pf, [[2e7, 1e6], [1e8, 5e6], [1e15, 1e7]])
    o.pflo = a / 1e6
    o.pfhi = b / 1e6 }
  o.g = t.ga
  o.lat = t.ga ? t.alat : t.lat + 0.002
  o.lng = t.ga ? t.alng : t.lng - 0.0025
  return o
}

const CSS = `
.gfc{position:relative;display:flex;height:100%;width:100%;font-family:'Inter Tight','Inter',system-ui,sans-serif;color:#0a1410;background:#0e1f17;overflow:hidden}
.gfc *{box-sizing:border-box}
.gfc-side{width:370px;flex:none;display:flex;flex-direction:column;background:#f4f9f5;z-index:500;box-shadow:2px 0 12px rgba(0,0,0,.25)}
.gfc-brand{background:#0a1410;color:#7ee0a4;padding:16px 18px 12px}
.gfc-word{font-family:'Archivo','League Spartan',sans-serif;font-weight:900;font-size:26px;letter-spacing:-.02em;line-height:1}
.gfc-word sup{font-size:15px;margin-left:2px}
.gfc-slogan{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:4px;margin-top:6px}
.gfc-sub{margin-top:10px;font-size:12.5px;color:#c8e6d3;line-height:1.4}
.gfc-badge{display:inline-block;margin-top:8px;font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;border:1px solid #7ee0a4;color:#7ee0a4;padding:2px 8px;border-radius:999px}
.gfc-badge.red{border-color:#ffb36b;color:#ffb36b}
.gfc-filters{padding:12px 14px 6px;border-bottom:1px solid #dfe8e1;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.gfc-filters label{font-family:'JetBrains Mono',monospace;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#4f6a5c;display:flex;flex-direction:column;gap:4px}
.gfc-filters select,.gfc-filters input{font:inherit;font-family:'Inter Tight','Inter',sans-serif;font-size:13px;text-transform:none;letter-spacing:0;color:#0a1410;padding:7px 8px;border:1px solid #cfdcd2;border-radius:10px;background:#fff;width:100%}
.gfc-full{grid-column:1/3}
.gfc-chips{display:flex;flex-wrap:wrap;gap:5px}
.gfc-chip{font-family:'Inter Tight','Inter',sans-serif;font-size:11.5px;text-transform:none;letter-spacing:0;border:1px solid #cfdcd2;background:#fff;border-radius:999px;padding:3px 9px 3px 6px;cursor:pointer;display:flex;align-items:center;gap:5px;color:#0a1410}
.gfc-chip i,.gfc-legend i,.gfc-zone i{width:10px;height:10px;border-radius:50%;display:inline-block;box-shadow:0 0 0 1px rgba(0,0,0,.2)}
.gfc-chip.off{opacity:.35}
.gfc-count{padding:8px 14px;font-size:12px;color:#4f6a5c;display:flex;justify-content:space-between;align-items:center;gap:8px}
.gfc-link{font:inherit;font-size:12px;border:none;background:none;color:#1f7a4d;cursor:pointer;text-decoration:underline;padding:0}
.gfc-list{flex:1;overflow-y:auto;padding:0 10px 14px}
.gfc-card{background:#fff;border-radius:14px;padding:10px 12px;margin-bottom:8px;cursor:pointer;border:1px solid transparent;display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center}
.gfc-card:hover,.gfc-card.sel{border-color:#7ee0a4;box-shadow:0 2px 8px rgba(10,20,16,.1)}
.gfc-card .t{font-weight:700;font-size:13.5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.gfc-card .m{font-size:12px;color:#4f6a5c;margin-top:2px}
.gfc-card .p{text-align:right;font-weight:700;font-size:13px;white-space:nowrap}
.gfc-card .p small{display:block;font-weight:400;color:#4f6a5c;font-size:11px}
.gfc-dot{width:9px;height:9px;border-radius:50%;display:inline-block;box-shadow:0 0 0 1px rgba(0,0,0,.25)}
.gfc-ck{width:20px;height:20px;border-radius:6px;border:1.5px solid #9cb3a3;background:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;color:#0a1410;cursor:pointer;padding:0}
.gfc-ck.on{background:#7ee0a4;border-color:#1f7a4d}
.gfc-tag{font-size:10px;font-weight:600;padding:1px 6px;border-radius:8px;background:#ede7f6;color:#4527a0}
.gfc-tag.w{background:#ff8c1a;color:#fff}
.gfc-map{flex:1;height:100%}
.gfc-selbar{position:absolute;left:386px;top:14px;z-index:900;background:#0a1410;color:#e8f2ea;border:1px solid rgba(126,224,164,.35);border-radius:999px;padding:6px 6px 6px 14px;display:flex;align-items:center;gap:8px;font-size:13px;box-shadow:0 4px 18px rgba(0,0,0,.35);max-width:calc(100% - 400px);flex-wrap:wrap}
.gfc-selbar b{color:#7ee0a4}
.gfc-btn{font:inherit;font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:999px;border:none;cursor:pointer;text-decoration:none;white-space:nowrap}
.gfc-b1{background:#7ee0a4;color:#0a1410}
.gfc-b2{background:rgba(126,224,164,.15);color:#e8f2ea;border:1px solid rgba(126,224,164,.35)}
.gfc-b3{background:#e6f6ee;color:#0a1410}
.gfc-b4{background:#0a1410;color:#7ee0a4}
.gfc-detail{position:absolute;top:62px;right:14px;width:350px;max-height:calc(100% - 76px);overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.3);z-index:1000;display:none}
.gfc-detail.on{display:block}
.gfc-dh{background:#0a1410;color:#fff;padding:15px 17px;border-radius:16px 16px 0 0;position:relative}
.gfc-dh .id{color:#7ee0a4;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em}
.gfc-dh h2{font-family:'Archivo','League Spartan',sans-serif;font-weight:800;font-size:22px;margin:4px 0 0}
.gfc-dh .x{position:absolute;top:8px;right:10px;background:none;border:none;color:#fff;font-size:22px;cursor:pointer}
.gfc-zone{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;background:rgba(255,255,255,.1);padding:3px 10px;border-radius:999px}
.gfc-kpis{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#e2ebe4}
.gfc-kpi{background:#fff;padding:11px 15px}
.gfc-kpi b{display:block;font-size:18px;font-family:'Archivo','League Spartan',sans-serif;font-weight:800}
.gfc-kpi span{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#4f6a5c;text-transform:uppercase;letter-spacing:.04em}
.gfc-sec{padding:11px 17px;border-top:1px solid #e2ebe4}
.gfc-sec h3{font-family:'JetBrains Mono',monospace;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:#4f6a5c;margin:0 0 7px;font-weight:500}
.gfc-row{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:3px 0}
.gfc-row b{font-weight:600;text-align:right}
.gfc-int{background:#fff6ec}
.gfc-note{font-size:11px;color:#5d7466;line-height:1.45;margin:0}
.gfc-acts{display:flex;gap:8px;padding:12px 17px 15px;flex-wrap:wrap}
.gfc-acts .gfc-btn{flex:1;text-align:center;padding:10px}
.gfc-poi{background:#0a1410;color:#7ee0a4;font-size:11px;font-weight:600;padding:3px 8px;border-radius:12px;white-space:nowrap;border:1px solid #7ee0a4;transform:translate(-50%,-50%);display:inline-block}
.gfc .leaflet-tooltip.gfc-lab{background:#0a1410;color:#fff;border:none;font-weight:600;font-size:11.5px}
.gfc-warn{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:1001;background:#0a1410;color:#7ee0a4;font-size:12.5px;padding:8px 14px;border-radius:999px;display:none;max-width:90%;text-align:center}
.gfc-warn.on{display:block}
.gfc-toggle{display:none}
.gfc-empty{padding:30px 16px;text-align:center;color:#4f6a5c;font-size:13px}
.gfc-modal{position:absolute;inset:0;background:rgba(10,20,16,.55);z-index:2000;display:none;align-items:center;justify-content:center;padding:16px}
.gfc-modal.on{display:flex}
.gfc-box{background:#fff;border-radius:16px;padding:18px;width:100%;max-width:420px;max-height:90%;overflow-y:auto}
.gfc-box h3{font-family:'Archivo','League Spartan',sans-serif;font-weight:800;font-size:19px;margin:0 0 10px}
.gfc-box label{display:block;font-family:'JetBrains Mono',monospace;font-size:10.5px;text-transform:uppercase;color:#4f6a5c;margin:10px 0 4px}
.gfc-box input,.gfc-box select,.gfc-box textarea{width:100%;font:inherit;font-size:14px;padding:9px 10px;border:1px solid #cfdcd2;border-radius:10px}
.gfc-box .gfc-acts{padding:14px 0 0}
@media (max-width:900px){
.gfc-side{position:absolute;left:0;right:0;bottom:0;width:auto;height:64%;transform:translateY(100%);transition:transform .25s;border-radius:16px 16px 0 0}
.gfc-side.open{transform:translateY(0)}
.gfc-toggle{display:block;position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:1001;background:#0a1410;color:#7ee0a4;border:none;font:inherit;font-weight:600;padding:11px 20px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.35)}
.gfc-selbar{left:10px;right:10px;top:10px;max-width:none;border-radius:16px}
.gfc-detail{left:10px;right:10px;width:auto;top:auto;bottom:10px;max-height:72%}
.gfc-warn{bottom:auto;top:64px;font-size:11.5px}
.gfc-brand{border-radius:16px 16px 0 0;padding:11px 15px}
.gfc-word{font-size:20px}
.gfc-sub{display:none}
}
.gfc-print{display:none}
@media print{
body.gfc-printing > *:not(#gfc-print){display:none !important}
body.gfc-printing{background:#fff !important}
body.gfc-printing .gfc-print{-webkit-print-color-adjust:exact;print-color-adjust:exact;display:block;background:#fff;color:#0a1410;font-family:'Inter Tight','Inter',sans-serif}
.gfc-print .pg{page-break-after:always;padding:6mm 4mm}
.gfc-print .pg:last-child{page-break-after:auto}
.gfc-print .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0a1410;padding-bottom:6px;margin-bottom:10px}
.gfc-print .hd .w{font-family:'Archivo','League Spartan',sans-serif;font-weight:900;font-size:22px;color:#1f7a4d}
.gfc-print .hd .r{font-size:11px;color:#4f6a5c;text-align:right}
.gfc-print h1{font-family:'Archivo','League Spartan',sans-serif;font-size:20px;margin:6px 0}
.gfc-print table{width:100%;border-collapse:collapse;font-size:11.5px}
.gfc-print th,.gfc-print td{border-bottom:1px solid #dfe8e1;padding:5px 6px;text-align:left}
.gfc-print th{background:#0a1410;color:#fff;font-weight:600}
.gfc-print .tr{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;break-inside:avoid}
.gfc-print .blk{border:1px solid #dfe8e1;border-radius:10px;padding:10px;break-inside:avoid}
.gfc-print .k{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px}
.gfc-print .k b{display:block;font-size:15px}
.gfc-print .nt{font-size:10px;color:#5d7466;margin-top:10px}
}
`

function injectCss () {
  if (document.getElementById('gfc-css')) return
  const st = document.createElement('style')
  st.id = 'gfc-css'
  st.textContent = CSS
  document.head.appendChild(st)
}

// Mini-plan SVG d'une parcelle (pour la fiche PDF)
function svgPlan (t, w, h) {
  const rings = t.g ? t.g : null
  if (!rings) return '<svg width="' + w + '" height="' + h + '"><text x="50%" y="50%" text-anchor="middle" font-size="12" fill="#4f6a5c">Contour non disponible</text></svg>'
  const pts = rings.flat()
  const k = Math.cos(t.lat * Math.PI / 180)
  const xs = pts.map(p => p[1] * k)
  const ys = pts.map(p => -p[0])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const sc = Math.min((w - 30) / (x1 - x0 + 1e-9), (h - 40) / (y1 - y0 + 1e-9))
  const ox = (w - (x1 - x0) * sc) / 2
  const oy = (h - 10 - (y1 - y0) * sc) / 2
  const col = FAMC[fam(t.z)].col
  const path = rings.map(r => 'M' + r.map(p => ((p[1] * k - x0) * sc + ox).toFixed(1) + ' ' + ((-p[0] - y0) * sc + oy).toFixed(1)).join(' L') + 'Z').join(' ')
  // échelle : mètres par pixel
  const mpp = 111320 / sc
  const nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find(v => v / mpp > 50)
  const bar = nice ? nice / mpp : 60
  const lab = nice ? (nice >= 1000 ? nice / 1000 + ' km' : nice + ' m') : ''
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="100%" height="100%" fill="#f4f9f5" rx="8"/>' +
    '<path d="' + path + '" fill="' + col + '" fill-opacity="0.55" stroke="#0a1410" stroke-width="1.5"' + (t._dec ? ' stroke-dasharray="5 4"' : '') + '/>' +
    '<g transform="translate(' + (w - 22) + ',22)"><path d="M0 -12 L6 6 L0 2 L-6 6 Z" fill="#0a1410"/><text y="18" text-anchor="middle" font-size="10">N</text></g>' +
    '<g transform="translate(12,' + (h - 12) + ')"><rect width="' + bar.toFixed(1) + '" height="4" fill="#0a1410"/><text y="-4" font-size="10">' + lab + '</text></g></svg>'
}

function mount (root, opt) {
  injectCss()
  const o = Object.assign({ mode: 'qualifie', terrains: [], actions: [], brand: true, sub: '', storeKey: null, intern: null, onReady: null }, opt)
  let MODE = o.mode
  let D = []
  const selLocal = new Set()
  if (o.storeKey) {
    try { JSON.parse(localStorage.getItem(o.storeKey) ?? '[]').forEach(k => selLocal.add(String(k))) } catch (e) { /* stockage indisponible */ }
  }
  const sel = o.sel ? o.sel : {
    has: k => selLocal.has(String(k)),
    toggle: k => {
      const s = String(k)
      if (selLocal.has(s)) selLocal.delete(s)
      else selLocal.add(s)
      if (o.storeKey) { try { localStorage.setItem(o.storeKey, JSON.stringify([...selLocal])) } catch (e) { /* ignore */ } }
    },
    clear: () => {
      selLocal.clear()
      if (o.storeKey) { try { localStorage.setItem(o.storeKey, '[]') } catch (e) { /* ignore */ } }
    }
  }

  root.innerHTML = '<div class="gfc">' +
    '<aside class="gfc-side">' +
    (o.brand ? '<div class="gfc-brand"><div class="gfc-word">GREENFIELD<sup>+</sup></div><div class="gfc-slogan">EXIGEZ PLUS</div><div class="gfc-sub"></div><span class="gfc-badge"></span></div>' : '') +
    '<div class="gfc-filters">' +
    '<label class="gfc-full">Recherche<input type="search" data-f="txt" placeholder="Référence, zone, zonage"></label>' +
    '<label class="gfc-full">Zone<select data-f="q"></select></label>' +
    '<label>Superficie<select data-f="s"><option value="">Toutes</option><option value="0-5000">Moins de 5 000 m²</option><option value="5000-20000">5 000 à 20 000 m²</option><option value="20000-100000">2 à 10 ha</option><option value="100000-">Plus de 10 ha</option></select></label>' +
    '<label>Budget<select data-f="b"><option value="">Tous</option><option value="0-10000000">Moins de 10 MDH</option><option value="10000000-30000000">10 à 30 MDH</option><option value="30000000-100000000">30 à 100 MDH</option><option value="100000000-">Plus de 100 MDH</option><option value="nd">Prix sur demande</option></select></label>' +
    '<label class="gfc-full">Zonage<div class="gfc-chips"></div></label>' +
    '<label class="gfc-full">Trier par<select data-f="o"><option value="s-">Superficie décroissante</option><option value="s+">Superficie croissante</option><option value="p+">Prix global croissant</option><option value="pm+">Prix au m² croissant</option><option value="id">Référence</option></select></label>' +
    '</div>' +
    '<div class="gfc-count"><span class="gfc-n"></span><span><button class="gfc-link" data-a="onlysel">Ma sélection</button> · <button class="gfc-link" data-a="reset">Réinitialiser</button></span></div>' +
    '<div class="gfc-list"></div></aside>' +
    '<div class="gfc-map"></div>' +
    '<div class="gfc-selbar"></div>' +
    '<div class="gfc-detail"></div>' +
    '<div class="gfc-warn">Le fond satellite ne se charge pas ici. Ouvrez la page dans Chrome, Safari ou Edge.</div>' +
    '<div class="gfc-modal"><div class="gfc-box"></div></div>' +
    '<button class="gfc-toggle">Liste des terrains</button>' +
    '</div>'
  const $ = s => root.querySelector(s)
  const $$ = s => root.querySelectorAll(s)
  let printEl = document.getElementById('gfc-print')
  if (!printEl) {
    printEl = document.createElement('div')
    printEl.id = 'gfc-print'
    printEl.className = 'gfc-print'
    document.body.appendChild(printEl)
  }

  const map = L.map($('.gfc-map'), { zoomControl: false }).setView([33.5, -7.68], 11)
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/'
  const sat = L.layerGroup([
    L.tileLayer(esri + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagerie © Esri, Maxar, Earthstar Geographics' }),
    L.tileLayer(esri + 'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.8 }),
    L.tileLayer(esri + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
  ]).addTo(map)
  const plan = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© OpenStreetMap © CARTO' })
  L.control.layers({ 'Satellite': sat, 'Plan': plan }, null, { position: 'bottomright' }).addTo(map)
  POIS.forEach(p => {
    L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: '<span class="gfc-poi">' + p.n + '</span>', iconSize: [0, 0] }), interactive: false }).addTo(map)
  })
  let tileOk = 0
  let tileErr = 0
  sat.eachLayer(l => {
    l.on('tileload', () => { tileOk++ })
    l.on('tileerror', () => {
      tileErr++
      if (tileErr > 6 && tileOk === 0) $('.gfc-warn').classList.add('on')
    })
  })

  const DEC = () => MODE === 'decouverte'
  const INT = () => MODE === 'interne'
  const surfTxt = t => DEC() ? (t.s ? 'environ ' + ha(t.s) : 'n.c.') : (t.s ? ha(t.s) : 'n.c.')
  const pglob = t => DEC() ? (t.pflo ? dec1(t.pflo) + ' à ' + dec1(t.pfhi) + ' MDH' : 'Sur demande') : (t.pf ? mdh(t.pf) : 'Sur demande')
  const pm2 = t => DEC() ? (t.pmlo ? fmt(t.pmlo) + ' à ' + fmt(t.pmhi) + ' DH/m²' : '') : (t.pm ? fmt(t.pm) + ' DH/m²' : '')
  const pfv = t => DEC() ? (t.pflo ? (t.pflo + t.pfhi) / 2 * 1e6 : 0) : (t.pf ? t.pf : 0)
  const pmv = t => DEC() ? (t.pmlo ? (t.pmlo + t.pmhi) / 2 : 0) : (t.pm ? t.pm : 0)

  let layers = {}
  let bounds = {}
  let shown = []
  let current = null
  let onlySel = false
  const active = new Set(FAM.map(f => f.k))

  function build () {
    Object.values(layers).forEach(l => map.removeLayer(l))
    layers = {}
    bounds = {}
    D.forEach(t => {
      const col = FAMC[fam(t.z)].col
      const shapes = []
      const warn = INT() && t.warn
      if (t.g && t.g.length) {
        const poly = L.polygon(t.g, { color: warn ? '#ff8c1a' : col, weight: 2.5, dashArray: DEC() ? '6 5' : (warn ? '7 5' : null), fillColor: col, fillOpacity: DEC() ? 0.25 : 0.38 })
        shapes.push(poly)
        bounds[t.key] = poly.getBounds()
      } else if (DEC()) {
        shapes.push(L.circle([t.lat, t.lng], { radius: 300, color: col, weight: 2, dashArray: '6 6', fillColor: col, fillOpacity: 0.2 }))
        bounds[t.key] = L.latLng(t.lat, t.lng).toBounds(600)
      } else {
        bounds[t.key] = L.latLng(t.lat, t.lng).toBounds(400)
      }
      shapes.push(L.circleMarker([t.lat, t.lng], { radius: 6, color: '#fff', weight: 1.5, fillColor: col, fillOpacity: 1 }))
      const lab = t.id + ' · ' + surfTxt(t)
      shapes.forEach(sh => {
        sh.bindTooltip(lab, { className: 'gfc-lab', sticky: true })
        sh.on('click', () => select(t.key))
      })
      layers[t.key] = L.featureGroup(shapes)
    })
    const quartiers = [...new Set(D.map(t => t.q).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
    const qs = $('[data-f="q"]')
    const prev = qs.value
    qs.innerHTML = '<option value="">Toutes les zones</option>' + quartiers.map(q => '<option>' + esc(q) + '</option>').join('')
    if (quartiers.includes(prev)) qs.value = prev
    const used = new Set(D.map(t => fam(t.z)))
    $('.gfc-chips').innerHTML = FAM.filter(f => used.has(f.k)).map(f => '<span class="gfc-chip' + (active.has(f.k) ? '' : ' off') + '" data-k="' + f.k + '"><i style="background:' + f.col + '"></i>' + f.l + '</span>').join('')
    $$('.gfc-chip').forEach(ch => ch.addEventListener('click', () => {
      const k = ch.dataset.k
      if (active.has(k)) active.delete(k)
      else active.add(k)
      ch.classList.toggle('off', !active.has(k))
      render()
    }))
    if (o.brand) {
      $('.gfc-sub').textContent = o.sub
      const b = $('.gfc-badge')
      b.textContent = 'Version ' + MODES[MODE].label.toLowerCase() + (INT() ? ', ne pas diffuser' : '')
      b.classList.toggle('red', INT())
    }
  }

  const inRange = (v, r) => {
    if (!r) return true
    const [a, b] = r.split('-').map(Number)
    return v >= a && (b ? v < b : true)
  }

  function render () {
    const f = k => $('[data-f="' + k + '"]').value
    const txt = f('txt').trim().toLowerCase()
    const q = f('q')
    const s = f('s')
    const b = f('b')
    shown = D.filter(t => active.has(fam(t.z)) &&
      (q ? t.q === q : true) &&
      (onlySel ? sel.has(t.key) : true) &&
      (txt ? [t.id, t.q, t.z, INT() ? t.tf : ''].join(' ').toLowerCase().includes(txt) : true) &&
      inRange(t.s ? t.s : 0, s) &&
      (b ? (b === 'nd' ? !pfv(t) : (pfv(t) ? inRange(pfv(t), b) : false)) : true))
    const ord = f('o')
    const big = 1e15
    if (ord === 's-') shown.sort((x, y) => (y.s ? y.s : 0) - (x.s ? x.s : 0))
    if (ord === 's+') shown.sort((x, y) => (x.s ? x.s : big) - (y.s ? y.s : big))
    if (ord === 'p+') shown.sort((x, y) => (pfv(x) ? pfv(x) : big) - (pfv(y) ? pfv(y) : big))
    if (ord === 'pm+') shown.sort((x, y) => (pmv(x) ? pmv(x) : big) - (pmv(y) ? pmv(y) : big))
    if (ord === 'id') shown.sort((x, y) => String(x.id).localeCompare(String(y.id)))
    Object.values(layers).forEach(l => map.removeLayer(l))
    shown.forEach(t => layers[t.key].addTo(map))
    $('.gfc-n').textContent = shown.length + ' terrain' + (shown.length > 1 ? 's' : '') + ' sur ' + D.length
    $('[data-a="onlysel"]').textContent = onlySel ? 'Tous les terrains' : 'Ma sélection'
    $('.gfc-list').innerHTML = shown.length ? shown.map(t => {
      const on = sel.has(t.key)
      const tags = (INT() && t.warn ? '<span class="gfc-tag w">à vérifier</span>' : '') + (INT() && t.statut && t.statut !== 'Disponible' ? '<span class="gfc-tag">' + esc(t.statut) + '</span>' : '')
      const meta = esc(t.id) + ' · ' + surfTxt(t) + (t.z ? ' · ' + esc(t.z) : '') + (INT() && t.tf ? ' · TF ' + esc(t.tf) : '')
      const p2 = pm2(t)
      return '<div class="gfc-card' + (current === t.key ? ' sel' : '') + '" data-k="' + esc(t.key) + '">' +
        '<button class="gfc-ck' + (on ? ' on' : '') + '" data-ck="' + esc(t.key) + '" title="Ajouter à ma sélection">' + (on ? '✓' : '') + '</button>' +
        '<div><div class="t"><span class="gfc-dot" style="background:' + FAMC[fam(t.z)].col + '"></span>' + esc(t.q ? t.q : 'Sans zone') + tags + '</div><div class="m">' + meta + '</div></div>' +
        '<div class="p">' + pglob(t) + (p2 ? '<small>' + p2 + '</small>' : '') + '</div></div>'
    }).join('') : '<div class="gfc-empty">' + (onlySel ? 'Aucun terrain dans votre sélection. Cochez des terrains dans la liste ou sur leur fiche.' : 'Aucun terrain ne correspond aux filtres.') + '</div>'
    $$('.gfc-card').forEach(c => c.addEventListener('click', e => {
      if (e.target.closest('.gfc-ck')) return
      select(c.dataset.k)
    }))
    $$('.gfc-ck').forEach(c => c.addEventListener('click', e => {
      e.stopPropagation()
      toggleSel(c.dataset.ck)
    }))
    selbar()
  }

  function selected () { return D.filter(t => sel.has(t.key)) }
  async function toggleSel (k) {
    await sel.toggle(k)
    render()
    if (current === k) select(k, true, true)
  }

  function selbar () {
    const n = selected().length
    const acts = o.actions.filter(a => a.always ? true : n > 0)
    $('.gfc-selbar').innerHTML = '<span><b>' + n + '</b> terrain' + (n > 1 ? 's' : '') + ' sélectionné' + (n > 1 ? 's' : '') + '</span>' +
      (n ? '<button class="gfc-btn gfc-b2" data-a="pdf">Fiche PDF</button>' : '') +
      acts.map((a, i) => '<button class="gfc-btn ' + (a.cls ? a.cls : 'gfc-b1') + '" data-act="' + i + '">' + a.label + '</button>').join('') +
      (n ? '<button class="gfc-btn gfc-b2" data-a="clear">Vider</button>' : '')
    const pdf = $('[data-a="pdf"]')
    if (pdf) pdf.addEventListener('click', () => printSel())
    const clr = $('[data-a="clear"]')
    if (clr) clr.addEventListener('click', async () => {
      const keys = selected().map(t => t.key)
      if (sel.clear) await sel.clear()
      else for (const k of keys) await sel.toggle(k)
      render()
    })
    $$('[data-act]').forEach(b => b.addEventListener('click', () => acts[Number(b.dataset.act)].onClick(selected(), api)))
  }

  function select (key, instant, keepView) {
    const t = D.find(x => x.key === key)
    if (!t) return
    current = key
    const c = FAMC[fam(t.z)]
    const dists = POIS.map(p => [p.n, km(t.lat, t.lng, p.lat, p.lng)]).sort((a, b) => a[1] - b[1])
      .map(([n, v]) => '<div class="gfc-row"><span>' + n + '</span><b>' + (DEC() ? 'environ ' + Math.round(v) : dec1(v)) + ' km</b></div>').join('')
    const kp = DEC()
      ? [['Superficie', surfTxt(t)], ['Zonage', esc(t.z ? t.z : 'n.c.')], ['Prix au m²', t.pmlo ? fmt(t.pmlo) + ' à ' + fmt(t.pmhi) + ' DH' : 'Sur demande'], ['Prix global', pglob(t)]]
      : [['Superficie', t.s ? fmt(t.s) + ' m²' : 'n.c.'], ['Soit', t.s ? ha(t.s) : 'n.c.'], ['Prix au m²', t.pm ? fmt(t.pm) + ' DH' : 'Sur demande'], ['Prix global', pglob(t)]]
    let intern = ''
    if (INT() && o.intern) {
      const rows = o.intern(t).filter(r => r[1])
      intern = '<div class="gfc-sec gfc-int"><h3>Données internes</h3>' + rows.map(r => '<div class="gfc-row"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>').join('') + '</div>'
    }
    const on = sel.has(t.key)
    const gm = INT() && t.gm ? t.gm : 'https://www.google.com/maps/search/?api=1&query=' + t.lat + ',' + t.lng
    $('.gfc-detail').innerHTML = '<div class="gfc-dh"><button class="x" data-a="close" aria-label="Fermer">×</button><div class="id">' + esc(t.id) + '</div><h2>' + esc(t.q ? t.q : 'Terrain') + '</h2><span class="gfc-zone"><i style="background:' + c.col + '"></i>' + (t.z ? 'Zonage ' + esc(t.z) + ' · ' : '') + c.l + '</span></div>' +
      '<div class="gfc-kpis">' + kp.map(k => '<div class="gfc-kpi"><span>' + k[0] + '</span><b>' + k[1] + '</b></div>').join('') + '</div>' +
      (t.pt && !DEC() ? '<div class="gfc-sec"><p class="gfc-note">Contour non disponible : position d\'après le lien Google Maps du terrain.</p></div>' : '') +
      '<div class="gfc-sec"><h3>Distances à vol d\'oiseau</h3>' + dists + '</div>' + intern +
      '<div class="gfc-sec"><p class="gfc-note">' + MODES[MODE].note + '</p></div>' +
      '<div class="gfc-acts"><button class="gfc-btn ' + (on ? 'gfc-b3' : 'gfc-b4') + '" data-a="tsel">' + (on ? '✓ Dans ma sélection' : 'Ajouter à ma sélection') + '</button>' +
      (DEC() ? '' : '<a class="gfc-btn gfc-b3" target="_blank" rel="noopener" href="' + escUrl(gm) + '">Google Maps</a>') + '</div>'
    $('.gfc-detail').classList.add('on')
    $('[data-a="close"]').addEventListener('click', closeDetail)
    $('[data-a="tsel"]').addEventListener('click', () => toggleSel(t.key))
    if (!keepView) map.fitBounds(bounds[key], { maxZoom: DEC() ? 15 : 17, paddingTopLeft: [40, 70], paddingBottomRight: [window.innerWidth > 900 ? 380 : 40, window.innerWidth > 900 ? 40 : 260], animate: !instant })
    $$('.gfc-card').forEach(el => el.classList.toggle('sel', el.dataset.k === key))
    $('.gfc-side').classList.remove('open')
    $('.gfc-toggle').textContent = 'Liste des terrains'
  }
  function closeDetail () {
    $('.gfc-detail').classList.remove('on')
    current = null
    $$('.gfc-card').forEach(el => el.classList.remove('sel'))
  }

  function printSel () {
    const list = selected()
    if (!list.length) return
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const head = '<div class="hd"><div class="w">GREENFIELD+</div><div class="r">Sélection de terrains · ' + MODES[MODE].label + '<br>' + today + (o.printSub ? '<br>' + esc(o.printSub) : '') + '</div></div>'
    const tot = list.reduce((a, t) => a + (t.s ? t.s : 0), 0)
    const rows = list.map(t => '<tr><td>' + esc(t.id) + '</td><td>' + esc(t.q) + '</td><td>' + esc(t.z) + '</td><td>' + surfTxt(t) + '</td><td>' + (pm2(t) ? pm2(t) : 'Sur demande') + '</td><td>' + pglob(t) + '</td>' + (INT() ? '<td>' + esc(t.tf) + '</td>' : '') + '</tr>').join('')
    const sum = '<div class="pg">' + head + '<h1>' + list.length + ' terrain' + (list.length > 1 ? 's' : '') + ' sélectionné' + (list.length > 1 ? 's' : '') + '</h1>' +
      '<p style="font-size:12px;color:#4f6a5c">Superficie cumulée : ' + (DEC() ? 'environ ' : '') + ha(tot) + '</p>' +
      '<table><tr><th>Réf.</th><th>Zone</th><th>Zonage</th><th>Superficie</th><th>Prix au m²</th><th>Prix global</th>' + (INT() ? '<th>TF</th>' : '') + '</tr>' + rows + '</table>' +
      '<p class="nt">' + MODES[MODE].note + '</p></div>'
    const fiches = []
    for (let i = 0; i < list.length; i += 2) {
      const pair = list.slice(i, i + 2).map(t => {
        const d = POIS.map(p => [p.n, km(t.lat, t.lng, p.lat, p.lng)]).sort((a, b) => a[1] - b[1]).slice(0, 4)
        return '<div class="blk"><div style="font-family:monospace;font-size:11px;color:#1f7a4d">' + esc(t.id) + '</div><h1>' + esc(t.q) + '</h1>' +
          svgPlan(Object.assign({ _dec: DEC() }, t), 330, 230) +
          '<div class="k" style="margin-top:8px"><div>Superficie<b>' + surfTxt(t) + '</b></div><div>Zonage<b>' + esc(t.z ? t.z : 'n.c.') + '</b></div><div>Prix au m²<b>' + (pm2(t) ? pm2(t) : 'Sur demande') + '</b></div><div>Prix global<b>' + pglob(t) + '</b></div></div>' +
          '<div style="font-size:11.5px;margin-top:8px">' + d.map(x => x[0] + ' : ' + (DEC() ? 'environ ' + Math.round(x[1]) : dec1(x[1])) + ' km').join('<br>') + '</div>' +
          (INT() && o.intern ? '<div style="font-size:11px;margin-top:8px;background:#fff6ec;padding:6px;border-radius:6px">' + o.intern(t).filter(r => r[1]).map(r => r[0] + ' : ' + esc(r[1])).join('<br>') + '</div>' : '') + '</div>'
      }).join('')
      fiches.push('<div class="pg">' + head + '<div class="tr">' + pair + '</div><p class="nt">' + MODES[MODE].note + '</p></div>')
    }
    printEl.innerHTML = sum + fiches.join('')
    document.body.classList.add('gfc-printing')
    const done = () => {
      document.body.classList.remove('gfc-printing')
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    setTimeout(() => window.print(), 50)
  }

  // Filtres et boutons
  const FKEYS = ['q', 's', 'b', 'o']
  FKEYS.forEach(k => $('[data-f="' + k + '"]').addEventListener('change', () => render()))
  $('[data-f="txt"]').addEventListener('input', () => render())
  $('[data-a="reset"]').addEventListener('click', () => {
    const RKEYS = ['txt', 'q', 's', 'b']
    RKEYS.forEach(k => { $('[data-f="' + k + '"]').value = '' })
    FAM.forEach(f => active.add(f.k))
    onlySel = false
    build()
    render()
  })
  $('[data-a="onlysel"]').addEventListener('click', () => {
    onlySel = !onlySel
    render()
  })
  $('.gfc-toggle').addEventListener('click', () => {
    const open = $('.gfc-side').classList.toggle('open')
    $('.gfc-toggle').textContent = open ? 'Voir la carte' : 'Liste des terrains'
  })

  function modal (html, wire) {
    $('.gfc-box').innerHTML = html
    $('.gfc-modal').classList.add('on')
    const close = () => $('.gfc-modal').classList.remove('on')
    root.querySelectorAll('[data-m="close"]').forEach(b => b.addEventListener('click', close))
    if (wire) wire($('.gfc-box'), close)
  }

  function setData (mode, terrains, fit) {
    MODE = mode
    D = terrains
    closeDetail()
    build()
    render()
    if (fit && D.length) {
      const withShape = D.filter(t => t.g && t.g.length)
      const pts = (withShape.length >= 3 ? withShape : D).map(t => [t.lat, t.lng])
      map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], animate: false })
    }
  }

  const api = { setData, render, selected, map, modal, select, printSel, versDecouverte, get mode () { return MODE } }
  setData(MODE, o.terrains, true)
  setTimeout(() => map.invalidateSize(), 100)
  return api
}

window.GFCarte = { mount, versDecouverte, fam, FAM, POIS }
})()
