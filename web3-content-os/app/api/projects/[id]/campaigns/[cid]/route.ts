import { withProject, json } from '@/lib/api'
import { deleteCampaign, getCampaign } from '@/lib/services/campaigns'

export const GET = withProject(async ({ project, params }) => {
  const res = await getCampaign(project.id, params.cid)
  if (!res) return json({ error: 'Campaign not found' }, { status: 404 })
  return json(res)
})

export const DELETE = withProject(async ({ project, params }) => {
  await deleteCampaign(project.id, params.cid)
  return json({ ok: true })
})
