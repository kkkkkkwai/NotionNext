import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getProject } from '@/lib/services/projects'

export const dynamic = 'force-dynamic'

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const project = await getProject(session.orgId, params.id)
  if (!project) notFound()
  return <div className="animate-fade-in">{children}</div>
}
