import { withProject, json } from '@/lib/api'
import { rewriteSafely, scanRisk } from '@/lib/services/checks'
import { getContent, listContent } from '@/lib/services/content'

export const GET = withProject(async ({ project }) => {
  const { items } = await listContent(project.id, { pageSize: 200 })
  const results = []
  for (const it of items) {
    const r = await scanRisk(project.id, it.body)
    if (r.findings.length) results.push({ contentId: it.id, title: it.title, contentType: it.contentType, score: r.score, findings: r.findings.slice(0, 8) })
  }
  return json({ scanned: items.length, results })
})

export const POST = withProject(async ({ ctx, project, body }) => {
  const b = await body<{ text?: string; contentId?: string; rewrite?: boolean }>()
  if (b.rewrite && b.contentId) {
    const current = await getContent(project.id, b.contentId)
    if (!current) return json({ error: 'Content not found' }, { status: 404 })
    const scan = await scanRisk(project.id, current.item.body)
    const item = await rewriteSafely(ctx, b.contentId, scan.findings)
    return json({ item, rescan: await scanRisk(project.id, item.body) })
  }
  const text = b.text ?? (b.contentId ? (await getContent(project.id, b.contentId))?.item.body : '')
  return json(await scanRisk(project.id, text ?? ''))
})
