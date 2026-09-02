import { withProject, json } from '@/lib/api'
import { listCalendarItems } from '@/lib/services/content'

export const GET = withProject(async ({ project, req }) => {
  const q = req.nextUrl.searchParams
  const from = new Date(q.get('from') ?? new Date(Date.now() - 30 * 86400000).toISOString())
  const to = new Date(q.get('to') ?? new Date(Date.now() + 60 * 86400000).toISOString())
  return json({ items: await listCalendarItems(project.id, from, to) })
})
