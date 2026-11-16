// Accès Supabase côté serveur avec la clé service (contourne les règles RLS).
// SB_MOCK=1 active une base en mémoire pour les tests.

const mock = { tables: {}, storage: {}, seq: 1 }

export function mockDb() {
  return mock
}

export function resetMock() {
  mock.tables = {}
  mock.storage = {}
  mock.seq = 1
}

const estMock = () => process.env.SB_MOCK === '1'

function racine() {
  return process.env.SUPABASE_URL ?? ''
}

function cle() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
}

function entetes(prefer) {
  return {
    apikey: cle(),
    Authorization: `Bearer ${cle()}`,
    'Content-Type': 'application/json',
    Prefer: prefer ?? 'return=representation',
  }
}

async function appel(url, options) {
  const r = await fetch(url, options)
  const texte = await r.text()
  if (!r.ok) throw new Error(`Supabase ${r.status} ${texte.slice(0, 300)}`)
  return texte ? JSON.parse(texte) : null
}

// ----- Filtres PostgREST simulés pour la base de test -----
function valeurFiltre(ligne, col, filtre) {
  const v = ligne[col]
  const [op, ...reste] = filtre.split('.')
  const arg = reste.join('.')
  if (op === 'eq') return String(v) === arg
  if (op === 'neq') return String(v) !== arg
  if (op === 'gt') return v != null && v > (isNaN(Number(arg)) ? arg : Number(arg))
  if (op === 'gte') return v != null && v >= (isNaN(Number(arg)) ? arg : Number(arg))
  if (op === 'lt') return v != null && v < (isNaN(Number(arg)) ? arg : Number(arg))
  if (op === 'lte') return v != null && v <= (isNaN(Number(arg)) ? arg : Number(arg))
  if (op === 'in') return arg.replace(/^\(/, '').replace(/\)$/, '').split(',').includes(String(v))
  if (op === 'is') {
    if (arg === 'null') return v == null
    if (arg === 'true') return v === true
    if (arg === 'false') return v === false
  }
  return true
}

function filtrer(rows, query) {
  const params = new URLSearchParams(query)
  let res = rows
  for (const [col, val] of params) {
    if (['select', 'order', 'limit', 'on_conflict'].includes(col)) continue
    res = res.filter((r) => valeurFiltre(r, col, val))
  }
  const ordre = params.get('order')
  if (ordre) {
    const [col, sens] = ordre.split('.')
    const signe = sens === 'desc' ? -1 : 1
    res = [...res].sort((a, b) => {
      const x = a[col]
      const y = b[col]
      if (x === y) return 0
      return (x > y ? 1 : -1) * signe
    })
  }
  const limite = params.get('limit')
  return limite ? res.slice(0, Number(limite)) : res
}

function copie(o) {
  return JSON.parse(JSON.stringify(o))
}

// ----- Tables -----
export async function sbSelect(table, query = '') {
  if (estMock()) return copie(filtrer(mock.tables[table] ?? [], query))
  return appel(`${racine()}/rest/v1/${table}?${query}`, { headers: entetes() })
}

export async function sbInsert(table, row) {
  if (estMock()) {
    const lignes = Array.isArray(row) ? row : [row]
    const crees = lignes.map((l) => ({ id: mock.seq++, created_at: new Date().toISOString(), ...l }))
    mock.tables[table] = [...(mock.tables[table] ?? []), ...crees]
    return copie(crees)
  }
  return appel(`${racine()}/rest/v1/${table}`, { method: 'POST', headers: entetes(), body: JSON.stringify(row) })
}

// Insère sauf si une ligne existe déjà avec la même valeur de "colonne" : renvoie [] dans ce cas
export async function sbInsertUnique(table, row, colonne) {
  if (estMock()) {
    const existe = row[colonne] != null && (mock.tables[table] ?? []).some((r) => String(r[colonne]) === String(row[colonne]))
    if (existe) return []
    return sbInsert(table, row)
  }
  return appel(`${racine()}/rest/v1/${table}?on_conflict=${colonne}`, {
    method: 'POST',
    headers: entetes('resolution=ignore-duplicates,return=representation'),
    body: JSON.stringify(row),
  })
}

export async function sbPatch(table, query, champs) {
  if (estMock()) {
    const params = new URLSearchParams(query)
    const cibles = (mock.tables[table] ?? []).filter((r) => [...params].every(([c, v]) => valeurFiltre(r, c, v)))
    for (const c of cibles) Object.assign(c, copie(champs))
    return copie(cibles)
  }
  return appel(`${racine()}/rest/v1/${table}?${query}`, { method: 'PATCH', headers: entetes(), body: JSON.stringify(champs) })
}

export async function sbUpsert(table, row, conflit) {
  if (estMock()) {
    const cles = conflit.split(',')
    const liste = mock.tables[table] ?? []
    const existant = liste.find((r) => cles.every((k) => String(r[k]) === String(row[k])))
    if (existant) return [copie(Object.assign(existant, copie(row)))]
    return sbInsert(table, row)
  }
  return appel(`${racine()}/rest/v1/${table}?on_conflict=${conflit}`, {
    method: 'POST',
    headers: entetes('resolution=merge-duplicates,return=representation'),
    body: JSON.stringify(row),
  })
}

// ----- Stockage de fichiers -----
export async function sbUpload(bucket, chemin, contenu, mime) {
  if (estMock()) {
    mock.storage[`${bucket}/${chemin}`] = { contenu: Buffer.from(contenu), mime }
    return { Key: `${bucket}/${chemin}` }
  }
  return appel(`${racine()}/storage/v1/object/${bucket}/${chemin}`, {
    method: 'POST',
    headers: { apikey: cle(), Authorization: `Bearer ${cle()}`, 'Content-Type': mime, 'x-upsert': 'true' },
    body: contenu,
  })
}

export async function sbDownload(bucket, chemin) {
  if (estMock()) {
    const f = mock.storage[`${bucket}/${chemin}`]
    if (!f) throw new Error('Fichier absent')
    return { contenu: f.contenu, mime: f.mime }
  }
  const r = await fetch(`${racine()}/storage/v1/object/${bucket}/${chemin}`, {
    headers: { apikey: cle(), Authorization: `Bearer ${cle()}` },
  })
  if (!r.ok) throw new Error(`Stockage ${r.status}`)
  return { contenu: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type') ?? 'application/octet-stream' }
}

// Vérifie le jeton de session d'un utilisateur connecté au CRM
export async function utilisateurDepuisJeton(jeton) {
  if (!jeton) return null
  if (estMock()) return jeton === 'jeton-test' ? { id: 'u1', email: 'ayoublyaf@gmail.com' } : null
  const r = await fetch(`${racine()}/auth/v1/user`, {
    headers: { apikey: cle(), Authorization: `Bearer ${jeton}` },
  })
  if (!r.ok) return null
  return r.json()
}

// Nom du membre de l'équipe (table equipe), sinon début de l'email
export async function nomMembre(user) {
  const email = String(user?.email ?? '').toLowerCase()
  try {
    const [m] = await sbSelect('equipe', `email=eq.${encodeURIComponent(email)}&limit=1`)
    if (m?.nom) return m.nom
  } catch {
    // table equipe absente : on garde l'email
  }
  return email.split('@')[0]
}
