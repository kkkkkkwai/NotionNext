import { and, eq, or, ilike, desc } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { runJson, runChat } from '../ai'
import { listFacts } from './facts'
import { listTerminology, applyTerminology } from './memory'
import { saveContentBody } from './content'
import { getProject } from './projects'
import { buildProjectContext } from '../rag/context-builder'
import { OUTPUT_RULES } from '../prompts/system'

// ---------------- Consistency Engine ----------------
export interface ConsistencyIssue { contentId: string; title: string; contentType: string; kind: 'fact' | 'terminology'; key: string; oldValue: string; newValue: string; snippet: string }

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Scans content history for outdated fact values (from fact version history) and stale terminology. */
export async function scanConsistency(projectId: string): Promise<{ issues: ConsistencyIssue[]; scanned: number; checks: { key: string; oldValue: string; newValue: string }[] }> {
  const db = await getDb()
  const [facts, terms, items] = await Promise.all([listFacts(projectId), listTerminology(projectId), db.query.contentItems.findMany({ where: eq(schema.contentItems.projectId, projectId), columns: { id: true, title: true, contentType: true, body: true } })])
  const checks: { key: string; oldValue: string; newValue: string; kind: 'fact' | 'terminology' }[] = []
  for (const f of facts) {
    if (f.version <= 1) continue
    const versions = await db.query.projectFactVersions.findMany({ where: and(eq(schema.projectFactVersions.factId, f.id), eq(schema.projectFactVersions.projectId, projectId)), orderBy: desc(schema.projectFactVersions.version) })
    const olds = new Set(versions.map((v) => v.oldValue).filter((v): v is string => Boolean(v && v !== f.value && v.length >= 2)))
    for (const o of olds) checks.push({ key: f.label, oldValue: o, newValue: f.value, kind: 'fact' })
  }
  for (const t of terms) checks.push({ key: '术语', oldValue: t.oldTerm, newValue: t.newTerm, kind: 'terminology' })
  const issues: ConsistencyIssue[] = []
  for (const it of items) {
    for (const c of checks) {
      if (!c.oldValue || c.oldValue === c.newValue) continue
      const isAscii = /^[\x00-\x7F]+$/.test(c.oldValue)
      const re = isAscii ? new RegExp(`(?<![A-Za-z0-9$])${escapeRe(c.oldValue)}(?![A-Za-z0-9])`, 'i') : new RegExp(escapeRe(c.oldValue))
      const m = it.body.match(re)
      if (!m || m.index === undefined) continue
      // If the new value already appears next to the old (e.g. "1B → 10B"), still flag; users decide.
      const start = Math.max(0, m.index - 60)
      issues.push({ contentId: it.id, title: it.title, contentType: it.contentType, kind: c.kind, key: c.key, oldValue: c.oldValue, newValue: c.newValue, snippet: it.body.slice(start, m.index + c.oldValue.length + 60).replace(/\n/g, ' ') })
    }
  }
  return { issues, scanned: items.length, checks: checks.map(({ kind: _k, ...c }) => c) }
}

/** Applies old→new replacements to the affected content items (creates new versions). */
export async function applyConsistencyFixes(projectId: string, userId: string | null, fixes: { contentId: string; oldValue: string; newValue: string }[]) {
  const db = await getDb()
  const byContent = new Map<string, { oldValue: string; newValue: string }[]>()
  for (const f of fixes) byContent.set(f.contentId, [...(byContent.get(f.contentId) ?? []), f])
  let updated = 0
  for (const [contentId, reps] of byContent) {
    const item = await db.query.contentItems.findFirst({ where: and(eq(schema.contentItems.id, contentId), eq(schema.contentItems.projectId, projectId)) })
    if (!item) continue
    const body = applyTerminology(item.body, reps.map((r) => ({ oldTerm: r.oldValue, newTerm: r.newValue })))
    if (body !== item.body) {
      await saveContentBody(projectId, contentId, body, userId, '一致性更新')
      updated++
    }
  }
  return { updated }
}

// ---------------- Risk Check ----------------
export interface RiskFinding { level: 'high' | 'medium' | 'low'; phrase: string; reason: string; suggestion?: string; index?: number }

const RISK_PATTERNS: { re: RegExp; level: RiskFinding['level']; reason: string }[] = [
  { re: /guaranteed (returns?|profits?|yield|income)|guarantee(d)? (to )?(make|earn)|risk[- ]free|no risk|zero risk|100% (safe|profit|return|gain)|can'?t lose|cannot lose|sure (thing|win)|稳赚|保本|保底收益|固定收益|无风险|零风险|必涨|稳定收益|保证收益|包赚|躺赚|100%收益/i, level: 'high', reason: '承诺保本 / 无风险收益' },
  { re: /\b(will|gonna|going to) (pump|moon|10x|100x|1000x|double|triple)\b|to the moon|next 100x|price (will|is going to) (rise|increase|go up)|暴涨|翻倍|百倍|千倍|财富自由|一夜暴富/i, level: 'high', reason: '价格预测 / 喊单式表述' },
  { re: /\b(\d{2,4})\s?%\s?(apy|apr|returns?|yield|monthly|daily)\b|年化\s?\d{2,}%|日化|月化/i, level: 'medium', reason: '具体收益率数字，必须是已确认的项目事实并附风险提示' },
  { re: /\b(backed by|partnered with|partnership with|in partnership with|invested by|投资方|合作伙伴|战略合作)\b/i, level: 'medium', reason: '合作方 / 投资方声明，需与已确认的项目事实核对' },
  { re: /\b(listed on|listing on|now on|trading on|上线|登陆)\s+(binance|coinbase|okx|bybit|kraken|kucoin|gate|bitget|htx|upbit|bithumb|币安)\b/i, level: 'medium', reason: '交易所上线声明，需与已确认事实核对' },
  { re: /\b(sec|regulated|licensed|compliant with|fully compliant|approved by)\b|监管批准|合规牌照|持牌/i, level: 'medium', reason: '监管 / 合规声明需法务确认' },
  { re: /\b(audited by|audit(ed)? (by|from))\b|审计机构|已审计/i, level: 'medium', reason: '审计声明，需确认审计机构为已确认事实' },
  { re: /\b(investment advice|financial advice|buy now|invest now|don'?t miss out|last chance)\b|投资建议|马上买入|抓紧上车|最后机会/i, level: 'low', reason: '投资劝诱类措辞' },
  { re: /\b(best|#1|number one|the only|first ever|revolutionary|unprecedented)\b|全球第一|唯一|史无前例|颠覆/i, level: 'low', reason: '缺乏依据的最高级表述' },
  { re: /\[Missing:[^\]]*\]/i, level: 'low', reason: '存在未填写的占位符，内容尚不能发布' }
]

/** Deterministic lexical risk scan (fast, no AI), plus fact cross-check for partners/exchanges/investors. */
export async function scanRisk(projectId: string, text: string): Promise<{ findings: RiskFinding[]; score: 'high' | 'medium' | 'low' | 'clean' }> {
  const findings: RiskFinding[] = []
  for (const p of RISK_PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags.includes('g') ? p.re.flags : p.re.flags + 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) && findings.length < 60) findings.push({ level: p.level, phrase: m[0], reason: p.reason, index: m.index })
  }
  const facts = await listFacts(projectId)
  const known = (keys: string[]) => facts.filter((f) => keys.some((k) => f.key.includes(k)) && f.status !== 'outdated').map((f) => f.value.toLowerCase()).join(' ')
  const partners = known(['partner', 'investor', 'backer', 'exchange', 'listing', 'audit'])
  for (const f of findings) {
    if (f.level !== 'medium') continue
    const after = text.slice((f.index ?? 0) + f.phrase.length, (f.index ?? 0) + f.phrase.length + 80).split(/[.,;\n。，]/)[0].trim().toLowerCase()
    const names = after.split(/\s+(?:and|&|,|、|和)\s+|,|、/).map((s) => s.trim()).filter((s) => s.length > 1)
    const unknown = names.filter((n) => n && !partners.includes(n))
    if (unknown.length && names.length) f.suggestion = `未在已确认事实中找到：${unknown.slice(0, 3).join('、')}`
  }
  const score = findings.some((f) => f.level === 'high') ? 'high' : findings.some((f) => f.level === 'medium') ? 'medium' : findings.length ? 'low' : 'clean'
  return { findings, score }
}

/** Rewrites content to remove risky claims while keeping the message. */
export async function rewriteSafely(ctx: { orgId: string; projectId: string; userId?: string | null }, contentId: string, findings: RiskFinding[]) {
  const db = await getDb()
  const project = await getProject(ctx.orgId, ctx.projectId)
  if (!project) throw new Error('项目不存在')
  const item = await db.query.contentItems.findFirst({ where: and(eq(schema.contentItems.id, contentId), eq(schema.contentItems.projectId, ctx.projectId)) })
  if (!item) throw new Error('内容不存在')
  const built = await buildProjectContext(ctx.orgId, project, { request: 'compliance rewrite ' + item.title, includeContentHistory: false, knowledgeLimit: 3, extraInstructions: OUTPUT_RULES })
  const res = await runChat({ ...ctx, taskType: 'risk', contentType: item.contentType }, {
    messages: [
      { role: 'system', content: built.system },
      { role: 'user', content: `Rewrite the content below so it is compliant for Web3 marketing: remove/replace every flagged phrase, keep the message, length, format and language. Unverified partner/exchange/investor names must become [Missing: …] unless present in PROJECT FACTS.\n\nFLAGGED:\n${findings.map((f) => `- [${f.level}] "${f.phrase}" — ${f.reason}`).join('\n')}\n\nCONTENT:\n${item.body}` }
    ],
    temperature: 0.4
  })
  const body = res.text.trim()
  const updated = await saveContentBody(ctx.projectId, contentId, body, ctx.userId ?? null, '安全改写')
  return updated
}

export async function findContentMentioning(projectId: string, term: string) {
  const db = await getDb()
  return db.query.contentItems.findMany({ where: and(eq(schema.contentItems.projectId, projectId), or(ilike(schema.contentItems.body, `%${term}%`), ilike(schema.contentItems.title, `%${term}%`))), columns: { id: true, title: true, contentType: true } })
}

export { runJson }
