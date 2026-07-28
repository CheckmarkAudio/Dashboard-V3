import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Send, X } from 'lucide-react'
import { Button, Input } from '../ui'
import { useToast } from '../Toast'
import {
  fetchMemberRecurring,
  requestRecurring,
  requestScheduleBlock,
} from '../../lib/schedule/mutations'
import { toLocalDateString, weekdayLabel } from '../../lib/schedule/expand'
import type { ScheduleRecurring, Weekday } from '../../types'
import WeeklyAvailabilityGrid, {
  createDefaultWeekAvailability,
  invalidDays,
  type WeekAvailability,
} from './WeeklyAvailabilityGrid'

const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

function formatHourRange(startTime: string, endTime: string): string {
  const fmt = (t: string) => {
    const [hStr, mStr] = t.split(':')
    const h = Number(hStr)
    const m = Number(mStr ?? 0)
    const period = h < 12 ? 'AM' : 'PM'
    const hour12 = ((h + 11) % 12) + 1
    return m === 0 ? `${hour12}${period}` : `${hour12}:${m.toString().padStart(2, '0')}${period}`
  }
  return `${fmt(startTime)}–${fmt(endTime)}`
}

/** Real approved recurring rows -> the form's local per-day state, so
 *  "Set weekly schedule" opens already reflecting what's actually
 *  saved instead of a generic Tue–Sat 10–6 template. Days with no
 *  current row fall back to the given defaults, disabled. */
function recurringToWeekAvailability(
  rows: ScheduleRecurring[],
  defaultStart: string,
  defaultEnd: string,
): WeekAvailability {
  const out = createDefaultWeekAvailability(defaultStart, defaultEnd)
  for (const w of ALL_WEEKDAYS) out[w] = { ...out[w], enabled: false }
  for (const row of rows) {
    out[row.weekday] = {
      enabled: true,
      start: row.start_time.slice(0, 5),
      end: row.end_time.slice(0, 5),
    }
  }
  return out
}

/**
 * Worker-facing schedule request modal.
 *
 * The database still stores these as one-off blocks and recurring
 * rows, but the UI uses plain choices:
 *   - Set weekly schedule
 *   - Request one-time change
 *   - Request time off (kind='time_off' on team_schedule_blocks —
 *     subtracted from effective work by resolveEffectiveWorkWindows,
 *     never rendered as a work shift)
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

type Mode = 'block' | 'recurring' | 'time_off'

export default function ScheduleRequestModal({
  memberId,
  onClose,
  onSubmitted,
  prefill,
}: ScheduleRequestModalProps) {
  const [mode, setMode] = useState<Mode>(prefill?.mode ?? 'recurring')

  // 2026-07-28 — director: "when I updated my hours I couldnt tell
  // what I was updating or if i even had a set schedule to begin
  // with... perhaps we need a visual breakdown of a person's current
  // schedule so they can see while they are updating it." Fetched
  // once at the modal level (not per-form) so the summary strip below
  // and RecurringForm's pre-fill both read from the same data.
  const { data: currentRecurring = [], isLoading: loadingCurrent } = useQuery({
    queryKey: ['schedule', 'member-recurring', memberId],
    queryFn: () => fetchMemberRecurring(memberId),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Request schedule">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface rounded-2xl border border-border shadow-2xl p-5 animate-fade-in">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-text">Schedule request</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Pick what you need. Admin reviews before anything changes.
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

        <CurrentScheduleStrip rows={currentRecurring} loading={loadingCurrent} />

        <div className="grid gap-2 mb-4">
          <ScheduleChoice
            active={mode === 'recurring'}
            title="Set weekly schedule"
            description="Same hours on the days you pick."
            onClick={() => setMode('recurring')}
          />
          <ScheduleChoice
            active={mode === 'block'}
            title="Request one-time change"
            description="A special shift, coverage change, or single day adjustment."
            onClick={() => setMode('block')}
          />
          <ScheduleChoice
            active={mode === 'time_off'}
            title="Request time off"
            description="Vacation or unavailable dates."
            onClick={() => setMode('time_off')}
          />
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
        ) : mode === 'recurring' ? (
          loadingCurrent ? (
            // Wait for the current-schedule fetch before mounting the
            // form — RecurringForm reads `currentRecurring` only on
            // its FIRST render to build its initial state, so
            // mounting it early (before the real data lands) would
            // silently lock it into the generic default template.
            <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-text-muted">
              <Loader2 size={14} className="animate-spin" />
              Loading your schedule…
            </div>
          ) : (
            <RecurringForm
              memberId={memberId}
              onClose={onClose}
              onSubmitted={onSubmitted}
              prefillStart={prefill?.startTime}
              prefillEnd={prefill?.endTime}
              currentRecurring={currentRecurring}
            />
          )
        ) : (
          <TimeOffForm
            memberId={memberId}
            onClose={onClose}
            onSubmitted={onSubmitted}
            prefillDate={prefill?.date}
          />
        )}
      </div>
    </div>
  )
}

/** "Your current schedule" — a 7-day pill strip shown above the mode
 *  picker, always visible regardless of which mode is selected, so
 *  it answers "do I even have a schedule, and what is it" before the
 *  member touches anything. Gold pill = a day they're currently
 *  scheduled (with its real hours); muted pill = no shift that day. */
function CurrentScheduleStrip({ rows, loading }: { rows: ScheduleRecurring[]; loading: boolean }) {
  const byWeekday = new Map(rows.map((r) => [r.weekday, r]))
  return (
    <div className="mb-4 rounded-lg border border-border bg-surface-alt/35 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-text-muted mb-2">
        Your current schedule
      </p>
      {loading ? (
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <Loader2 size={12} className="animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {ALL_WEEKDAYS.map((w) => {
            const row = byWeekday.get(w)
            return (
              <div
                key={w}
                className={`rounded-md text-center py-1.5 px-0.5 ${
                  row ? 'bg-gold/[0.14] border border-gold/40' : 'bg-surface-alt border border-border'
                }`}
              >
                <p className={`text-[9px] font-semibold ${row ? 'text-gold' : 'text-text-muted'}`}>
                  {weekdayLabel(w, 'short')}
                </p>
                <p className={`text-[8px] leading-tight mt-0.5 ${row ? 'text-text' : 'text-text-light'}`}>
                  {row ? formatHourRange(row.start_time.slice(0, 5), row.end_time.slice(0, 5)) : 'Off'}
                </p>
              </div>
            )
          })}
        </div>
      )}
      {!loading && rows.length === 0 && (
        <p className="text-[11px] text-text-light italic mt-2">
          No weekly schedule set yet — anything you submit below will be your first.
        </p>
      )}
    </div>
  )
}

function ScheduleChoice({
  active,
  title,
  description,
  badge,
  onClick,
}: {
  active: boolean
  title: string
  description: string
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-150',
        'hover:-translate-y-0.5 hover:shadow-sm focus-ring active:translate-y-0',
        active
          ? 'border-gold bg-gold/10 shadow-[0_0_0_3px_rgba(234,179,8,0.08)]'
          : 'border-border bg-surface-alt/45 hover:border-gold/45 hover:bg-surface-alt',
      ].join(' ')}
    >
      <span className="flex items-center justify-between gap-3">
        <span className={`text-[13px] font-bold ${active ? 'text-gold' : 'text-text'}`}>{title}</span>
        {badge && (
          <span className="rounded-full border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">
            {badge}
          </span>
        )}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-text-muted">{description}</span>
    </button>
  )
}

// ─── Time off form ──────────────────────────────────────────────
// Start/end date (same date = one day). Submits a pending
// kind='time_off' block via requestScheduleBlock — admin approves
// from Work Scheduler. Days are stored as a full-day span
// (start date 00:00 -> day-after-end date 00:00, local time) so
// resolveEffectiveWorkWindows subtracts the whole day(s) from
// effective work regardless of what hours a shift covers, and so we
// never construct the range from a UTC-based Date that could shift
// the date under America/Denver.

function TimeOffForm({
  memberId,
  onClose,
  onSubmitted,
  prefillDate,
}: {
  memberId: string
  onClose: () => void
  onSubmitted: () => void | Promise<void>
  prefillDate?: string
}) {
  const { toast } = useToast()
  const today = useMemo(() => toLocalDateString(new Date()), [])
  const [startDate, setStartDate] = useState(prefillDate ?? today)
  const [endDate, setEndDate] = useState(prefillDate ?? today)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate) {
      toast('Pick a start and end date', 'error')
      return
    }
    if (endDate < startDate) {
      toast('End date must be on or after the start date', 'error')
      return
    }
    setSubmitting(true)
    try {
      const starts = new Date(`${startDate}T00:00:00`)
      const endExclusive = new Date(`${endDate}T00:00:00`)
      endExclusive.setDate(endExclusive.getDate() + 1)
      await requestScheduleBlock({
        member_id: memberId,
        starts_at: starts.toISOString(),
        ends_at: endExclusive.toISOString(),
        note: reason.trim() || null,
        kind: 'time_off',
      })
      toast('Time off request sent — awaiting admin review', 'success')
      await onSubmitted()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send request', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="rounded-lg border border-border bg-surface-alt/35 px-3 py-2">
        <p className="text-[12px] font-semibold text-text">Time off</p>
        <p className="text-[11px] text-text-muted">
          For one day, use the same date for start and end. Admin reviews before it's approved.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Start date</label>
          <Input
            type="date"
            value={startDate}
            min={today}
            onChange={(e) => {
              setStartDate(e.target.value)
              if (endDate < e.target.value) setEndDate(e.target.value)
            }}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">End date</label>
          <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Reason (optional)</label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Vacation"
        />
      </div>
      <ActionRow onClose={onClose} submitting={submitting} submitLabel="Send time-off request" />
    </form>
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
      toast('One-time schedule change sent for review', 'success')
      await onSubmitted()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send request', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="rounded-lg border border-border bg-surface-alt/35 px-3 py-2">
        <p className="text-[12px] font-semibold text-text">One-time change</p>
        <p className="text-[11px] text-text-muted">
          Use this for one special date. For your normal weekly hours, choose Set weekly schedule.
        </p>
      </div>
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
        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Note (optional)</label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Can cover Friday afternoon"
        />
      </div>
      <ActionRow onClose={onClose} submitting={submitting} submitLabel="Send one-time request" />
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
  currentRecurring,
}: {
  memberId: string
  onClose: () => void
  onSubmitted: () => void | Promise<void>
  prefillStart?: string
  prefillEnd?: string
  /** This member's real approved weekly schedule, already loaded by
   *  the parent before this form mounts (see the loadingCurrent gate
   *  in ScheduleRequestModal) — seeds the grid with what's actually
   *  saved instead of a generic template, per director: "I couldnt
   *  tell what I was updating." Falls back to the default template
   *  only when the member has no current recurring schedule at all. */
  currentRecurring: ScheduleRecurring[]
}) {
  const { toast } = useToast()
  const [availability, setAvailability] = useState<WeekAvailability>(() =>
    currentRecurring.length > 0
      ? recurringToWeekAvailability(currentRecurring, prefillStart ?? '10:00', prefillEnd ?? '18:00')
      : createDefaultWeekAvailability(prefillStart ?? '10:00', prefillEnd ?? '18:00'),
  )
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const enabledDays = ([0, 1, 2, 3, 4, 5, 6] as const).filter((w) => availability[w].enabled)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (enabledDays.length === 0) {
      toast('Turn on at least one day', 'error')
      return
    }
    if (invalidDays(availability).length > 0) {
      toast('Fix the day(s) where end time is before start time', 'error')
      return
    }
    setSubmitting(true)
    try {
      // One row per enabled day, each with its OWN start/end time —
      // studio hours are sporadic, so a member's Tuesday and Thursday
      // hours don't need to match.
      await Promise.all(
        enabledDays.map((w) =>
          requestRecurring({
            member_id: memberId,
            weekday: w,
            start_time: availability[w].start,
            end_time: availability[w].end,
            note: note.trim() || null,
          }),
        ),
      )
      toast(
        `Weekly schedule request${enabledDays.length === 1 ? '' : 's'} sent for review`,
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
      <div className="rounded-lg border border-border bg-surface-alt/35 px-3 py-2">
        <p className="text-[12px] font-semibold text-text">Weekly schedule</p>
        <p className="text-[11px] text-text-muted">
          Turn on the days you work and set each day's own hours — they don't have to match.
        </p>
        {currentRecurring.length > 0 && (
          <p className="text-[11px] text-gold mt-1">
            Pre-filled from your current schedule. Sending sends a fresh request for admin
            review — it doesn't replace your approved schedule until they approve it.
          </p>
        )}
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">
          Days &amp; hours <span className="text-text-light">(Tue–Sat is the studio default)</span>
        </label>
        <WeeklyAvailabilityGrid value={availability} onChange={setAvailability} />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Note (optional)</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. My regular studio hours" />
      </div>

      <ActionRow onClose={onClose} submitting={submitting} submitLabel="Send weekly request" />
    </form>
  )
}

// ─── Shared action row (cancel + send) ─────────────────────────────

function ActionRow({
  onClose,
  submitting,
  submitLabel,
}: {
  onClose: () => void
  submitting: boolean
  submitLabel: string
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Button>
      <Button variant="primary" size="sm" type="submit" disabled={submitting}>
        {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Send size={12} className="mr-1" />}
        {submitLabel}
      </Button>
    </div>
  )
}
