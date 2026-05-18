import { AlertCircle, Building2, CalendarCheck2, CalendarDays, Clock, Edit2, ExternalLink, Loader2, Trash2, User as UserIcon } from 'lucide-react'
import FloatingDetailModal from '../FloatingDetailModal'
import BookingStatusPopover from './BookingStatusPopover'
import { useAuth } from '../../contexts/AuthContext'

/**
 * BookingDetailModal — read-only summary of a single booking, opened
 * by clicking the booking title in either calendar surface (the side
 * day card on Overview / Calendar, or the week-grid block on the
 * Calendar page).
 *
 * 2026-05-07 (Lean A of Active #4) — first cut is read-only. Lean 5
 * (booking status hover popover) will add Cancel / Confirm / Reschedule
 * action buttons in the footer + an Edit pill that opens
 * CreateBookingModal pre-filled.
 *
 * Shape matches the local `CalendarBooking` interface used in both
 * `CalendarDayCard.tsx` and `Calendar.tsx` so callers can pass their
 * already-flattened row directly without a re-fetch.
 */

export interface BookingDetail {
  id: string
  client: string
  description: string
  date: string             // ISO yyyy-mm-dd
  startTime: string        // 24h HH:mm
  endTime: string
  assignee: string
  studio: string
  status: 'Confirmed' | 'Pending' | 'Cancelled' | 'Completed'
  type: string             // engineering / training / education / music_lesson / consultation
  googleEventId?: string | null
  googleSyncStatus?: 'pending' | 'synced' | 'error'
  googleSyncError?: string | null
}

const TYPE_LABELS: Record<string, string> = {
  engineering: 'Engineering',
  training: 'Training',
  education: 'Education',
  music_lesson: 'Music Lesson',
  consultation: 'Consultation',
}

function parseClock(value: string): [number, number] {
  const [h = '0', m = '0'] = value.split(':')
  return [Number(h), Number(m)]
}

function timeToMinutes(t: string): number {
  const [h, m] = parseClock(t)
  return h * 60 + m
}

function formatTime12(t: string): string {
  const [h, m] = parseClock(t)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`
}

function durationLabel(start: string, end: string): string {
  const mins = timeToMinutes(end) - timeToMinutes(start)
  const hrs = Math.floor(mins / 60)
  const rm = mins % 60
  return hrs > 0 ? `${hrs}h${rm > 0 ? ` ${rm}m` : ''}` : `${rm}m`
}

function formatDateLong(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.valueOf())) return iso
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS_TONE: Record<BookingDetail['status'], string> = {
  Confirmed: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40',
  Pending: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
  Cancelled: 'bg-rose-500/15 text-rose-300 ring-rose-500/40',
  Completed: 'bg-text-light/15 text-text-muted ring-border',
}

const STATUS_DOT: Record<BookingDetail['status'], string> = {
  Confirmed: 'bg-emerald-400',
  Pending: 'bg-amber-400',
  Cancelled: 'bg-rose-400',
  Completed: 'bg-text-light',
}

const GOOGLE_SYNC_TONE: Record<NonNullable<BookingDetail['googleSyncStatus']>, string> = {
  synced: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/35',
  pending: 'bg-amber-500/12 text-amber-300 ring-amber-500/35',
  error: 'bg-rose-500/12 text-rose-300 ring-rose-500/35',
}

function googleCalendarDayUrl(dateKey: string): string {
  const [year, month, day] = dateKey.split('-')
  if (!year || !month || !day) return 'https://calendar.google.com/calendar/u/0/r'
  return `https://calendar.google.com/calendar/u/0/r/day/${year}/${Number(month)}/${Number(day)}`
}

export default function BookingDetailModal({
  booking,
  onClose,
  onEdit,
  onDelete,
  onStatusChanged,
}: {
  booking: BookingDetail
  onClose: () => void
  // 2026-05-07 (PR E) — when set, the footer surfaces an "Edit" pill.
  // Parent is responsible for what edit means (typically: close this
  // modal + open CreateBookingModal in edit mode with `editSessionId`).
  onEdit?: () => void
  // 2026-05-17 — when set AND viewer is admin, the footer surfaces a
  // Delete pill. Parent owns the actual delete flow (typically: close
  // this modal + open DeleteBookingDialog with the same session id).
  // Recurring-vs-single scope picking happens in the dialog, not here.
  onDelete?: () => void
  // PR #158 — bubbled when the user flips status via the hover
  // popover (Confirm / Cancel / Restore). Parent should refetch.
  onStatusChanged?: () => void
}) {
  const { isAdmin } = useAuth()
  const typeLabel = TYPE_LABELS[booking.type] ?? booking.type
  const googleSyncStatus = booking.googleSyncStatus ?? 'pending'
  const GoogleSyncIcon =
    googleSyncStatus === 'synced' ? CalendarCheck2 :
    googleSyncStatus === 'error' ? AlertCircle :
    Loader2

  return (
    <FloatingDetailModal
      onClose={onClose}
      header={
        <>
          <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-gold/80 font-bold">
            <CalendarDays size={11} strokeWidth={2.5} className="text-gold" aria-hidden="true" />
            Booking detail
          </p>
          <div className="mt-1 flex items-start justify-between gap-3 flex-wrap">
            <h2 className="text-[22px] font-bold tracking-[-0.02em] text-text leading-tight truncate">
              {booking.client}
            </h2>
            {/* Status pill is the popover trigger (PR #158). Reschedule
                forwards to onEdit so admin doesn't need a separate
                Edit button click for the time-change case. */}
            <BookingStatusPopover
              sessionId={booking.id}
              status={booking.status}
              onChanged={() => onStatusChanged?.()}
              onReschedule={onEdit}
            >
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[11px] font-bold uppercase tracking-wider ${STATUS_TONE[booking.status]}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[booking.status]}`} />
                {booking.status}
              </span>
            </BookingStatusPopover>
          </div>
          {booking.description && booking.description !== booking.client && (
            <p className="mt-1.5 text-[12px] text-text-muted">{booking.description}</p>
          )}
        </>
      }
      maxWidth={520}
      ariaLabel={`Booking detail for ${booking.client}`}
      footer={
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-surface-alt/40 rounded-b-[18px]">
          {/* Delete (admin only) sits to the LEFT of Close + Edit so
              the gold "Edit" primary action stays the rightmost +
              most prominent — destructive actions live on the far
              left of the footer per sitewide convention. */}
          {isAdmin && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold text-rose-300 hover:text-white hover:bg-rose-500/80 transition-colors mr-auto focus-ring"
            >
              <Trash2 size={13} aria-hidden="true" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:text-text"
          >
            Close
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold bg-gold text-black hover:bg-gold-muted focus-ring shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            >
              <Edit2 size={13} aria-hidden="true" />
              Edit
            </button>
          )}
        </div>
      }
    >
      <div className="px-5 py-4 space-y-3">
        {/* When */}
        <Row icon={<CalendarDays size={14} className="text-gold" aria-hidden="true" />} label="Date">
          {formatDateLong(booking.date)}
        </Row>
        <Row icon={<Clock size={14} className="text-gold" aria-hidden="true" />} label="Time">
          {formatTime12(booking.startTime)} – {formatTime12(booking.endTime)}
          <span className="ml-2 text-[10px] font-bold text-gold/70 bg-gold/10 px-1.5 py-0.5 rounded">
            {durationLabel(booking.startTime, booking.endTime)}
          </span>
        </Row>
        {/* Where + who */}
        <Row icon={<Building2 size={14} className="text-gold" aria-hidden="true" />} label="Studio">
          {booking.studio || 'Not set'}
        </Row>
        <Row icon={<UserIcon size={14} className="text-gold" aria-hidden="true" />} label="Engineer">
          {booking.assignee || 'Unassigned'}
        </Row>
        <Row label="Type">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gold/10 ring-1 ring-gold/30 text-gold text-[11px] font-bold">
            {typeLabel}
          </span>
        </Row>
        <Row icon={<CalendarCheck2 size={14} className="text-gold" aria-hidden="true" />} label="Google">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 text-[11px] font-bold capitalize ${GOOGLE_SYNC_TONE[googleSyncStatus]}`}>
            <GoogleSyncIcon
              size={12}
              className={googleSyncStatus === 'pending' ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            {googleSyncStatus}
          </span>
          {booking.googleEventId && (
            <a
              href={googleCalendarDayUrl(booking.date)}
              target="_blank"
              rel="noreferrer"
              className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-gold hover:text-gold-muted"
            >
              Open day
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          )}
          {booking.googleSyncError && (
            <span className="ml-2 text-[11px] text-rose-300">{booking.googleSyncError}</span>
          )}
        </Row>
      </div>
    </FloatingDetailModal>
  )
}

function Row({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] items-start gap-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted pt-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-[13px] text-text">{children}</div>
    </div>
  )
}
