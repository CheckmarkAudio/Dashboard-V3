import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * FloatingDetailModal — shared overlay for "click-to-expand" details.
 *
 * Used by:
 *  - Admin Assign page: click a template title → full template preview
 *  - Member/Admin widgets: click a widget title → expanded widget content
 *
 * One component, one animation, one set of dismiss affordances so the
 * whole app reads as coherent.
 *
 * Dismisses via:
 *  - Escape key (captured at document level while mounted)
 *  - X button in the top-right corner
 *  - Clicking the dimmed backdrop outside the panel
 */

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
  // Close on Escape — captured at document level so it works even if the
  // modal doesn't currently have keyboard focus (e.g. user pressed Esc
  // while hovering the backdrop).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll while the modal is open so the background doesn't
  // drift when the user scrolls inside the modal.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Autofocus the panel so keyboard users can tab inside immediately.
  const panelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title ?? 'Detail view'}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-h-[85vh] rounded-3xl border border-white/10 bg-gradient-to-b from-[rgba(22,24,31,0.98)] to-[rgba(15,17,22,0.98)] shadow-[0_22px_70px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col outline-none focus:outline-none animate-slide-up"
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
