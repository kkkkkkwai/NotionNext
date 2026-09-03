'use client'
import { contentTypeLabel, platformLabel, categoryLabel, factCategoryLabel, roleLabel, languageLabel, statusLabel, label as lbl, RULE_TYPE_LABELS, SOURCE_TYPE_LABELS, TX_TYPE_LABELS, TIER_LABELS, TASK_TYPE_LABELS, EVENT_LABELS, FORMAT_LABELS, TASK_CLASS_LABELS, READINESS_LABELS } from '@/lib/labels'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge, Card, ErrorState, PageHeader, Skeleton } from '@/components/ui/primitives'
import { api, errorMessage } from '@/lib/client'
import { truncate } from '@/lib/utils'

type Res = { campaign: { id: string; name: string; goal: string | null; status: string; startDate: string | null; endDate: string | null; plan: { launchDate?: string; days?: { dayOffset: number; date: string; label: string; theme: string; goal: string; hook: string }[] } }; items: { id: string; dayOffset: number; date: string | null; theme: string | null; contentId: string | null; contentType: string | null; status: string }[]; content: { id: string; title: string; contentType: string; body: string; status: string; scheduledAt: string | null }[] }

const campaignStatusLabel: Record<string, string> = { ready: '已就绪', generating: '生成中', draft: '草稿' }
const contentStatusLabel: Record<string, string> = { draft: '草稿', review: '待审核', approved: '已批准', scheduled: '已排期', published: '已发布' }

export function CampaignDetail({ projectId, campaignId }: { projectId: string; campaignId: string }) {
  const [data, setData] = useState<Res | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      setData(await api<Res>(`/api/projects/${projectId}/campaigns/${campaignId}`))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [projectId, campaignId])
  useEffect(() => {
    load()
    const t = setInterval(() => { if (data?.campaign.status === 'generating') load() }, 3000)
    return () => clearInterval(t)
  }, [load, data?.campaign.status])
  if (error) return <ErrorState message={error} retry={load} />
  if (!data) return <Skeleton className="h-64" />
  const days = data.campaign.plan.days ?? []
  const byDay = (offset: number) => data.items.filter((i) => i.dayOffset === offset && i.contentId).map((i) => ({ item: i, content: data.content.find((c) => c.id === i.contentId) }))
  return (
    <div>
      <Link href={`/projects/${projectId}/campaigns`} className="mb-3 inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg"><ArrowLeft className="h-3.5 w-3.5" /> 营销活动</Link>
      <PageHeader eyebrow={`发布日 ${data.campaign.plan.launchDate ?? ''}`} title={data.campaign.name} description={data.campaign.goal ?? undefined} actions={<><Badge tone={data.campaign.status === 'ready' ? 'primary' : 'info'}>{campaignStatusLabel[data.campaign.status] ?? data.campaign.status}</Badge><Link href={`/projects/${projectId}/calendar`} className="text-[13px] text-primary hover:underline">打开日历 →</Link></>} />
      <div className="space-y-3">
        {days.map((d) => {
          const rows = byDay(d.dayOffset)
          return (
            <Card key={d.dayOffset} className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone={d.dayOffset === 0 ? 'primary' : 'neutral'}>{d.label}</Badge><span className="text-[12.5px] text-fg-dim">{d.date}</span><span className="text-[14px] font-medium text-fg">{d.theme}</span></div>
              {d.hook ? <p className="mb-3 text-[12.5px] text-fg-muted">{d.hook}</p> : null}
              {rows.length === 0 ? <p className="text-[12.5px] text-fg-dim">{data.campaign.status === 'generating' ? '生成中…' : '暂无内容'}</p> : (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">{rows.map(({ item, content }) => content ? <Link key={item.id} href={`/projects/${projectId}/library/${content.id}`} className="rounded-xl border border-line bg-white/[0.02] p-3 transition hover:border-line-strong"><div className="mb-1 flex items-center justify-between text-[11.5px] text-fg-dim"><span>{contentTypeLabel(item.contentType)}</span><Badge tone={content.status === 'published' ? 'primary' : 'muted'}>{contentStatusLabel[content.status] ?? content.status}</Badge></div><p className="line-clamp-3 text-[12.5px] text-fg/90">{truncate(content.body.replace(/[#*_>`]/g, ''), 200)}</p></Link> : null)}</div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
