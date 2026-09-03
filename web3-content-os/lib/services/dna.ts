import { desc, eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { runJson } from '../ai'
import { GLOBAL_SYSTEM_PROMPT } from '../prompts/system'
import { listFacts, renderFacts } from './facts'
import { searchKnowledge } from './knowledge'
import { listMemories, listTerminology, listBrandRules, renderMemories } from './memory'
import { getProject, computeReadiness, touchProject } from './projects'

export const DNA_SECTIONS: { key: string; title: string; kind: 'text' | 'list' }[] = [
  { key: 'project_overview', title: '01 项目概述', kind: 'text' },
  { key: 'one_sentence_positioning', title: '02 一句话定位', kind: 'text' },
  { key: 'mission', title: '03 使命', kind: 'text' },
  { key: 'vision', title: '04 愿景', kind: 'text' },
  { key: 'market_problem', title: '05 市场问题', kind: 'text' },
  { key: 'solution', title: '06 解决方案', kind: 'text' },
  { key: 'product', title: '07 产品', kind: 'text' },
  { key: 'target_audience', title: '08 目标用户', kind: 'list' },
  { key: 'business_model', title: '09 商业模式', kind: 'text' },
  { key: 'token_model', title: '10 代币模型', kind: 'text' },
  { key: 'token_utility', title: '11 代币用途', kind: 'list' },
  { key: 'competitive_advantage', title: '12 竞争优势', kind: 'list' },
  { key: 'narrative', title: '13 叙事', kind: 'text' },
  { key: 'brand_keywords', title: '14 品牌关键词', kind: 'list' },
  { key: 'brand_tone', title: '15 品牌语气', kind: 'text' },
  { key: 'key_selling_points', title: '16 核心卖点', kind: 'list' },
  { key: 'communication_rules', title: '17 传播规则', kind: 'list' },
  { key: 'restricted_claims', title: '18 禁止表述', kind: 'list' },
  { key: 'key_facts', title: '19 关键事实', kind: 'list' },
  { key: 'missing_information', title: '20 缺失信息', kind: 'list' }
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
  if (!project) throw new Error('项目不存在')
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
  const language = opts.language || (project.settings as { language?: string })?.language || 'Chinese (Simplified)'
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

Think like a senior Web3 strategist. First decide silently: what category the project actually competes in, what its one unique mechanism is, who feels the problem most, and how the token captures value. Then fill the DNA so that every field is specific to THIS project — if a sentence could describe any other project, replace it with a mechanism, a number, or a concrete user situation.

Return JSON with exactly these keys:
{
 "project_overview": "2-3 paragraphs: what it is (category + mechanism), who it serves, why now, where it stands today. Plain, precise, no adjectives.",
 "one_sentence_positioning": "Use the formula: [Project] is the [category] that lets [audience] [outcome] because [unique mechanism].",
 "mission": "one sentence, what changes for users if the project succeeds",
 "vision": "one sentence, the end state of the market the project is building toward",
 "market_problem": "the concrete pain (who, when, how much it costs them) and why existing solutions fail — cite the sector trend that makes it urgent",
 "solution": "the mechanism, step by step, in cause → effect language; explain what is technically or economically new",
 "product": "what a user actually opens/uses today: surfaces, flows, integrations; status (live / testnet / planned)",
 "target_audience": ["segment — the job they hire the product for — why they switch"],
 "business_model": "who pays, for what, how revenue/fees flow, what the flywheel is",
 "token_model": "supply, allocation, vesting/unlocks, sinks & sources, and the value-capture logic (fees / burn / staking / access / governance). Only what is known; mark unknowns.",
 "token_utility": ["utility — the demand it creates"],
 "competitive_advantage": ["advantage — why it is hard to copy (tech, distribution, data, liquidity, community, timing)"],
 "narrative": "the core story in 6-8 sentences following Trend → Problem → Insight → Mechanism → Proof → Why now → Token value → Vision. Each sentence must add a new causal link.",
 "brand_keywords": ["6-10 words the brand owns"],
 "brand_tone": "how the brand sounds (3 adjectives + who it sounds like on CT), then 3 do examples and 3 don't examples as short lines",
 "key_selling_points": ["point stated as benefit + proof"],
 "communication_rules": ["rule, e.g. always say operator not node; always cite numbers with source"],
 "restricted_claims": ["claims we must never make"],
 "key_facts": ["fact — source name when known"],
 "missing_information": ["what is missing — why it matters for content — what to ask the team"]
}
Rules: write in ${language === 'auto' ? 'the dominant language of the provided materials (Chinese if materials are Chinese, otherwise English)' : language}. Keep product names, tickers and established Web3 terms as-is. Never invent investors, partners, numbers, dates, exchanges or audits — put them in missing_information instead. Ban generic filler (革命性/赋能/引领/game-changing/seamless).`
  const { data, model } = await runJson<DnaData>({ ...ctx, taskType: 'dna' }, {
    messages: [{ role: 'system', content: GLOBAL_SYSTEM_PROMPT }, { role: 'user', content: prompt }],
    maxTokens: 6000, temperature: 0.4
  }, {})
  if (!data || !data.project_overview) throw new Error('模型没有返回有效的项目 DNA，请重试或在「设置 → AI 模型」中更换 DNA 使用的模型。')
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
