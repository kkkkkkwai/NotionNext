'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, statusLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Library, Trash2, Folder, Tag } from 'lucide-react'
import { Badge, Card, EmptyState, ErrorState, Input, PageHeader, Select, Skeleton } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { relativeTime, truncate } from '@/lib/utils'

type Item = { id: string; title: string; contentType: string; category: string; platform: string | null; language: string; status: string; tags: string[]; folder: string | null; body: string; createdAt: string; updatedAt: string; scheduledAt: string | null }
type Facets = { categories: string[]; contentTypes: string[]; languages: string[]; platforms: string[]; statuses: string[]; folders: string[]; tags: string[] }
const STATUSES = ['draft', 'review', 'approved', 'scheduled', 'published', 'archived']
const STATUS_ZH: Record<string, string> = { draft: '草稿', review: '待审核', approved: '已批准', scheduled: '已排期', published: '已发布', archived: '已归档' }
const CAT_ZH: Record<string, string> = { foundation: '基础资料', marketing: '营销文案', social: '社媒', poster: '海报文案', video: '视频脚本', community: '社区', pr: '公关稿', kol: 'KOL' }
const tone = (s: string) => (s === 'published' ? 'primary' : s === 'approved' || s === 'scheduled' ? 'info' : s === 'review' ? 'warn' : s === 'archived' ? 'muted' : 'neutral') as 'primary' | 'info' | 'warn' | 'muted' | 'neutral'

export function ContentLibrary({ projectId, initial }: { projectId: string; initial: { folder?: string; campaignId?: string; status?: string } }) {
  const toast = useToast()
  const [items, setItems] = useState<Item[] | null>(null)
  const [total, setTotal] = useState(0)
  const [facets, setFacets] = useState<Facets | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState({ q: '', category: '', contentType: '', language: '', platform: '', status: initial.status ?? '', folder: initial.folder ?? '', tag: '', campaignId: initial.campaignId ?? '' })
  const [page, setPage] = useState(1)
  const [del, setDel] = useState<Item | null>(null)
  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), page: String(page), facets: '1' })
      const r = await api<{ items: Item[]; total: number; facets: Facets }>(`/api/projects/${projectId}/content?${qs}`)
      setItems(r.items)
      setTotal(r.total)
      setFacets(r.facets)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [projectId, f, page])
  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])
  const setStatus = async (item: Item, status: string) => {
    try {
      await api(`/api/projects/${projectId}/content/${item.id}`, { method: 'PATCH', json: { status } })
      load()
    } catch (e) {
      toast.error('更新失败', errorMessage(e))
    }
  }
  const sel = (k: keyof typeof f, options: string[], label: string, display?: Record<string, string>) => (
    <Select value={f[k]} onChange={(e) => { setF({ ...f, [k]: e.target.value }); setPage(1) }} className="h-8 w-auto min-w-[120px] py-1 text-[12.5px]"><option value="">{label}</option>{options.map((o) => <option key={o} value={o}>{display?.[o] ?? o}</option>)}</Select>
  )
  return (
    <div>
      <PageHeader eyebrow="内容" title="内容库" description={`共 ${total} 项。AI 生成的所有内容都会汇总在这里，支持版本、状态、标签和文件夹管理。`} actions={<Link href={`/projects/${projectId}/generate`}><Button size="sm">生成内容</Button></Link>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-dim" /><Input value={f.q} onChange={(e) => { setF({ ...f, q: e.target.value }); setPage(1) }} placeholder="搜索…" className="h-8 w-56 py-1 pl-8 text-[12.5px]" /></div>
        {sel('category', facets?.categories ?? [], '分类', CAT_ZH)}{sel('contentType', facets?.contentTypes ?? [], '内容类型')}{sel('language', facets?.languages ?? [], '语言')}{sel('platform', facets?.platforms ?? [], '平台')}{sel('status', STATUSES, '状态', STATUS_ZH)}{sel('folder', facets?.folders ?? [], '文件夹')}{sel('tag', facets?.tags ?? [], '标签')}
        {Object.values(f).some(Boolean) ? <button onClick={() => { setF({ q: '', category: '', contentType: '', language: '', platform: '', status: '', folder: '', tag: '', campaignId: '' }); setPage(1) }} className="text-[12.5px] text-fg-muted hover:text-fg">清除筛选</button> : null}
      </div>
      {error ? <ErrorState message={error} retry={load} /> : items === null ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div> : items.length === 0 ? (
        <EmptyState icon={<Library className="h-5 w-5" />} title="暂无内容" description={Object.values(f).some(Boolean) ? '试试清除筛选条件。' : '生成第一篇内容、运行上线内容包，或创建一个活动。'} action={<Link href={`/projects/${projectId}/generate`}><Button size="sm">生成内容</Button></Link>} />
      ) : (
        <Card className="divide-y divide-line">
          {items.map((it) => (
            <div key={it.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-white/[0.02]">
              <div className="min-w-0 flex-1">
                <Link href={`/projects/${projectId}/library/${it.id}`} className="text-[14px] font-medium text-fg hover:text-primary">{it.title}</Link>
                <p className="mt-0.5 line-clamp-2 text-[12.5px] text-fg-muted">{truncate(it.body.replace(/[#*_>`]/g, ''), 220)}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-dim">
                  <Badge>{contentTypeLabel(it.contentType)}</Badge>{it.platform ? <Badge>{platformLabel(it.platform)}</Badge> : null}<Badge>{languageLabel(it.language)}</Badge>{it.folder ? <span className="inline-flex items-center gap-1"><Folder className="h-3 w-3" />{it.folder}</span> : null}{it.tags.slice(0, 3).map((t) => <span key={t} className="inline-flex items-center gap-0.5"><Tag className="h-3 w-3" />{t}</span>)}<span>· {relativeTime(it.createdAt)}</span>{it.scheduledAt ? <span>· 排期 {new Date(it.scheduledAt).toLocaleDateString()}</span> : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Select value={statusLabel(it.status)} onChange={(e) => setStatus(it, e.target.value)} className={`h-7 w-auto border-0 py-0.5 text-[11.5px] ${tone(it.status) === 'primary' ? 'text-primary' : ''}`}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_ZH[s] ?? s}</option>)}</Select>
                <button onClick={() => setDel(it)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-danger" title="删除"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </Card>
      )}
      {total > 30 ? <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-fg-muted"><Button size="xs" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>第 {page} / {Math.ceil(total / 30)} 页<Button size="xs" variant="secondary" disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(page + 1)}>下一页</Button></div> : null}
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`删除“${del?.title}”？`} description="所有版本都将被删除。" confirmLabel="删除" danger onConfirm={async () => { if (del) { await api(`/api/projects/${projectId}/content/${del.id}`, { method: 'DELETE' }); load() } }} />
    </div>
  )
}
