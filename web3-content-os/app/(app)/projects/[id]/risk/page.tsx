import { RiskCheck } from '@/components/project/risk-check'
export const metadata = { title: '风险检查' }
export default function RiskPage({ params }: { params: { id: string } }) {
  return <RiskCheck projectId={params.id} />
}
