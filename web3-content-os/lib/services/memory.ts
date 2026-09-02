import { and, asc, desc, eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { runJson } from '../ai'
import { touchProject } from './projects'
import { upsertFact } from './facts'

export const MEMORY_TYPES = ['terminology', 'brand_rule', 'decision', 'preference', 'narrative', 'tokenomics', 'note'] as const
export type MemoryType = typeof MEMORY_TYPES[number]

export interface MemoryInput { type: MemoryType | string; title: string; content: string; oldValue?: string | null; newValue?: string | null; pinned?: boolean; locked?: boolean; source?: string }

async function logEvent(projectId: string, memoryId: string | null, event: string, payload: Record<string, unknown>, actor: string) {
  const db = await getDb()
  await db.insert(schema.projectMemoryEvents).values({ projectId, memoryId, event, payload, actor })
}

export async function listMemories(projectId: string, opts: { includeArchived?: boolean } = {}) {
  const db = await getDb()
  const rows = await db.query.projectMemories.findMany({ where: eq(schema.projectMemories.projectId, projectId), orderBy: [desc(schema.projectMemories.pinned), desc(schema.projectMemories.updatedAt)] })
  return opts.includeArchived ? rows : rows.filter((r) => r.status === 'active')
}

export async function addMemory(projectId: string, input: MemoryInput, actor: string) {
  const db = await getDb()
  // Terminology memories also maintain the terminology table so renames are enforced deterministically.
  if (input.type === 'terminology' && input.oldValue && input.newValue) {
    const existing = await db.query.terminology.findFirst({ where: and(eq(schema.terminology.projectId, projectId), eq(schema.terminology.oldTerm, input.oldValue)) })
    if (existing) await db.update(schema.terminology).set({ newTerm: input.newValue, note: input.content }).where(eq(schema.terminology.id, existing.id))
    else await db.insert(schema.terminology).values({ projectId, oldTerm: input.oldValue, newTerm: input.newValue, note: input.content })
  }
  if (input.type === 'brand_rule') {
    await db.insert(schema.brandRules).values({ projectId, ruleType: /不要|never|don't|do not|禁止|avoid/i.test(input.content) ? 'dont' : 'do', content: input.content })
  }
  const [m] = await db.insert(schema.projectMemories).values({ projectId, type: input.type, title: input.title.trim(), content: input.content.trim(), oldValue: input.oldValue ?? null, newValue: input.newValue ?? null, pinned: input.pinned ?? false, locked: input.locked ?? false, source: input.source ?? actor }).returning()
  await logEvent(projectId, m.id, 'created', { title: m.title, type: m.type }, actor)
  await touchProject(projectId)
  return m
}

export async function updateMemory(projectId: string, memoryId: string, patch: Partial<MemoryInput> & { status?: string }, actor: string) {
  const db = await getDb()
  const existing = await db.query.projectMemories.findFirst({ where: and(eq(schema.projectMemories.id, memoryId), eq(schema.projectMemories.projectId, projectId)) })
  if (!existing) throw new Error('Memory not found')
  if (existing.locked && actor === 'ai') throw new Error('Memory is locked')
  const [m] = await db.update(schema.projectMemories).set({ ...patch, updatedAt: new Date() }).where(eq(schema.projectMemories.id, memoryId)).returning()
  const event = patch.status === 'archived' ? 'deleted' : patch.status === 'active' && existing.status === 'archived' ? 'restored' : patch.pinned !== undefined && patch.pinned !== existing.pinned ? (patch.pinned ? 'pinned' : 'unpinned') : patch.locked !== undefined && patch.locked !== existing.locked ? (patch.locked ? 'locked' : 'unlocked') : 'updated'
  await logEvent(projectId, memoryId, event, { before: { title: existing.title, content: existing.content }, after: { title: m.title, content: m.content } }, actor)
  return m
}

export async function deleteMemory(projectId: string, memoryId: string, actor: string) {
  return updateMemory(projectId, memoryId, { status: 'archived' }, actor)
}

export async function memoryEvents(projectId: string, limit = 50) {
  const db = await getDb()
  return db.query.projectMemoryEvents.findMany({ where: eq(schema.projectMemoryEvents.projectId, projectId), orderBy: desc(schema.projectMemoryEvents.createdAt), limit })
}

export async function listTerminology(projectId: string) {
  const db = await getDb()
  return db.query.terminology.findMany({ where: eq(schema.terminology.projectId, projectId), orderBy: asc(schema.terminology.createdAt) })
}

export async function listBrandRules(projectId: string) {
  const db = await getDb()
  return db.query.brandRules.findMany({ where: eq(schema.brandRules.projectId, projectId), orderBy: asc(schema.brandRules.createdAt) })
}

export async function deleteTerminology(projectId: string, id: string) {
  const db = await getDb()
  await db.delete(schema.terminology).where(and(eq(schema.terminology.id, id), eq(schema.terminology.projectId, projectId)))
}

export async function deleteBrandRule(projectId: string, id: string) {
  const db = await getDb()
  await db.delete(schema.brandRules).where(and(eq(schema.brandRules.id, id), eq(schema.brandRules.projectId, projectId)))
}

/** Applies terminology replacements deterministically to a piece of text. */
export function applyTerminology(text: string, terms: { oldTerm: string; newTerm: string }[]) {
  let out = text
  for (const t of terms) {
    if (!t.oldTerm || t.oldTerm === t.newTerm) continue
    const isAscii = /^[\x00-\x7F]+$/.test(t.oldTerm)
    const re = isAscii ? new RegExp(`(?<![A-Za-z0-9$])${escapeRe(t.oldTerm)}(?![A-Za-z0-9])`, 'g') : new RegExp(escapeRe(t.oldTerm), 'g')
    out = out.replace(re, t.newTerm)
  }
  return out
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface MemoryCandidate { type: MemoryType; title: string; content: string; oldValue?: string; newValue?: string; factKey?: string; factValue?: string }

/**
 * Classifies a user turn: temporary context (ignored) vs long-term memory (saved).
 * Returns the memories that were saved.
 */
export async function extractMemoriesFromTurn(ctx: { orgId: string; projectId: string; userId?: string | null }, userMessage: string, assistantReply: string) {
  const trivial = userMessage.trim().length < 12 || /^(hi|hello|thanks|thank you|ok|好的|谢谢|你好)[.!]?$/i.test(userMessage.trim())
  if (trivial) return []
  const looksLikeRule = /(以后|从今|统一|不要再|不再|改成|改为|换成|叫做|rename|from now on|always|never|going forward|call it|instead of|replace all|lock|confirm|决定|确认)/i.test(userMessage)
  const looksLikeFact = /(supply|price|launch|上线|发行|总量|价格|投资|融资|partner|合作|exchange|交易所|audit|审计|contract|合约|\d)/i.test(userMessage)
  if (!looksLikeRule && !looksLikeFact) return []
  const { data } = await runJson<{ memories: MemoryCandidate[] }>({ ...ctx, taskType: 'memory' }, {
    messages: [
      { role: 'system', content: 'You maintain the long-term memory of a Web3 project\'s AI brand manager. Decide whether the user message contains durable information that must be remembered for ALL future content. Temporary requests like "make it shorter", "rewrite this", "try another angle" are NOT memories. Durable items are: terminology renames ("call X Y from now on"), brand rules ("never say node, say operator"), decisions ("we will not list on DEX first"), preferences ("always end tweets with a question"), and explicit fact updates ("token supply is now 10B"). Respond with JSON only.' },
      { role: 'user', content: `USER MESSAGE:\n${userMessage}\n\nASSISTANT REPLY (for context):\n${assistantReply.slice(0, 1500)}\n\nReturn {"memories":[{"type":"terminology|brand_rule|decision|preference|tokenomics|note","title":"short title","content":"the rule in one sentence, in the user's language","oldValue":"old term if rename","newValue":"new term if rename","factKey":"snake_case fact key if this is a fact update","factValue":"the new value if fact update"}]} — return an empty list when nothing durable is present.` }
    ],
    maxTokens: 800
  }, { memories: [] })
  const saved = []
  for (const m of (data.memories ?? []).slice(0, 5)) {
    if (!m || !m.title || !m.content) continue
    if (m.factKey && m.factValue) {
      await upsertFact(ctx.projectId, { key: m.factKey, value: m.factValue, source: 'User (chat)', status: 'confirmed' }, { by: ctx.userId ?? 'user', force: true })
    }
    saved.push(await addMemory(ctx.projectId, { type: m.type, title: m.title, content: m.content, oldValue: m.oldValue, newValue: m.newValue, source: 'ai' }, 'ai'))
  }
  return saved
}

export function renderMemories(memories: { type: string; title: string; content: string; oldValue: string | null; newValue: string | null; locked: boolean }[], terms: { oldTerm: string; newTerm: string }[], rules: { ruleType: string; content: string }[]) {
  const parts: string[] = []
  if (terms.length) parts.push('TERMINOLOGY (mandatory replacements):\n' + terms.map((t) => `- Always write "${t.newTerm}" instead of "${t.oldTerm}"`).join('\n'))
  if (rules.length) parts.push('BRAND RULES:\n' + rules.map((r) => `- [${r.ruleType}] ${r.content}`).join('\n'))
  const others = memories.filter((m) => m.type !== 'terminology' && m.type !== 'brand_rule')
  if (others.length) parts.push('LONG-TERM MEMORY (team decisions & preferences):\n' + others.map((m) => `- [${m.type}] ${m.title}: ${m.content}${m.locked ? ' [LOCKED]' : ''}`).join('\n'))
  return parts.join('\n\n')
}
