import { withProject, json } from '@/lib/api'
import { searchKnowledge } from '@/lib/services/knowledge'

export const POST = withProject(async ({ ctx, body }) => {
  const b = await body<{ query: string; limit?: number }>()
  if (!b.query?.trim()) return json({ hits: [] })
  return json({ hits: await searchKnowledge(ctx.orgId, ctx.projectId, b.query, b.limit ?? 8) })
})
