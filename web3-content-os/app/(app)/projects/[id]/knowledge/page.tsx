import { KnowledgeBase } from '@/components/project/knowledge-base'

export const metadata = { title: '知识库' }

export default function KnowledgePage({ params }: { params: { id: string } }) {
  return <KnowledgeBase projectId={params.id} />
}
