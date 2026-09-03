import { and, desc, eq, sql, count, inArray } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { slugify } from '../utils'
import type { Project } from '../db/schema'

export const PROJECT_FIELDS = [
  'name', 'slogan', 'website', 'twitter', 'telegram', 'discord', 'industry', 'positioning', 'tokenName', 'tokenSymbol', 'launchDate', 'idea', 'logoUrl'
] as const

export type ProjectInput = Partial<Pick<Project, typeof PROJECT_FIELDS[number]>> & { name: string }

export async function listProjects(orgId: string) {
  const db = await getDb()
  const rows = await db.query.projects.findMany({ where: and(eq(schema.projects.orgId, orgId), eq(schema.projects.status, 'active')), orderBy: desc(schema.projects.updatedAt) })
  if (rows.length === 0) return [] as { project: Project; contentCount: number; sourceCount: number }[]
  const ids = rows.map((r) => r.id)
  const [contentCounts, sourceCounts] = await Promise.all([
    db.select({ projectId: schema.contentItems.projectId, n: count() }).from(schema.contentItems).where(inArray(schema.contentItems.projectId, ids)).groupBy(schema.contentItems.projectId),
    db.select({ projectId: schema.projectSources.projectId, n: count() }).from(schema.projectSources).where(inArray(schema.projectSources.projectId, ids)).groupBy(schema.projectSources.projectId)
  ])
  const cc = new Map(contentCounts.map((c) => [c.projectId, Number(c.n)]))
  const sc = new Map(sourceCounts.map((c) => [c.projectId, Number(c.n)]))
  return rows.map((project) => ({ project, contentCount: cc.get(project.id) ?? 0, sourceCount: sc.get(project.id) ?? 0 }))
}

export async function getProject(orgId: string, projectId: string) {
  const db = await getDb()
  const p = await db.query.projects.findFirst({ where: and(eq(schema.projects.id, projectId), eq(schema.projects.orgId, orgId)) })
  return p ?? null
}

export async function createProject(orgId: string, userId: string, input: ProjectInput) {
  const db = await getDb()
  const base = slugify(input.name)
  const [p] = await db.insert(schema.projects).values({ ...input, orgId, createdBy: userId, slug: `${base}-${Math.random().toString(36).slice(2, 7)}` }).returning()
  return p
}

export async function updateProject(orgId: string, projectId: string, patch: Partial<ProjectInput> & { readiness?: Record<string, number>; settings?: Record<string, unknown> }) {
  const db = await getDb()
  const [p] = await db.update(schema.projects).set({ ...patch, updatedAt: new Date() }).where(and(eq(schema.projects.id, projectId), eq(schema.projects.orgId, orgId))).returning()
  return p
}

export async function touchProject(projectId: string) {
  const db = await getDb()
  await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId))
}

export async function archiveProject(orgId: string, projectId: string) {
  const db = await getDb()
  await db.update(schema.projects).set({ status: 'archived', updatedAt: new Date() }).where(and(eq(schema.projects.id, projectId), eq(schema.projects.orgId, orgId)))
}

export interface Readiness { total: number; dimensions: Record<string, number>; missing: string[] }

const READINESS_KEYS: Record<string, string[]> = {
  brand: ['name', 'positioning', 'slogan', 'brand_tone', 'brand_keywords', 'mission'],
  narrative: ['narrative', 'problem', 'solution', 'competitive_advantage'],
  tokenomics: ['token_name', 'token_symbol', 'token_supply', 'token_utility', 'tokenomics'],
  marketing: ['target_audience', 'selling_points', 'product', 'website', 'twitter'],
  community: ['telegram', 'discord', 'community', 'community_strategy'],
  launch: ['launch_date', 'exchange', 'roadmap', 'audit', 'contract_address']
}

const MISSING_LABELS: Record<string, string> = {
  name: '项目名称', positioning: '项目定位', slogan: 'Slogan', brand_tone: '品牌语气', brand_keywords: '品牌关键词', mission: '使命',
  narrative: '核心叙事', problem: '市场问题', solution: '解决方案', competitive_advantage: '竞争优势',
  token_name: '代币名称', token_symbol: '代币符号', token_supply: '代币总量', token_utility: '代币用途', tokenomics: '代币经济模型',
  target_audience: '目标用户', selling_points: '核心卖点', product: '产品', website: '官网', twitter: 'Twitter/X',
  telegram: 'Telegram', discord: 'Discord', community: '社区', community_strategy: '社区策略',
  launch_date: '上线时间', exchange: '交易所信息', roadmap: '路线图', audit: '审计', contract_address: '合约地址'
}

/** Computes readiness from project fields, facts and DNA. Persists the result on the project. */
export async function computeReadiness(orgId: string, projectId: string): Promise<Readiness> {
  const db = await getDb()
  const project = await getProject(orgId, projectId)
  if (!project) throw new Error('Project not found')
  const facts = await db.query.projectFacts.findMany({ where: eq(schema.projectFacts.projectId, projectId) })
  const dna = await db.query.projectDna.findFirst({ where: eq(schema.projectDna.projectId, projectId), orderBy: desc(schema.projectDna.version) })
  const dnaData = (dna?.data ?? {}) as Record<string, unknown>
  const present = new Set<string>()
  const fieldMap: Record<string, string | null | undefined> = {
    name: project.name, positioning: project.positioning, slogan: project.slogan, website: project.website, twitter: project.twitter,
    telegram: project.telegram, discord: project.discord, token_name: project.tokenName, token_symbol: project.tokenSymbol, launch_date: project.launchDate
  }
  for (const [k, v] of Object.entries(fieldMap)) if (v && String(v).trim()) present.add(k)
  for (const f of facts) if (f.value && f.status !== 'outdated') present.add(f.key)
  const dnaMap: Record<string, string> = {
    mission: 'mission', narrative: 'narrative', problem: 'market_problem', solution: 'solution', product: 'product', target_audience: 'target_audience',
    competitive_advantage: 'competitive_advantage', brand_tone: 'brand_tone', brand_keywords: 'brand_keywords', selling_points: 'key_selling_points',
    token_utility: 'token_utility', tokenomics: 'token_model', positioning: 'one_sentence_positioning'
  }
  for (const [k, dk] of Object.entries(dnaMap)) {
    const v = dnaData[dk]
    if (v && (typeof v === 'string' ? v.trim().length > 10 : Array.isArray(v) ? v.length > 0 : true)) present.add(k)
  }
  const dimensions: Record<string, number> = {}
  const missing: string[] = []
  for (const [dim, keys] of Object.entries(READINESS_KEYS)) {
    const have = keys.filter((k) => present.has(k)).length
    dimensions[dim] = Math.round((have / keys.length) * 100)
    for (const k of keys) if (!present.has(k)) missing.push(MISSING_LABELS[k] ?? k)
  }
  const total = Math.round(Object.values(dimensions).reduce((a, b) => a + b, 0) / Object.keys(dimensions).length)
  await db.update(schema.projects).set({ readiness: { ...dimensions, total } }).where(eq(schema.projects.id, projectId))
  return { total, dimensions, missing }
}

export async function projectStats(orgId: string) {
  const db = await getDb()
  const [[p], [c], [camp], [langs], [usage]] = await Promise.all([
    db.select({ n: count() }).from(schema.projects).where(and(eq(schema.projects.orgId, orgId), eq(schema.projects.status, 'active'))),
    db.select({ n: count() }).from(schema.contentItems).innerJoin(schema.projects, eq(schema.projects.id, schema.contentItems.projectId)).where(eq(schema.projects.orgId, orgId)),
    db.select({ n: count() }).from(schema.campaigns).innerJoin(schema.projects, eq(schema.projects.id, schema.campaigns.projectId)).where(eq(schema.projects.orgId, orgId)),
    db.select({ n: sql<number>`count(distinct ${schema.contentItems.language})`.mapWith(Number) }).from(schema.contentItems).innerJoin(schema.projects, eq(schema.projects.id, schema.contentItems.projectId)).where(eq(schema.projects.orgId, orgId)),
    db.select({ calls: sql<number>`coalesce(sum(${schema.aiUsage.requests}),0)`.mapWith(Number), tokens: sql<number>`coalesce(sum(${schema.aiUsage.inputTokens}+${schema.aiUsage.outputTokens}),0)`.mapWith(Number), cost: sql<number>`coalesce(sum(${schema.aiUsage.cost}),0)`.mapWith(Number) }).from(schema.aiUsage).where(eq(schema.aiUsage.orgId, orgId))
  ])
  return { projects: p.n, content: c.n, campaigns: camp.n, languages: langs.n, aiCalls: usage.calls, aiTokens: usage.tokens, aiCost: usage.cost }
}
