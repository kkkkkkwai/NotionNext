import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import postgres from 'postgres'
import path from 'node:path'
import fs from 'node:fs'
import * as schema from './schema'

export type Database = ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>

type Cache = { db?: Database; ready?: Promise<Database>; mode?: 'postgres' | 'pglite' }
const g = globalThis as unknown as { __web3os_db?: Cache }
if (!g.__web3os_db) g.__web3os_db = {}
const cache = g.__web3os_db

const migrationsFolder = path.join(process.cwd(), 'drizzle')

async function init(): Promise<Database> {
  const url = process.env.DATABASE_URL?.trim()
  if (url) {
    const client = postgres(url, { max: 10, prepare: false })
    const db = drizzlePg(client, { schema })
    await migratePg(db, { migrationsFolder })
    cache.mode = 'postgres'
    return db as Database
  }
  const dataDir = path.resolve(process.cwd(), process.env.PGLITE_DATA_DIR || path.join('data', 'pglite'))
  fs.mkdirSync(dataDir, { recursive: true })
  const client = new PGlite(dataDir, { extensions: { vector } })
  await client.waitReady
  const db = drizzlePglite(client, { schema })
  await migratePglite(db, { migrationsFolder })
  cache.mode = 'pglite'
  return db as Database
}

/** Returns the (migrated) database singleton. Safe to call from any server code. */
export async function getDb(): Promise<Database> {
  if (cache.db) return cache.db
  if (!cache.ready) {
    cache.ready = init().then((db) => {
      cache.db = db
      return db
    }).catch((err) => {
      cache.ready = undefined
      throw err
    })
  }
  return cache.ready
}

export function dbMode() {
  return cache.mode ?? (process.env.DATABASE_URL ? 'postgres' : 'pglite')
}

export { schema }
