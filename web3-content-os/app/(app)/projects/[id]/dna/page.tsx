import { ProjectDnaView } from '@/components/project/dna-view'
export const metadata = { title: 'Project DNA' }
export default function DnaPage({ params }: { params: { id: string } }) {
  return <ProjectDnaView projectId={params.id} />
}
