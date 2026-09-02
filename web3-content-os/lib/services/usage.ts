import { and, desc, eq, sql } from 'drizzle-orm'
import { getDb, schema } from '../db'

export async function usageSummary(orgId: string) {
  const db = await getDb()
  const base = eq(schema.aiUsage.orgId, orgId)
  const totals = (await db.select({ calls: sql<number>`coalesce(sum(requests),0)`.mapWith(Number), input: sql<number>`coalesce(sum(input_tokens),0)`.mapWith(Number), output: sql<number>`coalesce(sum(output_tokens),0)`.mapWith(Number), cost: sql<number>`coalesce(sum(cost),0)`.mapWith(Number) }).from(schema.aiUsage).where(base))[0]
  const byModel = await db.select({ provider: schema.aiUsage.provider, model: schema.aiUsage.model, calls: sql<number>`sum(requests)`.mapWith(Number), tokens: sql<number>`sum(input_tokens+output_tokens)`.mapWith(Number), cost: sql<number>`sum(cost)`.mapWith(Number) }).from(schema.aiUsage).where(base).groupBy(schema.aiUsage.provider, schema.aiUsage.model).orderBy(desc(sql`sum(cost)`))
  const byTask = await db.select({ taskType: schema.aiUsage.taskType, calls: sql<number>`sum(requests)`.mapWith(Number), tokens: sql<number>`sum(input_tokens+output_tokens)`.mapWith(Number), cost: sql<number>`sum(cost)`.mapWith(Number) }).from(schema.aiUsage).where(base).groupBy(schema.aiUsage.taskType).orderBy(desc(sql`sum(cost)`))
  const byContentType = await db.select({ contentType: schema.aiUsage.contentType, calls: sql<number>`sum(requests)`.mapWith(Number), cost: sql<number>`sum(cost)`.mapWith(Number) }).from(schema.aiUsage).where(and(base, sql`content_type is not null`)).groupBy(schema.aiUsage.contentType).orderBy(desc(sql`sum(cost)`))
  const byProject = await db.select({ projectId: schema.aiUsage.projectId, name: schema.projects.name, calls: sql<number>`sum(${schema.aiUsage.requests})`.mapWith(Number), tokens: sql<number>`sum(${schema.aiUsage.inputTokens}+${schema.aiUsage.outputTokens})`.mapWith(Number), cost: sql<number>`sum(${schema.aiUsage.cost})`.mapWith(Number) }).from(schema.aiUsage).leftJoin(schema.projects, eq(schema.projects.id, schema.aiUsage.projectId)).where(base).groupBy(schema.aiUsage.projectId, schema.projects.name).orderBy(desc(sql`sum(${schema.aiUsage.cost})`))
  const byDay = await db.select({ day: schema.aiUsage.day, calls: sql<number>`sum(requests)`.mapWith(Number), cost: sql<number>`sum(cost)`.mapWith(Number) }).from(schema.aiUsage).where(base).groupBy(schema.aiUsage.day).orderBy(desc(schema.aiUsage.day)).limit(30)
  const recent = await db.query.aiRequests.findMany({ where: eq(schema.aiRequests.orgId, orgId), orderBy: desc(schema.aiRequests.createdAt), limit: 25 })
  return { totals, byModel, byTask, byContentType, byProject, byDay: byDay.reverse(), recent }
}
