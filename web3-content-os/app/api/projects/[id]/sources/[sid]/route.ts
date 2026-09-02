import { withProject, json } from '@/lib/api'
import { deleteSource, getDocumentText, ingestSource } from '@/lib/services/knowledge'

export const GET = withProject(async ({ project, params }) => json({ text: await getDocumentText(project.id, params.sid) }))

export const POST = withProject(async ({ ctx, params }) => {
  const res = await ingestSource(ctx.orgId, ctx.projectId, params.sid)
  return json({ chunks: res.chunks, chars: res.chars })
})

export const DELETE = withProject(async ({ project, params }) => {
  await deleteSource(project.id, params.sid)
  return json({ ok: true })
})
