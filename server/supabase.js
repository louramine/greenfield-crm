// Accès Supabase côté serveur avec la clé service (contourne les règles RLS)
// SB_MOCK=1 active une base en mémoire pour les tests

const mock = { tables: {}, seq: 1 }

export function mockDb() {
  return mock
}

function base() {
  return `${process.env.SUPABASE_URL}/rest/v1`
}

function headers(prefer) {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  return {
    apikey: k,
    Authorization: `Bearer ${k}`,
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

// Filtres simples "col=eq.valeur" pour la base de test
function filtrer(rows, query) {
  const params = new URLSearchParams(query)
  let res = rows
  for (const [col, val] of params) {
    if (val.startsWith('eq.')) res = res.filter((r) => String(r[col]) === val.slice(3))
  }
  const ordre = params.get('order')
  if (ordre) {
    const [col, sens] = ordre.split('.')
    res = [...res].sort((a, b) => (Number(a[col]) > Number(b[col]) ? 1 : -1) * (sens === 'desc' ? -1 : 1))
  }
  const limite = params.get('limit')
  return limite ? res.slice(0, Number(limite)) : res
}

export async function sbSelect(table, query = '') {
  if (process.env.SB_MOCK === '1') return filtrer(mock.tables[table] ?? [], query)
  return appel(`${base()}/${table}?${query}`, { headers: headers() })
}

export async function sbInsert(table, row) {
  if (process.env.SB_MOCK === '1') {
    const ligne = { id: mock.seq++, created_at: new Date().toISOString(), ...row }
    mock.tables[table] = [...(mock.tables[table] ?? []), ligne]
    return [ligne]
  }
  return appel(`${base()}/${table}`, { method: 'POST', headers: headers(), body: JSON.stringify(row) })
}

export async function sbPatch(table, query, champs) {
  if (process.env.SB_MOCK === '1') {
    const cibles = filtrer(mock.tables[table] ?? [], query)
    for (const c of cibles) Object.assign(c, champs)
    return cibles
  }
  return appel(`${base()}/${table}?${query}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(champs) })
}

export async function sbUpsert(table, row, conflit) {
  if (process.env.SB_MOCK === '1') {
    const cles = conflit.split(',')
    const liste = mock.tables[table] ?? []
    const existant = liste.find((r) => cles.every((k) => String(r[k]) === String(row[k])))
    if (existant) return [Object.assign(existant, row)]
    return sbInsert(table, row)
  }
  return appel(`${base()}/${table}?on_conflict=${conflit}`, {
    method: 'POST',
    headers: headers('resolution=merge-duplicates,return=representation'),
    body: JSON.stringify(row),
  })
}

// Vérifie le jeton de session d'un utilisateur du CRM
export async function utilisateurDepuisJeton(jeton) {
  if (!jeton) return null
  if (process.env.SB_MOCK === '1') return jeton === 'jeton-test' ? { id: 'u1', email: 'test@greenfield.plus' } : null
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${jeton}` },
  })
  if (!r.ok) return null
  return r.json()
}
