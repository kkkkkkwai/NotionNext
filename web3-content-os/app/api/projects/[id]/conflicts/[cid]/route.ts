import { withProject, json } from '@/lib/api'
import { resolveConflict } from '@/lib/services/conflicts'
import { computeReadiness } from '@/lib/services/projects'

export const POST = withProject(async ({ ctx, session, params, body }) => {
  const b = await body<{ action: 'keep' | 'accept' }>()
  if (b.action !== 'keep' && b.action !== 'accept') return json({ error: 'action must be keep or accept' }, { status: 400 })
  const conflict = await resolveConflict(ctx.projectId, params.cid, b.action, session.userId)
  await computeReadiness(ctx.orgId, ctx.projectId)
  return json({ conflict })
})
