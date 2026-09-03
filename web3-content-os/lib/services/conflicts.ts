import { and, desc, eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { upsertFact } from './facts'

/** Records that an AI-extracted value disagrees with a confirmed/locked fact (never auto-applied). */
export async function recordConflict(projectId: string, input: { factId: string; key: string; label: string; currentValue: string; proposedValue: string; source?: string; sourceRef?: Record<string, unknown> }) {
  const db = await getDb()
  const existing = await db.query.projectFactConflicts.findFirst({ where: and(eq(schema.projectFactConflicts.projectId, projectId), eq(schema.projectFactConflicts.factId, input.factId), eq(schema.projectFactConflicts.proposedValue, input.proposedValue), eq(schema.projectFactConflicts.status, 'open')) })
  if (existing) return existing
  const [row] = await db.insert(schema.projectFactConflicts).values({ projectId, factId: input.factId, key: input.key, label: input.label, currentValue: input.currentValue, proposedValue: input.proposedValue, source: input.source ?? null, sourceRef: (input.sourceRef ?? {}) as never }).returning()
  return row
}

export async function listConflicts(projectId: string, status: 'open' | 'all' = 'open') {
  const db = await getDb()
  const where = status === 'open' ? and(eq(schema.projectFactConflicts.projectId, projectId), eq(schema.projectFactConflicts.status, 'open')) : eq(schema.projectFactConflicts.projectId, projectId)
  return db.query.projectFactConflicts.findMany({ where, orderBy: desc(schema.projectFactConflicts.createdAt) })
}

/** Resolves a conflict: keep the current value, or accept the proposed one (creates a new fact version). */
export async function resolveConflict(projectId: string, conflictId: string, action: 'keep' | 'accept', userId: string) {
  const db = await getDb()
  const c = await db.query.projectFactConflicts.findFirst({ where: and(eq(schema.projectFactConflicts.id, conflictId), eq(schema.projectFactConflicts.projectId, projectId)) })
  if (!c) throw new Error('Conflict not found')
  if (action === 'accept') {
    await upsertFact(projectId, { key: c.key, value: c.proposedValue, source: c.source ?? 'Accepted from document', sourceRef: c.sourceRef, note: `Accepted over "${c.currentValue}"` }, { by: userId, force: true })
  }
  const [row] = await db.update(schema.projectFactConflicts).set({ status: action === 'accept' ? 'accepted' : 'kept', resolvedBy: userId, resolvedAt: new Date() }).where(eq(schema.projectFactConflicts.id, conflictId)).returning()
  return row
}
