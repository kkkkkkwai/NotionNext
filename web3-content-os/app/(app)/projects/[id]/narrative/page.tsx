import { NarrativeView } from '@/components/project/narrative-view'
export const metadata = { title: 'Narrative' }
export default function NarrativePage({ params }: { params: { id: string } }) {
  return <NarrativeView projectId={params.id} />
}
