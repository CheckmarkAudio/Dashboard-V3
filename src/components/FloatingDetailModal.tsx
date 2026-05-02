import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * FloatingDetailModal — shared overlay for "click-to-expand" details.
 *
 * Used by:
 *  - Admin Assign page: template preview / editor / duplicate / assign wizard
 *  - Member/Admin widgets: click a widget title → expanded widget content
 *
 * PR #10 — stacked-modal hardening.
 * Multiple modals open at once (preview → editor, etc.) previously
 * shared `z-[60]` and both listened for Escape at the document level.
 * That caused two failure modes:
 *   1. Click targets ambiguous — clicking what felt like the outer
 *      modal's backdrop often hit the inner modal's backdrop instead.
 *   2. A single Escape keypress fired onClose on every open modal.
 *
 * Fix: module-level stack tracks mount order. Each modal computes its
 * z-index from stack depth (60 + depth × 10) so later-opened modals
 * visually layer on top. Escape closes only the topmost modal.
 *
 * Dismisses via:
 *  - Escape key (ONLY if this modal is topmost)
 *  - X button in the top-right corner
 *  - Clicking the dimmed backdrop outside the panel
 */

// Module-level stack of active modal ids. Mount order preserved; id
// removed on unmount. No cross-file coordination needed.
const modalStack: string[] = []

interface FloatingDetailModalProps {
  onClose: () => void
  title?: string
  /** Small uppercase label above the title (e.g. "Checklist · Intern"). */
  eyebrow?: string
  /** Custom header node replaces the default title/eyebrow block. */
  header?: ReactNode
  /** Optional footer action bar rendered flush with the bottom. */
  footer?: ReactNode
  /** Max width of the floating panel. Defaults to 560px. */
  maxWidth?: number | string
  ariaLabel?: string
  children: ReactNode
}

export default function FloatingDetailModal({
  onClose,
  title,
  eyebrow,
  header,
  footer,
  maxWidth = 640,
  ariaLabel,
  children,
}: FloatingDetailModalProps) {
  const id = useId()
  // Track this modal's depth in the stack. `depth` re-reads the stack
  // after mount so z-index + backdrop opacity match reality.
  const [depth, setDepth] = useState(0)

  // Push on mount, pop on unmount. Set initial depth for render.
  useEffect(() => {
    modalStack.push(id)
    setDepth(modalStack.length - 1)
    return () => {
      const idx = modalStack.lastIndexOf(id)
      if (idx >= 0) modalStack.splice(idx, 1)
    }
  }, [id])

  // Close on Escape — but ONLY if this modal is at the top of the stack.
  // Otherwise a single keystroke collapses the whole tower.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (modalStack[modalStack.length - 1] !== id) return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, id])

  // Lock body scroll while the modal is open. Safe with nested modals —
  // each push/pop on the stack toggles independently, but the body
  // stays hidden as long as any modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      // Only restore once the stack is empty. Otherwise a sub-modal
      // closing would let the body scroll behind the still-open parent.
      if (modalStack.length === 0) {
        document.body.style.overflow = prev
      }
    }
  }, [])

  // Autofocus the panel so keyboard users can tab inside immediately.
  const panelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  // Derived stacking + chrome for nested modals:
  //   depth 0 (topmost root) = z-[60], full backdrop opacity
  //   depth 1 (first child)  = z-[70], lighter backdrop so parent peeks
  //   depth 2+               = z-[80]+, even lighter
  const zIndex = 60 + depth * 10
  const backdropOpacity =
    depth === 0 ? 'bg-black/60' : depth === 1 ? 'bg-black/40' : 'bg-black/30'

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 ${backdropOpacity} backdrop-blur-sm animate-fade-in`}
      style={{ zIndex }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title ?? 'Detail view'}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        // 2026-05-02 — `90dvh` (dynamic viewport height) instead of
        // `85vh` so the modal accounts for mobile/desktop browser
        // chrome (address bars, toolbars) and never anchors off the
        // visible viewport. Browsers without dvh support fall back
        // to vh via the second value.
        className="relative w-full max-h-[90dvh] max-h-[90vh] rounded-3xl border border-white/10 bg-gradient-to-b from-[rgba(22,24,31,0.98)] to-[rgba(15,17,22,0.98)] shadow-[0_22px_70px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col outline-none focus:outline-none animate-slide-up"
        style={{ maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth }}
      >
        {/* Header */}
        {(header || title || eyebrow) && (
          <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-start justify-between gap-4 shrink-0">
            <div className="min-w-0">
              {header ?? (
                <>
                  {eyebrow && (
                    <p className="text-[11px] uppercase tracking-[0.16em] text-gold/80 font-bold">
                      {eyebrow}
                    </p>
                  )}
                  {title && (
                    <h2 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-text leading-tight truncate">
                      {title}
                    </h2>
                  )}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 rounded-lg text-text-light hover:text-gold hover:bg-white/[0.05] transition-colors focus-ring"
              aria-label="Close"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">{children}</div>

        {/* Optional footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-white/5 shrink-0">{footer}</div>
        )}
      </div>
    </div>
  )
}
