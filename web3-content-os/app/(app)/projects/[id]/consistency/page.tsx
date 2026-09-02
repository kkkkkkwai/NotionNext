import { ConsistencyCheck } from '@/components/project/consistency-check'
export const metadata = { title: 'Consistency Check' }
export default function ConsistencyPage({ params }: { params: { id: string } }) {
  return <ConsistencyCheck projectId={params.id} />
}
