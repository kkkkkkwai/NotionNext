import { withProject, json } from '@/lib/api'
import { getJob } from '@/lib/services/jobs'

export const GET = withProject(async ({ project, params }) => {
  const job = await getJob(project.id, params.jobId)
  if (!job) return json({ error: 'Job not found' }, { status: 404 })
  return json({ job })
})
