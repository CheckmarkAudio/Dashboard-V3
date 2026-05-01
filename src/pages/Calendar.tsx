import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import CreateBookingModal from '../components/CreateBookingModal'
import CalendarDayCard from '../components/calendar/CalendarDayCard'
import { loadWeekEvents } from '../lib/calendar'
import { addDays, startOfWeek } from '../lib/time'
import { ChevronLeft, ChevronRight, Plus, AlertCircle, Loader2 } from 'lucide-react'

/**
 * Calendar-friendly booking row. Flattened from the real `sessions`
 * + `team_schedule_templates` join returned by `loadWeekEvents`, with
 * field names aligned to the existing Calendar UI so the render tree
 * below stays readable.
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

const SESSION_TYPE_TO_UI: Record<string, string> = {
  recording: 'engineering',
  mixing: 'engineering',
  lesson: 'music_lesson',
  meeting: 'consultation',
}

/* ── Time grid config ── */
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7 AM to 7 PM
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function splitClockParts(value: string): [string, string] {
  const [left = '0', right = '0'] = value.split(':')
  return [left, right]
}

function parseClock(value: string): [number, number] {
  const [hours, minutes] = splitClockParts(value)
  return [Number(hours), Number(minutes)]
}

// Compute real today and this week's dates dynamically
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0] ?? ''
}

function getWeekDays(weekOffset: number = 0): { day: string; date: string; key: string }[] {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + (weekOffset * 7))
  const days: { day: string; date: string; key: string }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
      days.push({
      day: DAY_NAMES[d.getDay()] ?? '',
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      key: d.toISOString().split('T')[0] ?? '',
    })
  }
  return days
}

// Time helpers — used by the week-grid right column to position
// booking blocks. Day-detail helpers (TYPE_LABELS, durationLabel)
// moved into CalendarDayCard.
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

export default function Calendar() {
  useDocumentTitle('Calendar - Checkmark Workspace')
  const TODAY_KEY = getTodayKey()
  const [weekOffset, setWeekOffset] = useState(0)
  const WEEK = getWeekDays(weekOffset)
  const [bookings, setBookings] = useState<CalendarBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load real session rows for the viewed week. Refetches any time the
  // user navigates to a different week via the chevron controls.
  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const weekStart = addDays(startOfWeek(new Date()), weekOffset * 7)
      const { events } = await loadWeekEvents({ weekStart, scope: 'team' })
      const mapped: CalendarBooking[] = events
        .filter((evt) => evt.kind === 'session' || evt.kind === 'meeting')
        .map((evt) => {
          // evt.id is prefixed `session:<uuid>` — preserve the original
          // uuid so note-persistence keys don't accidentally collide with
          // schedule focus entries.
          const id = evt.id.startsWith('session:') ? evt.id.slice('session:'.length) : evt.id
          // Title is "Recording · Client Name" or just "Recording" — split
          // defensively so we always have a client label to render.
          const [leftLabel, rightLabel] = evt.title.split(' · ')
          const client = rightLabel?.trim() || leftLabel?.trim() || 'Studio session'
          const description = rightLabel ? (leftLabel ?? '') : (evt.subtitle ?? '')
          // Fall back to 'engineering' so TYPE_LABELS has a hit; the real
          // session_type is lost in the `loadWeekEvents` projection so
          // we derive from the event title prefix.
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
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [weekOffset])

  useEffect(() => {
    void refetch()
  }, [refetch])
  const weekStart = WEEK[0]?.date ?? ''
  const weekEnd = WEEK[6]?.date ?? ''
  const weekLabel = weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekOffset === -1 ? 'Last Week' : `${weekOffset > 0 ? '+' : ''}${weekOffset} Weeks`
  const [selectedDate, setSelectedDate] = useState(TODAY_KEY)
  const [showBooking, setShowBooking] = useState(false)
  const [bookingPrefillDate, setBookingPrefillDate] = useState('')
  const [bookingPrefillTime, setBookingPrefillTime] = useState('')

  // Day-detail concerns (selected-day booking list, inline notes,
  // add-note flow) now live inside CalendarDayCard. This page owns
  // the week grid + week-navigation chrome. Bookings are still
  // indexed here so the week grid can position booking blocks.
  const bookingsByDate = useMemo(() => {
    const map: Record<string, CalendarBooking[]> = {}
    for (const b of bookings) {
      if (b.status === 'Cancelled') continue
      const group = map[b.date] ?? []
      group.push(b)
      map[b.date] = group
    }
    return map
  }, [bookings])

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {showBooking && <CreateBookingModal onClose={() => { setShowBooking(false); setBookingPrefillDate(''); setBookingPrefillTime(''); void refetch() }} prefillDate={bookingPrefillDate} prefillTime={bookingPrefillTime} />}
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-[28px] font-extrabold tracking-tight text-text">Calendar</h1>
          {loading && <Loader2 size={14} className="animate-spin text-text-light" aria-label="Loading calendar" />}
          {error && (
            <span className="flex items-center gap-1 text-xs text-amber-300">
              <AlertCircle size={12} />
              {error}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          <button onClick={() => { if (weekOffset > -1) setWeekOffset(weekOffset - 1) }} className={`p-1 rounded hover:bg-surface-hover transition-colors ${weekOffset <= -1 ? 'opacity-30 cursor-not-allowed' : ''}`}><ChevronLeft size={16} /></button>
          <button onClick={() => setWeekOffset(0)} className="text-xs font-semibold text-gold hover:underline">{weekLabel}</button>
          <button onClick={() => { if (weekOffset < 3) setWeekOffset(weekOffset + 1) }} className={`p-1 rounded hover:bg-surface-hover transition-colors ${weekOffset >= 3 ? 'opacity-30 cursor-not-allowed' : ''}`}><ChevronRight size={16} /></button>
          <span className="text-xs text-text-light ml-1">{weekStart} – {weekEnd}</span>
        </div>
      </div>

      {/* 2-column layout — matched height. Left column is the shared
          CalendarDayCard (PR #22) so Overview renders the identical
          widget and notes stay in sync between surfaces. Right column
          is the week grid unique to this page. */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3 items-stretch">

        {/* ── Left column: Selected day detail ── */}
        <CalendarDayCard
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {/* ── Right column: This Week grid ── */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-[16px] font-bold text-text tracking-tight">This Week</h2>
          </div>

          <div>
            <div>
              {/* Day headers — clickable */}
              <div className="grid grid-cols-[36px_repeat(7,1fr)] border-b border-border/30">
                <div />
                {WEEK.map((wd) => {
                  const isActualToday = wd.key === TODAY_KEY
                  const isSelected = wd.key === selectedDate
                  return (
                    <button
                      key={wd.key}
                      onClick={() => setSelectedDate(wd.key)}
                      className={`text-center py-2 border-l border-border/20 transition-all ${isSelected ? 'bg-gold/[0.08]' : isActualToday ? 'bg-gold/[0.03]' : 'hover:bg-white/[0.02]'}`}
                    >
                      <p className={`text-[10px] font-semibold uppercase ${isSelected ? 'text-gold' : isActualToday ? 'text-gold/60' : 'text-text-muted'}`}>{wd.day}</p>
                      <p className={`text-[9px] ${isSelected ? 'text-gold' : isActualToday ? 'text-gold/50' : 'text-text-light'}`}>{wd.date}</p>
                      {isSelected && <div className="w-1 h-1 rounded-full bg-gold mx-auto mt-0.5" />}
                    </button>
                  )
                })}
              </div>

              {/* Time rows with inline booking blocks */}
              <div className="relative" style={{ height: HOURS.length * 48 }}>
                {/* Grid lines */}
                {HOURS.map(hour => (
                  <div key={hour} className="absolute left-0 right-0 grid grid-cols-[36px_repeat(7,1fr)] h-[48px] border-b border-border/10" style={{ top: (hour - 7) * 48 }}>
                    <div className="text-[9px] text-text-light font-medium pr-2 text-right pt-0.5">
                      {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                    </div>
                    {WEEK.map((wd, di) => {
                      const isSel = wd.key === selectedDate
                      return (
                        <div key={di} className={`border-l border-border/10 group/cell relative ${isSel ? 'bg-gold/[0.03]' : ''}`}>
                          <button onClick={() => { setBookingPrefillDate(wd.key); setBookingPrefillTime(`${hour.toString().padStart(2,'0')}:00`); setShowBooking(true) }} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity z-20">
                            <span className="flex items-center gap-0.5 text-[9px] text-gold bg-surface/90 border border-gold/20 rounded px-1.5 py-0.5">
                              <Plus size={8} />Book
                            </span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ))}

                {/* Booking blocks — positioned within each day column using grid math */}
                {WEEK.map((wd, dayIndex) => {
                  const dayBookings = bookingsByDate[wd.key] ?? []
                  return dayBookings.map(b => {
                    const startMin = timeToMinutes(b.startTime)
                    const endMin = timeToMinutes(b.endTime)
                    const gridStart = 7 * 60
                    const topPx = ((startMin - gridStart) / 60) * 48
                    const heightPx = ((endMin - startMin) / 60) * 48
                    // Use CSS calc that matches the grid: skip 50px time col, then position within 7 equal columns
                    const colWidth = `((100% - 36px) / 7)`
                    const colLeft = `(36px + ${colWidth} * ${dayIndex})`

                    return (
                      <div
                        key={b.id}
                        className="absolute bg-gold/35 border border-gold/70 px-1.5 py-0.5 overflow-hidden cursor-default hover:bg-gold/50 transition-colors z-10"
                        style={{
                          top: topPx + 1,
                          height: Math.max(heightPx - 2, 18),
                          left: `calc(${colLeft} + 1px)`,
                          width: `calc(${colWidth} - 2px)`,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {b.status === 'Confirmed' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                          <p className="text-[10px] font-medium text-gold truncate leading-tight">{b.client}</p>
                        </div>
                        {heightPx > 28 && <p className="text-[8px] text-text-muted truncate leading-tight">{b.assignee}</p>}
                        {heightPx > 42 && <p className="text-[8px] text-text-light truncate leading-tight">{formatTime12(b.startTime)}–{formatTime12(b.endTime)}</p>}
                      </div>
                    )
                  })
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
