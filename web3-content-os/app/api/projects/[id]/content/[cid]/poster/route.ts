import { withProject, json } from '@/lib/api'
import { getContent } from '@/lib/services/content'
import { parsePosterCopy, renderPosterSvg } from '@/lib/services/poster'

export const GET = withProject(async ({ project, params, req }) => {
  const res = await getContent(project.id, params.cid)
  if (!res) return json({ error: 'Content not found' }, { status: 404 })
  const size = req.nextUrl.searchParams.get('size') === 'square' ? { width: 1080, height: 1080 } : req.nextUrl.searchParams.get('size') === 'wide' ? { width: 1600, height: 900 } : { width: 1080, height: 1350 }
  const svg = renderPosterSvg(parsePosterCopy(res.item.body, project.name, project.tokenSymbol), size)
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Disposition': `inline; filename="${res.item.title.replace(/[^\w.-]+/g, '_')}.svg"`, 'Cache-Control': 'no-store' } })
})
