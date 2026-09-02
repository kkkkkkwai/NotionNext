import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { computeReadiness, getProject } from '@/lib/services/projects'
import { listFacts } from '@/lib/services/facts'
import { getLatestDna } from '@/lib/services/dna'
import { knowledgeStats, listSources } from '@/lib/services/knowledge'
import { listContent } from '@/lib/services/content'
import { listMemories } from '@/lib/services/memory'
import { ProjectOverview } from '@/components/project/overview'

export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params, searchParams }: { params: { id: string }; searchParams: { job?: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const project = await getProject(session.orgId, params.id)
  if (!project) redirect('/dashboard')
  const [readiness, facts, dna, kstats, sources, content, memories] = await Promise.all([
    computeReadiness(session.orgId, project.id), listFacts(project.id), getLatestDna(project.id), knowledgeStats(project.id), listSources(project.id), listContent(project.id, { pageSize: 6 }), listMemories(project.id)
  ])
  return <ProjectOverview project={project} readiness={readiness} facts={facts} dna={dna ? { version: dna.version, data: dna.data as Record<string, string | string[]>, createdAt: dna.createdAt.toISOString() } : null} kstats={kstats} sources={sources.map((s) => ({ id: s.id, name: s.name, status: s.status, type: s.type }))} recentContent={content.items.map((c) => ({ id: c.id, title: c.title, contentType: c.contentType, createdAt: c.createdAt.toISOString(), status: c.status }))} memoryCount={memories.length} initialJobId={searchParams.job ?? null} />
}
