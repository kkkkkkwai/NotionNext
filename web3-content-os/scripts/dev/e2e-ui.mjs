import { chromium } from 'playwright'
const BASE = 'http://localhost:3100'
const email = process.argv[2], pid = process.argv[3]
const shots = process.argv[4]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const problems = []
async function run(viewport, tag) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to fetch RSC payload|status of 404/.test(m.text())) problems.push(`[${tag}] console: ${m.text().slice(0, 200)}`) })
  page.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message.slice(0, 200)}`))
  page.on('response', (r) => { if (r.status() >= 500) problems.push(`[${tag}] ${r.status()} ${r.url()}`) })
  await page.goto(BASE + '/login')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', 'password123')
  await page.click('button[type=submit]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  const pages = ['/dashboard', '/projects/new', `/projects/${pid}`, `/projects/${pid}/dna`, `/projects/${pid}/knowledge`, `/projects/${pid}/memory`, `/projects/${pid}/narrative`, `/projects/${pid}/tokenomics`, `/projects/${pid}/roadmap`, `/projects/${pid}/ask`, `/projects/${pid}/generate`, `/projects/${pid}/launch-kit`, `/projects/${pid}/library`, `/projects/${pid}/campaigns`, `/projects/${pid}/calendar`, `/projects/${pid}/consistency`, `/projects/${pid}/risk`, '/settings/ai-providers', '/settings/usage', '/settings/brand', '/settings/languages', '/settings/team', '/nonexistent-page']
  for (const p of pages) {
    const res = await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 30000 })
    const status = res?.status()
    if (p === '/nonexistent-page' ? status !== 404 : status !== 200) problems.push(`[${tag}] ${p} → ${status}`)
    const body = await page.textContent('body')
    if (/Application error|Something went wrong|Unhandled Runtime/.test(body ?? '')) problems.push(`[${tag}] ${p} shows error boundary`)
    if (shots) await page.screenshot({ path: `${shots}/${tag}-${p.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: false })
  }
  // interactive: library → open first item → AI editor "Shorter"
  await page.goto(BASE + `/projects/${pid}/library`, { waitUntil: 'networkidle' })
  const first = page.locator('a[href*="/library/"]').first()
  await first.click()
  await page.waitForURL('**/library/**')
  await page.getByRole('button', { name: /^Shorter/ }).click()
  await page.waitForSelector('text=/Updated|Version|Working/', { timeout: 30000 })
  await page.waitForTimeout(1500)
  // Ask AI: send a message and wait for reply
  await page.goto(BASE + `/projects/${pid}/ask`, { waitUntil: 'networkidle' })
  await page.fill('textarea', 'What are our core selling points?')
  await page.keyboard.press('Enter')
  await page.waitForSelector('text=gm operators', { timeout: 30000 })
  if (shots) await page.screenshot({ path: `${shots}/${tag}-ask-reply.png` })
  // Memory: add fact via dialog
  await page.goto(BASE + `/projects/${pid}/memory`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add Fact' }).click()
  await page.fill('input[placeholder="Token Supply"]', 'Audit')
  await page.locator('textarea').first().fill('CertiK')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForSelector('text=CertiK', { timeout: 10000 })
  // Generator: select template & generate
  await page.goto(BASE + `/projects/${pid}/generate?template=social-tweet`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Generate$/ }).click()
  await page.waitForSelector('text=Open in editor', { timeout: 30000 })
  if (shots) await page.screenshot({ path: `${shots}/${tag}-generated.png` })
  // Mobile menu
  if (viewport.width < 700) {
    await page.goto(BASE + `/projects/${pid}`, { waitUntil: 'networkidle' })
    await page.click('button[aria-label="Open menu"]')
    await page.locator('text=Content Generator').last().waitFor({ state: 'visible', timeout: 5000 })
    if (shots) await page.screenshot({ path: `${shots}/${tag}-mobile-menu.png` })
  }
  await ctx.close()
}
await run({ width: 1440, height: 900 }, 'desktop')
await run({ width: 390, height: 844 }, 'mobile')
await browser.close()
if (problems.length) { console.log('PROBLEMS:\n' + problems.join('\n')); process.exit(1) }
console.log('UI E2E PASSED (desktop + mobile, 23 routes + interactions)')
