import { withAuth, json } from '@/lib/api'
import { inviteMember, requireRole, type Role } from '@/lib/services/team'

export const POST = withAuth(async ({ session, body, req }) => {
  await requireRole(session.orgId, session.userId, ['owner', 'admin'])
  const b = await body<{ email: string; role?: Role }>()
  if (!b.email) return json({ error: 'email required' }, { status: 400 })
  const r = await inviteMember(session.orgId, session.userId, b.email, b.role ?? 'editor')
  if (r.added) return json({ added: true, email: r.email })
  const origin = req.headers.get('origin') || req.nextUrl.origin
  return json({ added: false, invite: r.invite, link: `${origin}/signup?invite=${r.invite.token}` })
})
