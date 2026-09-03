import { and, desc, eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import type { GenerationJob } from '../db/schema'
import { describeError } from '../utils'

type Cache = { running: Map<string, Promise<void>> }
const g = globalThis as unknown as { __web3os_jobs?: Cache }
if (!g.__web3os_jobs) g.__web3os_jobs = { running: new Map() }
const jobs = g.__web3os_jobs

export async function createJob(input: { projectId: string; orgId: string; userId?: string | null; type: string; steps: string[]; input?: Record<string, unknown> }) {
  const db = await getDb()
  const [job] = await db.insert(schema.generationJobs).values({ projectId: input.projectId, orgId: input.orgId, userId: input.userId ?? null, type: input.type, status: 'queued', progress: 0, steps: input.steps.map((name) => ({ name, status: 'pending' })), input: input.input ?? {} }).returning()
  return job
}

export async function getJob(projectId: string, jobId: string) {
  const db = await getDb()
  return db.query.generationJobs.findFirst({ where: and(eq(schema.generationJobs.id, jobId), eq(schema.generationJobs.projectId, projectId)) })
}

export async function listJobs(projectId: string, type?: string, limit = 10) {
  const db = await getDb()
  return db.query.generationJobs.findMany({ where: type ? and(eq(schema.generationJobs.projectId, projectId), eq(schema.generationJobs.type, type)) : eq(schema.generationJobs.projectId, projectId), orderBy: desc(schema.generationJobs.createdAt), limit })
}

export class JobRunner {
  constructor(public job: GenerationJob) {}
  private stepIndex = 0
  async step(name: string, extra: Partial<{ progress: number }> = {}) {
    const db = await getDb()
    const steps = [...this.job.steps]
    const idx = steps.findIndex((s) => s.name === name)
    if (idx >= 0) {
      for (let i = 0; i < idx; i++) if (steps[i].status !== 'done') steps[i].status = 'done'
      steps[idx].status = 'running'
      this.stepIndex = idx
    }
    const progress = extra.progress ?? Math.round((this.stepIndex / Math.max(1, steps.length)) * 100)
    const [j] = await db.update(schema.generationJobs).set({ status: 'running', step: name, steps, progress, updatedAt: new Date() }).where(eq(schema.generationJobs.id, this.job.id)).returning()
    this.job = j
  }
  async progress(progress: number, step?: string) {
    const db = await getDb()
    const [j] = await db.update(schema.generationJobs).set({ progress: Math.min(99, progress), step: step ?? this.job.step, updatedAt: new Date() }).where(eq(schema.generationJobs.id, this.job.id)).returning()
    this.job = j
  }
  async mergeResult(patch: Record<string, unknown>) {
    const db = await getDb()
    const [j] = await db.update(schema.generationJobs).set({ result: { ...this.job.result, ...patch }, updatedAt: new Date() }).where(eq(schema.generationJobs.id, this.job.id)).returning()
    this.job = j
  }
  async complete(result: Record<string, unknown> = {}) {
    const db = await getDb()
    const steps = this.job.steps.map((s) => ({ ...s, status: 'done' }))
    await db.update(schema.generationJobs).set({ status: 'completed', progress: 100, step: '完成', steps, result: { ...this.job.result, ...result }, updatedAt: new Date() }).where(eq(schema.generationJobs.id, this.job.id))
  }
  async fail(err: unknown) {
    const db = await getDb()
    const message = describeError(err)
    const steps = this.job.steps.map((s) => (s.status === 'running' ? { ...s, status: 'failed' } : s))
    await db.update(schema.generationJobs).set({ status: 'failed', error: message, steps, updatedAt: new Date() }).where(eq(schema.generationJobs.id, this.job.id))
  }
}

/** Runs a job body in the background (fire-and-forget) with status tracking. */
export function runInBackground(job: GenerationJob, body: (runner: JobRunner) => Promise<Record<string, unknown> | void>) {
  const runner = new JobRunner(job)
  const p = (async () => {
    try {
      const result = await body(runner)
      await runner.complete(result ?? {})
    } catch (err) {
      console.error(`[job ${job.type}] failed`, err)
      await runner.fail(err)
    } finally {
      jobs.running.delete(job.id)
    }
  })()
  jobs.running.set(job.id, p)
  return runner
}

/** Runs async tasks with limited concurrency, collecting results & errors. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<{ results: (R | undefined)[]; errors: { index: number; error: string }[] }> {
  const results: (R | undefined)[] = new Array(items.length)
  const errors: { index: number; error: string }[] = []
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      try {
        results[i] = await fn(items[i], i)
      } catch (err) {
        errors.push({ index: i, error: describeError(err) })
      }
    }
  })
  await Promise.all(workers)
  return { results, errors }
}
