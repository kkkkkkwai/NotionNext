import { MemoryManager } from '@/components/project/memory-manager'
export const metadata = { title: 'Memory' }
export default function MemoryPage({ params }: { params: { id: string } }) {
  return <MemoryManager projectId={params.id} />
}
