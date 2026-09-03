import { publishDueContent } from './integrations'

type S = { timer?: ReturnType<typeof setInterval>; running?: boolean; lastRun?: string; lastResults?: unknown }
const g = globalThis as unknown as { __web3os_scheduler?: S }
if (!g.__web3os_scheduler) g.__web3os_scheduler = {}
const state = g.__web3os_scheduler

/** Starts the in-process publishing scheduler (idempotent). Interval via SCHEDULER_INTERVAL_MS (default 60s). */
export function startScheduler() {
  if (state.timer || process.env.DISABLE_SCHEDULER === '1') return
  const interval = Number(process.env.SCHEDULER_INTERVAL_MS || 60000)
  const tick = async () => {
    if (state.running) return
    state.running = true
    try {
      const results = await publishDueContent()
      state.lastRun = new Date().toISOString()
      state.lastResults = results
      if (results.length) console.log('[scheduler] published', results)
    } catch (e) {
      console.error('[scheduler] tick failed', e)
    } finally {
      state.running = false
    }
  }
  state.timer = setInterval(tick, interval)
  state.timer.unref?.()
  setTimeout(tick, 5000).unref?.()
}

export function schedulerStatus() {
  return { active: Boolean(state.timer), lastRun: state.lastRun ?? null, lastResults: state.lastResults ?? null }
}
