import { getDb } from '../lib/db'
import { ensureSystemTemplates, SYSTEM_TEMPLATES } from '../lib/services/templates'

async function main() {
  await getDb()
  await ensureSystemTemplates()
  console.log(`Seeded ${SYSTEM_TEMPLATES.length} system content templates.`)
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
