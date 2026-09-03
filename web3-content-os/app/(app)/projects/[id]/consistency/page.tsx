import { ConsistencyCheck } from '@/components/project/consistency-check'
export const metadata = { title: '一致性检查' }
export default function ConsistencyPage({ params }: { params: { id: string } }) {
  return <ConsistencyCheck projectId={params.id} />
}
