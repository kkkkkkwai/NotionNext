import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { listProjects } from '@/lib/services/projects'
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives'

export const metadata = { title: '品牌' }
export const dynamic = 'force-dynamic'

export default async function BrandSettings() {
  const session = await getSession()
  if (!session) redirect('/login')
  const projects = await listProjects(session.orgId)
  return (
    <div>
      <PageHeader eyebrow="设置" title="品牌" description="品牌语调、关键词、传播规则与禁用表述都保存在各项目的项目 DNA 与项目记忆中，项目之间互不共享。" />
      {projects.length === 0 ? <EmptyState title="还没有项目" description="创建一个项目以定义它的品牌。" /> : (
        <Card>
          <CardHeader title="项目" description="打开项目的品牌设定" />
          <ul className="divide-y divide-line">{projects.map(({ project }) => <li key={project.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]"><span className="flex-1 text-fg">{project.name}</span><Link href={`/projects/${project.id}/dna`} className="text-primary hover:underline">品牌语调与规则（项目 DNA）</Link><Link href={`/projects/${project.id}/memory`} className="text-primary hover:underline">术语与项目记忆</Link></li>)}</ul>
        </Card>
      )}
    </div>
  )
}
