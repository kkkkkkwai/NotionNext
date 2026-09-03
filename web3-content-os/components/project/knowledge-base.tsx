'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, statusLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
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

const STATUS_LABELS: Record<string, string> = { pending: '待处理', processing: '处理中', ready: '已就绪', failed: '失败' }

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
      toast.error('无法启动 AI 阅读', errorMessage(e))
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
      toast.error('上传失败', errorMessage(e))
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
      toast.error('无法添加 URL', errorMessage(e))
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
      toast.error('无法添加文本', errorMessage(e))
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
      toast.error('检索失败', errorMessage(e))
    } finally {
      setSearching(false)
    }
  }
  const openPreview = async (s: Source) => {
    try {
      const r = await api<{ text: string }>(`/api/projects/${projectId}/sources/${s.id}`)
      setPreview({ name: s.name, text: r.text || '（尚未提取到文本）' })
    } catch (e) {
      toast.error('加载失败', errorMessage(e))
    }
  }
  const icon = (t: string) => (t === 'url' || t === 'gitbook' ? <Globe className="h-4 w-4" /> : t === 'text' || t === 'manual' ? <AlignLeft className="h-4 w-4" /> : <FileText className="h-4 w-4" />)
  const pending = (sources ?? []).filter((s) => s.status !== 'ready')

  return (
    <div>
      <PageHeader eyebrow="项目" title="知识库" description="AI 对这个项目的全部认知。上传 → 解析 → 切片 → 向量化 → 仅限本项目的向量检索。" actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => startIngest(pending.length ? pending.map((s) => s.id) : (sources ?? []).map((s) => s.id), true)} disabled={!sources?.length}><Sparkles className="h-3.5 w-3.5" /> {pending.length ? `阅读 ${pending.length} 个待处理来源并重建 DNA` : '重新阅读全部并重建 DNA'}</Button>
        </>
      } />
      {jobId ? <div className="mb-5"><JobProgress projectId={projectId} jobId={jobId} title="AI 正在阅读你的资料" onDone={(j) => { load(); if (j.status === 'completed') toast.success('知识库已更新') }} /></div> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); upload(Array.from(e.dataTransfer.files)) }}
            className={`card flex flex-col items-center justify-center border-dashed px-4 py-8 text-center transition ${drag ? 'border-primary/60 bg-primary/[0.04]' : ''}`}
          >
            <Upload className="mb-2 h-5 w-5 text-fg-muted" />
            <div className="text-[13.5px] text-fg">将文件拖拽到此处</div>
            <div className="mt-1 text-[12px] text-fg-dim">PDF · DOCX · PPTX · TXT · MD（单个文件最大 25MB）</div>
            <label className="mt-3"><span className="inline-flex h-8 cursor-pointer items-center rounded-xl border border-line bg-white/[0.04] px-3 text-[13px] text-fg hover:bg-white/[0.07]">{uploading ? '上传中…' : '选择文件'}</span><input type="file" multiple className="hidden" accept=".pdf,.docx,.pptx,.txt,.md,.markdown" onChange={(e) => upload(Array.from(e.target.files ?? []))} disabled={uploading} /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex gap-2"><Input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addUrl()} placeholder="官网或 GitBook URL — https://docs.yourproject.xyz" /><Button variant="secondary" onClick={addUrl} loading={uploading}><Link2 className="h-4 w-4" /> 添加</Button></div>
            <Button variant="secondary" onClick={() => setTextOpen(true)}><AlignLeft className="h-4 w-4" /> 粘贴文本</Button>
          </div>
          <Card>
            <CardHeader title="资料来源" description={stats ? `${stats.sources} 个来源 · ${stats.chunks} 个片段 · ${formatNumber(stats.chars)} 字符` : undefined} />
            {error ? <div className="p-4"><ErrorState message={error} retry={load} /></div> : sources === null ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : sources.length === 0 ? (
              <div className="p-4"><EmptyState icon={<BookOpen className="h-5 w-5" />} title="暂无资料" description="上传白皮书、路演稿、代币经济文档，或粘贴官网 URL。AI 会从中提取事实并构建项目 DNA。" /></div>
            ) : (
              <ul className="divide-y divide-line">
                {sources.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="text-fg-muted">{icon(s.type)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] text-fg">{s.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-fg-dim">
                        <span className="uppercase">{lbl(SOURCE_TYPE_LABELS, s.type)}</span>
                        <span>{relativeTime(s.createdAt)}</span>
                        {s.status === 'ready' ? <span>{s.chunkCount} 个片段 · {formatNumber(s.charCount)} 字符{(s.meta as { localEmbedding?: boolean }).localEmbedding ? ' · 本地向量化' : ''}</span> : null}
                        {s.error ? <span className="text-danger">{s.error}</span> : null}
                      </div>
                    </div>
                    <Badge tone={s.status === 'ready' ? 'primary' : s.status === 'failed' ? 'danger' : s.status === 'processing' ? 'info' : 'warn'}>{STATUS_LABELS[s.status] ?? s.status}</Badge>
                    <div className="flex items-center gap-1">
                      <button title="预览文本" onClick={() => openPreview(s)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg"><Eye className="h-3.5 w-3.5" /></button>
                      <button title="重新阅读" onClick={() => startIngest([s.id], false)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg"><RefreshCw className="h-3.5 w-3.5" /></button>
                      <button title="删除" onClick={() => setDel(s)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="检索测试" description="看看 AI 针对某个问题会找到什么" />
            <div className="space-y-3 p-4">
              <div className="flex gap-2"><Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="例如：Token 总量是多少？" /><Button size="md" variant="secondary" onClick={search} loading={searching}><Search className="h-4 w-4" /></Button></div>
              {hits === null ? <p className="text-[12px] text-fg-dim">向量检索仅限于本项目范围。</p> : hits.length === 0 ? <p className="text-[12.5px] text-fg-muted">没有匹配的片段。</p> : (
                <ul className="space-y-2">{hits.map((h) => <li key={h.id} className="rounded-xl border border-line bg-white/[0.02] p-3"><div className="mb-1 flex items-center justify-between text-[11px] text-fg-dim"><span className="truncate">{h.sourceName}{h.page ? ` · 第 ${h.page} 页` : ''}</span><span>{(h.score * 100).toFixed(0)}%</span></div><p className="line-clamp-5 text-[12.5px] leading-relaxed text-fg-muted">{h.content}</p></li>)}</ul>
              )}
            </div>
          </Card>
          <Card className="p-4 text-[12.5px] text-fg-muted">
            <div className="mb-1 font-medium text-fg">处理流程</div>
            上传 → 解析 → 清洗 → 切片（约 1200 字符，带重叠）→ 向量化 → pgvector → 仅限本项目的 RAG 检索。从文档中提取的事实会记录来源和页码，任何数字都可以追溯出处。
          </Card>
        </div>
      </div>
      <Dialog open={textOpen} onClose={() => setTextOpen(false)} title="粘贴文本" description="代币经济、融资、合作伙伴、产品说明…" footer={<><Button variant="ghost" onClick={() => setTextOpen(false)}>取消</Button><Button onClick={addText} loading={uploading}>添加到知识库</Button></>}>
        <div className="space-y-3"><Field label="名称"><Input value={textName} onChange={(e) => setTextName(e.target.value)} placeholder="例如：代币经济 v3" /></Field><Field label="文本"><Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} /></Field></div>
      </Dialog>
      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.name} size="xl"><pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-fg-muted">{preview?.text.slice(0, 60000)}</pre></Dialog>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`删除「${del?.name}」？`} description="其片段将从知识库中移除；已提取的事实仍保留在项目记忆中。" confirmLabel="删除" danger onConfirm={async () => { if (!del) return; await api(`/api/projects/${projectId}/sources/${del.id}`, { method: 'DELETE' }); load() }} />
    </div>
  )
}
