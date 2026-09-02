import { withAuth, json } from '@/lib/api'
import { deleteProvider, saveProvider, type ProviderInput } from '@/lib/services/ai-settings'

export const PATCH = withAuth(async ({ session, body, params }) => {
  const input = await body<ProviderInput>()
  const row = await saveProvider(session.orgId, input, params.pid)
  return json({ provider: { ...row, apiKeyEnc: undefined } })
})

export const DELETE = withAuth(async ({ session, params }) => {
  await deleteProvider(session.orgId, params.pid)
  return json({ ok: true })
})
