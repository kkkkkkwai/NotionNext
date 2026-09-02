import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { usageSummary } from '@/lib/services/usage'
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui/primitives'
import { formatCost, formatNumber, relativeTime } from '@/lib/utils'

export const metadata = { title: 'AI Usage' }
export const dynamic = 'force-dynamic'

export default async function UsagePage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const u = await usageSummary(session.orgId)
  const maxDay = Math.max(1, ...u.byDay.map((d) => d.cost))
  const Table = ({ title, rows, label }: { title: string; rows: { k: string; calls: number; tokens?: number; cost: number }[]; label: string }) => (
    <Card>
      <CardHeader title={title} />
      {rows.length === 0 ? <div className="p-4 text-[13px] text-fg-dim">No usage yet.</div> : (
        <table className="w-full text-[13px]"><thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-dim"><th className="px-4 py-2 font-medium">{label}</th><th className="px-4 py-2 text-right font-medium">Calls</th>{rows[0].tokens !== undefined ? <th className="px-4 py-2 text-right font-medium">Tokens</th> : null}<th className="px-4 py-2 text-right font-medium">Cost</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.k} className="border-b border-line last:border-0"><td className="px-4 py-2 text-fg">{r.k}</td><td className="px-4 py-2 text-right text-fg-muted">{r.calls}</td>{r.tokens !== undefined ? <td className="px-4 py-2 text-right text-fg-muted">{formatNumber(r.tokens)}</td> : null}<td className="px-4 py-2 text-right text-fg">{formatCost(r.cost)}</td></tr>)}</tbody></table>
      )}
    </Card>
  )
  return (
    <div>
      <PageHeader eyebrow="Settings" title="AI Usage" description="Every AI call is logged with provider, model, task type, tokens, latency and estimated cost." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['AI Calls', formatNumber(u.totals.calls)], ['Input Tokens', formatNumber(u.totals.input)], ['Output Tokens', formatNumber(u.totals.output)], ['Estimated Cost', formatCost(u.totals.cost)]].map(([k, v]) => <Card key={k} className="p-4"><div className="text-[12px] text-fg-muted">{k}</div><div className="mt-1 text-xl font-semibold text-fg">{v}</div></Card>)}
      </div>
      {u.byDay.length ? <Card className="mb-4 p-4"><div className="mb-2 text-[12px] text-fg-muted">Daily cost (last 30 days)</div><div className="flex h-24 items-end gap-1">{u.byDay.map((d) => <div key={d.day} title={`${d.day}: ${formatCost(d.cost)} · ${d.calls} calls`} className="flex-1 rounded-t bg-primary/60" style={{ height: `${Math.max(4, (d.cost / maxDay) * 100)}%` }} />)}</div></Card> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Table title="Cost by Model" label="Model" rows={u.byModel.map((r) => ({ k: `${r.provider} / ${r.model}`, calls: r.calls, tokens: r.tokens, cost: r.cost }))} />
        <Table title="Cost by Task" label="Task" rows={u.byTask.map((r) => ({ k: r.taskType, calls: r.calls, tokens: r.tokens, cost: r.cost }))} />
        <Table title="Cost by Project" label="Project" rows={u.byProject.map((r) => ({ k: r.name ?? '(none)', calls: r.calls, tokens: r.tokens, cost: r.cost }))} />
        <Table title="Cost by Content Type" label="Content type" rows={u.byContentType.map((r) => ({ k: r.contentType ?? '—', calls: r.calls, cost: r.cost }))} />
      </div>
      <Card className="mt-4">
        <CardHeader title="Recent requests" />
        <ul className="divide-y divide-line">{u.recent.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-[12.5px]"><Badge tone={r.status === 'success' ? 'primary' : 'danger'}>{r.status}</Badge><span className="font-mono text-fg">{r.model}</span><Badge>{r.taskType}</Badge><span className="text-fg-dim">{r.inputTokens}→{r.outputTokens} tok · {r.latencyMs}ms · {formatCost(r.cost)}</span><span className="flex-1 truncate text-danger">{r.error ?? ''}</span><span className="text-fg-dim">{relativeTime(r.createdAt)}</span></li>)}{u.recent.length === 0 ? <li className="px-4 py-3 text-[13px] text-fg-dim">No requests yet.</li> : null}</ul>
      </Card>
    </div>
  )
}
