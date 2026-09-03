import { PublishingView } from '@/components/project/publishing'
export const metadata = { title: 'Publishing' }
export default function PublishPage({ params }: { params: { id: string } }) {
  return <PublishingView projectId={params.id} />
}
