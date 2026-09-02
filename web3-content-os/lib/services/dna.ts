import { desc, eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { runJson } from '../ai'
import { GLOBAL_SYSTEM_PROMPT } from '../prompts/system'
import { listFacts, renderFacts } from './facts'
import { searchKnowledge } from './knowledge'
import { listMemories, listTerminology, listBrandRules, renderMemories } from './memory'
import { getProject, computeReadiness, touchProject } from './projects'

export const DNA_SECTIONS: { key: string; title: string; kind: 'text' | 'list' }[] = [
  { key: 'project_overview', title: '01 Project Overview', kind: 'text' },
  { key: 'one_sentence_positioning', title: '02 One Sentence Positioning', kind: 'text' },
  { key: 'mission', title: '03 Mission', kind: 'text' },
  { key: 'vision', title: '04 Vision', kind: 'text' },
  { key: 'market_problem', title: '05 Market Problem', kind: 'text' },
  { key: 'solution', title: '06 Solution', kind: 'text' },
  { key: 'product', title: '07 Product', kind: 'text' },
  { key: 'target_audience', title: '08 Target Audience', kind: 'list' },
  { key: 'business_model', title: '09 Business Model', kind: 'text' },
  { key: 'token_model', title: '10 Token Model', kind: 'text' },
  { key: 'token_utility', title: '11 Token Utility', kind: 'list' },
  { key: 'competitive_advantage', title: '12 Competitive Advantage', kind: 'list' },
  { key: 'narrative', title: '13 Narrative', kind: 'text' },
  { key: 'brand_keywords', title: '14 Brand Keywords', kind: 'list' },
  { key: 'brand_tone', title: '15 Brand Tone', kind: 'text' },
  { key: 'key_selling_points', title: '16 Key Selling Points', kind: 'list' },
  { key: 'communication_rules', title: '17 Communication Rules', kind: 'list' },
  { key: 'restricted_claims', title: '18 Restricted Claims', kind: 'list' },
  { key: 'key_facts', title: '19 Key Facts', kind: 'list' },
  { key: 'missing_information', title: '20 Missing Information', kind: 'list' }
]

export type DnaData = Record<string, string | string[]>

export async function getLatestDna(projectId: string) {
  const db = await getDb()
  return db.query.projectDna.findFirst({ where: eq(schema.projectDna.projectId, projectId), orderBy: desc(schema.projectDna.version) })
}

export async function listDnaVersions(projectId: string) {
  const db = await getDb()
  return db.query.projectDna.findMany({ where: eq(schema.projectDna.projectId, projectId), orderBy: desc(schema.projectDna.version), columns: { id: true, version: true, createdAt: true, model: true, generatedBy: true } })
}

export async function saveDna(projectId: string, data: DnaData, meta: { model?: string; generatedBy: string }) {
  const db = await getDb()
  const latest = await getLatestDna(projectId)
  const [row] = await db.insert(schema.projectDna).values({ projectId, version: (latest?.version ?? 0) + 1, data, model: meta.model, generatedBy: meta.generatedBy }).returning()
  await touchProject(projectId)
  return row
}

export async function updateDnaSection(projectId: string, key: string, value: string | string[], by: string) {
  const latest = await getLatestDna(projectId)
  const data = { ...((latest?.data as DnaData) ?? {}), [key]: value }
  return saveDna(projectId, data, { generatedBy: by, model: latest?.model ?? undefined })
}

/** Generates the Project DNA (single source of truth) from facts + knowledge base + memory. */
export async function generateDna(ctx: { orgId: string; projectId: string; userId?: string | null }, opts: { language?: string } = {}) {
  const project = await getProject(ctx.orgId, ctx.projectId)
  if (!project) throw new Error('Project not found')
  const [facts, memories, terms, rules] = await Promise.all([listFacts(ctx.projectId), listMemories(ctx.projectId), listTerminology(ctx.projectId), listBrandRules(ctx.projectId)])
  const queries = ['project overview mission vision', 'problem solution product features', 'tokenomics token utility supply allocation', 'target users audience market', 'competitive advantage differentiation technology', 'roadmap ecosystem partners investors']
  const knowledge: string[] = []
  const seen = new Set<string>()
  for (const q of queries) {
    for (const hit of await searchKnowledge(ctx.orgId, ctx.projectId, q, 4)) {
      if (seen.has(hit.id)) continue
      seen.add(hit.id)
      knowledge.push(`[${hit.sourceName}${hit.page ? ' p.' + hit.page : ''}] ${hit.content}`)
    }
    if (knowledge.join('').length > 30000) break
  }
  const language = opts.language || (project.settings as { language?: string })?.language || 'auto'
  const prompt = `Build the PROJECT DNA — the single source of truth used for every future piece of content — for the Web3 project "${project.name}".

PROJECT PROFILE:
- Name: ${project.name}
- Slogan: ${project.slogan || '-'}
- Industry: ${project.industry || '-'}
- Positioning: ${project.positioning || '-'}
- Website: ${project.website || '-'} | Twitter: ${project.twitter || '-'} | Telegram: ${project.telegram || '-'}
- Token: ${project.tokenName || '-'} (${project.tokenSymbol || '-'}) | Launch: ${project.launchDate || '-'}
- Founder's description:\n${project.idea || '-'}

PROJECT FACTS (source of truth; do not contradict):
${renderFacts(facts) || '(none yet)'}

${renderMemories(memories, terms, rules) || ''}

KNOWLEDGE BASE EXCERPTS:
${knowledge.join('\n\n') || '(no documents uploaded yet)'}

Return JSON with exactly these keys:
{
 "project_overview": "2-3 paragraphs",
 "one_sentence_positioning": "one sentence",
 "mission": "...", "vision": "...",
 "market_problem": "...", "solution": "...", "product": "...",
 "target_audience": ["segment — why"],
 "business_model": "...",
 "token_model": "supply, allocation, vesting, value capture (only what is known)",
 "token_utility": ["utility"],
 "competitive_advantage": ["advantage"],
 "narrative": "the core story: trend → problem → why now → solution → growth → token value → vision",
 "brand_keywords": ["keyword"],
 "brand_tone": "how the brand sounds, with 3 do / 3 don't examples",
 "key_selling_points": ["point"],
 "communication_rules": ["rule"],
 "restricted_claims": ["claim we must never make"],
 "key_facts": ["fact with source name when known"],
 "missing_information": ["what is missing and why it matters"]
}
Rules: write in ${language === 'auto' ? 'the dominant language of the provided materials (Chinese if materials are Chinese, otherwise English)' : language}. Never invent investors, partners, numbers, dates, exchanges or audits — put them in missing_information instead. Be specific, not generic.`
  const { data, model } = await runJson<DnaData>({ ...ctx, taskType: 'dna' }, {
    messages: [{ role: 'system', content: GLOBAL_SYSTEM_PROMPT }, { role: 'user', content: prompt }],
    maxTokens: 6000, temperature: 0.4
  }, {})
  if (!data || !data.project_overview) throw new Error('The model did not return a valid Project DNA. Try again or switch the DNA model in Settings → AI Providers.')
  const row = await saveDna(ctx.projectId, data, { model, generatedBy: 'ai' })
  await computeReadiness(ctx.orgId, ctx.projectId)
  return row
}

export function renderDna(data: DnaData | undefined, keys?: string[]) {
  if (!data) return ''
  const sections = DNA_SECTIONS.filter((s) => !keys || keys.includes(s.key))
  return sections.map((s) => {
    const v = data[s.key]
    if (!v || (Array.isArray(v) && v.length === 0)) return null
    return `${s.title.replace(/^\d+ /, '')}: ${Array.isArray(v) ? v.map((x) => '\n  - ' + x).join('') : v}`
  }).filter(Boolean).join('\n')
}
