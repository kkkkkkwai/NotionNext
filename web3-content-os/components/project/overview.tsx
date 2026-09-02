'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MessageSquare, Wand2, Rocket, BookOpen, Brain, Dna, Lock, Sparkles, ExternalLink, Settings2 } from 'lucide-react'
import { ProjectAvatar } from '@/components/app/sidebar'
import { Badge, Card, CardHeader, PageHeader, Progress } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { JobProgress } from '@/components/project/job-progress'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { relativeTime, truncate } from '@/lib/utils'
import type { Project, ProjectFact } from '@/lib/db/schema'
import { ProjectSettingsDialog } from './project-settings-dialog'

type Props = {
  project: Project
  readiness: { total: number; dimensions: Record<string, number>; missing: string[] }
  facts: ProjectFact[]
  dna: { version: number; data: Record<string, string | string[]>; createdAt: string } | null
  kstats: { sources: number; chunks: number; chars: number }
  sources: { id: string; name: string; status: string; type: string }[]
  recentContent: { id: string; title: string; contentType: string; createdAt: string; status: string }[]
  memoryCount: number
  initialJobId: string | null
}

export function ProjectOverview({ project, readiness, facts, dna, kstats, sources, recentContent, memoryCount, initialJobId }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [jobId, setJobId] = useState<string | null>(initialJobId)
  const [completing, setCompleting] = useState(false)
  const [settings, setSettings] = useState(false)
  const base = `/projects/${project.id}`
  const pending = sources.filter((s) => s.status === 'pending' || s.status === 'failed')
  const completeWithAI = async () => {
    setCompleting(true)
    try {
      const { job } = await api<{ job: { id: string } }>(`/api/projects/${project.id}/ingest`, { method: 'POST', json: { all: pending.length === 0, generateDna: true } })
      setJobId(job.id)
    } catch (e) {
      toast.error('Could not start', errorMessage(e))
    } finally {
      setCompleting(false)
    }
  }
  const positioning = (dna?.data.one_sentence_positioning as string) || project.positioning || project.slogan
  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <ProjectAvatar project={project} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-fg">{project.name}</h1>
              {project.tokenSymbol ? <Badge tone="primary">${project.tokenSymbol.replace(/^\$/, '')}</Badge> : null}
              {project.industry ? <Badge>{project.industry}</Badge> : null}
            </div>
            <p className="mt-1 max-w-2xl text-[13.5px] text-fg-muted">{positioning || 'No positioning yet — upload materials or generate the Project DNA.'}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-fg-dim">
              {project.website ? <a href={project.website.startsWith('http') ? project.website : 'https://' + project.website} target="_blank" className="inline-flex items-center gap-1 hover:text-fg">Website <ExternalLink className="h-3 w-3" /></a> : null}
              {project.twitter ? <span>{project.twitter}</span> : null}
              {project.launchDate ? <span>Launch {project.launchDate}</span> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSettings(true)}><Settings2 className="h-3.5 w-3.5" /> Edit</Button>
          <Link href={`${base}/ask`}><Button variant="secondary" size="sm"><MessageSquare className="h-3.5 w-3.5" /> Ask {project.tokenSymbol || project.name.split(' ')[0]} AI</Button></Link>
          <Link href={`${base}/generate`}><Button size="sm"><Wand2 className="h-3.5 w-3.5" /> Generate Content</Button></Link>
        </div>
      </div>
      {jobId ? <div className="mb-6"><JobProgress projectId={project.id} jobId={jobId} title="AI is reading your project" onDone={(j) => { if (j.status === 'completed') { toast.success('Project brain updated', `Readiness ${j.result?.readiness ?? ''}%`); router.refresh() } }} /></div> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Project Readiness" description="How complete the AI brain is" action={<span className="text-2xl font-semibold text-primary">{readiness.total}%</span>} />
          <div className="space-y-3 p-5">
            {Object.entries(readiness.dimensions).map(([k, v]) => (
              <div key={k}>
                <div className="mb-1 flex justify-between text-[12.5px]"><span className="capitalize text-fg-muted">{k}</span><span className="text-fg">{v}%</span></div>
                <Progress value={v} />
              </div>
            ))}
            {readiness.missing.length ? (
              <div className="rounded-xl border border-line bg-white/[0.02] p-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-dim">Missing Information</div>
                <ul className="flex flex-wrap gap-1.5">{readiness.missing.slice(0, 10).map((m) => <li key={m}><Badge tone="warn">{m}</Badge></li>)}{readiness.missing.length > 10 ? <li><Badge>+{readiness.missing.length - 10}</Badge></li> : null}</ul>
                <Button size="sm" variant="secondary" className="mt-3 w-full" loading={completing} onClick={completeWithAI}><Sparkles className="h-3.5 w-3.5" /> Complete With AI</Button>
                <p className="mt-1.5 text-[11px] text-fg-dim">Re-reads all materials, extracts facts and regenerates the DNA. Add missing facts directly in Memory.</p>
              </div>
            ) : null}
          </div>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Link href={`${base}/knowledge`} className="card card-hover p-4"><div className="flex items-center gap-2 text-[12px] text-fg-muted"><BookOpen className="h-3.5 w-3.5" /> Knowledge Base</div><div className="mt-2 text-xl font-semibold text-fg">{kstats.sources}<span className="ml-1 text-[12px] font-normal text-fg-dim">sources</span></div><div className="text-[12px] text-fg-dim">{kstats.chunks} chunks indexed{pending.length ? ` · ${pending.length} pending` : ''}</div></Link>
            <Link href={`${base}/memory`} className="card card-hover p-4"><div className="flex items-center gap-2 text-[12px] text-fg-muted"><Brain className="h-3.5 w-3.5" /> Memory</div><div className="mt-2 text-xl font-semibold text-fg">{facts.length}<span className="ml-1 text-[12px] font-normal text-fg-dim">facts</span></div><div className="text-[12px] text-fg-dim">{facts.filter((f) => f.status === 'locked').length} locked · {memoryCount} memories</div></Link>
            <Link href={`${base}/dna`} className="card card-hover p-4"><div className="flex items-center gap-2 text-[12px] text-fg-muted"><Dna className="h-3.5 w-3.5" /> Project DNA</div><div className="mt-2 text-xl font-semibold text-fg">{dna ? `v${dna.version}` : '—'}</div><div className="text-[12px] text-fg-dim">{dna ? `Updated ${relativeTime(dna.createdAt)}` : 'Not generated yet'}</div></Link>
          </div>
          <Card>
            <CardHeader title="Key Facts" description="Highest-priority truth used by every generation" action={<Link href={`${base}/memory`} className="text-[12.5px] text-primary hover:underline">Manage</Link>} />
            {facts.length === 0 ? <div className="p-5 text-[13px] text-fg-muted">No facts yet. Upload a whitepaper or add facts manually in Memory.</div> : (
              <ul className="divide-y divide-line">
                {facts.filter((f) => f.status !== 'outdated').slice(0, 8).map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                    <span className="text-fg-muted">{f.label}</span>
                    <span className="flex items-center gap-2 text-right text-fg">{truncate(f.value, 60)}{f.status === 'locked' ? <Lock className="h-3 w-3 text-primary" /> : f.status === 'draft' ? <Badge tone="warn">unconfirmed</Badge> : null}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Recent Content" action={<Link href={`${base}/library`} className="text-[12.5px] text-primary hover:underline">Library</Link>} />
            {recentContent.length === 0 ? (
              <div className="flex flex-col items-start gap-3 p-5 text-[13px] text-fg-muted">Nothing generated yet.<div className="flex gap-2"><Link href={`${base}/generate`}><Button size="sm"><Wand2 className="h-3.5 w-3.5" /> Generate</Button></Link><Link href={`${base}/launch-kit`}><Button size="sm" variant="secondary"><Rocket className="h-3.5 w-3.5" /> Launch Kit</Button></Link></div></div>
            ) : (
              <ul className="divide-y divide-line">{recentContent.map((c) => <li key={c.id}><Link href={`${base}/library/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px] hover:bg-white/[0.03]"><span className="truncate text-fg">{c.title}</span><span className="flex shrink-0 items-center gap-2 text-[12px] text-fg-dim"><Badge>{c.contentType}</Badge>{relativeTime(c.createdAt)}</span></Link></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
      <ProjectSettingsDialog open={settings} onClose={() => setSettings(false)} project={project} />
    </div>
  )
}
