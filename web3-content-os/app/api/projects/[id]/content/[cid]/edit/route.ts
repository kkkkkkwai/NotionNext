import { withProject, json } from '@/lib/api'
import { editContent, EDITOR_ACTIONS } from '@/lib/services/content'

export const GET = withProject(async () => json({ actions: EDITOR_ACTIONS }))

export const POST = withProject(async ({ ctx, params, body }) => {
  const b = await body<{ action: string; targetLanguage?: string; instruction?: string; useMemory?: boolean; saveAsNew?: boolean }>()
  if (!b.action) return json({ error: 'action required' }, { status: 400 })
  return json(await editContent(ctx, params.cid, b.action, b))
})
