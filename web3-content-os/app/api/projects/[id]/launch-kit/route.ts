import { withProject, json } from '@/lib/api'
import { startLaunchKit, LAUNCH_KIT_PLAN, kitTotal } from '@/lib/services/launch-kit'
import { listJobs } from '@/lib/services/jobs'

export const GET = withProject(async ({ project }) => json({ jobs: await listJobs(project.id, 'launch_kit', 5), plan: LAUNCH_KIT_PLAN, total: kitTotal() }))

export const POST = withProject(async ({ ctx, body }) => {
  const b = await body<{ language?: string; lite?: boolean }>()
  return json({ job: await startLaunchKit(ctx, b) })
})
