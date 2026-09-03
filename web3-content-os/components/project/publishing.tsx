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
      toast.success('Connected', 'Run a test to verify the credentials.')
      setEdit(null)
      load()
    } catch (e) {
      toast.error('Save failed', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const test = async (kind: string) => {
    setBusy(kind)
    try {
      const r = await api<{ ok: boolean; account: string }>(`/api/projects/${projectId}/integrations/${kind}/test`, { method: 'POST' })
      toast.success('Connection OK', r.account)
      load()
    } catch (e) {
      toast.error('Test failed', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  if (error) return <ErrorState message={error} retry={load} />
  return (
    <div>
      <PageHeader eyebrow="Campaign" title="Publishing" description="Connect Telegram and X. Publish from the content editor, or schedule items with auto-publish and the built-in scheduler posts them at the right time." />
      {!data ? <Skeleton className="h-40" /> : (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="space-y-3">
            {(['telegram', 'x'] as const).map((kind) => {
              const it = data.integrations.find((i) => i.kind === kind)
              return (
                <Card key={kind} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="flex items-center gap-2 text-[14px] font-medium text-fg">{data.meta[kind].label}{it ? <Badge tone="primary">connected</Badge> : <Badge tone="muted">not connected</Badge>}</div><div className="mt-0.5 text-[12px] text-fg-dim">{it?.meta?.account ? `${it.meta.account} · tested ${relativeTime(it.lastTestedAt)}` : it ? 'Not tested yet' : kind === 'telegram' ? 'Bot token + channel id' : 'OAuth 1.0a user keys (Read+Write)'}</div></div>
                    <div className="flex shrink-0 gap-1">
                      {it ? <Button size="xs" variant="secondary" loading={busy === kind} onClick={() => test(kind)}><Zap className="h-3 w-3" /> Test</Button> : null}
                      <Button size="xs" variant={it ? 'ghost' : 'primary'} onClick={() => setEdit({ kind, config: {} })}>{it ? 'Edit' : <><Plus className="h-3 w-3" /> Connect</>}</Button>
                      {it ? <button onClick={() => setDel(it)} className="rounded-lg p-1.5 text-fg-dim hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button> : null}
                    </div>
                  </div>
                </Card>
              )
            })}
            <Card className="p-4 text-[12.5px] text-fg-muted"><div className="mb-1 flex items-center gap-2 font-medium text-fg"><Clock className="h-4 w-4" /> Auto-publish scheduler</div>{data.scheduler.active ? <>Active · last run {data.scheduler.lastRun ? relativeTime(data.scheduler.lastRun) : 'pending'}. Items with a schedule date, a channel and auto-publish enabled are posted automatically.</> : 'Inactive on this server (DISABLE_SCHEDULER=1 or not started).'}</Card>
          </div>
          <Card>
            <CardHeader title="Publish log" description="Every publish attempt, manual or scheduled" />
            {data.logs.length === 0 ? <div className="p-4"><EmptyState icon={<Send className="h-5 w-5" />} title="Nothing published yet" description="Open any item in the Content Library and use the Publish panel." /></div> : (
              <ul className="divide-y divide-line">{data.logs.map((l) => <li key={l.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-[13px]"><Badge tone={l.status === 'success' ? 'primary' : 'danger'}>{l.status}</Badge><Badge>{l.channel}</Badge><Link href={`/projects/${projectId}/library/${l.contentId}`} className="flex-1 truncate text-fg hover:text-primary">{l.title ?? l.contentId}</Link>{l.url ? <a href={l.url} target="_blank" className="text-primary hover:underline">open</a> : null}{l.error ? <span className="w-full text-[12px] text-danger">{l.error}</span> : null}<span className="text-[12px] text-fg-dim">{relativeTime(l.createdAt)}</span></li>)}</ul>
            )}
          </Card>
        </div>
      )}
      <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} title={edit ? `Connect ${data?.meta[edit.kind].label}` : ''} description="Credentials are encrypted at rest and only used to publish this project's content." footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} loading={busy === 'save'}>Save</Button></>}>
        {edit && data ? <div className="space-y-3">{data.meta[edit.kind].fields.map((f) => <Field key={f.key} label={f.label} hint={f.hint}><Input type={f.secret ? 'password' : 'text'} value={edit.config[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, config: { ...edit.config, [f.key]: e.target.value } })} placeholder={data.integrations.find((i) => i.kind === edit.kind)?.configured.includes(f.key) ? '•••••••• (keep)' : ''} autoComplete="off" /></Field>)}</div> : null}
      </Dialog>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`Disconnect ${del?.name}?`} confirmLabel="Disconnect" danger onConfirm={async () => { if (del) { await api(`/api/projects/${projectId}/integrations/${del.kind}`, { method: 'DELETE' }); load() } }} />
    </div>
  )
}
