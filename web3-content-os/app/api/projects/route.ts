export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { withAuth, json } from '@/lib/api'
import { createProject, listProjects } from '@/lib/services/projects'

const Body = z.object({
  name: z.string().min(1).max(120), idea: z.string().optional(), slogan: z.string().optional(), website: z.string().optional(), twitter: z.string().optional(), telegram: z.string().optional(), discord: z.string().optional(),
  industry: z.string().optional(), positioning: z.string().optional(), tokenName: z.string().optional(), tokenSymbol: z.string().optional(), launchDate: z.string().optional(), logoUrl: z.string().optional()
})

export const GET = withAuth(async ({ session }) => json({ projects: await listProjects(session.orgId) }))

export const POST = withAuth(async ({ session, body }) => {
  const parsed = Body.safeParse(await body())
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  const project = await createProject(session.orgId, session.userId, parsed.data)
  return json({ project })
})
