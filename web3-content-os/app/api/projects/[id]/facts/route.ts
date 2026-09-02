import { withProject, json } from '@/lib/api'
import { listFacts, upsertFact, FACT_CATEGORIES } from '@/lib/services/facts'
import { computeReadiness } from '@/lib/services/projects'

export const GET = withProject(async ({ project }) => json({ facts: await listFacts(project.id), categories: FACT_CATEGORIES }))

export const POST = withProject(async ({ ctx, session, body }) => {
  const b = await body<{ key: string; label?: string; value: string; category?: string; source?: string; status?: string; lock?: boolean }>()
  if (!b.key || !b.value) return json({ error: 'key and value are required' }, { status: 400 })
  const r = await upsertFact(ctx.projectId, { key: b.key, label: b.label, value: b.value, category: b.category, source: b.source || 'User confirmed', status: b.lock ? 'locked' : b.status || 'confirmed' }, { by: session.userId, force: true })
  await computeReadiness(ctx.orgId, ctx.projectId)
  return json({ fact: r.fact, changed: r.changed })
})
