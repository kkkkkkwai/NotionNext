import { withProject, json } from '@/lib/api'
import { deleteBrandRule } from '@/lib/services/memory'

export const DELETE = withProject(async ({ project, params }) => {
  await deleteBrandRule(project.id, params.rid)
  return json({ ok: true })
})
