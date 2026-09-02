'use client'
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
const LANGS = [['en', 'English'], ['zh', '中文'], ['ko', '한국어'], ['ja', '日本語'], ['vi', 'Tiếng Việt'], ['th', 'ไทย'], ['ru', 'Русский'], ['es', 'Español']]
const FORMAT_TO_SLUG: Record<string, string> = { tweet: 'social-tweet', thread: 'social-thread', poster: 'poster-overview', video: 'video-60s', article: 'social-medium', ama: 'community-ama' }

export function ContentGenerator({ projectId, initialTemplate, initialAngle, initialFormat }: { projectId: string; initialTemplate?: string; initialAngle?: string; initialFormat?: string }) {
  const toast = useToast()
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [cats, setCats] = useState<Cat[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cat, setCat] = useState('social')
  const [selected, setSelected] = useState<Template | null>(null)
  const [language, setLanguage] = useState('en')
  const [brief, setBrief] = useState('')
  const [angle, setAngle] = useState(initialAngle ?? '')
  const [title, setTitle] = useState('')
  const [tone, setTone] = useState('')
  const [variants, setVariants] = useState(1)
  const [useMemory, setUseMemory] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ item: { id: string; title: string; body: string; contentType: string }; sources: { type: string; label: string }[]; model: string; missing: string[] } | null>(null)
  const [copied, setCopied] = useState(false)

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
      toast.success('Saved to Content Library', r.item.title)
    } catch (e) {
      const msg = errorMessage(e)
      toast.error('Generation failed', msg)
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
      <PageHeader eyebrow="Content Engine" title="Content Generator" description="Pick a template. The AI reads project facts, DNA, memory, relevant knowledge and recent content — then writes on-brand, fact-safe copy." />
      {error ? <ErrorState message={error} /> : null}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit">
          <div className="border-b border-line p-2">
            <div className="grid grid-cols-2 gap-1">{cats.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={cn('rounded-lg px-2 py-1.5 text-left text-[12.5px]', cat === c.id ? 'bg-white/[0.08] text-fg' : 'text-fg-muted hover:bg-white/[0.04]')}>{c.label}<span className="ml-1 text-[10px] text-fg-dim">{c.zh}</span></button>)}</div>
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
            <CardHeader title={selected ? selected.name : 'Select a template'} description={selected ? [selected.objective, selected.length ? `Length: ${selected.length}` : ''].filter(Boolean).join(' · ') : 'Templates define objective, audience, structure, length and required facts.'} action={selected ? <div className="flex flex-wrap justify-end gap-1">{selected.requiredFacts.map((f) => <Badge key={f} tone="warn">requires {f}</Badge>)}<Badge>{selected.taskType.replace('_', ' ')}</Badge></div> : null} />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Language"><Select value={language} onChange={(e) => setLanguage(e.target.value)}>{LANGS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Select></Field>
              <Field label="Tone override (optional)"><Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="e.g. institutional, playful, degen" /></Field>
              <Field label="Angle (optional)" hint="Leave empty and the AI picks a fresh angle not used recently."><Input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="e.g. Why DePIN needs real demand" /></Field>
              <Field label="Title (optional)"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Library title" /></Field>
              <Field label="Brief (optional)" className="sm:col-span-2"><Textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Anything specific: event, partner, CTA, link, must-mention facts…" /></Field>
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                <Switch checked={useMemory} onChange={setUseMemory} label="Use Project Memory" />
                <label className="flex items-center gap-2 text-[13px] text-fg-muted">Versions<Select value={variants} onChange={(e) => setVariants(Number(e.target.value))} className="h-8 w-20 py-1"><option value={1}>1</option><option value={3}>3</option></Select></label>
                <div className="flex-1" />
                <Button onClick={generate} loading={loading} disabled={!selected}><Wand2 className="h-4 w-4" /> Generate</Button>
              </div>
            </div>
          </Card>
          {loading ? <Card className="p-5"><div className="mb-3 flex items-center gap-2 text-[13px] text-fg-muted"><Wand2 className="h-4 w-4 animate-pulse text-primary" /> Reading project memory → searching knowledge base → writing…</div><Skeleton className="h-4 w-3/4" /><Skeleton className="mt-2 h-4 w-full" /><Skeleton className="mt-2 h-4 w-2/3" /></Card> : null}
          {result ? (
            <Card>
              <CardHeader title={result.item.title} description={`${result.item.contentType} · ${result.model}`} action={<div className="flex gap-1"><Button size="sm" variant="secondary" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />} Copy</Button><Link href={`/projects/${projectId}/library/${result.item.id}`}><Button size="sm"><Library className="h-3.5 w-3.5" /> Open in editor</Button></Link></div>} />
              <div className="p-5"><Markdown>{result.item.body}</Markdown></div>
              {result.missing.length ? <div className="mx-5 mb-4 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/[0.06] px-3 py-2 text-[12.5px] text-warn"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>Missing information the AI refused to invent: {result.missing.join(' · ')}. Add these in <Link href={`/projects/${projectId}/memory`} className="underline">Memory</Link>.</span></div> : null}
              <div className="border-t border-line px-5 py-3 text-[11.5px] text-fg-dim">Context: {result.sources.filter((s) => s.type === 'fact').length} facts · {result.sources.filter((s) => s.type === 'memory').length} memories · {result.sources.filter((s) => s.type === 'chunk').length} knowledge chunks</div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
