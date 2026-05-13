import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

/**
 * Lean 8 — app-wide presence tracking.
 *
 * Uses Supabase Realtime Presence to maintain a single shared
 * channel that every signed-in tab joins on mount. The "online"
 * set is exposed via context so any consumer (Forum members
 * sidebar, future header presence, etc.) can render presence dots
 * without each one wiring its own subscription.
 *
 * Per the user's locked answer (PROJECT_STATE Tier 3 #7):
 *   "online when logged in / site open. Site-based heartbeat.
 *    Richer states ('active 5m ago' etc.) deferred."
 *
 * One channel handles everyone; presence keys are user IDs so
 * multiple tabs from the same user collapse into a single dot.
 */
interface PresenceContextValue {
  /** Set of user IDs currently online (anyone with the app open). */
  onlineUserIds: Set<string>
  /** Convenience: O(1) check for a specific user. */
  isOnline: (userId: string | null | undefined) => boolean
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUserIds: new Set(),
  isOnline: () => false,
})

const PRESENCE_CHANNEL = 'app-presence'

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Don't open the channel until the user is signed in. RLS-style
    // guard prevents anonymous presence (which would show up as a
    // ghost online dot for nobody).
    if (!userId) {
      setOnlineUserIds(new Set())
      return
    }

    // Single shared channel — `key` collapses multiple tabs from the
    // same user into one entry in the presence state.
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: {
        presence: { key: userId },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        // `state` shape: { [userId]: PresenceMeta[] }
        // We only care about the keys (which user IDs are present).
        setOnlineUserIds(new Set(Object.keys(state)))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track our own presence so other tabs see us. The payload
          // is intentionally minimal — just enough to populate the
          // state's value array. We could add `online_at` later if
          // we want "last seen" telemetry.
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      void channel.untrack()
      void supabase.removeChannel(channel)
    }
  }, [userId])

  const value = useMemo<PresenceContextValue>(
    () => ({
      onlineUserIds,
      isOnline: (id) => Boolean(id && onlineUserIds.has(id)),
    }),
    [onlineUserIds],
  )

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export function usePresence(): PresenceContextValue {
  return useContext(PresenceContext)
}
