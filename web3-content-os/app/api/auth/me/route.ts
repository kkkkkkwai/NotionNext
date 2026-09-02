export const dynamic = 'force-dynamic'
import { withAuth, json } from '@/lib/api'

export const GET = withAuth(async ({ session }) => json({ user: session }))
