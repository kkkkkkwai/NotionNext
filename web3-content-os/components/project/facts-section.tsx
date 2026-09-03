import Link from 'next/link'
import { Lock, Wand2 } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives'

export function FactsSection({ projectId, eyebrow, title, description, facts, sections, generate }: { projectId: string; eyebrow: string; title: string; description: string; categories: string[]; facts: { id: string; label: string; value: string; status: string; source: string; page: number | null }[]; sections: { title: string; value: string | string[] | undefined }[]; generate: { label: string; slug: string }[] }) {
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={<Link href={`/projects/${projectId}/memory`} className="text-[13px] text-primary hover:underline">管理事实 →</Link>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="事实" description="附带来源追踪" />
            {facts.length === 0 ? <div className="p-4"><EmptyState title={`暂无${title}相关事实`} description="上传资料，或在「项目记忆」中添加事实。" /></div> : (
              <ul className="divide-y divide-line">{facts.map((f) => <li key={f.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:justify-between"><div className="text-[13px] text-fg-muted">{f.label}</div><div className="text-right"><div className="flex items-center justify-end gap-2 text-[13.5px] text-fg">{f.value}{f.status === 'locked' ? <Lock className="h-3 w-3 text-primary" /> : f.status === 'draft' ? <Badge tone="warn">未确认</Badge> : null}</div><div className="text-[11px] text-fg-dim">来源：{f.source}{f.page ? ` · 第 ${f.page} 页` : ''}</div></div></li>)}</ul>
            )}
          </Card>
          {sections.map((s) => s.value && (!Array.isArray(s.value) || s.value.length) ? (
            <Card key={s.title} className="p-5"><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-dim">{s.title} <span className="font-normal normal-case tracking-normal">· 来自项目 DNA</span></div>{Array.isArray(s.value) ? <ul className="space-y-1">{s.value.map((x, i) => <li key={i} className="flex gap-2 text-[13px] text-fg/90"><span className="text-primary">•</span>{x}</li>)}</ul> : <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg/90">{s.value}</p>}</Card>
          ) : null)}
        </div>
        <Card className="h-fit">
          <CardHeader title="生成内容" description="基于这些事实创作" />
          <ul className="divide-y divide-line">{generate.map((g) => <li key={g.slug}><Link href={`/projects/${projectId}/generate?template=${g.slug}`} className="flex items-center justify-between px-5 py-2.5 text-[13px] text-fg hover:bg-white/[0.03]">{g.label}<Wand2 className="h-3.5 w-3.5 text-fg-dim" /></Link></li>)}</ul>
        </Card>
      </div>
    </div>
  )
}
