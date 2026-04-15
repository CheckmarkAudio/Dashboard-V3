import { useCallback, useSyncExternalStore } from 'react'

/**
 * Quick-keys: single-character keyboard shortcuts that navigate the user to
 * a specific route. The action list is the source of truth — defaults mirror
 * the reference design's A/S/D/F/J/K/L/; row layout, but anchored to *our*
 * actual top-nav routes so bindings are never dead.
 *
 * Bindings are persisted to localStorage under STORAGE_KEY and shared across
 * components via a module-level store + useSyncExternalStore so the settings
 * page and the global listener see the same values instantly on change.
 */
export type QuickKeyAction = {
  id: string
  label: string
  path: string
  defaultKey: string
}

export const QUICK_KEY_ACTIONS: QuickKeyAction[] = [
  { id: 'overview',     label: 'Open Overview tab',      path: '/',                defaultKey: 'a' },
  { id: 'tasks',        label: 'Open Tasks tab',         path: '/daily',           defaultKey: 's' },
  { id: 'calendar',     label: 'Open Calendar tab',      path: '/calendar',        defaultKey: 'd' },
  { id: 'booking',      label: 'Open Booking Agent tab', path: '/sessions',        defaultKey: 'f' },
  { id: 'forum',        label: 'Open Forum tab',         path: '/content',         defaultKey: 'j' },
  { id: 'team-hub',     label: 'Open Team Hub tab',      path: '/admin',           defaultKey: 'k' },
  { id: 'assign-tasks', label: 'Open Assign Tasks tab',  path: '/admin/templates', defaultKey: 'l' },
  { id: 'members',      label: 'Open Members tab',       path: '/admin/my-team',   defaultKey: ';' },
  { id: 'analytics',    label: 'Open Analytics tab',     path: '/admin/health',    defaultKey: "'" },
  { id: 'settings',     label: 'Open Settings tab',      path: '/admin/settings',  defaultKey: ',' },
]

export type QuickKeyBindings = Record<string, string>

const STORAGE_KEY = 'checkmark.quickKeys.v1'

function makeDefaults(): QuickKeyBindings {
  const out: QuickKeyBindings = {}
  for (const a of QUICK_KEY_ACTIONS) out[a.id] = a.defaultKey
  return out
}

function readStorage(): QuickKeyBindings {
  if (typeof window === 'undefined') return makeDefaults()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return makeDefaults()
    const parsed = JSON.parse(raw) as Partial<QuickKeyBindings>
    const merged: QuickKeyBindings = { ...makeDefaults() }
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') merged[k] = v
    }
    return merged
  } catch {
    return makeDefaults()
  }
}

/* ── Module-level store (so all hook consumers stay in sync) ── */
let currentBindings: QuickKeyBindings = readStorage()
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function getSnapshot(): QuickKeyBindings {
  return currentBindings
}

function write(next: QuickKeyBindings) {
  currentBindings = next
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }
  listeners.forEach(l => l())
}

/** Normalize whatever the user typed into a single, comparable character. */
function normalizeKey(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  // Take last char — handles both single keypresses and paste-in of one char
  return trimmed.slice(-1).toLowerCase()
}

/**
 * Main hook for read + write of quick-key bindings. Returns the action list
 * alongside a stable `bindings` snapshot so components can zip over actions
 * and render the current key without an extra lookup step.
 */
export function useQuickKeys() {
  const bindings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const setBinding = useCallback((actionId: string, rawKey: string) => {
    const key = normalizeKey(rawKey)
    const next: QuickKeyBindings = { ...currentBindings, [actionId]: key }
    // Swap-on-conflict: if another action was holding this key, clear it so
    // no two actions share a binding. Empty strings are exempt (they mean
    // "unassigned").
    if (key) {
      for (const action of QUICK_KEY_ACTIONS) {
        if (action.id !== actionId && next[action.id] === key) {
          next[action.id] = ''
        }
      }
    }
    write(next)
  }, [])

  const resetDefaults = useCallback(() => {
    write(makeDefaults())
  }, [])

  return { actions: QUICK_KEY_ACTIONS, bindings, setBinding, resetDefaults }
}
