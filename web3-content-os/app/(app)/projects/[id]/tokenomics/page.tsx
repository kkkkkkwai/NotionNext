import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { listFacts } from '@/lib/services/facts'
import { getLatestDna } from '@/lib/services/dna'
import { FactsSection } from '@/components/project/facts-section'

export const metadata = { title: '代币经济' }
export const dynamic = 'force-dynamic'

export default async function TokenomicsPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const [facts, dna] = await Promise.all([listFacts(params.id), getLatestDna(params.id)])
  const data = (dna?.data ?? {}) as Record<string, string | string[]>
  return (
    <FactsSection projectId={params.id} eyebrow="项目" title="代币经济" description="来自项目大脑的 Token 事实与代币模型。AI 只允许使用这里的数字。" categories={['token', 'exchange', 'contract', 'audit']} facts={facts.filter((f) => ['token', 'exchange', 'contract', 'audit'].includes(f.category)).map((f) => ({ id: f.id, label: f.label, value: f.value, status: f.status, source: f.sourceRef?.sourceName ?? f.source, page: f.sourceRef?.page ?? null }))} sections={[{ title: '代币模型', value: data.token_model }, { title: 'Token 用途', value: data.token_utility }, { title: '禁止宣称', value: data.restricted_claims }]} generate={[{ label: '代币经济说明', slug: 'foundation-tokenomics' }, { label: 'Token 价值叙事', slug: 'marketing-token-value' }, { label: '代币经济海报', slug: 'poster-tokenomics' }, { label: 'Token 视频脚本', slug: 'video-token' }]} />
  )
}
