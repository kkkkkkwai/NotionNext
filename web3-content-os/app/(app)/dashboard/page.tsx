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
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default async function Dashboard() {
  const session = await getSession()
  if (!session) redirect('/login')
  const [projects, stats, providerOk] = await Promise.all([listProjects(session.orgId), projectStats(session.orgId), hasAnyProvider(session.orgId)])
  const first = projects[0]?.project
  const quick = [
    { href: '/projects/new', label: 'New Project', icon: Plus, desc: 'Create a new AI brain' },
    { href: first ? `/projects/${first.id}/ask` : '/projects/new', label: 'Ask Project AI', icon: MessageSquare, desc: 'Talk to your brand manager' },
    { href: first ? `/projects/${first.id}/generate` : '/projects/new', label: 'Generate Content', icon: Wand2, desc: '65 templates, on-brand' },
    { href: first ? `/projects/${first.id}/campaigns` : '/projects/new', label: 'Create Campaign', icon: Megaphone, desc: 'T-7 → Launch Day' },
    { href: first ? `/projects/${first.id}/launch-kit` : '/projects/new', label: 'Generate Launch Kit', icon: Rocket, desc: '100+ assets in one click' }
  ]
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">{greeting()}, {session.name || 'there'}</div>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-fg">What do you want to create today?</h1>
      </div>
      {!providerOk ? (
        <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-warn/30 bg-warn/[0.06] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[14px] font-medium text-fg">Connect an AI provider to activate your project brains</div>
            <div className="text-[13px] text-fg-muted">Add your OpenAI, Anthropic, Gemini or OpenRouter key (BYOK). Without it, uploads still work but no AI generation.</div>
          </div>
          <Link href="/settings/ai-providers" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">Open AI Providers <ArrowRight className="h-3.5 w-3.5" /></Link>
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
            <h2 className="text-[15px] font-semibold text-fg">Recent Projects</h2>
            <Link href="/projects/new" className="text-[13px] text-primary hover:underline">+ New Project</Link>
          </div>
          {projects.length === 0 ? (
            <EmptyState title="No projects yet" description="Create your first project: describe it, upload the whitepaper or deck, and the AI builds its own persistent brain." action={<Link href="/projects/new" className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-text">Create Project</Link>} />
          ) : (
            <div className="card overflow-hidden">
              <div className="hidden grid-cols-[1fr_120px_110px_90px_110px] gap-3 border-b border-line px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-fg-dim md:grid">
                <div>Project</div><div>Industry</div><div>Readiness</div><div>Content</div><div>Updated</div>
              </div>
              {projects.map(({ project, contentCount }) => {
                const r = (project.readiness as { total?: number }).total ?? 0
                return (
                  <Link key={project.id} href={`/projects/${project.id}`} className="grid grid-cols-1 gap-2 border-b border-line px-5 py-3.5 transition last:border-0 hover:bg-white/[0.03] md:grid-cols-[1fr_120px_110px_90px_110px] md:items-center md:gap-3">
                    <div className="flex items-center gap-3"><ProjectAvatar project={project} /><div><div className="text-[14px] font-medium text-fg">{project.name}</div><div className="text-[12px] text-fg-dim">{project.slogan || project.positioning || 'No slogan yet'}</div></div></div>
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
          <h2 className="text-[15px] font-semibold text-fg">Workspace</h2>
          <div className="card divide-y divide-line">
            {[
              ['Projects', String(stats.projects)],
              ['Content Generated', String(stats.content)],
              ['Campaigns', String(stats.campaigns)],
              ['Languages', String(stats.languages)],
              ['AI Calls', formatNumber(stats.aiCalls)],
              ['AI Tokens', formatNumber(stats.aiTokens)],
              ['AI Cost (est.)', formatCost(stats.aiCost)]
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-2.5 text-[13px]"><span className="text-fg-muted">{k}</span><span className="font-medium text-fg">{v}</span></div>
            ))}
          </div>
          <div className="card p-4 text-[12.5px] text-fg-muted">
            <div className="mb-1 font-medium text-fg">Tell us about your project once.</div>
            Every project has an isolated AI brain: facts, DNA, knowledge base, memory and content history. <Badge tone="primary" className="ml-1">Persistent</Badge>
          </div>
        </aside>
      </div>
    </div>
  )
}
