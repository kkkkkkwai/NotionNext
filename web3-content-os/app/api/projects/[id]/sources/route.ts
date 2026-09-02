import { withProject, json } from '@/lib/api'
import { createFileSource, createTextSource, createUrlSource, listSources, knowledgeStats } from '@/lib/services/knowledge'

export const GET = withProject(async ({ project }) => json({ sources: await listSources(project.id), stats: await knowledgeStats(project.id) }))

const MAX_FILE = 25 * 1024 * 1024

export const POST = withProject(async ({ project, req }) => {
  const ct = req.headers.get('content-type') ?? ''
  const created = []
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData()
    for (const entry of form.getAll('files')) {
      if (!(entry instanceof File)) continue
      if (entry.size > MAX_FILE) return json({ error: `${entry.name} exceeds 25MB` }, { status: 400 })
      const buffer = Buffer.from(await entry.arrayBuffer())
      created.push(await createFileSource(project.id, { name: entry.name, buffer, mime: entry.type }))
    }
  } else {
    const b = await req.json().catch(() => ({})) as { url?: string; type?: 'url' | 'gitbook'; text?: string; name?: string }
    if (b.url) {
      let url = b.url.trim()
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url
      created.push(await createUrlSource(project.id, url, b.type === 'gitbook' || /gitbook\.io|docs\./i.test(url) ? 'gitbook' : 'url'))
    } else if (b.text && b.text.trim()) {
      created.push(await createTextSource(project.id, b.name?.trim() || `Notes ${new Date().toISOString().slice(0, 10)}`, b.text.trim()))
    } else return json({ error: 'Provide files, a url, or text' }, { status: 400 })
  }
  return json({ sources: created })
})
