import { withProject, json } from '@/lib/api'
import { listCampaigns, startCampaign, CAMPAIGN_DAILY_TYPES } from '@/lib/services/campaigns'

export const GET = withProject(async ({ project }) => json({ campaigns: await listCampaigns(project.id), types: CAMPAIGN_DAILY_TYPES }))

export const POST = withProject(async ({ ctx, body }) => {
  const b = await body<{ name?: string; goal: string; launchDate: string; daysBefore: number; daysAfter?: number; language?: string; types?: string[] }>()
  if (!b.goal || !b.launchDate) return json({ error: 'goal and launchDate are required' }, { status: 400 })
  return json(await startCampaign(ctx, b))
})
