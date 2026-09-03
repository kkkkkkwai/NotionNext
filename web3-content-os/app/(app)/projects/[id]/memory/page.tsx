import { MemoryManager } from '@/components/project/memory-manager'
export const metadata = { title: '项目记忆' }
export default function MemoryPage({ params }: { params: { id: string } }) {
  return <MemoryManager projectId={params.id} />
}
