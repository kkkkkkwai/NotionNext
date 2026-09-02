'use client'
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
    if (!form.goal.trim() || !form.launchDate) return toast.error('Goal and launch date are required')
    setStarting(true)
    try {
      const r = await api<{ campaign: Campaign; job: { id: string } }>(`/api/projects/${projectId}/campaigns`, { method: 'POST', json: form })
      setOpen(false)
      setJobId(r.job.id)
      load()
    } catch (e) {
      toast.error('Could not start campaign', errorMessage(e))
    } finally {
      setStarting(false)
    }
  }
  return (
    <div>
      <PageHeader eyebrow="Campaign Engine" title="Campaigns" description="“Token launches Sept 20, we need 7 days of marketing.” → T-7 Brand Story … T-1 Tomorrow → Launch Day, with Twitter, Telegram, poster, KOL, community and video for every day." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create Campaign</Button>} />
      {jobId ? <div className="mb-4"><JobProgress projectId={projectId} jobId={jobId} title="Building campaign" onDone={(j) => { load(); if (j.status === 'completed') toast.success('Campaign ready', `${j.result.generated ?? 0} pieces scheduled`) }} /></div> : null}
      {error ? <ErrorState message={error} retry={load} /> : campaigns === null ? <Skeleton className="h-40" /> : campaigns.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-5 w-5" />} title="No campaigns yet" description="Create a launch campaign: the AI plans each day's theme and generates the content, already scheduled in the calendar." action={<Button onClick={() => setOpen(true)}>Create Campaign</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => (
            <Card key={c.id} className="card-hover p-4">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/projects/${projectId}/campaigns/${c.id}`} className="min-w-0 flex-1"><div className="truncate text-[15px] font-medium text-fg">{c.name}</div><div className="mt-0.5 line-clamp-2 text-[12.5px] text-fg-muted">{c.goal}</div></Link>
                <Badge tone={c.status === 'ready' ? 'primary' : c.status === 'generating' ? 'info' : 'neutral'}>{c.status}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-3 text-[12px] text-fg-dim"><CalendarDays className="h-3.5 w-3.5" />{c.startDate} → {c.endDate}<span>· launch {c.plan.launchDate}</span><div className="flex-1" /><span>{relativeTime(c.createdAt)}</span><button onClick={() => setDel(c)} className="text-fg-dim hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button></div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Create launch campaign" description="The AI plans the arc, then generates every day's assets in the background." size="lg" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={start} loading={starting}>Generate campaign</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Goal *" className="sm:col-span-2"><Textarea rows={3} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="Token launches on Binance Alpha; drive awareness and community growth in the 7 days before TGE." /></Field>
          <Field label="Launch date *"><Input type="date" value={form.launchDate} onChange={(e) => setForm({ ...form, launchDate: e.target.value })} /></Field>
          <Field label="Campaign name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Auto" /></Field>
          <Field label="Days before launch"><Input type="number" min={1} max={30} value={form.daysBefore} onChange={(e) => setForm({ ...form, daysBefore: Number(e.target.value) })} /></Field>
          <Field label="Days after launch"><Input type="number" min={0} max={14} value={form.daysAfter} onChange={(e) => setForm({ ...form, daysAfter: Number(e.target.value) })} /></Field>
          <Field label="Language"><Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}><option value="en">English</option><option value="zh">中文</option><option value="ko">한국어</option><option value="ja">日本語</option><option value="vi">Tiếng Việt</option><option value="th">ไทย</option><option value="ru">Русский</option><option value="es">Español</option></Select></Field>
          <div className="sm:col-span-2"><div className="label">Daily content</div><div className="flex flex-wrap gap-2">{types.map((t) => <label key={t.slug} className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] text-fg-muted"><input type="checkbox" className="accent-[#43FFB0]" checked={form.types.includes(t.slug)} onChange={(e) => setForm({ ...form, types: e.target.checked ? [...form.types, t.slug] : form.types.filter((x) => x !== t.slug) })} />{t.label}</label>)}</div><p className="mt-1.5 text-[11.5px] text-fg-dim">{(form.daysBefore + form.daysAfter + 1) * form.types.length} pieces will be generated.</p></div>
        </div>
      </Dialog>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`Delete "${del?.name}"?`} description="Generated content stays in the library but is detached from the campaign." confirmLabel="Delete" danger onConfirm={async () => { if (del) { await api(`/api/projects/${projectId}/campaigns/${del.id}`, { method: 'DELETE' }); load() } }} />
    </div>
  )
}
