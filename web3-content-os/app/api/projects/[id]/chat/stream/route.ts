import { withProject, json, sse } from '@/lib/api'
import { askProjectAI, createConversation } from '@/lib/services/chat'

export const dynamic = 'force-dynamic'

export const POST = withProject(async ({ ctx, session, body }) => {
  const b = await body<{ conversationId?: string; message: string; useMemory?: boolean }>()
  if (!b.message?.trim()) return json({ error: 'message required' }, { status: 400 })
  const conversationId = b.conversationId || (await createConversation(ctx.projectId, session.userId, b.message)).id
  async function* gen() {
    yield { event: 'conversation', data: { id: conversationId } }
    yield* askProjectAI(ctx, conversationId, b.message.trim(), { useMemory: b.useMemory })
  }
  return sse(gen())
})
