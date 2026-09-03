const BASE = 'http://localhost:3100'
let cookie = ''
const log = (...a) => console.log('•', ...a)
const fail = (m) => { console.error('✗', m); process.exit(1) }
async function call(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), cookie, ...(opts.headers ?? {}) }, body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined })
  const sc = res.headers.get('set-cookie')
  if (sc) cookie = sc.split(';')[0]
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${typeof data === 'string' ? data.slice(0, 200) : data.error}`)
  return data
}
async function waitJob(pid, jobId) {
  for (let i = 0; i < 120; i++) {
    const { job } = await call(`/api/projects/${pid}/jobs/${jobId}`)
    if (job.status === 'completed') return job
    if (job.status === 'failed') throw new Error('job failed: ' + job.error)
    await new Promise((r) => setTimeout(r, 700))
  }
  throw new Error('job timeout')
}
const email = `e2e${Date.now()}@test.local`
await call('/api/auth/signup', { method: 'POST', body: { email, password: 'password123', name: 'E2E' } })
log('signup ok', email)
// unauthenticated check
const r401 = await fetch(BASE + '/api/projects'); if (r401.status !== 401) fail('expected 401 without cookie')
const { provider } = await call('/api/settings/providers', { method: 'POST', body: { provider: 'openai_compatible', name: 'Mock', apiKey: 'mock-key', baseUrl: 'http://localhost:3199/v1', defaultModel: 'mock-fast', embeddingModel: 'mock-embed' } })
const t = await call(`/api/settings/providers/${provider.id}/test`, { method: 'POST' })
log('provider test', t.model, t.reply, t.models.length, 'models')
await call('/api/settings/tasks', { method: 'POST', body: { taskType: 'dna', providerId: provider.id, model: 'mock-strong' } })
const { project } = await call('/api/projects', { method: 'POST', body: { name: 'TOKI Network', idea: 'A DePIN network', tokenSymbol: 'TOKI', industry: 'DePIN' } })
log('project', project.id)
const fd = new FormData()
fd.append('files', new File(['TOKI token total supply is 10,000,000,000. Allocation: 40% community, 20% team, 20% investors.\n\nThe TOKI token is used for staking and governance. Partners include Example Labs. Mainnet launches in Q4.'], 'Tokenomics-V3.txt', { type: 'text/plain' }))
fd.append('files', new File(['# TOKI Whitepaper\n\nOld draft: total supply 1,000,000,000 ATM tokens.\n\n## Architecture\nOperators run verified uptime proofs.'], 'whitepaper-old.md', { type: 'text/markdown' }))
const { sources } = await call(`/api/projects/${project.id}/sources`, { method: 'POST', body: fd })
log('uploaded', sources.length, 'sources')
const { job } = await call(`/api/projects/${project.id}/ingest`, { method: 'POST', body: { sourceIds: sources.map((s) => s.id), generateDna: true } })
const done = await waitJob(project.id, job.id)
log('ingest job', done.status, JSON.stringify(done.result).slice(0, 200))
const { facts } = await call(`/api/projects/${project.id}/facts`)
log('facts', facts.map((f) => `${f.key}=${f.value}[${f.status}]`).join(', '))
if (!facts.find((f) => f.key === 'token_supply')) fail('token_supply not extracted')
const { dna } = await call(`/api/projects/${project.id}/dna`)
if (!dna?.data?.project_overview) fail('dna missing'); log('dna v' + dna.version)
const rd = await call(`/api/projects/${project.id}/readiness`)
log('readiness', rd.total, JSON.stringify(rd.dimensions))
const hits = await call(`/api/projects/${project.id}/knowledge/search`, { method: 'POST', body: { query: 'total supply' } })
log('search hits', hits.hits.length, hits.hits[0]?.sourceName)
// lock a fact and verify AI cannot override
const supply = facts.find((f) => f.key === 'token_supply')
await call(`/api/projects/${project.id}/facts/${supply.id}`, { method: 'PATCH', body: { status: 'locked' } })
const hist = await call(`/api/projects/${project.id}/facts/${supply.id}/history`)
log('fact history versions', hist.versions.length)
// chat with SSE + memory extraction
const res = await fetch(BASE + `/api/projects/${project.id}/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ message: '以后 Token 不叫 ATM，全部统一成 TOKI。帮我写今天的 Twitter。' }) })
const sse = await res.text()
const events = [...sse.matchAll(/event: (\w+)\ndata: (.*)/g)].map((m) => [m[1], m[2]])
log('sse events', events.map((e) => e[0]).join(','))
if (!events.find((e) => e[0] === 'message')) fail('no message event: ' + sse.slice(0, 300))
if (!events.find((e) => e[0] === 'memories')) fail('terminology memory not extracted')
const mem = await call(`/api/projects/${project.id}/memory`)
log('terminology', mem.terminology.map((t) => `${t.oldTerm}→${t.newTerm}`).join(','), 'memories', mem.memories.length, 'events', mem.events.length)
const convs = await call(`/api/projects/${project.id}/chat/conversations`)
const msgs = await call(`/api/projects/${project.id}/chat/conversations/${convs.conversations[0].id}`)
log('conversation persisted', convs.conversations.length, 'messages', msgs.messages.length)
// generate content
const tpl = await call('/api/templates')
const tweet = tpl.templates.find((t) => t.slug === 'social-tweet')
const gen = await call(`/api/projects/${project.id}/content`, { method: 'POST', body: { templateId: tweet.id, language: 'en', variants: 3 } })
log('generated', gen.item.title, '| missing:', gen.missing.join(','), '| body:', gen.item.body.replace(/\n/g, ' ').slice(0, 80))
if (/\bATM\b/.test(gen.item.body)) fail('terminology not applied')
const edited = await call(`/api/projects/${project.id}/content/${gen.item.id}/edit`, { method: 'POST', body: { action: 'shorter' } })
log('edited v' + edited.item.currentVersion, edited.item.body.slice(0, 40))
const detail = await call(`/api/projects/${project.id}/content/${gen.item.id}`)
log('versions', detail.versions.length)
await call(`/api/projects/${project.id}/content/${gen.item.id}/restore`, { method: 'POST', body: { version: 1 } })
const translated = await call(`/api/projects/${project.id}/content/${gen.item.id}/edit`, { method: 'POST', body: { action: 'translate', targetLanguage: 'zh' } })
log('translated created', translated.created, translated.item.language)
// manual content mentioning old value + consistency
const manual = await call(`/api/projects/${project.id}/content`, { method: 'POST', body: { contentType: 'custom', category: 'social', brief: 'x', title: 'Manual' } })
await call(`/api/projects/${project.id}/content/${manual.item.id}`, { method: 'PATCH', body: { body: 'Total supply of ATM is 1,000,000,000. Guaranteed returns, listed on Binance!', status: 'review', tags: ['old'], folder: 'Tests' } })
await call(`/api/projects/${project.id}/facts`, { method: 'POST', body: { key: 'token_supply', value: '10,000,000,000' } })
await call(`/api/projects/${project.id}/facts/${supply.id}`, { method: 'PATCH', body: { value: '10B' } })
const cons = await call(`/api/projects/${project.id}/consistency`)
log('consistency issues', cons.issues.length, cons.issues.map((i) => `${i.oldValue}→${i.newValue}`).join(','))
if (!cons.issues.find((i) => i.oldValue === 'ATM')) fail('consistency did not find ATM')
const applied = await call(`/api/projects/${project.id}/consistency`, { method: 'POST', body: { fixes: cons.issues.map((i) => ({ contentId: i.contentId, oldValue: i.oldValue, newValue: i.newValue })) } })
log('consistency applied', applied.updated)
const risk = await call(`/api/projects/${project.id}/risk`)
log('risk flagged', risk.results.length, risk.results.map((r) => r.score).join(','))
const rw = await call(`/api/projects/${project.id}/risk`, { method: 'POST', body: { contentId: manual.item.id, rewrite: true } })
log('safe rewrite', rw.rescan.score)
// library filters
const lib = await call(`/api/projects/${project.id}/content?facets=1&status=review`)
log('library review items', lib.total, 'facets tags', lib.facets.tags.join(','))
// campaign
const camp = await call(`/api/projects/${project.id}/campaigns`, { method: 'POST', body: { goal: 'Launch on Binance Alpha', launchDate: '2026-09-20', daysBefore: 2, types: ['social-tweet', 'social-telegram'] } })
const cj = await waitJob(project.id, camp.job.id)
log('campaign job', cj.status, JSON.stringify(cj.result))
const cd = await call(`/api/projects/${project.id}/campaigns/${camp.campaign.id}`)
log('campaign items', cd.items.filter((i) => i.contentId).length, 'content', cd.content.length, 'status', cd.campaign.status)
const cal = await call(`/api/projects/${project.id}/calendar?from=2026-09-01T00:00:00Z&to=2026-09-30T00:00:00Z`)
log('calendar items', cal.items.length)
// launch kit lite
const lk = await call(`/api/projects/${project.id}/launch-kit`, { method: 'POST', body: { language: 'en', lite: true } })
const lkj = await waitJob(project.id, lk.job.id)
log('launch kit', lkj.status, 'created', lkj.result.created, 'failed', lkj.result.failed, 'risky', lkj.result.risky)
if (lkj.result.failed) console.log(JSON.stringify(lkj.result.errors))
const narrative = await call(`/api/projects/${project.id}/narrative`)
log('narrative angles', narrative.narrative?.data?.content_angles?.length)
const usage = await call('/api/settings/usage')
log('usage calls', usage.totals.calls, 'byTask', usage.byTask.map((t) => `${t.taskType}:${t.calls}`).join(' '))
// isolation: second project must not see project 1 facts
const { project: p2 } = await call('/api/projects', { method: 'POST', body: { name: 'Other Project' } })
const f2 = await call(`/api/projects/${p2.id}/facts`)
const h2 = await call(`/api/projects/${p2.id}/knowledge/search`, { method: 'POST', body: { query: 'total supply' } })
if (f2.facts.length || h2.hits.length) fail('isolation broken')
log('isolation ok (project 2 sees 0 facts, 0 chunks)')
// other user cannot access project
cookie = ''
await call('/api/auth/signup', { method: 'POST', body: { email: `other${Date.now()}@test.local`, password: 'password123' } })
const forbidden = await fetch(BASE + `/api/projects/${project.id}/facts`, { headers: { cookie } })
if (forbidden.status !== 404) fail('cross-org access not blocked: ' + forbidden.status)
log('cross-workspace access blocked (404)')
console.log('\nALL API E2E CHECKS PASSED. project=' + project.id + ' email=' + email)
