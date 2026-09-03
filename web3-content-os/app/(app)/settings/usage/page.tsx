import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, statusLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { usageSummary } from '@/lib/services/usage'
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui/primitives'
import { formatCost, formatNumber, relativeTime } from '@/lib/utils'

export const metadata = { title: 'AI 用量' }
export const dynamic = 'force-dynamic'

export default async function UsagePage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const u = await usageSummary(session.orgId)
  const maxDay = Math.max(1, ...u.byDay.map((d) => d.cost))
  const Table = ({ title, rows, label }: { title: string; rows: { k: string; calls: number; tokens?: number; cost: number }[]; label: string }) => (
    <Card>
      <CardHeader title={title} />
      {rows.length === 0 ? <div className="p-4 text-[13px] text-fg-dim">暂无用量数据。</div> : (
        <table className="w-full text-[13px]"><thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-dim"><th className="px-4 py-2 font-medium">{label}</th><th className="px-4 py-2 text-right font-medium">调用次数</th>{rows[0].tokens !== undefined ? <th className="px-4 py-2 text-right font-medium">Token 数</th> : null}<th className="px-4 py-2 text-right font-medium">成本</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.k} className="border-b border-line last:border-0"><td className="px-4 py-2 text-fg">{r.k}</td><td className="px-4 py-2 text-right text-fg-muted">{r.calls}</td>{r.tokens !== undefined ? <td className="px-4 py-2 text-right text-fg-muted">{formatNumber(r.tokens)}</td> : null}<td className="px-4 py-2 text-right text-fg">{formatCost(r.cost)}</td></tr>)}</tbody></table>
      )}
    </Card>
  )
  return (
    <div>
      <PageHeader eyebrow="设置" title="AI 用量" description="每次 AI 调用都会记录服务商、模型、任务类型、Token 数、延迟与估算成本。" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['AI 调用次数', formatNumber(u.totals.calls)], ['输入 Token', formatNumber(u.totals.input)], ['输出 Token', formatNumber(u.totals.output)], ['估算成本', formatCost(u.totals.cost)]].map(([k, v]) => <Card key={k} className="p-4"><div className="text-[12px] text-fg-muted">{k}</div><div className="mt-1 text-xl font-semibold text-fg">{v}</div></Card>)}
      </div>
      {u.byDay.length ? <Card className="mb-4 p-4"><div className="mb-2 text-[12px] text-fg-muted">每日成本（最近 30 天）</div><div className="flex h-24 items-end gap-1">{u.byDay.map((d) => <div key={d.day} title={`${d.day}：${formatCost(d.cost)} · ${d.calls} 次调用`} className="flex-1 rounded-t bg-primary/60" style={{ height: `${Math.max(4, (d.cost / maxDay) * 100)}%` }} />)}</div></Card> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Table title="按模型统计成本" label="模型" rows={u.byModel.map((r) => ({ k: `${r.provider} / ${r.model}`, calls: r.calls, tokens: r.tokens, cost: r.cost }))} />
        <Table title="按任务统计成本" label="任务" rows={u.byTask.map((r) => ({ k: r.taskType, calls: r.calls, tokens: r.tokens, cost: r.cost }))} />
        <Table title="按项目统计成本" label="项目" rows={u.byProject.map((r) => ({ k: r.name ?? '（无）', calls: r.calls, tokens: r.tokens, cost: r.cost }))} />
        <Table title="按内容类型统计成本" label="内容类型" rows={u.byContentType.map((r) => ({ k: r.contentType ?? '—', calls: r.calls, cost: r.cost }))} />
      </div>
      <Card className="mt-4">
        <CardHeader title="最近请求" />
        <ul className="divide-y divide-line">{u.recent.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-[12.5px]"><Badge tone={r.status === 'success' ? 'primary' : 'danger'}>{r.status === 'success' ? '成功' : r.status}</Badge><span className="font-mono text-fg">{r.model}</span><Badge>{lbl(TASK_TYPE_LABELS, r.taskType)}</Badge><span className="text-fg-dim">{r.inputTokens}→{r.outputTokens} Token · {r.latencyMs}ms · {formatCost(r.cost)}</span><span className="flex-1 truncate text-danger">{r.error ?? ''}</span><span className="text-fg-dim">{relativeTime(r.createdAt)}</span></li>)}{u.recent.length === 0 ? <li className="px-4 py-3 text-[13px] text-fg-dim">暂无请求记录。</li> : null}</ul>
      </Card>
    </div>
  )
}
