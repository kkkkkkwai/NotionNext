'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { Badge, Card, EmptyState, ErrorState, PageHeader, Tabs } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { cn, truncate } from '@/lib/utils'

type Item = { id: string; title: string; contentType: string; platform: string | null; status: string; scheduledAt: string | null; publishedAt: string | null; body: string }
type View = 'calendar' | 'list' | 'kanban'
const STATUSES = ['draft', 'review', 'approved', 'scheduled', 'published']
const statusLabel: Record<string, string> = { draft: '草稿', review: '待审核', approved: '已批准', scheduled: '已排期', published: '已发布' }
const typeColor: Record<string, string> = { tweet: 'bg-sky-400/20 text-sky-200', thread: 'bg-sky-400/20 text-sky-200', kol_tweet: 'bg-purple-400/20 text-purple-200', telegram_post: 'bg-cyan-400/20 text-cyan-200', poster_copy: 'bg-pink-400/20 text-pink-200', video_script: 'bg-orange-400/20 text-orange-200', ama_kit: 'bg-yellow-400/20 text-yellow-200', press_release: 'bg-emerald-400/20 text-emerald-200' }

function ym(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ContentCalendar({ projectId }: { projectId: string }) {
  const toast = useToast()
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('calendar')
  const [dragId, setDragId] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const from = new Date(month.getFullYear(), month.getMonth() - 1, 1)
      const to = new Date(month.getFullYear(), month.getMonth() + 2, 0)
      const r = await api<{ items: Item[] }>(`/api/projects/${projectId}/calendar?from=${from.toISOString()}&to=${to.toISOString()}`)
      setItems(r.items)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [projectId, month])
  useEffect(() => { load() }, [load])
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const start = new Date(first)
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7))
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }, [month])
  const dateOf = (it: Item) => (it.scheduledAt ?? it.publishedAt ? iso(new Date((it.scheduledAt ?? it.publishedAt) as string)) : null)
  const byDate = useMemo(() => {
    const m: Record<string, Item[]> = {}
    for (const it of items ?? []) { const d = dateOf(it); if (d) (m[d] ??= []).push(it) }
    return m
  }, [items])
  const move = async (id: string, date: string | null, status?: string) => {
    try {
      await api(`/api/projects/${projectId}/content/${id}`, { method: 'PATCH', json: { scheduledAt: date ? new Date(date + 'T12:00:00Z').toISOString() : null, ...(status ? { status } : {}) } })
      load()
    } catch (e) {
      toast.error('无法移动', errorMessage(e))
    }
  }
  const Chip = ({ it }: { it: Item }) => (
    <Link href={`/projects/${projectId}/library/${it.id}`} draggable onDragStart={() => setDragId(it.id)} className={cn('block truncate rounded-md px-1.5 py-0.5 text-[10.5px] leading-4', typeColor[it.contentType] ?? 'bg-white/[0.08] text-fg-muted', it.status === 'published' && 'ring-1 ring-primary/50')} title={it.title}>{it.title}</Link>
  )
  return (
    <div>
      <PageHeader eyebrow="活动" title="内容日历" description="拖拽内容到其他日期即可重新排期。Twitter、Telegram、海报、视频、AMA、PR 和 KOL 内容尽在一览。" actions={<Tabs tabs={[{ id: 'calendar', label: '日历' }, { id: 'list', label: '列表' }, { id: 'kanban', label: '看板' }]} value={view} onChange={setView} />} />
      {error ? <ErrorState message={error} retry={load} /> : null}
      {view === 'calendar' ? (
        <Card>
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><Button size="xs" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button><div className="text-[14px] font-medium text-fg">{month.toLocaleString('zh-CN', { month: 'long', year: 'numeric' })}</div><Button size="xs" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button></div>
          <div className="grid grid-cols-7 border-b border-line text-center text-[11px] uppercase tracking-wide text-fg-dim">{['一', '二', '三', '四', '五', '六', '日'].map((d) => <div key={d} className="py-1.5">{d}</div>)}</div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const key = iso(d)
              const inMonth = ym(d) === ym(month)
              const today = key === iso(new Date())
              return (
                <div key={key} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) { move(dragId, key, 'scheduled'); setDragId(null) } }} className={cn('min-h-[92px] border-b border-r border-line p-1.5 transition', !inMonth && 'bg-white/[0.01] opacity-50', dragId && 'hover:bg-primary/[0.05]')}>
                  <div className={cn('mb-1 text-[11px]', today ? 'font-semibold text-primary' : 'text-fg-dim')}>{d.getDate()}</div>
                  <div className="space-y-0.5">{(byDate[key] ?? []).slice(0, 4).map((it) => <Chip key={it.id} it={it} />)}{(byDate[key]?.length ?? 0) > 4 ? <div className="text-[10px] text-fg-dim">还有 {byDate[key].length - 4} 条</div> : null}</div>
                </div>
              )
            })}
          </div>
        </Card>
      ) : null}
      {view === 'list' ? (
        items && items.length === 0 ? <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="暂无排期内容" description="在内容编辑器中设置排期日期，或创建一个营销活动。" /> : (
          <Card className="divide-y divide-line">{(items ?? []).sort((a, b) => (dateOf(a) ?? '').localeCompare(dateOf(b) ?? '')).map((it) => <Link key={it.id} href={`/projects/${projectId}/library/${it.id}`} className="flex items-center gap-3 px-5 py-2.5 text-[13px] hover:bg-white/[0.03]"><span className="w-24 font-mono text-[12px] text-fg-dim">{dateOf(it)}</span><Badge>{contentTypeLabel(it.contentType)}</Badge><span className="flex-1 truncate text-fg">{it.title}</span><Badge tone={it.status === 'published' ? 'primary' : 'muted'}>{statusLabel[it.status] ?? it.status}</Badge></Link>)}</Card>
        )
      ) : null}
      {view === 'kanban' ? (
        <div className="grid gap-3 md:grid-cols-5">
          {STATUSES.map((s) => (
            <div key={s} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) { const it = items?.find((x) => x.id === dragId); move(dragId, it ? dateOf(it) : null, s); setDragId(null) } }} className="card min-h-[200px] p-2">
              <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-fg-dim">{statusLabel[s] ?? s}<span>{(items ?? []).filter((i) => i.status === s).length}</span></div>
              <div className="space-y-1.5">{(items ?? []).filter((i) => i.status === s).map((it) => <Link key={it.id} href={`/projects/${projectId}/library/${it.id}`} draggable onDragStart={() => setDragId(it.id)} className="block rounded-lg border border-line bg-white/[0.02] p-2 text-[12px] hover:border-line-strong"><div className="truncate text-fg">{it.title}</div><div className="mt-0.5 text-[10.5px] text-fg-dim">{contentTypeLabel(it.contentType)} · {dateOf(it) ?? '未排期'}</div></Link>)}</div>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-[11.5px] text-fg-dim">仅显示已设置排期或发布日期的内容。{items ? `当前范围内共 ${items.length} 条。` : ''} {items?.filter((i) => !dateOf(i)).length ? '' : ''}</p>
      <span className="hidden">{truncate('', 1)}</span>
    </div>
  )
}
