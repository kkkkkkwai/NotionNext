'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, statusLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
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
      toast.success('模型服务已保存')
      load()
    } catch (e) {
      toast.error('保存失败', errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const test = async (p: Provider) => {
    setTesting(p.id)
    try {
      const r = await api<{ ok: boolean; model: string; reply: string; latencyMs: number; models: string[] }>(`/api/settings/providers/${p.id}/test`, { method: 'POST' })
      setTestResult((x) => ({ ...x, [p.id]: { ok: true, message: `${r.model} 在 ${r.latencyMs}ms 内回复："${r.reply}"`, models: r.models } }))
      toast.success('连接成功', `${r.model} · ${r.latencyMs}ms`)
    } catch (e) {
      setTestResult((x) => ({ ...x, [p.id]: { ok: false, message: errorMessage(e) } }))
      toast.error('连接失败', errorMessage(e))
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
      toast.error('保存失败', errorMessage(e))
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
      <PageHeader eyebrow="设置" title="AI 模型" description="自带 API Key（BYOK），密钥加密存储。可为每种任务类型指定不同模型——信息抽取用低成本模型，项目 DNA 与叙事用强模型。" actions={<Button onClick={() => setDialog({ provider: 'openai', temperature: 0.7, maxTokens: 4096, enabled: true })}><Plus className="h-4 w-4" /> 添加模型服务</Button>} />
      {error ? <ErrorState message={error} retry={load} /> : null}
      {systemKeys.length ? <div className="mb-4 flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-[13px] text-fg-muted"><KeyRound className="h-4 w-4 text-primary" /> 系统已内置密钥：{systemKeys.map((k) => k.label).join('、')}——未配置自己的模型服务时将自动使用。</div> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          {providers === null ? <Skeleton className="h-24" /> : providers.length === 0 ? <EmptyState icon={<Cpu className="h-5 w-5" />} title="还没有模型服务" description={systemKeys.length ? '系统密钥已启用。添加自己的 Key 即可自主控制模型与成本。' : '添加 OpenAI、Anthropic、Gemini、OpenRouter 或任意 OpenAI 兼容接口（DeepSeek、Grok、本地模型）。'} action={<Button size="sm" onClick={() => setDialog({ provider: 'openai', temperature: 0.7, maxTokens: 4096, enabled: true })}>添加模型服务</Button>} /> : providers.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-[14px] font-medium text-fg">{p.name}</span><Badge>{meta[p.provider]?.label ?? p.provider}</Badge>{!p.enabled ? <Badge tone="muted">已禁用</Badge> : null}</div>
                  <div className="mt-1 text-[12.5px] text-fg-muted">密钥：<span className="font-mono">{p.hasKey ? p.apiKeyMasked : systemKeys.some((k) => k.provider === p.provider) ? '系统环境变量' : <span className="text-danger">缺失</span>}</span>{p.baseUrl ? <span> · {p.baseUrl}</span> : null}</div>
                  <div className="mt-0.5 text-[12.5px] text-fg-dim">默认模型：{p.defaultModel || defaults[p.provider]?.fast} · 向量模型：{p.embeddingModel || defaults[p.provider]?.embedding || '—'} · 温度 {p.temperature} · 最大 Token {p.maxTokens}</div>
                  {testResult[p.id] ? <div className={`mt-1.5 text-[12px] ${testResult[p.id].ok ? 'text-primary' : 'text-danger'}`}>{testResult[p.id].ok ? <Check className="mr-1 inline h-3 w-3" /> : null}{testResult[p.id].message}</div> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="xs" variant="secondary" loading={testing === p.id} onClick={() => test(p)}><Zap className="h-3 w-3" /> 测试</Button>
                  <button onClick={() => setDialog({ ...p, apiKey: '' })} title="编辑" className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setDel(p)} title="移除" className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <Card className="h-fit">
          <CardHeader title="AI 路由" description="为每种任务指定模型服务与模型。留空 = 自动（第一个已启用的服务 + 分层默认模型）。" />
          <div className="divide-y divide-line">
            {tasks.map((t) => {
              const s = settings.find((x) => x.taskType === t.id)
              const p = providers?.find((x) => x.id === s?.providerId) ?? providers?.[0]
              return (
                <div key={t.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_150px_170px]">
                  <div><div className="text-[13px] text-fg">{t.label} <Badge tone="muted">{lbl(TIER_LABELS, t.tier)}</Badge></div><div className="text-[11.5px] text-fg-dim">{t.description}</div></div>
                  <Select value={s?.providerId ?? ''} onChange={(e) => saveTask(t.id, { providerId: e.target.value || null })} className="h-8 py-1 text-[12.5px]"><option value="">自动</option>{(providers ?? []).map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}</Select>
                  <Input list={`models-${p?.id ?? 'none'}`} value={s?.model ?? ''} onChange={(e) => saveTask(t.id, { model: e.target.value || null })} placeholder={tierModel(p, t.tier) || '模型 ID'} className="h-8 py-1 font-mono text-[12px]" />
                </div>
              )
            })}
          </div>
          {(providers ?? []).map((p) => <datalist key={p.id} id={`models-${p.id}`}>{(testResult[p.id]?.models ?? []).map((m) => <option key={m} value={m} />)}{Object.values(defaults[p.provider] ?? {}).map((m) => <option key={m} value={m} />)}</datalist>)}
        </Card>
      </div>
      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} title={dialog?.id ? '编辑模型服务' : '添加模型服务'} footer={<><Button variant="ghost" onClick={() => setDialog(null)}>取消</Button><Button onClick={save} loading={saving}>保存</Button></>}>
        {dialog ? (
          <div className="space-y-3">
            <Field label="服务商"><Select value={dialog.provider} onChange={(e) => setDialog({ ...dialog, provider: e.target.value, baseUrl: e.target.value === 'openai_compatible' ? dialog.baseUrl : '' })}>{Object.entries(meta).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</Select></Field>
            <Field label="显示名称"><Input value={dialog.name ?? ''} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} placeholder={meta[dialog.provider!]?.label} /></Field>
            <Field label="API Key" hint={dialog.id && dialog.hasKey ? '留空则保留当前密钥。' : meta[dialog.provider!]?.docs ? `可前往 ${meta[dialog.provider!].docs} 获取` : undefined}><Input type="password" value={dialog.apiKey ?? ''} onChange={(e) => setDialog({ ...dialog, apiKey: e.target.value })} placeholder={dialog.hasKey ? dialog.apiKeyMasked : 'sk-…'} autoComplete="off" /></Field>
            <Field label="Base URL（可选）" hint={`默认：${meta[dialog.provider!]?.baseUrl}`}><Input value={dialog.baseUrl ?? ''} onChange={(e) => setDialog({ ...dialog, baseUrl: e.target.value })} placeholder={dialog.provider === 'openai_compatible' ? 'https://api.deepseek.com/v1' : ''} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="默认（快速）模型"><Input value={dialog.defaultModel ?? ''} onChange={(e) => setDialog({ ...dialog, defaultModel: e.target.value })} placeholder={defaults[dialog.provider!]?.fast} className="font-mono text-[12.5px]" /></Field>
              <Field label="向量（Embedding）模型"><Input value={dialog.embeddingModel ?? ''} onChange={(e) => setDialog({ ...dialog, embeddingModel: e.target.value })} placeholder={defaults[dialog.provider!]?.embedding ?? '无（本地回退）'} className="font-mono text-[12.5px]" /></Field>
              <Field label="温度（Temperature）"><Input type="number" step={0.1} min={0} max={2} value={dialog.temperature ?? 0.7} onChange={(e) => setDialog({ ...dialog, temperature: Number(e.target.value) })} /></Field>
              <Field label="最大 Token 数"><Input type="number" min={256} value={dialog.maxTokens ?? 4096} onChange={(e) => setDialog({ ...dialog, maxTokens: Number(e.target.value) })} /></Field>
            </div>
            <Switch checked={dialog.enabled ?? true} onChange={(v) => setDialog({ ...dialog, enabled: v })} label="启用" />
            <p className="text-[11.5px] text-fg-dim">强模型任务（项目 DNA、叙事、高质量内容）默认使用 {defaults[dialog.provider!]?.strong}；长文任务默认使用 {defaults[dialog.provider!]?.long}。可在 AI 路由中按任务单独覆盖。</p>
          </div>
        ) : null}
      </Dialog>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`移除 ${del?.name}？`} confirmLabel="移除" danger onConfirm={async () => { if (del) { await api(`/api/settings/providers/${del.id}`, { method: 'DELETE' }); load() } }} />
    </div>
  )
}
