'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Trash2, Copy, Check, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, ErrorState, Field, Input, PageHeader, Select, Skeleton } from '@/components/ui/primitives'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { relativeTime } from '@/lib/utils'

type Member = { id: string; userId: string; role: string; email: string; name: string | null; joinedAt: string }
type Invite = { id: string; email: string; role: string; token: string; createdAt: string; expiresAt: string | null }
type Org = { id: string; name: string; role: string }
type Res = { org: { id: string; name: string }; members: Member[]; invites: Invite[]; organizations: Org[]; role: string; roles: string[] }

export function TeamSettings() {
  const router = useRouter()
  const toast = useToast()
  const [data, setData] = useState<Res | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [remove, setRemove] = useState<Member | null>(null)
  const [name, setName] = useState('')
  const [copied, setCopied] = useState(false)
  const load = useCallback(async () => {
    try {
      const r = await api<Res>('/api/settings/team')
      setData(r)
      setName(r.org.name)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])
  useEffect(() => { load() }, [load])
  const canManage = data?.role === 'owner' || data?.role === 'admin'
  const sendInvite = async () => {
    setBusy(true)
    try {
      const r = await api<{ added: boolean; link?: string; email?: string }>('/api/settings/team/invites', { method: 'POST', json: { email, role } })
      if (r.added) {
        toast.success('Member added', `${r.email} already had an account and was added directly.`)
        setInvite(false)
      } else setLink(r.link ?? null)
      setEmail('')
      load()
    } catch (e) {
      toast.error('Invite failed', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const setMemberRole = async (m: Member, r: string) => {
    try {
      await api(`/api/settings/team/members/${m.id}`, { method: 'PATCH', json: { role: r } })
      load()
    } catch (e) {
      toast.error('Update failed', errorMessage(e))
    }
  }
  const switchOrg = async (orgId: string) => {
    await api('/api/settings/team/switch', { method: 'POST', json: { orgId } })
    router.push('/dashboard')
    router.refresh()
  }
  const rename = async () => {
    try {
      await api('/api/settings/team', { method: 'PATCH', json: { name } })
      toast.success('Workspace renamed')
      router.refresh()
      load()
    } catch (e) {
      toast.error('Rename failed', errorMessage(e))
    }
  }
  if (error) return <ErrorState message={error} retry={load} />
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Team" description={data ? `Workspace: ${data.org.name} · you are ${data.role}` : undefined} actions={canManage ? <Button onClick={() => { setLink(null); setInvite(true) }}><Plus className="h-4 w-4" /> Invite member</Button> : undefined} />
      {!data ? <Skeleton className="h-40" /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <Card>
              <CardHeader title="Members" description="owner · admin (manage team & settings) · editor (create content) · viewer (read only)" />
              <ul className="divide-y divide-line">{data.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-[13px]">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[11px] uppercase text-fg-muted">{(m.name || m.email).slice(0, 1)}</div>
                  <div className="min-w-0 flex-1"><div className="truncate text-fg">{m.name || m.email}</div><div className="truncate text-[12px] text-fg-dim">{m.email} · joined {relativeTime(m.joinedAt)}</div></div>
                  {m.role === 'owner' || !canManage ? <Badge tone={m.role === 'owner' ? 'primary' : 'neutral'}>{m.role}</Badge> : <Select value={m.role} onChange={(e) => setMemberRole(m, e.target.value)} className="h-8 w-auto py-1 text-[12.5px]">{data.roles.filter((r) => r !== 'owner').map((r) => <option key={r}>{r}</option>)}</Select>}
                  {canManage && m.role !== 'owner' ? <button onClick={() => setRemove(m)} className="rounded-lg p-1.5 text-fg-dim hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button> : null}
                </li>
              ))}</ul>
            </Card>
            {data.invites.length ? (
              <Card>
                <CardHeader title="Pending invites" />
                <ul className="divide-y divide-line">{data.invites.map((i) => <li key={i.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]"><span className="flex-1 text-fg">{i.email}</span><Badge>{i.role}</Badge><span className="text-[12px] text-fg-dim">{relativeTime(i.createdAt)}</span><button title="Copy invite link" onClick={async () => { await navigator.clipboard.writeText(`${location.origin}/signup?invite=${i.token}`); toast.info('Invite link copied') }} className="rounded-lg p-1.5 text-fg-dim hover:text-fg"><Copy className="h-3.5 w-3.5" /></button>{canManage ? <button onClick={async () => { await api(`/api/settings/team/invites/${i.id}`, { method: 'DELETE' }); load() }} className="rounded-lg p-1.5 text-fg-dim hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button> : null}</li>)}</ul>
              </Card>
            ) : null}
          </div>
          <div className="space-y-4">
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-fg"><Building2 className="h-4 w-4" /> Workspace</div>
              {canManage ? <div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} /><Button size="md" variant="secondary" onClick={rename} disabled={name === data.org.name}>Save</Button></div> : <div className="text-[13px] text-fg-muted">{data.org.name}</div>}
            </Card>
            {data.organizations.length > 1 ? (
              <Card className="p-4">
                <div className="mb-2 text-[13px] font-medium text-fg">Switch workspace</div>
                <ul className="space-y-1">{data.organizations.map((o) => <li key={o.id}><button onClick={() => switchOrg(o.id)} disabled={o.id === data.org.id} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] ${o.id === data.org.id ? 'bg-white/[0.06] text-fg' : 'text-fg-muted hover:bg-white/[0.04]'}`}><span className="truncate">{o.name}</span><Badge>{o.role}</Badge></button></li>)}</ul>
              </Card>
            ) : null}
            <Card className="p-4 text-[12.5px] text-fg-muted"><Users className="mb-1 h-4 w-4" />Invited people who already have an account are added instantly. Others get a signup link; the invite is also accepted automatically when they sign up with the invited email.</Card>
          </div>
        </div>
      )}
      <Dialog open={invite} onClose={() => setInvite(false)} title="Invite a teammate" footer={link ? <Button onClick={() => setInvite(false)}>Done</Button> : <><Button variant="ghost" onClick={() => setInvite(false)}>Cancel</Button><Button onClick={sendInvite} loading={busy} disabled={!email.includes('@')}>Send invite</Button></>}>
        {link ? (
          <div className="space-y-3"><p className="text-[13px] text-fg-muted">No account with that email yet. Share this link — it expires in 14 days:</p><div className="flex gap-2"><Input readOnly value={link} /><Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</Button></div></div>
        ) : (
          <div className="space-y-3"><Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@project.xyz" autoFocus /></Field><Field label="Role"><Select value={role} onChange={(e) => setRole(e.target.value)}><option value="admin">admin</option><option value="editor">editor</option><option value="viewer">viewer</option></Select></Field></div>
        )}
      </Dialog>
      <ConfirmDialog open={Boolean(remove)} onClose={() => setRemove(null)} title={`Remove ${remove?.email}?`} confirmLabel="Remove" danger onConfirm={async () => { if (remove) { await api(`/api/settings/team/members/${remove.id}`, { method: 'DELETE' }); load() } }} />
    </div>
  )
}
