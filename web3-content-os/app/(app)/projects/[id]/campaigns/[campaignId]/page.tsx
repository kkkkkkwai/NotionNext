import { CampaignDetail } from '@/components/project/campaign-detail'
export const metadata = { title: '活动详情' }
export default function CampaignPage({ params }: { params: { id: string; campaignId: string } }) {
  return <CampaignDetail projectId={params.id} campaignId={params.campaignId} />
}
