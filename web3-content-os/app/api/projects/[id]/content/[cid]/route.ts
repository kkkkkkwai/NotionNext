import { withProject, json } from '@/lib/api'
import { deleteContent, getContent, saveContentBody, updateContentMeta } from '@/lib/services/content'

export const GET = withProject(async ({ project, params }) => {
  const res = await getContent(project.id, params.cid)
  if (!res) return json({ error: 'Content not found' }, { status: 404 })
  return json(res)
})

export const PATCH = withProject(async ({ project, session, params, body }) => {
  const b = await body<{ body?: string; title?: string; status?: string; tags?: string[]; folder?: string | null; language?: string; platform?: string | null; scheduledAt?: string | null; campaignId?: string | null }>()
  let item
  if (typeof b.body === 'string') item = await saveContentBody(project.id, params.cid, b.body, session.userId)
  const meta: Record<string, unknown> = {}
  for (const k of ['title', 'status', 'tags', 'folder', 'language', 'platform', 'campaignId'] as const) if (b[k] !== undefined) meta[k] = b[k]
  if (b.scheduledAt !== undefined) meta.scheduledAt = b.scheduledAt ? new Date(b.scheduledAt) : null
  if (b.status === 'published') meta.publishedAt = new Date()
  if (Object.keys(meta).length) item = await updateContentMeta(project.id, params.cid, meta as never)
  return json({ item })
})

export const DELETE = withProject(async ({ project, params }) => {
  await deleteContent(project.id, params.cid)
  return json({ ok: true })
})
