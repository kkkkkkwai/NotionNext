import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { listFacts } from '@/lib/services/facts'
import { getLatestDna } from '@/lib/services/dna'
import { FactsSection } from '@/components/project/facts-section'

export const metadata = { title: '路线图' }
export const dynamic = 'force-dynamic'

export default async function RoadmapPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const [facts, dna] = await Promise.all([listFacts(params.id), getLatestDna(params.id)])
  const data = (dna?.data ?? {}) as Record<string, string | string[]>
  return (
    <FactsSection projectId={params.id} eyebrow="项目" title="路线图" description="里程碑、上线与生态相关事实。未确认的日期会明确标注；AI 绝不会编造日期。" categories={['roadmap', 'partners', 'product']} facts={facts.filter((f) => ['roadmap', 'partners', 'product'].includes(f.category)).map((f) => ({ id: f.id, label: f.label, value: f.value, status: f.status, source: f.sourceRef?.sourceName ?? f.source, page: f.sourceRef?.page ?? null }))} sections={[{ title: '产品', value: data.product }, { title: '愿景', value: data.vision }, { title: '缺失信息', value: data.missing_information }]} generate={[{ label: '路线图', slug: 'foundation-roadmap' }, { label: '路线图海报', slug: 'poster-roadmap' }, { label: '上线公告', slug: 'marketing-launch' }, { label: '倒计时系列', slug: 'marketing-countdown' }]} />
  )
}
