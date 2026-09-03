import { LaunchKit } from '@/components/project/launch-kit'
export const metadata = { title: '上线内容包' }
export default function LaunchKitPage({ params }: { params: { id: string } }) {
  return <LaunchKit projectId={params.id} />
}
