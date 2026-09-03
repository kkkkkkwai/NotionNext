import { withAuth, json } from '@/lib/api'
import { requireRole, revokeInvite } from '@/lib/services/team'

export const DELETE = withAuth(async ({ session, params }) => {
  await requireRole(session.orgId, session.userId, ['owner', 'admin'])
  await revokeInvite(session.orgId, params.iid)
  return json({ ok: true })
})
