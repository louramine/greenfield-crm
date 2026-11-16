// Appel à l'API Claude (Anthropic) sans dépendance externe
// CLAUDE_MOCK=1 : les réponses viennent d'une fonction de test (voir setMockClaude)

let mockHandler = null

export function setMockClaude(fn) {
  mockHandler = fn
}

export const MODELE_REPONSE = () => process.env.CLAUDE_MODEL_REPLY ?? 'claude-sonnet-5-5'
export const MODELE_EXTRACTION = () => process.env.CLAUDE_MODEL_EXTRACT ?? 'claude-haiku-5-5'

export async function claude(requete) {
  if (process.env.CLAUDE_MOCK === '1') {
    if (!mockHandler) throw new Error('Aucune réponse de test pour Claude')
    return mockHandler(requete)
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(requete),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Claude ${r.status} ${JSON.stringify(data).slice(0, 300)}`)
  return data
}

export function texteDe(reponse) {
  return (reponse?.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
}

export function outilDe(reponse, nom) {
  const bloc = (reponse?.content ?? []).find((b) => b.type === 'tool_use' && b.name === nom)
  return bloc ? bloc.input : null
}
