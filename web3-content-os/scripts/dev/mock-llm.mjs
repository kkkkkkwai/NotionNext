// Minimal OpenAI-compatible mock server for end-to-end testing without real keys.
import http from 'node:http'

const DIM = 1536
function embed(text) {
  const v = new Array(DIM).fill(0)
  for (const w of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    let h = 0
    for (const c of w) h = (h * 31 + c.charCodeAt(0)) >>> 0
    v[h % DIM] += 1
  }
  const n = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1
  return v.map((x) => x / n)
}

function reply(messages) {
  const all = messages.map((m) => m.content).join('\n')
  const last = messages[messages.length - 1]?.content ?? ''
  if (/Extract project facts as JSON/.test(last)) {
    return JSON.stringify({ facts: [
      { key: 'token_supply', label: 'Token Supply', value: '10,000,000,000', category: 'token', confidence: 0.95, quote: 'total supply is 10,000,000,000', page: 1 },
      { key: 'token_symbol', label: 'Token Symbol', value: 'TOKI', category: 'token', confidence: 0.98, quote: 'TOKI token', page: 1 },
      { key: 'token_utility', label: 'Token Utility', value: 'staking, governance, node rewards', category: 'token', confidence: 0.9 },
      { key: 'partners', label: 'Partners', value: 'Example Labs', category: 'partners', confidence: 0.8, quote: 'Partners include Example Labs' },
      { key: 'launch_date', label: 'Launch Date', value: 'Q4', category: 'roadmap', confidence: 0.7 }
    ] })
  }
  if (/Build the PROJECT DNA/.test(last)) {
    return JSON.stringify({
      project_overview: 'TOKI Network is a DePIN network coordinating real-world compute operators with on-chain incentives.\n\nIt rewards operators in TOKI for verified uptime.',
      one_sentence_positioning: 'The DePIN coordination layer for real-world compute.', mission: 'Make physical infrastructure programmable.', vision: 'A world where every device can earn.',
      market_problem: 'Idle hardware, no coordination.', solution: 'Verified uptime + token incentives.', product: 'Operator app, dashboard, staking portal.',
      target_audience: ['Hardware operators — earn yield', 'DePIN investors — exposure'], business_model: 'Protocol fee on rewards.', token_model: 'Total supply 10,000,000,000 TOKI; 40% community, 20% team, 20% investors.',
      token_utility: ['Staking', 'Governance', 'Node rewards'], competitive_advantage: ['Verified uptime proofs', 'Low hardware requirements'], narrative: 'Trend: DePIN. Problem: idle hardware. Why now: cheap sensors. Solution: TOKI. Growth: operators → demand. Token: fee capture. Vision: programmable infrastructure.',
      brand_keywords: ['real-world', 'verified', 'operators'], brand_tone: 'Confident, technical, calm. Do: precise numbers. Don\'t: hype, guarantees.', key_selling_points: ['10B fixed supply', 'Verified uptime', 'Example Labs partnership'],
      communication_rules: ['Call participants operators, never nodes'], restricted_claims: ['No guaranteed returns', 'No exchange listing claims until confirmed'], key_facts: ['Token supply 10,000,000,000 (Tokenomics-V3)'], missing_information: ['Funding amount', 'Audit firm', 'Contract address']
    })
  }
  if (/NARRATIVE SYSTEM/.test(last)) {
    const stages = ['Industry Trend', 'Market Shift', 'User Need', 'Industry Problem', 'Why This Project Exists', 'Solution', 'Ecosystem Growth Logic', 'Token Value Capture', 'Future Vision']
    return JSON.stringify({ chain: stages.map((s) => ({ stage: s, text: `${s} for TOKI.` })), core_narrative: 'TOKI core narrative. '.repeat(20), investor_narrative: 'Investor narrative.', community_narrative: 'Community narrative.', institutional_narrative: 'Institutional narrative.', user_narrative: 'User narrative.', technical_narrative: 'Technical narrative.',
      primary_themes: Array.from({ length: 5 }, (_, i) => ({ title: `Theme ${i + 1}`, description: `Desc ${i + 1}` })), secondary_themes: Array.from({ length: 20 }, (_, i) => ({ theme: `Theme ${(i % 5) + 1}`, title: `Sub ${i + 1}`, description: 'x' })), content_angles: Array.from({ length: 50 }, (_, i) => ({ angle: `Angle ${i + 1}: why verified uptime matters`, theme: `Theme ${(i % 5) + 1}`, format: ['tweet', 'thread', 'poster', 'video', 'article'][i % 5] })) })
  }
  if (/Plan a launch campaign/.test(last)) {
    const days = [...last.matchAll(/(T[-+]?\d+|Launch Day) \((\d{4}-\d{2}-\d{2})\)/g)].map((m) => ({ label: m[1], date: m[2] }))
    return JSON.stringify({ days: days.map((d) => ({ dayOffset: d.label === 'Launch Day' ? 0 : Number(d.label.slice(1)), date: d.date, label: d.label, theme: `Theme for ${d.label}`, goal: 'Awareness', hook: `Hook ${d.label}` })) })
  }
  if (/long-term memory/.test(all) && /Return \{"memories"/.test(last)) {
    if (/ATM/.test(last) && /TOKI/.test(last)) return JSON.stringify({ memories: [{ type: 'terminology', title: 'Rename ATM to TOKI', content: 'Always call the token TOKI, never ATM.', oldValue: 'ATM', newValue: 'TOKI' }] })
    return JSON.stringify({ memories: [] })
  }
  if (/Edit the following/.test(last)) return 'EDITED: ' + (last.split('--- ORIGINAL ---')[1] ?? '').trim().slice(0, 200)
  if (/Rewrite the content below so it is compliant/.test(last)) return 'TOKI operators earn rewards for verified uptime. Not financial advice.'
  const facts = (all.match(/PROJECT FACTS[\s\S]*?\n\n/) ?? [''])[0]
  return `gm operators ☀️\n\nTOKI supply is ${/10,000,000,000/.test(facts) ? '10,000,000,000' : '[Missing: token supply]'} — fixed. Verified uptime, real rewards. [Missing: launch date]\n\n${/Produce 3 distinct/.test(last) ? '---\nversion 2\n---\nversion 3' : ''}`
}

http.createServer(async (req, res) => {
  let body = ''
  for await (const c of req) body += c
  const auth = req.headers.authorization ?? ''
  if (!auth.startsWith('Bearer mock')) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'bad key' } })) }
  if (req.url.endsWith('/models')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ data: [{ id: 'mock-fast' }, { id: 'mock-strong' }, { id: 'mock-embed' }] })) }
  if (req.url.endsWith('/embeddings')) {
    const j = JSON.parse(body)
    const input = Array.isArray(j.input) ? j.input : [j.input]
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ data: input.map((t, index) => ({ index, embedding: embed(t) })), usage: { prompt_tokens: input.join(' ').length / 4 } }))
  }
  if (req.url.endsWith('/chat/completions')) {
    const j = JSON.parse(body)
    const text = reply(j.messages)
    const usage = { prompt_tokens: 100, completion_tokens: 50 }
    if (j.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      const parts = text.match(/[\s\S]{1,20}/g) ?? []
      let i = 0
      const iv = setInterval(() => {
        if (i < parts.length) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: parts[i++] } }] })}\n\n`)
        else { res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage })}\n\ndata: [DONE]\n\n`); clearInterval(iv); res.end() }
      }, 5)
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ model: j.model, choices: [{ message: { content: text }, finish_reason: 'stop' }], usage }))
  }
  res.writeHead(404); res.end()
}).listen(3199, () => console.log('mock llm on 3199'))
