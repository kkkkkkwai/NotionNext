'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, statusLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
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
      await api('/api/settings/billing', { method: 'POST', json: { amount: Number(amount), description: '手动充值' } })
      toast.success('额度已添加')
      load()
    } catch (e) {
      toast.error('操作失败', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  if (error) return <ErrorState message={error} retry={load} />
  return (
    <div>
      <PageHeader eyebrow="设置" title="账单" description="平台额度用于支付使用系统 API Key 发起的 AI 调用。在「AI 模型」中添加自己的 Key 即可完全无需额度。" />
      {!data ? <Skeleton className="h-40" /> : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 text-[12px] text-fg-muted"><CreditCard className="h-4 w-4" /> 额度余额</div>
              <div className={`mt-2 text-3xl font-semibold ${data.balance <= 0 ? 'text-danger' : 'text-fg'}`}>{data.balance.toFixed(2)}</div>
              <div className="mt-1 text-[12px] text-fg-dim">1 额度 ≈ 1 美元模型成本 × {data.markup} 倍溢价</div>
              {data.systemKeys.length ? <div className="mt-3 flex items-center gap-1.5 text-[12px] text-fg-muted"><KeyRound className="h-3.5 w-3.5 text-primary" /> 系统密钥：{data.systemKeys.map((k) => k.label).join('、')}</div> : <div className="mt-3 text-[12px] text-warn">当前服务器未配置系统密钥——无需额度，请使用<Link href="/settings/ai-providers" className="underline">自己的 Key</Link>。</div>}
            </Card>
            <Card className="p-5">
              <div className="mb-2 text-[13px] font-medium text-fg">充值</div>
              {data.canGrant ? (
                <div className="space-y-3"><Field label="金额（额度）"><Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Button className="w-full" onClick={grant} loading={busy}>添加额度</Button><p className="text-[11.5px] text-fg-dim">你是账单管理员（BILLING_ADMIN_EMAILS）。</p></div>
              ) : <p className="text-[12.5px] text-fg-muted">在线支付尚未接入。请联系平台管理员发放额度，或在 <Link href="/settings/ai-providers" className="text-primary hover:underline">AI 模型</Link> 中添加自己的 API Key——BYOK 用量永不计费。</p>}
            </Card>
          </div>
          <Card>
            <CardHeader title="交易记录" description="额度发放与用量扣费" />
            {data.transactions.length === 0 ? <div className="p-4 text-[13px] text-fg-dim">暂无交易记录。</div> : (
              <ul className="divide-y divide-line">{data.transactions.map((t) => <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]"><Badge tone={t.type === 'grant' ? 'primary' : t.type === 'usage' ? 'neutral' : 'warn'}>{lbl(TX_TYPE_LABELS, t.type)}</Badge><span className="flex-1 truncate text-fg-muted">{t.description}</span><span className={t.amount >= 0 ? 'text-primary' : 'text-fg'}>{t.amount >= 0 ? '+' : ''}{t.amount < 0 && t.amount > -0.01 ? '<0.01' : t.amount.toFixed(2)}</span><span className="w-20 text-right text-fg-dim">{t.balanceAfter.toFixed(2)}</span><span className="w-16 text-right text-[12px] text-fg-dim">{relativeTime(t.createdAt)}</span></li>)}</ul>
            )}
          </Card>
        </div>
      )}
      <span className="hidden">{formatCost(0)}</span>
    </div>
  )
}
