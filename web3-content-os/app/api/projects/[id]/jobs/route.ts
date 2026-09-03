import { withProject, json } from '@/lib/api'
import { listJobs } from '@/lib/services/jobs'

export const GET = withProject(async ({ project, req }) => json({ jobs: await listJobs(project.id, req.nextUrl.searchParams.get('type') ?? undefined) }))
