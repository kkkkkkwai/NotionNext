import { and, asc, desc, eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { runJson } from '../ai'
import { GLOBAL_SYSTEM_PROMPT } from '../prompts/system'
import { touchProject } from './projects'
import type { ProjectFact } from '../db/schema'

export const FACT_CATEGORIES = ['token', 'funding', 'partners', 'product', 'team', 'roadmap', 'exchange', 'audit', 'contract', 'metrics', 'brand', 'general'] as const
export type FactCategory = typeof FACT_CATEGORIES[number]

export const PROTECTED_KEYS = new Set(['investors', 'partners', 'funding_amount', 'funding', 'exchange', 'exchanges', 'token_supply', 'token_price', 'launch_date', 'audit', 'auditor', 'contract_address', 'apy', 'yield', 'tvl', 'valuation'])

export function normalizeKey(k: string) {
  return k.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
}

export interface FactInput {
  key: string
  label?: string
  value: string
  category?: string
  source?: string
  sourceRef?: ProjectFact['sourceRef']
  confidence?: number
  status?: string
  note?: string
}

export async function listFacts(projectId: string) {
  const db = await getDb()
  return db.query.projectFacts.findMany({ where: eq(schema.projectFacts.projectId, projectId), orderBy: [desc(schema.projectFacts.pinned), asc(schema.projectFacts.category), asc(schema.projectFacts.label)] })
}

export async function getFact(projectId: string, factId: string) {
  const db = await getDb()
  return db.query.projectFacts.findFirst({ where: and(eq(schema.projectFacts.id, factId), eq(schema.projectFacts.projectId, projectId)) })
}

/**
 * Creates or updates a fact with version tracking.
 * Locked facts are never modified unless `force` (a human edit) is passed.
 * Returns `{ fact, changed, conflict }` — conflict is set when an AI-sourced value differs from a locked/confirmed fact.
 */
export async function upsertFact(projectId: string, input: FactInput, actor: { by: string; force?: boolean }) {
  const db = await getDb()
  const key = normalizeKey(input.key)
  if (!key) throw new Error('Fact key is required')
  const value = input.value.trim()
  const existing = await db.query.projectFacts.findFirst({ where: and(eq(schema.projectFacts.projectId, projectId), eq(schema.projectFacts.key, key)) })
  if (!existing) {
    const [fact] = await db.insert(schema.projectFacts).values({
      projectId, key, label: input.label?.trim() || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value,
      category: input.category || guessCategory(key), source: input.source || 'user', sourceRef: input.sourceRef ?? {}, confidence: input.confidence ?? (actor.by === 'ai' ? 0.7 : 0.99),
      status: input.status || (actor.by === 'ai' ? 'draft' : 'confirmed'), createdBy: actor.by
    }).returning()
    await db.insert(schema.projectFactVersions).values({ factId: fact.id, projectId, version: 1, oldValue: null, newValue: value, source: fact.source, modifiedBy: actor.by, note: input.note })
    await touchProject(projectId)
    return { fact, changed: true, conflict: null as null | { current: string; proposed: string } }
  }
  if (existing.value === value) {
    // Same value: optionally upgrade confidence/source metadata without a version bump
    if (actor.by !== 'ai' && (input.status || input.label || input.category)) {
      const [fact] = await db.update(schema.projectFacts).set({ label: input.label ?? existing.label, category: input.category ?? existing.category, status: input.status ?? existing.status, updatedAt: new Date() }).where(eq(schema.projectFacts.id, existing.id)).returning()
      return { fact, changed: false, conflict: null }
    }
    return { fact: existing, changed: false, conflict: null }
  }
  const isProtected = existing.status === 'locked' || (existing.status === 'confirmed' && actor.by === 'ai')
  if (isProtected && !actor.force) {
    return { fact: existing, changed: false, conflict: { current: existing.value, proposed: value } }
  }
  const version = existing.version + 1
  const [fact] = await db.update(schema.projectFacts).set({
    value, version, label: input.label ?? existing.label, category: input.category ?? existing.category, source: input.source ?? existing.source,
    sourceRef: input.sourceRef ?? existing.sourceRef, confidence: input.confidence ?? (actor.by === 'ai' ? 0.7 : 0.99),
    status: input.status ?? (existing.status === 'locked' ? 'locked' : actor.by === 'ai' ? 'draft' : 'confirmed'), updatedAt: new Date()
  }).where(eq(schema.projectFacts.id, existing.id)).returning()
  await db.insert(schema.projectFactVersions).values({ factId: fact.id, projectId, version, oldValue: existing.value, newValue: value, source: fact.source, modifiedBy: actor.by, note: input.note })
  await touchProject(projectId)
  return { fact, changed: true, conflict: null }
}

export async function setFactStatus(projectId: string, factId: string, status: 'confirmed' | 'locked' | 'draft' | 'outdated') {
  const db = await getDb()
  const [fact] = await db.update(schema.projectFacts).set({ status, confidence: status === 'locked' || status === 'confirmed' ? 1 : undefined, updatedAt: new Date() }).where(and(eq(schema.projectFacts.id, factId), eq(schema.projectFacts.projectId, projectId))).returning()
  return fact
}

export async function pinFact(projectId: string, factId: string, pinned: boolean) {
  const db = await getDb()
  const [fact] = await db.update(schema.projectFacts).set({ pinned, updatedAt: new Date() }).where(and(eq(schema.projectFacts.id, factId), eq(schema.projectFacts.projectId, projectId))).returning()
  return fact
}

export async function deleteFact(projectId: string, factId: string) {
  const db = await getDb()
  await db.delete(schema.projectFactVersions).where(and(eq(schema.projectFactVersions.factId, factId), eq(schema.projectFactVersions.projectId, projectId)))
  await db.delete(schema.projectFacts).where(and(eq(schema.projectFacts.id, factId), eq(schema.projectFacts.projectId, projectId)))
}

export async function factHistory(projectId: string, factId: string) {
  const db = await getDb()
  return db.query.projectFactVersions.findMany({ where: and(eq(schema.projectFactVersions.factId, factId), eq(schema.projectFactVersions.projectId, projectId)), orderBy: desc(schema.projectFactVersions.version) })
}

export async function restoreFactVersion(projectId: string, factId: string, version: number, by: string) {
  const db = await getDb()
  const v = await db.query.projectFactVersions.findFirst({ where: and(eq(schema.projectFactVersions.factId, factId), eq(schema.projectFactVersions.version, version), eq(schema.projectFactVersions.projectId, projectId)) })
  if (!v) throw new Error('Version not found')
  const fact = await getFact(projectId, factId)
  if (!fact) throw new Error('Fact not found')
  return upsertFact(projectId, { key: fact.key, value: v.newValue, source: 'restored', note: `Restored from v${version}` }, { by, force: true })
}

export function guessCategory(key: string): FactCategory {
  if (/token|supply|price|symbol|tge|vesting|allocation|utility|fdv|market_cap/.test(key)) return 'token'
  if (/fund|invest|raise|valuation|backer|vc/.test(key)) return 'funding'
  if (/partner|integration|ecosystem|collab/.test(key)) return 'partners'
  if (/team|founder|ceo|cto|advisor/.test(key)) return 'team'
  if (/roadmap|milestone|q[1-4]|launch|phase/.test(key)) return 'roadmap'
  if (/exchange|listing|cex|dex|binance|okx|bybit|coinbase/.test(key)) return 'exchange'
  if (/audit|security|certik|slowmist/.test(key)) return 'audit'
  if (/contract|address|chain|network/.test(key)) return 'contract'
  if (/tvl|user|volume|holder|revenue|apy|metric|transaction/.test(key)) return 'metrics'
  if (/product|feature|app|platform|protocol|technology|tech/.test(key)) return 'product'
  if (/slogan|tone|brand|mission|vision|positioning/.test(key)) return 'brand'
  return 'general'
}

export interface ExtractedFact { key: string; label: string; value: string; category: string; confidence: number; quote?: string; page?: number }

/** Uses the extraction model to pull structured facts from a chunk of text (sourced). */
export async function extractFactsFromText(ctx: { orgId: string; projectId: string; userId?: string | null }, text: string, sourceName: string, projectName: string) {
  const MAX = 60000
  const body = text.length > MAX ? text.slice(0, MAX) + '\n\n[...truncated...]' : text
  const { data } = await runJson<{ facts: ExtractedFact[] }>({ ...ctx, taskType: 'extraction' }, {
    messages: [
      { role: 'system', content: GLOBAL_SYSTEM_PROMPT + `\n\nYou are extracting STRUCTURED FACTS about the Web3 project "${projectName}" from a source document named "${sourceName}". Extract only facts explicitly stated in the text. Never infer numbers.` },
      { role: 'user', content: `Extract project facts as JSON: {"facts":[{"key":"snake_case_key","label":"Human label","value":"exact value","category":"token|funding|partners|product|team|roadmap|exchange|audit|contract|metrics|brand|general","confidence":0-1,"quote":"short supporting quote (max 160 chars)","page":page_number_if_known}]}

Prefer these canonical keys when applicable: project_name, one_liner, slogan, industry, chain, token_name, token_symbol, token_supply, token_price, token_utility, token_allocation, vesting, tge_date, launch_date, funding_amount, valuation, investors, partners, exchanges, audit, contract_address, product, target_audience, business_model, competitors, team, roadmap, tvl, users, website, twitter, telegram, discord, docs.
Use one fact per key; combine lists with ", ". Max 40 facts. Values in the document's own language.

SOURCE TEXT:\n${body}` }
    ],
    maxTokens: 4000
  }, { facts: [] })
  return (data.facts ?? []).filter((f) => f && f.key && f.value).map((f) => ({ ...f, key: normalizeKey(f.key), confidence: Math.min(1, Math.max(0, Number(f.confidence) || 0.6)) }))
}

/** Runs extraction over a source's document and merges facts (never overriding locked/confirmed facts). */
export async function extractAndMergeFacts(ctx: { orgId: string; projectId: string; userId?: string | null }, sourceId: string, sourceName: string, text: string, projectName: string) {
  const extracted = await extractFactsFromText(ctx, text, sourceName, projectName)
  const results: { key: string; status: 'added' | 'updated' | 'unchanged' | 'conflict'; current?: string; proposed?: string }[] = []
  for (const f of extracted) {
    const r = await upsertFact(ctx.projectId, {
      key: f.key, label: f.label, value: f.value, category: f.category, source: sourceName, confidence: f.confidence,
      sourceRef: { sourceId, sourceName, page: f.page, quote: f.quote }
    }, { by: 'ai' })
    if (r.conflict) results.push({ key: f.key, status: 'conflict', current: r.conflict.current, proposed: r.conflict.proposed })
    else results.push({ key: f.key, status: r.changed ? (r.fact.version === 1 ? 'added' : 'updated') : 'unchanged' })
  }
  return results
}

/** Renders facts for prompts, honouring priority: locked > confirmed > draft; outdated excluded. */
export function renderFacts(facts: ProjectFact[], opts: { keys?: string[]; categories?: string[]; max?: number } = {}) {
  const order = { locked: 0, confirmed: 1, draft: 2, conflict: 3, outdated: 9 } as Record<string, number>
  let list = facts.filter((f) => f.status !== 'outdated')
  if (opts.keys?.length) list = list.filter((f) => opts.keys!.includes(f.key))
  if (opts.categories?.length) list = list.filter((f) => opts.categories!.includes(f.category))
  list.sort((a, b) => (a.pinned === b.pinned ? (order[a.status] ?? 5) - (order[b.status] ?? 5) : a.pinned ? -1 : 1))
  if (opts.max) list = list.slice(0, opts.max)
  return list.map((f) => `- ${f.label} (${f.key}): ${f.value}${f.status === 'locked' ? ' [LOCKED]' : f.status === 'draft' ? ' [unconfirmed]' : ''}${f.sourceRef?.sourceName ? ` — source: ${f.sourceRef.sourceName}${f.sourceRef.page ? ' p.' + f.sourceRef.page : ''}` : f.source && f.source !== 'user' ? ` — source: ${f.source}` : ' — source: user'}`).join('\n')
}
