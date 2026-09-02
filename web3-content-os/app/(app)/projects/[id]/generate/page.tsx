import { ContentGenerator } from '@/components/project/content-generator'
export const metadata = { title: 'Content Generator' }
export default function GeneratePage({ params, searchParams }: { params: { id: string }; searchParams: { template?: string; angle?: string; format?: string } }) {
  return <ContentGenerator projectId={params.id} initialTemplate={searchParams.template} initialAngle={searchParams.angle} initialFormat={searchParams.format} />
}
