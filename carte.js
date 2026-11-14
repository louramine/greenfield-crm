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
.gfc-logo{display:block;height:34px;width:auto;max-width:100%}
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
.gfc-count{padding:8px 14px;font-size:12px;color:#4f6a5c;display:flex;align-items:center;gap:10px}
.gfc-count .gfc-n{flex:1;white-space:nowrap}
.gfc-count .gfc-link{white-space:nowrap}
.gfc-count select{font:inherit;font-size:12px;color:#1f7a4d;background:transparent;border:none;padding:2px 0;cursor:pointer;max-width:150px}
.gfc-fbar{position:absolute;left:386px;right:244px;top:14px;z-index:950;display:flex;gap:8px;align-items:center;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:6px;pointer-events:none}
.gfc-fbar::-webkit-scrollbar{display:none}
.gfc-fbar>*{pointer-events:auto}
.gfc-srch{display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;flex:1 1 200px;min-width:130px;max-width:300px;background:#0a1410;border:1px solid rgba(126,224,164,.35);border-radius:10px;color:#9cb3a3;box-shadow:0 2px 10px rgba(0,0,0,.3);cursor:text}
.gfc-srch svg{flex:none}
.gfc-srch input{flex:1;min-width:0;font:inherit;font-size:14px;color:#e8f2ea;background:none;border:none;outline:none;padding:0}
.gfc-srch input::placeholder{color:#9cb3a3}
.gfc-fp,.gfc-fr,.gfc-vw{flex:none}
.gfc-fp,.gfc-fr{font:inherit;font-size:14px;font-weight:600;height:40px;padding:0 13px;border-radius:10px;border:1px solid rgba(126,224,164,.35);background:#0a1410;color:#e8f2ea;cursor:pointer;display:flex;align-items:center;gap:7px;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.3);max-width:220px;overflow:hidden;text-overflow:ellipsis}
.gfc-fp::after{content:'';flex:none;width:6px;height:6px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-2px) rotate(45deg)}
.gfc-fp.open::after{transform:translateY(1px) rotate(-135deg)}
.gfc-fp.on{background:#7ee0a4;color:#0a1410;border-color:#7ee0a4}
.gfc-fr{color:#9cb3a3}
.gfc-fr.on{color:#e8f2ea}
.gfc-vw{position:absolute;right:14px;top:14px;z-index:950;display:flex;height:40px;padding:3px;border-radius:10px;background:#0a1410;border:1px solid rgba(126,224,164,.35);box-shadow:0 2px 10px rgba(0,0,0,.3)}
.gfc-vw button{font:inherit;font-size:13.5px;font-weight:600;border:none;background:none;color:#9cb3a3;padding:0 12px;border-radius:7px;cursor:pointer;white-space:nowrap}
.gfc-vw button.on{background:#7ee0a4;color:#0a1410}
.gfc.v-map .gfc-side{display:none}
.gfc.v-map .gfc-fbar,.gfc.v-map .gfc-selbar{left:14px}
.gfc.v-map .gfc-selbar{max-width:calc(100% - 100px)}
.gfc.v-list .gfc-map{display:none}
.gfc.v-list .gfc-side{width:100%;padding-top:66px;background:#0e1f17}
.gfc.v-list .gfc-brand{display:none}
.gfc.v-list .gfc-fbar{left:14px}
.gfc.v-list .gfc-count{color:#c8e6d3;padding:4px 18px 10px}
.gfc.v-list .gfc-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:10px;align-content:start;padding:0 14px 76px}
.gfc.v-list .gfc-card{margin:0}
.gfc.v-list .gfc-selbar{left:14px}
.gfc-pop{position:absolute;z-index:1300;width:330px;background:#fff;color:#0a1410;border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.38);display:none;flex-direction:column;overflow:hidden}
.gfc-pop.on{display:flex}
.gfc-pb{padding:14px;overflow-y:auto;flex:1;min-height:0}
.gfc-pf{display:flex;gap:8px;padding:10px 14px;border-top:1px solid #e2ebe4;flex:none}
.gfc-pf .gfc-btn{flex:1;padding:10px;font-size:14px}
.gfc-ph{font-family:'JetBrains Mono',monospace;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#4f6a5c;margin:2px 0 8px}
.gfc-pre{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.gfc-pre button{font:inherit;font-size:13.5px;border:1px solid #cfdcd2;background:#fff;color:#0a1410;border-radius:999px;padding:7px 12px;cursor:pointer}
.gfc-pre button.on{background:#0a1410;color:#7ee0a4;border-color:#0a1410}
.gfc-rg{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gfc-rg label{font-size:12px;color:#4f6a5c;display:flex;flex-direction:column;gap:4px}
.gfc-rg input,.gfc-pq{font:inherit;font-size:14px;color:#0a1410;padding:9px 10px;border:1px solid #cfdcd2;border-radius:10px;width:100%;background:#fff}
.gfc-pq{margin-bottom:8px}
.gfc-opts{display:flex;flex-direction:column}
.gfc-opt{display:flex;align-items:center;gap:10px;padding:8px 6px;font-size:14px;border-radius:8px;cursor:pointer}
.gfc-opt:hover{background:#f0f6f2}
.gfc-opt input{width:18px;height:18px;margin:0;accent-color:#1f7a4d;flex:none}
.gfc-opt i{width:11px;height:11px;border-radius:50%;flex:none;box-shadow:0 0 0 1px rgba(0,0,0,.2)}
.gfc-opt span{flex:1}
.gfc-opt small{color:#4f6a5c;font-size:12px}
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
.gfc-selbar{position:absolute;left:386px;bottom:14px;z-index:900;background:#0a1410;color:#e8f2ea;border:1px solid rgba(126,224,164,.35);border-radius:999px;padding:6px 6px 6px 14px;display:flex;align-items:center;gap:8px;font-size:13px;box-shadow:0 4px 18px rgba(0,0,0,.35);max-width:calc(100% - 470px);flex-wrap:wrap}
.gfc-selbar b{color:#7ee0a4}
.gfc-btn{font:inherit;font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:999px;border:none;cursor:pointer;text-decoration:none;white-space:nowrap}
.gfc-b1{background:#7ee0a4;color:#0a1410}
.gfc-b2{background:rgba(126,224,164,.15);color:#e8f2ea;border:1px solid rgba(126,224,164,.35)}
.gfc-b3{background:#e6f6ee;color:#0a1410}
.gfc-b4{background:#0a1410;color:#7ee0a4}
.gfc-detail{position:absolute;top:66px;right:14px;width:350px;max-height:calc(100% - 76px);overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.3);z-index:1000;display:none}
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
.gfc-blk{font-size:13px;padding:6px 0 2px;border-top:1px solid #f0dcc4;margin-top:5px}
.gfc-blk p{margin:3px 0 0;font-weight:600;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}
.gfc-note{font-size:11px;color:#5d7466;line-height:1.45;margin:0}
.gfc-acts{display:flex;gap:8px;padding:12px 17px 15px;flex-wrap:wrap}
.gfc-acts .gfc-btn{flex:1;text-align:center;padding:10px}
.gfc-poi{background:#0a1410;color:#7ee0a4;font-size:11px;font-weight:600;padding:3px 8px;border-radius:12px;white-space:nowrap;border:1px solid #7ee0a4;transform:translate(-50%,-50%);display:inline-block}
.gfc .leaflet-tooltip.gfc-lab{background:#0a1410;color:#fff;border:none;font-weight:600;font-size:11.5px}
.gfc-warn{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);z-index:450;pointer-events:none;background:#0a1410;color:#7ee0a4;font-size:12.5px;padding:8px 14px;border-radius:999px;display:none;max-width:90%;text-align:center}
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
.gfc-sh,.gfc-mtop,.gfc-see,.gfc-bbar{display:none}
.gfc-zlo .gfc-poi{font-size:0;padding:4px;border-width:2px;line-height:0}
@media (max-width:900px){
.gfc{font-size:15px}
.gfc-side{z-index:1100;position:absolute;left:0;right:0;bottom:0;width:auto;height:52%;border-radius:18px 18px 0 0;box-shadow:0 -6px 24px rgba(0,0,0,.35);transition:height .22s ease;padding-bottom:env(safe-area-inset-bottom)}
.gfc-side.peek{height:0;padding-bottom:0;box-shadow:none;overflow:hidden}
.gfc-x{font-size:20px;line-height:1;padding:6px 12px}
.gfc-bbar{display:flex;position:absolute;left:8px;right:8px;bottom:10px;z-index:1050;gap:6px;align-items:center;transition:bottom .22s ease}
.gfc[data-st="half"] .gfc-bbar{bottom:calc(52% + 8px)}
.gfc[data-st="full"] .gfc-bbar{display:none}
.gfc.dopen .gfc-bbar{display:none}
.gfc-bbar .gfc-srch{flex:1 1 auto;width:auto;min-width:44px;max-width:none;height:44px;padding:0 12px}
.gfc-bbar.sopen .gfc-srch{flex:1 1 100%}
.gfc-bbar.sopen > :not(.gfc-srch){display:none !important}
.gfc-bbar .gfc-selbar{position:static;flex:none;max-width:none;height:44px;padding:0 4px 0 12px;gap:6px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,.35)}
.gfc-bbar .gfc-selbar > span{flex:none}
.gfc-bbar .gfc-selbar .gfc-btn{padding:8px 11px}
.gfc-lbtn{flex:none;display:flex;align-items:center;gap:7px;height:44px;padding:0 13px;font:inherit;font-size:14.5px;font-weight:700;border:none;border-radius:12px;background:#7ee0a4;color:#0a1410;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.35)}
.gfc-side.full{height:calc(100% - 64px)}
.gfc-side.drag{transition:none}
.gfc.dopen .gfc-side{display:none}
.gfc-brand{display:none}
.gfc-sh{display:block;padding:6px 14px 8px;touch-action:none;cursor:grab;flex:none;border-bottom:1px solid #e2ebe4}
.gfc-grip{width:44px;height:5px;border-radius:3px;background:#b9cbbf;margin:2px auto 8px}
.gfc-shr{display:flex;align-items:center;gap:8px}
.gfc-n2{flex:1;font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gfc-pill{font:inherit;font-size:13.5px;font-weight:600;border:1px solid #cfdcd2;background:#fff;color:#0a1410;border-radius:999px;padding:8px 13px;cursor:pointer;white-space:nowrap}
.gfc-pill.on{background:#0a1410;color:#7ee0a4;border-color:#0a1410}
.gfc-pill b{display:inline-block;min-width:18px;margin-left:5px;padding:0 5px;border-radius:9px;background:#7ee0a4;color:#0a1410;font-size:11.5px;line-height:18px;text-align:center}
.gfc-box input,.gfc-box select,.gfc-box textarea{font-size:16px;padding:10px}
.gfc-count{display:flex;padding:8px 14px 2px}
.gfc-count .gfc-link{display:none}
.gfc-count select{font-size:16px;max-width:none}
.gfc-fbar{left:0;right:0;top:8px;padding:0 8px 4px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;gap:6px;-webkit-overflow-scrolling:touch}
.gfc-fbar::-webkit-scrollbar{display:none}
.gfc.hasbrand .gfc-fbar{top:calc(52px + env(safe-area-inset-top))}
.gfc-srch{flex:none;min-width:0;width:150px;height:42px}
.gfc-srch input{font-size:16px}
.gfc-fp,.gfc-fr{flex:none;height:42px;font-size:14.5px;max-width:200px}
.gfc-pop{left:8px;right:8px;width:auto}
.gfc-vw{display:none}
.gfc.v-map .gfc-side,.gfc.v-list .gfc-side{display:flex;width:auto;padding-top:0;background:#f4f9f5}
.gfc.v-list .gfc-map{display:block}
.gfc.v-list .gfc-list{display:block;padding:8px 10px 18px}
.gfc.v-list .gfc-card{margin-bottom:8px}
.gfc.v-list .gfc-count{color:#4f6a5c;padding:8px 14px 2px}
.gfc.v-map .gfc-fbar,.gfc.v-list .gfc-fbar{left:0}
.gfc.v-map .gfc-selbar,.gfc.v-list .gfc-selbar{left:8px}
.gfc-pre button{font-size:15px;padding:9px 13px}
.gfc-rg input,.gfc-pq{font-size:16px;padding:11px}
.gfc-opt{font-size:15.5px;padding:11px 6px}
.gfc-opt input{width:22px;height:22px}
.gfc-pf .gfc-btn{padding:13px}
.gfc-list{padding:8px 10px 18px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.gfc-card{grid-template-columns:34px 1fr auto;padding:12px;gap:10px}
.gfc-card .t{font-size:15px}
.gfc-card .m{font-size:12.5px}
.gfc-card .p{font-size:14px}
.gfc-ck{width:30px;height:30px;border-radius:9px;font-size:16px}
.gfc-mtop{display:flex;position:absolute;left:0;right:0;top:0;z-index:950;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top)) 12px 8px;background:linear-gradient(#0a1410,rgba(10,20,16,.88));color:#7ee0a4}
.gfc-mtop img{height:20px;width:auto}
.gfc-mtop .w{font-family:'Archivo','League Spartan',sans-serif;font-weight:900;font-size:18px}
.gfc-mtop span{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.05em;text-transform:uppercase;border:1px solid #7ee0a4;border-radius:999px;padding:2px 8px;white-space:nowrap}
.gfc-mtop span.red{border-color:#ffb36b;color:#ffb36b}
.gfc-selbar{z-index:1050;left:8px;right:8px;top:58px;bottom:auto;max-width:none;border-radius:16px;padding:6px 6px 6px 12px;flex-wrap:nowrap;gap:6px;font-size:13px}
.gfc.hasbrand .gfc-selbar{top:calc(102px + env(safe-area-inset-top))}
.gfc-selbar > span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gfc-selbar .gfc-btn{padding:8px 11px;font-size:13px}
.gfc-selbar .gfc-lg{display:none}
.gfc-detail{z-index:1200;left:0;right:0;width:auto;top:auto;bottom:0;max-height:52%;border-radius:18px 18px 0 0;padding-bottom:env(safe-area-inset-bottom)}
.gfc-dh{border-radius:18px 18px 0 0;padding:12px 16px 13px}
.gfc-dh::before{content:'';display:block;width:44px;height:5px;border-radius:3px;background:rgba(255,255,255,.35);margin:0 auto 8px}
.gfc-dh h2{font-size:20px}
.gfc-dh .x{top:14px;right:8px;width:40px;height:40px;font-size:26px}
.gfc-acts .gfc-btn{padding:13px 10px;font-size:14px}
.gfc-warn{bottom:auto;top:60px;font-size:11.5px}
.gfc.hasbrand .gfc-warn{top:calc(104px + env(safe-area-inset-top))}
.gfc-modal{align-items:flex-end;padding:0;z-index:2000}
.gfc-box{max-width:none;border-radius:18px 18px 0 0;max-height:92%;padding:18px 16px calc(18px + env(safe-area-inset-bottom))}
.gfc .leaflet-control-layers{margin-top:60px}
.gfc .leaflet-control-attribution{font-size:9px;max-width:70vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gfc.hasbrand .leaflet-control-layers{margin-top:108px}
.gfc-toggle{display:none}
}
.gfc .leaflet-control-layers-toggle,.gfc.leaflet-touch .leaflet-control-layers-toggle,.gfc .leaflet-touch .leaflet-control-layers-toggle{background-image:none !important;width:auto !important;height:auto !important;padding:7px 11px;font:600 12px 'Inter Tight','Inter',sans-serif;color:#0a1410;text-decoration:none;line-height:1.2;white-space:nowrap;display:block}
.gfc .leaflet-control-layers-toggle::after{content:'Fond de carte'}
.gfc .leaflet-control-layers-expanded .leaflet-control-layers-toggle{display:none}
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
  const o = Object.assign({ mode: 'qualifie', terrains: [], actions: [], brand: true, sub: '', storeKey: null, intern: null, onReady: null, logo: null, printLogo: null, openCrm: null }, opt)
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
    '<div class="gfc-mtop"></div>' +
    '<aside class="gfc-side">' +
    (o.brand ? '<div class="gfc-brand">' + (o.logo ? '<img class="gfc-logo" src="' + escUrl(o.logo) + '" alt="Greenfield"><div class="gfc-slogan">ATLAS · EXIGEZ PLUS</div>' : '<div class="gfc-word">GREENFIELD<sup>+</sup></div><div class="gfc-slogan">ATLAS · EXIGEZ PLUS</div>') + '<div class="gfc-sub"></div><span class="gfc-badge"></span></div>' : '') +
    '<div class="gfc-sh"><div class="gfc-grip"></div><div class="gfc-shr"><span class="gfc-n2"></span><button class="gfc-pill" data-a="onlysel2">Sélection</button><button class="gfc-pill gfc-x" data-a="closelist" aria-label="Fermer la liste">×</button></div></div>' +
    '<div class="gfc-count"><span class="gfc-n"></span><button class="gfc-link" data-a="onlysel">Ma sélection</button><select data-f="o" aria-label="Trier par"><option value="rec">Tri : recommandé</option><option value="s-">Superficie décroissante</option><option value="s+">Superficie croissante</option><option value="p+">Prix global croissant</option><option value="pm+">Prix au m² croissant</option><option value="id">Référence</option></select></div>' +
    '<div class="gfc-list"></div></aside>' +
    '<div class="gfc-map"></div>' +
    '<div class="gfc-fbar"><label class="gfc-srch"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input type="search" data-f="txt" placeholder="Rechercher" aria-label="Rechercher une référence, une zone, un zonage"></label>' +
    '<button class="gfc-fp" data-p="p">Prix</button><button class="gfc-fp" data-p="s">Superficie</button><button class="gfc-fp" data-p="q">Zones</button><button class="gfc-fp" data-p="z">Zonage</button>' +
    '<button class="gfc-fr" data-a="reset"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>Réinitialiser</button></div>' +
    '<div class="gfc-vw" role="group" aria-label="Affichage"><button data-v="map">Carte</button><button data-v="split">Les deux</button><button data-v="list">Liste</button></div>' +
    '<div class="gfc-pop"></div>' +
    '<div class="gfc-bbar"><button class="gfc-lbtn" data-a="list" aria-label="Ouvrir la liste des terrains"></button></div>' +
    '<div class="gfc-selbar"></div>' +
    '<div class="gfc-detail"></div>' +
    '<div class="gfc-warn">Le fond satellite ne se charge pas ici. Ouvrez la page dans Chrome, Safari ou Edge.</div>' +
    '<div class="gfc-modal"><div class="gfc-box"></div></div>' +
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

  const mob = () => window.matchMedia('(max-width:900px)').matches
  const touch = window.matchMedia('(hover: none)').matches
  if (o.brand) $('.gfc').classList.add('hasbrand')
  const map = L.map($('.gfc-map'), { zoomControl: false, tap: true }).setView([33.5, -7.68], 11)
  if (!mob()) L.control.zoom({ position: 'bottomright' }).addTo(map)
  const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/'
  const sat = L.layerGroup([
    L.tileLayer(esri + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagerie © Esri, Maxar, Earthstar Geographics' }),
    L.tileLayer(esri + 'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.8 }),
    L.tileLayer(esri + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
  ]).addTo(map)
  const plan = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© OpenStreetMap © CARTO' })
  L.control.layers({ 'Satellite': sat, 'Plan': plan }, null, { position: mob() ? 'topright' : 'bottomright' }).addTo(map)
  if (mob()) { map.attributionControl.setPosition('topright'); map.attributionControl.setPrefix(false) }
  const zcls = () => $('.gfc').classList.toggle('gfc-zlo', map.getZoom() < 12)
  map.on('zoomend', zcls)
  POIS.forEach(p => {
    L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: '<span class="gfc-poi">' + p.n + '</span>', iconSize: [0, 0] }), interactive: false }).addTo(map)
  })
  let tileOk = 0
  let tileErr = 0
  sat.eachLayer(l => {
    l.on('tileload', () => { tileOk++ })
    l.on('tileerror', () => {
      tileErr++
      if (tileErr > 6 && tileOk === 0 && !$('.gfc-warn').dataset.shown) {
        $('.gfc-warn').dataset.shown = '1'
        $('.gfc-warn').classList.add('on')
        setTimeout(() => $('.gfc-warn').classList.remove('on'), 9000)
      }
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
  // Filtres : vides au départ (tout est affiché). Prix en MDH, superficie en ha.
  const F = { p: [null, null], pnd: false, s: [null, null], q: new Set(), z: new Set() }

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
        if (!touch) sh.bindTooltip(lab, { className: 'gfc-lab', sticky: true })
        sh.on('click', () => select(t.key))
      })
      layers[t.key] = L.featureGroup(shapes)
    })
    const qset = new Set(D.map(t => t.q))
    F.q.forEach(q => { if (!qset.has(q)) F.q.delete(q) })
    if (o.brand) {
      $('.gfc-sub').textContent = o.sub
      const b = $('.gfc-badge')
      b.textContent = 'Version ' + MODES[MODE].label.toLowerCase() + (INT() ? ', ne pas diffuser' : '')
      b.classList.toggle('red', INT())
      $('.gfc-mtop').innerHTML = (o.logo ? '<img src="' + escUrl(o.logo) + '" alt="Greenfield">' : '<span class="w">GREENFIELD+</span>') + '<span class="' + (INT() ? 'red' : '') + '">' + MODES[MODE].label + '</span>'
    }
  }

  const between = (v, r) => (r[0] == null || v >= r[0]) && (r[1] == null || v <= r[1])
  const okSurf = t => (F.s[0] == null && F.s[1] == null) ? true : (t.s ? between(t.s / 10000, F.s) : false)
  const okPrix = t => {
    if (F.pnd) return !pfv(t)
    if (F.p[0] == null && F.p[1] == null) return true
    return pfv(t) ? between(pfv(t) / 1e6, F.p) : false
  }
  const nb = v => String(Math.round(v * 100) / 100).replace('.', ',')
  const rangeTxt = (r, u) => r[0] != null && r[1] != null ? nb(r[0]) + ' à ' + nb(r[1]) + ' ' + u : (r[0] != null ? 'Plus de ' + nb(r[0]) + ' ' + u : 'Moins de ' + nb(r[1]) + ' ' + u)
  const hasR = r => r[0] != null || r[1] != null
  function pills () {
    const set = (k, on, label) => {
      const b = $('[data-p="' + k + '"]')
      b.classList.toggle('on', on)
      b.textContent = label
    }
    set('p', F.pnd || hasR(F.p), F.pnd ? 'Prix sur demande' : (hasR(F.p) ? rangeTxt(F.p, 'MDH') : 'Prix'))
    set('s', hasR(F.s), hasR(F.s) ? rangeTxt(F.s, 'ha') : 'Superficie')
    set('q', F.q.size > 0, F.q.size === 1 ? [...F.q][0] : (F.q.size ? 'Zones (' + F.q.size + ')' : 'Zones'))
    set('z', F.z.size > 0, F.z.size === 1 ? FAMC[[...F.z][0]].l.replace(/ \(.*\)/, '') : (F.z.size ? 'Zonage (' + F.z.size + ')' : 'Zonage'))
    const busy = F.pnd || hasR(F.p) || hasR(F.s) || F.q.size || F.z.size || $('[data-f="txt"]').value
    $('[data-a="reset"]').classList.toggle('on', !!busy)
  }

  function render () {
    const f = k => $('[data-f="' + k + '"]').value
    const txt = f('txt').trim().toLowerCase()
    shown = D.filter(t => (F.z.size ? F.z.has(fam(t.z)) : true) &&
      (F.q.size ? F.q.has(t.q) : true) &&
      (onlySel ? sel.has(t.key) : true) &&
      (txt ? [t.id, t.q, t.z, INT() ? t.tf : ''].join(' ').toLowerCase().includes(txt) : true) &&
      okSurf(t) && okPrix(t))
    const ord = f('o')
    const big = 1e15
    if (ord === 'rec') {
      // Terrains complets d'abord : contour et prix connus, puis par superficie, les terrains à vérifier en fin de liste
      const score = t => (INT() && t.warn ? 0 : 4) + (t.g && t.g.length ? 2 : 0) + (pfv(t) ? 1 : 0)
      shown.sort((x, y) => (score(y) - score(x)) ? (score(y) - score(x)) : ((y.s ? y.s : 0) - (x.s ? x.s : 0)))
    }
    if (ord === 's-') shown.sort((x, y) => (y.s ? y.s : 0) - (x.s ? x.s : 0))
    if (ord === 's+') shown.sort((x, y) => (x.s ? x.s : big) - (y.s ? y.s : big))
    if (ord === 'p+') shown.sort((x, y) => (pfv(x) ? pfv(x) : big) - (pfv(y) ? pfv(y) : big))
    if (ord === 'pm+') shown.sort((x, y) => (pmv(x) ? pmv(x) : big) - (pmv(y) ? pmv(y) : big))
    if (ord === 'id') shown.sort((x, y) => String(x.id).localeCompare(String(y.id)))
    Object.values(layers).forEach(l => map.removeLayer(l))
    shown.forEach(t => layers[t.key].addTo(map))
    $('.gfc-n').textContent = shown.length + ' terrain' + (shown.length > 1 ? 's' : '') + ' sur ' + D.length
    $('.gfc-n2').textContent = (onlySel ? 'Ma sélection : ' : '') + shown.length + ' terrain' + (shown.length > 1 ? 's' : '')
    pills()
    $('[data-a="list"]').innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg><span>' + shown.length + '</span>'
    const ps = $('[data-a="popsee"]')
    if (ps) ps.textContent = shown.length ? 'Voir ' + (shown.length > 1 ? 'les ' + shown.length + ' terrains' : 'le terrain') : 'Aucun terrain'
    $('[data-a="onlysel2"]').innerHTML = 'Sélection' + (selected().length ? '<b>' + selected().length + '</b>' : '')
    $('[data-a="onlysel2"]').classList.toggle('on', onlySel)
    $('[data-a="onlysel"]').textContent = onlySel ? 'Tous les terrains' : 'Ma sélection'
    $('.gfc-list').innerHTML = shown.length ? shown.map(t => {
      const on = sel.has(t.key)
      const tags = (INT() && t.warn ? '<span class="gfc-tag w">à vérifier</span>' : '') + (INT() && t.statut && !['Disponible', 'À qualifier'].includes(t.statut) ? '<span class="gfc-tag">' + esc(t.statut) + '</span>' : '')
      const meta = esc(t.id) + ' · ' + surfTxt(t) + (t.z ? ' · ' + esc(t.z) : '') + (INT() && t.tf ? ' · TF ' + esc(t.tf) : '')
      const p2 = pm2(t)
      return '<div class="gfc-card' + (current === t.key ? ' sel' : '') + '" data-k="' + esc(t.key) + '">' +
        '<button class="gfc-ck' + (on ? ' on' : '') + '" data-ck="' + esc(t.key) + '" title="Ajouter à ma sélection">' + (on ? '✓' : '') + '</button>' +
        '<div><div class="t"><span class="gfc-dot" style="background:' + FAMC[fam(t.z)].col + '"></span>' + esc(t.q ? t.q : 'Sans zone') + tags + '</div><div class="m">' + meta + '</div></div>' +
        '<div class="p">' + pglob(t) + (p2 ? '<small>' + p2 + '</small>' : '') + '</div></div>'
    }).join('') : '<div class="gfc-empty">' + (onlySel ? 'Aucun terrain dans votre sélection. Cochez des terrains dans la liste ou sur leur fiche.' : 'Aucun terrain ne correspond aux filtres.') + '</div>'
    $$('.gfc-card').forEach(c => c.addEventListener('click', e => {
      if (e.target.closest('.gfc-ck')) return
      if (VIEW === 'list' && !mob()) {
        setView('split')
        setTimeout(() => select(c.dataset.k), 60)
        return
      }
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
    const m = mob()
    $('.gfc-selbar').innerHTML = '<span' + (m ? ' title="Terrains sélectionnés"' : '') + '><b>' + n + '</b>' + (m ? ' sél.' : ' terrain' + (n > 1 ? 's' : '') + ' sélectionné' + (n > 1 ? 's' : '')) + '</span>' +
      (n ? '<button class="gfc-btn gfc-b2" data-a="pdf">' + (m ? 'PDF' : 'Fiche PDF') + '</button>' : '') +
      acts.map((a, i) => '<button class="gfc-btn ' + (a.cls ? a.cls : 'gfc-b1') + '" data-act="' + i + '">' + (m && a.short ? a.short : a.label) + '</button>').join('') +
      (n ? '<button class="gfc-btn gfc-b2" data-a="clear" aria-label="Vider la sélection">' + (m ? '×' : 'Vider') + '</button>' : '')
    $('.gfc-selbar').style.display = (m && !n && !acts.length) ? 'none' : ''
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
      intern = '<div class="gfc-sec gfc-int"><h3>Données internes</h3>' + rows.map(r => r[2] === 'bloc' ? '<div class="gfc-blk"><span>' + r[0] + '</span><p>' + esc(r[1]) + '</p></div>' : '<div class="gfc-row"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>').join('') + '</div>'
    }
    const on = sel.has(t.key)
    const gm = INT() && t.gm ? t.gm : 'https://www.google.com/maps/search/?api=1&query=' + t.lat + ',' + t.lng
    $('.gfc-detail').innerHTML = '<div class="gfc-dh"><button class="x" data-a="close" aria-label="Fermer">×</button><div class="id">' + esc(t.id) + '</div><h2>' + esc(t.q ? t.q : 'Terrain') + '</h2><span class="gfc-zone"><i style="background:' + c.col + '"></i>' + (t.z ? 'Zonage ' + esc(t.z) + ' · ' : '') + c.l + '</span></div>' +
      '<div class="gfc-kpis">' + kp.map(k => '<div class="gfc-kpi"><span>' + k[0] + '</span><b>' + k[1] + '</b></div>').join('') + '</div>' +
      (t.pt && !DEC() ? '<div class="gfc-sec"><p class="gfc-note">Contour non disponible : position d\'après le lien Google Maps du terrain.</p></div>' : '') +
      '<div class="gfc-sec"><h3>Distances à vol d\'oiseau</h3>' + dists + '</div>' + intern +
      '<div class="gfc-sec"><p class="gfc-note">' + MODES[MODE].note + '</p></div>' +
      '<div class="gfc-acts"><button class="gfc-btn ' + (on ? 'gfc-b3' : 'gfc-b4') + '" data-a="tsel">' + (on ? '✓ Dans ma sélection' : 'Ajouter à ma sélection') + '</button>' +
      (DEC() ? '' : '<a class="gfc-btn gfc-b3" target="_blank" rel="noopener" href="' + escUrl(gm) + '">Google Maps</a>') +
      (INT() && o.openCrm ? '<button class="gfc-btn gfc-b3" data-a="crm">Fiche CRM</button>' : '') + '</div>'
    $('.gfc-detail').classList.add('on')
    $('[data-a="close"]').addEventListener('click', closeDetail)
    $('[data-a="tsel"]').addEventListener('click', () => toggleSel(t.key))
    const crmB = $('[data-a="crm"]')
    if (crmB) crmB.addEventListener('click', () => o.openCrm(t))
    if (mob()) $('.gfc').classList.add('dopen')
    $('.gfc-detail').scrollTop = 0
    if (!keepView) {
      const h = $('.gfc-map').clientHeight
      const sb = $('.gfc-selbar')
      const topPad = sb && sb.offsetHeight ? sb.offsetTop + sb.offsetHeight + 14 : (o.brand ? 110 : 70)
      const pad = mob() ? { paddingTopLeft: [30, topPad], paddingBottomRight: [30, Math.round(Math.min(h * 0.64, $('.gfc-detail').offsetHeight)) + 20] } : { paddingTopLeft: [40, 70], paddingBottomRight: [380, 40] }
      map.fitBounds(bounds[key], Object.assign({ maxZoom: DEC() ? 15 : 17, animate: !instant }, pad))
    }
    $$('.gfc-card').forEach(el => el.classList.toggle('sel', el.dataset.k === key))
  }
  function closeDetail () {
    $('.gfc-detail').classList.remove('on')
    $('.gfc').classList.remove('dopen')
    current = null
    $$('.gfc-card').forEach(el => el.classList.remove('sel'))
  }

  function printSel () {
    const list = selected()
    if (!list.length) return
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const head = '<div class="hd"><div class="w">GREENFIELD+</div><div class="r">Greenfield Atlas · Sélection de terrains · ' + MODES[MODE].label + '<br>' + today + (o.printSub ? '<br>' + esc(o.printSub) : '') + '</div></div>'
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
    const logo = o.printLogo ? '<img src="' + escUrl(o.printLogo) + '" alt="Greenfield" style="height:30px">' : '<div class="w">GREENFIELD+</div>'
    const body = (sum + fiches.join('')).split('<div class="w">GREENFIELD+</div>').join(logo)
    const css = CSS.slice(CSS.indexOf('@media print{') + 13, CSS.lastIndexOf('}')).replace(/body\.gfc-printing [^{]*\{[^}]*\}/g, '').split('.gfc-print ').join('')
    const doc = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Greenfield Atlas, sélection de terrains</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@800..900&family=Inter+Tight:wght@400..700&display=swap" rel="stylesheet">' +
      '<style>body{margin:0}body{font-family:"Inter Tight",Inter,system-ui,sans-serif}body{color:#0a1410}body{-webkit-print-color-adjust:exact}body{print-color-adjust:exact}' + css +
      '.bar{position:sticky}.bar{top:0}.bar{background:#0a1410}.bar{color:#7ee0a4}.bar{padding:10px 14px}.bar{display:flex}.bar{gap:10px}.bar{align-items:center}.bar{justify-content:space-between}.bar{font-size:13px}' +
      '.bar button{font:inherit}.bar button{font-weight:600}.bar button{background:#7ee0a4}.bar button{color:#0a1410}.bar button{border:none}.bar button{border-radius:999px}.bar button{padding:8px 16px}.bar button{cursor:pointer}' +
      '.pg{max-width:780px}.pg{margin:0 auto}@media print{.bar{display:none}}@page{margin:10mm}</style></head><body>' +
      '<div class="bar"><span>Fiche de sélection, ' + list.length + ' terrain' + (list.length > 1 ? 's' : '') + '</span><button onclick="window.print()">Imprimer ou enregistrer en PDF</button></div>' +
      body + '<scr' + 'ipt>window.addEventListener("load", () => setTimeout(() => window.print(), 600))</scr' + 'ipt></body></html>'
    const w = window.open('', '_blank')
    if (w) {
      w.document.open()
      w.document.write(doc)
      w.document.close()
      return
    }
    printEl.innerHTML = body
    document.body.classList.add('gfc-printing')
    const done = () => {
      document.body.classList.remove('gfc-printing')
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    setTimeout(() => window.print(), 50)
  }

  // Filtres et boutons
  $('[data-f="o"]').addEventListener('change', () => render())
  $('[data-f="txt"]').addEventListener('input', () => render())
  $('[data-a="reset"]').addEventListener('click', () => {
    $('[data-f="o"]').value = 'rec'
    $('[data-f="txt"]').value = ''
    F.p = [null, null]
    F.pnd = false
    F.s = [null, null]
    F.q.clear()
    F.z.clear()
    onlySel = false
    closePop()
    render()
  })

  // Menus déroulants de la barre de filtres
  const pop = $('.gfc-pop')
  let popK = null
  function closePop () {
    popK = null
    pop.classList.remove('on')
    $$('.gfc-fp').forEach(b => b.classList.remove('open'))
  }
  const PRE = {
    p: [['Moins de 10 MDH', null, 10], ['10 à 30 MDH', 10, 30], ['30 à 100 MDH', 30, 100], ['Plus de 100 MDH', 100, null]],
    s: [['Moins de 0,5 ha', null, 0.5], ['0,5 à 2 ha', 0.5, 2], ['2 à 10 ha', 2, 10], ['Plus de 10 ha', 10, null]]
  }
  const num = v => {
    const x = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'))
    return isFinite(x) && x >= 0 ? x : null
  }
  function popBody (k) {
    if (k === 'p' || k === 's') {
      const r = F[k]
      const u = k === 'p' ? 'MDH' : 'ha'
      const pre = PRE[k].map((x, i) => '<button data-pre="' + i + '" class="' + (!F.pnd && r[0] === x[1] && r[1] === x[2] ? 'on' : '') + '">' + x[0] + '</button>').join('') +
        (k === 'p' ? '<button data-pre="nd" class="' + (F.pnd ? 'on' : '') + '">Sur demande</button>' : '')
      return '<div class="gfc-ph">' + (k === 'p' ? 'Prix global' : 'Superficie') + '</div><div class="gfc-pre">' + pre + '</div>' +
        '<div class="gfc-ph">Ou une fourchette</div><div class="gfc-rg">' +
        '<label>Min (' + u + ')<input inputmode="decimal" data-r="0" placeholder="Pas de min" value="' + (r[0] != null && !F.pnd ? nb(r[0]) : '') + '"></label>' +
        '<label>Max (' + u + ')<input inputmode="decimal" data-r="1" placeholder="Pas de max" value="' + (r[1] != null && !F.pnd ? nb(r[1]) : '') + '"></label></div>'
    }
    if (k === 'q') {
      const n = {}
      D.forEach(t => { if (t.q) n[t.q] = (n[t.q] ? n[t.q] : 0) + 1 })
      const qs = Object.keys(n).sort((a, b) => a.localeCompare(b, 'fr'))
      return '<input type="search" class="gfc-pq" placeholder="Chercher une zone">' +
        '<div class="gfc-opts">' + qs.map(q => '<label class="gfc-opt" data-t="' + esc(q.toLowerCase()) + '"><input type="checkbox" value="' + esc(q) + '"' + (F.q.has(q) ? ' checked' : '') + '><span>' + esc(q) + '</span><small>' + n[q] + '</small></label>').join('') + '</div>'
    }
    const n = {}
    D.forEach(t => { const f = fam(t.z); n[f] = (n[f] ? n[f] : 0) + 1 })
    return '<div class="gfc-ph">Aucun choix : tous les zonages</div><div class="gfc-opts">' + FAM.filter(f => n[f.k]).map(f => '<label class="gfc-opt"><input type="checkbox" value="' + f.k + '"' + (F.z.has(f.k) ? ' checked' : '') + '><i style="background:' + f.col + '"></i><span>' + f.l + '</span><small>' + n[f.k] + '</small></label>').join('') + '</div>'
  }
  function openPop (k) {
    if (popK === k) { closePop(); return }
    popK = k
    $$('.gfc-fp').forEach(b => b.classList.toggle('open', b.dataset.p === k))
    pop.innerHTML = '<div class="gfc-pb">' + popBody(k) + '</div><div class="gfc-pf"><button class="gfc-btn gfc-b3" data-a="popclr">Effacer</button><button class="gfc-btn gfc-b4" data-a="popsee"></button></div>'
    pop.classList.add('on')
    const box = $('.gfc').getBoundingClientRect()
    const bt = $('[data-p="' + k + '"]').getBoundingClientRect()
    const top = $('.gfc-fbar').getBoundingClientRect().bottom - box.top + 6
    pop.style.top = top + 'px'
    pop.style.maxHeight = (box.height - top - 12) + 'px'
    if (mob()) { pop.style.left = '8px' } else {
      pop.style.left = Math.max(8, Math.min(bt.left - box.left, box.width - pop.offsetWidth - 8)) + 'px'
    }
    const body = pop.querySelector('.gfc-pb')
    if (k === 'p' || k === 's') {
      body.querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.pre === 'nd') { F.pnd = !F.pnd; F.p = [null, null] } else {
          const x = PRE[k][Number(b.dataset.pre)]
          const same = !F.pnd && F[k][0] === x[1] && F[k][1] === x[2]
          F[k] = same ? [null, null] : [x[1], x[2]]
          if (k === 'p') F.pnd = false
        }
        body.innerHTML = popBody(k)
        openWire()
        render()
      }))
      body.querySelectorAll('[data-r]').forEach(inp => inp.addEventListener('input', () => {
        const r = [num(body.querySelector('[data-r="0"]').value), num(body.querySelector('[data-r="1"]').value)]
        F[k] = r
        if (k === 'p') F.pnd = false
        body.querySelectorAll('[data-pre]').forEach(b => {
          const x = b.dataset.pre === 'nd' ? null : PRE[k][Number(b.dataset.pre)]
          b.classList.toggle('on', x ? (r[0] === x[1] && r[1] === x[2]) : false)
        })
        render()
      }))
    } else {
      const set = k === 'q' ? F.q : F.z
      body.querySelectorAll('input[type="checkbox"]').forEach(c => c.addEventListener('change', () => {
        if (c.checked) set.add(c.value)
        else set.delete(c.value)
        render()
      }))
      const pq = body.querySelector('.gfc-pq')
      if (pq) {
        pq.addEventListener('input', () => {
          const v = pq.value.trim().toLowerCase()
          body.querySelectorAll('.gfc-opt').forEach(l => { l.style.display = !v || l.dataset.t.includes(v) ? '' : 'none' })
        })
        if (!touch) pq.focus()
      }
    }
    function openWire () {
      const kk = popK
      popK = null
      openPop(kk)
    }
    pop.querySelector('[data-a="popclr"]').addEventListener('click', () => {
      if (k === 'p') { F.p = [null, null]; F.pnd = false }
      if (k === 's') F.s = [null, null]
      if (k === 'q') F.q.clear()
      if (k === 'z') F.z.clear()
      body.innerHTML = popBody(k)
      openWire()
      render()
    })
    pop.querySelector('[data-a="popsee"]').addEventListener('click', () => {
      closePop()
      if (mob() && side.dataset.st === 'peek') setSheet('half')
    })
    render()
  }
  // Affichage (ordinateur) : carte seule, carte et liste, liste seule. Choix mémorisé sur cet appareil.
  let VIEW = 'split'
  try { const v = localStorage.getItem('gfc-view'); if (['map', 'split', 'list'].includes(v)) VIEW = v } catch (e) { /* stockage indisponible */ }
  function setView (v) {
    VIEW = v
    const g = $('.gfc')
    g.classList.toggle('v-map', v === 'map')
    g.classList.toggle('v-list', v === 'list')
    $$('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v))
    try { localStorage.setItem('gfc-view', v) } catch (e) { /* stockage indisponible */ }
    closePop()
    setTimeout(() => map.invalidateSize(), 30)
  }
  $$('[data-v]').forEach(b => b.addEventListener('click', () => setView(b.dataset.v)))
  setView(VIEW)
  $$('.gfc-fp').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation()
    openPop(b.dataset.p)
  }))
  root.addEventListener('pointerdown', e => {
    if (!popK) return
    if (e.target.closest('.gfc-pop') || e.target.closest('.gfc-fp')) return
    closePop()
  })
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && popK) closePop() })
  $('[data-a="onlysel"]').addEventListener('click', () => {
    onlySel = !onlySel
    render()
  })
  // Feuille du bas (mobile) : aperçu, moitié ou plein écran, à glisser ou toucher
  const side = $('.gfc-side')
  const STATES = ['peek', 'half', 'full']
  // Sur téléphone, 'peek' = liste fermée : on l'ouvre avec le bouton Liste de la barre du bas
  function setSheet (st) {
    STATES.forEach(x => side.classList.toggle(x, x === st))
    side.dataset.st = st
    $('.gfc').dataset.st = st
  }
  setSheet(o.sheet ? o.sheet : 'peek')
  $('[data-a="list"]').addEventListener('click', () => setSheet(side.dataset.st === 'peek' ? 'half' : 'peek'))
  $('[data-a="closelist"]').addEventListener('click', e => { e.stopPropagation(); setSheet('peek') })
  // Téléphone : recherche et sélection passent dans la barre du bas, à côté du bouton Liste
  const srch = $('.gfc-srch')
  const selb = $('.gfc-selbar')
  const bbar = $('.gfc-bbar')
  function placeBars () {
    if (mob()) {
      if (srch.parentElement !== bbar) bbar.insertBefore(srch, bbar.firstChild)
      if (selb.parentElement !== bbar) bbar.insertBefore(selb, $('[data-a="list"]'))
    } else {
      if (srch.parentElement !== $('.gfc-fbar')) $('.gfc-fbar').insertBefore(srch, $('.gfc-fbar').firstChild)
      if (selb.parentElement !== $('.gfc')) $('.gfc').insertBefore(selb, $('.gfc-detail'))
    }
  }
  placeBars()
  const srchIn = $('[data-f="txt"]')
  srchIn.addEventListener('focus', () => { if (mob()) bbar.classList.add('sopen') })
  srchIn.addEventListener('blur', () => bbar.classList.remove('sopen'))
  const sh = $('.gfc-sh')
  let y0 = null
  let h0 = 0
  let moved = false
  sh.addEventListener('touchstart', e => {
    if (e.target.closest('button')) return
    y0 = e.touches[0].clientY
    h0 = side.offsetHeight
    moved = false
    side.classList.add('drag')
  }, { passive: true })
  sh.addEventListener('touchmove', e => {
    if (y0 === null) return
    const dy = e.touches[0].clientY - y0
    if (Math.abs(dy) > 6) moved = true
    const max = root.clientHeight - 64
    side.style.height = Math.max(0, Math.min(max, h0 - dy)) + 'px'
  }, { passive: true })
  sh.addEventListener('touchend', e => {
    if (y0 === null) return
    side.classList.remove('drag')
    const hNow = side.offsetHeight
    side.style.height = ''
    y0 = null
    if (!moved) return
    const H = root.clientHeight
    const targets = [0, H * 0.52, H - 64]
    let best = 0
    targets.forEach((v, i) => { if (Math.abs(v - hNow) < Math.abs(targets[best] - hNow)) best = i })
    setSheet(STATES[best])
  })
  sh.addEventListener('click', e => {
    if (e.target.closest('button')) return
    const st = side.dataset.st
    setSheet(st === 'peek' ? 'half' : (st === 'half' ? 'full' : 'half'))
  })
  $('[data-a="onlysel2"]').addEventListener('click', () => {
    onlySel = !onlySel
    if (side.dataset.st === 'peek') setSheet('half')
    render()
  })
  window.addEventListener('resize', () => {
    placeBars()
    map.invalidateSize()
    selbar()
  })

  function modal (html, wire) {
    $('.gfc-box').innerHTML = html
    $('.gfc-modal').classList.add('on')
    const close = () => $('.gfc-modal').classList.remove('on')
    root.querySelectorAll('[data-m="close"]').forEach(b => b.addEventListener('click', close))
    if (wire) wire($('.gfc-box'), close)
  }

  // Marges du cadrage : sous les barres du haut (filtres, sélection) et au-dessus de la feuille du bas.
  // La hauteur de la feuille est celle de son état final, pas celle lue pendant son animation.
  function padTop () {
    const m = $('.gfc-map').getBoundingClientRect()
    let b = $('.gfc-fbar').getBoundingClientRect().bottom
    return Math.max(24, Math.round(b - m.top + 14))
  }
  function padBottom () {
    const H = root.clientHeight
    const st = side.dataset.st
    return Math.round(st === 'full' ? H - 64 : (st === 'half' ? H * 0.52 : 0)) + (st === 'full' ? 16 : 74)
  }
  function setData (mode, terrains, fit) {
    MODE = mode
    D = terrains
    closeDetail()
    build()
    render()
    if (fit && D.length) {
      const withShape = D.filter(t => t.g && t.g.length)
      const base = withShape.length >= 3 ? withShape : D
      let pts = base.map(t => [t.lat, t.lng])
      if (pts.length >= 10) {
        // Cadre sur la zone dense : on écarte les 10 % de terrains les plus excentrés de chaque côté
        const q = (arr, f) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(f * (arr.length - 1))))]
        const la = pts.map(p => p[0]).sort((a, b) => a - b)
        const ln = pts.map(p => p[1]).sort((a, b) => a - b)
        pts = [[q(la, 0.1), q(ln, 0.1)], [q(la, 0.9), q(ln, 0.9)]]
      }
      map.fitBounds(L.latLngBounds(pts), mob() ? { paddingTopLeft: [24, padTop()], paddingBottomRight: [24, padBottom()], animate: false } : { padding: [40, 40], paddingTopLeft: [40, padTop()], animate: false })
    }
  }

  const api = { setData, render, selected, map, modal, select, printSel, versDecouverte, get mode () { return MODE } }
  setData(MODE, o.terrains, true)
  setTimeout(() => {
    map.invalidateSize()
    zcls()
  }, 100)
  return api
}

window.GFCarte = { mount, versDecouverte, fam, FAM, POIS }
})()
