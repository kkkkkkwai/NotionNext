import { ContentEditor } from '@/components/project/content-editor'
export const metadata = { title: '内容详情' }
export default function ContentPage({ params }: { params: { id: string; contentId: string } }) {
  return <ContentEditor projectId={params.id} contentId={params.contentId} />
}
