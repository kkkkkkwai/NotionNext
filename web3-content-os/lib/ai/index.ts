import { sql } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { getAdapter } from './providers'
import { resolveModel } from './router'
import { estimateCost } from './pricing'
import { localEmbedding, fitDimension } from './local-embedding'
import { AIError, type ChatMessage, type ChatResult, type StreamEvent, type TaskType } from './types'
import { todayISO } from '../utils'

export interface RunContext {
  orgId: string
  projectId?: string | null
  userId?: string | null
  taskType: TaskType
  contentType?: string | null
}

export interface RunOptions {
  messages: ChatMessage[]
  json?: boolean
  temperature?: number
  maxTokens?: number
  model?: string
  signal?: AbortSignal
}

async function log(ctx: RunContext, provider: string, model: string, usage: { inputTokens: number; outputTokens: number }, latencyMs: number, status: 'success' | 'error', error?: string) {
  try {
    const db = await getDb()
    const cost = estimateCost(model, usage.inputTokens, usage.outputTokens)
    await db.insert(schema.aiRequests).values({
      orgId: ctx.orgId, projectId: ctx.projectId ?? null, userId: ctx.userId ?? null, provider, model, taskType: ctx.taskType,
      contentType: ctx.contentType ?? null, inputTokens: Math.round(usage.inputTokens || 0), outputTokens: Math.round(usage.outputTokens || 0), cost, latencyMs, status, error: error?.slice(0, 1000)
    })
    if (status === 'success') {
      await db.insert(schema.aiUsage).values({
        orgId: ctx.orgId, projectId: ctx.projectId ?? null, day: todayISO(), provider, model, taskType: ctx.taskType, contentType: ctx.contentType ?? null,
        requests: 1, inputTokens: Math.round(usage.inputTokens || 0), outputTokens: Math.round(usage.outputTokens || 0), cost
      }).onConflictDoUpdate({
        target: [schema.aiUsage.orgId, schema.aiUsage.projectId, schema.aiUsage.day, schema.aiUsage.provider, schema.aiUsage.model, schema.aiUsage.taskType, schema.aiUsage.contentType],
        set: {
          requests: sql`${schema.aiUsage.requests} + 1`,
          inputTokens: sql`${schema.aiUsage.inputTokens} + ${Math.round(usage.inputTokens || 0)}`,
          outputTokens: sql`${schema.aiUsage.outputTokens} + ${Math.round(usage.outputTokens || 0)}`,
          cost: sql`${schema.aiUsage.cost} + ${cost}`
        }
      })
    }
  } catch (e) {
    console.error('[ai] usage log failed', e)
  }
}

/** Runs a non-streaming chat completion through the router with usage accounting. */
export async function runChat(ctx: RunContext, opts: RunOptions): Promise<ChatResult & { provider: string }> {
  const resolved = await resolveModel(ctx.orgId, ctx.taskType)
  const model = opts.model || resolved.model
  const adapter = getAdapter(resolved.creds.kind)
  const started = Date.now()
  try {
    const result = await adapter.chat(resolved.creds, {
      model, messages: opts.messages, json: opts.json,
      temperature: opts.temperature ?? resolved.temperature,
      maxTokens: opts.maxTokens ?? resolved.maxTokens,
      signal: opts.signal
    })
    await log(ctx, resolved.creds.kind, model, result.usage, Date.now() - started, 'success')
    return { ...result, provider: resolved.creds.kind }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await log(ctx, resolved.creds.kind, model, { inputTokens: 0, outputTokens: 0 }, Date.now() - started, 'error', message)
    throw err instanceof AIError ? err : new AIError(message, 500, resolved.creds.kind)
  }
}

/** Runs a JSON-mode completion and parses the result. */
export async function runJson<T>(ctx: RunContext, opts: RunOptions, fallback: T): Promise<{ data: T; raw: string; model: string }> {
  const { extractJson } = await import('../utils')
  const res = await runChat(ctx, { ...opts, json: true, temperature: opts.temperature ?? 0.2 })
  return { data: extractJson<T>(res.text, fallback), raw: res.text, model: res.model }
}

/** Streams a chat completion. Usage is logged when the stream finishes. */
export async function* streamChat(ctx: RunContext, opts: RunOptions): AsyncGenerator<StreamEvent & { model?: string }> {
  const resolved = await resolveModel(ctx.orgId, ctx.taskType)
  const model = opts.model || resolved.model
  const adapter = getAdapter(resolved.creds.kind)
  const started = Date.now()
  try {
    for await (const ev of adapter.stream(resolved.creds, {
      model, messages: opts.messages, temperature: opts.temperature ?? resolved.temperature, maxTokens: opts.maxTokens ?? resolved.maxTokens, signal: opts.signal
    })) {
      if (ev.type === 'done') {
        await log(ctx, resolved.creds.kind, model, ev.usage, Date.now() - started, 'success')
        yield { ...ev, model }
      } else yield ev
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await log(ctx, resolved.creds.kind, model, { inputTokens: 0, outputTokens: 0 }, Date.now() - started, 'error', message)
    yield { type: 'error', error: message }
  }
}

export interface EmbedResult { vectors: number[][]; model: string; provider: string; local: boolean }

/** Embeds texts using the configured embedding model, falling back to a local hashed embedding. */
export async function embedTexts(ctx: Omit<RunContext, 'taskType'>, texts: string[]): Promise<EmbedResult> {
  if (texts.length === 0) return { vectors: [], model: 'none', provider: 'none', local: true }
  let resolved
  try {
    resolved = await resolveModel(ctx.orgId, 'embedding')
  } catch {
    return { vectors: texts.map((t) => localEmbedding(t)), model: 'local-hash-v1', provider: 'local', local: true }
  }
  const adapter = getAdapter(resolved.creds.kind)
  if (!adapter.embed) return { vectors: texts.map((t) => localEmbedding(t)), model: 'local-hash-v1', provider: 'local', local: true }
  const started = Date.now()
  const out: number[][] = []
  const BATCH = 64
  let totalTokens = 0
  try {
    for (let i = 0; i < texts.length; i += BATCH) {
      const slice = texts.slice(i, i + BATCH)
      const res = await adapter.embed(resolved.creds, resolved.model, slice)
      totalTokens += res.usage.inputTokens || slice.reduce((a, t) => a + Math.ceil(t.length / 4), 0)
      out.push(...res.vectors.map((v) => fitDimension(v)))
    }
    await log({ ...ctx, taskType: 'embedding' }, resolved.creds.kind, resolved.model, { inputTokens: totalTokens, outputTokens: 0 }, Date.now() - started, 'success')
    return { vectors: out, model: resolved.model, provider: resolved.creds.kind, local: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await log({ ...ctx, taskType: 'embedding' }, resolved.creds.kind, resolved.model, { inputTokens: 0, outputTokens: 0 }, Date.now() - started, 'error', message)
    console.warn('[ai] embedding provider failed, using local embedding:', message)
    return { vectors: texts.map((t) => localEmbedding(t)), model: 'local-hash-v1', provider: 'local', local: true }
  }
}

export { AIError }
export type { ChatMessage, TaskType }
