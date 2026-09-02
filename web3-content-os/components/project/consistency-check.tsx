'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ScanSearch, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'

type Issue = { contentId: string; title: string; contentType: string; kind: 'fact' | 'terminology'; key: string; oldValue: string; newValue: string; snippet: string }
type Res = { issues: Issue[]; scanned: number; checks: { key: string; oldValue: string; newValue: string }[] }

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
      toast.success(`Updated ${r.updated} content items`, 'New versions were created; previous versions are kept.')
      load()
    } catch (e) {
      toast.error('Update failed', errorMessage(e))
    } finally {
      setApplying(false)
    }
  }
  const groups = res ? Object.values(res.issues.reduce<Record<string, Issue[]>>((acc, i) => { (acc[i.key + '|' + i.oldValue] ??= []).push(i); return acc }, {})) : []
  return (
    <div>
      <PageHeader eyebrow="Tools" title="Consistency Check" description="When a fact changes (Token Supply 1B → 10B) or a term is renamed (ATM → TOKI), find every historical piece that still carries the old value and update it in one click." actions={<><Button variant="secondary" size="sm" onClick={load}><ScanSearch className="h-3.5 w-3.5" /> Rescan</Button><Button size="sm" onClick={apply} loading={applying} disabled={!res || selected.size === 0}>Update {selected.size ? `(${selected.size})` : 'All'}</Button></>} />
      {error ? <ErrorState message={error} retry={load} /> : !res ? <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            {res.issues.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-5 w-5 text-primary" />} title={`All ${res.scanned} content items are consistent`} description={res.checks.length ? 'No historical content uses an outdated value or term.' : 'No fact changes or terminology rules to check against yet. Update a fact in Memory or add a terminology rule.'} /> : (
              <>
                <div className="rounded-xl border border-warn/30 bg-warn/[0.06] px-4 py-2.5 text-[13px] text-warn">Found {res.issues.length} outdated occurrence{res.issues.length > 1 ? 's' : ''} in {new Set(res.issues.map((i) => i.contentId)).size} content items (scanned {res.scanned}).</div>
                {groups.map((g) => (
                  <Card key={g[0].key + g[0].oldValue}>
                    <CardHeader title={<span className="flex flex-wrap items-center gap-2"><Badge tone={g[0].kind === 'terminology' ? 'info' : 'warn'}>{g[0].kind}</Badge>{g[0].key}<span className="font-mono text-[13px] text-fg-dim line-through">{g[0].oldValue}</span><ArrowRight className="h-3.5 w-3.5 text-fg-dim" /><span className="font-mono text-[13px] text-primary">{g[0].newValue}</span></span>} description={`${g.length} occurrence${g.length > 1 ? 's' : ''}`} />
                    <ul className="divide-y divide-line">{g.map((i) => { const k = i.contentId + '|' + i.oldValue; return <li key={k} className="flex items-start gap-3 px-5 py-2.5"><input type="checkbox" className="mt-1 accent-[#43FFB0]" checked={selected.has(k)} onChange={(e) => { const s = new Set(selected); e.target.checked ? s.add(k) : s.delete(k); setSelected(s) }} /><div className="min-w-0 flex-1"><Link href={`/projects/${projectId}/library/${i.contentId}`} className="text-[13px] text-fg hover:text-primary">{i.title}</Link> <Badge>{i.contentType}</Badge><p className="mt-0.5 truncate text-[12px] text-fg-dim">…{i.snippet}…</p></div></li> })}</ul>
                  </Card>
                ))}
              </>
            )}
          </div>
          <Card className="h-fit">
            <CardHeader title="Active checks" description="Old → new values from fact history and terminology" />
            {res.checks.length === 0 ? <div className="p-4 text-[12.5px] text-fg-dim">None yet.</div> : <ul className="divide-y divide-line">{res.checks.map((c, i) => <li key={i} className="px-4 py-2 text-[12.5px]"><div className="text-fg-muted">{c.key}</div><div className="flex items-center gap-1.5 font-mono text-[12px]"><span className="text-fg-dim line-through">{c.oldValue}</span><ArrowRight className="h-3 w-3 text-fg-dim" /><span className="text-primary">{c.newValue}</span></div></li>)}</ul>}
          </Card>
        </div>
      )}
    </div>
  )
}
