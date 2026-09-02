export const dynamic = 'force-dynamic'
import { withAuth, json } from '@/lib/api'
import { listTaskSettings, saveTaskSetting } from '@/lib/services/ai-settings'
import { TASK_TYPES } from '@/lib/ai/types'

export const GET = withAuth(async ({ session }) => json({ settings: await listTaskSettings(session.orgId), taskTypes: TASK_TYPES }))

export const POST = withAuth(async ({ session, body }) => {
  const b = await body<{ taskType: string; providerId?: string | null; model?: string | null; temperature?: number | null; maxTokens?: number | null }>()
  if (!b.taskType) return json({ error: 'taskType required' }, { status: 400 })
  return json({ setting: await saveTaskSetting(session.orgId, b.taskType, b) })
})
