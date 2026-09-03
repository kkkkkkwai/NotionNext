'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CreditCard, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, ErrorState, Field, Input, PageHeader, Skeleton } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'
import { formatCost, relativeTime } from '@/lib/utils'

type Tx = { id: string; amount: number; type: string; description: string | null; balanceAfter: number; createdAt: string }
type Res = { balance: number; transactions: Tx[]; markup: number; systemKeys: { provider: string; label: string }[]; canGrant: boolean }

export function BillingSettings() {
  const toast = useToast()
  const [data, setData] = useState<Res | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState('10')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try {
      setData(await api<Res>('/api/settings/billing'))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])
  useEffect(() => { load() }, [load])
  const grant = async () => {
    setBusy(true)
    try {
      await api('/api/settings/billing', { method: 'POST', json: { amount: Number(amount), description: 'Manual top-up' } })
      toast.success('Credits added')
      load()
    } catch (e) {
      toast.error('Failed', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  if (error) return <ErrorState message={error} retry={load} />
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Billing" description="Platform credits pay for AI calls made with the system API keys. Bring your own key in AI Providers to bypass credits entirely." />
      {!data ? <Skeleton className="h-40" /> : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 text-[12px] text-fg-muted"><CreditCard className="h-4 w-4" /> Credit balance</div>
              <div className={`mt-2 text-3xl font-semibold ${data.balance <= 0 ? 'text-danger' : 'text-fg'}`}>{data.balance.toFixed(2)}</div>
              <div className="mt-1 text-[12px] text-fg-dim">1 credit ≈ $1 of model cost × {data.markup} markup</div>
              {data.systemKeys.length ? <div className="mt-3 flex items-center gap-1.5 text-[12px] text-fg-muted"><KeyRound className="h-3.5 w-3.5 text-primary" /> System keys: {data.systemKeys.map((k) => k.label).join(', ')}</div> : <div className="mt-3 text-[12px] text-warn">No system keys configured on this server — credits are not needed; use <Link href="/settings/ai-providers" className="underline">your own keys</Link>.</div>}
            </Card>
            <Card className="p-5">
              <div className="mb-2 text-[13px] font-medium text-fg">Top up</div>
              {data.canGrant ? (
                <div className="space-y-3"><Field label="Amount (credits)"><Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Button className="w-full" onClick={grant} loading={busy}>Add credits</Button><p className="text-[11.5px] text-fg-dim">You are a billing admin (BILLING_ADMIN_EMAILS).</p></div>
              ) : <p className="text-[12.5px] text-fg-muted">Payment checkout is not connected yet. Ask your platform admin to grant credits, or add your own API key in <Link href="/settings/ai-providers" className="text-primary hover:underline">AI Providers</Link> — BYOK usage is never charged.</p>}
            </Card>
          </div>
          <Card>
            <CardHeader title="Transactions" description="Grants and usage charges" />
            {data.transactions.length === 0 ? <div className="p-4 text-[13px] text-fg-dim">No transactions yet.</div> : (
              <ul className="divide-y divide-line">{data.transactions.map((t) => <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]"><Badge tone={t.type === 'grant' ? 'primary' : t.type === 'usage' ? 'neutral' : 'warn'}>{t.type}</Badge><span className="flex-1 truncate text-fg-muted">{t.description}</span><span className={t.amount >= 0 ? 'text-primary' : 'text-fg'}>{t.amount >= 0 ? '+' : ''}{t.amount < 0 && t.amount > -0.01 ? '<0.01' : t.amount.toFixed(2)}</span><span className="w-20 text-right text-fg-dim">{t.balanceAfter.toFixed(2)}</span><span className="w-16 text-right text-[12px] text-fg-dim">{relativeTime(t.createdAt)}</span></li>)}</ul>
            )}
          </Card>
        </div>
      )}
      <span className="hidden">{formatCost(0)}</span>
    </div>
  )
}
