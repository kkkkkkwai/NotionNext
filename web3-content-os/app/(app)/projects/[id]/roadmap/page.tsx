import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { listFacts } from '@/lib/services/facts'
import { getLatestDna } from '@/lib/services/dna'
import { FactsSection } from '@/components/project/facts-section'

export const metadata = { title: 'Roadmap' }
export const dynamic = 'force-dynamic'

export default async function RoadmapPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const [facts, dna] = await Promise.all([listFacts(params.id), getLatestDna(params.id)])
  const data = (dna?.data ?? {}) as Record<string, string | string[]>
  return (
    <FactsSection projectId={params.id} eyebrow="Project" title="Roadmap" description="Milestones, launch and ecosystem facts. Unconfirmed dates are shown as such; the AI never invents a date." categories={['roadmap', 'partners', 'product']} facts={facts.filter((f) => ['roadmap', 'partners', 'product'].includes(f.category)).map((f) => ({ id: f.id, label: f.label, value: f.value, status: f.status, source: f.sourceRef?.sourceName ?? f.source, page: f.sourceRef?.page ?? null }))} sections={[{ title: 'Product', value: data.product }, { title: 'Vision', value: data.vision }, { title: 'Missing Information', value: data.missing_information }]} generate={[{ label: 'Roadmap', slug: 'foundation-roadmap' }, { label: 'Roadmap Poster', slug: 'poster-roadmap' }, { label: 'Launch Announcement', slug: 'marketing-launch' }, { label: 'Countdown Series', slug: 'marketing-countdown' }]} />
  )
}
