import fs from 'node:fs'
import path from 'node:path'
import { withProject, json } from '@/lib/api'
import { updateProject } from '@/lib/services/projects'

const dir = (projectId: string) => path.join(path.resolve(process.cwd(), process.env.UPLOAD_DIR || './data/uploads'), projectId)
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/gif': 'gif' }

export const POST = withProject(async ({ session, project, req }) => {
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return json({ error: 'file required' }, { status: 400 })
  const ext = TYPES[file.type]
  if (!ext) return json({ error: 'Use PNG, JPG, WEBP, SVG or GIF' }, { status: 400 })
  if (file.size > 2 * 1024 * 1024) return json({ error: 'Logo must be under 2MB' }, { status: 400 })
  fs.mkdirSync(dir(project.id), { recursive: true })
  for (const old of fs.readdirSync(dir(project.id)).filter((f) => f.startsWith('logo.'))) fs.unlinkSync(path.join(dir(project.id), old))
  fs.writeFileSync(path.join(dir(project.id), `logo.${ext}`), Buffer.from(await file.arrayBuffer()))
  const logoUrl = `/api/projects/${project.id}/logo?v=${Date.now()}`
  await updateProject(session.orgId, project.id, { logoUrl })
  return json({ logoUrl })
})

export const GET = withProject(async ({ project }) => {
  const d = dir(project.id)
  if (!fs.existsSync(d)) return json({ error: 'No logo' }, { status: 404 })
  const f = fs.readdirSync(d).find((x) => x.startsWith('logo.'))
  if (!f) return json({ error: 'No logo' }, { status: 404 })
  const ext = f.split('.').pop()!
  const type = Object.entries(TYPES).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream'
  return new Response(fs.readFileSync(path.join(d, f)), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' } })
})

export const DELETE = withProject(async ({ session, project }) => {
  const d = dir(project.id)
  if (fs.existsSync(d)) for (const f of fs.readdirSync(d).filter((x) => x.startsWith('logo.'))) fs.unlinkSync(path.join(d, f))
  await updateProject(session.orgId, project.id, { logoUrl: null })
  return json({ ok: true })
})
