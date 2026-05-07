import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Calendar as CalendarIcon, Check, Loader2, RotateCcw, X } from 'lucide-react'
import { setBookingStatus, type BookingStatus } from '../../domain/sessions/queries'
import { useToast } from '../Toast'

/**
 * BookingStatusPopover — Lean 5 / Active #3.
 *
 * Wraps a status pill (or any clickable status display) with a hover-
 * or-click popover that surfaces status-change actions:
 *
 *   pending   → Confirm · Reschedule · Cancel
 *   confirmed → Reschedule · Cancel
 *   cancelled → Reschedule · Restore (back to pending)
 *   completed → no popover (read-only end state)
 *
 * Reschedule isn't a status flip — it bubbles `onReschedule()` up to
 * the parent which opens CreateBookingModal in edit mode (already
 * built in PR #155). Confirm / Cancel / Restore fire `setBookingStatus`
 * directly via the existing RLS-backed UPDATE path; no new RPC needed.
 *
 * Hover behavior is forgiving: 200ms enter delay so passing the cursor
 * over a row doesn't pop every status pill in the table; 300ms leave
 * delay so the user can travel from the trigger into the popover
 * without it disappearing.
 *
 * Click also opens (mobile-friendly + admins who prefer keyboard
 * focus). Click outside closes. Esc closes.
 */

interface Props {
  sessionId: string
  status: BookingStatus | string
  /** Bubbled when the user hits Reschedule — parent opens the editor. */
  onReschedule?: () => void
  /** Bubbled after a status flip succeeds so the parent can refetch. */
  onChanged?: (next: BookingStatus) => void
  children: ReactNode
}

const STATUS_ORDER: BookingStatus[] = ['pending', 'confirmed', 'cancelled']
function normalize(s: string): BookingStatus | 'completed' | 'unknown' {
  const lower = s.toLowerCase() as BookingStatus | 'completed'
  if (STATUS_ORDER.includes(lower as BookingStatus)) return lower as BookingStatus
  if (lower === 'completed') return 'completed'
  return 'unknown'
}

export default function BookingStatusPopover({
  sessionId,
  status,
  onReschedule,
  onChanged,
  children,
}: Props) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const enterTimer = useRef<number | null>(null)
  const leaveTimer = useRef<number | null>(null)

  const normalized = normalize(status)
  // Completed is a terminal read-only state; show the pill but no actions.
  const noActions = normalized === 'completed' || normalized === 'unknown'

  const mutation = useMutation({
    mutationFn: (next: BookingStatus) => setBookingStatus(sessionId, next),
    onSuccess: (_d, next) => {
      const label = next === 'pending' ? 'pending' : next === 'confirmed' ? 'confirmed' : 'cancelled'
      toast(`Marked ${label}.`, 'success')
      setOpen(false)
      setConfirmingCancel(false)
      onChanged?.(next)
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Status update failed', 'error')
    },
  })

  // ── Hover open / close with forgiving delays ───────────────────────
  function clearTimers() {
    if (enterTimer.current) {
      window.clearTimeout(enterTimer.current)
      enterTimer.current = null
    }
    if (leaveTimer.current) {
      window.clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }
  function scheduleOpen() {
    clearTimers()
    enterTimer.current = window.setTimeout(() => setOpen(true), 200)
  }
  function scheduleClose() {
    clearTimers()
    leaveTimer.current = window.setTimeout(() => {
      setOpen(false)
      setConfirmingCancel(false)
    }, 300)
  }

  // Click outside + Esc close. Only mounted when open.
  useEffect(() => {
    if (!open) return
    const handleDown = (e: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setConfirmingCancel(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setConfirmingCancel(false)
      }
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  useEffect(() => () => clearTimers(), [])

  if (noActions) {
    // Render the trigger as-is; no popover affordance for terminal states.
    return <>{children}</>
  }

  const cancelButtonLabel = confirmingCancel ? 'Confirm cancel' : 'Cancel'

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex cursor-pointer focus-ring rounded-md"
      >
        {children}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Booking status actions for ${status}`}
          className="absolute top-full left-0 mt-1.5 z-50 min-w-[180px] rounded-xl border border-border bg-surface shadow-2xl overflow-hidden"
          style={{
            animation: 'fadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={() => clearTimers()}
          onMouseLeave={scheduleClose}
        >
          {/* Pending → Confirm */}
          {normalized === 'pending' && (
            <PopoverAction
              icon={<Check size={13} strokeWidth={2.5} aria-hidden="true" />}
              label="Confirm"
              tone="emerald"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate('confirmed')}
            />
          )}
          {/* Cancelled → Restore (back to pending) */}
          {normalized === 'cancelled' && (
            <PopoverAction
              icon={<RotateCcw size={13} strokeWidth={2.5} aria-hidden="true" />}
              label="Restore to pending"
              tone="gold"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate('pending')}
            />
          )}
          {/* Reschedule — always available except when noActions. */}
          {onReschedule && (
            <PopoverAction
              icon={<CalendarIcon size={13} strokeWidth={2.5} aria-hidden="true" />}
              label="Reschedule"
              tone="default"
              onClick={() => {
                setOpen(false)
                onReschedule()
              }}
            />
          )}
          {/* Cancel — destructive; inline two-step confirm. Hidden when
              the row is already cancelled. */}
          {(normalized === 'pending' || normalized === 'confirmed') && (
            <PopoverAction
              icon={<X size={13} strokeWidth={2.5} aria-hidden="true" />}
              label={cancelButtonLabel}
              tone="rose"
              busy={mutation.isPending && confirmingCancel}
              disabled={mutation.isPending}
              onClick={() => {
                if (!confirmingCancel) {
                  setConfirmingCancel(true)
                  return
                }
                mutation.mutate('cancelled')
              }}
            />
          )}
        </div>
      )}
    </span>
  )
}

function PopoverAction({
  icon,
  label,
  tone,
  onClick,
  disabled,
  busy,
}: {
  icon: ReactNode
  label: string
  tone: 'default' | 'emerald' | 'rose' | 'gold'
  onClick: () => void
  disabled?: boolean
  busy?: boolean
}) {
  // Tone-driven hover background. Default text color stays readable in
  // both themes; tone tints just the hover state.
  const toneClass =
    tone === 'emerald'
      ? 'hover:bg-emerald-500/10 hover:text-emerald-300'
      : tone === 'rose'
        ? 'hover:bg-rose-500/10 hover:text-rose-300'
        : tone === 'gold'
          ? 'hover:bg-gold/10 hover:text-gold'
          : 'hover:bg-surface-hover hover:text-text'
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation()
        if (disabled) return
        onClick()
      }}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] font-semibold text-text-muted transition-colors disabled:opacity-50 ${toneClass}`}
    >
      <span className="shrink-0">{busy ? <Loader2 size={13} className="animate-spin" /> : icon}</span>
      <span>{label}</span>
    </button>
  )
}
