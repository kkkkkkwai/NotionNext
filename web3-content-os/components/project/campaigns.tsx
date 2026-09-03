'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Megaphone, Plus, Trash2, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, Textarea } from '@/components/ui/primitives'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { JobProgress } from '@/components/project/job-progress'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { relativeTime } from '@/lib/utils'

type Campaign = { id: string; name: string; goal: string | null; type: string; startDate: string | null; endDate: string | null; status: string; plan: { launchDate?: string; daysBefore?: number; days?: unknown[] }; createdAt: string }
type T = { slug: string; label: string }
const statusLabel: Record<string, string> = { ready: '已就绪', generating: '生成中', draft: '草稿' }

export function CampaignsView({ projectId }: { projectId: string }) {
  const toast = useToast()
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [types, setTypes] = useState<T[]>([])
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', goal: '', launchDate: '', daysBefore: 7, daysAfter: 0, language: 'en', types: [] as string[] })
  const [starting, setStarting] = useState(false)
  const [del, setDel] = useState<Campaign | null>(null)
  const load = useCallback(async () => {
    try {
      const r = await api<{ campaigns: Campaign[]; types: T[] }>(`/api/projects/${projectId}/campaigns`)
      setCampaigns(r.campaigns)
      setTypes(r.types)
      if (form.types.length === 0) setForm((f) => ({ ...f, types: r.types.map((t) => t.slug) }))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [projectId, form.types.length])
  useEffect(() => { load() }, [load])
  const start = async () => {
    if (!form.goal.trim() || !form.launchDate) return toast.error('请填写目标和发布日期')
    setStarting(true)
    try {
      const r = await api<{ campaign: Campaign; job: { id: string } }>(`/api/projects/${projectId}/campaigns`, { method: 'POST', json: form })
      setOpen(false)
      setJobId(r.job.id)
      load()
    } catch (e) {
      toast.error('无法启动活动', errorMessage(e))
    } finally {
      setStarting(false)
    }
  }
  return (
    <div>
      <PageHeader eyebrow="活动引擎" title="营销活动" description="“Token 9 月 20 日上线，需要 7 天的营销预热。” → T-7 品牌故事 … T-1 明日上线 → 发布日，每天自动生成 Twitter、Telegram、海报、KOL、社区和视频内容。" actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> 创建活动</Button>} />
      {jobId ? <div className="mb-4"><JobProgress projectId={projectId} jobId={jobId} title="正在构建活动" onDone={(j) => { load(); if (j.status === 'completed') toast.success('活动已就绪', `已排期 ${j.result.generated ?? 0} 条内容`) }} /></div> : null}
      {error ? <ErrorState message={error} retry={load} /> : campaigns === null ? <Skeleton className="h-40" /> : campaigns.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-5 w-5" />} title="还没有活动" description="创建一个上线活动：AI 会规划每天的主题并生成内容，自动排入日历。" action={<Button onClick={() => setOpen(true)}>创建活动</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => (
            <Card key={c.id} className="card-hover p-4">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/projects/${projectId}/campaigns/${c.id}`} className="min-w-0 flex-1"><div className="truncate text-[15px] font-medium text-fg">{c.name}</div><div className="mt-0.5 line-clamp-2 text-[12.5px] text-fg-muted">{c.goal}</div></Link>
                <Badge tone={c.status === 'ready' ? 'primary' : c.status === 'generating' ? 'info' : 'neutral'}>{statusLabel[c.status] ?? c.status}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-3 text-[12px] text-fg-dim"><CalendarDays className="h-3.5 w-3.5" />{c.startDate} → {c.endDate}<span>· 发布日 {c.plan.launchDate}</span><div className="flex-1" /><span>{relativeTime(c.createdAt)}</span><button onClick={() => setDel(c)} className="text-fg-dim hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button></div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="创建上线活动" description="AI 先规划整体节奏，再在后台生成每天的素材。" size="lg" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>取消</Button><Button onClick={start} loading={starting}>生成活动</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="目标 *" className="sm:col-span-2"><Textarea rows={3} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="Token 将在 Binance Alpha 上线；在 TGE 前 7 天提升认知度并推动社区增长。" /></Field>
          <Field label="发布日期 *"><Input type="date" value={form.launchDate} onChange={(e) => setForm({ ...form, launchDate: e.target.value })} /></Field>
          <Field label="活动名称"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="自动生成" /></Field>
          <Field label="上线前天数"><Input type="number" min={1} max={30} value={form.daysBefore} onChange={(e) => setForm({ ...form, daysBefore: Number(e.target.value) })} /></Field>
          <Field label="上线后天数"><Input type="number" min={0} max={14} value={form.daysAfter} onChange={(e) => setForm({ ...form, daysAfter: Number(e.target.value) })} /></Field>
          <Field label="语言"><Select value={languageLabel(form.language)} onChange={(e) => setForm({ ...form, language: e.target.value })}><option value="en">English</option><option value="zh">中文</option><option value="ko">한국어</option><option value="ja">日本語</option><option value="vi">Tiếng Việt</option><option value="th">ไทย</option><option value="ru">Русский</option><option value="es">Español</option></Select></Field>
          <div className="sm:col-span-2"><div className="label">每日内容</div><div className="flex flex-wrap gap-2">{types.map((t) => <label key={t.slug} className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] text-fg-muted"><input type="checkbox" className="accent-[#43FFB0]" checked={form.types.includes(t.slug)} onChange={(e) => setForm({ ...form, types: e.target.checked ? [...form.types, t.slug] : form.types.filter((x) => x !== t.slug) })} />{t.label}</label>)}</div><p className="mt-1.5 text-[11.5px] text-fg-dim">将生成 {(form.daysBefore + form.daysAfter + 1) * form.types.length} 条内容。</p></div>
        </div>
      </Dialog>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`删除“${del?.name}”？`} description="已生成的内容会保留在内容库中，但将与该活动解除关联。" confirmLabel="删除" danger onConfirm={async () => { if (del) { await api(`/api/projects/${projectId}/campaigns/${del.id}`, { method: 'DELETE' }); load() } }} />
    </div>
  )
}
