import { withProject, json } from '@/lib/api'
import { listConflicts } from '@/lib/services/conflicts'

export const GET = withProject(async ({ project, req }) => json({ conflicts: await listConflicts(project.id, req.nextUrl.searchParams.get('all') === '1' ? 'all' : 'open') }))
