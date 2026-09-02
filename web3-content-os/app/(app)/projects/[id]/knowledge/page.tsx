import { KnowledgeBase } from '@/components/project/knowledge-base'

export const metadata = { title: 'Knowledge Base' }

export default function KnowledgePage({ params }: { params: { id: string } }) {
  return <KnowledgeBase projectId={params.id} />
}
