'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Rocket, Library, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, Field, PageHeader, Select, Switch } from '@/components/ui/primitives'
import { JobProgress } from '@/components/project/job-progress'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { relativeTime } from '@/lib/utils'
import type { JobView } from '@/hooks/use-job'

type Plan = { slug: string; count: number; label: string; folder: string }

export function LaunchKit({ projectId }: { projectId: string }) {
  const toast = useToast()
  const [plan, setPlan] = useState<Plan[]>([])
  const [total, setTotal] = useState(0)
  const [jobs, setJobs] = useState<JobView[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [language, setLanguage] = useState('en')
  const [lite, setLite] = useState(false)
  const [starting, setStarting] = useState(false)
  const load = useCallback(async () => {
    const r = await api<{ jobs: JobView[]; plan: Plan[]; total: number }>(`/api/projects/${projectId}/launch-kit`)
    setPlan(r.plan)
    setTotal(r.total)
    setJobs(r.jobs)
    const running = r.jobs.find((j) => j.status === 'running' || j.status === 'queued')
    if (running) setJobId(running.id)
  }, [projectId])
  useEffect(() => { load().catch((e) => toast.error('Load failed', errorMessage(e))) }, [load, toast])
  const start = async () => {
    setStarting(true)
    try {
      const { job } = await api<{ job: JobView }>(`/api/projects/${projectId}/launch-kit`, { method: 'POST', json: { language, lite } })
      setJobId(job.id)
    } catch (e) {
      toast.error('Could not start', errorMessage(e))
    } finally {
      setStarting(false)
    }
  }
  const liteCount = plan.reduce((a, p) => a + Math.min(p.count, p.count > 5 ? 3 : 1), 0) + 1
  const running = Boolean(jobId && jobs.find((j) => j.id === jobId && (j.status === 'running' || j.status === 'queued')))
  return (
    <div>
      <PageHeader eyebrow="One Click" title="Generate Full Launch Kit" description={`${total} assets from one button: overview, one-pager, litepaper, pitch deck, posters, 30 tweets, 5 threads, video scripts, AMA kit, FAQ, KOL, PR, roadmap, token narrative and a 30-day calendar.`} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {jobId ? <JobProgress projectId={projectId} jobId={jobId} title="Generating Launch Kit" onDone={(j) => { load(); if (j.status === 'completed') toast.success('Launch Kit complete', `${j.result.created ?? 0} assets saved to Content Library`) }} /> : null}
          <Card>
            <CardHeader title="What gets generated" description="Everything is saved to Content Library → folder “Launch Kit”" />
            <ul className="grid gap-x-6 gap-y-1 p-5 sm:grid-cols-2">{plan.map((p) => <li key={p.slug} className="flex items-center justify-between text-[13px]"><span className="text-fg/90">{p.label}</span><span className="font-mono text-fg-dim">×{lite ? Math.min(p.count, p.count > 5 ? 3 : 1) : p.count}</span></li>)}<li className="flex items-center justify-between text-[13px]"><span className="text-fg/90">30-day Content Calendar</span><span className="font-mono text-fg-dim">×1</span></li></ul>
          </Card>
          {jobs.length ? (
            <Card>
              <CardHeader title="Previous runs" />
              <ul className="divide-y divide-line">{jobs.map((j) => <li key={j.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]"><Badge tone={j.status === 'completed' ? 'primary' : j.status === 'failed' ? 'danger' : 'info'}>{j.status}</Badge><span className="text-fg-muted">{relativeTime(j.createdAt)}</span><span className="text-fg-dim">{String(j.input.language ?? 'en')}{j.input.lite ? ' · lite' : ''}</span>{j.status === 'completed' ? <span className="text-fg">{String(j.result.created ?? 0)} created{Number(j.result.failed ?? 0) ? `, ${String(j.result.failed)} failed` : ''}{Number(j.result.risky ?? 0) ? ` · ${String(j.result.risky)} need risk review` : ''}</span> : null}{j.error ? <span className="text-danger">{j.error}</span> : null}<div className="flex-1" /><Link href={`/projects/${projectId}/library?folder=${encodeURIComponent('Launch Kit')}`} className="text-primary hover:underline">Open</Link>{Array.isArray(j.result.missing) && (j.result.missing as string[]).length ? <div className="flex w-full items-start gap-2 text-[12px] text-warn"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Missing: {(j.result.missing as string[]).slice(0, 8).join(' · ')}</div> : null}</li>)}</ul>
            </Card>
          ) : null}
        </div>
        <Card className="h-fit">
          <CardHeader title="Run" description="Uses your configured AI models; long-form assets use the long-context model." />
          <div className="space-y-4 p-5">
            <Field label="Language"><Select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="en">English</option><option value="zh">中文</option><option value="ko">한국어</option><option value="ja">日本語</option><option value="vi">Tiếng Việt</option><option value="th">ไทย</option><option value="ru">Русский</option><option value="es">Español</option></Select></Field>
            <Switch checked={lite} onChange={setLite} label={`Lite mode (${liteCount} assets, faster & cheaper)`} />
            <Button className="w-full" size="lg" onClick={start} loading={starting} disabled={running}><Rocket className="h-4 w-4" /> {running ? 'Generating…' : 'Generate Full Launch Kit'}</Button>
            <p className="text-[12px] text-fg-dim">Progress: Reading Project Memory → Analyzing DNA → Searching Knowledge → Building Narrative → Strategy → Generating → Fact / Consistency / Risk checks. If DNA or Narrative are missing they are generated first. Expect several minutes for the full kit.</p>
            <Link href={`/projects/${projectId}/library?folder=${encodeURIComponent('Launch Kit')}`} className="flex items-center gap-2 text-[13px] text-primary hover:underline"><Library className="h-3.5 w-3.5" /> View Launch Kit in library</Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
