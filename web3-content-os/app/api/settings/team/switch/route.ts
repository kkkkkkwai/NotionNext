import { withAuth, json } from '@/lib/api'
import { switchOrganization } from '@/lib/auth'

export const POST = withAuth(async ({ session, body }) => {
  const b = await body<{ orgId: string }>()
  if (!b.orgId) return json({ error: 'orgId required' }, { status: 400 })
  const next = await switchOrganization(session, b.orgId)
  return json({ ok: true, orgId: next.orgId })
})
