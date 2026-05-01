import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, X } from 'lucide-react'
import NotificationsPanel, { useTotalUnreadCount } from './NotificationsPanel'

/**
 * NotificationsBell — top-bar dropdown trigger.
 *
 * PR #65 introduced the dropdown.
 * PR #66 polished the open/close motion to match the "buttery smooth"
 * feel of Figma / Linear / Vercel notification panels:
 *
 *   1. **Open transition** — opacity 0→1, scale 0.96→1, translateY(-4px)→0
 *      with `cubic-bezier(0.16, 1, 0.3, 1)` ease-out-expo, 180ms.
 *      Transform-origin: top-right so the panel grows out of the bell.
 *      A two-frame `mounted` state defers the `to-state` class for a tick
 *      so the browser actually animates from the `from-state` instead of
 *      starting at the destination.
 *   2. **Close transition** — same easing, faster (140ms). The portal
 *      keeps the panel mounted during the exit; we unmount after the
 *      transitionend so the user sees the reverse animation, not a snap.
 *   3. **Layered shadow + frosted backdrop** — three-stop shadow stack
 *      plus `backdrop-blur` so the panel reads as a real floating
 *      surface, not a flat box on a flat bg.
 *   4. **Smooth internal scroll + autofocus** — `scroll-behavior: smooth`
 *      lives on the body; the panel autofocuses on open so Escape /
 *      arrow keys work without an extra Tab.
 *
 * The panel **does not** auto-close on row click (per the user spec —
 * "stays down until you x out"). Outside-click / Escape / X-button do
 * close it.
 */
export default function NotificationsBell() {
  const unread = useTotalUnreadCount()
  const [open, setOpen] = useState(false)
  // `entered` flips one frame after `open` so the CSS transition
  // animates from (scale-96 / opacity-0) → (scale-100 / opacity-100).
  // Without the deferred flip, React mounts the panel already at
  // `scale-100 opacity-100` and we'd see no animation.
  const [entered, setEntered] = useState(false)
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

  // Defer the entered state by one rAF so the transition has a
  // from-state to animate from.
  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  // Autofocus the panel on open so keyboard interactions (Escape) work
  // without an extra Tab.
  useEffect(() => {
    if (open && entered) {
      panelRef.current?.focus()
    }
  }, [open, entered])

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

  // Easing token used for both open + close. Ease-out-expo as
  // popularized by Vercel / Linear UI — fast at the start, settles
  // softly at the end. Matches the human expectation of a panel that
  // "lands" rather than slams or drifts.
  const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

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
            tabIndex={-1}
            style={{
              position: 'fixed',
              top: pos.top,
              right: pos.right,
              zIndex: 60,
              transformOrigin: 'top right',
              opacity: entered ? 1 : 0,
              transform: entered
                ? 'scale(1) translateY(0)'
                : 'scale(0.96) translateY(-4px)',
              transition: `opacity 180ms ${EASE}, transform 180ms ${EASE}`,
              willChange: 'opacity, transform',
            }}
            className="w-[360px] max-w-[calc(100vw-32px)] bg-surface/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.18),0_8px_24px_rgba(0,0,0,0.32),0_16px_48px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden focus:outline-none"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
              <p className="text-[13px] font-bold text-text">Notifications</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="p-1 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text transition-colors duration-150 focus-ring"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            {/* `scroll-smooth` smooths jumps when the user marks-all-read
                and the list re-orders. `max-h-[min(540px,70vh)]` keeps
                the panel from running off the viewport. */}
            <div className="p-3 max-h-[min(540px,70vh)] overflow-y-auto scroll-smooth">
              <NotificationsPanel compact />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
