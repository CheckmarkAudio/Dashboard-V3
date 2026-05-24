import { useEffect, useState } from 'react'

/**
 * Fires a one-shot pulse animation on mount, throttled to a fixed
 * interval. Used to gently call attention to a widget (lift + glow)
 * the first time you land on a page during a session — without
 * spamming if you bounce in and out of the page repeatedly.
 *
 * Storage: per-user-browser localStorage under
 * `checkmark.pulse.<key>.lastFired`. Members switching browsers /
 * incognito will see the pulse again, which is fine — it's a UX
 * nudge, not a permission gate.
 *
 * Returns `pulse: boolean` — true for ~animation-duration ms
 * starting at mount IF the throttle allows. The caller applies a
 * CSS class conditionally; the animation itself lives in CSS so
 * the JS just toggles a className.
 *
 * Usage:
 *   const pulse = useThrottledPulse('overview-checklist', 30)
 *   return <div className={pulse ? 'pulse-lift' : ''}>...</div>
 */
export function useThrottledPulse(
  key: string,
  throttleMinutes: number,
  /** When false, the hook never fires (useful for route-gating). */
  enabled: boolean = true,
): boolean {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return

    const storageKey = `checkmark.pulse.${key}.lastFired`
    let last = 0
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) last = Number(raw) || 0
    } catch {
      // localStorage blocked (privacy mode, etc.) — fall through
      // and fire the pulse; we just won't throttle. Better than
      // silently never animating.
    }

    const now = Date.now()
    const intervalMs = throttleMinutes * 60 * 1000
    if (now - last < intervalMs) return

    try {
      window.localStorage.setItem(storageKey, String(now))
    } catch {
      // ditto
    }

    setPulse(true)
    // Match the CSS animation duration (1.8s) + a small buffer so
    // the class stays applied until the animation finishes, then
    // clears so the inline shadow doesn't linger.
    const t = window.setTimeout(() => setPulse(false), 2000)
    return () => window.clearTimeout(t)
  }, [enabled, key, throttleMinutes])

  return pulse
}
