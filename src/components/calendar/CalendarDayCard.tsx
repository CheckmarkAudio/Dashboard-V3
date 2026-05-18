import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  StickyNote,
  X,
} from 'lucide-react'
import { loadWeekEvents } from '../../lib/calendar'
import { addDays, startOfWeek } from '../../lib/time'
import { localDateKey } from '../../lib/dates'
import { useAuth } from '../../contexts/AuthContext'
import BookingDetailModal, { type BookingDetail } from './BookingDetailModal'
import CreateBookingModal from '../CreateBookingModal'

/**
 * CalendarDayCard — self-contained day-view widget extracted from
 * the Calendar page's left column (PR #22). Single source of truth
 * for the "today / selected day" booking list that now renders on
 * both:
 *   - `/calendar` (left column, alongside the week grid)
 *   - `/` (member Overview, column 2)
 *
 * Features:
 *   - Defaults to today
 *   - Prev / next day chevrons
 *   - "Back to today" when off-today
 *   - Inline notes per booking, persisted to localStorage under the
 *     same `checkmark-booking-notes` key as the Calendar page so
 *     notes stay in sync between surfaces
 *   - Fetches bookings for the week containing the selected date,
 *     refetching when the selection crosses a week boundary
 *
 * Keep this component presentational-leaning: no external data
 * plumbing beyond `loadWeekEvents` + the localStorage notes.
 */

interface CalendarBooking {
  id: string
  client: string
  description: string
  date: string
  startTime: string
  endTime: string
  assignee: string
  studio: string
  status: 'Confirmed' | 'Pending' | 'Cancelled' | 'Completed'
  type: string
  googleEventId?: string | null
  googleSyncStatus?: 'pending' | 'synced' | 'error'
  googleSyncError?: string | null
}

interface BookingNote {
  id: string
  text: string
  time: string
  // 2026-05-07 (PR #152) — author attribution. Older notes saved
  // before this PR don't have these fields; we fall back to "Anon"
  // initials in render rather than mutating the historical entries.
  author_name?: string | null
  author_initials?: string | null
}

/** Two-letter initials from a display name (single names get a single
 *  letter). Returns "?" when the name is missing or empty. */
function deriveInitials(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase()
  const first = parts[0]?.[0] ?? ''
  const last = parts[parts.length - 1]?.[0] ?? ''
  return `${first}${last}`.toUpperCase() || '?'
}

const SESSION_TYPE_TO_UI: Record<string, string> = {
  recording: 'engineering',
  mixing: 'engineering',
  lesson: 'music_lesson',
  meeting: 'consultation',
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

function todayKey(): string {
  return localDateKey()
}

function weekKeyForDate(dateKey: string): string {
  // Return the Monday of the week containing this date, as an ISO key.
  // Used so we only refetch when the selection crosses a week line.
  const d = new Date(`${dateKey}T12:00:00`)
  const monday = startOfWeek(d)
  return localDateKey(monday)
}

function shiftDate(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`)
  d.setDate(d.getDate() + days)
  return localDateKey(d)
}

const NOTES_STORAGE_KEY = 'checkmark-booking-notes'
// 2026-05-07 (Lean B) — persist which notes drawers are expanded so
// they stay open across navigation / page refresh. Per user direction:
// "the notes close if you leave the page — make the notes stay opened
// unless you log out or close them yourself manually." `localStorage`
// (vs sessionStorage) so opening notes on Calendar carries over to the
// Overview side card too. Cleared on sign-out by the global storage
// purge in AuthContext.
const EXPANDED_NOTES_STORAGE_KEY = 'checkmark-booking-notes-expanded'

interface CalendarDayCardProps {
  /** Optional controlled date. If provided, caller owns the state. */
  selectedDate?: string
  onSelectDate?: (nextDateKey: string) => void
  /** Tweak chrome — e.g. `bg-surface-alt/30` to match a column wrapper */
  className?: string
}

export default function CalendarDayCard({
  selectedDate: controlledDate,
  onSelectDate,
  className = '',
}: CalendarDayCardProps = {}) {
  // PR #152 — author attribution on notes. Pull current user so each
  // saved note carries the display name + computed initials inline.
  const { profile } = useAuth()
  // Local state only used when uncontrolled — memoize to keep hooks stable.
  const [uncontrolledDate, setUncontrolledDate] = useState<string>(() => todayKey())
  const selectedDate = controlledDate ?? uncontrolledDate
  const setSelectedDate = useCallback(
    (next: string) => {
      if (onSelectDate) onSelectDate(next)
      else setUncontrolledDate(next)
    },
    [onSelectDate],
  )

  const [bookings, setBookings] = useState<CalendarBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedWeekKey, setFetchedWeekKey] = useState<string | null>(null)

  // Fetch the week containing selectedDate. Only refetches when the
  // selection crosses a week boundary — moving forward a single day
  // within the same week skips the fetch, keeps the UI snappy.
  const weekKey = weekKeyForDate(selectedDate)
  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const { events } = await loadWeekEvents({
        weekStart: new Date(`${weekKey}T12:00:00`),
        scope: 'team',
      })
      const mapped: CalendarBooking[] = events
        .filter((evt) => evt.kind === 'session' || evt.kind === 'meeting')
        .map((evt) => {
          const id = evt.id.startsWith('session:')
            ? evt.id.slice('session:'.length)
            : evt.id
          const [leftLabel, rightLabel] = evt.title.split(' · ')
          const client = rightLabel?.trim() || leftLabel?.trim() || 'Studio session'
          const description = rightLabel ? (leftLabel ?? '') : (evt.subtitle ?? '')
          const lowerLeft = (leftLabel ?? '').toLowerCase()
          const uiType = SESSION_TYPE_TO_UI[lowerLeft] ?? 'engineering'
          return {
            id,
            client,
            description: description || 'Studio session',
            date: evt.date,
            startTime: evt.start_time ?? '00:00',
            endTime: evt.end_time ?? '00:00',
            assignee: evt.member_name ?? 'Unassigned',
            studio: evt.subtitle ?? 'TBD',
            status: 'Confirmed' as const,
            type: uiType,
            googleEventId: evt.google_event_id,
            googleSyncStatus: evt.google_sync_status,
            googleSyncError: evt.google_sync_error,
          }
        })
      setBookings(mapped)
      setFetchedWeekKey(weekKey)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [weekKey])

  useEffect(() => {
    if (fetchedWeekKey === weekKey) return
    void refetch()
  }, [fetchedWeekKey, weekKey, refetch])

  // Notes — shared localStorage key with the Calendar page so both
  // surfaces see the same notes.
  // 2026-05-07 (Lean A) — clicking the booking title opens a read-
  // only detail modal. Modal shape mirrors the local CalendarBooking
  // interface so we just store the row directly (avoids a round-trip).
  const [detailBooking, setDetailBooking] = useState<BookingDetail | null>(null)
  // PR E — admin clicks "Edit" inside the detail modal → swap into
  // CreateBookingModal (edit mode). Auto-refetches the week on close
  // so the updated booking lights up immediately.
  const [editSessionId, setEditSessionId] = useState<string | null>(null)

  const [bookingNotes, setBookingNotes] = useState<Record<string, BookingNote[]>>(() => {
    try {
      const saved = localStorage.getItem(NOTES_STORAGE_KEY)
      return saved ? (JSON.parse(saved) as Record<string, BookingNote[]>) : {}
    } catch {
      return {}
    }
  })
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(EXPANDED_NOTES_STORAGE_KEY)
      if (!saved) return new Set()
      const ids = JSON.parse(saved) as unknown
      return Array.isArray(ids) ? new Set(ids.filter((x): x is string => typeof x === 'string')) : new Set()
    } catch {
      return new Set()
    }
  })

  function addBookingNote(bookingId: string) {
    const text = noteInputs[bookingId]?.trim()
    if (!text) return
    const authorName = profile?.display_name ?? 'Anon'
    const note: BookingNote = {
      id: `note-${Date.now()}`,
      text,
      time: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
      author_name: authorName,
      author_initials: deriveInitials(authorName),
    }
    setBookingNotes((prev) => {
      const next = {
        ...prev,
        [bookingId]: [...(prev[bookingId] ?? []), note],
      }
      try {
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // localStorage can throw in privacy mode; silent drop is fine —
        // notes are a nice-to-have, not a source of truth.
      }
      return next
    })
    setNoteInputs((prev) => ({ ...prev, [bookingId]: '' }))
  }

  // PR #152 — delete a single note from a booking. localStorage is
  // the source of truth (we don't have a server-side notes table yet),
  // so the delete just rewrites the per-booking array minus the row.
  function deleteBookingNote(bookingId: string, noteId: string) {
    setBookingNotes((prev) => {
      const remaining = (prev[bookingId] ?? []).filter((n) => n.id !== noteId)
      const next: Record<string, BookingNote[]> = { ...prev }
      if (remaining.length === 0) {
        // Drop the empty array so the localStorage payload stays clean
        // and the "Notes (N)" badge math doesn't show "(0)".
        delete next[bookingId]
      } else {
        next[bookingId] = remaining
      }
      try {
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Same silent-drop posture as addBookingNote.
      }
      return next
    })
  }

  function toggleNotes(bookingId: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(bookingId)) next.delete(bookingId)
      else next.add(bookingId)
      // Persist so the drawer state survives navigation + refresh.
      try {
        localStorage.setItem(EXPANDED_NOTES_STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // localStorage can throw in privacy mode; expanded-state is
        // a nice-to-have, silent drop is fine.
      }
      return next
    })
  }

  // Filter the fetched week down to the selected day, sort by time.
  const selectedBookings = useMemo(() => {
    return bookings
      .filter((b) => b.date === selectedDate && b.status !== 'Cancelled')
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
  }, [bookings, selectedDate])

  const today = todayKey()
  const isToday = selectedDate === today
  const selectedDateObj = new Date(`${selectedDate}T12:00:00`)
  const dayLabel = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long' })
  const fullDateLabel = selectedDateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div
      // Skin pass 2026-05-06 — was hand-rolled `bg-surface rounded-2xl
      // border border-border`. Now uses the shared `.list-panel`
      // class so it picks up the lifted surface token + the real drop
      // shadow + the visible border-strong hairline. Result: when this
      // card sits inside a `DashboardWidgetFrame` (admin_today_calendar
      // on Hub or today_calendar on Overview), the dimmed widget body
      // shows around the brighter inner card with a clear shadow lift —
      // matching the mockup's "single bordered panel" nesting pattern.
      className={`list-panel flex flex-col ${className}`}
    >
      {/* ── Header with day label + nav ───────────────────────────── */}
      <div className="px-4 py-3 border-b border-border-strong shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[16px] font-bold text-text tracking-tight">
            {isToday ? 'Today' : dayLabel}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              className="p-1 rounded hover:bg-surface-hover text-text-muted"
              aria-label="Previous day"
            >
              <ChevronLeft size={14} />
            </button>
            {!isToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(today)}
                className="text-[10px] font-semibold text-gold hover:underline px-1"
              >
                Back to Today
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
              className="p-1 rounded hover:bg-surface-hover text-text-muted"
              aria-label="Next day"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-text-muted mt-0.5">{fullDateLabel}</p>
      </div>

      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          onClose={() => setDetailBooking(null)}
          onEdit={() => {
            const id = detailBooking.id
            setDetailBooking(null)
            setEditSessionId(id)
          }}
          onStatusChanged={() => {
            setDetailBooking(null)
            setFetchedWeekKey(null) // force refetch so the new status shows
          }}
        />
      )}
      {editSessionId && (
        <CreateBookingModal
          editSessionId={editSessionId}
          onClose={() => {
            setEditSessionId(null)
            setFetchedWeekKey(null) // force refetch so edits show up
          }}
        />
      )}

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-text-light">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-[12px] text-amber-300 py-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : selectedBookings.length === 0 ? (
          <p className="text-[12px] text-text-light italic py-6 text-center">
            No bookings this day
          </p>
        ) : (
          <div className="space-y-0">
            {selectedBookings.map((b) => {
              const bNotes = bookingNotes[b.id] ?? []
              const isOpen = expandedNotes.has(b.id)
              return (
                <div key={b.id} className="py-3 border-b border-border-strong last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    {/* Clickable title — opens BookingDetailModal (Lean A). */}
                    <button
                      type="button"
                      onClick={() => setDetailBooking(b)}
                      className="text-[13px] font-semibold text-text hover:text-gold transition-colors text-left truncate focus-ring rounded"
                    >
                      {b.client}
                    </button>
                    <span className="text-[9px] font-semibold text-gold bg-gold/10 px-1.5 py-0.5 rounded shrink-0 ml-2">
                      {durationLabel(b.startTime, b.endTime)}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">{b.description}</p>
                  <p className="text-[11px] text-text mt-0.5">
                    {formatTime12(b.startTime)} – {formatTime12(b.endTime)}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[9px] font-semibold text-gold/80 bg-gold/5 border border-gold/15 px-1.5 py-0.5 rounded">
                      {TYPE_LABELS[b.type] ?? b.type}
                    </span>
                    <span className="text-[9px] text-text-muted">{b.studio}</span>
                    <span className="text-[9px] text-text-light">·</span>
                    <span className="text-[9px] text-text-muted">{b.assignee}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="flex items-center gap-1 text-[10px] text-text-light">
                      {b.status === 'Confirmed' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      )}
                      {b.status === 'Cancelled' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      )}
                      {b.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleNotes(b.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold/10 text-gold border border-gold/25 text-[10px] font-semibold hover:bg-gold/20 transition-all"
                    >
                      <StickyNote size={10} />
                      {bNotes.length > 0 ? `Notes (${bNotes.length})` : 'Add Note'}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="mt-2 pt-2 border-t border-border-strong">
                      {bNotes.length > 0 && (
                        <div className="space-y-1.5 mb-2">
                          {bNotes.map((n) => {
                            // PR #152 — author attribution. Older notes
                            // saved before this PR don't have author
                            // metadata; fall back gracefully.
                            const initials = n.author_initials ?? deriveInitials(n.author_name)
                            const authorTitle = n.author_name ?? 'Unknown author'
                            return (
                              <div
                                key={n.id}
                                className="group/note flex items-start gap-2 border-l-2 border-gold/30 pl-2.5 py-1"
                              >
                                <span
                                  aria-hidden="true"
                                  className="text-[12px] leading-none text-gold mt-0.5 shrink-0"
                                >
                                  ♪
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] text-text leading-snug">{n.text}</p>
                                  <p className="text-[8px] text-text-light mt-0.5 flex items-center gap-1.5">
                                    <span
                                      title={authorTitle}
                                      className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-gold/15 ring-1 ring-gold/40 text-gold text-[7px] font-bold uppercase tabular-nums"
                                    >
                                      {initials}
                                    </span>
                                    <span>{n.time}</span>
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => deleteBookingNote(b.id, n.id)}
                                  aria-label={`Delete note: ${n.text}`}
                                  title="Delete note"
                                  className="shrink-0 p-1 rounded-md text-text-light hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover/note:opacity-100 focus:opacity-100 focus-ring transition-opacity"
                                >
                                  <X size={11} aria-hidden="true" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          value={noteInputs[b.id] ?? ''}
                          onChange={(e) =>
                            setNoteInputs((prev) => ({ ...prev, [b.id]: e.target.value }))
                          }
                          onKeyDown={(e) => e.key === 'Enter' && addBookingNote(b.id)}
                          placeholder="Write a note..."
                          className="flex-1 bg-surface-alt border border-border rounded-lg px-2.5 py-1.5 text-[11px] placeholder:text-text-light focus:border-gold"
                        />
                        <button
                          type="button"
                          onClick={() => addBookingNote(b.id)}
                          disabled={!noteInputs[b.id]?.trim()}
                          className={`px-2 py-1.5 rounded-lg text-[9px] font-semibold transition-all ${
                            noteInputs[b.id]?.trim()
                              ? 'bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20'
                              : 'bg-surface-alt text-text-light border border-border cursor-not-allowed'
                          }`}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Re-export helpers the Calendar page still uses for its week-grid
// column so both surfaces share formatting logic.
export { addDays, startOfWeek }
