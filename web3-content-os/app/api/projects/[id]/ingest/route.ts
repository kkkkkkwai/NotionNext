import { withProject, json } from '@/lib/api'
import { startIngestPipeline } from '@/lib/services/ingest-pipeline'
import { listSources } from '@/lib/services/knowledge'

export const POST = withProject(async ({ ctx, body, project }) => {
  const b = await body<{ sourceIds?: string[]; generateDna?: boolean; extractFacts?: boolean; all?: boolean }>()
  let ids = b.sourceIds ?? []
  if (!ids.length) {
    const sources = await listSources(project.id)
    ids = sources.filter((s) => b.all || s.status === 'pending' || s.status === 'failed').map((s) => s.id)
  }
  const job = await startIngestPipeline(ctx, ids, { generateDna: b.generateDna, extractFacts: b.extractFacts })
  return json({ job })
})
