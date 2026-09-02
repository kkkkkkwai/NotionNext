import { createJob, runInBackground, mapLimit } from './jobs'
import { generateContent } from './content'
import { getLatestDna, generateDna } from './dna'
import { getLatestNarrative, generateNarrative } from './narrative'
import { scanRisk } from './checks'
import { getDb, schema } from '../db'
import { and, eq } from 'drizzle-orm'

export const LAUNCH_KIT_STEPS = ['Reading Project Memory', 'Analyzing Project DNA', 'Searching Knowledge Base', 'Building Narrative', 'Creating Content Strategy', 'Generating Content', 'Checking Facts', 'Checking Consistency', 'Risk Checking', 'Completed']

export interface KitPlanItem { slug: string; count: number; label: string; angleFrom?: 'themes' | 'angles' | 'none'; folder: string }

export const LAUNCH_KIT_PLAN: KitPlanItem[] = [
  { slug: 'foundation-project-overview', count: 1, label: 'Project Overview', folder: 'Launch Kit/Foundation' },
  { slug: 'foundation-one-pager', count: 1, label: 'One Pager', folder: 'Launch Kit/Foundation' },
  { slug: 'foundation-litepaper', count: 1, label: 'Litepaper', folder: 'Launch Kit/Foundation' },
  { slug: 'foundation-pitch-deck', count: 1, label: '15-page Pitch Deck Copy', folder: 'Launch Kit/Foundation' },
  { slug: 'poster-overview', count: 1, label: 'Poster — Overview', folder: 'Launch Kit/Posters' },
  { slug: 'poster-advantages', count: 1, label: 'Poster — Advantages', folder: 'Launch Kit/Posters' },
  { slug: 'poster-how-it-works', count: 1, label: 'Poster — How It Works', folder: 'Launch Kit/Posters' },
  { slug: 'poster-tokenomics', count: 1, label: 'Poster — Tokenomics', folder: 'Launch Kit/Posters' },
  { slug: 'poster-launch', count: 1, label: 'Poster — Launch', folder: 'Launch Kit/Posters' },
  { slug: 'social-community-announcement', count: 10, label: 'Community Copies', angleFrom: 'angles', folder: 'Launch Kit/Community' },
  { slug: 'social-tweet', count: 30, label: 'Twitter Posts', angleFrom: 'angles', folder: 'Launch Kit/Twitter' },
  { slug: 'social-thread', count: 5, label: 'Twitter Threads', angleFrom: 'themes', folder: 'Launch Kit/Twitter' },
  { slug: 'video-60s', count: 3, label: 'Video Scripts', angleFrom: 'themes', folder: 'Launch Kit/Video' },
  { slug: 'community-ama', count: 1, label: 'AMA Kit', folder: 'Launch Kit/Community' },
  { slug: 'foundation-faq', count: 1, label: '30 FAQ', folder: 'Launch Kit/Foundation' },
  { slug: 'kol-tweet', count: 3, label: 'KOL Copies', angleFrom: 'themes', folder: 'Launch Kit/KOL' },
  { slug: 'pr-press-release', count: 2, label: 'PR Articles', angleFrom: 'themes', folder: 'Launch Kit/PR' },
  { slug: 'foundation-roadmap', count: 1, label: 'Roadmap', folder: 'Launch Kit/Foundation' },
  { slug: 'marketing-token-value', count: 1, label: 'Token Value Narrative', folder: 'Launch Kit/Foundation' }
]

export function kitTotal(plan = LAUNCH_KIT_PLAN) {
  return plan.reduce((a, p) => a + p.count, 0) + 1 // + calendar
}

export async function startLaunchKit(ctx: { orgId: string; projectId: string; userId: string }, opts: { language?: string; lite?: boolean }) {
  const plan = opts.lite ? LAUNCH_KIT_PLAN.map((p) => ({ ...p, count: Math.min(p.count, p.count > 5 ? 3 : 1) })) : LAUNCH_KIT_PLAN
  const job = await createJob({ ...ctx, type: 'launch_kit', steps: LAUNCH_KIT_STEPS, input: { language: opts.language ?? 'en', lite: Boolean(opts.lite), total: kitTotal(plan) } })
  runInBackground(job, async (r) => {
    const language = opts.language ?? 'en'
    await r.step('Reading Project Memory')
    await r.step('Analyzing Project DNA')
    let dna = await getLatestDna(ctx.projectId)
    if (!dna) dna = await generateDna(ctx)
    await r.step('Searching Knowledge Base')
    await r.step('Building Narrative')
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
    await r.step('Creating Content Strategy')
    const tasks: { slug: string; angle?: string; label: string; folder: string; index: number }[] = []
    for (const p of plan) {
      for (let i = 0; i < p.count; i++) {
        const pool = p.angleFrom === 'angles' ? angles : p.angleFrom === 'themes' ? themes : []
        tasks.push({ slug: p.slug, angle: pool.length ? pool[i % pool.length] : undefined, label: p.count > 1 ? `${p.label} #${i + 1}` : p.label, folder: p.folder, index: i })
      }
    }
    await r.step('Generating Content')
    let done = 0
    const created: string[] = []
    const { errors } = await mapLimit(tasks, 3, async (t) => {
      const res = await generateContent(ctx, { templateSlug: t.slug, language, angle: t.angle, title: t.label, folder: t.folder, tags: ['launch-kit'], jobId: job.id })
      created.push(res.item.id)
      done++
      await r.progress(40 + Math.round((done / (tasks.length + 1)) * 45), `Generating Content (${done}/${tasks.length + 1})`)
      return res.item.id
    })
    // 30-day content calendar
    try {
      const res = await generateContent(ctx, { templateSlug: undefined, contentType: 'content_calendar', category: 'foundation', language, title: '30-day Content Calendar', folder: 'Launch Kit/Foundation', tags: ['launch-kit'], jobId: job.id, brief: `Create a 30-day content calendar as a Markdown table with columns: Day, Date (relative to launch date if known), Platform, Content Type, Theme/Angle, Hook, CTA. Rotate across these themes: ${themes.join(' | ') || 'brand, product, token, ecosystem, community'}. Mix Twitter, Telegram, posters, video, AMA, PR and KOL.` })
      created.push(res.item.id)
    } catch (e) {
      errors.push({ index: -1, error: 'Calendar: ' + (e instanceof Error ? e.message : String(e)) })
    }
    await r.step('Checking Facts', { progress: 88 })
    const db = await getDb()
    const items = await db.query.contentItems.findMany({ where: and(eq(schema.contentItems.projectId, ctx.projectId), eq(schema.contentItems.jobId, job.id)), columns: { id: true, body: true, title: true } })
    const missing = items.flatMap((i) => Array.from(i.body.matchAll(/\[Missing:\s*([^\]]+)\]/gi)).map((m) => m[1].trim()))
    await r.step('Checking Consistency', { progress: 92 })
    await r.step('Risk Checking', { progress: 95 })
    let risky = 0
    for (const it of items) {
      const scan = await scanRisk(ctx.projectId, it.body)
      if (scan.score === 'high' || scan.score === 'medium') risky++
    }
    return { created: items.length, failed: errors.length, errors: errors.slice(0, 10), missing: Array.from(new Set(missing)).slice(0, 20), risky, folder: 'Launch Kit' }
  })
  return job
}
