'use client'
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
  { id: 'facts', label: 'Key Facts' }, { id: 'conflicts', label: 'Conflicts' }, { id: 'brand', label: 'Brand Rules' }, { id: 'terminology', label: 'Terminology' }, { id: 'narrative', label: 'Narrative' },
  { id: 'tokenomics', label: 'Tokenomics' }, { id: 'decisions', label: 'Important Decisions' }, { id: 'ai', label: 'AI Memories' }, { id: 'archived', label: 'Archived' }, { id: 'history', label: 'History' }
]

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
      toast.error('Update failed', errorMessage(e))
    }
  }
  const saveFact = async () => {
    if (!factDialog) return
    setSaving(true)
    try {
      if (factDialog.id) await api(`/api/projects/${projectId}/facts/${factDialog.id}`, { method: 'PATCH', json: { value: factDialog.value, label: factDialog.label, category: factDialog.category } })
      else await api(`/api/projects/${projectId}/facts`, { method: 'POST', json: { key: factDialog.key || factDialog.label, label: factDialog.label, value: factDialog.value, category: factDialog.category, lock: factDialog.status === 'locked' } })
      setFactDialog(null)
      toast.success('Fact saved')
      load()
    } catch (e) {
      toast.error('Save failed', errorMessage(e))
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
      toast.success('Memory saved')
      load()
    } catch (e) {
      toast.error('Save failed', errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const patchMemory = async (id: string, patch: Record<string, unknown>) => {
    try {
      await api(`/api/projects/${projectId}/memory/${id}`, { method: 'PATCH', json: patch })
      load()
    } catch (e) {
      toast.error('Update failed', errorMessage(e))
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
      toast.success(`Restored version ${version}`)
      setHistory(null)
      load()
    } catch (e) {
      toast.error('Restore failed', errorMessage(e))
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

  const MemoryList = ({ items, empty }: { items: Memory[]; empty: string }) => items.length === 0 ? <EmptyState icon={<Brain className="h-5 w-5" />} title={empty} description="Add one manually or tell Ask Project AI: “From now on…”." action={<Button size="sm" variant="secondary" onClick={() => setMemDialog({ type: tabMemTypes[tab]?.[0] ?? 'note' })}><Plus className="h-3.5 w-3.5" /> Add</Button>} /> : (
    <ul className="space-y-2">{items.map((m) => (
      <li key={m.id} className="card flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-medium text-fg">{m.title}</span><Badge>{m.type.replace('_', ' ')}</Badge>{m.source === 'ai' ? <Badge tone="info">from chat</Badge> : null}{m.locked ? <Badge tone="primary"><Lock className="h-3 w-3" /> locked</Badge> : null}{m.pinned ? <Badge tone="primary">pinned</Badge> : null}</div>
          <p className="mt-1 text-[13px] text-fg-muted">{m.content}</p>
          {m.oldValue && m.newValue ? <div className="mt-1.5 inline-flex items-center gap-2 rounded-lg border border-line px-2 py-1 font-mono text-[12px]"><span className="text-fg-dim line-through">{m.oldValue}</span><ArrowRight className="h-3 w-3 text-fg-dim" /><span className="text-primary">{m.newValue}</span></div> : null}
          <div className="mt-1 text-[11px] text-fg-dim">Updated {relativeTime(m.updatedAt)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button title={m.pinned ? 'Unpin' : 'Pin'} onClick={() => patchMemory(m.id, { pinned: !m.pinned })} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg">{m.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</button>
          <button title={m.locked ? 'Unlock' : 'Lock (AI cannot change)'} onClick={() => patchMemory(m.id, { locked: !m.locked })} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg">{m.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}</button>
          <button title="Edit" onClick={() => setMemDialog(m)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg"><Pencil className="h-3.5 w-3.5" /></button>
          <button title="Delete" onClick={() => setDel({ kind: 'memory', id: m.id, label: m.title })} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </li>
    ))}</ul>
  )

  return (
    <div>
      <PageHeader eyebrow="Project Memory" title="Memory" description="Structured facts, brand rules, terminology and team decisions. Locked items are never changed by AI. Every fact is versioned and traceable to its source." actions={<><Button variant="secondary" size="sm" onClick={() => setMemDialog({ type: 'decision' })}><Plus className="h-3.5 w-3.5" /> Add Memory</Button><Button size="sm" onClick={() => setFactDialog({ category: 'general', status: 'confirmed' })}><Plus className="h-3.5 w-3.5" /> Add Fact</Button></>} />
      <Tabs tabs={TABS.map((t) => ({ ...t, count: t.id === 'facts' ? facts?.length : t.id === 'conflicts' ? conflicts.length : t.id === 'archived' ? memories.filter((m) => m.status === 'archived').length : t.id === 'terminology' ? terms.length : t.id === 'brand' ? rules.length + memByType(['brand_rule', 'preference']).length : t.id === 'ai' ? memories.filter((m) => m.source === 'ai' && m.status === 'active').length : t.id === 'tokenomics' ? tokenFacts.length + memByType(['tokenomics']).length : tabMemTypes[t.id] ? memByType(tabMemTypes[t.id]).length : undefined }))} value={tab} onChange={setTab} className="mb-4" />
      {error ? <ErrorState message={error} retry={load} /> : facts === null ? <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : null}
      {facts && tab === 'facts' ? (
        <Card>
          <CardHeader title="Structured Facts" description="Level-1 memory: highest priority. Confirmed > unconfirmed. Locked requires human edit." action={<Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" className="h-8 w-44 py-1" />} />
          {factList.length === 0 ? <div className="p-4"><EmptyState title="No facts yet" description="Upload materials in Knowledge Base to extract facts automatically, or add them by hand." /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-dim"><th className="px-4 py-2 font-medium">Fact</th><th className="px-4 py-2 font-medium">Value</th><th className="px-4 py-2 font-medium">Source</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium"></th></tr></thead>
                <tbody>
                  {factList.map((f) => (
                    <tr key={f.id} className="border-b border-line last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 align-top"><div className="flex items-center gap-1.5 text-fg">{f.pinned ? <Pin className="h-3 w-3 text-primary" /> : null}{f.label}</div><div className="text-[11px] text-fg-dim">{f.category} · v{f.version}</div></td>
                      <td className="max-w-[320px] px-4 py-2.5 align-top text-fg/90"><div className="line-clamp-3">{f.value}</div></td>
                      <td className="px-4 py-2.5 align-top text-[12px] text-fg-muted" title={f.sourceRef?.quote}>{f.sourceRef?.sourceName ? `${f.sourceRef.sourceName}${f.sourceRef.page ? ` · p.${f.sourceRef.page}` : ''}` : f.source}<div className="text-[11px] text-fg-dim">{Math.round(f.confidence * 100)}% · {relativeTime(f.updatedAt)}</div></td>
                      <td className="px-4 py-2.5 align-top">{f.status === 'locked' ? <Badge tone="primary"><Lock className="h-3 w-3" /> locked</Badge> : f.status === 'confirmed' ? <Badge>confirmed</Badge> : f.status === 'draft' ? <Badge tone="warn">unconfirmed</Badge> : <Badge tone="danger">{f.status}</Badge>}</td>
                      <td className="px-2 py-2 align-top">
                        <div className="flex items-center justify-end gap-0.5">
                          {f.status === 'draft' ? <Button size="xs" variant="secondary" onClick={() => patchFact(f.id, { status: 'confirmed' }, 'Fact confirmed')}>Confirm</Button> : null}
                          <button title={f.status === 'locked' ? 'Unlock' : 'Lock'} onClick={() => patchFact(f.id, { status: f.status === 'locked' ? 'confirmed' : 'locked' })} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg">{f.status === 'locked' ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}</button>
                          <button title={f.pinned ? 'Unpin' : 'Pin (always in context)'} onClick={() => patchFact(f.id, { pinned: !f.pinned })} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg">{f.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</button>
                          <button title="History" onClick={() => openHistory(f)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg"><History className="h-3.5 w-3.5" /></button>
                          <button title="Edit" onClick={() => setFactDialog(f)} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg"><Pencil className="h-3.5 w-3.5" /></button>
                          <button title="Delete" onClick={() => setDel({ kind: 'fact', id: f.id, label: f.label })} className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
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
      {facts && tab === 'conflicts' ? (conflicts.length ? <ConflictsPanel projectId={projectId} conflicts={conflicts} onChange={load} /> : <EmptyState title="No open conflicts" description="When a document proposes a value that differs from a confirmed or locked fact, it shows up here instead of silently overwriting it." />) : null}
      {facts && tab === 'archived' ? (memories.filter((m) => m.status === 'archived').length === 0 ? <EmptyState title="Nothing archived" description="Deleted memories are kept here and can be restored." /> : <ul className="space-y-2">{memories.filter((m) => m.status === 'archived').map((m) => <li key={m.id} className="card flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><div className="text-[13.5px] text-fg">{m.title} <Badge>{m.type.replace('_', ' ')}</Badge></div><p className="text-[12.5px] text-fg-muted">{m.content}</p></div><Button size="xs" variant="secondary" onClick={() => patchMemory(m.id, { status: 'active' })}><RotateCcw className="h-3 w-3" /> Restore</Button></li>)}</ul>) : null}
      {facts && tab === 'brand' ? (
        <div className="space-y-4">
          {rules.length ? <Card><CardHeader title="Brand Rules" description="Applied to every generation" /><ul className="divide-y divide-line">{rules.map((r) => <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]"><Badge tone={r.ruleType === 'dont' || r.ruleType === 'restricted_claim' ? 'danger' : 'primary'}>{r.ruleType}</Badge><span className="flex-1 text-fg/90">{r.content}</span><button onClick={() => setDel({ kind: 'rule', id: r.id, label: r.content })} className="text-fg-dim hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button></li>)}</ul></Card> : null}
          <MemoryList items={memByType(['brand_rule', 'preference'])} empty="No brand rules yet" />
        </div>
      ) : null}
      {facts && tab === 'terminology' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Terminology Rules" description="Deterministic replacements applied to every output, e.g. ATM → TOKI" action={<Button size="sm" variant="secondary" onClick={() => setMemDialog({ type: 'terminology', title: '' })}><Plus className="h-3.5 w-3.5" /> Add rule</Button>} />
            {terms.length === 0 ? <div className="p-4 text-[13px] text-fg-muted">No terminology rules. Tell the AI “以后 Token 不叫 ATM，统一叫 TOKI” or add one here.</div> : <ul className="divide-y divide-line">{terms.map((t) => <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]"><span className="font-mono text-fg-dim line-through">{t.oldTerm}</span><ArrowRight className="h-3.5 w-3.5 text-fg-dim" /><span className="font-mono text-primary">{t.newTerm}</span><span className="flex-1 text-[12px] text-fg-dim">{t.note}</span><button onClick={() => setDel({ kind: 'term', id: t.id, label: `${t.oldTerm} → ${t.newTerm}` })} className="text-fg-dim hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button></li>)}</ul>}
          </Card>
          <div className="flex items-start gap-2 rounded-xl border border-line p-3 text-[12.5px] text-fg-muted"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Use Consistency Check to find historical content that still uses the old term and update it all at once.</div>
        </div>
      ) : null}
      {facts && tab === 'narrative' ? <MemoryList items={memByType(['narrative'])} empty="No narrative memories" /> : null}
      {facts && tab === 'tokenomics' ? (
        <div className="space-y-4">
          {tokenFacts.length ? <Card><CardHeader title="Token Facts" /><ul className="divide-y divide-line">{tokenFacts.map((f) => <li key={f.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]"><span className="text-fg-muted">{f.label}</span><span className="flex items-center gap-2 text-fg">{f.value}{f.status === 'locked' ? <Lock className="h-3 w-3 text-primary" /> : null}</span></li>)}</ul></Card> : null}
          <MemoryList items={memByType(['tokenomics'])} empty="No tokenomics memories" />
        </div>
      ) : null}
      {facts && tab === 'decisions' ? <MemoryList items={memByType(['decision', 'note'])} empty="No decisions recorded" /> : null}
      {facts && tab === 'ai' ? <MemoryList items={memories.filter((m) => m.source === 'ai' && m.status === 'active')} empty="The AI has not saved memories from conversations yet" /> : null}
      {facts && tab === 'history' ? (
        <Card><CardHeader title="Memory Events" description="Audit trail of memory changes" />{events.length === 0 ? <div className="p-4 text-[13px] text-fg-muted">No events yet.</div> : <ul className="divide-y divide-line">{events.map((e) => <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]"><Badge>{e.event}</Badge><span className="flex-1 truncate text-fg-muted">{String((e.payload as { title?: string; after?: { title?: string } }).title ?? (e.payload as { after?: { title?: string } }).after?.title ?? '')}</span><span className="text-[12px] text-fg-dim">{e.actor === 'ai' ? 'AI' : 'User'} · {relativeTime(e.createdAt)}</span></li>)}</ul>}</Card>
      ) : null}

      <Dialog open={Boolean(factDialog)} onClose={() => setFactDialog(null)} title={factDialog?.id ? 'Edit fact' : 'Add fact'} description={factDialog?.id ? `Creates version ${(factDialog.version ?? 1) + 1}` : 'User-confirmed facts override anything found in documents.'} footer={<><Button variant="ghost" onClick={() => setFactDialog(null)}>Cancel</Button><Button onClick={saveFact} loading={saving}>Save</Button></>}>
        {factDialog ? (
          <div className="space-y-3">
            <Field label="Label"><Input value={factDialog.label ?? ''} onChange={(e) => setFactDialog({ ...factDialog, label: e.target.value })} placeholder="Token Supply" /></Field>
            {!factDialog.id ? <Field label="Key (optional)" hint="snake_case id, e.g. token_supply"><Input value={factDialog.key ?? ''} onChange={(e) => setFactDialog({ ...factDialog, key: e.target.value })} /></Field> : null}
            <Field label="Value"><Textarea rows={3} value={factDialog.value ?? ''} onChange={(e) => setFactDialog({ ...factDialog, value: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Category"><Select value={factDialog.category ?? 'general'} onChange={(e) => setFactDialog({ ...factDialog, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</Select></Field>{!factDialog.id ? <Field label="Lock"><Select value={factDialog.status ?? 'confirmed'} onChange={(e) => setFactDialog({ ...factDialog, status: e.target.value })}><option value="confirmed">Confirmed</option><option value="locked">Locked (AI cannot change)</option></Select></Field> : null}</div>
          </div>
        ) : null}
      </Dialog>
      <Dialog open={Boolean(memDialog)} onClose={() => setMemDialog(null)} title={memDialog?.id ? 'Edit memory' : 'Add memory'} footer={<><Button variant="ghost" onClick={() => setMemDialog(null)}>Cancel</Button><Button onClick={saveMemory} loading={saving}>Save</Button></>}>
        {memDialog ? (
          <div className="space-y-3">
            <Field label="Type"><Select value={memDialog.type ?? 'note'} onChange={(e) => setMemDialog({ ...memDialog, type: e.target.value })}>{['terminology', 'brand_rule', 'decision', 'preference', 'narrative', 'tokenomics', 'note'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</Select></Field>
            {memDialog.type === 'terminology' ? <div className="grid grid-cols-2 gap-3"><Field label="Old term"><Input value={memDialog.oldValue ?? ''} onChange={(e) => setMemDialog({ ...memDialog, oldValue: e.target.value, title: memDialog.title || `Rename ${e.target.value}` })} placeholder="ATM" /></Field><Field label="New term"><Input value={memDialog.newValue ?? ''} onChange={(e) => setMemDialog({ ...memDialog, newValue: e.target.value })} placeholder="TOKI" /></Field></div> : null}
            <Field label="Title"><Input value={memDialog.title ?? ''} onChange={(e) => setMemDialog({ ...memDialog, title: e.target.value })} placeholder="Short title" /></Field>
            <Field label="Content"><Textarea rows={3} value={memDialog.content ?? ''} onChange={(e) => setMemDialog({ ...memDialog, content: e.target.value })} placeholder="The rule in one sentence" /></Field>
          </div>
        ) : null}
      </Dialog>
      <Dialog open={Boolean(history)} onClose={() => setHistory(null)} title={`History — ${history?.fact.label}`} description="Restore any previous value. Restoring creates a new version.">
        <ul className="space-y-2">{history?.versions.map((v) => <li key={v.version} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 text-[13px]"><div><div className="flex items-center gap-2"><Badge tone={v.version === history.fact.version ? 'primary' : 'neutral'}>v{v.version}</Badge><span className="text-fg">{v.newValue}</span></div><div className="mt-0.5 text-[11px] text-fg-dim">{v.oldValue ? `was: ${v.oldValue} · ` : ''}{v.source ?? ''} · {v.modifiedBy === 'ai' ? 'AI' : 'User'} · {relativeTime(v.createdAt)}{v.note ? ` · ${v.note}` : ''}</div></div>{v.version !== history.fact.version ? <Button size="xs" variant="secondary" onClick={() => restore(v.version)}><RotateCcw className="h-3 w-3" /> Restore</Button> : null}</li>)}</ul>
      </Dialog>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`Delete "${del?.label}"?`} confirmLabel="Delete" danger onConfirm={confirmDelete} />
    </div>
  )
}
