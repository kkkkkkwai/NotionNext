'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, Textarea } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'

type Finding = { level: 'high' | 'medium' | 'low'; phrase: string; reason: string; suggestion?: string }
type Row = { contentId: string; title: string; contentType: string; score: string; findings: Finding[] }

export function RiskCheck({ projectId }: { projectId: string }) {
  const toast = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [scanned, setScanned] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [adhoc, setAdhoc] = useState<{ findings: Finding[]; score: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => {
    setRows(null)
    try {
      const r = await api<{ scanned: number; results: Row[] }>(`/api/projects/${projectId}/risk`)
      setRows(r.results)
      setScanned(r.scanned)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [projectId])
  useEffect(() => { load() }, [load])
  const scanText = async () => {
    setBusy('text')
    try {
      setAdhoc(await api(`/api/projects/${projectId}/risk`, { method: 'POST', json: { text } }))
    } catch (e) {
      toast.error('Scan failed', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const rewrite = async (id: string) => {
    setBusy(id)
    try {
      await api(`/api/projects/${projectId}/risk`, { method: 'POST', json: { contentId: id, rewrite: true } })
      toast.success('Rewritten safely', 'A new version was saved.')
      load()
    } catch (e) {
      toast.error('Rewrite failed', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const tone = (l: string) => (l === 'high' ? 'danger' : l === 'medium' ? 'warn' : 'neutral') as 'danger' | 'warn' | 'neutral'
  const Findings = ({ findings }: { findings: Finding[] }) => <ul className="space-y-1">{findings.map((f, i) => <li key={i} className="flex flex-wrap items-start gap-2 text-[12.5px]"><Badge tone={tone(f.level)}>{f.level}</Badge><span className="text-fg">“{f.phrase}”</span><span className="text-fg-muted">— {f.reason}{f.suggestion ? ` · ${f.suggestion}` : ''}</span></li>)}</ul>
  return (
    <div>
      <PageHeader eyebrow="Tools" title="Risk Check" description="Web3 compliance scan: guaranteed returns, 稳赚/保本, price predictions, unverified exchanges, partners, investors, audits and funding numbers — cross-checked against confirmed Project Facts." actions={<Button variant="secondary" size="sm" onClick={load}><ShieldCheck className="h-3.5 w-3.5" /> Rescan library</Button>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {error ? <ErrorState message={error} retry={load} /> : rows === null ? <><Skeleton className="h-16" /><Skeleton className="h-16" /></> : rows.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-5 w-5 text-primary" />} title={`No risky claims in ${scanned} content items`} description="Everything in the library passes the lexical + fact cross-check." /> : (
            <>
              <div className="text-[13px] text-fg-muted">{rows.length} of {scanned} items flagged · <span className="text-danger">{rows.filter((r) => r.score === 'high').length} high</span> · <span className="text-warn">{rows.filter((r) => r.score === 'medium').length} medium</span> · {rows.filter((r) => r.score === 'low').length} low</div>
              {[...rows].sort((a, b) => ['high', 'medium', 'low'].indexOf(a.score) - ['high', 'medium', 'low'].indexOf(b.score)).map((r) => (
                <Card key={r.contentId} className={r.score === 'high' ? 'border-danger/30' : r.score === 'medium' ? 'border-warn/30' : ''}>
                  <CardHeader title={<span className="flex items-center gap-2"><Badge tone={tone(r.score)}>{r.score} risk</Badge><Link href={`/projects/${projectId}/library/${r.contentId}`} className="hover:text-primary">{r.title}</Link><Badge>{r.contentType}</Badge></span>} action={<Button size="xs" variant="secondary" loading={busy === r.contentId} onClick={() => rewrite(r.contentId)}>Rewrite Safely</Button>} />
                  <div className="p-4"><Findings findings={r.findings} /></div>
                </Card>
              ))}
            </>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader title="Check any text" description="Paste a draft before publishing" />
          <div className="space-y-3 p-4">
            <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a tweet, post or article…" />
            <Button className="w-full" variant="secondary" onClick={scanText} loading={busy === 'text'} disabled={!text.trim()}>Scan</Button>
            {adhoc ? adhoc.findings.length === 0 ? <div className="flex items-center gap-2 text-[13px] text-primary"><CheckCircle2 className="h-4 w-4" /> Clean</div> : <div><div className="mb-2"><Badge tone={tone(adhoc.score)}>{adhoc.score} risk</Badge></div><Findings findings={adhoc.findings} /></div> : null}
          </div>
        </Card>
      </div>
    </div>
  )
}
