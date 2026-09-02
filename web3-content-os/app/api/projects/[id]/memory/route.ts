import { withProject, json } from '@/lib/api'
import { addMemory, listMemories, memoryEvents, listTerminology, listBrandRules, MEMORY_TYPES } from '@/lib/services/memory'

export const GET = withProject(async ({ project, req }) => {
  const includeArchived = req.nextUrl.searchParams.get('archived') === '1'
  const [memories, events, terminology, brandRules] = await Promise.all([listMemories(project.id, { includeArchived }), memoryEvents(project.id), listTerminology(project.id), listBrandRules(project.id)])
  return json({ memories, events, terminology, brandRules, types: MEMORY_TYPES })
})

export const POST = withProject(async ({ project, session, body }) => {
  const b = await body<{ type: string; title: string; content: string; oldValue?: string; newValue?: string; pinned?: boolean; locked?: boolean }>()
  if (!b.type || !b.title || !b.content) return json({ error: 'type, title and content are required' }, { status: 400 })
  const memory = await addMemory(project.id, b, session.userId)
  return json({ memory })
})
