/* Teaser GREENFIELD, module de la rubrique Marketing du CRM.
   Gabarit : Teaser Terrain Sidi Moumen. S’ouvre avec window.tzOpen() depuis mkNetChange(). */
void (function () {
  const LOGO = { dark:'/teaser/logo-pied-sombre.png', light:'/teaser/logo-pied-clair.png', cover:'/teaser/logo-couverture.svg', contact:'/teaser/logo-contact.png' }
  const CH = c => String.fromCharCode(c)
  const ALT = arr => '(?:' + arr.join(CH(124)) + ')'
  const RX_SP = new RegExp('[\\s' + CH(160) + CH(8239) + ']', 'g')
  const RX_NB = new RegExp('[' + CH(160) + CH(8239) + ']', 'g')
  const RX_DASH = new RegExp('\\s*[' + CH(0x2014) + CH(0x2013) + ']\\s*', 'g')
  const RX_SEMI = new RegExp('\\s*' + CH(59) + '\\s*', 'g')
  const RX_PIPE = new RegExp('\\s*\\' + CH(124) + '\\s*', 'g')
  const RX_WARN = new RegExp(CH(0x26A0) + CH(0xFE0F) + '?', 'g')
  const RX_ACC = new RegExp('[' + CH(0x300) + '-' + CH(0x36f) + ']', 'g')

  let root = null
  const $ = s => root.querySelector(s)
  const $$ = s => Array.from(root.querySelectorAll(s))
  const empty = v => v === undefined ? true : v === null ? true : v === '' ? true : (typeof v === 'number' && isNaN(v))
  const orv = (a, b) => empty(a) ? b : a
  const num = v => {
    if (typeof v === 'number') return isNaN(v) ? null : v
    if (empty(v)) return null
    const n = parseFloat(String(v).replace(RX_SP, '').replace(',', '.'))
    return isNaN(n) ? null : n
  }
  const fmt = (n, d) => {
    if (empty(n)) return ''
    const dd = d ?? 0
    return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: dd, maximumFractionDigits: dd }).replace(RX_NB, ' ')
  }
  const fmtAuto = n => empty(n) ? '' : (Math.round(n) === n ? fmt(n) : fmt(n, 2))
  const mdh = n => fmt(n / 1e6, 1)
  const esc = s => { const d = document.createElement('div')
    d.textContent = String(s ?? '')
    return d.innerHTML }
  const attr = s => esc(String(s ?? '').replace(/"/g, '”'))
  const clean = s => String(s ?? '').replace(RX_DASH, ', ').replace(RX_SEMI, ', ').replace(RX_PIPE, ', ').replace(RX_WARN, '').replace(/(\w)'(\w)/g, '$1’$2').trim()
  const slug = s => String(s ?? '').normalize('NFD').replace(RX_ACC, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').replace(/-+$/, '')
  const TYPE_LABEL = { lotissement:'Lotissement', promotion:'Promotion', activites:'Lots d’activité', immeuble:'Immeuble construit', reserve:'Réserve foncière', villa:'Lot à bâtir' }
  const FAM_LABEL = { Immeuble:'immeuble', Villa:'villa', Industriel:'activités', Tourisme:'tourisme', Rural:'rurale' }
  const ROLE_LABEL = { sat:'Localisation', note:'Note', plan:'Plan', photo:'Photo', doc:'Document' }

  /* ---------- état ---------- */
  const blank = () => ({
    crmId:'', type:'lotissement', nom:'', ville:'', quartier:'', tf:'', maps:'', famille:'',
    superficie:null, surfaceNette:null, prix:null, basePrix:'totale', negociable:false, prixGlobal:null, surfaceUtile:null, lotsImmeuble:'',
    zone:'', secteur:'', niveaux:'', cos:'', cus:'', emprise:null, hauteur:'', lotMin:'', facadeMin:'', reculVoies:'', reculLimites:'', usages:'', refs:'',
    statut:'', occupation:'', bati:'', topo:'', acces:'', viab:[], viabRenseignee:false,
    reperes:[], decomposition:[], servitudes:[],
    rdt:{ voiesPct:40, lot:250, vrd:650, fraisLot:0, mode:'niveaux', constructible:null, vendablePct:83, coutConstr:3800, fraisPromo:8, pvBas:7000, pvHaut:8500, is:null, cible:20, prixMarche:null, loyer:null, vacance:5, charges:null, fraisAcq:6, commission:2.5 },
    tx:{ accroche:'', opp:'', sit:'', sitPhrase:'', urb:'' },
    images:[], docText:{}
  })
  let S = blank()
  const files = new Map()

  /* ---------- styles ---------- */
  const CSS = `
#mk-teaser{--tz-paper:#f4f9f5;--tz-raised:#fff;--tz-ink:#0a1410;--tz-muted:#4f6a5c;--tz-line:#cfe0d6;--tz-accent:#1f7a4d;--tz-mint:#7ee0a4;--tz-warn:#9a5b12;--tz-bad:#b23a2b;color:var(--tz-ink);font-family:'Inter Tight', Inter, Arial, sans-serif;font-size:14px}
#mk-teaser *{box-sizing:border-box}
#mk-teaser .tz-grid{display:grid;grid-template-columns:minmax(0,440px) minmax(0,1fr);gap:20px;align-items:start}
@media(max-width:1100px){#mk-teaser .tz-grid{grid-template-columns:minmax(0,1fr)}}
#mk-teaser .tz-form{display:flex;flex-direction:column;gap:12px;min-width:0}
#mk-teaser details.tz-grp{background:var(--tz-paper);border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,.18)}
#mk-teaser details.tz-grp>summary{list-style:none;cursor:pointer;padding:14px 16px;display:flex;align-items:baseline;gap:10px}
#mk-teaser details.tz-grp>summary::-webkit-details-marker{display:none}
#mk-teaser summary .n{font-family:'JetBrains Mono', monospace;font-size:11px;color:var(--tz-accent)}
#mk-teaser summary b{font-family:Archivo, Arial, sans-serif;font-weight:800;font-size:15px}
#mk-teaser summary .hint{margin-left:auto;font-size:12px;color:var(--tz-muted)}
#mk-teaser .tz-body{padding:0 16px 16px;display:flex;flex-direction:column;gap:12px}
#mk-teaser .row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
#mk-teaser .row.three{grid-template-columns:repeat(3,minmax(0,1fr))}
#mk-teaser label.f{display:flex;flex-direction:column;gap:4px;min-width:0}
#mk-teaser label.f>span,#mk-teaser .lab{font-family:'JetBrains Mono', monospace;font-size:11px;color:var(--tz-muted);text-transform:uppercase;letter-spacing:.04em}
#mk-teaser input[type=text],#mk-teaser input[type=url],#mk-teaser select,#mk-teaser textarea{width:100%;border:1px solid var(--tz-line);background:var(--tz-raised);color:var(--tz-ink);border-radius:8px;padding:8px 10px;min-width:0;font:inherit}
#mk-teaser textarea{resize:vertical;min-height:62px}
#mk-teaser input:focus-visible,#mk-teaser select:focus-visible,#mk-teaser textarea:focus-visible,#mk-teaser button:focus-visible,#mk-teaser summary:focus-visible{outline:2px solid var(--tz-accent);outline-offset:2px}
#mk-teaser .types{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
#mk-teaser .types label{position:relative;border:1px solid var(--tz-line);border-radius:10px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:2px;background:var(--tz-raised)}
#mk-teaser .types label b{font-size:13px}
#mk-teaser .types label small{color:var(--tz-muted);font-size:12px;line-height:1.3}
#mk-teaser .types input{position:absolute;opacity:0;pointer-events:none}
#mk-teaser .types label:has(input:checked){border-color:var(--tz-accent);box-shadow:inset 0 0 0 1px var(--tz-accent)}
#mk-teaser .drops{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
#mk-teaser .drop{border:1.5px dashed var(--tz-line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:4px;cursor:pointer;background:var(--tz-raised);position:relative;min-height:80px}
#mk-teaser .drop.over{border-color:var(--tz-accent);background:#e7f6ed}
#mk-teaser .drop b{font-size:13px}
#mk-teaser .drop small{font-size:12px;color:var(--tz-muted)}
#mk-teaser .drop .count{position:absolute;top:10px;right:10px;font-family:'JetBrains Mono', monospace;font-size:11px;color:var(--tz-accent)}
#mk-teaser .drop input{position:absolute;inset:0;opacity:0;cursor:pointer}
#mk-teaser .thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
#mk-teaser .thumb{display:flex;flex-direction:column;gap:4px;font-size:11px;min-width:0}
#mk-teaser .thumb img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;border:1px solid var(--tz-line);background:var(--tz-line)}
#mk-teaser .thumb.is-cover img{outline:2px solid var(--tz-mint);outline-offset:1px}
#mk-teaser .thumb select{padding:3px 4px;font-size:11px}
#mk-teaser .thumb .acts{display:flex;gap:4px}
#mk-teaser .thumb .acts button{flex:1;border:1px solid var(--tz-line);background:var(--tz-paper);border-radius:6px;font-size:11px;padding:3px;cursor:pointer;color:var(--tz-ink)}
#mk-teaser .rep{display:flex;flex-direction:column;gap:6px}
#mk-teaser .rep .r{display:grid;gap:6px;align-items:center}
#mk-teaser .rep .r.c2{grid-template-columns:minmax(0,1fr) 110px 30px}
#mk-teaser .rep .r.c2b{grid-template-columns:minmax(0,1fr) 140px 30px}
#mk-teaser .rep .r.c3{grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) minmax(0,.8fr) 30px}
#mk-teaser .x{border:1px solid var(--tz-line);background:transparent;border-radius:8px;height:34px;cursor:pointer;color:var(--tz-muted)}
#mk-teaser .checks{display:flex;flex-wrap:wrap;gap:6px 14px}
#mk-teaser .checks label{display:flex;gap:6px;align-items:center;font-size:13px}
#mk-teaser .note{font-size:12px;color:var(--tz-muted);margin:0}
#mk-teaser .tz-status{font-size:13px;padding:10px 12px;border-radius:10px;background:#e7f6ed;margin:0;color:var(--tz-ink)}
#mk-teaser .tz-status.err{background:#fbe3e0}
#mk-teaser [data-show]{display:contents}
#mk-teaser .tz-out{display:flex;flex-direction:column;gap:16px;min-width:0}
#mk-teaser .summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
#mk-teaser .tile{background:var(--tz-paper);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-width:0}
#mk-teaser .tile.dark{background:#0a1410;color:#e8f2ea;border:1px solid rgba(126,224,164,.28)}
#mk-teaser .tile .k{font-family:'JetBrains Mono', monospace;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--tz-muted)}
#mk-teaser .tile.dark .k{color:#9cb3a3}
#mk-teaser .tile .v{font-family:Archivo, Arial, sans-serif;font-weight:800;font-size:22px;line-height:1.1;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
#mk-teaser .tile.dark .v{color:var(--tz-mint)}
#mk-teaser .tile .s{font-size:12px;color:var(--tz-muted)}
#mk-teaser .tile.dark .s{color:#9cb3a3}
#mk-teaser .chip{display:inline-flex;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;width:fit-content}
#mk-teaser .chip.good{background:#dff3e7;color:#1f7a4d}
#mk-teaser .chip.warn{background:#fdf0d9;color:#8a5a12}
#mk-teaser .chip.bad{background:#fbe3e0;color:#b23a2b}
#mk-teaser .chip.neutral{background:#e6eee9;color:#4f6a5c}
#mk-teaser .deckbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:#e8f2ea}
#mk-teaser .deckbar h3{margin:0;font-family:'JetBrains Mono', monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9cb3a3;font-weight:500}
#mk-teaser .deckbar .sp{flex:1}
#mk-teaser .deck{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@media(max-width:1500px){#mk-teaser .deck{grid-template-columns:minmax(0,1fr)}}
#mk-teaser .frame{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:10px;border:1px solid rgba(126,224,164,.14);background:#0B1F13}
#mk-teaser .frame .stage{position:absolute;top:0;left:0;width:1920px;height:1080px;transform-origin:0 0}
#mk-teaser .frame .tag{position:absolute;left:8px;top:8px;z-index:2;background:rgba(11,31,19,.75);color:#EDF1EA;font-family:'JetBrains Mono', monospace;font-size:10px;padding:2px 8px;border-radius:999px}
#mk-teaser .panel{background:var(--tz-paper);border-radius:14px;padding:12px 16px}
#mk-teaser .panel h4{margin:0 0 6px;font-size:13px}
#mk-teaser .panel ul{margin:0;padding-left:18px;color:var(--tz-muted);font-size:13px}
#mk-teaser .mkt table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}
#mk-teaser .mkt td,#mk-teaser .mkt th{text-align:left;padding:4px 6px;border-top:1px solid var(--tz-line)}
#mk-teaser .mkt .tw{overflow-x:auto;max-height:240px}
#tz-offstage{position:fixed;left:-30000px;top:0;width:1920px;height:1080px;overflow:hidden;pointer-events:none}
.gf-slide{position:relative;width:1920px;height:1080px;overflow:hidden;box-sizing:border-box;line-height:normal}
.gf-slide *{box-sizing:border-box;margin:0}
.gf-slide table{width:100%;border-collapse:collapse}
.gf-slide th,.gf-slide td{text-align:left;padding:18px 24px;vertical-align:top;line-height:1.35}
.gf-slide a{color:inherit}
`

  /* ---------- gabarit du formulaire ---------- */
  const inp = (id, k, label, ph, opts) => `<label class="f"><span>${label}</span><input type="text" id="tz-${id}" data-k="${k}"${opts && opts.num ? ' data-num inputmode="decimal"' : ''} placeholder="${ph ?? ''}"${opts && opts.list ? ' list="' + opts.list + '"' : ''}></label>`
  const sel = (id, k, label, options) => `<label class="f"><span>${label}</span><select id="tz-${id}" data-k="${k}">${options.map(o => Array.isArray(o) ? `<option value="${o[0]}">${o[1]}</option>` : `<option>${o}</option>`).join('')}</select></label>`
  const MARKUP = `
<div class="tz-grid">
<section class="tz-form">
  <div class="card" style="margin:0">
    <div class="card-title">Teaser terrain</div>
    <label class="f"><span>Partir d’un terrain du CRM</span><select id="tz-crm"></select></label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn" type="button" id="tz-new">Vider le formulaire</button>
      <button class="btn btn-primary" type="button" id="tz-pdf">Télécharger le PDF</button>
      <button class="btn" type="button" id="tz-html">Télécharger en HTML</button>
    </div>
  </div>
  <p class="tz-status" id="tz-status" hidden></p>

  <details class="tz-grp" open>
    <summary><span class="n">1</span><b>Le bien</b><span class="hint">type et localisation</span></summary>
    <div class="tz-body">
      <div class="types">
        <label><input type="radio" name="tz-type" value="lotissement"><b>Lotissement</b><small>Découpage en lots viabilisés à revendre</small></label>
        <label><input type="radio" name="tz-type" value="promotion"><b>Promotion</b><small>Logements, bureaux ou commerces</small></label>
        <label><input type="radio" name="tz-type" value="activites"><b>Lots d’activité</b><small>Lotissement industriel ou logistique</small></label>
        <label><input type="radio" name="tz-type" value="immeuble"><b>Immeuble construit</b><small>Bâtiment existant, revente ou location</small></label>
        <label><input type="radio" name="tz-type" value="reserve"><b>Réserve foncière</b><small>Terrain non ouvert, sans bilan</small></label>
        <label><input type="radio" name="tz-type" value="villa"><b>Lot à bâtir</b><small>Villa ou petit immeuble</small></label>
      </div>
      <div class="row">${inp('nom', 'nom', 'Nom du terrain', 'Mejjatia E3')}${inp('ville', 'ville', 'Ville', 'Médiouna')}</div>
      <div class="row">${inp('quartier', 'quartier', 'Quartier ou zone', 'Ouled Taleb')}${inp('tf', 'tf', 'Titre foncier', 'TF 167227/12')}</div>
      <label class="f"><span>Lien Google Maps</span><input type="url" id="tz-maps" data-k="maps" placeholder="https://maps.app.goo.gl/..."></label>
      ${sel('fam', 'famille', 'Famille de zonage (comparables)', [['', 'Déduite du zonage'], ['Immeuble', 'Immeuble (A, B, C)'], ['Villa', 'Villa (D, E)'], ['Industriel', 'Activités (I, ZI)'], ['Tourisme', 'Tourisme (BT, SD)'], ['Rural', 'Rural (RA)']])}
      <span class="note">Repères de situation, quatre au plus. Position qualitative sauf distance vérifiée.</span>
      <div class="rep" id="tz-rep-reperes"></div>
      <button class="btn" type="button" data-add="reperes">Ajouter un repère</button>
    </div>
  </details>

  <details class="tz-grp" open>
    <summary><span class="n">2</span><b>Documents</b><span class="hint">PDF ou images</span></summary>
    <div class="tz-body">
      <div class="drops">
        <label class="drop" data-role="sat"><b>Localisation</b><small>Captures satellite, carte</small><span class="count" id="tz-c-sat"></span><input type="file" id="tz-f-sat" accept="image/*,application/pdf" multiple></label>
        <label class="drop" data-role="note"><b>Note de renseignement</b><small>PDF de l’agence urbaine</small><span class="count" id="tz-c-note"></span><input type="file" id="tz-f-note" accept="image/*,application/pdf" multiple></label>
        <label class="drop" data-role="plan"><b>Plans</b><small>Aménagement, décomposition</small><span class="count" id="tz-c-plan"></span><input type="file" id="tz-f-plan" accept="image/*,application/pdf" multiple></label>
        <label class="drop" data-role="photo"><b>Photos du site</b><small>Ajoute une slide « Le site »</small><span class="count" id="tz-c-photo"></span><input type="file" id="tz-f-photo" accept="image/*" multiple></label>
        <label class="drop" data-role="doc"><b>Autres documents</b><small>Certificat, bilan vendeur</small><span class="count" id="tz-c-doc"></span><input type="file" id="tz-f-doc" accept="image/*,application/pdf" multiple></label>
      </div>
      <div class="thumbs" id="tz-thumbs"></div>
      <p class="note">Les PDF dont le texte est lisible remplissent les champs vides : titre foncier, zone, superficie, hauteur, niveaux, COS, CUS, emprise, lot minimum, façade et références de la note. Un PDF scanné sert seulement d’image.</p>
    </div>
  </details>

  <details class="tz-grp" open>
    <summary><span class="n">3</span><b>Surfaces et prix</b><span class="hint">si disponibles</span></summary>
    <div class="tz-body">
      <div class="row">${inp('sup', 'superficie', 'Superficie totale (m²)', '10 000', { num:true })}${inp('net', 'surfaceNette', 'Surface nette (m²)', 'facultatif', { num:true })}</div>
      <div data-show="lotissement promotion activites reserve villa"><div class="row">${inp('prix', 'prix', 'Prix demandé (DH/m²)', 'Prix sur demande', { num:true })}${sel('base', 'basePrix', 'Base du prix', [['totale', 'Superficie totale'], ['nette', 'Surface nette']])}</div></div>
      <div data-show="immeuble">
        <div class="row">${inp('pglob', 'prixGlobal', 'Prix global (DH)', '26 000 000', { num:true })}${inp('sutile', 'surfaceUtile', 'Surface utile (m²)', '925,99', { num:true })}</div>
        <div class="row">${inp('niv2', 'niveaux', 'Niveaux', 'R+3 sur sous-sol')}${inp('nlots', 'lotsImmeuble', 'Nombre de lots', '2 commerces + 9 bureaux')}</div>
      </div>
      <div class="checks"><label><input type="checkbox" id="tz-nego" data-k="negociable"> Prix négociable</label></div>
      <span class="note">Décomposition de la superficie (voies, équipements, surface nette, étages pour un immeuble).</span>
      <div class="rep" id="tz-rep-decomposition"></div>
      <button class="btn" type="button" data-add="decomposition">Ajouter une surface</button>
    </div>
  </details>

  <details class="tz-grp" data-hide-for="immeuble">
    <summary><span class="n">4</span><b>Urbanisme</b><span class="hint">note de renseignement</span></summary>
    <div class="tz-body">
      <div class="row three">${inp('zone', 'zone', 'Zone', 'E')}${inp('secteur', 'secteur', 'Secteur', 'E3')}${inp('niv', 'niveaux', 'Niveaux', 'R+2')}</div>
      <div class="row three">${inp('cos', 'cos', 'COS', 'non fixé')}${inp('cus', 'cus', 'CUS', '1,8')}${inp('emp', 'emprise', 'Emprise (%)', '60', { num:true })}</div>
      <div class="row three">${inp('haut', 'hauteur', 'Hauteur (m)', '11,50')}${inp('lotmin', 'lotMin', 'Lot min. (m²)', '180')}${inp('fac', 'facadeMin', 'Façade min. (m)', '9')}</div>
      <div class="row">${inp('rv', 'reculVoies', 'Recul sur voies (m)', '4')}${inp('rl', 'reculLimites', 'Limites séparatives', 'mitoyenneté')}</div>
      <label class="f"><span>Usages admis et interdits</span><textarea id="tz-usages" data-k="usages"></textarea></label>
      <label class="f"><span>Références (note, agence, décret)</span><textarea id="tz-refs" data-k="refs"></textarea></label>
      <span class="note">Servitudes et contraintes du plan.</span>
      <div class="rep" id="tz-rep-servitudes"></div>
      <button class="btn" type="button" data-add="servitudes">Ajouter une servitude</button>
    </div>
  </details>

  <details class="tz-grp">
    <summary><span class="n">5</span><b>Spécificités</b><span class="hint">foncier, réseaux, état</span></summary>
    <div class="tz-body">
      <div class="row">${sel('statut', 'statut', 'Statut foncier', [['', 'Non renseigné'], 'Titré', 'Titré en indivision', 'En cours d’immatriculation', 'Melk', 'Terre collective', 'Habous', 'Domaine de l’État'])}${sel('occ', 'occupation', 'Occupation', [['', 'Non renseignée'], 'Libre', 'Exploité en agriculture', 'Occupé', 'Loué'])}</div>
      <div class="row">${sel('bati', 'bati', 'Bâti existant', [['', 'Non renseigné'], 'Aucun', 'À démolir', 'À conserver'])}${sel('topo', 'topo', 'Topographie', [['', 'Non renseignée'], 'Plat', 'Légère pente', 'Accidenté'])}</div>
      ${inp('acces', 'acces', 'Accès et façades', 'Deux façades, 120 m sur la RN9')}
      <span class="note">Réseaux disponibles en limite de terrain</span>
      <div class="checks">${['Eau', 'Électricité', 'Assainissement', 'Voirie'].map((v, i) => `<label><input type="checkbox" id="tz-v${i}" data-v="${v}"> ${v}</label>`).join('')}</div>
      <div class="checks"><label><input type="checkbox" id="tz-viabok" data-k="viabRenseignee"> Réseaux vérifiés, les manquants vont dans les servitudes</label></div>
    </div>
  </details>

  <details class="tz-grp" open>
    <summary><span class="n">6</span><b>Rendement</b><span class="hint" id="tz-rdt-hint"></span></summary>
    <div class="tz-body">
      <p class="note" data-show="reserve">Pas de bilan pour une réserve foncière. Le teaser affiche le prix et le repère de marché.</p>
      <div data-show="lotissement activites">
        <div class="row">${inp('voies', 'rdt.voiesPct', 'Voies et équipements (%)', '', { num:true })}${inp('lot', 'rdt.lot', 'Taille des lots (m²)', '', { num:true, list:'tz-lots' })}</div>
        <datalist id="tz-lots"><option value="120">E2s</option><option value="180">E3</option><option value="250">B3</option><option value="500">D</option><option value="1000">Activités</option></datalist>
        <div class="row">${inp('vrd', 'rdt.vrd', 'VRD (DH/m² de terrain)', '', { num:true })}${inp('fraislot', 'rdt.fraisLot', 'Frais de vente (% du CA)', '', { num:true })}</div>
      </div>
      <div data-show="promotion">
        <div class="row">${sel('mode', 'rdt.mode', 'Calcul du constructible', [['niveaux', 'Emprise x niveaux'], ['cus', 'CUS'], ['saisie', 'Surface saisie']])}${inp('constr', 'rdt.constructible', 'Constructible saisi (m²)', 'si saisie', { num:true })}</div>
        <div class="row three">${inp('vend', 'rdt.vendablePct', 'Vendable (%)', '', { num:true })}${inp('cc', 'rdt.coutConstr', 'Construction (DH/m²)', '', { num:true })}${inp('frais', 'rdt.fraisPromo', 'Frais annexes (% CA)', '', { num:true })}</div>
      </div>
      <div data-show="villa"><div class="row">${inp('ccv', 'rdt.coutConstr', 'Construction (DH/m²)', '', { num:true })}${inp('vendv', 'rdt.vendablePct', 'Vendable (%)', '', { num:true })}</div></div>
      <div data-show="lotissement activites promotion villa"><div class="row">${inp('pvb', 'rdt.pvBas', 'Vente basse (DH/m²)', '', { num:true })}${inp('pvh', 'rdt.pvHaut', 'Vente haute (DH/m²)', '', { num:true })}</div></div>
      <div data-show="lotissement activites promotion"><div class="row">${inp('is', 'rdt.is', 'IS (%), vide = 20 ou 35', 'auto', { num:true })}${inp('cible', 'rdt.cible', 'Marge cible acquéreur (% CA)', '', { num:true })}</div></div>
      <div data-show="immeuble">
        <div class="row">${inp('pm', 'rdt.prixMarche', 'Prix du marché (DH/m²)', '35 000', { num:true })}${inp('loyer', 'rdt.loyer', 'Loyers mensuels (DH)', 'si loué ou estimé', { num:true })}</div>
        <div class="row three">${inp('vac', 'rdt.vacance', 'Vacance (%)', '', { num:true })}${inp('ch', 'rdt.charges', 'Charges / an (DH)', '', { num:true })}${inp('facq', 'rdt.fraisAcq', 'Frais d’acquisition (%)', '', { num:true })}</div>
        ${inp('com', 'rdt.commission', 'Commission de sourcing (%)', '', { num:true })}
      </div>
    </div>
  </details>

  <details class="tz-grp">
    <summary><span class="n">7</span><b>Textes du teaser</b><span class="hint">vide = texte automatique</span></summary>
    <div class="tz-body">
      <label class="f"><span>Phrase d’accroche (couverture)</span><textarea id="tz-acc" data-k="tx.accroche"></textarea></label>
      ${inp('topp', 'tx.opp', 'Titre de l’opportunité', '')}
      ${inp('tsit', 'tx.sit', 'Titre de la situation', '')}
      <label class="f"><span>Phrase de situation</span><textarea id="tz-sitp" data-k="tx.sitPhrase"></textarea></label>
      ${inp('turb', 'tx.urb', 'Titre de l’urbanisme', '')}
    </div>
  </details>
</section>

<section class="tz-out">
  <div class="summary" id="tz-summary"></div>
  <div class="panel" id="tz-missing" hidden></div>
  <div class="deckbar"><h3 id="tz-deck-title">Aperçu du teaser</h3><div class="sp"></div><button class="btn" type="button" id="tz-mkt-btn">Comparables</button></div>
  <div class="panel mkt" id="tz-mkt" hidden></div>
  <div class="deck" id="tz-deck"></div>
</section>
</div>`

  /* ---------- formulaire ---------- */
  const getK = k => k.split('.').reduce((o, p) => o == null ? undefined : o[p], S)
  const setK = (k, v) => { const ps = k.split('.')
    const last = ps.pop()
    ps.reduce((a, p) => a[p], S)[last] = v }

  function fillForm () {
    $$('[data-k]').forEach(el => {
      const v = getK(el.dataset.k)
      if (el.type === 'checkbox') el.checked = !!v
      else if ('num' in el.dataset) el.value = empty(v) ? '' : fmtAuto(v)
      else el.value = v ?? ''
    })
    $$('[data-v]').forEach(el => { el.checked = S.viab.includes(el.dataset.v) })
    $$('input[name=tz-type]').forEach(r => { r.checked = r.value === S.type })
    $('#tz-crm').value = S.crmId
    renderReps()
    renderThumbs()
    applyType()
  }
  function applyType () {
    $$('[data-show]').forEach(el => { el.hidden = !el.dataset.show.split(' ').includes(S.type) })
    $$('[data-hide-for]').forEach(el => { el.hidden = el.dataset.hideFor === S.type })
    $('#tz-rdt-hint').textContent = TYPE_LABEL[S.type]
  }
  function autoLot () {
    const s = String(S.secteur ?? '').toUpperCase().replace(/\s/g, '')
    const hit = [['E2', 120], ['E3', 180], ['E', 180], ['B', 250], ['D', 500], ['I', 1000]].find(([p]) => s.startsWith(p))
    if (hit) { S.rdt.lot = hit[1]
      const el = $('#tz-lot')
      if (el) el.value = hit[1] }
  }
  function onInput (e) {
    const el = e.target
    if (el.dataset.k) {
      setK(el.dataset.k, el.type === 'checkbox' ? el.checked : ('num' in el.dataset ? num(el.value) : el.value))
      if (el.dataset.k === 'secteur' && S.type !== 'immeuble') autoLot()
      schedule()
    } else if (el.dataset.v) {
      S.viab = $$('[data-v]').filter(x => x.checked).map(x => x.dataset.v)
      schedule()
    } else if (el.dataset.list) {
      S[el.dataset.list][+el.dataset.i][el.dataset.f] = el.dataset.f === 'm2' ? num(el.value) : el.value
      schedule()
    }
  }
  function onChange (e) {
    const t = e.target
    if (t.name === 'tz-type') {
      S.type = t.value
      if (S.type === 'activites') Object.assign(S.rdt, { lot:1000, voiesPct:30, pvBas:2500, pvHaut:3500 })
      else if (S.type === 'lotissement' && S.rdt.lot === 1000) Object.assign(S.rdt, { lot:250, voiesPct:40, pvBas:7000, pvHaut:8500 })
      else if (['promotion', 'villa'].includes(S.type) && S.rdt.pvBas < 6000) Object.assign(S.rdt, { pvBas:9000, pvHaut:11000 })
      fillForm()
      schedule()
    } else if (t.id === 'tz-crm') {
      fromCrm(t.value)
    } else if (t.dataset.thumb !== undefined) {
      S.images[+t.dataset.thumb].role = t.value
      renderThumbs()
      schedule()
    }
  }

  /* listes répétables */
  const REP = {
    reperes: { cls:'c2b', fields:[['nom', 'Repère'], ['pos', 'Position', ['En bordure', 'En face', 'À proximité', 'Voisin', 'Accès direct']]], blankRow:() => ({ nom:'', pos:'À proximité' }), max:4 },
    decomposition: { cls:'c2', fields:[['label', 'Surface'], ['m2', 'm²']], blankRow:() => ({ label:'', m2:null }) },
    servitudes: { cls:'c3', fields:[['c', 'Contrainte'], ['d', 'Détail'], ['s', 'Source']], blankRow:() => ({ c:'', d:'', s:'' }) }
  }
  function renderReps () {
    Object.entries(REP).forEach(([k, def]) => {
      $('#tz-rep-' + k).innerHTML = S[k].map((row, i) => `<div class="r ${def.cls}">${def.fields.map(([f, ph, opts]) => {
        const id = `tz-rp-${k}-${i}-${f}`
        if (opts) return `<select id="${id}" aria-label="${ph}" data-list="${k}" data-i="${i}" data-f="${f}">${(opts.includes(row[f]) ? opts : [row[f]].concat(opts)).map(o => `<option${o === row[f] ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
        const v = f === 'm2' ? fmtAuto(row[f]) : (row[f] ?? '')
        return `<input type="text" id="${id}" aria-label="${ph}" placeholder="${ph}" data-list="${k}" data-i="${i}" data-f="${f}" value="${attr(v)}"${f === 'm2' ? ' inputmode="decimal"' : ''}>`
      }).join('')}<button class="x" type="button" data-del="${k}" data-i="${i}" aria-label="Supprimer">×</button></div>`).join('')
    })
  }
  function onClick (e) {
    const add = e.target.closest('[data-add]')
    if (add) {
      const k = add.dataset.add
      if (REP[k].max && S[k].length >= REP[k].max) return
      S[k].push(REP[k].blankRow())
      renderReps()
      schedule()
      return
    }
    const del = e.target.closest('[data-del]')
    if (del) { S[del.dataset.del].splice(+del.dataset.i, 1)
      renderReps()
      schedule()
      return }
    const cov = e.target.closest('[data-cover]')
    if (cov) { S.images.forEach((im, i) => { im.cover = i === +cov.dataset.cover })
      renderThumbs()
      schedule()
      return }
    const rm = e.target.closest('[data-rm]')
    if (rm) { S.images.splice(+rm.dataset.rm, 1)
      renderThumbs()
      schedule() }
  }

  /* ---------- terrains du CRM ---------- */
  /* state, MV et mvN sont des let et const globaux du CRM : visibles ici par leur nom, pas via window */
  const crmState = () => typeof state === 'undefined' ? null : state
  const terrains = () => { const st = crmState()
    return st && Array.isArray(st.terrains) ? st.terrains : [] }
  function crmOptions () {
    const label = t => (typeof window.terrainLabel === 'function') ? window.terrainLabel(t) : [t.ref, t.localisation].filter(Boolean).join(' / ')
    $('#tz-crm').innerHTML = '<option value="">Saisie libre</option>' + terrains().filter(t => t.statut !== 'Vendu').map(t => `<option value="${attr(t.id)}">${esc(label(t))}</option>`).join('')
    $('#tz-crm').value = S.crmId
  }
  function fromCrm (id) {
    const t = terrains().find(x => String(x.id) === String(id))
    if (!t) { S.crmId = ''
      return }
    const keepImgs = S.images
    S = blank()
    S.images = keepImgs
    S.crmId = String(t.id)
    S.nom = orv(t.quartier, t.localisation) ?? ''
    S.quartier = t.localisation ?? ''
    S.superficie = num(t.superficie)
    S.prix = num(t.prix)
    S.tf = t.tf ? (/^t/i.test(String(t.tf)) ? String(t.tf) : 'TF ' + t.tf) : ''
    S.maps = /^https?:/.test(t.googleMap ?? '') ? t.googleMap : ''
    const u = String(t.urba ?? '').trim().toUpperCase().split(/[\s/,]+/)[0]
    if (u) { S.secteur = u
      S.zone = (u.match(/^[A-Z]+/) ?? [''])[0] }
    const sj = String(t.statut_juridique ?? '')
    if (/indivision/i.test(sj)) S.statut = 'Titré en indivision'
    else if (/immatricul/i.test(sj)) S.statut = 'En cours d’immatriculation'
    else if (/titr/i.test(sj)) S.statut = 'Titré'
    else if (/melk/i.test(sj)) S.statut = 'Melk'
    const fam = typeof window.mvFam === 'function' ? window.mvFam(t.urba) : null
    if (fam === 'Industriel') { S.type = 'activites'
      Object.assign(S.rdt, { lot:1000, voiesPct:30, pvBas:2500, pvHaut:3500 }) }
    else if (fam === 'Rural') S.type = 'reserve'
    else if (fam === 'Tourisme') { S.type = 'promotion'
      Object.assign(S.rdt, { pvBas:9000, pvHaut:11000 }) }
    else if (S.superficie && S.superficie < 1500) { S.type = 'villa'
      Object.assign(S.rdt, { pvBas:9000, pvHaut:11000 }) }
    autoLot()
    fitCache.clear()
    fillForm()
    status(`Formulaire prérempli depuis le terrain ${t.ref ? t.ref + ', ' : ''}${t.localisation ?? ''}. Ajoutez la note de renseignement, les plans et une capture satellite.`)
    render()
  }

  /* ---------- documents ---------- */
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script')
    s.src = src
    s.onload = res
    s.onerror = rej
    document.head.appendChild(s) })
  async function pdfLib () {
    if (!window.pdfjsLib) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    }
    return window.pdfjsLib
  }
  async function readPdf (file, maxPages) {
    const lib = await pdfLib()
    const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise
    const n = Math.min(pdf.numPages, maxPages)
    const pages = []
    let text = ''
    for (const i of Array.from({ length:n }, (_, k) => k + 1)) {
      const page = await pdf.getPage(i)
      const tc = await page.getTextContent()
      text += ' ' + tc.items.map(x => x.str).join(' ')
      const v1 = page.getViewport({ scale:1 })
      const vp = page.getViewport({ scale: Math.min(2.2, 1800 / Math.max(v1.width, v1.height)) })
      const cv = document.createElement('canvas')
      cv.width = Math.round(vp.width)
      cv.height = Math.round(vp.height)
      const ctx = cv.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, cv.width, cv.height)
      await page.render({ canvasContext: ctx, viewport: vp }).promise
      pages.push({ blob: await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.86)), name: `${file.name} p.${i}` })
    }
    return { pages, total: pdf.numPages, text: text.replace(/\s+/g, ' ') }
  }
  async function normalizeImage (file) {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size < 6e6) return file
    const url = URL.createObjectURL(file)
    const img = await loadImg(url)
    const k = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight))
    const cv = document.createElement('canvas')
    cv.width = Math.round(img.naturalWidth * k)
    cv.height = Math.round(img.naturalHeight * k)
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
    URL.revokeObjectURL(url)
    return await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.88))
  }
  async function addFiles (list, role) {
    status(`Lecture de ${list.length} fichier${list.length > 1 ? 's' : ''}...`)
    const found = []
    try {
      for (const f of Array.from(list)) {
        let items = []
        if (f.type === 'application/pdf') {
          const r = await readPdf(f, role === 'note' ? 10 : 4)
          items = r.pages
          if (r.text.length > 40) found.push(...applyFacts(extract(r.text)))
        } else {
          items = [{ blob: await normalizeImage(f), name: f.name }]
        }
        items.forEach(it => {
          const lid = 'l' + Math.random().toString(36).slice(2, 10)
          files.set(lid, { blob: it.blob, url: URL.createObjectURL(it.blob) })
          S.images.push({ lid, role, name: it.name, cover:false })
        })
      }
      if (!S.images.some(i => i.cover)) {
        const c = S.images.find(i => i.role === 'sat') ?? S.images.find(i => i.role === 'photo')
        if (c) c.cover = true
      }
      fillForm()
      status(found.length ? `Champs remplis depuis les documents : ${Array.from(new Set(found)).join(', ')}. Relisez-les.` : '')
      schedule()
    } catch (err) {
      status('Lecture impossible de ce fichier. Essayez une image JPEG ou PNG, ou vérifiez la connexion.', true)
    }
  }
  function extract (txt) {
    const it = {}
    let m = txt.match(new RegExp(ALT(['T\\.?\\s?F\\.?', 'titre foncier']) + '\\s*(?:n[°o]?\\s*)?(\\d{1,6}\\s?/\\s?[0-9A-Za-z]{1,3})', 'i'))
    if (m) it.tf = 'TF ' + m[1].replace(/\s/g, '')
    m = txt.match(/secteur\s+([A-Z]{1,3}\s?\d{1,2}[a-zA-Z]?)\b/)
    if (m) it.secteur = m[1].replace(/\s/g, '')
    m = txt.match(/zone\s+([A-Z]{1,3})(?:\s?\d{1,2}[a-zA-Z]?)?\b/)
    if (m) it.zone = m[1]
    if (!it.secteur) { m = txt.match(/zone\s+([A-Z]{1,3}\s?\d{1,2}[a-zA-Z]?)\b/)
      if (m) it.secteur = m[1].replace(/\s/g, '') }
    m = txt.match(new RegExp(ALT(['superficie', 'contenance', 'surface']) + '[^0-9]{0,50}(\\d[\\d .,]{1,10})\\s*(' + ['m\\s?²', 'm2', 'ha', 'hectare'].join(CH(124)) + ')', 'i'))
    if (m) { let v = num(m[1])
      if (/ha/i.test(m[2])) v *= 10000
      if (v > 20 && v < 5e7) it.superficie = Math.round(v) }
    m = txt.match(/hauteur[^0-9]{0,60}(\d{1,2}(?:[.,]\d{1,2})?)\s*m/i)
    if (m) it.hauteur = m[1].replace('.', ',')
    m = txt.match(/R\s?\+\s?(\d{1,2})/)
    if (m) it.niveaux = 'R+' + m[1]
    m = txt.match(/C\.?\s?O\.?\s?S\.?[^0-9]{0,25}(\d(?:[.,]\d{1,2})?)/)
    if (m) it.cos = m[1].replace('.', ',')
    m = txt.match(/C\.?\s?U\.?\s?S\.?[^0-9]{0,25}(\d(?:[.,]\d{1,2})?)/)
    if (m) it.cus = m[1].replace('.', ',')
    m = txt.match(/emprise[^%]{0,60}?(\d{1,3})\s*%/i)
    if (m) it.emprise = +m[1]
    m = txt.match(new RegExp(ALT(['superficie', 'surface']) + '\\s+minimale?[^0-9]{0,50}(\\d[\\d ]{1,6})\\s*m', 'i'))
    if (m) it.lotMin = m[1].replace(/\s/g, '')
    m = txt.match(/fa[cç]ade[^0-9]{0,50}(\d{1,3}(?:[.,]\d{1,2})?)\s*m/i)
    if (m) it.facadeMin = m[1].replace('.', ',')
    const ref = []
    m = txt.match(/note de renseignements?[^0-9]{0,30}n[°o]?\s*([0-9]+\s?\/\s?[0-9]{2,4})/i)
    if (m) ref.push('Note de renseignement n° ' + m[1].replace(/\s/g, ''))
    m = txt.match(/(\d{1,2}[/.-]\d{1,2}[/.-][12][09]\d{2})/)
    if (m && ref.length) ref[0] += ' du ' + m[1].replace(/[.-]/g, '/')
    m = txt.match(/agence urbaine d[e’']\s*([A-ZÉ][A-Za-zéèêàç' -]{2,40}?)[,.]/i)
    if (m) ref.push('Agence urbaine de ' + m[1].trim())
    m = txt.match(/d[ée]cret\s+n[°o]?\s*([0-9.]+[0-9])/i)
    if (m) ref.push('décret n° ' + m[1])
    if (ref.length) it.refs = ref.join(', ')
    return it
  }
  function applyFacts (it) {
    const L = { tf:'titre foncier', secteur:'secteur', zone:'zone', superficie:'superficie', hauteur:'hauteur', niveaux:'niveaux', cos:'COS', cus:'CUS', emprise:'emprise', lotMin:'lot minimum', facadeMin:'façade', refs:'références' }
    const done = []
    Object.entries(it).forEach(([k, v]) => {
      if (!empty(S[k])) return
      S[k] = v
      done.push(L[k])
    })
    if (it.secteur && S.type !== 'immeuble') autoLot()
    return done
  }
  const imgSrc = im => files.has(im.lid) ? files.get(im.lid).url : ''
  function renderThumbs () {
    const counts = {}
    S.images.forEach(i => { counts[i.role] = (counts[i.role] ?? 0) + 1 })
    Object.keys(ROLE_LABEL).forEach(r => { const el = $('#tz-c-' + r)
      if (el) el.textContent = counts[r] ? counts[r] : '' })
    $('#tz-thumbs').innerHTML = S.images.map((im, i) => `<div class="thumb${im.cover ? ' is-cover' : ''}">
      <img src="${attr(imgSrc(im))}" alt="${attr(im.name)}">
      <select id="tz-th-${i}" data-thumb="${i}" aria-label="Rôle de ${attr(im.name)}">${Object.entries(ROLE_LABEL).map(([k, l]) => `<option value="${k}"${k === im.role ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <div class="acts"><button type="button" data-cover="${i}">${im.cover ? 'Couverture' : 'En couverture'}</button><button type="button" data-rm="${i}" aria-label="Retirer">×</button></div></div>`).join('')
  }
  function status (msg, err) {
    const el = $('#tz-status')
    el.hidden = !msg
    el.textContent = msg
    el.classList.toggle('err', !!err)
  }

  /* ---------- calculs ---------- */
  function famille () {
    if (S.famille) return S.famille
    const z = orv(S.secteur, S.zone)
    const f = (z && typeof window.mvFam === 'function') ? window.mvFam(z) : null
    if (f) return f
    if (S.type === 'activites') return 'Industriel'
    return ''
  }
  function surfaceNette () {
    if (!empty(S.surfaceNette)) return S.surfaceNette
    const r = S.decomposition.find(x => ['nette', 'exploitable', 'lotie', 'constructible', 'cessible'].some(w => String(x.label ?? '').toLowerCase().includes(w)) && num(x.m2))
    return r ? r.m2 : null
  }
  function prixGlobal () {
    if (S.type === 'immeuble') return S.prixGlobal
    if (empty(S.prix)) return null
    const base = S.basePrix === 'nette' && surfaceNette() ? surfaceNette() : S.superficie
    return empty(base) ? null : base * S.prix
  }
  function niveauxN () {
    const m = String(S.niveaux ?? '').match(/R\s*\+\s*(\d+)/i)
    return m ? +m[1] : null
  }
  const isRate = benef => !empty(S.rdt.is) ? S.rdt.is : (benef >= 1e8 ? 35 : 20)
  function scenario (CA, cost) {
    const marge = CA - cost
    const rate = isRate(marge)
    return { CA, marge, rate, net: marge > 0 ? marge * (1 - rate / 100) : marge, margeCA: CA ? marge / CA * 100 : null, margeCout: cost ? marge / cost * 100 : null }
  }
  function compute () {
    const R = { ok:false }
    const sup = S.superficie
    const foncier = prixGlobal()
    R.foncier = foncier
    const t = S.type
    const rd = S.rdt
    const f = foncier ?? 0
    if (['lotissement', 'activites'].includes(t)) {
      if (empty(sup) ? true : empty(rd.lot)) { R.why = 'Renseignez la superficie et la taille des lots.'
        return R }
      const voies = sup * (rd.voiesPct ?? 0) / 100
      const cessible = sup - voies
      const nLots = Math.floor(cessible / rd.lot)
      const vendu = nLots * rd.lot
      const vrd = sup * (rd.vrd ?? 0)
      const caB = vendu * (rd.pvBas ?? 0)
      const caH = vendu * (rd.pvHaut ?? 0)
      const fB = caB * (rd.fraisLot ?? 0) / 100
      const fH = caH * (rd.fraisLot ?? 0) / 100
      Object.assign(R, { ok:true, voies, cessible, nLots, vendu, vrd, bas: scenario(caB, f + vrd + fB), haut: scenario(caH, f + vrd + fH), revient: vendu ? (f + vrd) / vendu : null })
      R.foncierMax = caB * (1 - (rd.cible ?? 20) / 100) - vrd - fB
      R.foncierMaxM2 = R.foncierMax / sup
      R.headline = `${fmt(nLots)} lots, jusqu’à ${mdh(caH)} MDH de ventes`
      return R
    }
    if (t === 'promotion') {
      const base = orv(surfaceNette(), sup)
      let constr = null
      let modeTxt = ''
      if (rd.mode === 'saisie') { constr = rd.constructible
        modeTxt = 'surface annoncée' }
      else if (rd.mode === 'cus') { const c = num(S.cus)
        if (c && base) { constr = base * c
          modeTxt = `CUS de ${fmt(c, 2)}` } }
      else { const n = niveauxN()
        if (n != null && S.emprise && base) { constr = base * S.emprise / 100 * (n + 1)
          modeTxt = `${fmt(S.emprise)} % d’emprise sur ${n + 1} niveaux` } }
      if (empty(constr)) { R.why = 'Renseignez l’emprise et les niveaux, le CUS, ou une surface constructible.'
        return R }
      const vend = constr * (rd.vendablePct ?? 83) / 100
      const cc = constr * (rd.coutConstr ?? 0)
      const caB = vend * (rd.pvBas ?? 0)
      const caH = vend * (rd.pvHaut ?? 0)
      const fB = caB * (rd.fraisPromo ?? 0) / 100
      const fH = caH * (rd.fraisPromo ?? 0) / 100
      Object.assign(R, { ok:true, base, constr, modeTxt, vend, cc, bas: scenario(caB, f + cc + fB), haut: scenario(caH, f + cc + fH), chargeFonciere: vend ? f / vend : null })
      R.foncierMax = caB * (1 - (rd.cible ?? 20) / 100) - cc - fB
      R.foncierMaxM2 = sup ? R.foncierMax / sup : null
      R.headline = `${fmt(constr)} m² constructibles, jusqu’à ${mdh(caH)} MDH de ventes`
      return R
    }
    if (t === 'villa') {
      const n = niveauxN()
      const base = orv(surfaceNette(), sup)
      if (empty(base) ? true : n == null) { R.why = 'Renseignez la superficie et les niveaux (R+n).'
        return R }
      const emp = orv(S.emprise, 60)
      const constr = base * emp / 100 * (n + 1)
      const vend = constr * (rd.vendablePct ?? 83) / 100
      const cc = constr * (rd.coutConstr ?? 0)
      Object.assign(R, { ok:true, base, constr, vend, cc, modeTxt:`${fmt(emp)} % d’emprise sur ${n + 1} niveaux`, bas: scenario(vend * rd.pvBas, f + cc), haut: scenario(vend * rd.pvHaut, f + cc) })
      R.headline = `${fmt(constr)} m² à bâtir, revente jusqu’à ${mdh(R.haut.CA)} MDH`
      return R
    }
    if (t === 'immeuble') {
      const pg = S.prixGlobal
      const su = S.surfaceUtile
      if (empty(pg) ? true : empty(su)) { R.why = 'Renseignez le prix global et la surface utile.'
        return R }
      const pxm2 = pg / su
      const pm = rd.prixMarche
      const loyerAn = rd.loyer ? rd.loyer * 12 : null
      const coutAcq = pg * (1 + (rd.fraisAcq ?? 0) / 100)
      Object.assign(R, { ok:true, pg, su, pxm2, pm, ecart: pm ? pm - pxm2 : null, decote: pm ? (pm - pxm2) / pm * 100 : null, valeurMarche: pm ? pm * su : null,
        brut: loyerAn ? loyerAn / pg * 100 : null,
        net: loyerAn ? (loyerAn * (1 - (rd.vacance ?? 0) / 100) - (rd.charges ?? 0)) / coutAcq * 100 : null,
        commission: rd.commission ? pg * rd.commission / 100 : null })
      R.headline = R.decote != null && R.decote > 0 ? `${fmt(R.decote, 0)} % sous le prix du marché` : `${fmt(pxm2)} DH par m² utile`
      return R
    }
    return R
  }

  /* repère marché : mêmes données que la Valorisation du CRM */
  let pool = null
  async function loadPool () {
    if (typeof window.mvLoad !== 'function' ? true : typeof window.mvPool !== 'function') return null
    try { await window.mvLoad()
      pool = true } catch (e) { pool = null }
    return pool
  }
  const quant = (a, q) => { const s = a.slice().sort((x, y) => x - y)
    if (!s.length) return null
    const p = (s.length - 1) * q
    const lo = Math.floor(p)
    const hi = Math.ceil(p)
    return s[lo] + (s[hi] - s[lo]) * (p - lo) }
  function market () {
    if (!pool) return null
    const d = typeof MV === 'undefined' ? null : MV.data
    if (!d) return null
    const norm = typeof mvN === 'function' ? mvN : (x => slug(x))
    const q = orv(S.quartier, S.nom)
    const sec = d && d.qsect ? d.qsect[norm(q ?? '')] : null
    const fam = famille()
    const sup = S.superficie
    const qn = norm(q ?? '')
    const inRange = r => empty(sup) ? true : (r.sup >= sup * 0.3 && r.sup <= sup * 3)
    let base = []
    try { base = window.mvPool(S.crmId ? S.crmId : null) } catch (e) { return null }
    const tiers = [
      ['même quartier, même zonage, surface comparable', r => qn && norm(r.q) === qn && (!fam ? true : r.fam === fam) && inRange(r)],
      ['même secteur, même zonage, surface comparable', r => sec && r.sec === sec && (!fam ? true : r.fam === fam) && inRange(r)],
      ['même secteur, même zonage', r => sec && r.sec === sec && (!fam ? true : r.fam === fam)],
      ['même secteur, tous zonages', r => sec && r.sec === sec]
    ]
    let rows = []
    let scope = ''
    for (const [label, test] of tiers) { rows = base.filter(test)
      scope = label
      if (rows.length >= 5) break }
    if (!rows.length) return { none:true, sec }
    const med0 = quant(rows.map(r => r.prix), 0.5)
    const kept = rows.filter(r => r.prix <= med0 * 2 && r.prix >= med0 / 2)
    const ps = kept.map(r => r.prix)
    const m = { n: kept.length, scope, sec, p25: quant(ps, 0.25), med: quant(ps, 0.5), p75: quant(ps, 0.75), rows: kept.slice().sort((a, b) => Math.abs(a.sup - (sup ?? a.sup)) - Math.abs(b.sup - (sup ?? b.sup))).slice(0, 40) }
    m.fiab = scope.includes('tous zonages') ? 'faible' : m.n >= 15 ? 'bonne' : m.n >= 5 ? 'moyenne' : 'faible'
    if (!empty(S.prix) && S.type !== 'immeuble') m.verdict = S.prix < m.p25 ? 'Sous le marché' : S.prix <= m.p75 ? 'Dans le marché' : 'Ambitieux'
    return m
  }

  /* ---------- images des slides ---------- */
  const fitCache = new Map()
  const loadImg = src => new Promise((res, rej) => { const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src })
  function fit (src, w, h, mode, gray) {
    if (!src) return Promise.resolve('')
    const key = [src, w, h, mode, gray].join('~')
    if (fitCache.has(key)) return fitCache.get(key)
    const p = (async () => {
      try {
        const img = await loadImg(src)
        const iw = img.naturalWidth > 0 ? img.naturalWidth : w
        const ih = img.naturalHeight > 0 ? img.naturalHeight : h
        const cv = document.createElement('canvas')
        cv.width = w
        cv.height = h
        const ctx = cv.getContext('2d')
        const k = mode === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)
        ctx.drawImage(img, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k)
        if (gray) {
          const d = ctx.getImageData(0, 0, w, h)
          const px = d.data
          let i = 0
          while (i < px.length) {
            const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) * 0.8
            px[i] = g
            px[i + 1] = g
            px[i + 2] = g
            i += 4
          }
          ctx.putImageData(d, 0, 0)
        }
        return mode === 'cover' ? cv.toDataURL('image/jpeg', 0.85) : cv.toDataURL('image/png')
      } catch (e) { return '' }
    })()
    fitCache.set(key, p)
    return p
  }

  /* ---------- slides (gabarit Sidi Moumen) ---------- */
  const F_D = "font-family:'Archivo Black', Arial, sans-serif"
  const F_M = "font-family:'Space Mono', 'Courier New', monospace"
  const SEC = 'padding:128px 128px 160px'
  const foot = (dark, n, logos) => `<img src="${dark ? logos.dark : logos.light}" alt="GREENFIELD" style="position:absolute;left:128px;bottom:64px;width:200px;height:32px;object-fit:contain">
<p style="position:absolute;right:128px;bottom:64px;width:200px;text-align:right;font-size:24px;color:${dark ? '#7E9A88' : '#3E5A49'}">${n}</p>`
  const eyebrow = (txt, dark) => `<p style="${F_M};font-size:26px;letter-spacing:6px;text-transform:uppercase;color:${dark ? '#85D9AF' : '#2F6B4B'}">${esc(txt)}</p>`
  const card = (big, small, kind, size) => {
    const st = kind === 'dark' ? ['background:#0B1F13', '#85D9AF', '#D5E2D8'] : kind === 'mint' ? ['background:#85D9AF', '#0B1F13', '#0B1F13'] : ['background:#F8FAF6;border:1px solid #D7E0D8', '#0B1F13', '#3E5A49']
    const s = size ?? 76
    return `<div style="display:flex;flex-direction:column;gap:${s > 60 ? 12 : 8}px;${st[0]};border-radius:16px;padding:${s > 60 ? '44px' : '28px 32px'}">
<p style="${F_D};font-size:${s}px;line-height:1.05;color:${st[1]}">${esc(big)}</p>
<p style="font-size:${s > 60 ? 30 : 26}px;line-height:1.3;color:${st[2]}">${esc(small)}</p></div>`
  }
  function surfTxt (m2) {
    if (empty(m2)) return ''
    if (m2 >= 10000) { const ha = m2 / 10000
      return `${fmt(ha, Math.round(ha) === ha ? 0 : 1)} hectare${ha >= 2 ? 's' : ''}` }
    return `${fmt(m2)} m²`
  }
  function zoneTxt () {
    if (S.secteur && S.zone && !String(S.secteur).toUpperCase().startsWith(String(S.zone).toUpperCase())) return `zones ${S.zone} et ${S.secteur}`
    if (S.secteur) return `secteur ${S.secteur}`
    if (S.zone) return `zone ${S.zone}`
    return ''
  }
  function autoTexts () {
    const fam = famille()
    const lieu = orv(S.quartier, S.ville)
    const what = S.type === 'immeuble' ? 'Immeuble' : 'Terrain'
    const sz = S.type === 'immeuble' ? (S.surfaceUtile ? `de ${fmt(S.surfaceUtile)} m² utiles` : '') : (S.superficie ? `de ${surfTxt(S.superficie)}` : '')
    return {
      accroche: [what, sz, zoneTxt() ? `en ${zoneTxt()}` : '', lieu ? `à ${lieu}` : ''].filter(Boolean).join(' ') + '.',
      opp: S.type === 'immeuble' ? `Un immeuble livré à ${orv(S.quartier, S.ville) ?? ''}` : [surfTxt(S.superficie), fam && FAM_LABEL[fam] ? `en zone ${FAM_LABEL[fam]}` : '', S.ville ? `à ${S.ville}` : ''].filter(Boolean).join(' '),
      sit: S.reperes[0] && S.reperes[0].nom ? `${S.reperes[0].pos}, ${S.reperes[0].nom}` : [S.quartier, S.ville].filter(Boolean).join(', '),
      sitPhrase: S.acces ? S.acces + '.' : '',
      urb: [S.zone ? `Zone ${S.zone}` : '', S.niveaux ? S.niveaux : ''].filter(Boolean).join(', ')
    }
  }
  const tx = k => clean(orv(S.tx[k], autoTexts()[k]))

  async function buildSlides (logos) {
    const R = compute()
    const pick = role => S.images.filter(i => i.role === role)
    const coverIm = S.images.find(i => i.cover) ?? pick('sat')[0] ?? pick('photo')[0]
    const satIm = pick('sat')[0] ?? coverIm
    const planIm = pick('plan')[0]
    const photos = pick('photo').slice(0, 3)
    const pw = photos.length === 1 ? 1664 : photos.length === 2 ? 820 : 538
    const [coverSrc, satSrc, planSrc, ...photoSrc] = await Promise.all([
      coverIm ? fit(imgSrc(coverIm), 1920, 1080, 'cover', true) : '',
      satIm ? fit(imgSrc(satIm), 860, 514, 'cover') : '',
      planIm ? fit(imgSrc(planIm), 800, 498, 'contain') : '',
      ...photos.map(p => fit(imgSrc(p), pw, 560, 'cover'))
    ])
    const out = []
    const isImm = S.type === 'immeuble'
    const sup = S.superficie
    const pg = prixGlobal()
    const net = surfaceNette()
    const nom = orv(S.nom, 'Terrain')

    const big1 = isImm ? (S.surfaceUtile ? `${fmtAuto(S.surfaceUtile)} m²` : '') : (sup ? `${fmt(sup)} m²` : '')
    const big2 = isImm ? (pg ? `${mdh(pg)} MDH` : 'Sur demande') : (S.prix ? `${fmt(S.prix)} DH/m²` : 'Prix sur demande')
    const nameSize = nom.length <= 10 ? 220 : nom.length <= 16 ? 170 : nom.length <= 22 ? 130 : 104
    out.push({ id:'cover', dark:true, html:`<section class="gf-slide" style="background:#0b1f13;font-family:Inter, Arial, sans-serif">
${coverSrc ? `<img src="${coverSrc}" alt="" style="position:absolute;top:0;left:0;width:1920px;height:1080px;opacity:0.45">` : ''}
<div style="position:absolute;top:0;left:0;width:1920px;height:1080px;background:linear-gradient(180deg, rgba(11,31,19,.35) 0%, rgba(11,31,19,.75) 40%, #0b1f13 62%)"></div>
<h1 style="position:absolute;top:120px;left:120px;width:1664px;${F_D};font-size:${nameSize}px;font-weight:400;line-height:1;letter-spacing:-4px;text-transform:uppercase;color:#edf1ea">${esc(nom)}</h1>
<p style="position:absolute;top:${120 + nameSize + 28}px;left:128px;width:1664px;${F_M};font-size:30px;letter-spacing:12px;text-transform:uppercase;color:#85d9af">${esc([S.ville, S.quartier].filter(Boolean).join(' · '))}</p>
<p style="position:absolute;top:520px;left:128px;width:1500px;font-size:44px;line-height:1.35;color:#edf1ea">${esc(tx('accroche'))}</p>
<div style="position:absolute;top:701px;left:128px;width:1664px;height:150px;display:flex;flex-direction:row;gap:80px;padding:32px 0 0;border-top:1px solid #2c4a37">
${big1 ? `<div style="display:flex;flex-direction:column;gap:8px"><p style="${F_D};font-size:60px;line-height:1;white-space:nowrap;color:#85d9af">${esc(big1)}</p><p style="font-size:26px;color:#b7ccbe">${isImm ? 'Surface utile' : 'Superficie totale'}</p></div>` : ''}
<div style="display:flex;flex-direction:column;gap:8px"><p style="${F_D};font-size:60px;line-height:1;white-space:nowrap;color:#85d9af">${esc(big2)}</p><p style="font-size:26px;color:#b7ccbe">${isImm ? 'Prix global' : 'Prix demandé'}${S.negociable ? ', négociable' : ''}</p></div>
</div>
<img src="${logos.cover}" alt="GREENFIELD" style="position:absolute;right:128px;bottom:80px;width:520px;height:81px;object-fit:contain">
</section>` })

    const cards = []
    if (isImm) {
      cards.push(card(orv(fmtAuto(S.surfaceUtile), 'nc'), 'm² de surface utile totale', 'dark'))
      cards.push(card(orv(orv(S.lotsImmeuble, S.niveaux), 'nc'), S.lotsImmeuble ? 'lots composant l’immeuble' : 'niveaux', 'dark', String(S.lotsImmeuble ?? '').length > 8 ? 56 : 76))
      cards.push(card(pg ? mdh(pg) : 'Sur demande', pg ? `MDH, prix global (${fmt(pg)} DH)` : 'prix global', 'mint'))
      cards.push(card(R.pxm2 ? fmt(R.pxm2) : 'nc', 'DH par m² de surface utile', 'light'))
      cards.push(card(sup ? `${fmt(sup)} m²` : 'nc', `de terrain${S.tf ? ', ' + S.tf : ''}`, 'light', 64))
      cards.push(card(orv(S.niveaux, 'nc'), S.hauteur ? `${S.hauteur} m de hauteur` : 'niveaux', 'light'))
    } else {
      cards.push(card(sup ? fmt(sup) : 'nc', 'm² de superficie totale', 'dark'))
      if (net) cards.push(card(fmt(net), 'm² de ' + (S.decomposition.find(x => x.m2 === net)?.label ?? 'surface nette').toLowerCase(), 'dark'))
      else if (R.ok && R.nLots) cards.push(card(fmt(R.nLots), `lots de ${fmt(S.rdt.lot)} m² possibles`, 'dark'))
      else if (R.ok && R.constr) cards.push(card(fmt(R.constr), 'm² constructibles estimés', 'dark'))
      else cards.push(card(S.tf ? S.tf.replace(/^TF\s*/i, '') : 'nc', S.tf ? 'titre foncier' : 'surface nette à préciser', 'dark', 64))
      cards.push(card(pg ? mdh(pg) : 'Sur demande', pg ? `MDH, prix global (${fmt(pg)} DH)` : 'prix global', 'mint'))
      cards.push(card(S.prix ? fmt(S.prix) : 'nc', `DH par m², prix demandé${S.negociable ? ', négociable' : ''}`, 'light'))
      cards.push(card(orv(orv(S.secteur, S.zone), 'nc'), [FAM_LABEL[famille()] ? 'zone ' + FAM_LABEL[famille()] : 'zonage', S.emprise ? `${fmt(S.emprise)} % d’emprise` : ''].filter(Boolean).join(', '), 'light'))
      cards.push(card(orv(S.niveaux, 'nc'), S.hauteur ? `${S.hauteur} m de hauteur maximale` : 'hauteur autorisée', 'light'))
    }
    out.push({ id:'opportunite', dark:false, html:`<section class="gf-slide" style="background:#EDF1EA;color:#0B1F13;font-family:Inter, Arial, sans-serif;${SEC};display:flex;flex-direction:column;gap:48px">
<div style="display:flex;flex-direction:column;gap:20px">${eyebrow('§ L’opportunité')}<h2 style="${F_D};font-size:76px;font-weight:400;line-height:1.1;letter-spacing:-1px">${esc(tx('opp'))}</h2></div>
<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:24px">${cards.join('')}</div>
§F</section>` })

    const reps = S.reperes.filter(r => r.nom).slice(0, 4)
    const mapsLine = S.maps ? `<div style="display:flex;justify-content:space-between;border-top:1px solid #2C4A37;border-bottom:1px solid #2C4A37;padding:16px 0px"><p style="font-size:28px;color:#EDF1EA"><a href="${attr(S.maps)}">Voir sur Google Maps</a></p><p style="font-size:28px;color:#85D9AF">${esc(orv(S.quartier, S.ville) ?? '')}</p></div>` : ''
    out.push({ id:'situation', dark:true, html:`<section class="gf-slide" style="background:#0B1F13;color:#EDF1EA;font-family:Inter, Arial, sans-serif;${SEC};display:flex;flex-direction:row;align-items:center;gap:64px">
<div style="position:relative;display:flex;width:860px;height:514px;flex:none;border-radius:16px;overflow:hidden;background:#10291A">
${satSrc ? `<img src="${satSrc}" alt="Vue de situation" style="width:860px;height:514px">` : `<p style="margin:auto;font-size:26px;color:#7E9A88">Vue satellite à ajouter</p>`}
${satSrc ? `<p style="position:absolute;left:335px;top:233px;width:190px;font-size:24px;font-weight:700;text-align:center;white-space:nowrap;background:#85D9AF;color:#0B1F13;padding:8px 18px;border-radius:999px">${isImm ? 'L’immeuble' : 'Le terrain'}</p>` : ''}
</div>
<div style="flex:1;display:flex;flex-direction:column;gap:24px">${eyebrow('§ Situation', true)}
<h2 style="${F_D};font-size:52px;font-weight:400;line-height:1.1;letter-spacing:-1px;color:#EDF1EA">${esc(tx('sit'))}</h2>
${tx('sitPhrase') ? `<p style="font-size:28px;line-height:1.45;color:#B7CCBE">${esc(tx('sitPhrase'))}</p>` : ''}
<div style="display:flex;flex-direction:column">
${reps.map((r, i) => `<div style="display:flex;justify-content:space-between;gap:24px;border-top:1px solid #2C4A37;${!mapsLine && i === reps.length - 1 ? 'border-bottom:1px solid #2C4A37;' : ''}padding:16px 0px"><p style="font-size:28px;color:#EDF1EA">${esc(r.nom)}</p><p style="font-size:28px;color:#85D9AF;white-space:nowrap">${esc(r.pos)}</p></div>`).join('')}
${mapsLine}</div></div>
§F</section>` })

    const dec = S.decomposition.filter(x => num(x.m2))
    const COLORS = ['#85D9AF', '#0B1F13', '#2F6B4B', '#9DB3A5', '#C9D6CC', '#5E8A6E']
    const planBox = `<div style="display:flex;flex-direction:column;gap:16px;flex:none">
<div style="display:flex;background:#F8FAF6;border:1px solid #D7E0D8;border-radius:16px;padding:16px">${planSrc ? `<img src="${planSrc}" alt="Plan" style="width:800px;height:498px;border-radius:8px">` : `<div style="width:800px;height:498px;display:flex;align-items:center;justify-content:center;font-size:26px;color:#9DB3A5">Plan à ajouter</div>`}</div>
${planSrc ? `<p style="font-size:24px;color:#3E5A49">${isImm ? 'Plan de l’immeuble.' : 'Extrait du plan, périmètre du terrain.'}</p>` : ''}</div>`
    if (dec.length >= 2) {
      const tot = dec.reduce((a, x) => a + x.m2, 0)
      const ref = orv(sup, tot)
      const title = isImm ? `${fmtAuto(tot)} m² répartis sur ${dec.length} niveaux` : `${fmt(dec[0].m2 / ref * 100, 0)} % de ${String(dec[0].label ?? '').toLowerCase()}`
      out.push({ id:'foncier', dark:false, html:`<section class="gf-slide" style="background:#EDF1EA;color:#0B1F13;font-family:Inter, Arial, sans-serif;${SEC};display:flex;flex-direction:row;align-items:center;gap:64px">
${planBox}
<div style="flex:1;display:flex;flex-direction:column;gap:28px">${eyebrow(isImm ? '§ Surfaces' : '§ Composition foncière')}
<h2 style="${F_D};font-size:52px;font-weight:400;line-height:1.1;letter-spacing:-1px">${esc(title)}</h2>
<div style="display:flex;flex-direction:row;height:28px;border-radius:999px;overflow:hidden">${dec.map((x, i) => `<div style="flex:${Math.max(1, Math.round(x.m2))};background:${COLORS[i % COLORS.length]}"></div>`).join('')}</div>
<div style="display:flex;flex-direction:column">
${dec.slice(0, 7).map((x, i) => `<div style="display:flex;align-items:center;gap:16px;border-top:1px solid #C9D6CC;padding:14px 0px"><div style="width:20px;height:20px;border-radius:999px;background:${COLORS[i % COLORS.length]}"></div><p style="flex:1;font-size:28px;${i === 0 ? 'font-weight:700' : ''}">${esc(x.label)}</p><p style="font-size:28px;white-space:nowrap">${fmtAuto(x.m2)} m²  ·  ${fmt(x.m2 / ref * 100, 1)} %</p></div>`).join('')}
<div style="display:flex;align-items:center;gap:16px;border-top:2px solid #0B1F13;padding:14px 0px"><div style="width:20px;height:20px"></div><p style="flex:1;font-size:28px;font-weight:700">${isImm ? 'Surface totale' : 'Superficie totale'}</p><p style="font-size:28px;font-weight:700">${fmtAuto(ref)} m²</p></div>
</div></div>
§F</section>` })
    } else if ([planSrc, S.zone, S.refs].some(Boolean)) {
      const rows = [['Zone', S.zone], ['Secteur', S.secteur], ['Titre foncier', S.tf], ['Superficie', sup ? `${fmt(sup)} m²` : '']].filter(r => r[1])
      out.push({ id:'foncier', dark:false, html:`<section class="gf-slide" style="background:#EDF1EA;color:#0B1F13;font-family:Inter, Arial, sans-serif;${SEC};display:flex;flex-direction:row;align-items:center;gap:64px">
${planBox}
<div style="flex:1;display:flex;flex-direction:column;gap:28px">${eyebrow('§ Plan d’aménagement')}
<h2 style="${F_D};font-size:52px;font-weight:400;line-height:1.1;letter-spacing:-1px">${esc(zoneTxt() ? 'Terrain en ' + zoneTxt() : 'Situation au plan')}</h2>
<div style="display:flex;flex-direction:column">${rows.map((r, i) => `<div style="display:flex;justify-content:space-between;gap:24px;border-top:1px solid #C9D6CC;${i === rows.length - 1 ? 'border-bottom:1px solid #C9D6CC;' : ''}padding:16px 0px"><p style="font-size:28px;color:#3E5A49">${esc(r[0])}</p><p style="font-size:28px;font-weight:700">${esc(r[1])}</p></div>`).join('')}</div>
${S.refs ? `<p style="font-size:24px;line-height:1.45;color:#3E5A49">${esc(clean(S.refs))}</p>` : ''}
</div>
§F</section>` })
    }

    if (!isImm && [S.zone, S.secteur, S.cos, S.cus, S.emprise, S.hauteur, S.niveaux, S.lotMin, S.usages].some(v => !empty(v))) {
      const unit = v => /\d$/.test(String(v)) ? `${v} m` : v
      const darkC = [[orv(S.cos, 'Libre'), S.cos ? 'COS' : 'COS non fixé'], [S.cus, 'CUS'], [S.emprise ? `${fmt(S.emprise)} %` : null, 'Emprise au sol max.'], [S.hauteur ? `${S.hauteur} m` : null, S.niveaux ? `Hauteur, ${S.niveaux}` : 'Hauteur maximale'], [S.niveaux && !S.hauteur ? S.niveaux : null, 'Niveaux autorisés']].filter(c => !empty(c[0])).slice(0, 4)
      const lightC = [[S.lotMin ? `${S.lotMin} m²` : null, 'Lot minimum'], [S.facadeMin ? `${S.facadeMin} m` : null, 'Façade minimale'], [S.reculVoies ? unit(S.reculVoies) : null, 'Recul sur voies'], [S.reculLimites ? unit(S.reculLimites) : null, 'Limites séparatives']].filter(c => !empty(c[0]))
      const all = darkC.map(c => card(c[0], c[1], 'dark', 48)).concat(lightC.map(c => card(c[0], c[1], 'light', 48)))
      const cols = all.length <= 3 ? all.length : all.length === 6 ? 3 : 4
      out.push({ id:'urbanisme', dark:false, html:`<section class="gf-slide" style="background:#EDF1EA;color:#0B1F13;font-family:Inter, Arial, sans-serif;${SEC};display:flex;flex-direction:column;gap:40px">
<div style="display:flex;flex-direction:column;gap:20px">${eyebrow('§ Urbanisme' + (orv(S.secteur, S.zone) ? ', secteur ' + orv(S.secteur, S.zone) : ''))}
<h2 style="${F_D};font-size:76px;font-weight:400;line-height:1.1;letter-spacing:-1px">${esc(orv(tx('urb'), 'Règles de la zone'))}</h2></div>
${S.usages ? `<p style="font-size:30px;line-height:1.45;width:1500px;color:#3E5A49">${esc(clean(S.usages))}</p>` : ''}
${all.length ? `<div style="display:grid;grid-template-columns:repeat(${Math.max(1, cols)}, 1fr);gap:16px">${all.join('')}</div>` : ''}
§F</section>` })
    }

    if (R.ok) out.push({ id:'rendement', dark:false, html: rendementSlide(R) })

    if (photoSrc.length) {
      out.push({ id:'site', dark:false, html:`<section class="gf-slide" style="background:#EDF1EA;color:#0B1F13;font-family:Inter, Arial, sans-serif;${SEC};display:flex;flex-direction:column;gap:48px">
<div style="display:flex;flex-direction:column;gap:20px">${eyebrow('§ Le site')}<h2 style="${F_D};font-size:76px;font-weight:400;line-height:1.1;letter-spacing:-1px">${isImm ? 'L’immeuble en images' : 'Le terrain en images'}</h2></div>
<div style="display:flex;gap:24px">${photoSrc.map(s => `<img src="${s}" alt="Photo du site" style="width:${pw}px;height:560px;border-radius:16px">`).join('')}</div>
§F</section>` })
    }

    const serv = S.servitudes.filter(x => x.c).map(x => [x.c, x.d, x.s])
    if (S.statut && S.statut !== 'Titré') serv.push(['Statut foncier', S.statut, 'Vendeur'])
    if (S.viabRenseignee) {
      const miss = ['Eau', 'Électricité', 'Assainissement', 'Voirie'].filter(v => !S.viab.includes(v))
      if (miss.length) serv.push(['Viabilisation', `À réaliser : ${miss.join(', ').toLowerCase()}`, 'Visite'])
    }
    if (S.bati === 'À démolir') serv.push(['Bâti existant', 'Constructions à démolir, coût à intégrer', 'Visite'])
    if (S.occupation && S.occupation !== 'Libre') serv.push(['Occupation', S.occupation, 'Vendeur'])
    if (S.topo === 'Accidenté') serv.push(['Topographie', 'Terrain accidenté, terrassements à prévoir', 'Visite'])
    if (serv.length) {
      out.push({ id:'servitudes', dark:true, html:`<section class="gf-slide" style="background:#0B1F13;color:#EDF1EA;font-family:Inter, Arial, sans-serif;${SEC};display:flex;flex-direction:column;gap:40px">
<div style="display:flex;flex-direction:column;gap:20px">${eyebrow('§ Servitudes', true)}<h2 style="${F_D};font-size:76px;font-weight:400;line-height:1.1;letter-spacing:-1px;color:#EDF1EA">Points à intégrer au projet</h2></div>
<table style="font-size:26px;color:#EDF1EA;border:1px solid #2C4A37">
<tr style="background:#85D9AF"><th style="width:28%;color:#0B1F13">Contrainte</th><th style="width:52%;color:#0B1F13">Détail</th><th style="width:20%;color:#0B1F13">Source</th></tr>
${serv.slice(0, 7).map((r, i) => `<tr style="background:${i % 2 ? '#0B1F13' : '#10291A'}"><td>${esc(clean(r[0]))}</td><td>${esc(clean(r[1]))}</td><td>${esc(clean(r[2]))}</td></tr>`).join('')}
</table>
${S.refs ? `<p style="font-size:24px;line-height:1.45;color:#7E9A88">${esc(clean(S.refs))}</p>` : ''}
§F</section>` })
    }

    out.push({ id:'contact', dark:true, html:`<section class="gf-slide" style="background:#0B1F13;color:#EDF1EA;font-family:Inter, Arial, sans-serif;${SEC};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:72px">
<img src="${logos.contact}" alt="GREENFIELD, exigez plus" style="width:940px;height:220px;object-fit:contain">
<div style="display:flex;gap:64px;align-items:center"><p style="font-size:32px;color:#EDF1EA">www.greenfield.plus</p><p style="font-size:32px;color:#EDF1EA">contact@greenfield.plus</p><p style="font-size:32px;color:#85D9AF">+212 776 250 052</p></div>
<p style="position:absolute;left:260px;bottom:64px;width:1400px;text-align:center;font-size:24px;line-height:1.45;color:#7E9A88">Document confidentiel, non contractuel. Surfaces et règles d’urbanisme sous réserve des opérations topographiques officielles et des documents d’urbanisme en vigueur.</p>
</section>` })

    let sec = 0
    out.forEach((s, i) => {
      s.html = s.html.replace(/§ /g, () => { sec += 1
        return String(sec).padStart(2, '0') + ' ' }).replace('§F', foot(s.dark, i + 1, logos))
    })
    return out
  }

  function rendementSlide (R) {
    const rd = S.rdt
    const t = S.type
    const head = `<div style="display:flex;flex-direction:column;gap:20px">${eyebrow(t === 'immeuble' ? '§ Prix et rendement' : '§ Rendement')}<h2 style="${F_D};font-size:76px;font-weight:400;line-height:1.1;letter-spacing:-1px;color:#0B1F13">${esc(R.headline)}</h2></div>`
    const wrap = inner => `<section class="gf-slide" style="background:#EDF1EA;color:#0B1F13;font-family:Inter, Arial, sans-serif;${SEC};display:flex;flex-direction:column;gap:36px">${head}${inner}§F</section>`
    const hyp = (label, sc, mint, extra) => `<div style="display:flex;flex-direction:column;gap:16px;background:${mint ? '#85D9AF' : '#0B1F13'};border-radius:16px;padding:36px 44px">
<p style="${F_M};font-size:24px;letter-spacing:4px;text-transform:uppercase;color:${mint ? '#0B1F13' : '#B7CCBE'}">${esc(label)}</p>
<p style="${F_D};font-size:76px;line-height:1.0;color:${mint ? '#0B1F13' : '#85D9AF'}">${mdh(sc.CA)} MDH</p>
<p style="font-size:28px;line-height:1.4;color:${mint ? '#0B1F13' : '#D5E2D8'}">Chiffre d’affaires (${fmt(sc.CA)} DH). Marge de ${mdh(sc.marge)} MDH ${extra}, soit ${fmt(sc.margeCA, 1)} % du CA. <b>Après IS de ${fmt(sc.rate)} % : ${mdh(sc.net)} MDH nets.</b></p></div>`
    const isNote = 'IS de 20 % jusqu’à 100 MDH de bénéfice, 35 % au-delà.'
    if (['lotissement', 'activites'].includes(t)) {
      const grid = [card(`${fmt(S.superficie)} m²`, 'Superficie totale', 'light', 48), card(`${fmt(R.voies)} m²`, `Voiries et équipements, ${fmt(rd.voiesPct)} %`, 'light', 48), card(`${fmt(R.cessible)} m²`, `Surface cessible, ${fmt(100 - rd.voiesPct)} %`, 'light', 48), card(`${fmt(R.nLots)} lots`, `de ${fmt(rd.lot)} m²${S.secteur ? ' (' + S.secteur + ')' : ''}, soit ${fmt(R.vendu)} m²`, 'light', 48)]
      const extra = rd.fraisLot ? 'après foncier, VRD et frais' : 'après foncier et VRD'
      const note = `Foncier ${mdh(R.foncier ?? 0)} MDH et VRD ${mdh(R.vrd)} MDH (${fmt(rd.vrd)} DH/m² sur ${fmt(S.superficie)} m²), soit ${mdh((R.foncier ?? 0) + R.vrd)} MDH ou ${fmt(R.revient)} DH par m² vendu.${rd.fraisLot ? ` Frais d’autorisation et de commercialisation de ${fmt(rd.fraisLot)} % du CA.` : ' Avant frais d’autorisation et de commercialisation.'} ${isNote}`
      return wrap(`<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:16px">${grid.join('')}</div>
<div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:24px">${hyp(`Hypothèse basse · ${fmt(rd.pvBas)} DH/m²`, R.bas, false, extra)}${hyp(`Hypothèse haute · ${fmt(rd.pvHaut)} DH/m²`, R.haut, true, extra)}</div>
<p style="font-size:24px;line-height:1.45;width:1600px;color:#3E5A49">${esc(note)}</p>`)
    }
    if (['promotion', 'villa'].includes(t)) {
      const grid = [card(`${fmt(R.base)} m²`, S.surfaceNette ? 'Surface nette' : 'Superficie du terrain', 'light', 48), card(`${fmt(R.constr)} m²`, `Constructible, ${R.modeTxt}`, 'light', 48), card(`${fmt(R.vend)} m²`, `Vendable, ${fmt(rd.vendablePct)} %`, 'light', 48), card(`${fmt(rd.coutConstr)}`, 'DH/m², coût de construction', 'light', 48)]
      const extra = t === 'promotion' && rd.fraisPromo ? 'après foncier, construction et frais' : 'après foncier et construction'
      const note = `Foncier ${mdh(R.foncier ?? 0)} MDH${R.chargeFonciere ? `, soit ${fmt(R.chargeFonciere)} DH par m² vendable` : ''}. Construction ${mdh(R.cc)} MDH.${t === 'promotion' && rd.fraisPromo ? ` Frais annexes de ${fmt(rd.fraisPromo)} % du CA (études, autorisations, commercialisation).` : ''} ${isNote}`
      return wrap(`<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:16px">${grid.join('')}</div>
<div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:24px">${hyp(`Hypothèse basse · ${fmt(rd.pvBas)} DH/m²`, R.bas, false, extra)}${hyp(`Hypothèse haute · ${fmt(rd.pvHaut)} DH/m²`, R.haut, true, extra)}</div>
<p style="font-size:24px;line-height:1.45;width:1600px;color:#3E5A49">${esc(note)}</p>`)
    }
    if (t === 'immeuble') {
      const eq = `<div style="display:flex;flex-direction:row;align-items:center;gap:32px;border-top:1px solid #C9D6CC;border-bottom:1px solid #C9D6CC;padding:40px 0px">
<div style="display:flex;flex-direction:column;gap:8px"><p style="${F_D};font-size:54px;line-height:1.1;white-space:nowrap">${fmt(R.pg)} DH</p><p style="font-size:26px;color:#3E5A49">Prix global</p></div>
<p style="${F_D};font-size:54px;color:#9DB3A5">/</p>
<div style="display:flex;flex-direction:column;gap:8px"><p style="${F_D};font-size:54px;line-height:1.1;white-space:nowrap">${fmtAuto(R.su)} m²</p><p style="font-size:26px;color:#3E5A49">Surface utile</p></div>
<p style="${F_D};font-size:54px;color:#9DB3A5">=</p>
<div style="display:flex;flex-direction:column;gap:8px"><p style="${F_D};font-size:54px;line-height:1.1;white-space:nowrap;color:#2F6B4B">${fmt(R.pxm2)} DH/m²</p><p style="font-size:26px;color:#3E5A49">Prix au m² de l’immeuble</p></div></div>`
      const c = []
      if (R.pm) c.push(card(`${fmt(R.pm)} DH/m²`, 'Prix du marché dans le quartier', 'light', 48))
      if (R.decote != null) c.push(card(`${fmt(Math.abs(R.ecart))} DH/m²`, R.decote >= 0 ? `d’écart, soit ${fmt(R.decote, 1)} % sous le marché` : `au-dessus du marché, soit ${fmt(-R.decote, 1)} %`, 'mint', 48))
      if (R.brut != null) c.push(card(`${fmt(R.brut, 1)} %`, `Rendement brut, ${fmt(R.net, 1)} % net de vacance, charges et frais`, 'dark', 48))
      if (R.commission) c.push(card(`${fmt(R.commission)} DH`, `Commission de sourcing, ${fmt(rd.commission, 1)} %, à la charge du vendeur`, 'light', 48))
      if (R.valeurMarche && c.length < 3) c.push(card(`${mdh(R.valeurMarche)} MDH`, 'Valeur au prix du marché', 'light', 48))
      return wrap(`${eq}${c.length ? `<div style="display:grid;grid-template-columns:repeat(${Math.min(c.length, 4)}, 1fr);gap:24px">${c.join('')}</div>` : ''}`)
    }
    return ''
  }

  /* ---------- rendu ---------- */
  let timer = null
  let seqN = 0
  function schedule () { clearTimeout(timer)
    timer = setTimeout(render, 280) }
  async function render () {
    if (!root) return
    const seq = ++seqN
    renderSummary()
    const slides = await buildSlides(LOGO)
    if (seq !== seqN) return
    $('#tz-deck').innerHTML = slides.map((s, i) => `<div class="frame"><span class="tag">${i + 1} ${s.id}</span><div class="stage">${s.html}</div></div>`).join('')
    scaleFrames()
    $('#tz-deck-title').textContent = `Aperçu du teaser, ${slides.length} slides`
  }
  function scaleFrames () { $$('.frame').forEach(f => { f.querySelector('.stage').style.transform = `scale(${f.clientWidth / 1920})` }) }

  function renderSummary () {
    const R = compute()
    const M = market()
    const pg = prixGlobal()
    const tiles = []
    tiles.push(`<div class="tile dark"><span class="k">${esc(TYPE_LABEL[S.type])}</span><span class="v">${pg ? mdh(pg) + ' MDH' : 'Prix sur demande'}</span><span class="s">${pg ? fmt(pg) + ' DH' : 'Saisissez le prix'}</span></div>`)
    if (R.ok && R.bas) {
      tiles.push(`<div class="tile"><span class="k">CA bas et haut</span><span class="v">${mdh(R.bas.CA)} à ${mdh(R.haut.CA)}</span><span class="s">MDH${R.nLots ? `, ${fmt(R.nLots)} lots` : R.vend ? `, ${fmt(R.vend)} m² vendables` : ''}</span></div>`)
      const m = R.bas.margeCA
      tiles.push(`<div class="tile"><span class="k">Marge hypothèse basse</span><span class="v">${mdh(R.bas.marge)} MDH</span><span class="chip ${m >= 25 ? 'good' : m >= 12 ? 'warn' : 'bad'}">${fmt(m, 1)} % du CA, ${fmt(R.bas.margeCout, 1)} % du coût</span></div>`)
      if (R.foncierMaxM2 != null) tiles.push(`<div class="tile"><span class="k">Foncier max. acquéreur</span><span class="v">${fmt(R.foncierMaxM2)} DH/m²</span><span class="s">pour ${fmt(S.rdt.cible ?? 20)} % de marge sur le CA bas${S.prix ? (R.foncierMaxM2 >= S.prix ? ', prix demandé couvert' : ', sous le prix demandé') : ''}</span></div>`)
    } else if (R.ok && S.type === 'immeuble') {
      tiles.push(`<div class="tile"><span class="k">Prix au m² utile</span><span class="v">${fmt(R.pxm2)} DH</span><span class="s">${R.pm ? `marché ${fmt(R.pm)} DH/m²` : 'prix du marché à saisir'}</span></div>`)
      tiles.push(`<div class="tile"><span class="k">Décote</span><span class="v">${R.decote != null ? fmt(R.decote, 1) + ' %' : 'nc'}</span>${R.decote != null ? `<span class="chip ${R.decote > 10 ? 'good' : R.decote > 0 ? 'warn' : 'bad'}">${R.decote > 0 ? 'sous le marché' : 'au-dessus du marché'}</span>` : '<span class="s">avec le prix du marché</span>'}</div>`)
      tiles.push(`<div class="tile"><span class="k">Rendement</span><span class="v">${R.brut != null ? fmt(R.brut, 1) + ' % brut' : 'nc'}</span><span class="s">${R.net != null ? fmt(R.net, 1) + ' % net' : 'avec les loyers'}</span></div>`)
    } else if (R.why) {
      tiles.push(`<div class="tile"><span class="k">Rendement</span><span class="v">À compléter</span><span class="s">${esc(R.why)}</span></div>`)
    }
    if (M && !M.none) {
      const cls = M.verdict === 'Sous le marché' ? 'good' : M.verdict === 'Ambitieux' ? 'warn' : 'neutral'
      tiles.push(`<div class="tile"><span class="k">Repère marché</span><span class="v">${fmt(M.p25)} à ${fmt(M.p75)}</span><span class="s">DH/m², médiane ${fmt(M.med)}, ${M.n} comparables, fiabilité ${M.fiab}</span>${M.verdict ? `<span class="chip ${cls}">${M.verdict}</span>` : ''}</div>`)
    } else if (S.type !== 'immeuble') {
      tiles.push(`<div class="tile"><span class="k">Repère marché</span><span class="v">nc</span><span class="s">${pool ? 'Quartier inconnu des données de marché' : 'Données de marché en chargement'}</span></div>`)
    }
    $('#tz-summary').innerHTML = tiles.join('')
    renderMkt(M)
    const miss = []
    if (!S.nom) miss.push('Nom du terrain')
    if (S.type === 'immeuble' ? !S.prixGlobal : !S.prix) miss.push('Prix, le teaser affichera « Prix sur demande »')
    if (!S.superficie && S.type !== 'immeuble') miss.push('Superficie totale')
    if (!S.images.some(i => i.role === 'sat')) miss.push('Capture satellite pour la couverture et la situation')
    if (!S.images.some(i => i.role === 'plan') && S.type !== 'immeuble') miss.push('Plan pour la composition foncière')
    if (!S.zone && S.type !== 'immeuble') miss.push('Zone et règlement de la note de renseignement')
    if (!S.reperes.length) miss.push('Repères de situation')
    if (!S.maps) miss.push('Lien Google Maps')
    const sum = S.decomposition.reduce((a, x) => a + (num(x.m2) ?? 0), 0)
    if (S.decomposition.length >= 2 && S.superficie && Math.abs(sum - S.superficie) > 1) miss.push(`Décomposition : ${fmt(sum)} m² pour ${fmt(S.superficie)} m² de superficie, écart de ${fmt(Math.abs(sum - S.superficie))} m²`)
    const box = $('#tz-missing')
    box.hidden = !miss.length
    box.innerHTML = miss.length ? `<h4>À compléter ou vérifier</h4><ul>${miss.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''
  }
  function renderMkt (M) {
    const box = $('#tz-mkt')
    if (!M ? true : !!M.none) { box.innerHTML = '<p class="note">Pas de comparables pour ce quartier. Vérifiez l’orthographe du quartier ou utilisez la Valorisation.</p>'
      return }
    box.innerHTML = `<p class="note"><b>${M.n} comparables</b>, ${esc(M.scope)}${M.sec ? ' (' + esc(M.sec) + ')' : ''}. P25 ${fmt(M.p25)}, médiane ${fmt(M.med)}, P75 ${fmt(M.p75)} DH/m². Prix demandés, pas des prix de vente conclus.</p>
<div class="tw"><table><thead><tr><th>Quartier</th><th>Zonage</th><th>Surface m²</th><th>Prix DH/m²</th><th>Source</th></tr></thead><tbody>
${M.rows.map(r => `<tr><td>${esc(r.q)}</td><td>${esc(orv(r.zon, r.fam) ?? '')}</td><td>${fmt(r.sup)}</td><td>${fmt(r.prix)}</td><td>${esc(r.src)}${r.ref ? ' ' + esc(r.ref) : ''}</td></tr>`).join('')}
</tbody></table></div>`
  }

  /* ---------- export ---------- */
  async function dataUrlLogos () {
    const o = {}
    for (const [k, u] of Object.entries(LOGO)) o[k] = await fit(u, k === 'cover' ? 520 : k === 'contact' ? 940 : 200, k === 'cover' ? 81 : k === 'contact' ? 220 : 32, 'contain')
    return o
  }
  const fileBase = () => (S.type === 'immeuble' ? 'Teaser Immeuble ' : 'Teaser Terrain ') + orv(S.nom, 'GREENFIELD')
  function download (name, blob) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(a.href)
      a.remove() }, 1500)
  }
  async function exportPdf () {
    const btn = $('#tz-pdf')
    btn.disabled = true
    try {
      status('Préparation du PDF...')
      if (!window.html2canvas) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
      if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
      await document.fonts.ready
      const logos = await dataUrlLogos()
      const slides = await buildSlides(logos)
      const pdf = new window.jspdf.jsPDF({ orientation:'landscape', unit:'px', format:[1920, 1080], hotfixes:['px_scaling'], compress:true })
      const stage = document.getElementById('tz-offstage')
      for (const [i, s] of slides.entries()) {
        status(`Rendu de la slide ${i + 1} sur ${slides.length}...`)
        stage.innerHTML = s.html
        await Promise.all(Array.from(stage.querySelectorAll('img')).map(im => im.complete ? null : new Promise(r => { im.onload = r
          im.onerror = r })))
        const cv = await window.html2canvas(stage.firstElementChild, { scale:1, scrollX:0, scrollY:0, width:1920, height:1080, windowWidth:1920, windowHeight:1080, backgroundColor:null, logging:false })
        if (i) pdf.addPage([1920, 1080], 'landscape')
        pdf.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 1920, 1080)
      }
      stage.innerHTML = ''
      download(fileBase() + '.pdf', pdf.output('blob'))
      status('PDF téléchargé : ' + fileBase() + '.pdf')
    } catch (e) {
      status('La génération du PDF a échoué. Téléchargez la version HTML puis imprimez-la en PDF.', true)
    } finally { btn.disabled = false }
  }
  async function exportHtml () {
    status('Préparation du fichier HTML...')
    const logos = await dataUrlLogos()
    const slides = await buildSlides(logos)
    const slideCss = CSS.slice(CSS.indexOf('.gf-slide{'))
    const doc = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(fileBase())}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@300..700&family=Space+Mono&display=swap">
<style>${slideCss}
@page{size:1920px 1080px;margin:0}
html,body{margin:0;background:#1c2a21}
.gf-slide{page-break-after:always;break-after:page}
@media screen{body{display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px 0}.gf-slide{zoom:.5}}
</style></head><body>${slides.map(s => s.html).join('\n')}</body></html>`
    download(fileBase() + '.html', new Blob([doc], { type:'text/html' }))
    status('Fichier HTML téléchargé. Ouvrez-le dans Chrome puis imprimez en PDF pour une version vectorielle.')
  }

  /* ---------- montage ---------- */
  function mount () {
    root = document.getElementById('mk-teaser')
    if (!root) return false
    const st = document.createElement('style')
    st.id = 'tz-css'
    st.textContent = CSS
    document.head.appendChild(st)
    const fl = document.createElement('link')
    fl.rel = 'stylesheet'
    fl.href = 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@300..700&family=Space+Mono&display=swap'
    document.head.appendChild(fl)
    const off = document.createElement('div')
    off.id = 'tz-offstage'
    off.setAttribute('aria-hidden', 'true')
    document.body.appendChild(off)
    root.innerHTML = MARKUP
    root.addEventListener('input', onInput)
    root.addEventListener('change', onChange)
    root.addEventListener('click', onClick)
    root.querySelectorAll('.drop').forEach(d => {
      const role = d.dataset.role
      const fi = d.querySelector('input')
      fi.addEventListener('change', () => { if (fi.files.length) addFiles(fi.files, role)
        fi.value = '' })
      d.addEventListener('dragover', e => { e.preventDefault()
        d.classList.add('over') })
      d.addEventListener('dragleave', () => d.classList.remove('over'))
      d.addEventListener('drop', e => { e.preventDefault()
        d.classList.remove('over')
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files, role) })
    })
    $('#tz-new').addEventListener('click', () => { S = blank()
      fitCache.clear()
      fillForm()
      status('Formulaire vidé.')
      render() })
    $('#tz-pdf').addEventListener('click', exportPdf)
    $('#tz-html').addEventListener('click', exportHtml)
    $('#tz-mkt-btn').addEventListener('click', () => { $('#tz-mkt').hidden = !$('#tz-mkt').hidden })
    new ResizeObserver(() => scaleFrames()).observe($('#tz-deck'))
    return true
  }
  window.tzOpen = function () {
    if (!root && !mount()) return
    crmOptions()
    fillForm()
    render()
    loadPool().then(() => renderSummary())
  }
})()
