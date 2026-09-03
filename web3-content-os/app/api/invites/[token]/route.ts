import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '@/lib/db'
import { json } from '@/lib/api'
import { getSession } from '@/lib/auth'
import { acceptInvitesFor } from '@/lib/services/team'

/** GET: describe an invite (public). POST: accept it as the signed-in user. */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const db = await getDb()
  const inv = await db.query.organizationInvites.findFirst({ where: eq(schema.organizationInvites.token, params.token) })
  if (!inv || inv.status !== 'pending') return json({ error: 'Invite not found or already used' }, { status: 404 })
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, inv.orgId), columns: { name: true } })
  return json({ email: inv.email, role: inv.role, workspace: org?.name })
}

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await getSession()
  if (!session) return json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const joined = await acceptInvitesFor(session.userId, session.email, params.token)
    return json({ joined })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }
}
