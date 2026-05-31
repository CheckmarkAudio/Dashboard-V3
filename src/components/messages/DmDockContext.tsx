// DmDock — global state for the Messenger-style floating chat dock.
//
// Mounted high enough (inside Layout, which wraps every authenticated
// route) that the open conversations persist as the user navigates
// page to page. State is also mirrored to sessionStorage so a reload
// keeps your open chats — same as Facebook Messenger's docked windows.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/** Max simultaneously-open dock windows before the oldest is evicted. */
const MAX_OPEN = 3
const STORAGE_KEY = 'dm-dock-v1'

interface DmDockState {
  /** Open conversation channel_ids, oldest → newest (newest renders nearest the bell). */
  open: string[]
  /** channel_id → minimized (collapsed to a head). */
  minimized: Record<string, boolean>
}

interface DmDockContextValue extends DmDockState {
  /** Open (or focus) a conversation in the dock; un-minimizes it. */
  openThread: (channelId: string) => void
  /** Remove a conversation from the dock entirely. */
  closeThread: (channelId: string) => void
  /** Collapse / expand a conversation window. */
  toggleMinimize: (channelId: string) => void
  /** Is this conversation currently in the dock? */
  isOpen: (channelId: string) => boolean
}

const DmDockContext = createContext<DmDockContextValue | null>(null)

function loadInitial(): DmDockState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DmDockState>
      return {
        open: Array.isArray(parsed.open) ? parsed.open.slice(-MAX_OPEN) : [],
        minimized: parsed.minimized && typeof parsed.minimized === 'object' ? parsed.minimized : {},
      }
    }
  } catch {
    /* sessionStorage unavailable / malformed — start empty */
  }
  return { open: [], minimized: {} }
}

export function DmDockProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DmDockState>(loadInitial)

  // Mirror to sessionStorage so a reload restores the open windows.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [state])

  const openThread = useCallback((channelId: string) => {
    setState((prev) => {
      // Move to the end (most-recent) and ensure expanded. Evict the
      // oldest if we'd exceed the cap.
      const without = prev.open.filter((id) => id !== channelId)
      let next = [...without, channelId]
      let minimized = { ...prev.minimized, [channelId]: false }
      if (next.length > MAX_OPEN) {
        const evicted = next.slice(0, next.length - MAX_OPEN)
        next = next.slice(next.length - MAX_OPEN)
        for (const id of evicted) delete minimized[id]
      }
      return { open: next, minimized }
    })
  }, [])

  const closeThread = useCallback((channelId: string) => {
    setState((prev) => {
      const minimized = { ...prev.minimized }
      delete minimized[channelId]
      return { open: prev.open.filter((id) => id !== channelId), minimized }
    })
  }, [])

  const toggleMinimize = useCallback((channelId: string) => {
    setState((prev) => ({
      ...prev,
      minimized: { ...prev.minimized, [channelId]: !prev.minimized[channelId] },
    }))
  }, [])

  const isOpen = useCallback((channelId: string) => state.open.includes(channelId), [state.open])

  const value = useMemo<DmDockContextValue>(
    () => ({ ...state, openThread, closeThread, toggleMinimize, isOpen }),
    [state, openThread, closeThread, toggleMinimize, isOpen],
  )

  return <DmDockContext.Provider value={value}>{children}</DmDockContext.Provider>
}

export function useDmDock(): DmDockContextValue {
  const ctx = useContext(DmDockContext)
  if (!ctx) throw new Error('useDmDock must be used within a DmDockProvider')
  return ctx
}
