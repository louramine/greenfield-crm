// Assistant GREENFIELD : traduit une question en critères de recherche avec Claude.
// Seuls la question et le vocabulaire (noms de quartiers, codes de zonage, statuts, sourceurs) sont envoyés à Anthropic.
// Les résultats sont calculés dans le navigateur, sur les données que l'utilisateur a le droit de voir.
// Secret à créer dans Supabase : ANTHROPIC_API_KEY. Facultatif : ASSISTANT_MODEL (par défaut claude-haiku-5-5).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const ORIGINS = ["https://crm.greenfield.plus", "http://localhost:5173", "http://localhost:3000"]
const cors = (req: Request) => {
  const o = req.headers.get("origin") ?? ""
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, prefer, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  }
}
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } })

const liste = { type: "array", items: { type: "string" } }
const nombre = { type: ["number", "null"] }
const TOOL = {
  name: "requete",
  description: "Critères de recherche dans le CRM foncier GREENFIELD, déduits de la question.",
  input_schema: {
    type: "object",
    properties: {
      cible: { type: "string", enum: ["terrains", "promoteurs", "deals", "aide"], description: "Ce que l'utilisateur cherche. aide : salutation, question hors sujet ou impossible à traduire en critères." },
      quartiers: { ...liste, description: "Quartiers ou villes voulus, repris tels quels du vocabulaire fourni quand ils y figurent." },
      horsQuartiers: { ...liste, description: "Quartiers ou villes à exclure." },
      zonages: { ...liste, description: "Codes de zonage ou préfixes : E3, B, R+4, I2." },
      familles: { type: "array", items: { type: "string", enum: ["Immeuble", "Villa", "Industriel", "Tourisme", "Rural"] } },
      supMin: { ...nombre, description: "Superficie minimale en m². 1 ha = 10 000 m²." },
      supMax: { ...nombre, description: "Superficie maximale en m²." },
      prixMin: { ...nombre, description: "Prix minimal en DH par m²." },
      prixMax: { ...nombre, description: "Prix maximal en DH par m²." },
      forfaitMin: { ...nombre, description: "Montant global minimal en DH. 1 MDH = 1 000 000 DH." },
      forfaitMax: { ...nombre, description: "Montant global ou budget maximal en DH." },
      statuts: { ...liste, description: "Statuts, repris du vocabulaire fourni." },
      juridique: { type: "array", items: { type: "string", enum: ["titre", "melk", "indivision", "requisition", "collectif"] } },
      sourceurs: { ...liste, description: "Sourceurs, repris du vocabulaire fourni." },
      etapes: { type: "array", items: { type: "string", enum: ["teaser", "nda", "visite", "offre", "closing"] }, description: "Etapes de deal." },
      sansPrix: { type: "boolean" },
      sansTF: { type: "boolean" },
      sansCarte: { type: "boolean", description: "Terrains sans lien de localisation." },
      joursMax: { ...nombre, description: "Terrains sourcés depuis au plus ce nombre de jours." },
      tri: { type: "string", enum: ["", "prix", "superficie", "forfait", "recent"] },
      ordre: { type: "string", enum: ["", "asc", "desc"] },
      limite: { ...nombre, description: "Nombre de résultats demandé." },
      terrain: { type: "string", description: "Référence d'un terrain précis, par exemple GF-26-0936 ou 936." },
      promoteur: { type: "string", description: "Nom d'un promoteur précis cité dans la question." },
      texte: { ...liste, description: "Mots à chercher dans les notes et descriptions, en minuscules, seulement s'ils ne rentrent dans aucun autre critère." },
      compte: { type: "boolean", description: "La question demande un nombre." },
      message: { type: "string", description: "Pour cible aide : réponse courte en français." }
    },
    required: ["cible"]
  }
}

const SYSTEM = `Tu traduis les questions de l'équipe GREENFIELD, société marocaine de transactions foncières autour de Casablanca, en critères de recherche pour son CRM. Tu appelles toujours l'outil requete.
Les questions arrivent en français, en darija (lettres latines ou arabes) ou en mélange des deux.
Règles :
- "promoteurs pour le terrain X" : cible promoteurs avec terrain renseigné. "terrains pour le promoteur Y" : cible terrains avec promoteur renseigné.
- Ne remplis que les critères exprimés. N'invente ni quartier, ni prix, ni superficie.
- Zones industrielles, logistique, entrepôts : famille Industriel. Villas : Villa. Immeubles, R+n : Immeuble.
- Un quartier absent du vocabulaire reste utilisable : mets-le dans quartiers, en minuscules.
- Quand une question prolonge la précédente ("et à Bouskoura", "seulement les titrés"), repars des critères précédents fournis et modifie-les.
- L'assistant ne fait que lire le CRM. Pour une demande de modification, d'envoi ou une question générale, utilise cible aide avec un message court qui dit ce que l'assistant sait faire.`

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) })
  if (req.method !== "POST") return json(req, 405, { error: "methode" })
  const key = Deno.env.get("ANTHROPIC_API_KEY")
  if (!key) return json(req, 503, { error: "cle_absente" })

  // Réservé à l'équipe : le jeton de l'utilisateur doit correspondre à un rôle du CRM
  const auth = req.headers.get("authorization") ?? ""
  const role = await fetch(Deno.env.get("SUPABASE_URL") + "/rest/v1/rpc/mon_role", {
    method: "POST",
    headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "", Authorization: auth, "Content-Type": "application/json" },
    body: "{}"
  }).then((r) => r.ok ? r.json() : null).catch(() => null)
  if (!role) return json(req, 403, { error: "acces_refuse" })

  const body = await req.json().catch(() => null)
  const question = String(body?.question ?? "").slice(0, 400).trim()
  if (!question) return json(req, 400, { error: "question_vide" })
  const v = body?.vocabulaire ?? {}
  const arr = (x: unknown, n: number) => Array.isArray(x) ? x.slice(0, n).map((s) => String(s).slice(0, 60)) : []
  const contexte = [
    "Quartiers et villes connus : " + arr(v.quartiers, 400).join(", "),
    "Zonages présents : " + arr(v.zonages, 80).join(", "),
    "Statuts : " + arr(v.statuts, 30).join(", "),
    "Sourceurs : " + arr(v.sourceurs, 60).join(", "),
    body?.precedent ? "Critères de la question précédente : " + JSON.stringify(body.precedent).slice(0, 1500) : ""
  ].filter(Boolean).join("\n")

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("ASSISTANT_MODEL") ?? "claude-haiku-5-5",
      max_tokens: 700,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "requete" },
      messages: [{ role: "user", content: contexte + "\n\nQuestion : " + question }]
    })
  }).catch(() => null)
  if (!r) return json(req, 502, { error: "anthropic_injoignable" })
  if (!r.ok) {
    console.error("Anthropic", r.status, (await r.text()).slice(0, 300))
    return json(req, 502, { error: "anthropic_" + r.status })
  }
  const out = await r.json()
  const use = (out?.content ?? []).find((c: { type: string }) => c.type === "tool_use")
  if (!use) return json(req, 502, { error: "reponse_vide" })
  return json(req, 200, { spec: use.input })
})
