'use client'
import { useCallback, useEffect, useState } from 'react'
import { Upload, Link2, FileText, Globe, Trash2, RefreshCw, Search, Sparkles, AlignLeft, BookOpen, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, EmptyState, ErrorState, Field, Input, PageHeader, Skeleton, Textarea } from '@/components/ui/primitives'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { JobProgress } from '@/components/project/job-progress'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { relativeTime, formatNumber } from '@/lib/utils'

type Source = { id: string; type: string; name: string; url: string | null; status: string; error: string | null; chunkCount: number; charCount: number; size: number | null; createdAt: string; meta: Record<string, unknown> }
type Hit = { id: string; content: string; sourceName: string; page: number | null; section: string | null; score: number }

export function KnowledgeBase({ projectId }: { projectId: string }) {
  const toast = useToast()
  const [sources, setSources] = useState<Source[] | null>(null)
  const [stats, setStats] = useState<{ sources: number; chunks: number; chars: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [textName, setTextName] = useState('')
  const [textOpen, setTextOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null)
  const [del, setDel] = useState<Source | null>(null)
  const [drag, setDrag] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api<{ sources: Source[]; stats: typeof stats }>(`/api/projects/${projectId}/sources`)
      setSources(r.sources)
      setStats(r.stats)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [projectId])
  useEffect(() => { load() }, [load])

  const startIngest = async (ids: string[], generateDna: boolean) => {
    try {
      const { job } = await api<{ job: { id: string } }>(`/api/projects/${projectId}/ingest`, { method: 'POST', json: { sourceIds: ids, generateDna } })
      setJobId(job.id)
    } catch (e) {
      toast.error('Could not start AI reading', errorMessage(e))
    }
  }

  const upload = async (files: File[]) => {
    if (!files.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      files.forEach((f) => fd.append('files', f))
      const r = await api<{ sources: Source[] }>(`/api/projects/${projectId}/sources`, { method: 'POST', body: fd })
      await load()
      await startIngest(r.sources.map((s) => s.id), false)
    } catch (e) {
      toast.error('Upload failed', errorMessage(e))
    } finally {
      setUploading(false)
    }
  }
  const addUrl = async () => {
    if (!url.trim()) return
    setUploading(true)
    try {
      const r = await api<{ sources: Source[] }>(`/api/projects/${projectId}/sources`, { method: 'POST', json: { url } })
      setUrl('')
      await load()
      await startIngest(r.sources.map((s) => s.id), false)
    } catch (e) {
      toast.error('Could not add URL', errorMessage(e))
    } finally {
      setUploading(false)
    }
  }
  const addText = async () => {
    if (!text.trim()) return
    setUploading(true)
    try {
      const r = await api<{ sources: Source[] }>(`/api/projects/${projectId}/sources`, { method: 'POST', json: { text, name: textName } })
      setText('')
      setTextName('')
      setTextOpen(false)
      await load()
      await startIngest(r.sources.map((s) => s.id), false)
    } catch (e) {
      toast.error('Could not add text', errorMessage(e))
    } finally {
      setUploading(false)
    }
  }
  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const r = await api<{ hits: Hit[] }>(`/api/projects/${projectId}/knowledge/search`, { method: 'POST', json: { query, limit: 6 } })
      setHits(r.hits)
    } catch (e) {
      toast.error('Search failed', errorMessage(e))
    } finally {
      setSearching(false)
    }
  }
  const openPreview = async (s: Source) => {
    try {
      const r = await api<{ text: string }>(`/api/projects/${projectId}/sources/${s.id}`)
      setPreview({ name: s.name, text: r.text || '(no text extracted yet)' })
    } catch (e) {
      toast.error('Could not load', errorMessage(e))
    }
  }
  const icon = (t: string) => (t === 'url' || t === 'gitbook' ? <Globe className="h-4 w-4" /> : t === 'text' || t === 'manual' ? <AlignLeft className="h-4 w-4" /> : <FileText className="h-4 w-4" />)
  const pending = (sources ?? []).filter((s) => s.status !== 'ready')

  return (
    <div>
      <PageHeader eyebrow="Project" title="Knowledge Base" description="Everything the AI knows about this project. Upload → parse → chunk → embed → project-scoped vector search." actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => startIngest(pending.length ? pending.map((s) => s.id) : (sources ?? []).map((s) => s.id), true)} disabled={!sources?.length}><Sparkles className="h-3.5 w-3.5" /> {pending.length ? `Read ${pending.length} pending & rebuild DNA` : 'Re-read all & rebuild DNA'}</Button>
        </>
      } />
      {jobId ? <div className="mb-5"><JobProgress projectId={projectId} jobId={jobId} title="AI is reading your materials" onDone={(j) => { load(); if (j.status === 'completed') toast.success('Knowledge base updated') }} /></div> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); upload(Array.from(e.dataTransfer.files)) }}
            className={`card flex flex-col items-center justify-center border-dashed px-4 py-8 text-center transition ${drag ? 'border-primary/60 bg-primary/[0.04]' : ''}`}
          >
            <Upload className="mb-2 h-5 w-5 text-fg-muted" />
            <div className="text-[13.5px] text-fg">Drop files here</div>
            <div className="mt-1 text-[12px] text-fg-dim">PDF · DOCX · PPTX · TXT · MD (max 25MB each)</div>
            <label className="mt-3"><span className="inline-flex h-8 cursor-pointer items-center rounded-xl border border-line bg-white/[0.04] px-3 text-[13px] text-fg hover:bg-white/[0.07]">{uploading ? 'Uploading…' : 'Choose files'}</span><input type="file" multiple className="hidden" accept=".pdf,.docx,.pptx,.txt,.md,.markdown" onChange={(e) => upload(Array.from(e.target.files ?? []))} disabled={uploading} /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex gap-2"><Input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addUrl()} placeholder="Website or GitBook URL — https://docs.yourproject.xyz" /><Button variant="secondary" onClick={addUrl} loading={uploading}><Link2 className="h-4 w-4" /> Add</Button></div>
            <Button variant="secondary" onClick={() => setTextOpen(true)}><AlignLeft className="h-4 w-4" /> Paste text</Button>
          </div>
          <Card>
            <CardHeader title="Sources" description={stats ? `${stats.sources} sources · ${stats.chunks} chunks · ${formatNumber(stats.chars)} characters` : undefined} />
            {error ? <div className="p-4"><ErrorState message={error} retry={load} /></div> : sources === null ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : sources.length === 0 ? (
              <div className="p-4"><EmptyState icon={<BookOpen className="h-5 w-5" />} title="No materials yet" description="Upload the whitepaper, pitch deck, tokenomics or paste your website URL. The AI extracts facts and builds the Project DNA from them." /></div>
            ) : (
              <ul className="divide-y divide-line">
                {sources.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="text-fg-muted">{icon(s.type)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] text-fg">{s.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-fg-dim">
                        <span className="uppercase">{s.type}</span>
                        <span>{relativeTime(s.createdAt)}</span>
                        {s.status === 'ready' ? <span>{s.chunkCount} chunks · {formatNumber(s.charCount)} chars{(s.meta as { localEmbedding?: boolean }).localEmbedding ? ' · local embedding' : ''}</span> : null}
                        {s.error ? <span className="text-danger">{s.error}</span> : null}
                      </div>
                    </div>
                    <Badge tone={s.status === 'ready' ? 'primary' : s.status === 'failed' ? 'danger' : s.status === 'processing' ? 'info' : 'warn'}>{s.status}</Badge>
                    <div className="flex items-center gap-1">
                      <button title="Preview text" onClick={() => openPreview(s)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg"><Eye className="h-3.5 w-3.5" /></button>
                      <button title="Re-read" onClick={() => startIngest([s.id], false)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg"><RefreshCw className="h-3.5 w-3.5" /></button>
                      <button title="Delete" onClick={() => setDel(s)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Test retrieval" description="What the AI would find for a question" />
            <div className="space-y-3 p-4">
              <div className="flex gap-2"><Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="e.g. What is the total supply?" /><Button size="md" variant="secondary" onClick={search} loading={searching}><Search className="h-4 w-4" /></Button></div>
              {hits === null ? <p className="text-[12px] text-fg-dim">Vector search is restricted to this project only.</p> : hits.length === 0 ? <p className="text-[12.5px] text-fg-muted">No matching chunks.</p> : (
                <ul className="space-y-2">{hits.map((h) => <li key={h.id} className="rounded-xl border border-line bg-white/[0.02] p-3"><div className="mb-1 flex items-center justify-between text-[11px] text-fg-dim"><span className="truncate">{h.sourceName}{h.page ? ` · p.${h.page}` : ''}</span><span>{(h.score * 100).toFixed(0)}%</span></div><p className="line-clamp-5 text-[12.5px] leading-relaxed text-fg-muted">{h.content}</p></li>)}</ul>
              )}
            </div>
          </Card>
          <Card className="p-4 text-[12.5px] text-fg-muted">
            <div className="mb-1 font-medium text-fg">How the pipeline works</div>
            Upload → Parse → Clean → Chunk (~1200 chars, overlap) → Embedding → pgvector → project-scoped RAG. Facts extracted from documents are stored with source and page so you can always trace where a number came from.
          </Card>
        </div>
      </div>
      <Dialog open={textOpen} onClose={() => setTextOpen(false)} title="Paste text" description="Tokenomics, funding, partners, product notes…" footer={<><Button variant="ghost" onClick={() => setTextOpen(false)}>Cancel</Button><Button onClick={addText} loading={uploading}>Add to knowledge base</Button></>}>
        <div className="space-y-3"><Field label="Name"><Input value={textName} onChange={(e) => setTextName(e.target.value)} placeholder="e.g. Tokenomics v3" /></Field><Field label="Text"><Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} /></Field></div>
      </Dialog>
      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.name} size="xl"><pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-fg-muted">{preview?.text.slice(0, 60000)}</pre></Dialog>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`Delete "${del?.name}"?`} description="Its chunks are removed from the knowledge base. Facts already extracted stay in Memory." confirmLabel="Delete" danger onConfirm={async () => { if (!del) return; await api(`/api/projects/${projectId}/sources/${del.id}`, { method: 'DELETE' }); load() }} />
    </div>
  )
}
