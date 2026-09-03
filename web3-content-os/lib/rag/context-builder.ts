import { desc, eq, and, gte } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { GLOBAL_SYSTEM_PROMPT } from '../prompts/system'
import { listFacts, renderFacts } from '../services/facts'
import { getLatestDna, renderDna, type DnaData } from '../services/dna'
import { listMemories, listTerminology, listBrandRules, renderMemories } from '../services/memory'
import { searchKnowledge, type SearchHit } from '../services/knowledge'
import { getLatestNarrative } from '../services/narrative'
import type { Project } from '../db/schema'
import type { ChatMessage } from '../ai/types'

export type TaskClass = 'tokenomics' | 'product' | 'brand' | 'launch' | 'community' | 'investor' | 'technical' | 'general'

export interface BuiltContext {
  system: string
  sources: { type: 'fact' | 'chunk' | 'memory' | 'content'; label: string; ref?: string }[]
  factKeys: string[]
  recentAngles: string[]
  taskClass: TaskClass
  tokens: number
}

const CLASS_KEYWORDS: Record<TaskClass, RegExp> = {
  tokenomics: /token|tokenomic|supply|allocation|vesting|tge|airdrop|staking|\$[a-z]{2,6}|代币|通证|总量|释放|空投|质押/i,
  launch: /launch|listing|countdown|tge|上线|倒计时|首发|binance|okx|bybit|alpha/i,
  investor: /investor|vc|fund|raise|valuation|pitch|deck|institutional|投资|融资|机构|估值/i,
  community: /community|ama|discord|telegram|airdrop|quest|task|社区|社群|活动|任务/i,
  technical: /architecture|protocol|zk|rollup|consensus|smart contract|sdk|api|技术|架构|合约|节点/i,
  product: /product|feature|app|platform|how it works|tutorial|产品|功能|玩法|教程/i,
  brand: /brand|story|mission|vision|overview|introduction|about|品牌|故事|愿景|介绍|概述/i,
  general: /.*/
}

export function classifyTask(request: string): TaskClass {
  for (const [cls, re] of Object.entries(CLASS_KEYWORDS) as [TaskClass, RegExp][]) {
    if (cls === 'general') continue
    if (re.test(request)) return cls
  }
  return 'general'
}

const CLASS_FACT_CATEGORIES: Record<TaskClass, string[] | undefined> = {
  tokenomics: ['token', 'exchange', 'contract', 'audit', 'metrics'],
  launch: ['token', 'exchange', 'roadmap', 'partners', 'audit', 'contract'],
  investor: ['funding', 'token', 'metrics', 'team', 'partners', 'product'],
  community: ['token', 'partners', 'roadmap', 'product'],
  technical: ['product', 'contract', 'audit', 'partners'],
  product: ['product', 'partners', 'metrics', 'roadmap'],
  brand: ['brand', 'product', 'general', 'team'],
  general: undefined
}

const CLASS_DNA_KEYS: Record<TaskClass, string[]> = {
  tokenomics: ['one_sentence_positioning', 'token_model', 'token_utility', 'brand_tone', 'communication_rules', 'restricted_claims', 'brand_keywords'],
  launch: ['one_sentence_positioning', 'key_selling_points', 'token_utility', 'narrative', 'brand_tone', 'communication_rules', 'restricted_claims'],
  investor: ['project_overview', 'market_problem', 'solution', 'business_model', 'token_model', 'competitive_advantage', 'brand_tone', 'restricted_claims'],
  community: ['one_sentence_positioning', 'target_audience', 'key_selling_points', 'brand_tone', 'brand_keywords', 'communication_rules', 'restricted_claims'],
  technical: ['product', 'solution', 'competitive_advantage', 'brand_tone', 'communication_rules', 'restricted_claims'],
  product: ['product', 'solution', 'target_audience', 'key_selling_points', 'brand_tone', 'communication_rules', 'restricted_claims'],
  brand: ['project_overview', 'one_sentence_positioning', 'mission', 'vision', 'narrative', 'brand_keywords', 'brand_tone', 'communication_rules', 'restricted_claims'],
  general: ['one_sentence_positioning', 'narrative', 'key_selling_points', 'brand_tone', 'brand_keywords', 'communication_rules', 'restricted_claims']
}

function estimateTokens(s: string) {
  return Math.ceil(s.length / 3.2)
}

export interface BuildOptions {
  request: string
  taskClass?: TaskClass
  knowledgeLimit?: number
  includeContentHistory?: boolean
  includeNarrative?: boolean
  extraInstructions?: string
  useMemory?: boolean
}

/**
 * Dynamic Context Builder: assembles only the relevant slices of the project brain.
 * Priority order — user request > locked/confirmed facts > latest facts > DNA > long-term memory > knowledge > content history.
 */
export async function buildProjectContext(orgId: string, project: Project, opts: BuildOptions): Promise<BuiltContext> {
  const taskClass = opts.taskClass ?? classifyTask(opts.request)
  const useMemory = opts.useMemory !== false
  const [facts, dna, memories, terms, rules, narrative] = await Promise.all([
    listFacts(project.id),
    getLatestDna(project.id),
    useMemory ? listMemories(project.id) : Promise.resolve([]),
    useMemory ? listTerminology(project.id) : Promise.resolve([]),
    useMemory ? listBrandRules(project.id) : Promise.resolve([]),
    opts.includeNarrative ? getLatestNarrative(project.id) : Promise.resolve(undefined)
  ])
  let hits: SearchHit[] = []
  try {
    hits = await searchKnowledge(orgId, project.id, opts.request, opts.knowledgeLimit ?? 6)
  } catch (e) {
    console.warn('[context] knowledge search failed', e)
  }

  const sources: BuiltContext['sources'] = []
  const parts: string[] = [GLOBAL_SYSTEM_PROMPT]

  parts.push(`PROJECT CONTEXT
- Project: ${project.name}${project.slogan ? ` — "${project.slogan}"` : ''}
- Industry: ${project.industry || 'Web3'}
- Positioning: ${project.positioning || '(see DNA)'}
- Token: ${project.tokenName || '-'} (${project.tokenSymbol || '-'})
- Links: ${[project.website, project.twitter, project.telegram, project.discord].filter(Boolean).join(' · ') || '-'}
- Launch date: ${project.launchDate || '[Missing: launch date]'}
- Today: ${new Date().toISOString().slice(0, 10)}`)

  const categories = CLASS_FACT_CATEGORIES[taskClass]
  const pinnedOrLocked = facts.filter((f) => f.pinned || f.status === 'locked')
  const relevant = categories ? facts.filter((f) => categories.includes(f.category) || pinnedOrLocked.includes(f)) : facts
  const factList = relevant.length ? relevant : facts
  const factText = renderFacts(factList, { max: 45 })
  if (factText) {
    parts.push('PROJECT FACTS (highest priority; newest confirmed values):\n' + factText)
    for (const f of factList.slice(0, 45)) sources.push({ type: 'fact', label: `${f.label}: ${f.value}`, ref: f.sourceRef?.sourceName ?? f.source })
  } else {
    parts.push('PROJECT FACTS: (no structured facts yet — do not invent any; mark unknowns as [Missing: …])')
  }

  const dnaText = renderDna(dna?.data as DnaData | undefined, CLASS_DNA_KEYS[taskClass])
  if (dnaText) parts.push('PROJECT DNA (brand truth):\n' + dnaText)

  const memText = useMemory ? renderMemories(memories, terms, rules) : ''
  if (memText) {
    parts.push(memText)
    for (const m of memories) sources.push({ type: 'memory', label: m.title })
  }

  if (narrative) {
    const n = narrative.data as { core_narrative?: string; primary_themes?: { title: string }[] }
    if (n.core_narrative) parts.push('CORE NARRATIVE:\n' + n.core_narrative.slice(0, 2500) + (n.primary_themes?.length ? '\nThemes: ' + n.primary_themes.map((t) => t.title).join(' | ') : ''))
  }

  if (hits.length) {
    parts.push('RELEVANT KNOWLEDGE (from uploaded materials; cite as source when stating specifics):\n' + hits.map((h) => `[${h.sourceName}${h.page ? ' p.' + h.page : ''}${h.section ? ' · ' + h.section : ''}]\n${h.content.slice(0, 1400)}`).join('\n\n'))
    for (const h of hits) sources.push({ type: 'chunk', label: h.sourceName + (h.page ? ` p.${h.page}` : ''), ref: h.id })
  }

  const recentAngles: string[] = []
  if (opts.includeContentHistory !== false) {
    const db = await getDb()
    const since = new Date(Date.now() - 14 * 86400000)
    const recent = await db.query.contentItems.findMany({ where: and(eq(schema.contentItems.projectId, project.id), gte(schema.contentItems.createdAt, since)), orderBy: desc(schema.contentItems.createdAt), limit: 25, columns: { title: true, contentType: true, angle: true, platform: true, createdAt: true, status: true } })
    if (recent.length) {
      parts.push('CONTENT MEMORY (recent output — avoid repeating these angles unless asked):\n' + recent.map((c) => `- ${c.createdAt.toISOString().slice(0, 10)} · ${c.contentType}${c.platform ? '/' + c.platform : ''} · ${c.title}${c.angle ? ' — angle: ' + c.angle : ''}`).join('\n'))
      for (const c of recent) if (c.angle) recentAngles.push(c.angle)
    }
  }

  if (opts.extraInstructions) parts.push(opts.extraInstructions)
  const system = parts.join('\n\n')
  return { system, sources, factKeys: factList.map((f) => f.key), recentAngles, taskClass, tokens: estimateTokens(system) }
}

export function toMessages(system: string, history: ChatMessage[], user: string): ChatMessage[] {
  return [{ role: 'system', content: system }, ...history, { role: 'user', content: user }]
}
