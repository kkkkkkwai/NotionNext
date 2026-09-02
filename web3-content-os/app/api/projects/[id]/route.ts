import { withProject, json } from '@/lib/api'
import { archiveProject, updateProject, PROJECT_FIELDS } from '@/lib/services/projects'

export const GET = withProject(async ({ project }) => json({ project }))

export const PATCH = withProject(async ({ session, project, body }) => {
  const b = await body<Record<string, unknown>>()
  const patch: Record<string, unknown> = {}
  for (const k of PROJECT_FIELDS) if (k in b) patch[k] = b[k] === '' ? null : b[k]
  if (b.settings && typeof b.settings === 'object') patch.settings = { ...(project.settings as object), ...(b.settings as object) }
  const updated = await updateProject(session.orgId, project.id, patch as never)
  return json({ project: updated })
})

export const DELETE = withProject(async ({ session, project }) => {
  await archiveProject(session.orgId, project.id)
  return json({ ok: true })
})
