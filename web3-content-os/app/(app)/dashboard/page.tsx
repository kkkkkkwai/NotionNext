import Link from 'next/link'
import { Plus, MessageSquare, Wand2, Megaphone, Rocket, ArrowRight } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { listProjects, projectStats } from '@/lib/services/projects'
import { hasAnyProvider } from '@/lib/ai/router'
import { ProjectAvatar } from '@/components/app/sidebar'
import { Badge, EmptyState } from '@/components/ui/primitives'
import { formatCost, formatNumber, relativeTime } from '@/lib/utils'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好'
}

export default async function Dashboard() {
  const session = await getSession()
  if (!session) redirect('/login')
  const [projects, stats, providerOk] = await Promise.all([listProjects(session.orgId), projectStats(session.orgId), hasAnyProvider(session.orgId)])
  const first = projects[0]?.project
  const quick = [
    { href: '/projects/new', label: '新建项目', icon: Plus, desc: '创建一个新的 AI 大脑' },
    { href: first ? `/projects/${first.id}/ask` : '/projects/new', label: '项目 AI 问答', icon: MessageSquare, desc: '与你的品牌经理对话' },
    { href: first ? `/projects/${first.id}/generate` : '/projects/new', label: '生成内容', icon: Wand2, desc: '65 个模板，始终符合品牌' },
    { href: first ? `/projects/${first.id}/campaigns` : '/projects/new', label: '创建营销活动', icon: Megaphone, desc: 'T-7 → 上线日' },
    { href: first ? `/projects/${first.id}/launch-kit` : '/projects/new', label: '生成上线内容包', icon: Rocket, desc: '一键生成 100+ 素材' }
  ]
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">{greeting()}，{session.name || '朋友'}</div>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-fg">今天想创作什么？</h1>
      </div>
      {!providerOk ? (
        <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-warn/30 bg-warn/[0.06] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[14px] font-medium text-fg">连接 AI 模型服务，激活你的项目大脑</div>
            <div className="text-[13px] text-fg-muted">添加你的 OpenAI、Anthropic、Gemini 或 OpenRouter Key（BYOK）。未配置时仍可上传资料，但无法进行 AI 生成。</div>
          </div>
          <Link href="/settings/ai-providers" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">前往 AI 模型设置 <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {quick.map((q) => (
          <Link key={q.label} href={q.href} className="card card-hover group p-4">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><q.icon className="h-4 w-4" /></div>
            <div className="text-[13.5px] font-medium text-fg">{q.label}</div>
            <div className="mt-0.5 text-[12px] text-fg-dim">{q.desc}</div>
          </Link>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-fg">最近项目</h2>
            <Link href="/projects/new" className="text-[13px] text-primary hover:underline">+ 新建项目</Link>
          </div>
          {projects.length === 0 ? (
            <EmptyState title="还没有项目" description="创建你的第一个项目：描述它、上传白皮书或 Deck，AI 会自动构建持续记忆的专属大脑。" action={<Link href="/projects/new" className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-text">创建项目</Link>} />
          ) : (
            <div className="card overflow-hidden">
              <div className="hidden grid-cols-[1fr_120px_110px_90px_110px] gap-3 border-b border-line px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-fg-dim md:grid">
                <div>项目</div><div>行业</div><div>就绪度</div><div>内容数</div><div>更新时间</div>
              </div>
              {projects.map(({ project, contentCount }) => {
                const r = (project.readiness as { total?: number }).total ?? 0
                return (
                  <Link key={project.id} href={`/projects/${project.id}`} className="grid grid-cols-1 gap-2 border-b border-line px-5 py-3.5 transition last:border-0 hover:bg-white/[0.03] md:grid-cols-[1fr_120px_110px_90px_110px] md:items-center md:gap-3">
                    <div className="flex items-center gap-3"><ProjectAvatar project={project} /><div><div className="text-[14px] font-medium text-fg">{project.name}</div><div className="text-[12px] text-fg-dim">{project.slogan || project.positioning || '暂无 Slogan'}</div></div></div>
                    <div className="text-[13px] text-fg-muted">{project.industry || '—'}</div>
                    <div className="flex items-center gap-2"><div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full bg-primary" style={{ width: `${r}%` }} /></div><span className="text-[12px] text-fg-muted">{r}%</span></div>
                    <div className="text-[13px] text-fg-muted">{contentCount}</div>
                    <div className="text-[12px] text-fg-dim">{relativeTime(project.updatedAt)}</div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
        <aside className="space-y-3">
          <h2 className="text-[15px] font-semibold text-fg">工作区</h2>
          <div className="card divide-y divide-line">
            {[
              ['项目数', String(stats.projects)],
              ['已生成内容', String(stats.content)],
              ['营销活动', String(stats.campaigns)],
              ['语言', String(stats.languages)],
              ['AI 调用次数', formatNumber(stats.aiCalls)],
              ['AI Token 数', formatNumber(stats.aiTokens)],
              ['AI 成本（估算）', formatCost(stats.aiCost)]
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-2.5 text-[13px]"><span className="text-fg-muted">{k}</span><span className="font-medium text-fg">{v}</span></div>
            ))}
          </div>
          <div className="card p-4 text-[12.5px] text-fg-muted">
            <div className="mb-1 font-medium text-fg">只需介绍一次你的项目。</div>
            每个项目都拥有独立的 AI 大脑：项目事实、项目 DNA、知识库、项目记忆与内容历史。 <Badge tone="primary" className="ml-1">持续记忆</Badge>
          </div>
        </aside>
      </div>
    </div>
  )
}
