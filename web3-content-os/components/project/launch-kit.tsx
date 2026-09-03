'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, statusLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
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
const JOB_STATUS_ZH: Record<string, string> = { queued: '排队中', running: '运行中', completed: '已完成', failed: '失败', cancelled: '已取消' }

export function LaunchKit({ projectId }: { projectId: string }) {
  const toast = useToast()
  const [plan, setPlan] = useState<Plan[]>([])
  const [total, setTotal] = useState(0)
  const [jobs, setJobs] = useState<JobView[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [language, setLanguage] = useState('zh')
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
  useEffect(() => { load().catch((e) => toast.error('加载失败', errorMessage(e))) }, [load, toast])
  const start = async () => {
    setStarting(true)
    try {
      const { job } = await api<{ job: JobView }>(`/api/projects/${projectId}/launch-kit`, { method: 'POST', json: { language, lite } })
      setJobId(job.id)
    } catch (e) {
      toast.error('无法启动', errorMessage(e))
    } finally {
      setStarting(false)
    }
  }
  const liteCount = plan.reduce((a, p) => a + Math.min(p.count, p.count > 5 ? 3 : 1), 0) + 1
  const running = Boolean(jobId && jobs.find((j) => j.id === jobId && (j.status === 'running' || j.status === 'queued')))
  return (
    <div>
      <PageHeader eyebrow="一键生成" title="生成完整上线内容包" description={`一键生成 ${total} 项内容资产：项目概览、一页纸、Litepaper、Pitch Deck、海报文案、30 条推文、5 个 Thread、视频脚本、AMA 素材、FAQ、KOL 素材、公关稿、路线图、Token 叙事以及 30 天内容日历。`} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {jobId ? <JobProgress projectId={projectId} jobId={jobId} title="正在生成上线内容包" onDone={(j) => { load(); if (j.status === 'completed') toast.success('上线内容包已完成', `${j.result.created ?? 0} 项资产已保存到内容库`) }} /> : null}
          <Card>
            <CardHeader title="将生成的内容" description="所有内容都会保存到内容库 → “上线内容包”文件夹" />
            <ul className="grid gap-x-6 gap-y-1 p-5 sm:grid-cols-2">{plan.map((p) => <li key={p.slug} className="flex items-center justify-between text-[13px]"><span className="text-fg/90">{p.label}</span><span className="font-mono text-fg-dim">×{lite ? Math.min(p.count, p.count > 5 ? 3 : 1) : p.count}</span></li>)}<li className="flex items-center justify-between text-[13px]"><span className="text-fg/90">30 天内容日历</span><span className="font-mono text-fg-dim">×1</span></li></ul>
          </Card>
          {jobs.length ? (
            <Card>
              <CardHeader title="历史运行记录" />
              <ul className="divide-y divide-line">{jobs.map((j) => <li key={j.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]"><Badge tone={j.status === 'completed' ? 'primary' : j.status === 'failed' ? 'danger' : 'info'}>{JOB_STATUS_ZH[j.status] ?? j.status}</Badge><span className="text-fg-muted">{relativeTime(j.createdAt)}</span><span className="text-fg-dim">{String(j.input.language ?? 'en')}{j.input.lite ? ' · 精简版' : ''}</span>{j.status === 'completed' ? <span className="text-fg">已生成 {String(j.result.created ?? 0)} 项{Number(j.result.failed ?? 0) ? `，${String(j.result.failed)} 项失败` : ''}{Number(j.result.risky ?? 0) ? ` · ${String(j.result.risky)} 项需风险审核` : ''}</span> : null}{j.error ? <span className="text-danger">{j.error}</span> : null}<div className="flex-1" /><Link href={`/projects/${projectId}/library?folder=${encodeURIComponent('上线内容包')}`} className="text-primary hover:underline">打开</Link>{Array.isArray(j.result.missing) && (j.result.missing as string[]).length ? <div className="flex w-full items-start gap-2 text-[12px] text-warn"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />缺失信息：{(j.result.missing as string[]).slice(0, 8).join(' · ')}</div> : null}</li>)}</ul>
            </Card>
          ) : null}
        </div>
        <Card className="h-fit">
          <CardHeader title="开始运行" description="使用你配置的 AI 模型；长文内容会使用长上下文模型。" />
          <div className="space-y-4 p-5">
            <Field label="语言"><Select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="zh">中文</option><option value="en">English</option><option value="ko">한국어</option><option value="ja">日本語</option><option value="vi">Tiếng Việt</option><option value="th">ไทย</option><option value="ru">Русский</option><option value="es">Español</option></Select></Field>
            <Switch checked={lite} onChange={setLite} label={`精简模式（${liteCount} 项资产，更快更省）`} />
            <Button className="w-full" size="lg" onClick={start} loading={starting} disabled={running}><Rocket className="h-4 w-4" /> {running ? '生成中…' : '生成完整上线内容包'}</Button>
            <p className="text-[12px] text-fg-dim">流程：读取项目记忆 → 分析 DNA → 检索知识库 → 构建叙事 → 制定策略 → 生成内容 → 事实 / 一致性 / 风险检查。如果缺少 DNA 或叙事，会先自动生成。完整内容包预计需要几分钟。</p>
            <Link href={`/projects/${projectId}/library?folder=${encodeURIComponent('上线内容包')}`} className="flex items-center gap-2 text-[13px] text-primary hover:underline"><Library className="h-3.5 w-3.5" /> 在内容库中查看上线内容包</Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
