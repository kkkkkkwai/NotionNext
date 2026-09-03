export const dynamic = 'force-dynamic'
import { withAuth, json } from '@/lib/api'
import { addCredits, CREDIT_MARKUP, getBalance, isBillingAdmin, listTransactions } from '@/lib/services/credits'
import { systemKeysAvailable } from '@/lib/services/ai-settings'

export const GET = withAuth(async ({ session }) => json({ balance: await getBalance(session.orgId), transactions: await listTransactions(session.orgId), markup: CREDIT_MARKUP, systemKeys: systemKeysAvailable(), canGrant: isBillingAdmin(session.email) }))

export const POST = withAuth(async ({ session, body }) => {
  if (!isBillingAdmin(session.email)) return json({ error: 'Only billing admins can grant credits (set BILLING_ADMIN_EMAILS)' }, { status: 403 })
  const b = await body<{ amount: number; description?: string }>()
  const amount = Number(b.amount)
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 10000) return json({ error: 'Invalid amount' }, { status: 400 })
  const balance = await addCredits(session.orgId, amount, amount > 0 ? 'grant' : 'adjustment', b.description || 'Manual grant')
  return json({ balance })
})
