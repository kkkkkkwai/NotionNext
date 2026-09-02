export const dynamic = 'force-dynamic'
import { withAuth, json } from '@/lib/api'
import { usageSummary } from '@/lib/services/usage'

export const GET = withAuth(async ({ session }) => json(await usageSummary(session.orgId)))
