import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, X } from 'lucide-react'
import NotificationsPanel, { useTotalUnreadCount } from './NotificationsPanel'

/**
 * NotificationsBell — top-bar dropdown trigger (PR #65).
 *
 * Replaces the always-mounted Notifications widget on the Overview page.
 * Click the bell → a floating panel drops down anchored to the button.
 * Per the user spec, the panel **does not** auto-close on row click —
 * it stays open until the X button or Escape. Clicking outside the
 * dropdown (other than the bell itself) does close it though, so it
 * doesn't trap focus when you ignore it.
 *
 * Renders the panel via a portal so the dropdown floats above the rest
 * of the layout instead of being clipped by the top-bar's overflow.
 */
export default function NotificationsBell() {
  const unread = useTotalUnreadCount()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Anchor the dropdown to the button on open + window resize/scroll.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      if (!buttonRef.current) return
      const r = buttonRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (buttonRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative shrink-0 p-2 rounded-lg text-text-muted hover:bg-surface-hover hover:text-gold transition-colors focus-ring ${
          open ? 'text-gold bg-white/[0.04] ring-1 ring-white/10' : ''
        }`}
        title="Notifications"
      >
        <Bell size={16} aria-hidden="true" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none tabular-nums ring-2 ring-bg"
            aria-hidden="true"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 60 }}
            className="w-[360px] max-w-[calc(100vw-32px)] bg-surface border border-border rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden animate-fade-in"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-[13px] font-bold text-text">Notifications</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="p-1 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text transition-colors focus-ring"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="p-3 max-h-[min(540px,70vh)]">
              {/* compact mode + onItemClick is a no-op so the panel
                  stays open per the user spec ("dropdown stays down
                  until you x out"). */}
              <NotificationsPanel compact />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
