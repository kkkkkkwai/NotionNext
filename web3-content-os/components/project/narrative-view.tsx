'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, statusLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, RefreshCw, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { relativeTime } from '@/lib/utils'

type N = { id: string; version: number; createdAt: string; model: string | null; data: { chain: { stage: string; text: string }[]; core_narrative: string; investor_narrative: string; community_narrative: string; institutional_narrative: string; user_narrative: string; technical_narrative: string; primary_themes: { title: string; description: string }[]; secondary_themes: { theme: string; title: string; description: string }[]; content_angles: { angle: string; theme: string; format: string }[] } }
type Tab = 'core' | 'investor' | 'community' | 'institutional' | 'user' | 'technical'

export function NarrativeView({ projectId }: { projectId: string }) {
  const toast = useToast()
  const [n, setN] = useState<N | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [gen, setGen] = useState(false)
  const [tab, setTab] = useState<Tab>('core')
  const load = useCallback(async () => {
    try {
      const r = await api<{ narrative: N | null }>(`/api/projects/${projectId}/narrative`)
      setN(r.narrative)
    } catch (e) {
      setError(errorMessage(e))
      setN(null)
    }
  }, [projectId])
  useEffect(() => { load() }, [load])
  const generate = async () => {
    setGen(true)
    try {
      await api(`/api/projects/${projectId}/narrative`, { method: 'POST', json: {} })
      toast.success('叙事体系已生成')
      await load()
    } catch (e) {
      toast.error('生成失败', errorMessage(e))
    } finally {
      setGen(false)
    }
  }
  const d = n?.data
  const narrativeText: Record<Tab, string | undefined> = { core: d?.core_narrative, investor: d?.investor_narrative, community: d?.community_narrative, institutional: d?.institutional_narrative, user: d?.user_narrative, technical: d?.technical_narrative }
  return (
    <div>
      <PageHeader eyebrow="叙事引擎" title="项目叙事" description="趋势 → 问题 → 为什么是现在 → 解决方案 → 增长 → Token 价值 → 愿景。另外包含 5 个核心主题、20 个子主题和 50 个内容角度，供生成器轮换使用。" actions={<Button onClick={generate} loading={gen}><RefreshCw className="h-4 w-4" /> {n ? '重新生成' : '构建叙事'}</Button>} />
      {error ? <ErrorState message={error} retry={load} /> : n === undefined ? <Skeleton className="h-64" /> : n === null ? (
        <EmptyState icon={<Sparkles className="h-5 w-5" />} title="尚未生成叙事" description={gen ? '正在构建叙事链、六类受众叙事以及 75 个主题/角度… 预计 30–90 秒。' : '需要先有项目 DNA。叙事引擎会把你的 DNA 转化为整个内容系统可复用的故事架构。'} action={<Button onClick={generate} loading={gen}>构建叙事</Button>} />
      ) : (
        <div className="space-y-4">
          <div className="text-[12.5px] text-fg-muted"><Badge tone="primary">v{n.version}</Badge> <span className="ml-2">生成于 {relativeTime(n.createdAt)}{n.model ? ` · ${n.model}` : ''}</span></div>
          {d?.chain?.length ? (
            <Card className="p-5">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-dim">叙事链</div>
              <ol className="grid gap-3 md:grid-cols-3">{d.chain.map((c, i) => <li key={i} className="rounded-xl border border-line bg-white/[0.02] p-3"><div className="mb-1 flex items-center gap-2 text-[12px] font-medium text-primary"><span className="font-mono text-fg-dim">{String(i + 1).padStart(2, '0')}</span>{c.stage}</div><p className="text-[12.5px] leading-relaxed text-fg-muted">{c.text}</p></li>)}</ol>
            </Card>
          ) : null}
          <Card>
            <div className="border-b border-line px-4 pt-4"><Tabs tabs={[{ id: 'core', label: '核心叙事' }, { id: 'investor', label: '投资人' }, { id: 'community', label: '社区' }, { id: 'institutional', label: '机构' }, { id: 'user', label: '用户' }, { id: 'technical', label: '技术' }]} value={tab} onChange={setTab} className="mb-4 inline-flex" /></div>
            <p className="whitespace-pre-wrap p-5 text-[14px] leading-relaxed text-fg/90">{narrativeText[tab] || '暂无内容。'}</p>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="核心主题" description={`${d?.primary_themes?.length ?? 0} 个支柱主题`} />
              <ul className="divide-y divide-line">{(d?.primary_themes ?? []).map((t, i) => <li key={i} className="px-5 py-3"><div className="text-[13.5px] font-medium text-fg">{t.title}</div><div className="text-[12.5px] text-fg-muted">{t.description}</div><div className="mt-1.5 flex flex-wrap gap-1">{(d?.secondary_themes ?? []).filter((s) => s.theme === t.title).map((s, j) => <Badge key={j}>{s.title}</Badge>)}</div></li>)}</ul>
            </Card>
            <Card>
              <CardHeader title="内容角度" description={`${d?.content_angles?.length ?? 0} 个切入点——点击即可生成`} />
              <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">{(d?.content_angles ?? []).map((a, i) => <li key={i}><Link href={`/projects/${projectId}/generate?angle=${encodeURIComponent(a.angle)}&format=${lbl(FORMAT_LABELS, a.format)}`} className="flex items-center gap-3 px-5 py-2.5 text-[13px] hover:bg-white/[0.03]"><span className="flex-1 text-fg/90">{a.angle}</span><Badge>{lbl(FORMAT_LABELS, a.format)}</Badge><Wand2 className="h-3.5 w-3.5 text-fg-dim" /></Link></li>)}</ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
