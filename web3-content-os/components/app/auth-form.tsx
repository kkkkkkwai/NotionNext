'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Field } from '@/components/ui/primitives'
import { api, errorMessage } from '@/lib/client'

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter()
  const params = useSearchParams()
  const inviteToken = params.get('invite')
  const [inviteInfo, setInviteInfo] = useState<{ email: string; role: string; workspace: string } | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!inviteToken) return
    api<{ email: string; role: string; workspace: string }>(`/api/invites/${inviteToken}`).then((i) => { setInviteInfo(i); setEmail(i.email) }).catch(() => setError('This invite link is invalid or has expired.'))
  }, [inviteToken])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api(`/api/auth/${mode}`, { method: 'POST', json: { email, password, name } })
      if (inviteToken) {
        try {
          const { joined } = await api<{ joined: string[] }>(`/api/invites/${inviteToken}`, { method: 'POST' })
          if (joined[0]) await api('/api/settings/team/switch', { method: 'POST', json: { orgId: joined[0] } })
        } catch (e) {
          setError('Signed in, but the invite could not be accepted: ' + errorMessage(e))
        }
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-text"><span className="text-sm font-bold">W3</span></div>
          <div>
            <div className="text-sm font-semibold text-fg">Web3 Brand & Content OS</div>
            <div className="text-[11px] text-fg-dim">One Project. One AI Brain. Unlimited Content.</div>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-fg">{mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h1>
        <p className="mt-1 text-[13px] text-fg-muted">{mode === 'login' ? 'Sign in to your project AI brains.' : 'Tell us about your project once. Your AI remembers everything.'}</p>
        {inviteInfo ? <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[13px] text-fg">You are invited to <b>{inviteInfo.workspace}</b> as {inviteInfo.role}. {mode === 'login' ? 'Sign in' : 'Sign up'} with <b>{inviteInfo.email}</b> to join.</div> : null}
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'signup' ? <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" /></Field> : null}
          <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@project.xyz" autoComplete="email" /></Field>
          <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters' : undefined}><Input type="password" required minLength={mode === 'signup' ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></Field>
          {error ? <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</div> : null}
          <Button type="submit" className="w-full" loading={loading}>{mode === 'login' ? 'Sign in' : 'Create workspace'}</Button>
        </form>
        <p className="mt-6 text-center text-[13px] text-fg-muted">
          {mode === 'login' ? (<>No account? <Link href={inviteToken ? `/signup?invite=${inviteToken}` : '/signup'} className="text-primary hover:underline">Sign up</Link></>) : (<>Already have an account? <Link href={inviteToken ? `/login?invite=${inviteToken}` : '/login'} className="text-primary hover:underline">Sign in</Link></>)}
        </p>
      </div>
    </div>
  )
}
