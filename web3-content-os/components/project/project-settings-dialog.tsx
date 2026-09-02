'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import type { Project } from '@/lib/db/schema'

export function ProjectSettingsDialog({ open, onClose, project }: { open: boolean; onClose: () => void; project: Project }) {
  const router = useRouter()
  const toast = useToast()
  const [form, setForm] = useState({ name: project.name, slogan: project.slogan ?? '', positioning: project.positioning ?? '', industry: project.industry ?? '', website: project.website ?? '', twitter: project.twitter ?? '', telegram: project.telegram ?? '', discord: project.discord ?? '', tokenName: project.tokenName ?? '', tokenSymbol: project.tokenSymbol ?? '', launchDate: project.launchDate ?? '', logoUrl: project.logoUrl ?? '', idea: project.idea ?? '' })
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async () => {
    setSaving(true)
    try {
      await api(`/api/projects/${project.id}`, { method: 'PATCH', json: form })
      toast.success('Project updated')
      onClose()
      router.refresh()
    } catch (e) {
      toast.error('Save failed', errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <Dialog open={open} onClose={onClose} title="Project settings" size="lg" footer={<><Button variant="danger" size="sm" onClick={() => setConfirm(true)}>Archive project</Button><div className="flex-1" /><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={form.name} onChange={set('name')} /></Field>
          <Field label="Slogan"><Input value={form.slogan} onChange={set('slogan')} /></Field>
          <Field label="Industry"><Input value={form.industry} onChange={set('industry')} /></Field>
          <Field label="Logo URL"><Input value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://…/logo.png" /></Field>
          <Field label="Website"><Input value={form.website} onChange={set('website')} /></Field>
          <Field label="Twitter / X"><Input value={form.twitter} onChange={set('twitter')} /></Field>
          <Field label="Telegram"><Input value={form.telegram} onChange={set('telegram')} /></Field>
          <Field label="Discord"><Input value={form.discord} onChange={set('discord')} /></Field>
          <Field label="Token Name"><Input value={form.tokenName} onChange={set('tokenName')} /></Field>
          <Field label="Token Symbol"><Input value={form.tokenSymbol} onChange={set('tokenSymbol')} /></Field>
          <Field label="Launch Date"><Input type="date" value={form.launchDate} onChange={set('launchDate')} /></Field>
          <Field label="Positioning"><Input value={form.positioning} onChange={set('positioning')} /></Field>
          <Field label="Founder description" className="sm:col-span-2"><Textarea rows={4} value={form.idea} onChange={set('idea')} /></Field>
        </div>
      </Dialog>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Archive this project?" description="The project and its AI brain are hidden from the workspace. Data is kept." confirmLabel="Archive" danger onConfirm={async () => { await api(`/api/projects/${project.id}`, { method: 'DELETE' }); router.push('/dashboard'); router.refresh() }} />
    </>
  )
}
