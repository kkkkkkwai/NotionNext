import { desc, eq, sql } from 'drizzle-orm'
import { getDb, schema } from '../db'

/** Credits are denominated in USD-equivalent. System-key usage is billed at estimated cost × markup. */
export const CREDIT_MARKUP = Number(process.env.SYSTEM_CREDITS_MARKUP || 1.5)
export const SIGNUP_FREE_CREDITS = Number(process.env.SIGNUP_FREE_CREDITS || 2)

export async function getBalance(orgId: string) {
  const db = await getDb()
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId), columns: { credits: true } })
  return org?.credits ?? 0
}

export async function addCredits(orgId: string, amount: number, type: 'grant' | 'usage' | 'adjustment', description?: string, ref?: string) {
  const db = await getDb()
  const [org] = await db.update(schema.organizations).set({ credits: sql`${schema.organizations.credits} + ${amount}` }).where(eq(schema.organizations.id, orgId)).returning()
  await db.insert(schema.creditTransactions).values({ orgId, amount, type, description, ref, balanceAfter: org?.credits ?? 0 })
  return org?.credits ?? 0
}

/** Charges system-key AI usage against the workspace balance. Never throws. */
export async function chargeUsage(orgId: string, costUsd: number, ref: string, description: string) {
  if (!(costUsd > 0)) return
  try {
    await addCredits(orgId, -costUsd * CREDIT_MARKUP, 'usage', description, ref)
  } catch (e) {
    console.error('[credits] charge failed', e)
  }
}

export async function listTransactions(orgId: string, limit = 50) {
  const db = await getDb()
  return db.query.creditTransactions.findMany({ where: eq(schema.creditTransactions.orgId, orgId), orderBy: desc(schema.creditTransactions.createdAt), limit })
}

export function isBillingAdmin(email: string) {
  const admins = (process.env.BILLING_ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  return admins.includes(email.toLowerCase())
}
