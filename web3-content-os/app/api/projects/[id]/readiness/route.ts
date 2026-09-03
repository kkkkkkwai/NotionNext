import { withProject, json } from '@/lib/api'
import { computeReadiness } from '@/lib/services/projects'

export const GET = withProject(async ({ ctx }) => json(await computeReadiness(ctx.orgId, ctx.projectId)))
export const POST = GET
