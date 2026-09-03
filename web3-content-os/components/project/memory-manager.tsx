'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, statusLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Lock, Unlock, Pin, PinOff, History, Trash2, Plus, Pencil, RotateCcw, Brain, ArrowRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, Tabs, Textarea } from '@/components/ui/primitives'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { relativeTime } from '@/lib/utils'
import { ConflictsPanel, type ConflictView } from './conflicts-panel'

type Fact = { id: string; key: string; label: string; value: string; category: string; source: string; sourceRef: { sourceName?: string; page?: number; quote?: string }; confidence: number; version: number; status: string; pinned: boolean; updatedAt: string }
type Memory = { id: string; type: string; title: string; content: string; oldValue: string | null; newValue: string | null; pinned: boolean; locked: boolean; status: string; source: string; updatedAt: string }
type Term = { id: string; oldTerm: string; newTerm: string; note: string | null }
type Rule = { id: string; ruleType: string; content: string }
type Event = { id: string; event: string; payload: Record<string, unknown>; actor: string | null; createdAt: string }
type Tab = 'facts' | 'conflicts' | 'brand' | 'terminology' | 'narrative' | 'tokenomics' | 'decisions' | 'ai' | 'archived' | 'history'

const TABS: { id: Tab; label: string }[] = [
  { id: 'facts', label: '关键事实' }, { id: 'conflicts', label: '数据冲突' }, { id: 'brand', label: '品牌规则' }, { id: 'terminology', label: '术语规则' }, { id: 'narrative', label: '叙事' },
  { id: 'tokenomics', label: '代币经济' }, { id: 'decisions', label: '重要决策' }, { id: 'ai', label: 'AI 记忆' }, { id: 'archived', label: '已归档' }, { id: 'history', label: '变更历史' }
]
const MEMORY_TYPES = ['terminology', 'brand_rule', 'decision', 'preference', 'narrative', 'tokenomics', 'note']
const MEMORY_TYPE_LABELS: Record<string, string> = { terminology: '术语', brand_rule: '品牌规则', decision: '决策', preference: '偏好', narrative: '叙事', tokenomics: '代币经济', note: '备注' }
const FACT_STATUS_LABELS: Record<string, string> = { draft: '未确认', confirmed: '已确认', locked: '已锁定', outdated: '已过期', conflict: '冲突' }
const memoryTypeLabel = (t: string) => MEMORY_TYPE_LABELS[t] ?? t.replace('_', ' ')

export function MemoryManager({ projectId }: { projectId: string }) {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('facts')
  const [facts, setFacts] = useState<Fact[] | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [conflicts, setConflicts] = useState<ConflictView[]>([])
  const [error, setError] = useState<string | null>(null)
  const [factDialog, setFactDialog] = useState<Partial<Fact> | null>(null)
  const [memDialog, setMemDialog] = useState<Partial<Memory> | null>(null)
  const [history, setHistory] = useState<{ fact: Fact; versions: { version: number; oldValue: string | null; newValue: string; modifiedBy: string | null; source: string | null; createdAt: string; note: string | null }[] } | null>(null)
  const [del, setDel] = useState<{ kind: 'fact' | 'memory' | 'term' | 'rule'; id: string; label: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    try {
      const [f, m, c] = await Promise.all([api<{ facts: Fact[]; categories: string[] }>(`/api/projects/${projectId}/facts`), api<{ memories: Memory[]; events: Event[]; terminology: Term[]; brandRules: Rule[] }>(`/api/projects/${projectId}/memory?archived=1`), api<{ conflicts: ConflictView[] }>(`/api/projects/${projectId}/conflicts`)])
      setConflicts(c.conflicts)
      setFacts(f.facts)
      setCategories(f.categories)
      setMemories(m.memories)
      setEvents(m.events)
      setTerms(m.terminology)
      setRules(m.brandRules)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [projectId])
  useEffect(() => { load() }, [load])

  const patchFact = async (id: string, patch: Record<string, unknown>, msg?: string) => {
    try {
      await api(`/api/projects/${projectId}/facts/${id}`, { method: 'PATCH', json: patch })
      if (msg) toast.success(msg)
      load()
    } catch (e) {
      toast.error('更新失败', errorMessage(e))
    }
  }
  const saveFact = async () => {
    if (!factDialog) return
    setSaving(true)
    try {
      if (factDialog.id) await api(`/api/projects/${projectId}/facts/${factDialog.id}`, { method: 'PATCH', json: { value: factDialog.value, label: factDialog.label, category: factDialog.category } })
      else await api(`/api/projects/${projectId}/facts`, { method: 'POST', json: { key: factDialog.key || factDialog.label, label: factDialog.label, value: factDialog.value, category: factDialog.category, lock: factDialog.status === 'locked' } })
      setFactDialog(null)
      toast.success('事实已保存')
      load()
    } catch (e) {
      toast.error('保存失败', errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const saveMemory = async () => {
    if (!memDialog) return
    setSaving(true)
    try {
      if (memDialog.id) await api(`/api/projects/${projectId}/memory/${memDialog.id}`, { method: 'PATCH', json: { title: memDialog.title, content: memDialog.content, type: memDialog.type } })
      else await api(`/api/projects/${projectId}/memory`, { method: 'POST', json: memDialog })
      setMemDialog(null)
      toast.success('记忆已保存')
      load()
    } catch (e) {
      toast.error('保存失败', errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const patchMemory = async (id: string, patch: Record<string, unknown>) => {
    try {
      await api(`/api/projects/${projectId}/memory/${id}`, { method: 'PATCH', json: patch })
      load()
    } catch (e) {
      toast.error('更新失败', errorMessage(e))
    }
  }
  const openHistory = async (fact: Fact) => {
    const r = await api<{ versions: NonNullable<typeof history>['versions'] }>(`/api/projects/${projectId}/facts/${fact.id}/history`)
    setHistory({ fact, versions: r.versions })
  }
  const restore = async (version: number) => {
    if (!history) return
    try {
      await api(`/api/projects/${projectId}/facts/${history.fact.id}/restore`, { method: 'POST', json: { version } })
      toast.success(`已恢复到版本 ${version}`)
      setHistory(null)
      load()
    } catch (e) {
      toast.error('恢复失败', errorMessage(e))
    }
  }
  const confirmDelete = async () => {
    if (!del) return
    const url = del.kind === 'fact' ? `facts/${del.id}` : del.kind === 'memory' ? `memory/${del.id}` : del.kind === 'term' ? `terminology/${del.id}` : `brand-rules/${del.id}`
    await api(`/api/projects/${projectId}/${url}`, { method: 'DELETE' })
    load()
  }

  const factList = useMemo(() => (facts ?? []).filter((f) => !filter || `${f.label} ${f.value} ${f.key}`.toLowerCase().includes(filter.toLowerCase())), [facts, filter])
  const memByType = (types: string[]) => memories.filter((m) => types.includes(m.type) && m.status === 'active')
  const tabMemTypes: Record<string, string[]> = { brand: ['brand_rule', 'preference'], narrative: ['narrative'], tokenomics: ['tokenomics'], decisions: ['decision', 'note'], ai: [] }
  const tokenFacts = (facts ?? []).filter((f) => f.category === 'token')

  const MemoryList = ({ items, empty }: { items: Memory[]; empty: string }) => items.length === 0 ? <EmptyState icon={<Brain className="h-5 w-5" />} title={empty} description="手动添加一条，或在「项目 AI 问答」中告诉 AI：“以后……”。" action={<Button size="sm" variant="secondary" onClick={() => setMemDialog({ type: tabMemTypes[tab]?.[0] ?? 'note' })}><Plus className="h-3.5 w-3.5" /> 添加</Button>} /> : (
    <ul className="space-y-2">{items.map((m) => (
      <li key={m.id} className="card flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-medium text-fg">{m.title}</span><Badge>{memoryTypeLabel(m.type)}</Badge>{m.source === 'ai' ? <Badge tone="info">来自对话</Badge> : null}{m.locked ? <Badge tone="primary"><Lock className="h-3 w-3" /> 已锁定</Badge> : null}{m.pinned ? <Badge tone="primary">已置顶</Badge> : null}</div>
          <p className="mt-1 text-[13px] text-fg-muted">{m.content}</p>
          {m.oldValue && m.newValue ? <div className="mt-1.5 inline-flex items-center gap-2 rounded-lg border border-line px-2 py-1 font-mono text-[12px]"><span className="text-fg-dim line-through">{m.oldValue}</span><ArrowRight className="h-3 w-3 text-fg-dim" /><span className="text-primary">{m.newValue}</span></div> : null}
          <div className="mt-1 text-[11px] text-fg-dim">更新于 {relativeTime(m.updatedAt)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button title={m.pinned ? '取消置顶' : '置顶'} onClick={() => patchMemory(m.id, { pinned: !m.pinned })} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg">{m.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</button>
          <button title={m.locked ? '解锁' : '锁定（AI 不可修改）'} onClick={() => patchMemory(m.id, { locked: !m.locked })} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg">{m.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}</button>
          <button title="编辑" onClick={() => setMemDialog(m)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg"><Pencil className="h-3.5 w-3.5" /></button>
          <button title="删除" onClick={() => setDel({ kind: 'memory', id: m.id, label: m.title })} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </li>
    ))}</ul>
  )

  return (
    <div>
      <PageHeader eyebrow="项目记忆" title="记忆" description="结构化事实、品牌规则、术语规则和团队决策。已锁定的条目永远不会被 AI 修改。每条事实都有版本记录，可追溯来源。" actions={<><Button variant="secondary" size="sm" onClick={() => setMemDialog({ type: 'decision' })}><Plus className="h-3.5 w-3.5" /> 添加记忆</Button><Button size="sm" onClick={() => setFactDialog({ category: 'general', status: 'confirmed' })}><Plus className="h-3.5 w-3.5" /> 添加事实</Button></>} />
      <Tabs tabs={TABS.map((t) => ({ ...t, count: t.id === 'facts' ? facts?.length : t.id === 'conflicts' ? conflicts.length : t.id === 'archived' ? memories.filter((m) => m.status === 'archived').length : t.id === 'terminology' ? terms.length : t.id === 'brand' ? rules.length + memByType(['brand_rule', 'preference']).length : t.id === 'ai' ? memories.filter((m) => m.source === 'ai' && m.status === 'active').length : t.id === 'tokenomics' ? tokenFacts.length + memByType(['tokenomics']).length : tabMemTypes[t.id] ? memByType(tabMemTypes[t.id]).length : undefined }))} value={tab} onChange={setTab} className="mb-4" />
      {error ? <ErrorState message={error} retry={load} /> : facts === null ? <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : null}
      {facts && tab === 'facts' ? (
        <Card>
          <CardHeader title="结构化事实" description="一级记忆，优先级最高。已确认 > 未确认；已锁定的事实只能由人工修改。" action={<Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="筛选…" className="h-8 w-44 py-1" />} />
          {factList.length === 0 ? <div className="p-4"><EmptyState title="暂无事实" description="在「知识库」中上传资料以自动提取事实，或手动添加。" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-dim"><th className="px-4 py-2 font-medium">事实</th><th className="px-4 py-2 font-medium">值</th><th className="px-4 py-2 font-medium">来源</th><th className="px-4 py-2 font-medium">状态</th><th className="px-4 py-2 font-medium"></th></tr></thead>
                <tbody>
                  {factList.map((f) => (
                    <tr key={f.id} className="border-b border-line last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 align-top"><div className="flex items-center gap-1.5 text-fg">{f.pinned ? <Pin className="h-3 w-3 text-primary" /> : null}{f.label}</div><div className="text-[11px] text-fg-dim">{factCategoryLabel(f.category)} · v{f.version}</div></td>
                      <td className="max-w-[320px] px-4 py-2.5 align-top text-fg/90"><div className="line-clamp-3">{f.value}</div></td>
                      <td className="px-4 py-2.5 align-top text-[12px] text-fg-muted" title={f.sourceRef?.quote}>{f.sourceRef?.sourceName ? `${f.sourceRef.sourceName}${f.sourceRef.page ? ` · 第 ${f.sourceRef.page} 页` : ''}` : f.source}<div className="text-[11px] text-fg-dim">{Math.round(f.confidence * 100)}% · {relativeTime(f.updatedAt)}</div></td>
                      <td className="px-4 py-2.5 align-top">{f.status === 'locked' ? <Badge tone="primary"><Lock className="h-3 w-3" /> 已锁定</Badge> : f.status === 'confirmed' ? <Badge>已确认</Badge> : f.status === 'draft' ? <Badge tone="warn">未确认</Badge> : <Badge tone="danger">{FACT_STATUS_LABELS[f.status] ?? f.status}</Badge>}</td>
                      <td className="px-2 py-2 align-top">
                        <div className="flex items-center justify-end gap-0.5">
                          {f.status === 'draft' ? <Button size="xs" variant="secondary" onClick={() => patchFact(f.id, { status: 'confirmed' }, '事实已确认')}>确认</Button> : null}
                          <button title={f.status === 'locked' ? '解锁' : '锁定'} onClick={() => patchFact(f.id, { status: f.status === 'locked' ? 'confirmed' : 'locked' })} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg">{f.status === 'locked' ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}</button>
                          <button title={f.pinned ? '取消置顶' : '置顶（始终加入上下文）'} onClick={() => patchFact(f.id, { pinned: !f.pinned })} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg">{f.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</button>
                          <button title="历史版本" onClick={() => openHistory(f)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg"><History className="h-3.5 w-3.5" /></button>
                          <button title="编辑" onClick={() => setFactDialog(f)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg"><Pencil className="h-3.5 w-3.5" /></button>
                          <button title="删除" onClick={() => setDel({ kind: 'fact', id: f.id, label: f.label })} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
      {facts && tab === 'conflicts' ? (conflicts.length ? <ConflictsPanel projectId={projectId} conflicts={conflicts} onChange={load} /> : <EmptyState title="暂无待处理冲突" description="当文档中的值与已确认或已锁定的事实不一致时，会显示在这里，而不会被静默覆盖。" />) : null}
      {facts && tab === 'archived' ? (memories.filter((m) => m.status === 'archived').length === 0 ? <EmptyState title="暂无归档内容" description="删除的记忆会保留在这里，可随时恢复。" /> : <ul className="space-y-2">{memories.filter((m) => m.status === 'archived').map((m) => <li key={m.id} className="card flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><div className="text-[13.5px] text-fg">{m.title} <Badge>{memoryTypeLabel(m.type)}</Badge></div><p className="text-[12.5px] text-fg-muted">{m.content}</p></div><Button size="xs" variant="secondary" onClick={() => patchMemory(m.id, { status: 'active' })}><RotateCcw className="h-3 w-3" /> 恢复</Button></li>)}</ul>) : null}
      {facts && tab === 'brand' ? (
        <div className="space-y-4">
          {rules.length ? <Card><CardHeader title="品牌规则" description="应用于每一次内容生成" /><ul className="divide-y divide-line">{rules.map((r) => <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]"><Badge tone={r.ruleType === 'dont' || r.ruleType === 'restricted_claim' ? 'danger' : 'primary'}>{lbl(RULE_TYPE_LABELS, r.ruleType)}</Badge><span className="flex-1 text-fg/90">{r.content}</span><button title="删除" onClick={() => setDel({ kind: 'rule', id: r.id, label: r.content })} className="text-fg-dim hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button></li>)}</ul></Card> : null}
          <MemoryList items={memByType(['brand_rule', 'preference'])} empty="暂无品牌规则" />
        </div>
      ) : null}
      {facts && tab === 'terminology' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader title="术语规则" description="对每次输出执行的确定性替换，例如 ATM → TOKI" action={<Button size="sm" variant="secondary" onClick={() => setMemDialog({ type: 'terminology', title: '' })}><Plus className="h-3.5 w-3.5" /> 添加规则</Button>} />
            {terms.length === 0 ? <div className="p-4 text-[13px] text-fg-muted">暂无术语规则。可以直接告诉 AI“以后 Token 不叫 ATM，统一叫 TOKI”，或在这里添加。</div> : <ul className="divide-y divide-line">{terms.map((t) => <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]"><span className="font-mono text-fg-dim line-through">{t.oldTerm}</span><ArrowRight className="h-3.5 w-3.5 text-fg-dim" /><span className="font-mono text-primary">{t.newTerm}</span><span className="flex-1 text-[12px] text-fg-dim">{t.note}</span><button title="删除" onClick={() => setDel({ kind: 'term', id: t.id, label: `${t.oldTerm} → ${t.newTerm}` })} className="text-fg-dim hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button></li>)}</ul>}
          </Card>
          <div className="flex items-start gap-2 rounded-xl border border-line p-3 text-[12.5px] text-fg-muted"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />使用「一致性检查」可以找出仍在使用旧术语的历史内容，并一键批量更新。</div>
        </div>
      ) : null}
      {facts && tab === 'narrative' ? <MemoryList items={memByType(['narrative'])} empty="暂无叙事记忆" /> : null}
      {facts && tab === 'tokenomics' ? (
        <div className="space-y-4">
          {tokenFacts.length ? <Card><CardHeader title="Token 事实" /><ul className="divide-y divide-line">{tokenFacts.map((f) => <li key={f.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]"><span className="text-fg-muted">{f.label}</span><span className="flex items-center gap-2 text-fg">{f.value}{f.status === 'locked' ? <Lock className="h-3 w-3 text-primary" /> : null}</span></li>)}</ul></Card> : null}
          <MemoryList items={memByType(['tokenomics'])} empty="暂无代币经济记忆" />
        </div>
      ) : null}
      {facts && tab === 'decisions' ? <MemoryList items={memByType(['decision', 'note'])} empty="暂无决策记录" /> : null}
      {facts && tab === 'ai' ? <MemoryList items={memories.filter((m) => m.source === 'ai' && m.status === 'active')} empty="AI 尚未从对话中保存任何记忆" /> : null}
      {facts && tab === 'history' ? (
        <Card><CardHeader title="记忆事件" description="记忆变更的审计记录" />{events.length === 0 ? <div className="p-4 text-[13px] text-fg-muted">暂无事件。</div> : <ul className="divide-y divide-line">{events.map((e) => <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]"><Badge>{lbl(EVENT_LABELS, e.event)}</Badge><span className="flex-1 truncate text-fg-muted">{String((e.payload as { title?: string; after?: { title?: string } }).title ?? (e.payload as { after?: { title?: string } }).after?.title ?? '')}</span><span className="text-[12px] text-fg-dim">{e.actor === 'ai' ? 'AI' : '用户'} · {relativeTime(e.createdAt)}</span></li>)}</ul>}</Card>
      ) : null}

      <Dialog open={Boolean(factDialog)} onClose={() => setFactDialog(null)} title={factDialog?.id ? '编辑事实' : '添加事实'} description={factDialog?.id ? `将创建版本 ${(factDialog.version ?? 1) + 1}` : '用户确认的事实优先于文档中的任何内容。'} footer={<><Button variant="ghost" onClick={() => setFactDialog(null)}>取消</Button><Button onClick={saveFact} loading={saving}>保存</Button></>}>
        {factDialog ? (
          <div className="space-y-3">
            <Field label="名称"><Input value={factDialog.label ?? ''} onChange={(e) => setFactDialog({ ...factDialog, label: e.target.value })} placeholder="例如：Token 总量" /></Field>
            {!factDialog.id ? <Field label="Key（可选）" hint="snake_case 格式的标识，例如 token_supply"><Input value={factDialog.key ?? ''} onChange={(e) => setFactDialog({ ...factDialog, key: e.target.value })} /></Field> : null}
            <Field label="值"><Textarea rows={3} value={factDialog.value ?? ''} onChange={(e) => setFactDialog({ ...factDialog, value: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="分类"><Select value={factDialog.category ?? 'general'} onChange={(e) => setFactDialog({ ...factDialog, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</Select></Field>{!factDialog.id ? <Field label="锁定"><Select value={factDialog.status ?? 'confirmed'} onChange={(e) => setFactDialog({ ...factDialog, status: e.target.value })}><option value="confirmed">已确认</option><option value="locked">已锁定（AI 不可修改）</option></Select></Field> : null}</div>
          </div>
        ) : null}
      </Dialog>
      <Dialog open={Boolean(memDialog)} onClose={() => setMemDialog(null)} title={memDialog?.id ? '编辑记忆' : '添加记忆'} footer={<><Button variant="ghost" onClick={() => setMemDialog(null)}>取消</Button><Button onClick={saveMemory} loading={saving}>保存</Button></>}>
        {memDialog ? (
          <div className="space-y-3">
            <Field label="类型"><Select value={memDialog.type ?? 'note'} onChange={(e) => setMemDialog({ ...memDialog, type: e.target.value })}>{MEMORY_TYPES.map((t) => <option key={t} value={t}>{memoryTypeLabel(t)}</option>)}</Select></Field>
            {memDialog.type === 'terminology' ? <div className="grid grid-cols-2 gap-3"><Field label="旧术语"><Input value={memDialog.oldValue ?? ''} onChange={(e) => setMemDialog({ ...memDialog, oldValue: e.target.value, title: memDialog.title || `重命名 ${e.target.value}` })} placeholder="ATM" /></Field><Field label="新术语"><Input value={memDialog.newValue ?? ''} onChange={(e) => setMemDialog({ ...memDialog, newValue: e.target.value })} placeholder="TOKI" /></Field></div> : null}
            <Field label="标题"><Input value={memDialog.title ?? ''} onChange={(e) => setMemDialog({ ...memDialog, title: e.target.value })} placeholder="简短标题" /></Field>
            <Field label="内容"><Textarea rows={3} value={memDialog.content ?? ''} onChange={(e) => setMemDialog({ ...memDialog, content: e.target.value })} placeholder="用一句话描述这条规则" /></Field>
          </div>
        ) : null}
      </Dialog>
      <Dialog open={Boolean(history)} onClose={() => setHistory(null)} title={`历史版本 — ${history?.fact.label}`} description="可恢复任意历史值。恢复会创建一个新版本。">
        <ul className="space-y-2">{history?.versions.map((v) => <li key={v.version} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 text-[13px]"><div><div className="flex items-center gap-2"><Badge tone={v.version === history.fact.version ? 'primary' : 'neutral'}>v{v.version}</Badge><span className="text-fg">{v.newValue}</span></div><div className="mt-0.5 text-[11px] text-fg-dim">{v.oldValue ? `原值：${v.oldValue} · ` : ''}{v.source ?? ''} · {v.modifiedBy === 'ai' ? 'AI' : '用户'} · {relativeTime(v.createdAt)}{v.note ? ` · ${v.note}` : ''}</div></div>{v.version !== history.fact.version ? <Button size="xs" variant="secondary" onClick={() => restore(v.version)}><RotateCcw className="h-3 w-3" /> 恢复</Button> : null}</li>)}</ul>
      </Dialog>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`删除「${del?.label}」？`} confirmLabel="删除" danger onConfirm={confirmDelete} />
    </div>
  )
}
