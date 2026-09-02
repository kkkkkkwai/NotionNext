import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { listProjects } from '@/lib/services/projects'
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives'

export const metadata = { title: 'Brand' }
export const dynamic = 'force-dynamic'

export default async function BrandSettings() {
  const session = await getSession()
  if (!session) redirect('/login')
  const projects = await listProjects(session.orgId)
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Brand" description="Brand tone, keywords, communication rules and restricted claims live inside each project's DNA and Memory — never shared between projects." />
      {projects.length === 0 ? <EmptyState title="No projects" description="Create a project to define its brand." /> : (
        <Card>
          <CardHeader title="Projects" description="Open a project's brand layer" />
          <ul className="divide-y divide-line">{projects.map(({ project }) => <li key={project.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]"><span className="flex-1 text-fg">{project.name}</span><Link href={`/projects/${project.id}/dna`} className="text-primary hover:underline">Brand tone & rules (DNA)</Link><Link href={`/projects/${project.id}/memory`} className="text-primary hover:underline">Terminology & memory</Link></li>)}</ul>
        </Card>
      )}
    </div>
  )
}
