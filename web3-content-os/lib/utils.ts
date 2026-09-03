import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'project'
}

export function truncate(s: string, n: number) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export function formatCost(n: number) {
  if (n === 0) return '$0.00'
  if (n < 0.01) return '<$0.01'
  return '$' + n.toFixed(2)
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

/** Extracts the first JSON object/array from an LLM response (tolerates ```json fences and prose). */
export function extractJson<T>(text: string, fallback: T): T {
  if (!text) return fallback
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = [fenced?.[1], text]
  for (const c of candidates) {
    if (!c) continue
    const trimmed = c.trim()
    try {
      return JSON.parse(trimmed) as T
    } catch {}
    const start = Math.min(...['{', '['].map((ch) => { const i = trimmed.indexOf(ch); return i === -1 ? Infinity : i }))
    if (!Number.isFinite(start)) continue
    const open = trimmed[start]
    const close = open === '{' ? '}' : ']'
    const end = trimmed.lastIndexOf(close)
    if (end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T
      } catch {}
    }
  }
  return fallback
}

export function relativeTime(date: Date | string | null | undefined) {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

/** Extracts a readable message from any error, including Drizzle query errors that hide the DB message in `cause`. */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const cause = (err as { cause?: unknown }).cause
  const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : ''
  const head = err.message.split('\nparams:')[0].split('\n')[0]
  return causeMsg && !head.includes(causeMsg) ? `${head.slice(0, 200)} — ${causeMsg}` : head.slice(0, 400)
}
