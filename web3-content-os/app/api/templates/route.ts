export const dynamic = 'force-dynamic'
import { withAuth, json } from '@/lib/api'
import { listTemplates, TEMPLATE_CATEGORIES } from '@/lib/services/templates'

export const GET = withAuth(async ({ session }) => json({ templates: await listTemplates(session.orgId), categories: TEMPLATE_CATEGORIES }))
