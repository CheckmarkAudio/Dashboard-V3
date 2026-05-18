import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react'
import {
  adminDeleteFutureSessions,
  adminDeleteSession,
  fetchSessionRecurrenceShape,
} from '../../lib/queries/adminSessions'
import { Button } from '../ui'

/**
 * Confirm dialog for deleting a calendar booking.
 *
 * Per user direction (Calendar polish 2026-05-17): single bookings get
 * a simple "Cancel · Delete" confirm. Recurring bookings (template OR
 * child) get a scope picker — "Just this event" vs "This and all
 * future events" — Google Calendar style. The dialog detects the
 * recurrence shape on mount by calling `fetchSessionRecurrenceShape`,
 * so callers don't have to know whether the booking is recurring.
 *
 * Mounted at the page level (`Calendar.tsx`) so a single dialog
 * instance handles deletes initiated from either:
 *   - The `BookingDetailModal` Delete button
 *   - The right-click context menu on a week-grid booking block
 *
 * Closes itself on success; calls `onDeleted` so the parent can
 * refetch + close any other open modal (e.g. the detail modal that
 * triggered the delete).
 */

export type DeleteBookingScope = 'one' | 'future'

interface DeleteBookingDialogProps {
  sessionId: string
  /** Human label shown in the prompt (e.g. "Bridget · Tue May 20 · 2:00 PM"). */
  label: string
  onClose: () => void
  /** Called after a successful delete, with the scope the user picked + total rows removed + any sync warning. */
  onDeleted: (result: { scope: DeleteBookingScope; deletedCount: number; syncWarning: string | null }) => void
}

export default function DeleteBookingDialog({
  sessionId,
  label,
  onClose,
  onDeleted,
}: DeleteBookingDialogProps) {
  const [shape, setShape] = useState<
    | { state: 'loading' }
    | { state: 'ready'; isRecurring: boolean }
    | { state: 'error'; message: string }
  >({ state: 'loading' })
  // Default to 'one' so a non-recurring booking can confirm
  // immediately without the user touching the radio.
  const [scope, setScope] = useState<DeleteBookingScope>('one')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Detect recurrence on mount so we know whether to render the
  // scope picker. Cross-team uuid / deleted row → treat as
  // non-recurring (we'll just attempt the single-row delete and
  // surface the RPC error if it fails).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await fetchSessionRecurrenceShape(sessionId)
      if (cancelled) return
      if (result === null) {
        setShape({ state: 'ready', isRecurring: false })
        return
      }
      setShape({ state: 'ready', isRecurring: result.isTemplate || result.isChild })
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const isRecurring = shape.state === 'ready' && shape.isRecurring

  const handleConfirm = async () => {
    if (submitting) return
    setSubmitting(true)
    setErrorMessage(null)
    try {
      // For non-recurring rows OR "one" scope on a recurring row,
      // call the existing single-row delete. For "future" scope on a
      // recurring row, call the new recurring helper.
      if (!isRecurring || scope === 'one') {
        const result = await adminDeleteSession(sessionId)
        onDeleted({ scope: 'one', deletedCount: 1, syncWarning: result.syncWarning })
        return
      }
      const result = await adminDeleteFutureSessions(sessionId)
      onDeleted({ scope: 'future', deletedCount: result.deletedCount, syncWarning: result.syncWarning })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Delete failed.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-booking-title"
        className="relative bg-surface rounded-2xl border border-border w-full max-w-md mx-4 p-6 shadow-2xl animate-fade-in"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="delete-booking-title" className="text-lg font-bold text-text flex items-center gap-2">
            <Trash2 size={16} className="text-rose-400" aria-hidden="true" />
            Delete booking
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-[13px] text-text-muted mb-4">
          {label}
        </p>

        {shape.state === 'loading' && (
          <div className="flex items-center gap-2 py-3 text-[12px] text-text-light">
            <Loader2 size={14} className="animate-spin" />
            Checking booking…
          </div>
        )}

        {shape.state === 'ready' && isRecurring && (
          <div className="space-y-2 mb-5">
            <p className="text-[11px] font-semibold text-gold uppercase tracking-wider">
              This is a recurring booking
            </p>
            <ScopeOption
              value="one"
              current={scope}
              onSelect={setScope}
              title="Just this event"
              subtitle="The other bookings in this series stay on the calendar."
            />
            <ScopeOption
              value="future"
              current={scope}
              onSelect={setScope}
              title="This and all future events"
              subtitle="Past bookings in the series are kept. The cron stops spawning new ones."
            />
          </div>
        )}

        {shape.state === 'error' && (
          <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[12px] text-amber-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{shape.message}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[12px] text-rose-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || shape.state === 'loading'}
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl text-[13px] font-bold transition-colors focus-ring bg-rose-500/85 text-white hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 size={13} aria-hidden="true" />
                Delete{isRecurring && scope === 'future' ? ' all future' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function ScopeOption({
  value,
  current,
  onSelect,
  title,
  subtitle,
}: {
  value: DeleteBookingScope
  current: DeleteBookingScope
  onSelect: (v: DeleteBookingScope) => void
  title: string
  subtitle: string
}) {
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all focus-ring ${
        active
          ? 'bg-gold/10 ring-1 ring-gold/40'
          : 'bg-surface-alt/40 ring-1 ring-border hover:bg-surface-hover'
      }`}
    >
      <span
        className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full ring-1 transition-colors ${
          active ? 'bg-gold ring-gold' : 'bg-transparent ring-border'
        }`}
        aria-hidden="true"
      >
        {active && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
      </span>
      <span className="min-w-0">
        <span className={`block text-[13px] font-semibold ${active ? 'text-gold' : 'text-text'}`}>{title}</span>
        <span className="block text-[11px] text-text-light mt-0.5">{subtitle}</span>
      </span>
    </button>
  )
}
