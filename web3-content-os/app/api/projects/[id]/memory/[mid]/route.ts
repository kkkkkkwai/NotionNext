import { withProject, json } from '@/lib/api'
import { deleteMemory, updateMemory } from '@/lib/services/memory'

export const PATCH = withProject(async ({ project, session, params, body }) => {
  const b = await body<{ title?: string; content?: string; pinned?: boolean; locked?: boolean; status?: string; type?: string }>()
  return json({ memory: await updateMemory(project.id, params.mid, b, session.userId) })
})

export const DELETE = withProject(async ({ project, session, params }) => {
  await deleteMemory(project.id, params.mid, session.userId)
  return json({ ok: true })
})
