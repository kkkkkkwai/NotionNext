'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, Zap, Cpu, KeyRound, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, Switch } from '@/components/ui/primitives'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'

type Provider = { id: string; provider: string; name: string; apiKeyMasked: string; hasKey: boolean; baseUrl: string | null; defaultModel: string | null; embeddingModel: string | null; temperature: number; maxTokens: number; enabled: boolean }
type Meta = Record<string, { label: string; baseUrl: string; docs: string; envKey?: string }>
type Defaults = Record<string, { fast: string; strong: string; long: string; embedding?: string }>
type TaskType = { id: string; label: string; description: string; tier: string }
type Setting = { taskType: string; providerId: string | null; model: string | null; temperature: number | null; maxTokens: number | null }

export function AiProviderSettings() {
  const toast = useToast()
  const [providers, setProviders] = useState<Provider[] | null>(null)
  const [systemKeys, setSystemKeys] = useState<{ provider: string; label: string }[]>([])
  const [meta, setMeta] = useState<Meta>({})
  const [defaults, setDefaults] = useState<Defaults>({})
  const [tasks, setTasks] = useState<TaskType[]>([])
  const [settings, setSettings] = useState<Setting[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Partial<Provider> & { apiKey?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string; models?: string[] }>>({})
  const [del, setDel] = useState<Provider | null>(null)
  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([api<{ providers: Provider[]; systemKeys: typeof systemKeys; meta: Meta; defaults: Defaults }>('/api/settings/providers'), api<{ settings: Setting[]; taskTypes: TaskType[] }>('/api/settings/tasks')])
      setProviders(p.providers)
      setSystemKeys(p.systemKeys)
      setMeta(p.meta)
      setDefaults(p.defaults)
      setTasks(t.taskTypes)
      setSettings(t.settings)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])
  useEffect(() => { load() }, [load])
  const save = async () => {
    if (!dialog?.provider) return
    setSaving(true)
    try {
      if (dialog.id) await api(`/api/settings/providers/${dialog.id}`, { method: 'PATCH', json: dialog })
      else await api('/api/settings/providers', { method: 'POST', json: dialog })
      setDialog(null)
      toast.success('Provider saved')
      load()
    } catch (e) {
      toast.error('Save failed', errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const test = async (p: Provider) => {
    setTesting(p.id)
    try {
      const r = await api<{ ok: boolean; model: string; reply: string; latencyMs: number; models: string[] }>(`/api/settings/providers/${p.id}/test`, { method: 'POST' })
      setTestResult((x) => ({ ...x, [p.id]: { ok: true, message: `${r.model} replied "${r.reply}" in ${r.latencyMs}ms`, models: r.models } }))
      toast.success('Connection OK', `${r.model} · ${r.latencyMs}ms`)
    } catch (e) {
      setTestResult((x) => ({ ...x, [p.id]: { ok: false, message: errorMessage(e) } }))
      toast.error('Connection failed', errorMessage(e))
    } finally {
      setTesting(null)
    }
  }
  const saveTask = async (taskType: string, patch: Partial<Setting>) => {
    const cur = settings.find((s) => s.taskType === taskType) ?? { taskType, providerId: null, model: null, temperature: null, maxTokens: null }
    const next = { ...cur, ...patch }
    setSettings((s) => [...s.filter((x) => x.taskType !== taskType), next])
    try {
      await api('/api/settings/tasks', { method: 'POST', json: next })
    } catch (e) {
      toast.error('Save failed', errorMessage(e))
    }
  }
  const tierModel = (p: Provider | undefined, tier: string) => {
    if (!p) return ''
    const d = defaults[p.provider]
    if (tier === 'embedding') return p.embeddingModel || d?.embedding || ''
    if (tier === 'fast') return p.defaultModel || d?.fast || ''
    return d?.[tier as 'strong' | 'long'] || p.defaultModel || ''
  }
  return (
    <div>
      <PageHeader eyebrow="Settings" title="AI Providers" description="Bring your own key (BYOK). Keys are encrypted at rest. Route each task type to a different model — cheap models for extraction, strong models for DNA and narrative." actions={<Button onClick={() => setDialog({ provider: 'openai', temperature: 0.7, maxTokens: 4096, enabled: true })}><Plus className="h-4 w-4" /> Add provider</Button>} />
      {error ? <ErrorState message={error} retry={load} /> : null}
      {systemKeys.length ? <div className="mb-4 flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-[13px] text-fg-muted"><KeyRound className="h-4 w-4 text-primary" /> System keys available: {systemKeys.map((k) => k.label).join(', ')} — used automatically when you have no provider configured.</div> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          {providers === null ? <Skeleton className="h-24" /> : providers.length === 0 ? <EmptyState icon={<Cpu className="h-5 w-5" />} title="No providers yet" description={systemKeys.length ? 'System keys are active. Add your own key to control models and costs.' : 'Add an OpenAI, Anthropic, Gemini, OpenRouter or any OpenAI-compatible endpoint (DeepSeek, Grok, local).'} action={<Button size="sm" onClick={() => setDialog({ provider: 'openai', temperature: 0.7, maxTokens: 4096, enabled: true })}>Add provider</Button>} /> : providers.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-[14px] font-medium text-fg">{p.name}</span><Badge>{meta[p.provider]?.label ?? p.provider}</Badge>{!p.enabled ? <Badge tone="muted">disabled</Badge> : null}</div>
                  <div className="mt-1 text-[12.5px] text-fg-muted">Key: <span className="font-mono">{p.hasKey ? p.apiKeyMasked : systemKeys.some((k) => k.provider === p.provider) ? 'system env' : <span className="text-danger">missing</span>}</span>{p.baseUrl ? <span> · {p.baseUrl}</span> : null}</div>
                  <div className="mt-0.5 text-[12.5px] text-fg-dim">Default: {p.defaultModel || defaults[p.provider]?.fast} · Embedding: {p.embeddingModel || defaults[p.provider]?.embedding || '—'} · temp {p.temperature} · max {p.maxTokens}</div>
                  {testResult[p.id] ? <div className={`mt-1.5 text-[12px] ${testResult[p.id].ok ? 'text-primary' : 'text-danger'}`}>{testResult[p.id].ok ? <Check className="mr-1 inline h-3 w-3" /> : null}{testResult[p.id].message}</div> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="xs" variant="secondary" loading={testing === p.id} onClick={() => test(p)}><Zap className="h-3 w-3" /> Test</Button>
                  <button onClick={() => setDialog({ ...p, apiKey: '' })} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setDel(p)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <Card className="h-fit">
          <CardHeader title="AI Router" description="Which provider & model serves each task. Empty = automatic (first enabled provider, tier defaults)." />
          <div className="divide-y divide-line">
            {tasks.map((t) => {
              const s = settings.find((x) => x.taskType === t.id)
              const p = providers?.find((x) => x.id === s?.providerId) ?? providers?.[0]
              return (
                <div key={t.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_150px_170px]">
                  <div><div className="text-[13px] text-fg">{t.label} <Badge tone="muted">{t.tier}</Badge></div><div className="text-[11.5px] text-fg-dim">{t.description}</div></div>
                  <Select value={s?.providerId ?? ''} onChange={(e) => saveTask(t.id, { providerId: e.target.value || null })} className="h-8 py-1 text-[12.5px]"><option value="">Auto</option>{(providers ?? []).map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}</Select>
                  <Input list={`models-${p?.id ?? 'none'}`} value={s?.model ?? ''} onChange={(e) => saveTask(t.id, { model: e.target.value || null })} placeholder={tierModel(p, t.tier) || 'model id'} className="h-8 py-1 font-mono text-[12px]" />
                </div>
              )
            })}
          </div>
          {(providers ?? []).map((p) => <datalist key={p.id} id={`models-${p.id}`}>{(testResult[p.id]?.models ?? []).map((m) => <option key={m} value={m} />)}{Object.values(defaults[p.provider] ?? {}).map((m) => <option key={m} value={m} />)}</datalist>)}
        </Card>
      </div>
      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} title={dialog?.id ? 'Edit provider' : 'Add provider'} footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></>}>
        {dialog ? (
          <div className="space-y-3">
            <Field label="Provider"><Select value={dialog.provider} onChange={(e) => setDialog({ ...dialog, provider: e.target.value, baseUrl: e.target.value === 'openai_compatible' ? dialog.baseUrl : '' })}>{Object.entries(meta).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</Select></Field>
            <Field label="Display name"><Input value={dialog.name ?? ''} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} placeholder={meta[dialog.provider!]?.label} /></Field>
            <Field label="API key" hint={dialog.id && dialog.hasKey ? 'Leave empty to keep the current key.' : meta[dialog.provider!]?.docs ? `Get one at ${meta[dialog.provider!].docs}` : undefined}><Input type="password" value={dialog.apiKey ?? ''} onChange={(e) => setDialog({ ...dialog, apiKey: e.target.value })} placeholder={dialog.hasKey ? dialog.apiKeyMasked : 'sk-…'} autoComplete="off" /></Field>
            <Field label="Base URL (optional)" hint={`Default: ${meta[dialog.provider!]?.baseUrl}`}><Input value={dialog.baseUrl ?? ''} onChange={(e) => setDialog({ ...dialog, baseUrl: e.target.value })} placeholder={dialog.provider === 'openai_compatible' ? 'https://api.deepseek.com/v1' : ''} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default (fast) model"><Input value={dialog.defaultModel ?? ''} onChange={(e) => setDialog({ ...dialog, defaultModel: e.target.value })} placeholder={defaults[dialog.provider!]?.fast} className="font-mono text-[12.5px]" /></Field>
              <Field label="Embedding model"><Input value={dialog.embeddingModel ?? ''} onChange={(e) => setDialog({ ...dialog, embeddingModel: e.target.value })} placeholder={defaults[dialog.provider!]?.embedding ?? 'none (local fallback)'} className="font-mono text-[12.5px]" /></Field>
              <Field label="Temperature"><Input type="number" step={0.1} min={0} max={2} value={dialog.temperature ?? 0.7} onChange={(e) => setDialog({ ...dialog, temperature: Number(e.target.value) })} /></Field>
              <Field label="Max tokens"><Input type="number" min={256} value={dialog.maxTokens ?? 4096} onChange={(e) => setDialog({ ...dialog, maxTokens: Number(e.target.value) })} /></Field>
            </div>
            <Switch checked={dialog.enabled ?? true} onChange={(v) => setDialog({ ...dialog, enabled: v })} label="Enabled" />
            <p className="text-[11.5px] text-fg-dim">Strong tasks (DNA, narrative, quality content) default to {defaults[dialog.provider!]?.strong}; long-form to {defaults[dialog.provider!]?.long}. Override per task in the AI Router.</p>
          </div>
        ) : null}
      </Dialog>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`Remove ${del?.name}?`} confirmLabel="Remove" danger onConfirm={async () => { if (del) { await api(`/api/settings/providers/${del.id}`, { method: 'DELETE' }); load() } }} />
    </div>
  )
}
