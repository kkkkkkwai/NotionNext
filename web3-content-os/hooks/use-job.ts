'use client'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/client'

export interface JobView { id: string; type: string; status: string; progress: number; step: string | null; steps: { name: string; status: string }[]; result: Record<string, unknown>; error: string | null; input: Record<string, unknown>; createdAt: string }

/** Polls a generation job until it completes or fails. */
export function useJob(projectId: string, jobId: string | null | undefined, opts: { interval?: number; onDone?: (job: JobView) => void } = {}) {
  const [job, setJob] = useState<JobView | null>(null)
  const onDone = useRef(opts.onDone)
  onDone.current = opts.onDone
  useEffect(() => {
    if (!jobId) {
      setJob(null)
      return
    }
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      try {
        const { job } = await api<{ job: JobView }>(`/api/projects/${projectId}/jobs/${jobId}`)
        if (!active) return
        setJob(job)
        if (job.status === 'completed' || job.status === 'failed') {
          onDone.current?.(job)
          return
        }
      } catch {
        /* keep polling */
      }
      timer = setTimeout(tick, opts.interval ?? 1500)
    }
    tick()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [projectId, jobId, opts.interval])
  return job
}
