'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, statusLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ScanSearch, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'

type Issue = { contentId: string; title: string; contentType: string; kind: 'fact' | 'terminology'; key: string; oldValue: string; newValue: string; snippet: string }
type Res = { issues: Issue[]; scanned: number; checks: { key: string; oldValue: string; newValue: string }[] }

const kindLabel: Record<string, string> = { fact: '事实', terminology: '术语' }

export function ConsistencyCheck({ projectId }: { projectId: string }) {
  const toast = useToast()
  const [res, setRes] = useState<Res | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const load = useCallback(async () => {
    setRes(null)
    try {
      const r = await api<Res>(`/api/projects/${projectId}/consistency`)
      setRes(r)
      setSelected(new Set(r.issues.map((i) => i.contentId + '|' + i.oldValue)))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [projectId])
  useEffect(() => { load() }, [load])
  const apply = async () => {
    if (!res) return
    setApplying(true)
    try {
      const fixes = res.issues.filter((i) => selected.has(i.contentId + '|' + i.oldValue)).map((i) => ({ contentId: i.contentId, oldValue: i.oldValue, newValue: i.newValue }))
      const r = await api<{ updated: number }>(`/api/projects/${projectId}/consistency`, { method: 'POST', json: { fixes } })
      toast.success(`已更新 ${r.updated} 条内容`, '已创建新版本，历史版本仍会保留。')
      load()
    } catch (e) {
      toast.error('更新失败', errorMessage(e))
    } finally {
      setApplying(false)
    }
  }
  const groups = res ? Object.values(res.issues.reduce<Record<string, Issue[]>>((acc, i) => { (acc[i.key + '|' + i.oldValue] ??= []).push(i); return acc }, {})) : []
  return (
    <div>
      <PageHeader eyebrow="工具" title="一致性检查" description="当事实发生变化（Token 总量 1B → 10B）或术语更名（ATM → TOKI）时，找出所有仍在使用旧值的历史内容，一键更新。" actions={<><Button variant="secondary" size="sm" onClick={load}><ScanSearch className="h-3.5 w-3.5" /> 重新扫描</Button><Button size="sm" onClick={apply} loading={applying} disabled={!res || selected.size === 0}>{selected.size ? `更新 (${selected.size})` : '全部更新'}</Button></>} />
      {error ? <ErrorState message={error} retry={load} /> : !res ? <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            {res.issues.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-5 w-5 text-primary" />} title={`全部 ${res.scanned} 条内容均保持一致`} description={res.checks.length ? '没有历史内容使用过时的值或术语。' : '暂无可用于检查的事实变更或术语规则。请在记忆库中更新事实，或添加术语规则。'} /> : (
              <>
                <div className="rounded-xl border border-warn/30 bg-warn/[0.06] px-4 py-2.5 text-[13px] text-warn">在 {new Set(res.issues.map((i) => i.contentId)).size} 条内容中发现 {res.issues.length} 处过时内容（共扫描 {res.scanned} 条）。</div>
                {groups.map((g) => (
                  <Card key={g[0].key + g[0].oldValue}>
                    <CardHeader title={<span className="flex flex-wrap items-center gap-2"><Badge tone={g[0].kind === 'terminology' ? 'info' : 'warn'}>{kindLabel[g[0].kind] ?? g[0].kind}</Badge>{g[0].key}<span className="font-mono text-[13px] text-fg-dim line-through">{g[0].oldValue}</span><ArrowRight className="h-3.5 w-3.5 text-fg-dim" /><span className="font-mono text-[13px] text-primary">{g[0].newValue}</span></span>} description={`${g.length} 处`} />
                    <ul className="divide-y divide-line">{g.map((i) => { const k = i.contentId + '|' + i.oldValue; return <li key={k} className="flex items-start gap-3 px-5 py-2.5"><input type="checkbox" className="mt-1 accent-[#43FFB0]" checked={selected.has(k)} onChange={(e) => { const s = new Set(selected); e.target.checked ? s.add(k) : s.delete(k); setSelected(s) }} /><div className="min-w-0 flex-1"><Link href={`/projects/${projectId}/library/${i.contentId}`} className="text-[13px] text-fg hover:text-primary">{i.title}</Link> <Badge>{contentTypeLabel(i.contentType)}</Badge><p className="mt-0.5 truncate text-[12px] text-fg-dim">…{i.snippet}…</p></div></li> })}</ul>
                  </Card>
                ))}
              </>
            )}
          </div>
          <Card className="h-fit">
            <CardHeader title="生效的检查项" description="来自事实历史和术语规则的旧值 → 新值" />
            {res.checks.length === 0 ? <div className="p-4 text-[12.5px] text-fg-dim">暂无。</div> : <ul className="divide-y divide-line">{res.checks.map((c, i) => <li key={i} className="px-4 py-2 text-[12.5px]"><div className="text-fg-muted">{c.key}</div><div className="flex items-center gap-1.5 font-mono text-[12px]"><span className="text-fg-dim line-through">{c.oldValue}</span><ArrowRight className="h-3 w-3 text-fg-dim" /><span className="text-primary">{c.newValue}</span></div></li>)}</ul>}
          </Card>
        </div>
      )}
    </div>
  )
}
