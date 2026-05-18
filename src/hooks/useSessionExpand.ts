// 2026-05-17 (Persist widget expansion PR) — session-scoped memory
// of which widget is currently expanded on a given page.
//
// User direction: "we need to have the website keep memory of what
// how their widgets have been expanded and keep it that way for the
// duration of being logged in til log out." sessionStorage fits the
// requirement exactly — it persists across page navigations + page
// reloads + same-tab back/forward but auto-clears on tab close. The
// `signOut` handler in AuthContext also calls `clearSessionExpandState`
// so swapping accounts in the same tab doesn't bleed the prior user's
// expansion state into the new login.
//
// Keys are namespaced per page + per user so:
//   - Overview's expansion is independent of Hub's / Tasks' / Assign's
//   - User A's state never reaches User B in the rare same-tab swap case
//
// The hook intentionally mirrors `useState`'s API (`[value, setValue]`)
// so it slots into existing call sites with one line changed.

import { useCallback, useEffect, useState } from 'react'

const KEY_PREFIX = 'expanded:'

/** Build the sessionStorage key for a given scope + viewer. */
function storageKey(scope: string, userId: string | null | undefined): string {
  return `${KEY_PREFIX}${scope}:${userId ?? 'anon'}`
}

/**
 * Read the stored value once on mount + write on every change. Returns
 * a `useState`-shaped tuple so callers can swap `useState<T | null>(null)`
 * for `useSessionExpand<T>(scope, userId)` with no other changes.
 *
 * Generic `T extends string` because the value gets JSON-roundtripped
 * through sessionStorage. Widget id types in the app are all string
 * unions, so this is a natural fit.
 */
export function useSessionExpand<T extends string>(
  scope: string,
  userId: string | null | undefined,
): [T | null, (next: T | null | ((prev: T | null) => T | null)) => void] {
  const [value, setValue] = useState<T | null>(() => readStored<T>(scope, userId))

  // Re-hydrate when the (scope, userId) tuple changes (e.g. account
  // switch in the same tab, or the auth context loads after first
  // paint). Otherwise the in-memory value from the initial useState
  // call would be stale.
  useEffect(() => {
    setValue(readStored<T>(scope, userId))
  }, [scope, userId])

  // Persist every write. Null clears the slot so it doesn't leave
  // stale keys lying around forever.
  const set = useCallback(
    (next: T | null | ((prev: T | null) => T | null)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T | null) => T | null)(prev) : next
        try {
          const key = storageKey(scope, userId)
          if (resolved === null) {
            window.sessionStorage.removeItem(key)
          } else {
            window.sessionStorage.setItem(key, resolved)
          }
        } catch {
          // Storage can throw in private-mode Safari + quota-exceeded
          // cases. Persistence is best-effort; the in-memory state is
          // the source of truth for the current render.
        }
        return resolved
      })
    },
    [scope, userId],
  )

  return [value, set]
}

function readStored<T extends string>(
  scope: string,
  userId: string | null | undefined,
): T | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(scope, userId))
    return raw === null ? null : (raw as T)
  } catch {
    return null
  }
}

/**
 * Wipe every `expanded:*` key. Called by `AuthContext.signOut` so a
 * subsequent login in the same tab starts with a fresh slate (no
 * lingering "this widget was open" surprises across user accounts).
 */
export function clearSessionExpandState(): void {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i)
      if (key && key.startsWith(KEY_PREFIX)) toRemove.push(key)
    }
    for (const key of toRemove) window.sessionStorage.removeItem(key)
  } catch {
    // Best-effort — see notes in `set` above.
  }
}
