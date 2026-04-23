import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  StickyNote,
} from 'lucide-react'
import { loadWeekEvents } from '../../lib/calendar'
import { addDays, startOfWeek } from '../../lib/time'

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
}

interface BookingNote {
  id: string
  text: string
  time: string
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
  return new Date().toISOString().split('T')[0] ?? ''
}

function weekKeyForDate(dateKey: string): string {
  // Return the Monday of the week containing this date, as an ISO key.
  // Used so we only refetch when the selection crosses a week line.
  const d = new Date(`${dateKey}T12:00:00`)
  const monday = startOfWeek(d)
  return monday.toISOString().split('T')[0] ?? ''
}

function shiftDate(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0] ?? ''
}

const NOTES_STORAGE_KEY = 'checkmark-booking-notes'

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
  const [bookingNotes, setBookingNotes] = useState<Record<string, BookingNote[]>>(() => {
    try {
      const saved = localStorage.getItem(NOTES_STORAGE_KEY)
      return saved ? (JSON.parse(saved) as Record<string, BookingNote[]>) : {}
    } catch {
      return {}
    }
  })
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

  function addBookingNote(bookingId: string) {
    const text = noteInputs[bookingId]?.trim()
    if (!text) return
    const note: BookingNote = {
      id: `note-${Date.now()}`,
      text,
      time: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
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

  function toggleNotes(bookingId: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(bookingId)) next.delete(bookingId)
      else next.add(bookingId)
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
      className={`bg-surface rounded-2xl border border-border overflow-hidden flex flex-col ${className}`}
    >
      {/* ── Header with day label + nav ───────────────────────────── */}
      <div className="px-4 py-3 border-b border-border shrink-0">
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
                <div key={b.id} className="py-3 border-b border-border/20 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[13px] font-semibold text-text">{b.client}</p>
                    <span className="text-[9px] font-semibold text-gold bg-gold/10 px-1.5 py-0.5 rounded">
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
                    <div className="mt-2 pt-2 border-t border-border/15">
                      {bNotes.length > 0 && (
                        <div className="space-y-1.5 mb-2">
                          {bNotes.map((n) => (
                            <div
                              key={n.id}
                              className="flex items-start gap-2 border-l-2 border-gold/30 pl-2.5 py-1"
                            >
                              <StickyNote
                                size={9}
                                className="text-gold/40 mt-0.5 shrink-0"
                              />
                              <div>
                                <p className="text-[11px] text-text-muted italic">{n.text}</p>
                                <p className="text-[8px] text-text-light mt-0.5">{n.time}</p>
                              </div>
                            </div>
                          ))}
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
