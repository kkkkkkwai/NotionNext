'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Send, Plus, Trash2, Square, Brain, BookOpen, Database, MessageSquare, Sparkles } from 'lucide-react'
import { Markdown } from '@/components/ui/markdown'
import { Badge, Switch } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage, readSSE } from '@/lib/client'
import { cn, relativeTime } from '@/lib/utils'

type Conv = { id: string; title: string; updatedAt: string }
type Msg = { id: string; role: 'user' | 'assistant'; content: string; meta?: { sources?: { type: string; label: string }[]; model?: string }; streaming?: boolean; status?: string }

const SUGGESTIONS = ['What are our core selling points?', '帮我写今天的 Twitter', 'What have we not talked about yet?', 'What did we publish this week?', 'What would an investor ask us?', '上线前 7 天应该发什么？']

export function AskProjectAI({ projectId, projectName, tokenSymbol }: { projectId: string; projectName: string; tokenSymbol: string | null }) {
  const toast = useToast()
  const [convs, setConvs] = useState<Conv[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [useMemory, setUseMemory] = useState(true)
  const [context, setContext] = useState<{ sources: { type: string; label: string }[]; taskClass: string; tokens: number } | null>(null)
  const abort = useRef<AbortController | null>(null)
  const busyRef = useRef(false)
  const bottom = useRef<HTMLDivElement>(null)
  const aiName = `${tokenSymbol ? tokenSymbol.replace(/^\$/, '') : projectName.split(' ')[0]} AI`

  const loadConvs = useCallback(async () => {
    const r = await api<{ conversations: Conv[] }>(`/api/projects/${projectId}/chat/conversations`)
    setConvs(r.conversations)
  }, [projectId])
  useEffect(() => { loadConvs().catch((e) => toast.error('Could not load conversations', errorMessage(e))) }, [loadConvs, toast])
  useEffect(() => {
    if (busyRef.current) return // a stream is in progress: keep the optimistic messages
    if (!active) {
      setMessages([])
      return
    }
    api<{ messages: Msg[] }>(`/api/projects/${projectId}/chat/conversations/${active}`).then((r) => setMessages(r.messages)).catch(() => setMessages([]))
  }, [active, projectId])
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || busy) return
    setInput('')
    setBusy(true)
    busyRef.current = true
    setContext(null)
    const tempId = 'tmp-' + Date.now()
    setMessages((m) => [...m, { id: tempId + 'u', role: 'user', content: msg }, { id: tempId, role: 'assistant', content: '', streaming: true, status: 'Reading project memory…' }])
    const ctrl = new AbortController()
    abort.current = ctrl
    let convId = active
    try {
      const res = await fetch(`/api/projects/${projectId}/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: active, message: msg, useMemory }), signal: ctrl.signal })
      await readSSE(res, (event, data) => {
        const d = data as Record<string, unknown>
        if (event === 'conversation') {
          convId = d.id as string
          if (!active) setActive(convId)
        } else if (event === 'status') setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, status: String(d.step) } : x)))
        else if (event === 'context') setContext(d as never)
        else if (event === 'delta') setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, content: x.content + String(d.text), status: undefined } : x)))
        else if (event === 'message') setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, id: String(d.id), content: String(d.content), streaming: false, meta: { model: String(d.model) } } : x)))
        else if (event === 'memories') {
          const list = d as unknown as { title: string }[]
          toast.success('Saved to long-term memory', list.map((x) => x.title).join(' · '))
        } else if (event === 'error') {
          const message = String(d.message)
          setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, content: x.content || `⚠️ ${message}`, streaming: false, status: undefined } : x)))
          toast.error('AI error', message)
        }
      }, ctrl.signal)
    } catch (e) {
      if (!ctrl.signal.aborted) {
        const message = errorMessage(e)
        setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, content: `⚠️ ${message}`, streaming: false, status: undefined } : x)))
        toast.error('Request failed', message)
      }
    } finally {
      busyRef.current = false
      setBusy(false)
      setMessages((m) => m.map((x) => ({ ...x, streaming: false, status: undefined })))
      loadConvs().catch(() => {})
    }
  }
  const stop = () => abort.current?.abort()
  const remove = async (id: string) => {
    await api(`/api/projects/${projectId}/chat/conversations/${id}`, { method: 'DELETE' })
    if (active === id) setActive(null)
    loadConvs()
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col lg:h-[calc(100vh-6.5rem)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">Project AI Brand Manager</div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Ask {aiName}</h1>
        </div>
        <Switch checked={useMemory} onChange={setUseMemory} label="Use Project Memory" />
      </div>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_1fr_240px]">
        <aside className="card hidden min-h-0 flex-col lg:flex">
          <button onClick={() => setActive(null)} className="m-2 flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[13px] text-fg hover:bg-white/[0.04]"><Plus className="h-3.5 w-3.5" /> New conversation</button>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {convs.map((c) => (
              <div key={c.id} className={cn('group flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px]', active === c.id ? 'bg-white/[0.06] text-fg' : 'text-fg-muted hover:bg-white/[0.03]')}>
                <button onClick={() => setActive(c.id)} className="min-w-0 flex-1 truncate text-left" title={c.title}>{c.title}</button>
                <button onClick={() => remove(c.id)} className="hidden text-fg-dim hover:text-danger group-hover:block"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            {convs.length === 0 ? <div className="px-2 py-4 text-[12px] text-fg-dim">No conversations yet.</div> : null}
          </div>
        </aside>
        <section className="card flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MessageSquare className="h-5 w-5" /></div>
                <div className="text-[15px] font-medium text-fg">{aiName} knows this project.</div>
                <p className="mt-1 max-w-md text-[13px] text-fg-muted">Facts, DNA, knowledge base, memory and content history — you never have to re-explain the project. Rules you state here (“from now on…”) are remembered.</p>
                <div className="mt-5 flex max-w-lg flex-wrap justify-center gap-2">{SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-fg-muted transition hover:border-primary/40 hover:text-fg">{s}</button>)}</div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((m) => (
                  <div key={m.id} className={cn('flex gap-3', m.role === 'user' ? 'justify-end' : '')}>
                    {m.role === 'assistant' ? <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[10px] font-bold text-primary">AI</div> : null}
                    <div className={cn('max-w-[85%] rounded-2xl px-4 py-3', m.role === 'user' ? 'bg-white/[0.06] text-fg' : 'border border-line bg-white/[0.02]')}>
                      {m.role === 'user' ? <p className="whitespace-pre-wrap text-[14px]">{m.content}</p> : m.status ? <div className="flex items-center gap-2 text-[13px] text-fg-muted"><Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />{m.status}</div> : <Markdown>{m.content + (m.streaming ? ' ▍' : '')}</Markdown>}
                      {m.role === 'assistant' && m.meta?.model ? <div className="mt-2 text-[10.5px] text-fg-dim">{m.meta.model}</div> : null}
                    </div>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
            )}
          </div>
          <div className="border-t border-line p-3">
            <div className="flex items-end gap-2 rounded-xl border border-line bg-bg-soft p-2 focus-within:border-primary/50">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} rows={1} placeholder={`Ask ${aiName} anything, or say “帮我写今天的推文”`} className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] text-fg outline-none placeholder:text-fg-dim" />
              {busy ? <button onClick={stop} className="rounded-lg bg-white/[0.08] p-2.5 text-fg hover:bg-white/[0.12]" title="Stop"><Square className="h-4 w-4" /></button> : <button onClick={() => send()} disabled={!input.trim()} className="rounded-lg bg-primary p-2.5 text-primary-text disabled:opacity-40" title="Send"><Send className="h-4 w-4" /></button>}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-fg-dim"><span>Enter to send · Shift+Enter for newline</span><span>Isolated to {projectName}</span></div>
          </div>
        </section>
        <aside className="card hidden min-h-0 flex-col overflow-y-auto lg:flex">
          <div className="border-b border-line px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-fg-dim">Context used</div>
          {context ? (
            <div className="space-y-3 p-4 text-[12.5px]">
              <div className="flex items-center justify-between text-fg-muted"><span>Task class</span><Badge>{context.taskClass}</Badge></div>
              <div className="flex items-center justify-between text-fg-muted"><span>Context size</span><span className="text-fg">~{context.tokens} tokens</span></div>
              {(['fact', 'memory', 'chunk'] as const).map((t) => {
                const items = context.sources.filter((s) => s.type === t)
                if (!items.length) return null
                return <div key={t}><div className="mb-1 flex items-center gap-1.5 text-fg-muted">{t === 'fact' ? <Database className="h-3.5 w-3.5" /> : t === 'memory' ? <Brain className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}{t === 'fact' ? 'Facts' : t === 'memory' ? 'Memories' : 'Knowledge'} ({items.length})</div><ul className="space-y-0.5">{items.slice(0, 8).map((s, i) => <li key={i} className="truncate text-fg-dim" title={s.label}>· {s.label}</li>)}</ul></div>
              })}
            </div>
          ) : (
            <div className="p-4 text-[12.5px] text-fg-dim">After each question you can see which facts, memories and documents the AI read — only from this project.<div className="mt-3 space-y-1"><Link href={`/projects/${projectId}/memory`} className="block text-primary hover:underline">Manage memory →</Link><Link href={`/projects/${projectId}/knowledge`} className="block text-primary hover:underline">Add materials →</Link></div></div>
          )}
        </aside>
      </div>
    </div>
  )
}
