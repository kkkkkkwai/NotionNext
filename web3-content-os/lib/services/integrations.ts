import { and, desc, eq, lte } from 'drizzle-orm'
import { createHmac, randomBytes } from 'node:crypto'
import { getDb, schema } from '../db'
import { decrypt, encrypt } from '../crypto'
import { describeError } from '../utils'

export type IntegrationKind = 'telegram' | 'x'
export interface TelegramConfig { botToken: string; chatId: string }
export interface XConfig { apiKey: string; apiSecret: string; accessToken: string; accessSecret: string }
export type IntegrationConfig = TelegramConfig | XConfig

export const INTEGRATION_META: Record<IntegrationKind, { label: string; fields: { key: string; label: string; secret?: boolean; hint?: string }[] }> = {
  telegram: { label: 'Telegram', fields: [{ key: 'botToken', label: 'Bot Token', secret: true, hint: '从 @BotFather 获取' }, { key: 'chatId', label: '频道 / 群组 ID', hint: '@yourchannel 或 -100xxxxxxxxxx' }] },
  x: { label: 'X (Twitter)', fields: [{ key: 'apiKey', label: 'API Key（Consumer Key）', secret: true }, { key: 'apiSecret', label: 'API Secret', secret: true }, { key: 'accessToken', label: 'Access Token', secret: true }, { key: 'accessSecret', label: 'Access Token Secret', secret: true, hint: '需要 Read + Write 权限的用户授权' }] }
}

export async function listIntegrations(projectId: string) {
  const db = await getDb()
  const rows = await db.query.integrations.findMany({ where: eq(schema.integrations.projectId, projectId) })
  return rows.map((r) => ({ id: r.id, kind: r.kind as IntegrationKind, name: r.name, enabled: r.enabled, meta: r.meta, lastTestedAt: r.lastTestedAt, createdAt: r.createdAt, configured: Object.keys(safeConfig(r.configEnc)) }))
}

function safeConfig(enc: string): Record<string, string> {
  try {
    return JSON.parse(decrypt(enc))
  } catch {
    return {}
  }
}

export async function saveIntegration(projectId: string, kind: IntegrationKind, config: Record<string, string>, name?: string) {
  const db = await getDb()
  const existing = await db.query.integrations.findFirst({ where: and(eq(schema.integrations.projectId, projectId), eq(schema.integrations.kind, kind)) })
  const merged = { ...(existing ? safeConfig(existing.configEnc) : {}) }
  for (const [k, v] of Object.entries(config)) if (v && !v.includes('••')) merged[k] = v.trim()
  const missing = INTEGRATION_META[kind].fields.filter((f) => !merged[f.key]).map((f) => f.label)
  if (missing.length) throw new Error('缺少：' + missing.join('、'))
  const configEnc = encrypt(JSON.stringify(merged))
  if (existing) {
    const [row] = await db.update(schema.integrations).set({ configEnc, name: name || existing.name, enabled: true }).where(eq(schema.integrations.id, existing.id)).returning()
    return row
  }
  const [row] = await db.insert(schema.integrations).values({ projectId, kind, name: name || INTEGRATION_META[kind].label, configEnc }).returning()
  return row
}

export async function deleteIntegration(projectId: string, kind: IntegrationKind) {
  const db = await getDb()
  await db.delete(schema.integrations).where(and(eq(schema.integrations.projectId, projectId), eq(schema.integrations.kind, kind)))
}

async function getConfig<T extends IntegrationConfig>(projectId: string, kind: IntegrationKind): Promise<T> {
  const db = await getDb()
  const row = await db.query.integrations.findFirst({ where: and(eq(schema.integrations.projectId, projectId), eq(schema.integrations.kind, kind), eq(schema.integrations.enabled, true)) })
  if (!row) throw new Error(`该项目尚未连接 ${INTEGRATION_META[kind].label}`)
  return safeConfig(row.configEnc) as unknown as T
}

// ---------------- Telegram ----------------
const TG_BASE = () => (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '')

async function telegramSend(cfg: TelegramConfig, text: string) {
  const res = await fetch(`${TG_BASE()}/bot${cfg.botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: cfg.chatId, text, disable_web_page_preview: false }) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(`Telegram: ${data.description || res.status}`)
  const msg = data.result
  const username = msg?.chat?.username
  return { externalId: String(msg?.message_id ?? ''), url: username ? `https://t.me/${username}/${msg.message_id}` : undefined }
}

async function telegramTest(cfg: TelegramConfig) {
  const res = await fetch(`${TG_BASE()}/bot${cfg.botToken}/getMe`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(`Telegram: ${data.description || res.status}`)
  return { ok: true, account: '@' + data.result?.username }
}

// ---------------- X (OAuth 1.0a user context) ----------------
const X_BASE = () => (process.env.X_API_BASE || 'https://api.x.com').replace(/\/$/, '')

function pct(s: string) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

export function oauth1Header(cfg: XConfig, method: string, url: string, extra: Record<string, string> = {}) {
  const params: Record<string, string> = {
    oauth_consumer_key: cfg.apiKey, oauth_nonce: randomBytes(16).toString('hex'), oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)), oauth_token: cfg.accessToken, oauth_version: '1.0', ...extra
  }
  const base = [method.toUpperCase(), pct(url), pct(Object.keys(params).sort().map((k) => `${pct(k)}=${pct(params[k])}`).join('&'))].join('&')
  const key = `${pct(cfg.apiSecret)}&${pct(cfg.accessSecret)}`
  const signature = createHmac('sha1', key).update(base).digest('base64')
  const header: Record<string, string> = { ...params, oauth_signature: signature }
  return 'OAuth ' + Object.keys(header).sort().filter((k) => k.startsWith('oauth_')).map((k) => `${pct(k)}="${pct(header[k])}"`).join(', ')
}

async function xPost(cfg: XConfig, text: string) {
  const url = `${X_BASE()}/2/tweets`
  const res = await fetch(url, { method: 'POST', headers: { Authorization: oauth1Header(cfg, 'POST', url), 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`X: ${data.detail || data.title || data.error || res.status}`)
  const id = data.data?.id
  return { externalId: String(id ?? ''), url: id ? `https://x.com/i/status/${id}` : undefined }
}

async function xTest(cfg: XConfig) {
  const url = `${X_BASE()}/2/users/me`
  const res = await fetch(url, { headers: { Authorization: oauth1Header(cfg, 'GET', url) } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`X: ${data.detail || data.title || res.status}`)
  return { ok: true, account: '@' + data.data?.username }
}

export async function testIntegration(projectId: string, kind: IntegrationKind) {
  const db = await getDb()
  const result = kind === 'telegram' ? await telegramTest(await getConfig<TelegramConfig>(projectId, 'telegram')) : await xTest(await getConfig<XConfig>(projectId, 'x'))
  await db.update(schema.integrations).set({ lastTestedAt: new Date(), meta: { account: result.account } }).where(and(eq(schema.integrations.projectId, projectId), eq(schema.integrations.kind, kind)))
  return result
}

/** Splits a tweet-length-agnostic body into X posts (threads are posted as replies). */
function splitForX(body: string): string[] {
  const parts = body.split(/\n\s*\n(?=\s*\d+\/)|\n---\n/).map((p) => p.trim()).filter(Boolean)
  const out: string[] = []
  for (const p of parts.length ? parts : [body]) {
    if (p.length <= 280) out.push(p)
    else {
      let cur = ''
      for (const s of p.split(/(?<=[.!?。！？])\s+/)) {
        if ((cur + ' ' + s).trim().length > 275) {
          if (cur) out.push(cur.trim())
          cur = s
        } else cur = (cur + ' ' + s).trim()
      }
      if (cur) out.push(cur.trim())
    }
  }
  return out.slice(0, 25)
}

async function xPostThread(cfg: XConfig, texts: string[]) {
  let replyTo: string | undefined
  let first: { externalId: string; url?: string } | undefined
  for (const t of texts) {
    const url = `${X_BASE()}/2/tweets`
    const body: Record<string, unknown> = { text: t }
    if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo }
    const res = await fetch(url, { method: 'POST', headers: { Authorization: oauth1Header(cfg, 'POST', url), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`X: ${data.detail || data.title || data.error || res.status}`)
    replyTo = data.data?.id
    if (!first) first = { externalId: String(replyTo ?? ''), url: replyTo ? `https://x.com/i/status/${replyTo}` : undefined }
  }
  return first!
}

/** Publishes a content item to a channel, records the result and updates the item. */
export async function publishContent(projectId: string, contentId: string, channel: IntegrationKind) {
  const db = await getDb()
  const item = await db.query.contentItems.findFirst({ where: and(eq(schema.contentItems.id, contentId), eq(schema.contentItems.projectId, projectId)) })
  if (!item) throw new Error('内容不存在')
  const text = item.body.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').trim()
  try {
    const result = channel === 'telegram'
      ? await telegramSend(await getConfig<TelegramConfig>(projectId, 'telegram'), text.slice(0, 4000))
      : text.length > 280 ? await xPostThread(await getConfig<XConfig>(projectId, 'x'), splitForX(text)) : await xPost(await getConfig<XConfig>(projectId, 'x'), text)
    await db.insert(schema.publishLogs).values({ projectId, contentId, channel, status: 'success', externalId: result.externalId, url: result.url ?? null })
    const [updated] = await db.update(schema.contentItems).set({ status: 'published', publishedAt: new Date(), publishChannel: channel, publishedUrl: result.url ?? null, updatedAt: new Date() }).where(eq(schema.contentItems.id, contentId)).returning()
    return { item: updated, url: result.url, externalId: result.externalId }
  } catch (err) {
    const message = describeError(err)
    await db.insert(schema.publishLogs).values({ projectId, contentId, channel, status: 'failed', error: message })
    throw new Error(message)
  }
}

export async function listPublishLogs(projectId: string, limit = 50) {
  const db = await getDb()
  return db.select({ id: schema.publishLogs.id, contentId: schema.publishLogs.contentId, channel: schema.publishLogs.channel, status: schema.publishLogs.status, url: schema.publishLogs.url, error: schema.publishLogs.error, createdAt: schema.publishLogs.createdAt, title: schema.contentItems.title })
    .from(schema.publishLogs).leftJoin(schema.contentItems, eq(schema.contentItems.id, schema.publishLogs.contentId)).where(eq(schema.publishLogs.projectId, projectId)).orderBy(desc(schema.publishLogs.createdAt)).limit(limit)
}

/** Publishes every due scheduled item that has auto-publish enabled. Called by the scheduler. */
export async function publishDueContent() {
  const db = await getDb()
  const due = await db.query.contentItems.findMany({ where: and(eq(schema.contentItems.status, 'scheduled'), eq(schema.contentItems.autoPublish, true), lte(schema.contentItems.scheduledAt, new Date())), limit: 20 })
  const results: { id: string; ok: boolean; error?: string }[] = []
  for (const item of due) {
    if (!item.publishChannel) continue
    try {
      await publishContent(item.projectId, item.id, item.publishChannel as IntegrationKind)
      results.push({ id: item.id, ok: true })
    } catch (e) {
      // Prevent endless retries: disable auto publish after a failure and keep it scheduled for a human.
      await db.update(schema.contentItems).set({ autoPublish: false }).where(eq(schema.contentItems.id, item.id))
      results.push({ id: item.id, ok: false, error: describeError(e) })
    }
  }
  return results
}
