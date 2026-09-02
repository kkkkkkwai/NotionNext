import { and, desc, eq, ilike, or, sql, count } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { runChat } from '../ai'
import type { TaskType } from '../ai/types'
import { OUTPUT_RULES } from '../prompts/system'
import { buildProjectContext } from '../rag/context-builder'
import { getTemplate } from './templates'
import { listTerminology, applyTerminology } from './memory'
import { getProject, touchProject } from './projects'
import { listFacts } from './facts'
import type { ContentTemplate, Project } from '../db/schema'

export const LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'zh', label: 'Chinese', native: '中文' },
  { code: 'ko', label: 'Korean', native: '한국어' },
  { code: 'ja', label: 'Japanese', native: '日本語' },
  { code: 'vi', label: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'th', label: 'Thai', native: 'ไทย' },
  { code: 'ru', label: 'Russian', native: 'Русский' },
  { code: 'es', label: 'Spanish', native: 'Español' }
]

export const CONTENT_STATUSES = ['draft', 'review', 'approved', 'scheduled', 'published', 'archived'] as const

export function languageName(code: string) {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code
}

export interface GenerateInput {
  templateId?: string
  templateSlug?: string
  contentType?: string
  category?: string
  platform?: string
  title?: string
  language?: string
  brief?: string
  angle?: string
  tone?: string
  length?: string
  useMemory?: boolean
  campaignId?: string
  jobId?: string
  variants?: number
  folder?: string
  tags?: string[]
}

export interface GeneratedContent { item: typeof schema.contentItems.$inferSelect; sources: { type: string; label: string; ref?: string }[]; model: string; missing: string[] }

function detectMissing(text: string) {
  return Array.from(new Set(Array.from(text.matchAll(/\[Missing:\s*([^\]]+)\]/gi)).map((m) => m[1].trim())))
}

export function templateInstructions(t: ContentTemplate | null | undefined, input: GenerateInput, project: Project) {
  const lang = LANGUAGES.find((l) => l.code === (input.language ?? 'en'))
  const lines = [
    `CONTENT TEMPLATE`,
    `- Content type: ${t?.name ?? input.contentType ?? 'custom'}`,
    t?.objective ? `- Objective: ${t.objective}` : '',
    t?.audience ? `- Audience: ${t.audience}` : '',
    t?.platform || input.platform ? `- Platform: ${input.platform ?? t?.platform}` : '',
    `- Tone: ${input.tone ?? t?.tone ?? 'on-brand'}`,
    t?.structure ? `- Structure: ${t.structure}` : '',
    `- Length: ${input.length ?? t?.length ?? 'appropriate'}`,
    t?.requiredFacts?.length ? `- Required facts: ${t.requiredFacts.join(', ')} (if any is missing from PROJECT FACTS, write [Missing: <fact>] in place)` : '',
    `- Language: ${lang ? `${lang.label} (${lang.native}) — native style, not literal translation; keep Web3 terms and the brand name/ticker as-is` : input.language ?? 'English'}`,
    t?.promptInstructions ? `- Instructions: ${t.promptInstructions}` : '',
    input.angle ? `- Angle to use: ${input.angle}` : '- Angle: choose a fresh angle not used in recent content',
    input.brief ? `- Brief from the user: ${input.brief}` : '',
    OUTPUT_RULES
  ].filter(Boolean)
  return lines.join('\n')
}

/** Generates a content item via template + dynamic project context, then saves it to the library. */
export async function generateContent(ctx: { orgId: string; projectId: string; userId?: string | null }, input: GenerateInput): Promise<GeneratedContent> {
  const project = await getProject(ctx.orgId, ctx.projectId)
  if (!project) throw new Error('Project not found')
  let template: ContentTemplate | null | undefined = null
  if (input.templateId) template = await getTemplate(input.templateId)
  else if (input.templateSlug) {
    const { getTemplateBySlug } = await import('./templates')
    template = await getTemplateBySlug(input.templateSlug)
  }
  const request = [template?.name, input.contentType, input.brief, input.angle].filter(Boolean).join(' — ') || 'content'
  const built = await buildProjectContext(ctx.orgId, project, {
    request, includeNarrative: true, useMemory: input.useMemory !== false,
    knowledgeLimit: template?.taskType === 'long_form' ? 12 : 6,
    extraInstructions: templateInstructions(template, input, project)
  })
  const userMessage = `Create: ${template?.name ?? input.contentType ?? 'content'}${input.title ? ` titled "${input.title}"` : ''}.${input.brief ? `\nBrief: ${input.brief}` : ''}${input.variants && input.variants > 1 ? `\nProduce ${input.variants} distinct versions separated by a line containing only "---".` : ''}`
  const taskType = (template?.taskType as TaskType) || 'content_fast'
  const res = await runChat({ ...ctx, taskType, contentType: template?.contentType ?? input.contentType ?? null }, {
    messages: [{ role: 'system', content: built.system }, { role: 'user', content: userMessage }],
    temperature: taskType === 'long_form' ? 0.5 : 0.8
  })
  const terms = await listTerminology(ctx.projectId)
  const body = applyTerminology(res.text.trim(), terms)
  const title = input.title || `${template?.name ?? input.contentType ?? 'Content'}${input.angle ? ' — ' + input.angle.slice(0, 60) : ''}`
  const db = await getDb()
  const [item] = await db.insert(schema.contentItems).values({
    projectId: ctx.projectId, templateId: template?.id ?? null, campaignId: input.campaignId ?? null, jobId: input.jobId ?? null, title, contentType: template?.contentType ?? input.contentType ?? 'custom',
    category: template?.category ?? input.category ?? 'social', platform: input.platform ?? template?.platform ?? null, language: input.language ?? 'en', status: 'draft',
    tags: input.tags ?? [], folder: input.folder ?? null, angle: input.angle ?? null, factsUsed: built.factKeys, body, createdBy: ctx.userId ?? null
  }).returning()
  await db.insert(schema.contentVersions).values({ contentId: item.id, projectId: ctx.projectId, version: 1, body, note: 'Generated', model: res.model, createdBy: ctx.userId ?? null })
  await touchProject(ctx.projectId)
  return { item, sources: built.sources, model: res.model, missing: detectMissing(body) }
}

export const EDITOR_ACTIONS: { id: string; label: string; zh: string; instruction: string }[] = [
  { id: 'shorter', label: 'Shorter', zh: '短一点', instruction: 'Make it noticeably shorter while keeping every fact and the strongest hook.' },
  { id: 'longer', label: 'Longer', zh: '详细一点', instruction: 'Expand with more detail and supporting points from the project context. No filler.' },
  { id: 'rewrite', label: 'Rewrite', zh: '重新写', instruction: 'Rewrite from scratch with a different structure and opening, same goal and facts.' },
  { id: 'professional', label: 'Professional', zh: '更专业', instruction: 'Make the tone more professional and precise; remove slang and emoji.' },
  { id: 'web3', label: 'More Web3', zh: '更 Web3', instruction: 'Make it more crypto-native: idioms, degen-but-credible energy, on-chain framing. Keep it compliant.' },
  { id: 'institutional', label: 'Institutional', zh: '更机构', instruction: 'Rewrite for institutional readers: infrastructure framing, risk-aware, no hype.' },
  { id: 'community', label: 'Community', zh: '更社区', instruction: 'Make it warmer and community-first; speak to members directly, invite participation.' },
  { id: 'fomo', label: 'More FOMO', zh: '增强 FOMO', instruction: 'Increase urgency using timing, scarcity of participation and momentum — never promise returns or price movement.' },
  { id: 'meme', label: 'Meme', zh: '增加 Meme', instruction: 'Add meme energy and humor native to crypto Twitter, still on-brand.' },
  { id: 'native_twitter', label: 'Native Twitter', zh: '更像原生 Twitter', instruction: 'Make it read like a real crypto Twitter account: lowercase-friendly, punchy lines, no corporate phrasing, max 2 hashtags.' },
  { id: 'technical', label: 'Technical', zh: '更技术', instruction: 'Add technical depth and precision for a builder audience.' },
  { id: 'simplify', label: 'Simplify', zh: '更通俗', instruction: 'Explain it so a newcomer understands; remove jargon or define it.' },
  { id: 'three_versions', label: 'Generate 3 Versions', zh: '生成 3 个版本', instruction: 'Produce 3 distinct versions with different hooks, separated by a line containing only "---".' },
  { id: 'translate', label: 'Translate', zh: '翻译', instruction: 'Translate natively into the target language, preserving Web3 terminology, brand names, tickers, facts and brand tone.' }
]

/** AI Editor: transforms an existing content body and stores a new version. */
export async function editContent(ctx: { orgId: string; projectId: string; userId?: string | null }, contentId: string, action: string, opts: { targetLanguage?: string; instruction?: string; useMemory?: boolean; saveAsNew?: boolean } = {}) {
  const db = await getDb()
  const project = await getProject(ctx.orgId, ctx.projectId)
  if (!project) throw new Error('Project not found')
  const item = await db.query.contentItems.findFirst({ where: and(eq(schema.contentItems.id, contentId), eq(schema.contentItems.projectId, ctx.projectId)) })
  if (!item) throw new Error('Content not found')
  const def = EDITOR_ACTIONS.find((a) => a.id === action)
  const instruction = opts.instruction || def?.instruction || action
  const langLine = action === 'translate' ? `Target language: ${languageName(opts.targetLanguage ?? 'en')}.` : `Keep the language of the original (${languageName(item.language)}).`
  const built = await buildProjectContext(ctx.orgId, project, { request: `${item.contentType} ${item.title} ${instruction}`, useMemory: opts.useMemory !== false, includeContentHistory: false, knowledgeLimit: 4, extraInstructions: OUTPUT_RULES })
  const res = await runChat({ ...ctx, taskType: action === 'translate' ? 'translation' : 'content_fast', contentType: item.contentType }, {
    messages: [
      { role: 'system', content: built.system },
      { role: 'user', content: `Edit the following ${item.contentType} content.\nEDIT INSTRUCTION: ${instruction}\n${langLine}\nKeep all project facts unchanged. Return only the edited content.\n\n--- ORIGINAL ---\n${item.body}` }
    ],
    temperature: 0.7
  })
  const terms = await listTerminology(ctx.projectId)
  const body = applyTerminology(res.text.trim(), terms)
  if (opts.saveAsNew || action === 'translate') {
    const [created] = await db.insert(schema.contentItems).values({
      projectId: ctx.projectId, templateId: item.templateId, campaignId: item.campaignId, title: action === 'translate' ? `${item.title} (${languageName(opts.targetLanguage ?? 'en')})` : `${item.title} (${def?.label ?? action})`,
      contentType: item.contentType, category: item.category, platform: item.platform, language: action === 'translate' ? opts.targetLanguage ?? 'en' : item.language, status: 'draft', tags: item.tags, folder: item.folder, angle: item.angle,
      factsUsed: item.factsUsed, body, createdBy: ctx.userId ?? null
    }).returning()
    await db.insert(schema.contentVersions).values({ contentId: created.id, projectId: ctx.projectId, version: 1, body, note: `${def?.label ?? action} of ${item.title}`, model: res.model, createdBy: ctx.userId ?? null })
    return { item: created, created: true, model: res.model }
  }
  const version = item.currentVersion + 1
  await db.insert(schema.contentVersions).values({ contentId: item.id, projectId: ctx.projectId, version, body, note: def?.label ?? action, model: res.model, createdBy: ctx.userId ?? null })
  const [updated] = await db.update(schema.contentItems).set({ body, currentVersion: version, updatedAt: new Date() }).where(eq(schema.contentItems.id, item.id)).returning()
  return { item: updated, created: false, model: res.model }
}

export async function saveContentBody(projectId: string, contentId: string, body: string, userId: string | null, note = 'Manual edit') {
  const db = await getDb()
  const item = await db.query.contentItems.findFirst({ where: and(eq(schema.contentItems.id, contentId), eq(schema.contentItems.projectId, projectId)) })
  if (!item) throw new Error('Content not found')
  if (item.body === body) return item
  const version = item.currentVersion + 1
  await db.insert(schema.contentVersions).values({ contentId, projectId, version, body, note, createdBy: userId })
  const [updated] = await db.update(schema.contentItems).set({ body, currentVersion: version, updatedAt: new Date() }).where(eq(schema.contentItems.id, contentId)).returning()
  return updated
}

export async function updateContentMeta(projectId: string, contentId: string, patch: Partial<{ title: string; status: string; tags: string[]; folder: string | null; language: string; platform: string | null; scheduledAt: Date | null; publishedAt: Date | null; campaignId: string | null }>) {
  const db = await getDb()
  const [updated] = await db.update(schema.contentItems).set({ ...patch, updatedAt: new Date() }).where(and(eq(schema.contentItems.id, contentId), eq(schema.contentItems.projectId, projectId))).returning()
  return updated
}

export async function deleteContent(projectId: string, contentId: string) {
  const db = await getDb()
  await db.delete(schema.contentVersions).where(and(eq(schema.contentVersions.contentId, contentId), eq(schema.contentVersions.projectId, projectId)))
  await db.delete(schema.contentItems).where(and(eq(schema.contentItems.id, contentId), eq(schema.contentItems.projectId, projectId)))
}

export interface LibraryQuery { q?: string; category?: string; contentType?: string; language?: string; platform?: string; status?: string; campaignId?: string; folder?: string; tag?: string; page?: number; pageSize?: number }

export async function listContent(projectId: string, query: LibraryQuery = {}) {
  const db = await getDb()
  const conds = [eq(schema.contentItems.projectId, projectId)]
  if (query.category) conds.push(eq(schema.contentItems.category, query.category))
  if (query.contentType) conds.push(eq(schema.contentItems.contentType, query.contentType))
  if (query.language) conds.push(eq(schema.contentItems.language, query.language))
  if (query.platform) conds.push(eq(schema.contentItems.platform, query.platform))
  if (query.status) conds.push(eq(schema.contentItems.status, query.status))
  if (query.campaignId) conds.push(eq(schema.contentItems.campaignId, query.campaignId))
  if (query.folder) conds.push(eq(schema.contentItems.folder, query.folder))
  if (query.tag) conds.push(sql`${schema.contentItems.tags} @> ${JSON.stringify([query.tag])}::jsonb`)
  if (query.q) conds.push(or(ilike(schema.contentItems.title, `%${query.q}%`), ilike(schema.contentItems.body, `%${query.q}%`))!)
  const pageSize = query.pageSize ?? 30
  const page = query.page ?? 1
  const where = and(...conds)
  const [items, [{ n }]] = await Promise.all([
    db.query.contentItems.findMany({ where, orderBy: desc(schema.contentItems.createdAt), limit: pageSize, offset: (page - 1) * pageSize }),
    db.select({ n: count() }).from(schema.contentItems).where(where)
  ])
  return { items, total: n, page, pageSize }
}

export async function getContent(projectId: string, contentId: string) {
  const db = await getDb()
  const item = await db.query.contentItems.findFirst({ where: and(eq(schema.contentItems.id, contentId), eq(schema.contentItems.projectId, projectId)) })
  if (!item) return null
  const versions = await db.query.contentVersions.findMany({ where: eq(schema.contentVersions.contentId, contentId), orderBy: desc(schema.contentVersions.version) })
  return { item, versions }
}

export async function restoreContentVersion(projectId: string, contentId: string, version: number, userId: string | null) {
  const db = await getDb()
  const v = await db.query.contentVersions.findFirst({ where: and(eq(schema.contentVersions.contentId, contentId), eq(schema.contentVersions.version, version), eq(schema.contentVersions.projectId, projectId)) })
  if (!v) throw new Error('Version not found')
  return saveContentBody(projectId, contentId, v.body, userId, `Restored v${version}`)
}

export async function contentFacets(projectId: string) {
  const db = await getDb()
  const rows = await db.select({ category: schema.contentItems.category, contentType: schema.contentItems.contentType, language: schema.contentItems.language, platform: schema.contentItems.platform, status: schema.contentItems.status, folder: schema.contentItems.folder, tags: schema.contentItems.tags }).from(schema.contentItems).where(eq(schema.contentItems.projectId, projectId))
  const uniq = (xs: (string | null)[]) => Array.from(new Set(xs.filter((x): x is string => Boolean(x)))).sort()
  return { categories: uniq(rows.map((r) => r.category)), contentTypes: uniq(rows.map((r) => r.contentType)), languages: uniq(rows.map((r) => r.language)), platforms: uniq(rows.map((r) => r.platform)), statuses: uniq(rows.map((r) => r.status)), folders: uniq(rows.map((r) => r.folder)), tags: uniq(rows.flatMap((r) => r.tags ?? [])) }
}

export async function listCalendarItems(projectId: string, from: Date, to: Date) {
  const db = await getDb()
  return db.query.contentItems.findMany({ where: and(eq(schema.contentItems.projectId, projectId), sql`coalesce(${schema.contentItems.scheduledAt}, ${schema.contentItems.publishedAt}) between ${from} and ${to}`), orderBy: schema.contentItems.scheduledAt })
}

export { listFacts }
