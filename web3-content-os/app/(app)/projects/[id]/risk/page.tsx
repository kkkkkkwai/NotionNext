import { RiskCheck } from '@/components/project/risk-check'
export const metadata = { title: 'Risk Check' }
export default function RiskPage({ params }: { params: { id: string } }) {
  return <RiskCheck projectId={params.id} />
}
