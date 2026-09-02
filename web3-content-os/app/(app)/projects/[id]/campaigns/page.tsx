import { CampaignsView } from '@/components/project/campaigns'
export const metadata = { title: 'Campaigns' }
export default function CampaignsPage({ params }: { params: { id: string } }) {
  return <CampaignsView projectId={params.id} />
}
