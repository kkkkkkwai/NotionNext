'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Send, Zap, Trash2, Plus, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, EmptyState, ErrorState, Field, Input, PageHeader, Skeleton } from '@/components/ui/primitives'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { relativeTime } from '@/lib/utils'

type Integration = { id: string; kind: 'telegram' | 'x'; name: string; enabled: boolean; meta: { account?: string }; lastTestedAt: string | null; configured: string[] }
type Meta = Record<string, { label: string; fields: { key: string; label: string; secret?: boolean; hint?: string }[] }>
type Log = { id: string; contentId: string; channel: string; status: string; url: string | null; error: string | null; createdAt: string; title: string | null }
type Res = { integrations: Integration[]; meta: Meta; logs: Log[]; scheduler: { active: boolean; lastRun: string | null } }

const logStatusLabel: Record<string, string> = { success: '成功', failed: '失败' }
const channelLabel: Record<string, string> = { telegram: 'Telegram', x: 'X' }

export function PublishingView({ projectId }: { projectId: string }) {
  const toast = useToast()
  const [data, setData] = useState<Res | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [edit, setEdit] = useState<{ kind: 'telegram' | 'x'; config: Record<string, string> } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [del, setDel] = useState<Integration | null>(null)
  const load = useCallback(async () => {
    try {
      setData(await api<Res>(`/api/projects/${projectId}/integrations`))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [projectId])
  useEffect(() => { load() }, [load])
  const save = async () => {
    if (!edit) return
    setBusy('save')
    try {
      await api(`/api/projects/${projectId}/integrations`, { method: 'POST', json: edit })
      toast.success('已连接', '请运行测试以验证凭据。')
      setEdit(null)
      load()
    } catch (e) {
      toast.error('保存失败', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const test = async (kind: string) => {
    setBusy(kind)
    try {
      const r = await api<{ ok: boolean; account: string }>(`/api/projects/${projectId}/integrations/${kind}/test`, { method: 'POST' })
      toast.success('连接正常', r.account)
      load()
    } catch (e) {
      toast.error('测试失败', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  if (error) return <ErrorState message={error} retry={load} />
  return (
    <div>
      <PageHeader eyebrow="活动" title="发布" description="连接 Telegram 和 X。可在内容编辑器中直接发布，或为内容设置排期并开启自动发布，内置调度器会在指定时间自动发出。" />
      {!data ? <Skeleton className="h-40" /> : (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="space-y-3">
            {(['telegram', 'x'] as const).map((kind) => {
              const it = data.integrations.find((i) => i.kind === kind)
              return (
                <Card key={kind} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="flex items-center gap-2 text-[14px] font-medium text-fg">{data.meta[kind].label}{it ? <Badge tone="primary">已连接</Badge> : <Badge tone="muted">未连接</Badge>}</div><div className="mt-0.5 text-[12px] text-fg-dim">{it?.meta?.account ? `${it.meta.account} · 测试于 ${relativeTime(it.lastTestedAt)}` : it ? '尚未测试' : kind === 'telegram' ? 'Bot Token + 频道 ID' : 'OAuth 1.0a 用户密钥（读 + 写）'}</div></div>
                    <div className="flex shrink-0 gap-1">
                      {it ? <Button size="xs" variant="secondary" loading={busy === kind} onClick={() => test(kind)}><Zap className="h-3 w-3" /> 测试</Button> : null}
                      <Button size="xs" variant={it ? 'ghost' : 'primary'} onClick={() => setEdit({ kind, config: {} })}>{it ? '编辑' : <><Plus className="h-3 w-3" /> 连接</>}</Button>
                      {it ? <button onClick={() => setDel(it)} className="rounded-lg p-1.5 text-fg-dim hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button> : null}
                    </div>
                  </div>
                </Card>
              )
            })}
            <Card className="p-4 text-[12.5px] text-fg-muted"><div className="mb-1 flex items-center gap-2 font-medium text-fg"><Clock className="h-4 w-4" /> 自动发布调度器</div>{data.scheduler.active ? <>运行中 · 上次执行 {data.scheduler.lastRun ? relativeTime(data.scheduler.lastRun) : '等待中'}。已设置排期日期、发布渠道并开启自动发布的内容将自动发出。</> : '当前服务器未启用（DISABLE_SCHEDULER=1 或尚未启动）。'}</Card>
          </div>
          <Card>
            <CardHeader title="发布日志" description="所有发布记录，包括手动发布与定时发布" />
            {data.logs.length === 0 ? <div className="p-4"><EmptyState icon={<Send className="h-5 w-5" />} title="尚未发布任何内容" description="在内容库中打开任意内容，并使用发布面板。" /></div> : (
              <ul className="divide-y divide-line">{data.logs.map((l) => <li key={l.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-[13px]"><Badge tone={l.status === 'success' ? 'primary' : 'danger'}>{logStatusLabel[l.status] ?? l.status}</Badge><Badge>{channelLabel[l.channel] ?? l.channel}</Badge><Link href={`/projects/${projectId}/library/${l.contentId}`} className="flex-1 truncate text-fg hover:text-primary">{l.title ?? l.contentId}</Link>{l.url ? <a href={l.url} target="_blank" className="text-primary hover:underline">打开</a> : null}{l.error ? <span className="w-full text-[12px] text-danger">{l.error}</span> : null}<span className="text-[12px] text-fg-dim">{relativeTime(l.createdAt)}</span></li>)}</ul>
            )}
          </Card>
        </div>
      )}
      <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} title={edit ? `连接 ${data?.meta[edit.kind].label}` : ''} description="凭据会加密存储，仅用于发布本项目的内容。" footer={<><Button variant="ghost" onClick={() => setEdit(null)}>取消</Button><Button onClick={save} loading={busy === 'save'}>保存</Button></>}>
        {edit && data ? <div className="space-y-3">{data.meta[edit.kind].fields.map((f) => <Field key={f.key} label={f.label} hint={f.hint}><Input type={f.secret ? 'password' : 'text'} value={edit.config[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, config: { ...edit.config, [f.key]: e.target.value } })} placeholder={data.integrations.find((i) => i.kind === edit.kind)?.configured.includes(f.key) ? '••••••••（保持不变）' : ''} autoComplete="off" /></Field>)}</div> : null}
      </Dialog>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`断开 ${del?.name} 的连接？`} confirmLabel="断开连接" danger onConfirm={async () => { if (del) { await api(`/api/projects/${projectId}/integrations/${del.kind}`, { method: 'DELETE' }); load() } }} />
    </div>
  )
}
