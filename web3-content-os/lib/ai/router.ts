import { and, asc, eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { decrypt } from '../crypto'
import { DEFAULT_MODELS, PROVIDER_META } from './pricing'
import { AIError, TASK_TYPES, type ProviderCredentials, type ProviderKind, type TaskType } from './types'

export interface ResolvedModel {
  creds: ProviderCredentials
  model: string
  temperature: number
  maxTokens: number
  providerId?: string
  providerName: string
  isSystemKey: boolean
}

function tierOf(task: TaskType) {
  return TASK_TYPES.find((t) => t.id === task)?.tier ?? 'fast'
}

function envKeyFor(kind: ProviderKind) {
  const env = PROVIDER_META[kind]?.envKey
  return env ? process.env[env]?.trim() : undefined
}

function systemProvider(): { kind: ProviderKind; apiKey: string } | null {
  const preferred = (process.env.SYSTEM_DEFAULT_PROVIDER as ProviderKind) || 'openai'
  const order: ProviderKind[] = [preferred, 'openai', 'anthropic', 'gemini', 'openrouter']
  for (const kind of order) {
    const key = envKeyFor(kind)
    if (key) return { kind, apiKey: key }
  }
  return null
}

function pickModel(kind: ProviderKind, task: TaskType, override?: string | null) {
  if (override) return override
  const tier = tierOf(task)
  const d = DEFAULT_MODELS[kind] ?? DEFAULT_MODELS.openai
  if (tier === 'embedding') return d.embedding ?? 'text-embedding-3-small'
  return d[tier === 'long' ? 'long' : tier === 'strong' ? 'strong' : 'fast']
}

function defaultMaxTokens(task: TaskType) {
  const tier = tierOf(task)
  if (tier === 'long') return 12000
  if (tier === 'strong') return 8000
  return 4000
}

/** Resolves which provider + model should serve a task for an organization. */
export async function resolveModel(orgId: string, task: TaskType): Promise<ResolvedModel> {
  const db = await getDb()
  const [settings, providers] = await Promise.all([
    db.query.aiSettings.findFirst({ where: and(eq(schema.aiSettings.orgId, orgId), eq(schema.aiSettings.taskType, task)) }),
    db.query.aiProviders.findMany({ where: and(eq(schema.aiProviders.orgId, orgId), eq(schema.aiProviders.enabled, true)), orderBy: asc(schema.aiProviders.createdAt) })
  ])

  const toCreds = (p: typeof providers[number]): ProviderCredentials => ({
    kind: p.provider as ProviderKind,
    apiKey: p.apiKeyEnc ? decrypt(p.apiKeyEnc) : envKeyFor(p.provider as ProviderKind) ?? '',
    baseUrl: p.baseUrl ?? undefined
  })

  if (settings?.providerId) {
    const p = providers.find((x) => x.id === settings.providerId)
    if (p) {
      const creds = toCreds(p)
      if (creds.apiKey) {
        const model = task === 'embedding' ? settings.model || p.embeddingModel || pickModel(creds.kind, task) : settings.model || p.defaultModel || pickModel(creds.kind, task)
        return { creds, model, temperature: settings.temperature ?? p.temperature, maxTokens: settings.maxTokens ?? p.maxTokens ?? defaultMaxTokens(task), providerId: p.id, providerName: p.name, isSystemKey: false }
      }
    }
  }

  for (const p of providers) {
    const creds = toCreds(p)
    if (!creds.apiKey) continue
    if (task === 'embedding') {
      const model = p.embeddingModel || DEFAULT_MODELS[creds.kind]?.embedding
      if (!model) continue
      return { creds, model, temperature: 0, maxTokens: 0, providerId: p.id, providerName: p.name, isSystemKey: false }
    }
    // Fast tier uses the provider's configured default model. Strong/long tiers use the provider's tier default,
    // except for OpenAI-compatible endpoints where we cannot know model names — there the configured model is used.
    const tier = tierOf(task)
    const tierDefault = pickModel(creds.kind, task)
    const model = settings?.model || (tier === 'fast' || creds.kind === 'openai_compatible' ? p.defaultModel || tierDefault : tierDefault)
    return { creds, model, temperature: settings?.temperature ?? p.temperature, maxTokens: settings?.maxTokens ?? Math.max(p.maxTokens, defaultMaxTokens(task)), providerId: p.id, providerName: p.name, isSystemKey: false }
  }

  const sys = systemProvider()
  if (sys) {
    const creds: ProviderCredentials = { kind: sys.kind, apiKey: sys.apiKey }
    const model = task === 'embedding'
      ? process.env.SYSTEM_EMBEDDING_MODEL || DEFAULT_MODELS[sys.kind]?.embedding || ''
      : settings?.model || (tierOf(task) === 'fast' && process.env.SYSTEM_DEFAULT_MODEL ? process.env.SYSTEM_DEFAULT_MODEL : pickModel(sys.kind, task))
    if (task === 'embedding' && !model) throw new AIError('No embedding model available for the system provider', 424)
    return { creds, model, temperature: settings?.temperature ?? 0.7, maxTokens: settings?.maxTokens ?? defaultMaxTokens(task), providerName: `System (${PROVIDER_META[sys.kind].label})`, isSystemKey: true }
  }

  throw new AIError('No AI provider configured. Add an API key in Settings → AI Providers.', 424)
}

export async function hasAnyProvider(orgId: string) {
  try {
    await resolveModel(orgId, 'content_fast')
    return true
  } catch {
    return false
  }
}
