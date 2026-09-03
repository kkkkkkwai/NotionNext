import { ProjectDnaView } from '@/components/project/dna-view'
export const metadata = { title: '项目 DNA' }
export default function DnaPage({ params }: { params: { id: string } }) {
  return <ProjectDnaView projectId={params.id} />
}
