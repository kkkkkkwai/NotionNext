'use client'
import { useCallback, useEffect, useState } from 'react'
import { Dna, RefreshCw, Pencil, Check, X, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, EmptyState, ErrorState, PageHeader, Select, Skeleton, Textarea } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { relativeTime } from '@/lib/utils'

type Section = { key: string; title: string; kind: 'text' | 'list' }
type Dna = { id: string; version: number; data: Record<string, string | string[]>; model: string | null; generatedBy: string | null; createdAt: string }

export function ProjectDnaView({ projectId }: { projectId: string }) {
  const toast = useToast()
  const [dna, setDna] = useState<Dna | null | undefined>(undefined)
  const [versions, setVersions] = useState<{ version: number; createdAt: string; generatedBy: string | null }[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [language, setLanguage] = useState('auto')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api<{ dna: Dna | null; versions: typeof versions; sections: Section[] }>(`/api/projects/${projectId}/dna`)
      setDna(r.dna)
      setVersions(r.versions)
      setSections(r.sections)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
      setDna(null)
    }
  }, [projectId])
  useEffect(() => { load() }, [load])

  const generate = async () => {
    setGenerating(true)
    try {
      await api(`/api/projects/${projectId}/dna`, { method: 'POST', json: { language: language === 'auto' ? undefined : language } })
      toast.success('Project DNA generated')
      await load()
    } catch (e) {
      toast.error('Generation failed', errorMessage(e))
    } finally {
      setGenerating(false)
    }
  }
  const startEdit = (s: Section) => {
    const v = dna?.data[s.key]
    setDraft(Array.isArray(v) ? v.join('\n') : (v as string) ?? '')
    setEditing(s.key)
  }
  const saveEdit = async (s: Section) => {
    setSaving(true)
    try {
      const value = s.kind === 'list' ? draft.split('\n').map((x) => x.replace(/^[-•]\s*/, '').trim()).filter(Boolean) : draft.trim()
      await api(`/api/projects/${projectId}/dna`, { method: 'PATCH', json: { key: s.key, value } })
      setEditing(null)
      await load()
      toast.success('Section saved as new DNA version')
    } catch (e) {
      toast.error('Save failed', errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Single Source of Truth" title="Project DNA" description="20 sections that define what the project is, how it speaks, and what it must never claim. Every generation reads from here." actions={
        <>
          <Select value={language} onChange={(e) => setLanguage(e.target.value)} className="h-9 w-40 py-1.5"><option value="auto">Auto language</option><option value="English">English</option><option value="Chinese">中文</option><option value="Korean">한국어</option><option value="Japanese">日本語</option></Select>
          <Button onClick={generate} loading={generating}><RefreshCw className="h-4 w-4" /> {dna ? 'Regenerate' : 'Generate DNA'}</Button>
        </>
      } />
      {error ? <ErrorState message={error} retry={load} /> : dna === undefined ? <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div> : dna === null ? (
        <EmptyState icon={<Dna className="h-5 w-5" />} title="No Project DNA yet" description={generating ? 'Reading facts, memory and knowledge base… this takes 20–60 seconds.' : 'The AI first builds a Project DNA from your materials — it does not write marketing copy before it understands the project.'} action={<Button onClick={generate} loading={generating}>Generate Project DNA</Button>} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-muted">
            <Badge tone="primary">v{dna.version}</Badge>
            <span>Generated {relativeTime(dna.createdAt)}{dna.model ? ` · ${dna.model}` : ''}{dna.generatedBy && dna.generatedBy !== 'ai' ? ' · edited by user' : ''}</span>
            {versions.length > 1 ? <span className="inline-flex items-center gap-1 text-fg-dim"><History className="h-3.5 w-3.5" /> {versions.length} versions</span> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {sections.map((s) => {
              const v = dna.data[s.key]
              const isEditing = editing === s.key
              const empty = !v || (Array.isArray(v) && v.length === 0)
              const wide = ['project_overview', 'narrative', 'key_facts', 'missing_information'].includes(s.key)
              return (
                <Card key={s.key} className={`group p-4 ${wide ? 'md:col-span-2' : ''} ${s.key === 'restricted_claims' ? 'border-danger/20' : s.key === 'missing_information' ? 'border-warn/20' : ''}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-dim">{s.title}</div>
                    {isEditing ? (
                      <div className="flex gap-1"><button onClick={() => saveEdit(s)} disabled={saving} className="rounded-lg p-1 text-primary hover:bg-white/[0.05]"><Check className="h-3.5 w-3.5" /></button><button onClick={() => setEditing(null)} className="rounded-lg p-1 text-fg-muted hover:bg-white/[0.05]"><X className="h-3.5 w-3.5" /></button></div>
                    ) : <button onClick={() => startEdit(s)} className="rounded-lg p-1 text-fg-dim opacity-0 transition hover:bg-white/[0.05] hover:text-fg group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>}
                  </div>
                  {isEditing ? <Textarea rows={s.kind === 'list' ? 6 : 5} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={s.kind === 'list' ? 'One item per line' : ''} autoFocus /> : empty ? <p className="text-[13px] text-fg-dim">Not available — <button onClick={() => startEdit(s)} className="text-primary hover:underline">add manually</button></p> : Array.isArray(v) ? (
                    <ul className="space-y-1">{v.map((x, i) => <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-fg/90"><span className={s.key === 'restricted_claims' ? 'text-danger' : s.key === 'missing_information' ? 'text-warn' : 'text-primary'}>•</span><span>{x}</span></li>)}</ul>
                  ) : <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg/90">{v as string}</p>}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
