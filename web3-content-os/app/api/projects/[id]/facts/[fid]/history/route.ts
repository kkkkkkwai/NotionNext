import { withProject, json } from '@/lib/api'
import { factHistory } from '@/lib/services/facts'

export const GET = withProject(async ({ project, params }) => json({ versions: await factHistory(project.id, params.fid) }))
