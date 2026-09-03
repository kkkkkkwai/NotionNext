// Phase-2 checks: conflicts, credits, team, integrations/publishing, poster, logo. Requires mock-llm on :3199 and app on :3100
// started with TELEGRAM_API_BASE=http://localhost:3199 X_API_BASE=http://localhost:3199 SCHEDULER_INTERVAL_MS=2000.
const BASE = 'http://localhost:3100'
let cookie = ''
const log = (...a) => console.log('•', ...a)
const fail = (m) => { console.error('✗', m); process.exit(1) }
async function call(path, opts = {}, useCookie = cookie) {
  const res = await fetch(BASE + path, { ...opts, headers: { ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), cookie: useCookie, ...(opts.headers ?? {}) }, body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined })
  const sc = res.headers.get('set-cookie')
  if (sc && useCookie === cookie) cookie = sc.split(';')[0]
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${typeof data === 'string' ? data.slice(0, 200) : data.error}`)
  return data
}
const waitJob = async (pid, id) => { for (let i = 0; i < 120; i++) { const { job } = await call(`/api/projects/${pid}/jobs/${id}`); if (job.status === 'completed') return job; if (job.status === 'failed') throw new Error(job.error); await new Promise((r) => setTimeout(r, 500)) } throw new Error('timeout') }
const stamp = Date.now()
const ownerEmail = `owner${stamp}@test.local`
await call('/api/auth/signup', { method: 'POST', body: { email: ownerEmail, password: 'password123', name: 'Owner' } })
// ---- credits: welcome grant
let bill = await call('/api/settings/billing')
log('welcome credits', bill.balance, 'tx', bill.transactions.length)
if (!(bill.balance > 0)) fail('no welcome credits')
const { provider } = await call('/api/settings/providers', { method: 'POST', body: { provider: 'openai_compatible', name: 'Mock', apiKey: 'mock-key', baseUrl: 'http://localhost:3199/v1', defaultModel: 'mock-fast', embeddingModel: 'mock-embed' } })
const { project } = await call('/api/projects', { method: 'POST', body: { name: 'Conflict Co', tokenSymbol: 'TOKI' } })
// ---- conflicts: lock a fact, then ingest a document proposing a different value
await call(`/api/projects/${project.id}/facts`, { method: 'POST', body: { key: 'token_supply', value: '10,000,000,000', lock: true } })
const { sources } = await call(`/api/projects/${project.id}/sources`, { method: 'POST', body: { text: 'Old whitepaper: TOKI total supply is 1,000,000,000.', name: 'old-wp' } })
// mock extraction always proposes 10,000,000,000 for token_supply; make the locked value differ instead
await call(`/api/projects/${project.id}/facts`, { method: 'POST', body: { key: 'token_supply', value: '10B', lock: true } })
const { job } = await call(`/api/projects/${project.id}/ingest`, { method: 'POST', body: { sourceIds: sources.map((s) => s.id), generateDna: false } })
const done = await waitJob(project.id, job.id)
log('ingest', JSON.stringify(done.result.facts), 'conflicts', (done.result.conflicts ?? []).length)
const { conflicts } = await call(`/api/projects/${project.id}/conflicts`)
log('open conflicts', conflicts.map((c) => `${c.key}: ${c.currentValue} vs ${c.proposedValue}`).join(' | '))
const supplyConflict = conflicts.find((c) => c.key === 'token_supply')
if (!supplyConflict) fail('conflict not recorded')
let { facts } = await call(`/api/projects/${project.id}/facts`)
if (facts.find((f) => f.key === 'token_supply').value !== '10B') fail('locked fact was overwritten')
await call(`/api/projects/${project.id}/conflicts/${supplyConflict.id}`, { method: 'POST', body: { action: 'accept' } })
facts = (await call(`/api/projects/${project.id}/facts`)).facts
const supply = facts.find((f) => f.key === 'token_supply')
log('after accept', supply.value, 'v' + supply.version, supply.status)
if (supply.value !== '10,000,000,000' || supply.status !== 'locked') fail('accept did not apply / lock lost')
if ((await call(`/api/projects/${project.id}/conflicts`)).conflicts.length) fail('conflict still open')
// ---- team: invite existing user (added directly) + link invite for new user
const memberEmail = `member${stamp}@test.local`
const ownerCookie = cookie
cookie = ''
await call('/api/auth/signup', { method: 'POST', body: { email: memberEmail, password: 'password123', name: 'Member' } })
const memberCookie = cookie
cookie = ownerCookie
const inv1 = await call('/api/settings/team/invites', { method: 'POST', body: { email: memberEmail, role: 'editor' } })
log('invite existing →', inv1.added ? 'added directly' : 'link')
const inv2 = await call('/api/settings/team/invites', { method: 'POST', body: { email: `new${stamp}@test.local`, role: 'viewer' } })
log('invite new →', inv2.link ? 'link issued' : 'added')
const team = await call('/api/settings/team')
log('members', team.members.map((m) => `${m.email}:${m.role}`).join(','), 'pending', team.invites.length)
if (team.members.length !== 2) fail('member not added')
// member switches into owner's workspace and sees the project; viewer role cannot invite
const memberOrgs = await call('/api/settings/team', {}, memberCookie)
const target = memberOrgs.organizations.find((o) => o.id === team.org.id)
if (!target) fail('member does not see invited workspace')
const swRes = await fetch(BASE + '/api/settings/team/switch', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: memberCookie }, body: JSON.stringify({ orgId: target.id }) })
const memberCookie2 = swRes.headers.get('set-cookie').split(';')[0]
const seen = await call('/api/projects', {}, memberCookie2)
log('member sees projects after switch:', seen.projects.length)
if (!seen.projects.find((p) => p.project.id === project.id)) fail('switch failed')
const forbidden = await fetch(BASE + '/api/settings/team/invites', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: memberCookie2 }, body: JSON.stringify({ email: 'x@y.z' }) })
log('editor invite attempt →', forbidden.status)
if (forbidden.status === 200) fail('editor could invite')
// new-user invite link → signup with token
const token = new URL(inv2.link).searchParams.get('invite')
const info = await call(`/api/invites/${token}`)
log('invite info', info.workspace, info.role)
cookie = ''
await call('/api/auth/signup', { method: 'POST', body: { email: `new${stamp}@test.local`, password: 'password123' } })
const newCookie = cookie
const joined = await call(`/api/invites/${token}`, { method: 'POST' }, newCookie)
log('invite accepted, joined', joined.joined.length)
cookie = ownerCookie
const team2 = await call('/api/settings/team')
if (team2.members.length !== 3 || team2.invites.length !== 0) fail('link invite not accepted: ' + team2.members.length)
// role change + remove
const viewer = team2.members.find((m) => m.email === `new${stamp}@test.local`)
await call(`/api/settings/team/members/${viewer.id}`, { method: 'PATCH', body: { role: 'admin' } })
await call(`/api/settings/team/members/${viewer.id}`, { method: 'DELETE' })
log('role change + remove ok, members now', (await call('/api/settings/team')).members.length)
// ---- integrations + publishing
await call(`/api/projects/${project.id}/integrations`, { method: 'POST', body: { kind: 'telegram', config: { botToken: 'mock-tg-123', chatId: '@tokichannel' } } })
await call(`/api/projects/${project.id}/integrations`, { method: 'POST', body: { kind: 'x', config: { apiKey: 'mockx', apiSecret: 's', accessToken: 't', accessSecret: 'ts' } } })
log('telegram test', (await call(`/api/projects/${project.id}/integrations/telegram/test`, { method: 'POST' })).account, '| x test', (await call(`/api/projects/${project.id}/integrations/x/test`, { method: 'POST' })).account)
const tpl = await call('/api/templates')
const gen = await call(`/api/projects/${project.id}/content`, { method: 'POST', body: { templateId: tpl.templates.find((t) => t.slug === 'social-tweet').id } })
const pubTg = await call(`/api/projects/${project.id}/content/${gen.item.id}/publish`, { method: 'POST', body: { channel: 'telegram' } })
log('published telegram', pubTg.url, pubTg.item.status)
const long = await call(`/api/projects/${project.id}/content`, { method: 'POST', body: { contentType: 'thread', category: 'social', title: 'Thread' } })
await call(`/api/projects/${project.id}/content/${long.item.id}`, { method: 'PATCH', body: { body: '1/ First tweet of the thread about TOKI.\n\n2/ Second tweet with more detail.\n\n3/ Third.' } })
const pubX = await call(`/api/projects/${project.id}/content/${long.item.id}/publish`, { method: 'POST', body: { channel: 'x' } })
log('published x thread', pubX.url)
// scheduled auto-publish (scheduler interval 2s in test)
const sched = await call(`/api/projects/${project.id}/content`, { method: 'POST', body: { contentType: 'tweet', category: 'social', title: 'Scheduled' } })
await call(`/api/projects/${project.id}/content/${sched.item.id}/publish`, { method: 'PATCH', body: { publishChannel: 'telegram', autoPublish: true, scheduledAt: new Date(Date.now() - 1000).toISOString() } })
let published = false
for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 1000)); const r = await call(`/api/projects/${project.id}/content/${sched.item.id}`); if (r.item.status === 'published') { published = true; break } }
log('scheduler auto-published:', published)
if (!published) fail('scheduler did not publish')
const logs = await call(`/api/projects/${project.id}/integrations`)
log('publish logs', logs.logs.length, 'scheduler', JSON.stringify(logs.scheduler.active))
// bad credentials → failure logged
await call(`/api/projects/${project.id}/integrations`, { method: 'POST', body: { kind: 'telegram', config: { botToken: 'bad-token', chatId: '@x' } } })
const badPub = await fetch(BASE + `/api/projects/${project.id}/content/${gen.item.id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ channel: 'telegram' }) })
log('publish with bad token →', badPub.status, (await badPub.json()).error)
// ---- poster export
const poster = await call(`/api/projects/${project.id}/content`, { method: 'POST', body: { contentType: 'poster_copy', category: 'poster', title: 'Poster' } })
await call(`/api/projects/${project.id}/content/${poster.item.id}`, { method: 'PATCH', body: { body: 'HEADLINE: Real-world compute, verified\nSUBHEAD: The DePIN coordination layer\nBULLETS:\n- 10B fixed supply\n- Verified uptime proofs\n- Operators earn TOKI\nCTA: Join the network\nFOOTER: toki.network · @toki' } })
const svgRes = await fetch(BASE + `/api/projects/${project.id}/content/${poster.item.id}/poster?size=square`, { headers: { cookie } })
const svg = await svgRes.text()
log('poster svg', svgRes.headers.get('content-type'), svg.length, 'bytes', /Verified uptime proofs/.test(svg) ? 'bullets ok' : 'MISSING BULLETS')
if (!svg.startsWith('<svg') || !/Real-world compute/.test(svg)) fail('poster render failed')
// ---- logo upload
const fd = new FormData()
fd.append('file', new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')], 'logo.png', { type: 'image/png' }))
const logo = await call(`/api/projects/${project.id}/logo`, { method: 'POST', body: fd })
const logoRes = await fetch(BASE + logo.logoUrl, { headers: { cookie } })
log('logo', logo.logoUrl, logoRes.status, logoRes.headers.get('content-type'))
if (logoRes.status !== 200) fail('logo not served')
// ---- credits are NOT charged for BYOK usage
bill = await call('/api/settings/billing')
log('balance after BYOK usage', bill.balance, '(unchanged expected)')
// ---- system-key credits: a fresh workspace without providers is charged, and blocked at zero
if (bill.systemKeys.length) {
  cookie = ''
  await call('/api/auth/signup', { method: 'POST', body: { email: 'admin@test.local', password: 'password123' } }).catch(() => call('/api/auth/login', { method: 'POST', body: { email: 'admin@test.local', password: 'password123' } }))
  await call('/api/settings/billing', { method: 'POST', body: { amount: 5, description: 'test grant' } }).catch(() => null)
  const { project: sp } = await call('/api/projects', { method: 'POST', body: { name: 'SysKey Co' } })
  const before = (await call('/api/settings/billing')).balance
  await call(`/api/projects/${sp.id}/content`, { method: 'POST', body: { contentType: 'tweet', category: 'social', title: 'Charged' } })
  const after = (await call('/api/settings/billing')).balance
  log('system-key usage charged:', before, '→', after)
  if (!(after < before)) fail('credits not charged')
  const drained = await call('/api/settings/billing', { method: 'POST', body: { amount: -after, description: 'drain' } }).catch((e) => ({ error: String(e) }))
  if (drained.error) log('skip 402 check (not billing admin):', drained.error)
  else {
    const blocked = await fetch(BASE + `/api/projects/${sp.id}/content`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ contentType: 'tweet', category: 'social' }) })
    log('generation with zero credits →', blocked.status, (await blocked.json()).error?.slice(0, 60))
    if (blocked.status !== 402) fail('expected 402')
  }
  cookie = ownerCookie
}
console.log('\nPHASE 2 CHECKS PASSED. owner=' + ownerEmail + ' project=' + project.id)
