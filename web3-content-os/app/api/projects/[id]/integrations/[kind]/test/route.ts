import { withProject, json } from '@/lib/api'
import { testIntegration, type IntegrationKind } from '@/lib/services/integrations'

export const POST = withProject(async ({ project, params }) => json(await testIntegration(project.id, params.kind as IntegrationKind)))
