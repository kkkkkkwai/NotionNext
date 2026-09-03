import { withProject, json } from '@/lib/api'
import { INTEGRATION_META, listIntegrations, listPublishLogs, saveIntegration, type IntegrationKind } from '@/lib/services/integrations'
import { schedulerStatus } from '@/lib/services/scheduler'

export const GET = withProject(async ({ project }) => json({ integrations: await listIntegrations(project.id), meta: INTEGRATION_META, logs: await listPublishLogs(project.id), scheduler: schedulerStatus() }))

export const POST = withProject(async ({ project, body }) => {
  const b = await body<{ kind: IntegrationKind; config: Record<string, string>; name?: string }>()
  if (!b.kind || !INTEGRATION_META[b.kind]) return json({ error: 'Unknown integration' }, { status: 400 })
  const row = await saveIntegration(project.id, b.kind, b.config ?? {}, b.name)
  return json({ integration: { id: row.id, kind: row.kind, name: row.name, enabled: row.enabled } })
})
