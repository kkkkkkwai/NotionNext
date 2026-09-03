import { createJob, runInBackground } from './jobs'
import { ingestSource } from './knowledge'
import { extractAndMergeFacts } from './facts'
import { generateDna } from './dna'
import { computeReadiness, getProject } from './projects'
import { describeError } from '../utils'

export const INGEST_STEPS = ['解析资料', '构建知识库', '提取项目事实', '生成项目 DNA', '计算就绪度']

/**
 * Full "AI reads your project" pipeline: parse + embed all pending sources → extract facts → (optionally) build DNA.
 */
export async function startIngestPipeline(ctx: { orgId: string; projectId: string; userId: string }, sourceIds: string[], opts: { generateDna?: boolean; extractFacts?: boolean } = {}) {
  const job = await createJob({ ...ctx, type: 'ingest', steps: opts.generateDna === false ? INGEST_STEPS.slice(0, 3).concat(['计算就绪度']) : INGEST_STEPS, input: { sourceIds, ...opts } })
  runInBackground(job, async (r) => {
    const project = await getProject(ctx.orgId, ctx.projectId)
    if (!project) throw new Error('项目不存在')
    await r.step('解析资料')
    const parsed: { sourceId: string; name: string; text: string; chunks: number }[] = []
    const errors: { sourceId: string; error: string }[] = []
    for (const [i, id] of sourceIds.entries()) {
      try {
        await r.progress(Math.round((i / Math.max(1, sourceIds.length)) * 30), `解析资料 (${i + 1}/${sourceIds.length})`)
        const res = await ingestSource(ctx.orgId, ctx.projectId, id, { onProgress: (m) => r.progress(Math.round((i / Math.max(1, sourceIds.length)) * 30), m) })
        parsed.push({ sourceId: id, name: res.title, text: res.text, chunks: res.chunks })
      } catch (e) {
        errors.push({ sourceId: id, error: describeError(e) })
      }
    }
    await r.step('构建知识库', { progress: 35 })
    await r.mergeResult({ parsed: parsed.map((p) => ({ name: p.name, chunks: p.chunks })), errors })
    let factResults: unknown[] = []
    if (opts.extractFacts !== false && parsed.length) {
      await r.step('提取项目事实', { progress: 40 })
      for (const [i, p] of parsed.entries()) {
        try {
          const res = await extractAndMergeFacts(ctx, p.sourceId, p.name, p.text, project.name)
          factResults = factResults.concat(res)
        } catch (e) {
          errors.push({ sourceId: p.sourceId, error: '事实提取：' + describeError(e) })
        }
        await r.progress(40 + Math.round(((i + 1) / parsed.length) * 25))
      }
      await r.mergeResult({ facts: summarize(factResults as { status: string }[]), conflicts: (factResults as { status: string; key: string; current?: string; proposed?: string }[]).filter((f) => f.status === 'conflict') })
    }
    if (opts.generateDna !== false) {
      await r.step('生成项目 DNA', { progress: 70 })
      try {
        await generateDna(ctx)
      } catch (e) {
        errors.push({ sourceId: '', error: 'DNA：' + describeError(e) })
      }
    }
    await r.step('计算就绪度', { progress: 95 })
    const readiness = await computeReadiness(ctx.orgId, ctx.projectId)
    return { readiness: readiness.total, errors }
  })
  return job
}

function summarize(list: { status: string }[]) {
  const out: Record<string, number> = {}
  for (const f of list) out[f.status] = (out[f.status] ?? 0) + 1
  return out
}
