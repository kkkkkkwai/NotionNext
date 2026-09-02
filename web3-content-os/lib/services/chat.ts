import { and, asc, desc, eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { streamChat } from '../ai'
import { buildProjectContext } from '../rag/context-builder'
import { getProject } from './projects'
import { extractMemoriesFromTurn, listTerminology, applyTerminology } from './memory'
import type { ChatMessage } from '../ai/types'

export async function listConversations(projectId: string, userId: string) {
  const db = await getDb()
  return db.query.projectConversations.findMany({ where: and(eq(schema.projectConversations.projectId, projectId), eq(schema.projectConversations.userId, userId)), orderBy: desc(schema.projectConversations.updatedAt), limit: 30 })
}

export async function getMessages(projectId: string, conversationId: string) {
  const db = await getDb()
  return db.query.projectMessages.findMany({ where: and(eq(schema.projectMessages.conversationId, conversationId), eq(schema.projectMessages.projectId, projectId)), orderBy: asc(schema.projectMessages.createdAt) })
}

export async function createConversation(projectId: string, userId: string, title?: string) {
  const db = await getDb()
  const [c] = await db.insert(schema.projectConversations).values({ projectId, userId, title: title?.slice(0, 80) || 'New conversation' }).returning()
  return c
}

export async function deleteConversation(projectId: string, conversationId: string) {
  const db = await getDb()
  await db.delete(schema.projectMessages).where(and(eq(schema.projectMessages.conversationId, conversationId), eq(schema.projectMessages.projectId, projectId)))
  await db.delete(schema.projectConversations).where(and(eq(schema.projectConversations.id, conversationId), eq(schema.projectConversations.projectId, projectId)))
}

const CHAT_INSTRUCTIONS = `You are "Ask Project AI" — this project's dedicated AI Brand Manager, not a generic chatbot.
- Answer from the project brain (facts, DNA, memory, knowledge, content history). Cite the source name in brackets when quoting a document, e.g. [Whitepaper p.8].
- If asked to write content (tweet, post, script…), write it directly, on-brand, ready to publish, and choose an angle not used recently unless told otherwise.
- If the user asks "what did we say yesterday / what haven't we covered", use CONTENT MEMORY.
- If the user states a durable rule or fact update, acknowledge it explicitly in one line ("Noted — from now on …") and apply it immediately in your reply.
- When information is missing, say so plainly and tell the user how to add it (upload a document or add a fact in Memory).
- Keep answers concise; use Markdown lists sparingly.`

/**
 * Streams an assistant reply for the project conversation. Persists messages, then extracts long-term memory.
 * Yields SSE-ready events.
 */
export async function* askProjectAI(ctx: { orgId: string; projectId: string; userId: string }, conversationId: string, userMessage: string, opts: { useMemory?: boolean } = {}): AsyncGenerator<{ event: string; data: unknown }> {
  const db = await getDb()
  const project = await getProject(ctx.orgId, ctx.projectId)
  if (!project) throw new Error('Project not found')
  const conv = await db.query.projectConversations.findFirst({ where: and(eq(schema.projectConversations.id, conversationId), eq(schema.projectConversations.projectId, ctx.projectId)) })
  if (!conv) throw new Error('Conversation not found')
  const history = await getMessages(ctx.projectId, conversationId)
  await db.insert(schema.projectMessages).values({ conversationId, projectId: ctx.projectId, role: 'user', content: userMessage })
  if (history.length === 0) await db.update(schema.projectConversations).set({ title: userMessage.slice(0, 60), updatedAt: new Date() }).where(eq(schema.projectConversations.id, conversationId))

  yield { event: 'status', data: { step: 'Reading project memory' } }
  const built = await buildProjectContext(ctx.orgId, project, { request: userMessage, includeNarrative: true, useMemory: opts.useMemory !== false, extraInstructions: CHAT_INSTRUCTIONS, knowledgeLimit: 6 })
  yield { event: 'context', data: { sources: built.sources.slice(0, 20), taskClass: built.taskClass, tokens: built.tokens } }
  const recent: ChatMessage[] = history.slice(-12).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  const messages: ChatMessage[] = [{ role: 'system', content: built.system }, ...recent, { role: 'user', content: userMessage }]
  let full = ''
  let model = ''
  for await (const ev of streamChat({ ...ctx, taskType: 'chat' }, { messages, temperature: 0.6 })) {
    if (ev.type === 'text') {
      full += ev.text
      yield { event: 'delta', data: { text: ev.text } }
    } else if (ev.type === 'error') {
      yield { event: 'error', data: { message: ev.error } }
      return
    } else if (ev.type === 'done') {
      model = ev.model ?? ''
    }
  }
  const terms = await listTerminology(ctx.projectId)
  const finalText = applyTerminology(full, terms)
  const [saved] = await db.insert(schema.projectMessages).values({ conversationId, projectId: ctx.projectId, role: 'assistant', content: finalText, meta: { model, sources: built.sources.slice(0, 20) } }).returning()
  await db.update(schema.projectConversations).set({ updatedAt: new Date() }).where(eq(schema.projectConversations.id, conversationId))
  yield { event: 'message', data: { id: saved.id, content: finalText, model } }
  try {
    const memories = await extractMemoriesFromTurn(ctx, userMessage, finalText)
    if (memories.length) yield { event: 'memories', data: memories.map((m) => ({ id: m.id, type: m.type, title: m.title, content: m.content })) }
  } catch (e) {
    console.warn('[chat] memory extraction failed', e)
  }
  yield { event: 'done', data: {} }
}
