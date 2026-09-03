import { withAuth, json } from '@/lib/api'
import { removeMember, updateMemberRole, type Role } from '@/lib/services/team'

export const PATCH = withAuth(async ({ session, params, body }) => {
  const b = await body<{ role: Role }>()
  await updateMemberRole(session.orgId, session.userId, params.mid, b.role)
  return json({ ok: true })
})

export const DELETE = withAuth(async ({ session, params }) => {
  await removeMember(session.orgId, session.userId, params.mid)
  return json({ ok: true })
})
