import { withProject, json } from '@/lib/api'
import { restoreContentVersion } from '@/lib/services/content'

export const POST = withProject(async ({ project, session, params, body }) => {
  const b = await body<{ version: number }>()
  return json({ item: await restoreContentVersion(project.id, params.cid, Number(b.version), session.userId) })
})
