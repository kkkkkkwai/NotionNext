'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, statusLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, Textarea } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'

type Finding = { level: 'high' | 'medium' | 'low'; phrase: string; reason: string; suggestion?: string }
type Row = { contentId: string; title: string; contentType: string; score: string; findings: Finding[] }

const levelLabel: Record<string, string> = { high: '高风险', medium: '中风险', low: '低风险', clean: '无风险' }

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
      toast.error('扫描失败', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const rewrite = async (id: string) => {
    setBusy(id)
    try {
      await api(`/api/projects/${projectId}/risk`, { method: 'POST', json: { contentId: id, rewrite: true } })
      toast.success('已安全改写', '新版本已保存。')
      load()
    } catch (e) {
      toast.error('改写失败', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const tone = (l: string) => (l === 'high' ? 'danger' : l === 'medium' ? 'warn' : 'neutral') as 'danger' | 'warn' | 'neutral'
  const Findings = ({ findings }: { findings: Finding[] }) => <ul className="space-y-1">{findings.map((f, i) => <li key={i} className="flex flex-wrap items-start gap-2 text-[12.5px]"><Badge tone={tone(f.level)}>{levelLabel[f.level] ?? f.level}</Badge><span className="text-fg">“{f.phrase}”</span><span className="text-fg-muted">— {f.reason}{f.suggestion ? ` · ${f.suggestion}` : ''}</span></li>)}</ul>
  return (
    <div>
      <PageHeader eyebrow="工具" title="风险检查" description="Web3 合规扫描：保证收益、稳赚/保本、价格预测，以及未经核实的交易所、合作方、投资人、审计和融资数据 — 与已确认的项目事实交叉核对。" actions={<Button variant="secondary" size="sm" onClick={load}><ShieldCheck className="h-3.5 w-3.5" /> 重新扫描内容库</Button>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {error ? <ErrorState message={error} retry={load} /> : rows === null ? <><Skeleton className="h-16" /><Skeleton className="h-16" /></> : rows.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-5 w-5 text-primary" />} title={`${scanned} 条内容中未发现风险表述`} description="内容库中的所有内容均通过词汇 + 事实交叉核对。" /> : (
            <>
              <div className="text-[13px] text-fg-muted">{scanned} 条内容中有 {rows.length} 条被标记 · <span className="text-danger">高风险 {rows.filter((r) => r.score === 'high').length}</span> · <span className="text-warn">中风险 {rows.filter((r) => r.score === 'medium').length}</span> · 低风险 {rows.filter((r) => r.score === 'low').length}</div>
              {[...rows].sort((a, b) => ['high', 'medium', 'low'].indexOf(a.score) - ['high', 'medium', 'low'].indexOf(b.score)).map((r) => (
                <Card key={r.contentId} className={r.score === 'high' ? 'border-danger/30' : r.score === 'medium' ? 'border-warn/30' : ''}>
                  <CardHeader title={<span className="flex items-center gap-2"><Badge tone={tone(r.score)}>{levelLabel[r.score] ?? r.score}</Badge><Link href={`/projects/${projectId}/library/${r.contentId}`} className="hover:text-primary">{r.title}</Link><Badge>{contentTypeLabel(r.contentType)}</Badge></span>} action={<Button size="xs" variant="secondary" loading={busy === r.contentId} onClick={() => rewrite(r.contentId)}>安全改写</Button>} />
                  <div className="p-4"><Findings findings={r.findings} /></div>
                </Card>
              ))}
            </>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader title="检查任意文本" description="发布前粘贴草稿进行检查" />
          <div className="space-y-3 p-4">
            <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="粘贴推文、帖子或文章…" />
            <Button className="w-full" variant="secondary" onClick={scanText} loading={busy === 'text'} disabled={!text.trim()}>扫描</Button>
            {adhoc ? adhoc.findings.length === 0 ? <div className="flex items-center gap-2 text-[13px] text-primary"><CheckCircle2 className="h-4 w-4" /> 无风险</div> : <div><div className="mb-2"><Badge tone={tone(adhoc.score)}>{levelLabel[adhoc.score] ?? adhoc.score}</Badge></div><Findings findings={adhoc.findings} /></div> : null}
          </div>
        </Card>
      </div>
    </div>
  )
}
