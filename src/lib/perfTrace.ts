// ============================================================================
// perfTrace — lightweight cold-start instrumentation for the dashboard.
//
// Purpose: measure the real startup waterfall (auth, profile, overview
// queries, daily-checklist generation, first paint) without adding
// perceptible overhead or shipping anything visible to production users.
//
// Opt-in: nothing runs until the user sets `localStorage.debugPerf = '1'`
// in their browser console. All exported functions short-circuit to
// no-ops otherwise — zero allocation, zero timing cost in the common
// path.
//
// Usage:
//   import { mark, time, flush } from '../lib/perfTrace'
//
//   mark('app:bootstrap')                              // earliest possible
//   const session = await time('auth:getSession', () => supabase.auth.getSession())
//   flush('Overview')                                  // once the page is ready
//
// On flush, emits a single collapsed console.group with offsets
// relative to `app:bootstrap` so a glance tells you who the long pole is.
// ============================================================================

const NAMESPACE = 'cm:'
const DEBUG_FLAG = 'debugPerf'

function enabled(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem(DEBUG_FLAG) === '1'
  } catch {
    return false
  }
}

interface Entry {
  name: string
  startOffset: number // ms since bootstrap mark
  duration: number
}

// Module-level state. Reset via `reset()` (tests, SPA re-measurement).
const entries: Entry[] = []
let bootstrapTime: number | null = null
const flushedLabels = new Set<string>()

/**
 * Drop a named timestamp. Cheap — no allocation beyond the native
 * `performance.mark`. The `app:bootstrap` name is special: it sets
 * the reference point for every subsequent offset in flush output.
 */
export function mark(name: string): void {
  if (!enabled()) return
  try { performance.mark(NAMESPACE + name) } catch { /* ignore */ }
  if (name === 'app:bootstrap' && bootstrapTime == null) {
    bootstrapTime = performance.now()
  }
}

/**
 * Wrap a promise so its start + end + duration get recorded. Returns
 * the original value unmodified. On `debugPerf !== '1'` this is a
 * zero-overhead pass-through — `fn()` is invoked directly with no
 * timing wrapper at all.
 */
export async function time<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled()) return fn()
  const startLabel = NAMESPACE + name + ':start'
  const endLabel = NAMESPACE + name + ':end'
  const t0 = performance.now()
  try { performance.mark(startLabel) } catch { /* ignore */ }
  try {
    return await fn()
  } finally {
    const t1 = performance.now()
    try {
      performance.mark(endLabel)
      performance.measure(NAMESPACE + name, startLabel, endLabel)
    } catch { /* ignore */ }
    const startOffset = bootstrapTime != null ? t0 - bootstrapTime : t0
    entries.push({
      name,
      startOffset: Math.max(0, Math.round(startOffset)),
      duration: Math.round(t1 - t0),
    })
  }
}

/**
 * Emit the accumulated waterfall to the console as a single grouped
 * report. Idempotent per label — calling twice with the same label is
 * a no-op. Pass `{ reset: true }` to force a re-flush (useful when
 * re-measuring after navigation).
 */
export function flush(label: string, options: { reset?: boolean } = {}): void {
  if (!enabled()) return
  if (flushedLabels.has(label) && !options.reset) return
  flushedLabels.add(label)

  const total = bootstrapTime != null
    ? Math.round(performance.now() - bootstrapTime)
    : Math.round(performance.now())

  if (entries.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`%c⏱ ${label} ready in ${total}ms — no checkpoints recorded`, 'color:#d6aa37;font-weight:bold')
    return
  }

  const sorted = [...entries].sort((a, b) => a.startOffset - b.startOffset)
  const longest = sorted.reduce((max, e) => (e.duration > max.duration ? e : max), sorted[0])

  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `%c⏱ ${label} cold start: ${total}ms  %c(${sorted.length} checkpoints, longest: ${longest.name} ${longest.duration}ms)`,
    'color:#d6aa37;font-weight:bold',
    'color:#9aa0a6;font-weight:normal',
  )
  for (const e of sorted) {
    const bar = '█'.repeat(Math.min(40, Math.max(1, Math.round(e.duration / 15))))
    // eslint-disable-next-line no-console
    console.log(`@${String(e.startOffset).padStart(5)}ms  %c${bar}  %c${e.duration}ms  %c${e.name}`,
      'color:#d6aa37', 'color:#fff;font-weight:bold', 'color:#9aa0a6',
    )
  }
  // eslint-disable-next-line no-console
  console.groupEnd()
}

/**
 * Reset the collector. For tests + re-measurement. Production code
 * generally doesn't need to call this.
 */
export function reset(): void {
  entries.length = 0
  flushedLabels.clear()
  bootstrapTime = null
}

/**
 * Diagnostic — returns a shallow copy of the entries collected so far.
 * Useful for writing assertions in tests or for displaying the log in
 * a devtools panel later.
 */
export function snapshot(): Entry[] {
  return entries.slice()
}
