import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getProject } from '@/lib/services/projects'
import { AskProjectAI } from '@/components/project/ask-ai'

export const metadata = { title: 'Ask Project AI' }
export const dynamic = 'force-dynamic'

export default async function AskPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const project = await getProject(session.orgId, params.id)
  if (!project) redirect('/dashboard')
  return <AskProjectAI projectId={project.id} projectName={project.name} tokenSymbol={project.tokenSymbol} />
}
