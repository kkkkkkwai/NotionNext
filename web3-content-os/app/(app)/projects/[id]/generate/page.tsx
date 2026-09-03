import { ContentGenerator } from '@/components/project/content-generator'
export const metadata = { title: '内容生成' }
export default function GeneratePage({ params, searchParams }: { params: { id: string }; searchParams: { template?: string; angle?: string; format?: string } }) {
  return <ContentGenerator projectId={params.id} initialTemplate={searchParams.template} initialAngle={searchParams.angle} initialFormat={searchParams.format} />
}
