import { and, desc, eq, asc } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { runJson } from '../ai'
import { GLOBAL_SYSTEM_PROMPT } from '../prompts/system'
import { getLatestDna, renderDna, type DnaData } from './dna'
import { listFacts, renderFacts } from './facts'
import { getProject } from './projects'
import { createJob, runInBackground, mapLimit } from './jobs'
import { generateContent } from './content'

export const DEFAULT_DAY_THEMES = ['品牌故事', '核心优势', '产品', '代币用途', '生态', '倒计时', '明日上线', '上线日']

export interface CampaignDayPlan { dayOffset: number; date: string; label: string; theme: string; goal: string; hook: string }

export const CAMPAIGN_STEPS = ['读取项目记忆', '规划活动节奏', '生成每日内容', '排入内容日历', '完成']

export const CAMPAIGN_DAILY_TYPES: { slug: string; label: string }[] = [
  { slug: 'social-tweet', label: 'Twitter 推文' },
  { slug: 'social-telegram', label: 'Telegram 公告' },
  { slug: 'poster-overview', label: '海报文案' },
  { slug: 'kol-tweet', label: 'KOL 文案' },
  { slug: 'social-community-announcement', label: '社区文案' },
  { slug: 'video-30s', label: '短视频脚本' }
]

export async function listCampaigns(projectId: string) {
  const db = await getDb()
  return db.query.campaigns.findMany({ where: eq(schema.campaigns.projectId, projectId), orderBy: desc(schema.campaigns.createdAt) })
}

export async function getCampaign(projectId: string, campaignId: string) {
  const db = await getDb()
  const campaign = await db.query.campaigns.findFirst({ where: and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.projectId, projectId)) })
  if (!campaign) return null
  const items = await db.query.campaignItems.findMany({ where: eq(schema.campaignItems.campaignId, campaignId), orderBy: asc(schema.campaignItems.dayOffset) })
  const content = await db.query.contentItems.findMany({ where: eq(schema.contentItems.campaignId, campaignId), orderBy: asc(schema.contentItems.scheduledAt) })
  return { campaign, items, content }
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Creates a campaign, asks the AI to plan the days, then generates each day's content in the background. */
export async function startCampaign(ctx: { orgId: string; projectId: string; userId: string }, input: { name?: string; goal: string; launchDate: string; daysBefore: number; daysAfter?: number; language?: string; types?: string[] }) {
  const project = await getProject(ctx.orgId, ctx.projectId)
  if (!project) throw new Error('项目不存在')
  const db = await getDb()
  const daysBefore = Math.max(1, Math.min(30, input.daysBefore || 7))
  const daysAfter = Math.max(0, Math.min(14, input.daysAfter ?? 0))
  const start = addDays(input.launchDate, -daysBefore)
  const end = addDays(input.launchDate, daysAfter)
  const [campaign] = await db.insert(schema.campaigns).values({ projectId: ctx.projectId, name: input.name?.trim() || `上线营销活动 — ${input.launchDate}`, goal: input.goal, type: 'launch', startDate: start, endDate: end, status: 'generating', plan: { launchDate: input.launchDate, daysBefore, daysAfter, language: input.language ?? 'zh' } }).returning()
  const job = await createJob({ ...ctx, type: 'campaign', steps: CAMPAIGN_STEPS, input: { campaignId: campaign.id } })
  const types = (input.types?.length ? CAMPAIGN_DAILY_TYPES.filter((t) => input.types!.includes(t.slug)) : CAMPAIGN_DAILY_TYPES)
  runInBackground(job, async (r) => {
    await r.step('读取项目记忆')
    const [dna, facts] = await Promise.all([getLatestDna(ctx.projectId), listFacts(ctx.projectId)])
    await r.step('规划活动节奏')
    const dayList: { dayOffset: number; date: string; label: string }[] = []
    for (let d = -daysBefore; d <= daysAfter; d++) dayList.push({ dayOffset: d, date: addDays(input.launchDate, d), label: d < 0 ? `T${d}` : d === 0 ? '上线日' : `T+${d}` })
    const { data } = await runJson<{ days: CampaignDayPlan[] }>({ ...ctx, taskType: 'narrative' }, {
      messages: [
        { role: 'system', content: GLOBAL_SYSTEM_PROMPT },
        { role: 'user', content: `Plan a launch campaign for "${project.name}".\nGOAL: ${input.goal}\nLAUNCH DATE: ${input.launchDate}\nDAYS: ${dayList.map((d) => `${d.label} (${d.date})`).join(', ')}\n\nPROJECT DNA:\n${renderDna(dna?.data as DnaData | undefined, ['one_sentence_positioning', 'key_selling_points', 'token_utility', 'narrative', 'brand_tone'])}\n\nFACTS:\n${renderFacts(facts, { max: 30 })}\n\nSuggested arc for a 7-day lead-in: Brand Story → Core Advantages → Product → Token Utility → Ecosystem → Countdown → Tomorrow → Launch Day. Adapt to the actual number of days.\nReturn JSON {"days":[{"dayOffset":-7,"date":"YYYY-MM-DD","label":"T-7","theme":"...","goal":"...","hook":"one-line hook"}]} covering every day listed, in ${input.language === 'en' ? 'English' : 'Chinese (Simplified)'}.` }
      ],
      maxTokens: 3000
    }, { days: [] })
    const plannedDays: CampaignDayPlan[] = dayList.map((d, i) => {
      const p = (data.days ?? []).find((x) => Number(x.dayOffset) === d.dayOffset) ?? (data.days ?? [])[i]
      const fallbackTheme = d.dayOffset === 0 ? '上线日' : DEFAULT_DAY_THEMES[Math.max(0, Math.min(DEFAULT_DAY_THEMES.length - 2, DEFAULT_DAY_THEMES.length - 2 + d.dayOffset))]
      return { dayOffset: d.dayOffset, date: d.date, label: d.label, theme: p?.theme || fallbackTheme, goal: p?.goal || input.goal, hook: p?.hook || '' }
    })
    await db.update(schema.campaigns).set({ plan: { ...(campaign.plan as object), days: plannedDays } }).where(eq(schema.campaigns.id, campaign.id))
    await db.insert(schema.campaignItems).values(plannedDays.map((d) => ({ campaignId: campaign.id, projectId: ctx.projectId, dayOffset: d.dayOffset, date: d.date, theme: d.theme, status: 'planned' })))
    await r.step('生成每日内容')
    const tasks = plannedDays.flatMap((d) => types.map((t) => ({ day: d, type: t })))
    let done = 0
    const { errors } = await mapLimit(tasks, 3, async ({ day, type }) => {
      const res = await generateContent(ctx, {
        templateSlug: type.slug, language: input.language ?? 'zh', campaignId: campaign.id, jobId: job.id, folder: `营销活动/${campaign.name}`, tags: ['campaign', day.label],
        title: `${day.label} · ${type.label} — ${day.theme}`, angle: `${day.theme}: ${day.hook}`.slice(0, 200),
        brief: `Campaign day ${day.label} (${day.date}), theme "${day.theme}". Goal: ${day.goal}. Launch date: ${input.launchDate}.${day.dayOffset < 0 ? ` ${-day.dayOffset} day(s) until launch.` : day.dayOffset === 0 ? ' It is launch day.' : ''}`
      })
      await db.update(schema.contentItems).set({ scheduledAt: new Date(day.date + 'T12:00:00Z'), status: 'scheduled' }).where(eq(schema.contentItems.id, res.item.id))
      await db.insert(schema.campaignItems).values({ campaignId: campaign.id, projectId: ctx.projectId, dayOffset: day.dayOffset, date: day.date, theme: day.theme, contentId: res.item.id, contentType: type.label, status: 'generated' })
      done++
      await r.progress(20 + Math.round((done / tasks.length) * 70))
    })
    await r.step('排入内容日历', { progress: 95 })
    await db.update(schema.campaigns).set({ status: 'ready' }).where(eq(schema.campaigns.id, campaign.id))
    return { campaignId: campaign.id, generated: done, failed: errors.length, errors: errors.slice(0, 5) }
  })
  return { campaign, job }
}

export async function deleteCampaign(projectId: string, campaignId: string) {
  const db = await getDb()
  await db.delete(schema.campaignItems).where(and(eq(schema.campaignItems.campaignId, campaignId), eq(schema.campaignItems.projectId, projectId)))
  await db.update(schema.contentItems).set({ campaignId: null }).where(and(eq(schema.contentItems.campaignId, campaignId), eq(schema.contentItems.projectId, projectId)))
  await db.delete(schema.campaigns).where(and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.projectId, projectId)))
}
