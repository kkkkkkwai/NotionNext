import { CampaignsView } from '@/components/project/campaigns'
export const metadata = { title: '营销活动' }
export default function CampaignsPage({ params }: { params: { id: string } }) {
  return <CampaignsView projectId={params.id} />
}
