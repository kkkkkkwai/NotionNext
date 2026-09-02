import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { listFacts } from '@/lib/services/facts'
import { getLatestDna } from '@/lib/services/dna'
import { FactsSection } from '@/components/project/facts-section'

export const metadata = { title: 'Tokenomics' }
export const dynamic = 'force-dynamic'

export default async function TokenomicsPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const [facts, dna] = await Promise.all([listFacts(params.id), getLatestDna(params.id)])
  const data = (dna?.data ?? {}) as Record<string, string | string[]>
  return (
    <FactsSection projectId={params.id} eyebrow="Project" title="Tokenomics" description="Token facts and token model from the project brain. Numbers here are the only numbers the AI is allowed to use." categories={['token', 'exchange', 'contract', 'audit']} facts={facts.filter((f) => ['token', 'exchange', 'contract', 'audit'].includes(f.category)).map((f) => ({ id: f.id, label: f.label, value: f.value, status: f.status, source: f.sourceRef?.sourceName ?? f.source, page: f.sourceRef?.page ?? null }))} sections={[{ title: 'Token Model', value: data.token_model }, { title: 'Token Utility', value: data.token_utility }, { title: 'Restricted Claims', value: data.restricted_claims }]} generate={[{ label: 'Tokenomics Explainer', slug: 'foundation-tokenomics' }, { label: 'Token Value Narrative', slug: 'marketing-token-value' }, { label: 'Tokenomics Poster', slug: 'poster-tokenomics' }, { label: 'Token Video Script', slug: 'video-token' }]} />
  )
}
