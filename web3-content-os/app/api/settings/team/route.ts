export const dynamic = 'force-dynamic'
import { withAuth, json } from '@/lib/api'
import { getMembership, listInvites, listMembers, listUserOrganizations, renameOrganization, ROLES } from '@/lib/services/team'
import { getDb, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const GET = withAuth(async ({ session }) => {
  const db = await getDb()
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, session.orgId) })
  const [members, invites, organizations, me] = await Promise.all([listMembers(session.orgId), listInvites(session.orgId), listUserOrganizations(session.userId), getMembership(session.orgId, session.userId)])
  return json({ org: { id: org?.id, name: org?.name }, members, invites, organizations, role: me?.role ?? 'viewer', roles: ROLES })
})

export const PATCH = withAuth(async ({ session, body }) => {
  const b = await body<{ name: string }>()
  if (!b.name?.trim()) return json({ error: 'name required' }, { status: 400 })
  await renameOrganization(session.orgId, session.userId, b.name)
  return json({ ok: true })
})
