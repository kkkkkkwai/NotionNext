import { withProject, json } from '@/lib/api'
import { generateNarrative, getLatestNarrative } from '@/lib/services/narrative'

export const GET = withProject(async ({ project }) => json({ narrative: await getLatestNarrative(project.id) }))

export const POST = withProject(async ({ ctx, body }) => {
  const b = await body<{ language?: string }>()
  return json({ narrative: await generateNarrative(ctx, { language: b.language }) })
})
