'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, statusLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, Check, Save, History, RotateCcw, ShieldCheck, Languages, Eye, Pencil, Sparkles, Send, Image as ImageIcon, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, ErrorState, Field, Input, Select, Skeleton, Switch, Textarea } from '@/components/ui/primitives'
import { Markdown } from '@/components/ui/markdown'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { cn, relativeTime } from '@/lib/utils'

type Item = { id: string; title: string; body: string; contentType: string; category: string; platform: string | null; language: string; status: string; tags: string[]; folder: string | null; currentVersion: number; scheduledAt: string | null; createdAt: string; updatedAt: string; publishChannel: string | null; autoPublish: boolean; publishedUrl: string | null }
type Version = { id: string; version: number; body: string; note: string | null; model: string | null; createdAt: string }
type Action = { id: string; label: string; zh: string }
type Finding = { level: 'high' | 'medium' | 'low'; phrase: string; reason: string; suggestion?: string }
const STATUSES = ['draft', 'review', 'approved', 'scheduled', 'published', 'archived']
const STATUS_ZH: Record<string, string> = { draft: '草稿', review: '待审核', approved: '已批准', scheduled: '已排期', published: '已发布', archived: '已归档' }
const LEVEL_ZH: Record<string, string> = { high: '高', medium: '中', low: '低' }
const LANGS = [['en', 'English'], ['zh', '中文'], ['ko', '한국어'], ['ja', '日本語'], ['vi', 'Tiếng Việt'], ['th', 'ไทย'], ['ru', 'Русский'], ['es', 'Español']]

export function ContentEditor({ projectId, contentId }: { projectId: string; contentId: string }) {
  const toast = useToast()
  const [item, setItem] = useState<Item | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<'edit' | 'preview'>('preview')
  const [busy, setBusy] = useState<string | null>(null)
  const [useMemory, setUseMemory] = useState(true)
  const [saveAsNew, setSaveAsNew] = useState(false)
  const [targetLang, setTargetLang] = useState('en')
  const [custom, setCustom] = useState('')
  const [copied, setCopied] = useState(false)
  const [risk, setRisk] = useState<{ findings: Finding[]; score: string } | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [meta, setMeta] = useState({ status: 'draft', folder: '', tags: '', scheduledAt: '' })
  const [channels, setChannels] = useState<{ kind: string; account?: string }[]>([])
  const [pub, setPub] = useState<{ channel: string; auto: boolean }>({ channel: '', auto: false })
  const load = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([api<{ item: Item; versions: Version[] }>(`/api/projects/${projectId}/content/${contentId}`), api<{ actions: Action[] }>(`/api/projects/${projectId}/content/${contentId}/edit`)])
      setItem(r.item)
      setVersions(r.versions)
      setActions(a.actions)
      setBody(r.item.body)
      setTitle(r.item.title)
      setMeta({ status: r.item.status, folder: r.item.folder ?? '', tags: r.item.tags.join(', '), scheduledAt: r.item.scheduledAt ? r.item.scheduledAt.slice(0, 10) : '' })
      setPub({ channel: r.item.publishChannel ?? '', auto: r.item.autoPublish })
      api<{ integrations: { kind: string; meta: { account?: string } }[] }>(`/api/projects/${projectId}/integrations`).then((x) => setChannels(x.integrations.map((i) => ({ kind: i.kind, account: i.meta?.account })))).catch(() => {})
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [projectId, contentId])
  useEffect(() => { load() }, [load])
  const dirty = item && (body !== item.body || title !== item.title)
  const save = async () => {
    setBusy('save')
    try {
      await api(`/api/projects/${projectId}/content/${contentId}`, { method: 'PATCH', json: { body, title, status: meta.status, folder: meta.folder || null, tags: meta.tags.split(',').map((t) => t.trim()).filter(Boolean), scheduledAt: meta.scheduledAt ? new Date(meta.scheduledAt + 'T12:00:00Z').toISOString() : null } })
      toast.success('已保存')
      await load()
    } catch (e) {
      toast.error('保存失败', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    if (dirty) await save()
    setBusy(action)
    try {
      const r = await api<{ item: Item; created: boolean }>(`/api/projects/${projectId}/content/${contentId}/edit`, { method: 'POST', json: { action, useMemory, saveAsNew, ...extra } })
      if (r.created) {
        toast.success('已创建新内容', r.item.title)
        window.location.href = `/projects/${projectId}/library/${r.item.id}`
      } else {
        toast.success('已更新', `版本 ${r.item.currentVersion}`)
        await load()
        setMode('preview')
      }
    } catch (e) {
      toast.error('AI 编辑失败', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const checkRisk = async () => {
    setBusy('risk')
    try {
      const r = await api<{ findings: Finding[]; score: string }>(`/api/projects/${projectId}/risk`, { method: 'POST', json: { text: body } })
      setRisk(r)
      if (r.findings.length === 0) toast.success('未发现风险表述')
    } catch (e) {
      toast.error('风险检查失败', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const rewriteSafely = async () => {
    if (dirty) await save()
    setBusy('rewrite-safe')
    try {
      const r = await api<{ item: Item; rescan: { findings: Finding[]; score: string } }>(`/api/projects/${projectId}/risk`, { method: 'POST', json: { contentId, rewrite: true } })
      setRisk(r.rescan)
      toast.success('已安全改写', `剩余 ${r.rescan.findings.length} 处风险标记`)
      await load()
    } catch (e) {
      toast.error('改写失败', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const restore = async (v: number) => {
    await api(`/api/projects/${projectId}/content/${contentId}/restore`, { method: 'POST', json: { version: v } })
    toast.success(`已恢复到 v${v}`)
    setShowVersions(false)
    load()
  }
  const publishNow = async () => {
    if (!pub.channel) return
    if (dirty) await save()
    setBusy('publish')
    try {
      const r = await api<{ url?: string }>(`/api/projects/${projectId}/content/${contentId}/publish`, { method: 'POST', json: { channel: pub.channel } })
      toast.success('已发布', r.url ?? '发布成功')
      await load()
    } catch (e) {
      toast.error('发布失败', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const savePublishPlan = async (next: { channel: string; auto: boolean }) => {
    setPub(next)
    try {
      await api(`/api/projects/${projectId}/content/${contentId}/publish`, { method: 'PATCH', json: { publishChannel: next.channel || null, autoPublish: next.auto, scheduledAt: meta.scheduledAt ? new Date(meta.scheduledAt + 'T12:00:00Z').toISOString() : null } })
      if (next.auto) toast.info('已开启自动发布', `将在排期时间发布到 ${next.channel}。`)
    } catch (e) {
      toast.error('无法保存', errorMessage(e))
    }
  }
  const copy = async () => {
    await navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  if (error) return <ErrorState message={error} retry={load} />
  if (!item) return <div className="space-y-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-64" /></div>
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/projects/${projectId}/library`} className="inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg"><ArrowLeft className="h-3.5 w-3.5" /> 内容库</Link>
        <span className="text-fg-dim">/</span>
        <Badge>{contentTypeLabel(item.contentType)}</Badge>{item.platform ? <Badge>{platformLabel(item.platform)}</Badge> : null}<Badge>{languageLabel(item.language)}</Badge><Badge tone="muted">v{item.currentVersion}</Badge>
        <span className="text-[12px] text-fg-dim">更新于 {relativeTime(item.updatedAt)}</span>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => setShowVersions(true)}><History className="h-3.5 w-3.5" /> {versions.length} 个版本</Button>
        <Button size="sm" variant="secondary" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />} 复制</Button>
        <Button size="sm" onClick={save} loading={busy === 'save'} disabled={!dirty && meta.status === item.status && (meta.folder || '') === (item.folder ?? '') && meta.tags === item.tags.join(', ') && meta.scheduledAt === (item.scheduledAt ? item.scheduledAt.slice(0, 10) : '')}><Save className="h-3.5 w-3.5" /> 保存</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-[16px] font-medium" />
          <Card>
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <div className="flex gap-1"><button onClick={() => setMode('preview')} className={cn('flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12.5px]', mode === 'preview' ? 'bg-white/[0.08] text-fg' : 'text-fg-muted')}><Eye className="h-3.5 w-3.5" /> 预览</button><button onClick={() => setMode('edit')} className={cn('flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12.5px]', mode === 'edit' ? 'bg-white/[0.08] text-fg' : 'text-fg-muted')}><Pencil className="h-3.5 w-3.5" /> 编辑</button></div>
              <span className="text-[11.5px] text-fg-dim">{body.length} 字符{item.contentType === 'tweet' ? ` · ${body.length <= 280 ? '未超出' : '超出'} 280 字符限制` : ''}</span>
            </div>
            {mode === 'edit' ? <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={22} className="rounded-none border-0 bg-transparent font-mono text-[13px] focus:ring-0" /> : <div className="p-5"><Markdown>{body}</Markdown></div>}
          </Card>
          {risk ? (
            <Card className={cn('p-4', risk.score === 'high' ? 'border-danger/40' : risk.score === 'medium' ? 'border-warn/40' : 'border-primary/30')}>
              <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2 text-[13.5px] font-medium text-fg"><ShieldCheck className="h-4 w-4" /> 风险检查：<Badge tone={risk.score === 'high' ? 'danger' : risk.score === 'medium' ? 'warn' : 'primary'}>{LEVEL_ZH[risk.score] ?? risk.score}</Badge></div>{risk.findings.length ? <Button size="xs" variant="secondary" onClick={rewriteSafely} loading={busy === 'rewrite-safe'}>安全改写</Button> : null}</div>
              {risk.findings.length === 0 ? <p className="text-[13px] text-fg-muted">未检测到风险表述。</p> : <ul className="space-y-1.5">{risk.findings.map((f, i) => <li key={i} className="flex items-start gap-2 text-[12.5px]"><Badge tone={f.level === 'high' ? 'danger' : f.level === 'medium' ? 'warn' : 'neutral'}>{LEVEL_ZH[f.level] ?? f.level}</Badge><span className="text-fg">“{f.phrase}”</span><span className="text-fg-muted">— {f.reason}{f.suggestion ? ` · ${f.suggestion}` : ''}</span></li>)}</ul>}
            </Card>
          ) : null}
        </div>
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-fg"><Sparkles className="h-4 w-4 text-primary" /> AI 编辑器</div>
            <div className="mb-3 space-y-2"><Switch checked={useMemory} onChange={setUseMemory} label="使用项目记忆" /><Switch checked={saveAsNew} onChange={setSaveAsNew} label="将结果保存为新内容" /></div>
            <div className="grid grid-cols-2 gap-1.5">
              {actions.filter((a) => a.id !== 'translate').map((a) => <button key={a.id} onClick={() => run(a.id)} disabled={busy !== null} className="rounded-lg border border-line px-2 py-1.5 text-left text-[12.5px] text-fg-muted transition hover:border-primary/40 hover:text-fg disabled:opacity-50"><div>{busy === a.id ? '处理中…' : a.zh || a.label}</div></button>)}
            </div>
            <div className="mt-3 flex gap-2"><Select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="h-8 py-1 text-[12.5px]">{LANGS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Select><Button size="sm" variant="secondary" onClick={() => run('translate', { targetLanguage: targetLang })} loading={busy === 'translate'}><Languages className="h-3.5 w-3.5" /> 翻译</Button></div>
            <div className="mt-3 flex gap-2"><Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="自定义指令…" className="h-8 py-1 text-[12.5px]" /><Button size="sm" variant="secondary" disabled={!custom.trim()} loading={busy === 'custom'} onClick={() => run('custom', { instruction: custom })}>执行</Button></div>
            <Button size="sm" variant="outline" className="mt-3 w-full" onClick={checkRisk} loading={busy === 'risk'}><ShieldCheck className="h-3.5 w-3.5" /> 风险检查</Button>
          </Card>
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-fg"><Send className="h-4 w-4 text-primary" /> 发布</div>
            {channels.length === 0 ? <p className="text-[12.5px] text-fg-muted">尚未连接发布渠道。<Link href={`/projects/${projectId}/publish`} className="text-primary hover:underline">连接 Telegram 或 X →</Link></p> : (
              <div className="space-y-2">
                <Select value={pub.channel} onChange={(e) => savePublishPlan({ ...pub, channel: e.target.value })} className="h-8 py-1 text-[12.5px]"><option value="">选择渠道…</option>{channels.map((c) => <option key={c.kind} value={c.kind}>{c.kind === 'x' ? 'X (Twitter)' : 'Telegram'}{c.account ? ` · ${c.account}` : ''}</option>)}</Select>
                <Button size="sm" className="w-full" disabled={!pub.channel} loading={busy === 'publish'} onClick={publishNow}><Send className="h-3.5 w-3.5" /> 立即发布</Button>
                <Switch checked={pub.auto} onChange={(v) => savePublishPlan({ ...pub, auto: v })} label={meta.scheduledAt ? `于 ${meta.scheduledAt} 自动发布` : '按排期日期自动发布'} />
                {item.publishedUrl ? <a href={item.publishedUrl} target="_blank" className="flex items-center gap-1 text-[12.5px] text-primary hover:underline"><ExternalLink className="h-3 w-3" /> 查看已发布内容</a> : null}
              </div>
            )}
            {item.contentType === 'poster_copy' ? <div className="mt-3 border-t border-line pt-3"><div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-fg"><ImageIcon className="h-4 w-4 text-primary" /> 海报导出</div><div className="flex flex-wrap gap-1.5">{[['portrait', '1080×1350'], ['square', '1080×1080'], ['wide', '1600×900']].map(([s, l]) => <a key={s} href={`/api/projects/${projectId}/content/${contentId}/poster?size=${s}`} target="_blank" className="rounded-lg border border-line px-2 py-1 text-[12px] text-fg-muted hover:border-primary/40 hover:text-fg">{l}</a>)}</div><p className="mt-1 text-[11px] text-fg-dim">根据文案渲染的品牌风格 SVG——可直接打开保存，或导入 Figma / Canva。</p></div> : null}
          </Card>
          <Card className="space-y-3 p-4">
            <Field label="状态"><Select value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_ZH[s] ?? s}</option>)}</Select></Field>
            <Field label="排期日期"><Input type="date" value={meta.scheduledAt} onChange={(e) => setMeta({ ...meta, scheduledAt: e.target.value, status: e.target.value && meta.status === 'draft' ? 'scheduled' : meta.status })} /></Field>
            <Field label="文件夹"><Input value={meta.folder} onChange={(e) => setMeta({ ...meta, folder: e.target.value })} placeholder="例如：Launch Kit/Twitter" /></Field>
            <Field label="标签" hint="用英文逗号分隔"><Input value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} /></Field>
          </Card>
        </div>
      </div>
      <Dialog open={showVersions} onClose={() => setShowVersions(false)} title="版本历史" size="lg">
        <ul className="space-y-2">{versions.map((v) => <li key={v.id} className="rounded-xl border border-line p-3"><div className="mb-1 flex items-center justify-between text-[12.5px]"><span className="flex items-center gap-2"><Badge tone={v.version === item.currentVersion ? 'primary' : 'neutral'}>v{v.version}</Badge><span className="text-fg">{v.note}</span><span className="text-fg-dim">{v.model ?? ''} · {relativeTime(v.createdAt)}</span></span>{v.version !== item.currentVersion ? <Button size="xs" variant="secondary" onClick={() => restore(v.version)}><RotateCcw className="h-3 w-3" /> 恢复</Button> : null}</div><p className="line-clamp-3 whitespace-pre-wrap text-[12px] text-fg-muted">{v.body}</p></li>)}</ul>
      </Dialog>
    </div>
  )
}
