'use client'
import { Check, Loader2, X, Circle } from 'lucide-react'
import { useJob, type JobView } from '@/hooks/use-job'
import { Card, Progress } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export function JobProgress({ projectId, jobId, title, onDone, compact }: { projectId: string; jobId: string | null; title?: string; onDone?: (job: JobView) => void; compact?: boolean }) {
  const job = useJob(projectId, jobId, { onDone })
  if (!jobId) return null
  if (!job) return <Card className="p-4 text-[13px] text-fg-muted"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />正在启动…</Card>
  return (
    <Card className={cn('p-4', compact && 'p-3')}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[13.5px] font-medium text-fg">{title ?? job.type.replace(/_/g, ' ')}</div>
        <div className="text-[12px] text-fg-muted">{job.status === 'completed' ? '已完成' : job.status === 'failed' ? '失败' : `${job.progress}%`}</div>
      </div>
      <Progress value={job.status === 'completed' ? 100 : job.progress} />
      {!compact ? (
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {job.steps.map((s) => (
            <li key={s.name} className={cn('flex items-center gap-2 text-[12.5px]', s.status === 'done' ? 'text-fg-muted' : s.status === 'running' ? 'text-fg' : s.status === 'failed' ? 'text-danger' : 'text-fg-dim')}>
              {s.status === 'done' ? <Check className="h-3.5 w-3.5 text-primary" /> : s.status === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : s.status === 'failed' ? <X className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
              {s.name}
            </li>
          ))}
        </ul>
      ) : <div className="mt-1.5 text-[12px] text-fg-dim">{job.step}</div>}
      {job.status === 'failed' ? <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{job.error}</div> : null}
    </Card>
  )
}
