import { and, desc, eq, sql, cosineDistance, gt } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'
import { getDb, schema } from '../db'
import { chunkText, crawlSite, parseBuffer, type ParsedDocument } from '../parsers'
import { embedTexts } from '../ai'
import { touchProject } from './projects'
import { describeError } from '../utils'

const uploadDir = () => path.resolve(process.cwd(), process.env.UPLOAD_DIR || './data/uploads')

export async function listSources(projectId: string) {
  const db = await getDb()
  return db.query.projectSources.findMany({ where: eq(schema.projectSources.projectId, projectId), orderBy: desc(schema.projectSources.createdAt) })
}

export async function createFileSource(projectId: string, file: { name: string; buffer: Buffer; mime?: string }) {
  const db = await getDb()
  const dir = path.join(uploadDir(), projectId)
  fs.mkdirSync(dir, { recursive: true })
  const safeName = file.name.replace(/[^\w.\-一-鿿]+/g, '_')
  const filePath = path.join(dir, `${Date.now()}_${safeName}`)
  fs.writeFileSync(filePath, file.buffer)
  const [src] = await db.insert(schema.projectSources).values({ projectId, type: 'file', name: file.name, filePath, mimeType: file.mime, size: file.buffer.length, status: 'pending' }).returning()
  return src
}

export async function createUrlSource(projectId: string, url: string, type: 'url' | 'gitbook' = 'url') {
  const db = await getDb()
  const [src] = await db.insert(schema.projectSources).values({ projectId, type, name: url, url, status: 'pending' }).returning()
  return src
}

export async function createTextSource(projectId: string, name: string, text: string, type: 'text' | 'manual' = 'text') {
  const db = await getDb()
  const [src] = await db.insert(schema.projectSources).values({ projectId, type, name, status: 'pending', size: Buffer.byteLength(text), meta: { text } }).returning()
  return src
}

/** Parses a source, chunks it, embeds the chunks and stores everything under the project. */
export async function ingestSource(orgId: string, projectId: string, sourceId: string, opts: { onProgress?: (msg: string) => void } = {}) {
  const db = await getDb()
  const src = await db.query.projectSources.findFirst({ where: and(eq(schema.projectSources.id, sourceId), eq(schema.projectSources.projectId, projectId)) })
  if (!src) throw new Error('Source not found')
  await db.update(schema.projectSources).set({ status: 'processing', error: null }).where(eq(schema.projectSources.id, sourceId))
  try {
    opts.onProgress?.('Parsing ' + src.name)
    let parsed: ParsedDocument
    if (src.type === 'file') {
      if (!src.filePath || !fs.existsSync(src.filePath)) throw new Error('Uploaded file is missing on disk')
      parsed = await parseBuffer(fs.readFileSync(src.filePath), src.name, src.mimeType ?? undefined)
    } else if (src.type === 'url' || src.type === 'gitbook') {
      parsed = await crawlSite(src.url!, src.type === 'gitbook' ? 25 : 12)
    } else {
      parsed = { title: src.name, text: String((src.meta as { text?: string }).text ?? '') }
    }
    if (!parsed.text || parsed.text.length < 20) throw new Error('No readable text found in this source')

    // Replace previous chunks/documents for this source (re-ingest support)
    await db.delete(schema.projectChunks).where(and(eq(schema.projectChunks.projectId, projectId), eq(schema.projectChunks.sourceId, sourceId)))
    await db.delete(schema.projectDocuments).where(and(eq(schema.projectDocuments.projectId, projectId), eq(schema.projectDocuments.sourceId, sourceId)))
    const [doc] = await db.insert(schema.projectDocuments).values({ projectId, sourceId, title: parsed.title || src.name, content: parsed.text, pageCount: parsed.pages?.length ?? null, charCount: parsed.text.length }).returning()

    opts.onProgress?.('Chunking')
    const chunks: { content: string; section?: string; page?: number }[] = []
    if (parsed.pages && parsed.pages.length > 0) {
      for (const p of parsed.pages) for (const c of chunkText(p.text)) chunks.push({ ...c, page: p.page })
    } else {
      chunks.push(...chunkText(parsed.text))
    }
    opts.onProgress?.(`Embedding ${chunks.length} chunks`)
    const { vectors, model, local } = await embedTexts({ orgId, projectId }, chunks.map((c) => c.content))
    const rows = chunks.map((c, i) => ({
      projectId, sourceId, documentId: doc.id, sourceName: src.name, content: c.content, embedding: vectors[i], page: c.page ?? null, section: c.section ?? null, chunkIndex: i,
      metadata: { embeddingModel: model, local }
    }))
    for (let i = 0; i < rows.length; i += 100) await db.insert(schema.projectChunks).values(rows.slice(i, i + 100))
    await db.update(schema.projectSources).set({ status: 'ready', chunkCount: rows.length, charCount: parsed.text.length, meta: { ...(src.meta as object), ...(parsed.meta ?? {}), title: parsed.title, embeddingModel: model, localEmbedding: local } }).where(eq(schema.projectSources.id, sourceId))
    await touchProject(projectId)
    return { chunks: rows.length, chars: parsed.text.length, text: parsed.text, title: parsed.title }
  } catch (err) {
    console.error('[knowledge] ingest failed', err)
    const message = describeError(err)
    await db.update(schema.projectSources).set({ status: 'failed', error: message }).where(eq(schema.projectSources.id, sourceId))
    throw new Error(message)
  }
}

export async function deleteSource(projectId: string, sourceId: string) {
  const db = await getDb()
  const src = await db.query.projectSources.findFirst({ where: and(eq(schema.projectSources.id, sourceId), eq(schema.projectSources.projectId, projectId)) })
  if (!src) return
  await db.delete(schema.projectChunks).where(and(eq(schema.projectChunks.projectId, projectId), eq(schema.projectChunks.sourceId, sourceId)))
  await db.delete(schema.projectDocuments).where(and(eq(schema.projectDocuments.projectId, projectId), eq(schema.projectDocuments.sourceId, sourceId)))
  await db.delete(schema.projectSources).where(eq(schema.projectSources.id, sourceId))
  if (src.filePath && fs.existsSync(src.filePath)) fs.unlinkSync(src.filePath)
}

export interface SearchHit { id: string; content: string; sourceName: string; sourceId: string; page: number | null; section: string | null; score: number }

/** Vector search scoped STRICTLY to one project. */
export async function searchKnowledge(orgId: string, projectId: string, query: string, limit = 8): Promise<SearchHit[]> {
  const db = await getDb()
  const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(schema.projectChunks).where(eq(schema.projectChunks.projectId, projectId))
  if (!n) return []
  const { vectors, local } = await embedTexts({ orgId, projectId }, [query])
  const qv = vectors[0]
  // If the stored chunks were embedded with a different model than the query, similarity is meaningless.
  // We fall back to lexical search for those chunks.
  const similarity = sql<number>`1 - (${cosineDistance(schema.projectChunks.embedding, qv)})`
  const rows = await db.select({
    id: schema.projectChunks.id, content: schema.projectChunks.content, sourceName: schema.projectChunks.sourceName, sourceId: schema.projectChunks.sourceId,
    page: schema.projectChunks.page, section: schema.projectChunks.section, score: similarity, metadata: schema.projectChunks.metadata
  }).from(schema.projectChunks).where(eq(schema.projectChunks.projectId, projectId)).orderBy(desc(similarity)).limit(limit * 2)
  const compatible = rows.filter((r) => Boolean((r.metadata as { local?: boolean })?.local) === local)
  let hits = (compatible.length ? compatible : rows).slice(0, limit)
  const lexical = await lexicalSearch(projectId, query, limit)
  // Merge lexical hits that vector search missed
  const seen = new Set(hits.map((h) => h.id))
  for (const l of lexical) if (!seen.has(l.id) && hits.length < limit + 2) hits.push({ ...l, metadata: {} })
  return hits.map(({ metadata: _m, ...h }) => ({ ...h, score: Number(h.score ?? 0) }))
}

async function lexicalSearch(projectId: string, query: string, limit: number): Promise<SearchHit[]> {
  const db = await getDb()
  const terms = Array.from(new Set((query.toLowerCase().match(/[a-z0-9]{3,}|[一-鿿]{2,}/g) ?? []))).slice(0, 8)
  if (!terms.length) return []
  const conditions = terms.map((t) => sql`lower(${schema.projectChunks.content}) like ${'%' + t + '%'}`)
  const scoreExpr = sql<number>`(${sql.join(conditions.map((c) => sql`(case when ${c} then 1 else 0 end)`), sql` + `)})`
  const rows = await db.select({
    id: schema.projectChunks.id, content: schema.projectChunks.content, sourceName: schema.projectChunks.sourceName, sourceId: schema.projectChunks.sourceId,
    page: schema.projectChunks.page, section: schema.projectChunks.section, score: scoreExpr
  }).from(schema.projectChunks).where(and(eq(schema.projectChunks.projectId, projectId), gt(scoreExpr, 0))).orderBy(desc(scoreExpr)).limit(limit)
  return rows.map((r) => ({ ...r, score: Number(r.score) / terms.length }))
}

export async function knowledgeStats(projectId: string) {
  const db = await getDb()
  const [row] = await db.select({
    sources: sql<number>`count(distinct ${schema.projectSources.id})`.mapWith(Number),
    chunks: sql<number>`(select count(*) from project_chunks c where c.project_id = ${projectId})`.mapWith(Number),
    chars: sql<number>`coalesce(sum(${schema.projectSources.charCount}),0)`.mapWith(Number)
  }).from(schema.projectSources).where(eq(schema.projectSources.projectId, projectId))
  return row
}

export async function getDocumentText(projectId: string, sourceId: string) {
  const db = await getDb()
  const doc = await db.query.projectDocuments.findFirst({ where: and(eq(schema.projectDocuments.projectId, projectId), eq(schema.projectDocuments.sourceId, sourceId)) })
  return doc?.content ?? ''
}
