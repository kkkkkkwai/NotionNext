import { withProject, json } from '@/lib/api'
import { deleteConversation, getMessages } from '@/lib/services/chat'

export const GET = withProject(async ({ project, params }) => json({ messages: await getMessages(project.id, params.cid) }))

export const DELETE = withProject(async ({ project, params }) => {
  await deleteConversation(project.id, params.cid)
  return json({ ok: true })
})
