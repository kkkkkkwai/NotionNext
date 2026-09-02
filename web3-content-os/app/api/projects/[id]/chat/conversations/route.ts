import { withProject, json } from '@/lib/api'
import { createConversation, listConversations } from '@/lib/services/chat'

export const GET = withProject(async ({ project, session }) => json({ conversations: await listConversations(project.id, session.userId) }))

export const POST = withProject(async ({ project, session, body }) => {
  const b = await body<{ title?: string }>()
  return json({ conversation: await createConversation(project.id, session.userId, b.title) })
})
