import { withProject, json } from '@/lib/api'
import { deleteFact, getFact, pinFact, setFactStatus, upsertFact } from '@/lib/services/facts'
import { computeReadiness } from '@/lib/services/projects'

export const PATCH = withProject(async ({ ctx, session, params, body }) => {
  const b = await body<{ value?: string; label?: string; category?: string; status?: 'confirmed' | 'locked' | 'draft' | 'outdated'; pinned?: boolean; source?: string }>()
  let fact = await getFact(ctx.projectId, params.fid)
  if (!fact) return json({ error: 'Fact not found' }, { status: 404 })
  if (b.value !== undefined || b.label !== undefined || b.category !== undefined) {
    const r = await upsertFact(ctx.projectId, { key: fact.key, value: b.value ?? fact.value, label: b.label, category: b.category, source: b.source || 'User edited', status: fact.status === 'locked' ? 'locked' : 'confirmed' }, { by: session.userId, force: true })
    fact = r.fact
  }
  if (b.status) fact = await setFactStatus(ctx.projectId, params.fid, b.status)
  if (b.pinned !== undefined) fact = await pinFact(ctx.projectId, params.fid, b.pinned)
  await computeReadiness(ctx.orgId, ctx.projectId)
  return json({ fact })
})

export const DELETE = withProject(async ({ ctx, params }) => {
  await deleteFact(ctx.projectId, params.fid)
  await computeReadiness(ctx.orgId, ctx.projectId)
  return json({ ok: true })
})
