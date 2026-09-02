import { and, asc, eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { decrypt, encrypt, maskKey } from '../crypto'
import { getAdapter } from '../ai/providers'
import { DEFAULT_MODELS, PROVIDER_META } from '../ai/pricing'
import type { ProviderKind } from '../ai/types'

export async function listProviders(orgId: string) {
  const db = await getDb()
  const rows = await db.query.aiProviders.findMany({ where: eq(schema.aiProviders.orgId, orgId), orderBy: asc(schema.aiProviders.createdAt) })
  return rows.map((r) => ({ ...r, apiKeyEnc: undefined, apiKeyMasked: r.apiKeyEnc ? maskKey(safeDecrypt(r.apiKeyEnc)) : '', hasKey: Boolean(r.apiKeyEnc) }))
}

function safeDecrypt(v: string) {
  try {
    return decrypt(v)
  } catch {
    return ''
  }
}

export interface ProviderInput { provider: ProviderKind; name?: string; apiKey?: string; baseUrl?: string; defaultModel?: string; embeddingModel?: string; temperature?: number; maxTokens?: number; enabled?: boolean }

export async function saveProvider(orgId: string, input: ProviderInput, id?: string) {
  const db = await getDb()
  const meta = PROVIDER_META[input.provider]
  const values = {
    orgId, provider: input.provider, name: input.name?.trim() || meta?.label || input.provider,
    baseUrl: input.baseUrl?.trim() || null, defaultModel: input.defaultModel?.trim() || DEFAULT_MODELS[input.provider]?.fast || null,
    embeddingModel: input.embeddingModel?.trim() || DEFAULT_MODELS[input.provider]?.embedding || null,
    temperature: input.temperature ?? 0.7, maxTokens: input.maxTokens ?? 4096, enabled: input.enabled ?? true
  }
  if (id) {
    const patch: Record<string, unknown> = { ...values }
    if (input.apiKey && input.apiKey.trim() && !input.apiKey.includes('••')) patch.apiKeyEnc = encrypt(input.apiKey.trim())
    const [row] = await db.update(schema.aiProviders).set(patch).where(and(eq(schema.aiProviders.id, id), eq(schema.aiProviders.orgId, orgId))).returning()
    return row
  }
  const [row] = await db.insert(schema.aiProviders).values({ ...values, apiKeyEnc: input.apiKey?.trim() ? encrypt(input.apiKey.trim()) : null }).returning()
  return row
}

export async function deleteProvider(orgId: string, id: string) {
  const db = await getDb()
  await db.delete(schema.aiProviders).where(and(eq(schema.aiProviders.id, id), eq(schema.aiProviders.orgId, orgId)))
  await db.update(schema.aiSettings).set({ providerId: null }).where(and(eq(schema.aiSettings.orgId, orgId), eq(schema.aiSettings.providerId, id)))
}

/** Tests a provider by listing models (or a 1-token chat if listing is unsupported). */
export async function testProvider(orgId: string, id: string) {
  const db = await getDb()
  const row = await db.query.aiProviders.findFirst({ where: and(eq(schema.aiProviders.id, id), eq(schema.aiProviders.orgId, orgId)) })
  if (!row) throw new Error('Provider not found')
  const apiKey = row.apiKeyEnc ? decrypt(row.apiKeyEnc) : process.env[PROVIDER_META[row.provider]?.envKey ?? ''] ?? ''
  if (!apiKey) throw new Error('No API key set')
  const adapter = getAdapter(row.provider as ProviderKind)
  const creds = { kind: row.provider as ProviderKind, apiKey, baseUrl: row.baseUrl ?? undefined }
  const started = Date.now()
  let models: string[] = []
  try {
    models = adapter.listModels ? await adapter.listModels(creds) : []
  } catch (e) {
    // fall through to chat test
    console.warn('[ai] listModels failed', e)
  }
  const model = row.defaultModel || DEFAULT_MODELS[row.provider]?.fast || models[0]
  const res = await adapter.chat(creds, { model: model!, messages: [{ role: 'user', content: 'Reply with the single word: OK' }], maxTokens: 20 })
  return { ok: true, model, reply: res.text.trim().slice(0, 40), latencyMs: Date.now() - started, models: models.slice(0, 200) }
}

export async function listTaskSettings(orgId: string) {
  const db = await getDb()
  return db.query.aiSettings.findMany({ where: eq(schema.aiSettings.orgId, orgId) })
}

export async function saveTaskSetting(orgId: string, taskType: string, patch: { providerId?: string | null; model?: string | null; temperature?: number | null; maxTokens?: number | null }) {
  const db = await getDb()
  const [row] = await db.insert(schema.aiSettings).values({ orgId, taskType, providerId: patch.providerId ?? null, model: patch.model ?? null, temperature: patch.temperature ?? null, maxTokens: patch.maxTokens ?? null })
    .onConflictDoUpdate({ target: [schema.aiSettings.orgId, schema.aiSettings.taskType], set: { providerId: patch.providerId ?? null, model: patch.model ?? null, temperature: patch.temperature ?? null, maxTokens: patch.maxTokens ?? null } }).returning()
  return row
}

export function systemKeysAvailable() {
  return Object.entries(PROVIDER_META).filter(([, m]) => m.envKey && process.env[m.envKey]?.trim()).map(([k, m]) => ({ provider: k, label: m.label }))
}
