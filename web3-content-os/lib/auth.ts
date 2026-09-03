import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { getDb, schema } from './db'
import { hashPassword, verifyPassword } from './crypto'
import { slugify } from './utils'

const COOKIE = 'w3os_session'

function secretKey() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-insecure-secret-change-me')
}

export type Session = { userId: string; orgId: string; email: string; name: string }

export async function createSessionCookie(session: Session) {
  const token = await new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey())
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  })
}

export function clearSessionCookie() {
  cookies().set(COOKIE, '', { path: '/', maxAge: 0 })
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (!payload.userId || !payload.orgId) return null
    return { userId: String(payload.userId), orgId: String(payload.orgId), email: String(payload.email ?? ''), name: String(payload.name ?? '') }
  } catch {
    return null
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession()
  if (!s) throw new AuthError('Unauthorized')
  return s
}

export class AuthError extends Error {
  status = 401
}

export async function signUp(email: string, password: string, name?: string): Promise<Session> {
  const db = await getDb()
  const normalized = email.trim().toLowerCase()
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, normalized) })
  if (existing) throw new Error('An account with this email already exists')
  const [user] = await db.insert(schema.users).values({ email: normalized, passwordHash: hashPassword(password), name: name?.trim() || normalized.split('@')[0] }).returning()
  const baseSlug = slugify(user.name || 'workspace')
  const [org] = await db.insert(schema.organizations).values({ name: `${user.name}'s Workspace`, slug: `${baseSlug}-${user.id.slice(0, 6)}`, ownerId: user.id, credits: Number(process.env.SIGNUP_FREE_CREDITS || 2) }).returning()
  await db.insert(schema.organizationMembers).values({ orgId: org.id, userId: user.id, role: 'owner' })
  const { acceptInvitesFor } = await import('./services/team')
  await acceptInvitesFor(user.id, user.email)
  if (org.credits > 0) await db.insert(schema.creditTransactions).values({ orgId: org.id, amount: org.credits, type: 'grant', description: 'Welcome credits', balanceAfter: org.credits })
  return { userId: user.id, orgId: org.id, email: user.email, name: user.name ?? '' }
}

/** Re-issues the session for another workspace the user belongs to. */
export async function switchOrganization(session: Session, orgId: string): Promise<Session> {
  const db = await getDb()
  const membership = await db.query.organizationMembers.findFirst({ where: and(eq(schema.organizationMembers.userId, session.userId), eq(schema.organizationMembers.orgId, orgId)) })
  if (!membership) throw new Error('You are not a member of that workspace')
  const next = { ...session, orgId }
  await createSessionCookie(next)
  return next
}

export async function signIn(email: string, password: string): Promise<Session> {
  const db = await getDb()
  const normalized = email.trim().toLowerCase()
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, normalized) })
  if (!user || !verifyPassword(password, user.passwordHash)) throw new Error('Invalid email or password')
  const { acceptInvitesFor } = await import('./services/team')
  await acceptInvitesFor(user.id, user.email)
  const membership = await db.query.organizationMembers.findFirst({ where: eq(schema.organizationMembers.userId, user.id) })
  if (!membership) throw new Error('No workspace found for this user')
  return { userId: user.id, orgId: membership.orgId, email: user.email, name: user.name ?? '' }
}
