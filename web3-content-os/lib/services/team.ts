import { and, desc, eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { getDb, schema } from '../db'

export const ROLES = ['owner', 'admin', 'editor', 'viewer'] as const
export type Role = typeof ROLES[number]

export async function getMembership(orgId: string, userId: string) {
  const db = await getDb()
  return db.query.organizationMembers.findFirst({ where: and(eq(schema.organizationMembers.orgId, orgId), eq(schema.organizationMembers.userId, userId)) })
}

export async function requireRole(orgId: string, userId: string, allowed: Role[]) {
  const m = await getMembership(orgId, userId)
  if (!m || !allowed.includes(m.role as Role)) throw new Error('你没有执行此操作的权限')
  return m
}

export async function listMembers(orgId: string) {
  const db = await getDb()
  return db.select({ id: schema.organizationMembers.id, userId: schema.users.id, role: schema.organizationMembers.role, email: schema.users.email, name: schema.users.name, joinedAt: schema.organizationMembers.createdAt })
    .from(schema.organizationMembers).innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId)).where(eq(schema.organizationMembers.orgId, orgId)).orderBy(schema.organizationMembers.createdAt)
}

export async function listInvites(orgId: string) {
  const db = await getDb()
  return db.query.organizationInvites.findMany({ where: and(eq(schema.organizationInvites.orgId, orgId), eq(schema.organizationInvites.status, 'pending')), orderBy: desc(schema.organizationInvites.createdAt) })
}

/** Creates an invite. If the user already exists they are added immediately; otherwise a link token is returned. */
export async function inviteMember(orgId: string, invitedBy: string, email: string, role: Role) {
  const db = await getDb()
  const normalized = email.trim().toLowerCase()
  if (!normalized.includes('@')) throw new Error('邮箱格式不正确')
  if (role === 'owner') throw new Error('不能通过邀请授予所有者角色')
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, normalized) })
  if (user) {
    const existing = await getMembership(orgId, user.id)
    if (existing) throw new Error('该用户已经是成员')
    await db.insert(schema.organizationMembers).values({ orgId, userId: user.id, role })
    return { added: true as const, email: normalized }
  }
  const token = randomBytes(24).toString('base64url')
  const [invite] = await db.insert(schema.organizationInvites).values({ orgId, email: normalized, role, token, invitedBy, expiresAt: new Date(Date.now() + 14 * 86400000) }).returning()
  return { added: false as const, invite }
}

export async function revokeInvite(orgId: string, inviteId: string) {
  const db = await getDb()
  await db.update(schema.organizationInvites).set({ status: 'revoked' }).where(and(eq(schema.organizationInvites.id, inviteId), eq(schema.organizationInvites.orgId, orgId)))
}

/** Accepts pending invites for a user's email (called at signup/login and via invite link). */
export async function acceptInvitesFor(userId: string, email: string, token?: string) {
  const db = await getDb()
  const where = token ? eq(schema.organizationInvites.token, token) : and(eq(schema.organizationInvites.email, email.toLowerCase()), eq(schema.organizationInvites.status, 'pending'))
  const invites = await db.query.organizationInvites.findMany({ where })
  const joined: string[] = []
  for (const inv of invites) {
    if (inv.status === 'accepted' && token && inv.email === email.toLowerCase() && (await getMembership(inv.orgId, userId))) {
      joined.push(inv.orgId) // already auto-accepted at signup; still report the workspace so the client can switch to it
      continue
    }
    if (inv.status !== 'pending') continue
    if (inv.expiresAt && inv.expiresAt < new Date()) continue
    if (token && inv.email !== email.toLowerCase()) throw new Error('该邀请链接对应的是另一个邮箱')
    const existing = await getMembership(inv.orgId, userId)
    if (!existing) await db.insert(schema.organizationMembers).values({ orgId: inv.orgId, userId, role: inv.role })
    await db.update(schema.organizationInvites).set({ status: 'accepted' }).where(eq(schema.organizationInvites.id, inv.id))
    joined.push(inv.orgId)
  }
  return joined
}

export async function updateMemberRole(orgId: string, actorId: string, memberId: string, role: Role) {
  const db = await getDb()
  await requireRole(orgId, actorId, ['owner', 'admin'])
  const target = await db.query.organizationMembers.findFirst({ where: and(eq(schema.organizationMembers.id, memberId), eq(schema.organizationMembers.orgId, orgId)) })
  if (!target) throw new Error('成员不存在')
  if (target.role === 'owner') throw new Error('所有者的角色不能修改')
  if (role === 'owner') throw new Error('所有者角色需通过转让设置')
  await db.update(schema.organizationMembers).set({ role }).where(eq(schema.organizationMembers.id, memberId))
}

export async function removeMember(orgId: string, actorId: string, memberId: string) {
  const db = await getDb()
  await requireRole(orgId, actorId, ['owner', 'admin'])
  const target = await db.query.organizationMembers.findFirst({ where: and(eq(schema.organizationMembers.id, memberId), eq(schema.organizationMembers.orgId, orgId)) })
  if (!target) throw new Error('成员不存在')
  if (target.role === 'owner') throw new Error('不能移除所有者')
  await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.id, memberId))
}

export async function listUserOrganizations(userId: string) {
  const db = await getDb()
  return db.select({ id: schema.organizations.id, name: schema.organizations.name, role: schema.organizationMembers.role, credits: schema.organizations.credits })
    .from(schema.organizationMembers).innerJoin(schema.organizations, eq(schema.organizations.id, schema.organizationMembers.orgId)).where(eq(schema.organizationMembers.userId, userId)).orderBy(schema.organizationMembers.createdAt)
}

export async function renameOrganization(orgId: string, actorId: string, name: string) {
  const db = await getDb()
  await requireRole(orgId, actorId, ['owner', 'admin'])
  await db.update(schema.organizations).set({ name: name.trim().slice(0, 80) }).where(eq(schema.organizations.id, orgId))
}
