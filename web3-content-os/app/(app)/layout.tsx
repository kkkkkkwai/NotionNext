import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { listProjects } from '@/lib/services/projects'
import { Sidebar } from '@/components/app/sidebar'
import { headers } from 'next/headers'
import { listUserOrganizations } from '@/lib/services/team'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const [rows, orgs] = await Promise.all([listProjects(session.orgId), listUserOrganizations(session.userId)])
  const path = headers().get('x-pathname') ?? ''
  const currentProjectId = path.match(/^\/projects\/([^/]+)/)?.[1]
  return (
    <div className="flex min-h-screen">
      <Sidebar projects={rows.map((r) => ({ id: r.project.id, name: r.project.name, logoUrl: r.project.logoUrl, tokenSymbol: r.project.tokenSymbol }))} currentProjectId={currentProjectId === 'new' ? undefined : currentProjectId} user={{ name: session.name, email: session.email }} organizations={orgs.map((o) => ({ id: o.id, name: o.name, role: o.role }))} currentOrgId={session.orgId} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-14 sm:px-6 lg:px-8 lg:pt-8">{children}</div>
      </main>
    </div>
  )
}
