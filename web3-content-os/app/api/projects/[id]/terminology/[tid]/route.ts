import { withProject, json } from '@/lib/api'
import { deleteTerminology } from '@/lib/services/memory'

export const DELETE = withProject(async ({ project, params }) => {
  await deleteTerminology(project.id, params.tid)
  return json({ ok: true })
})
