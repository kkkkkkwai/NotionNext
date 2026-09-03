import { withProject, json } from '@/lib/api'
import { deleteIntegration, type IntegrationKind } from '@/lib/services/integrations'

export const DELETE = withProject(async ({ project, params }) => {
  await deleteIntegration(project.id, params.kind as IntegrationKind)
  return json({ ok: true })
})
