import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui/primitives'

export const metadata = { title: 'Team' }
export const dynamic = 'force-dynamic'

export default async function TeamSettings() {
  const session = await getSession()
  if (!session) redirect('/login')
  const db = await getDb()
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, session.orgId) })
  const members = await db.select({ role: schema.organizationMembers.role, email: schema.users.email, name: schema.users.name, joined: schema.organizationMembers.createdAt }).from(schema.organizationMembers).innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId)).where(eq(schema.organizationMembers.orgId, session.orgId))
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Team" description={`Workspace: ${org?.name ?? ''}`} />
      <Card>
        <CardHeader title="Members" description="Invitations and roles (admin / editor / viewer) are on the roadmap for the next phase." />
        <ul className="divide-y divide-line">{members.map((m) => <li key={m.email} className="flex items-center gap-3 px-5 py-3 text-[13px]"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[11px] uppercase text-fg-muted">{(m.name || m.email).slice(0, 1)}</div><span className="text-fg">{m.name || m.email}</span><span className="text-fg-dim">{m.email}</span><div className="flex-1" /><Badge tone="primary">{m.role}</Badge></li>)}</ul>
      </Card>
    </div>
  )
}
