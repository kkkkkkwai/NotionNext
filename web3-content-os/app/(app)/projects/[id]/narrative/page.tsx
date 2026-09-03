import { NarrativeView } from '@/components/project/narrative-view'
export const metadata = { title: '叙事引擎' }
export default function NarrativePage({ params }: { params: { id: string } }) {
  return <NarrativeView projectId={params.id} />
}
