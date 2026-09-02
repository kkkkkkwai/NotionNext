import { getDb, dbMode } from '../lib/db'

async function main() {
  await getDb()
  console.log(`Database ready (${dbMode()}).`)
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
