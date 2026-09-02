import { LaunchKit } from '@/components/project/launch-kit'
export const metadata = { title: 'Launch Kit' }
export default function LaunchKitPage({ params }: { params: { id: string } }) {
  return <LaunchKit projectId={params.id} />
}
