import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { pingPresence } from '../queries/presence'

const HEARTBEAT_INTERVAL_MS = 3 * 60_000
const MIN_PING_GAP_MS = 60_000

/**
 * Keeps a lightweight persisted presence session alive while an authenticated
 * member is actively viewing the app. Heartbeat errors are already logged by
 * the query wrapper and stay non-fatal so transient network failures never
 * interrupt the shell.
 */
export function usePresenceHeartbeat(memberId: string | null | undefined) {
  const location = useLocation()
  const lastPingAtRef = useRef(0)
  const pingInFlightRef = useRef(false)

  const ping = useCallback(async (force = false) => {
    if (!memberId || (!force && document.visibilityState !== 'visible')) return

    const now = Date.now()
    if (!force && now - lastPingAtRef.current < MIN_PING_GAP_MS) return
    if (pingInFlightRef.current) return

    lastPingAtRef.current = now
    pingInFlightRef.current = true
    try {
      await pingPresence()
    } catch {
      // Non-fatal: the wrapper logs the backend error. A later heartbeat retries.
    } finally {
      pingInFlightRef.current = false
    }
  }, [memberId])

  // Ping immediately when the authenticated member becomes available.
  useEffect(() => {
    if (!memberId) return
    lastPingAtRef.current = 0
    void ping(true)
  }, [memberId, ping])

  // Maintain the locked three-minute cadence while the tab is visible.
  useEffect(() => {
    if (!memberId) return
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void ping()
    }, HEARTBEAT_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [memberId, ping])

  // Returning to a visible tab is an activity signal, subject to the one-minute
  // throttle so focus churn cannot flood the RPC.
  useEffect(() => {
    if (!memberId) return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void ping()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [memberId, ping])

  // React Router gives each navigation a new key, including same-path changes.
  useEffect(() => {
    if (memberId) void ping()
  }, [location.key, memberId, ping])
}
