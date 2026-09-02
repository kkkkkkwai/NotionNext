import { withAuth, json } from '@/lib/api'
import { testProvider } from '@/lib/services/ai-settings'

export const POST = withAuth(async ({ session, params }) => json(await testProvider(session.orgId, params.pid)))
