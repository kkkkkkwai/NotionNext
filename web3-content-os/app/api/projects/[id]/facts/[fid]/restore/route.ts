import { withProject, json } from '@/lib/api'
import { restoreFactVersion } from '@/lib/services/facts'

export const POST = withProject(async ({ project, session, params, body }) => {
  const b = await body<{ version: number }>()
  const r = await restoreFactVersion(project.id, params.fid, Number(b.version), session.userId)
  return json({ fact: r.fact })
})
