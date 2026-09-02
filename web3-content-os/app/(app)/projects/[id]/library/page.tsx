import { ContentLibrary } from '@/components/project/content-library'
export const metadata = { title: 'Content Library' }
export default function LibraryPage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  return <ContentLibrary projectId={params.id} initial={{ folder: searchParams.folder, campaignId: searchParams.campaignId, status: searchParams.status }} />
}
