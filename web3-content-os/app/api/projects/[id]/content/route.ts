import { withProject, json } from '@/lib/api'
import { contentFacets, generateContent, listContent, type GenerateInput } from '@/lib/services/content'

export const GET = withProject(async ({ project, req }) => {
  const q = req.nextUrl.searchParams
  const get = (k: string) => q.get(k) || undefined
  const result = await listContent(project.id, { q: get('q'), category: get('category'), contentType: get('contentType'), language: get('language'), platform: get('platform'), status: get('status'), campaignId: get('campaignId'), folder: get('folder'), tag: get('tag'), page: Number(get('page') ?? 1), pageSize: Number(get('pageSize') ?? 30) })
  const facets = q.get('facets') === '1' ? await contentFacets(project.id) : undefined
  return json({ ...result, facets })
})

export const POST = withProject(async ({ ctx, body }) => {
  const b = await body<GenerateInput>()
  const res = await generateContent(ctx, b)
  return json(res)
})
