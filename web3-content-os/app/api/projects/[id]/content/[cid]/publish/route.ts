import { withProject, json } from '@/lib/api'
import { publishContent, type IntegrationKind } from '@/lib/services/integrations'
import { updateContentMeta } from '@/lib/services/content'

/** POST { channel } publishes now. PATCH { publishChannel, autoPublish, scheduledAt } configures auto-publish. */
export const POST = withProject(async ({ project, params, body }) => {
  const b = await body<{ channel: IntegrationKind }>()
  if (b.channel !== 'telegram' && b.channel !== 'x') return json({ error: 'channel must be telegram or x' }, { status: 400 })
  return json(await publishContent(project.id, params.cid, b.channel))
})

export const PATCH = withProject(async ({ project, params, body }) => {
  const b = await body<{ publishChannel?: string | null; autoPublish?: boolean; scheduledAt?: string | null }>()
  const patch: Record<string, unknown> = {}
  if (b.publishChannel !== undefined) patch.publishChannel = b.publishChannel || null
  if (b.autoPublish !== undefined) patch.autoPublish = Boolean(b.autoPublish)
  if (b.scheduledAt !== undefined) patch.scheduledAt = b.scheduledAt ? new Date(b.scheduledAt) : null
  if (b.autoPublish) patch.status = 'scheduled'
  return json({ item: await updateContentMeta(project.id, params.cid, patch as never) })
})
