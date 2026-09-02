import { withProject, json } from '@/lib/api'
import { applyConsistencyFixes, scanConsistency } from '@/lib/services/checks'

export const GET = withProject(async ({ project }) => json(await scanConsistency(project.id)))

export const POST = withProject(async ({ project, session, body }) => {
  const b = await body<{ fixes: { contentId: string; oldValue: string; newValue: string }[] }>()
  return json(await applyConsistencyFixes(project.id, session.userId, b.fixes ?? []))
})
