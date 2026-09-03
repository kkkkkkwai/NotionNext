import { createJob, runInBackground, mapLimit } from './jobs'
import { generateContent } from './content'
import { getLatestDna, generateDna } from './dna'
import { getLatestNarrative, generateNarrative } from './narrative'
import { scanRisk } from './checks'
import { getDb, schema } from '../db'
import { and, eq } from 'drizzle-orm'

export const LAUNCH_KIT_STEPS = ['读取项目记忆', '分析项目 DNA', '检索知识库', '构建叙事', '制定内容策略', '生成内容', '事实核查', '一致性检查', '风险检查', '完成']

export interface KitPlanItem { slug: string; count: number; label: string; angleFrom?: 'themes' | 'angles' | 'none'; folder: string }

export const LAUNCH_KIT_PLAN: KitPlanItem[] = [
  { slug: 'foundation-project-overview', count: 1, label: '项目概述', folder: '上线内容包/基础资料' },
  { slug: 'foundation-one-pager', count: 1, label: 'One Pager', folder: '上线内容包/基础资料' },
  { slug: 'foundation-litepaper', count: 1, label: 'Litepaper', folder: '上线内容包/基础资料' },
  { slug: 'foundation-pitch-deck', count: 1, label: '15 页 Pitch Deck 文案', folder: '上线内容包/基础资料' },
  { slug: 'poster-overview', count: 1, label: '海报 — 项目概述', folder: '上线内容包/海报' },
  { slug: 'poster-advantages', count: 1, label: '海报 — 项目优势', folder: '上线内容包/海报' },
  { slug: 'poster-how-it-works', count: 1, label: '海报 — 玩法', folder: '上线内容包/海报' },
  { slug: 'poster-tokenomics', count: 1, label: '海报 — 代币经济', folder: '上线内容包/海报' },
  { slug: 'poster-launch', count: 1, label: '海报 — 上线', folder: '上线内容包/海报' },
  { slug: 'social-community-announcement', count: 10, label: '社区文案', angleFrom: 'angles', folder: '上线内容包/社区' },
  { slug: 'social-tweet', count: 30, label: 'Twitter 推文', angleFrom: 'angles', folder: '上线内容包/Twitter' },
  { slug: 'social-thread', count: 5, label: 'Twitter Thread', angleFrom: 'themes', folder: '上线内容包/Twitter' },
  { slug: 'video-60s', count: 3, label: '视频脚本', angleFrom: 'themes', folder: '上线内容包/视频' },
  { slug: 'community-ama', count: 1, label: 'AMA 套件', folder: '上线内容包/社区' },
  { slug: 'foundation-faq', count: 1, label: '30 条 FAQ', folder: '上线内容包/基础资料' },
  { slug: 'kol-tweet', count: 3, label: 'KOL 文案', angleFrom: 'themes', folder: '上线内容包/KOL' },
  { slug: 'pr-press-release', count: 2, label: 'PR 稿件', angleFrom: 'themes', folder: '上线内容包/PR' },
  { slug: 'foundation-roadmap', count: 1, label: '路线图', folder: '上线内容包/基础资料' },
  { slug: 'marketing-token-value', count: 1, label: '代币价值叙事', folder: '上线内容包/基础资料' }
]

export function kitTotal(plan = LAUNCH_KIT_PLAN) {
  return plan.reduce((a, p) => a + p.count, 0) + 1 // + calendar
}

export async function startLaunchKit(ctx: { orgId: string; projectId: string; userId: string }, opts: { language?: string; lite?: boolean }) {
  const plan = opts.lite ? LAUNCH_KIT_PLAN.map((p) => ({ ...p, count: Math.min(p.count, p.count > 5 ? 3 : 1) })) : LAUNCH_KIT_PLAN
  const job = await createJob({ ...ctx, type: 'launch_kit', steps: LAUNCH_KIT_STEPS, input: { language: opts.language ?? 'zh', lite: Boolean(opts.lite), total: kitTotal(plan) } })
  runInBackground(job, async (r) => {
    const language = opts.language ?? 'zh'
    await r.step('读取项目记忆')
    await r.step('分析项目 DNA')
    let dna = await getLatestDna(ctx.projectId)
    if (!dna) dna = await generateDna(ctx)
    await r.step('检索知识库')
    await r.step('构建叙事')
    let narrative = await getLatestNarrative(ctx.projectId)
    if (!narrative) {
      try {
        narrative = await generateNarrative(ctx)
      } catch (e) {
        console.warn('[launch-kit] narrative skipped', e)
      }
    }
    const nd = (narrative?.data ?? {}) as { primary_themes?: { title: string }[]; content_angles?: { angle: string; format: string }[] }
    const themes = (nd.primary_themes ?? []).map((t) => t.title)
    const angles = (nd.content_angles ?? []).map((a) => a.angle)
    await r.step('制定内容策略')
    const tasks: { slug: string; angle?: string; label: string; folder: string; index: number }[] = []
    for (const p of plan) {
      for (let i = 0; i < p.count; i++) {
        const pool = p.angleFrom === 'angles' ? angles : p.angleFrom === 'themes' ? themes : []
        tasks.push({ slug: p.slug, angle: pool.length ? pool[i % pool.length] : undefined, label: p.count > 1 ? `${p.label} #${i + 1}` : p.label, folder: p.folder, index: i })
      }
    }
    await r.step('生成内容')
    let done = 0
    const created: string[] = []
    const { errors } = await mapLimit(tasks, 3, async (t) => {
      const res = await generateContent(ctx, { templateSlug: t.slug, language, angle: t.angle, title: t.label, folder: t.folder, tags: ['launch-kit'], jobId: job.id })
      created.push(res.item.id)
      done++
      await r.progress(40 + Math.round((done / (tasks.length + 1)) * 45), `生成内容 (${done}/${tasks.length + 1})`)
      return res.item.id
    })
    // 30-day content calendar
    try {
      const res = await generateContent(ctx, { templateSlug: undefined, contentType: 'content_calendar', category: 'foundation', language, title: '30 天内容日历', folder: '上线内容包/基础资料', tags: ['launch-kit'], jobId: job.id, brief: `Create a 30-day content calendar as a Markdown table with columns: Day, Date (relative to launch date if known), Platform, Content Type, Theme/Angle, Hook, CTA. Rotate across these themes: ${themes.join(' | ') || 'brand, product, token, ecosystem, community'}. Mix Twitter, Telegram, posters, video, AMA, PR and KOL.` })
      created.push(res.item.id)
    } catch (e) {
      errors.push({ index: -1, error: '内容日历：' + (e instanceof Error ? e.message : String(e)) })
    }
    await r.step('事实核查', { progress: 88 })
    const db = await getDb()
    const items = await db.query.contentItems.findMany({ where: and(eq(schema.contentItems.projectId, ctx.projectId), eq(schema.contentItems.jobId, job.id)), columns: { id: true, body: true, title: true } })
    const missing = items.flatMap((i) => Array.from(i.body.matchAll(/\[Missing:\s*([^\]]+)\]/gi)).map((m) => m[1].trim()))
    await r.step('一致性检查', { progress: 92 })
    await r.step('风险检查', { progress: 95 })
    let risky = 0
    for (const it of items) {
      const scan = await scanRisk(ctx.projectId, it.body)
      if (scan.score === 'high' || scan.score === 'medium') risky++
    }
    return { created: items.length, failed: errors.length, errors: errors.slice(0, 10), missing: Array.from(new Set(missing)).slice(0, 20), risky, folder: '上线内容包' }
  })
  return job
}
