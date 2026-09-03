'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, statusLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Wand2, Copy, Check, Library, AlertTriangle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, ErrorState, Field, Input, PageHeader, Select, Skeleton, Switch, Textarea } from '@/components/ui/primitives'
import { Markdown } from '@/components/ui/markdown'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { cn } from '@/lib/utils'

type Template = { id: string; slug: string; category: string; name: string; contentType: string; objective: string | null; audience: string | null; platform: string | null; structure: string | null; length: string | null; requiredFacts: string[]; taskType: string }
type Cat = { id: string; label: string; zh: string }
const LANGS = [['zh', '中文'], ['en', 'English'], ['ko', '한국어'], ['ja', '日本語'], ['vi', 'Tiếng Việt'], ['th', 'ไทย'], ['ru', 'Русский'], ['es', 'Español']]
const FORMAT_TO_SLUG: Record<string, string> = { tweet: 'social-tweet', thread: 'social-thread', poster: 'poster-overview', video: 'video-60s', article: 'social-medium', ama: 'community-ama' }
const CAT_ZH: Record<string, string> = { foundation: '基础资料', marketing: '营销文案', social: '社媒', poster: '海报文案', video: '视频脚本', community: '社区', pr: '公关稿', kol: 'KOL' }

export function ContentGenerator({ projectId, initialTemplate, initialAngle, initialFormat }: { projectId: string; initialTemplate?: string; initialAngle?: string; initialFormat?: string }) {
  const toast = useToast()
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [cats, setCats] = useState<Cat[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cat, setCat] = useState('social')
  const [selected, setSelected] = useState<Template | null>(null)
  const [language, setLanguage] = useState('zh')
  const [brief, setBrief] = useState('')
  const [angle, setAngle] = useState(initialAngle ?? '')
  const [title, setTitle] = useState('')
  const [tone, setTone] = useState('')
  const [variants, setVariants] = useState(1)
  const [useMemory, setUseMemory] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ item: { id: string; title: string; body: string; contentType: string }; sources: { type: string; label: string }[]; model: string; missing: string[] } | null>(null)
  const [copied, setCopied] = useState(false)
  const [advanced, setAdvanced] = useState(Boolean(initialAngle))

  useEffect(() => {
    api<{ templates: Template[]; categories: Cat[] }>('/api/templates').then((r) => {
      setTemplates(r.templates)
      setCats(r.categories)
      const slug = initialTemplate || (initialFormat ? FORMAT_TO_SLUG[initialFormat] : undefined)
      const t = slug ? r.templates.find((x) => x.slug === slug) : undefined
      if (t) {
        setSelected(t)
        setCat(t.category)
      }
    }).catch((e) => setError(errorMessage(e)))
  }, [initialTemplate, initialFormat])

  const list = useMemo(() => (templates ?? []).filter((t) => t.category === cat), [templates, cat])
  const generate = async () => {
    if (!selected) return
    setLoading(true)
    setResult(null)
    try {
      const r = await api<NonNullable<typeof result>>(`/api/projects/${projectId}/content`, { method: 'POST', json: { templateId: selected.id, language, brief: brief || undefined, angle: angle || undefined, title: title || undefined, tone: tone || undefined, variants, useMemory } })
      setResult(r)
      toast.success('已保存到内容库', r.item.title)
    } catch (e) {
      const msg = errorMessage(e)
      toast.error('生成失败', msg)
      setError(null)
    } finally {
      setLoading(false)
    }
  }
  const copy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.item.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <PageHeader eyebrow="内容引擎" title="内容生成器" description="选择一个模板。AI 会读取项目事实、DNA、记忆、相关知识和近期内容，然后写出符合品牌调性、事实可靠的文案。" />
      {error ? <ErrorState message={error} /> : null}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit">
          <div className="border-b border-line p-2">
            <div className="grid grid-cols-2 gap-1">{cats.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={cn('rounded-lg px-2 py-1.5 text-left text-[12.5px]', cat === c.id ? 'bg-white/[0.08] text-fg' : 'text-fg-muted hover:bg-white/[0.04]')}>{c.zh || CAT_ZH[c.id] || c.label}</button>)}</div>
          </div>
          <div className="max-h-[520px] overflow-y-auto p-1">
            {templates === null ? <div className="space-y-1 p-1">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div> : list.map((t) => (
              <button key={t.id} onClick={() => setSelected(t)} className={cn('flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px]', selected?.id === t.id ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:bg-white/[0.04] hover:text-fg')}>
                <span className="truncate">{t.name}</span><ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </button>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title={selected ? selected.name : '请选择模板'} description={selected ? [selected.objective, selected.length ? `篇幅：${selected.length}` : ''].filter(Boolean).join(' · ') : '模板定义了目标、受众、结构、篇幅和所需事实。'} action={selected ? <div className="flex flex-wrap justify-end gap-1">{selected.requiredFacts.map((f) => <Badge key={f} tone="warn">需要 {f}</Badge>)}<Badge>{lbl(TASK_TYPE_LABELS, selected.taskType)}</Badge></div> : null} />
            <div className="space-y-4 p-5">
              <Field label="想说什么？（可选）" hint="例如：本周上线 Binance Alpha，强调真实需求；或直接留空，AI 会根据项目记忆自动选角度。"><Textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="活动、合作方、CTA、链接、必须提及的事实…" /></Field>
              <button type="button" onClick={() => setAdvanced((v) => !v)} className="text-[12.5px] text-fg-muted hover:text-fg">{advanced ? '收起高级选项 ▴' : '高级选项（语言、角度、语气、多版本）▾'}</button>
              {advanced ? (
                <div className="grid gap-4 rounded-xl border border-line bg-white/[0.02] p-4 sm:grid-cols-2">
                  <Field label="语言"><Select value={language} onChange={(e) => setLanguage(e.target.value)}>{LANGS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Select></Field>
                  <Field label="语气覆盖"><Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="例如：机构风、轻松活泼、degen" /></Field>
                  <Field label="切入角度" hint="留空则由 AI 挑选一个近期未用过的新角度。"><Input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="例如：为什么 DePIN 需要真实需求" /></Field>
                  <Field label="标题"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="内容库中显示的标题" /></Field>
                  <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                    <Switch checked={useMemory} onChange={setUseMemory} label="使用项目记忆" />
                    <label className="flex items-center gap-2 text-[13px] text-fg-muted">版本数<Select value={variants} onChange={(e) => setVariants(Number(e.target.value))} className="h-8 w-20 py-1"><option value={1}>1</option><option value={3}>3</option></Select></label>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-fg-dim">{language === 'zh' ? '中文' : LANGS.find(([c]) => c === language)?.[1]}{useMemory ? ' · 使用项目记忆' : ''}{variants > 1 ? ` · ${variants} 个版本` : ''}</span>
                <Button onClick={generate} loading={loading} disabled={!selected} size="lg"><Wand2 className="h-4 w-4" /> 生成</Button>
              </div>
            </div>
          </Card>
          {loading ? <Card className="p-5"><div className="mb-3 flex items-center gap-2 text-[13px] text-fg-muted"><Wand2 className="h-4 w-4 animate-pulse text-primary" /> 正在读取项目记忆 → 检索知识库 → 撰写中…</div><Skeleton className="h-4 w-3/4" /><Skeleton className="mt-2 h-4 w-full" /><Skeleton className="mt-2 h-4 w-2/3" /></Card> : null}
          {result ? (
            <Card>
              <CardHeader title={result.item.title} description={`${result.item.contentType} · ${result.model}`} action={<div className="flex gap-1"><Button size="sm" variant="secondary" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />} 复制</Button><Link href={`/projects/${projectId}/library/${result.item.id}`}><Button size="sm"><Library className="h-3.5 w-3.5" /> 在编辑器中打开</Button></Link></div>} />
              <div className="p-5"><Markdown>{result.item.body}</Markdown></div>
              {result.missing.length ? <div className="mx-5 mb-4 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/[0.06] px-3 py-2 text-[12.5px] text-warn"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>AI 拒绝编造的缺失信息：{result.missing.join(' · ')}。请到<Link href={`/projects/${projectId}/memory`} className="underline">记忆</Link>中补充。</span></div> : null}
              <div className="border-t border-line px-5 py-3 text-[11.5px] text-fg-dim">上下文：{result.sources.filter((s) => s.type === 'fact').length} 条事实 · {result.sources.filter((s) => s.type === 'memory').length} 条记忆 · {result.sources.filter((s) => s.type === 'chunk').length} 个知识片段</div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
