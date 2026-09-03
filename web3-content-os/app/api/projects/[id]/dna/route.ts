import { withProject, json } from '@/lib/api'
import { generateDna, getLatestDna, listDnaVersions, updateDnaSection, DNA_SECTIONS } from '@/lib/services/dna'
import { computeReadiness } from '@/lib/services/projects'

export const GET = withProject(async ({ project }) => json({ dna: await getLatestDna(project.id), versions: await listDnaVersions(project.id), sections: DNA_SECTIONS }))

export const POST = withProject(async ({ ctx, body }) => {
  const b = await body<{ language?: string }>()
  const dna = await generateDna(ctx, { language: b.language })
  return json({ dna })
})

export const PATCH = withProject(async ({ ctx, session, body }) => {
  const b = await body<{ key: string; value: string | string[] }>()
  if (!b.key) return json({ error: 'key required' }, { status: 400 })
  const dna = await updateDnaSection(ctx.projectId, b.key, b.value, session.userId)
  await computeReadiness(ctx.orgId, ctx.projectId)
  return json({ dna })
})
