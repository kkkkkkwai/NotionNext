import { createHash } from 'node:crypto'
import { EMBEDDING_DIM } from '../db/schema'

/**
 * Deterministic hashed n-gram embedding used when no embedding provider is configured.
 * It is not semantic, but it keeps the knowledge base searchable (lexical overlap) with zero external calls.
 */
export function localEmbedding(text: string, dim = EMBEDDING_DIM): number[] {
  const v = new Float64Array(dim)
  const normalized = text.toLowerCase()
  const tokens = normalized.match(/[a-z0-9]+|[一-鿿]/g) ?? []
  const feats: string[] = []
  for (const t of tokens) {
    feats.push('w:' + t)
    if (t.length > 4) for (let i = 0; i + 3 <= t.length; i++) feats.push('c:' + t.slice(i, i + 3))
  }
  for (let i = 0; i + 1 < tokens.length; i++) feats.push('b:' + tokens[i] + '_' + tokens[i + 1])
  for (const f of feats) {
    const h = createHash('md5').update(f).digest()
    const idx = h.readUInt32LE(0) % dim
    const sign = h[4] & 1 ? 1 : -1
    v[idx] += sign
  }
  let norm = 0
  for (let i = 0; i < dim; i++) norm += v[i] * v[i]
  norm = Math.sqrt(norm) || 1
  return Array.from(v, (x) => x / norm)
}

export function fitDimension(vec: number[], dim = EMBEDDING_DIM): number[] {
  if (vec.length === dim) return vec
  if (vec.length > dim) return vec.slice(0, dim)
  return [...vec, ...new Array(dim - vec.length).fill(0)]
}
