'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'

export type ConflictView = { id: string; key: string; label: string; currentValue: string; proposedValue: string; source: string | null; sourceRef: { sourceName?: string; page?: number; quote?: string }; createdAt: string }

/** "Detected outdated data in materials: old X, current Y" — the user decides, the AI never overrides. */
export function ConflictsPanel({ projectId, conflicts, onChange }: { projectId: string; conflicts: ConflictView[]; onChange?: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [items, setItems] = useState(conflicts)
  if (items.length === 0) return null
  const resolve = async (c: ConflictView, action: 'keep' | 'accept') => {
    setBusy(c.id)
    try {
      await api(`/api/projects/${projectId}/conflicts/${c.id}`, { method: 'POST', json: { action } })
      setItems((xs) => xs.filter((x) => x.id !== c.id))
      toast.success(action === 'accept' ? `已将「${c.label}」更新为“${c.proposedValue}”` : `「${c.label}」已保留“${c.currentValue}”`)
      onChange?.()
      router.refresh()
    } catch (e) {
      toast.error('无法处理', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <Card className="border-warn/40">
      <CardHeader title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warn" /> 检测到数据冲突（{items.length}）</span>} description="上传的资料中包含与已确认事实不一致的值。在你做出决定之前，以已确认的事实为准。" />
      <ul className="divide-y divide-line">
        {items.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-fg">{c.label}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]"><span className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[12px] text-fg-dim">{c.source ?? '文档'}{c.sourceRef?.page ? ` 第 ${c.sourceRef.page} 页` : ''}: {c.proposedValue}</span><ArrowRight className="h-3 w-3 text-fg-dim" /><span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[12px] text-primary">当前值: {c.currentValue}</span></div>
              {c.sourceRef?.quote ? <div className="mt-1 text-[11.5px] text-fg-dim">“{c.sourceRef.quote}”</div> : null}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button size="xs" variant="secondary" loading={busy === c.id} onClick={() => resolve(c, 'keep')}><Check className="h-3 w-3" /> 保留当前值</Button>
              <Button size="xs" variant="outline" loading={busy === c.id} onClick={() => resolve(c, 'accept')}><X className="h-3 w-3" /> 采用文档值</Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
