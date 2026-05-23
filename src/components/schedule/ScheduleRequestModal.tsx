import { useMemo, useState } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { Button, Input } from '../ui'
import { useToast } from '../Toast'
import {
  requestRecurring,
  requestScheduleBlock,
} from '../../lib/schedule/mutations'
import {
  toLocalDateString,
  weekdayLabel,
} from '../../lib/schedule/expand'
import { STUDIO_WORK_WEEK, type Weekday } from '../../types'

/**
 * Shared member-facing schedule request modal.
 *
 * Tabbed UI mirrors the admin Work Scheduler form so members can
 * request **either** a one-off block OR recurring weekly hours,
 * and the visual / interaction shape is consistent across the app.
 *
 * Used by:
 *   - MyScheduleWidget (Overview) — header "Request" button
 *   - Calendar.tsx — header "+ Request schedule" pill + right-click
 *     empty-cell context menu (prefills the cell's day/time when
 *     `prefill` is provided)
 *
 * Submission writes a `pending` row to either `team_schedule_blocks`
 * or `team_schedule_recurring` (the latter is new — migration
 * 20260524000000 added member-INSERT RLS + the status column).
 */
export interface ScheduleRequestModalProps {
  memberId: string
  onClose: () => void
  onSubmitted: () => void | Promise<void>
  /** Optional prefill — Calendar's right-click cell menu uses this to
   *  drop the user into the Block tab with the picked day + start time
   *  already filled in. */
  prefill?: {
    mode?: 'block' | 'recurring'
    date?: string // YYYY-MM-DD
    startTime?: string // HH:MM
    endTime?: string
  }
}

type Mode = 'block' | 'recurring'

export default function ScheduleRequestModal({
  memberId,
  onClose,
  onSubmitted,
  prefill,
}: ScheduleRequestModalProps) {
  const [mode, setMode] = useState<Mode>(prefill?.mode ?? 'block')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Request schedule">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface rounded-2xl border border-border shadow-2xl p-5 animate-fade-in">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-text">Request schedule</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Admin reviews + approves. Withdraw anytime before they do.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-text-muted hover:text-text"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Tab toggle */}
        <div className="inline-flex bg-surface-alt rounded-md p-0.5 text-[11px] mb-4">
          <button
            type="button"
            onClick={() => setMode('block')}
            aria-pressed={mode === 'block'}
            className={`px-3 py-1 rounded transition-colors ${
              mode === 'block' ? 'bg-surface text-gold shadow-sm font-semibold' : 'text-text-muted hover:text-text'
            }`}
          >
            Single block
          </button>
          <button
            type="button"
            onClick={() => setMode('recurring')}
            aria-pressed={mode === 'recurring'}
            className={`px-3 py-1 rounded transition-colors ${
              mode === 'recurring' ? 'bg-surface text-gold shadow-sm font-semibold' : 'text-text-muted hover:text-text'
            }`}
          >
            Recurring weekly
          </button>
        </div>

        {mode === 'block' ? (
          <BlockForm
            memberId={memberId}
            onClose={onClose}
            onSubmitted={onSubmitted}
            prefillDate={prefill?.date}
            prefillStart={prefill?.startTime}
            prefillEnd={prefill?.endTime}
          />
        ) : (
          <RecurringForm
            memberId={memberId}
            onClose={onClose}
            onSubmitted={onSubmitted}
            prefillStart={prefill?.startTime}
            prefillEnd={prefill?.endTime}
          />
        )}
      </div>
    </div>
  )
}

// ─── Single block form ─────────────────────────────────────────────

function BlockForm({
  memberId,
  onClose,
  onSubmitted,
  prefillDate,
  prefillStart,
  prefillEnd,
}: {
  memberId: string
  onClose: () => void
  onSubmitted: () => void | Promise<void>
  prefillDate?: string
  prefillStart?: string
  prefillEnd?: string
}) {
  const { toast } = useToast()
  const today = useMemo(() => toLocalDateString(new Date()), [])
  const [date, setDate] = useState(prefillDate ?? today)
  const [startTime, setStartTime] = useState(prefillStart ?? '10:00')
  const [endTime, setEndTime] = useState(prefillEnd ?? '18:00')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) {
      toast('Pick a date', 'error')
      return
    }
    if (endTime <= startTime) {
      toast('End time must be after start time', 'error')
      return
    }
    setSubmitting(true)
    try {
      const starts = new Date(`${date}T${startTime}:00`)
      const ends = new Date(`${date}T${endTime}:00`)
      await requestScheduleBlock({
        member_id: memberId,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        note: note.trim() || null,
      })
      toast('Schedule request sent — admin will review', 'success')
      await onSubmitted()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send request', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={today} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Start</label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">End</label>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Reason (optional)</label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Cover for Sara, extra mixing time"
        />
      </div>
      <ActionRow onClose={onClose} submitting={submitting} />
    </form>
  )
}

// ─── Recurring weekly form ─────────────────────────────────────────

function RecurringForm({
  memberId,
  onClose,
  onSubmitted,
  prefillStart,
  prefillEnd,
}: {
  memberId: string
  onClose: () => void
  onSubmitted: () => void | Promise<void>
  prefillStart?: string
  prefillEnd?: string
}) {
  const { toast } = useToast()
  const [weekdays, setWeekdays] = useState<Set<Weekday>>(new Set(STUDIO_WORK_WEEK))
  const [startTime, setStartTime] = useState(prefillStart ?? '10:00')
  const [endTime, setEndTime] = useState(prefillEnd ?? '18:00')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function toggleWeekday(w: Weekday) {
    setWeekdays((prev) => {
      const next = new Set(prev)
      if (next.has(w)) next.delete(w)
      else next.add(w)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (weekdays.size === 0) {
      toast('Pick at least one weekday', 'error')
      return
    }
    if (endTime <= startTime) {
      toast('End time must be after start time', 'error')
      return
    }
    setSubmitting(true)
    try {
      // One row per weekday — matches the admin form's behavior. The
      // member's Tue–Sat default fires 5 pending rows in one submit.
      await Promise.all(
        Array.from(weekdays).map((w) =>
          requestRecurring({
            member_id: memberId,
            weekday: w,
            start_time: startTime,
            end_time: endTime,
            note: note.trim() || null,
          }),
        ),
      )
      toast(
        `Recurring request${weekdays.size === 1 ? '' : 's'} sent — admin will review`,
        'success',
      )
      await onSubmitted()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send request', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-[1fr_1fr] gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Start</label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">End</label>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">
          Weekdays <span className="text-text-light">(Tue–Sat is the studio default)</span>
        </label>
        <div className="flex items-center gap-1">
          {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((w) => {
            const active = weekdays.has(w)
            const isStudioDay = STUDIO_WORK_WEEK.includes(w)
            return (
              <button
                key={w}
                type="button"
                onClick={() => toggleWeekday(w)}
                aria-pressed={active}
                className={[
                  'flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors border',
                  active
                    ? 'bg-gold text-black border-gold'
                    : isStudioDay
                      ? 'bg-surface-alt text-text-muted border-border hover:text-text'
                      : 'bg-transparent text-text-light border-border/60 hover:text-text-muted',
                ].join(' ')}
              >
                {weekdayLabel(w)}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Reason (optional)</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. New regular hours" />
      </div>

      <ActionRow onClose={onClose} submitting={submitting} />
    </form>
  )
}

// ─── Shared action row (cancel + send) ─────────────────────────────

function ActionRow({
  onClose,
  submitting,
}: {
  onClose: () => void
  submitting: boolean
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Button>
      <Button variant="primary" size="sm" type="submit" disabled={submitting}>
        {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Send size={12} className="mr-1" />}
        Send request
      </Button>
    </div>
  )
}
