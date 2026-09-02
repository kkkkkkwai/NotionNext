export const dynamic = 'force-dynamic'
import { withAuth, json } from '@/lib/api'
import { listProviders, saveProvider, systemKeysAvailable, type ProviderInput } from '@/lib/services/ai-settings'
import { PROVIDER_META, DEFAULT_MODELS } from '@/lib/ai/pricing'

export const GET = withAuth(async ({ session }) => json({ providers: await listProviders(session.orgId), systemKeys: systemKeysAvailable(), meta: PROVIDER_META, defaults: DEFAULT_MODELS }))

export const POST = withAuth(async ({ session, body }) => {
  const input = await body<ProviderInput>()
  if (!input.provider || !PROVIDER_META[input.provider]) return json({ error: 'Unknown provider' }, { status: 400 })
  const row = await saveProvider(session.orgId, input)
  return json({ provider: { ...row, apiKeyEnc: undefined } })
})
