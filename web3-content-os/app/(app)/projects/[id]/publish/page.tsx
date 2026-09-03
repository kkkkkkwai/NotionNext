import { PublishingView } from '@/components/project/publishing'
export const metadata = { title: '发布管理' }
export default function PublishPage({ params }: { params: { id: string } }) {
  return <PublishingView projectId={params.id} />
}
