import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import CreateBookingModal from '../components/CreateBookingModal'
import CalendarDayCard from '../components/calendar/CalendarDayCard'
import BookingDetailModal, { type BookingDetail } from '../components/calendar/BookingDetailModal'
import DeleteBookingDialog from '../components/calendar/DeleteBookingDialog'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { loadWeekEvents } from '../lib/calendar'
import { addDays, startOfWeek } from '../lib/time'
import { localDateKey } from '../lib/dates'
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
  googleEventId?: string | null
  googleSyncStatus?: 'pending' | 'synced' | 'error'
  googleSyncError?: string | null
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
  return localDateKey()
}

function getWeekDays(weekOffset: number = 0): { day: string; date: string; key: string }[] {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + (weekOffset * 7))
  // Keep date-only keys local. Leaving the current evening clock time
  // here makes `toISOString()` roll labels into tomorrow in US timezones.
  monday.setHours(12, 0, 0, 0)
  const days: { day: string; date: string; key: string }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push({
      day: DAY_NAMES[d.getDay()] ?? '',
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      key: localDateKey(d),
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

/**
 * PR E — overlap-aware lane assignment for a single day's bookings.
 * Two bookings overlap when one's [start, end) intersects the other's.
 * Bookings are partitioned into "groups" (transitively-overlapping
 * sets); within each group, every booking gets a lane index, and the
 * group as a whole knows how many lanes it needs (`groupSize`).
 *
 * Render math: each booking renders at width = colWidth / groupSize,
 * left offset = lane * (colWidth / groupSize). A standalone booking
 * (no overlap) ends up in a 1-lane group → full width as before.
 */
interface BookingLane<T> {
  booking: T
  lane: number
  groupSize: number
}
function assignBookingLanes<T extends { startTime: string; endTime: string }>(
  dayBookings: T[],
): BookingLane<T>[] {
  const sorted = [...dayBookings].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  )
  const result: BookingLane<T>[] = []
  let groupBuffer: { booking: T; lane: number }[] = []
  let lanesEndMin: number[] = []
  let groupEndMin = -Infinity

  function flushGroup() {
    if (groupBuffer.length === 0) return
    const groupSize = lanesEndMin.length
    for (const item of groupBuffer) result.push({ ...item, groupSize })
    groupBuffer = []
    lanesEndMin = []
    groupEndMin = -Infinity
  }

  for (const b of sorted) {
    const startMin = timeToMinutes(b.startTime)
    const endMin = timeToMinutes(b.endTime)
    // If this booking starts after every lane in the current group is
    // free, the group is closed — finalize before continuing.
    if (startMin >= groupEndMin) flushGroup()
    // First lane whose previous booking ended at/before this start time.
    let laneIdx = lanesEndMin.findIndex((end) => end <= startMin)
    if (laneIdx === -1) {
      laneIdx = lanesEndMin.length
      lanesEndMin.push(endMin)
    } else {
      lanesEndMin[laneIdx] = endMin
    }
    groupBuffer.push({ booking: b, lane: laneIdx })
    groupEndMin = Math.max(groupEndMin, endMin)
  }
  flushGroup()
  return result
}

/**
 * Calendar — week-view + day card + booking modals.
 *
 * Default usage: rendered as the `/calendar` route page. Pass
 * `embedded` when mounting inside another page (Sessions polish #2
 * preview mounts this inside the Bookings page's Calendar tab) — the
 * embedded variant skips the `useDocumentTitle` side-effect (parent
 * page owns the title) and the outer `max-w-6xl mx-auto` wrapper +
 * page-level H1 so the calendar slots cleanly into the parent's
 * right-pane container. All state, fetch logic, and modal rendering
 * stay identical between the two surfaces — single source of truth.
 */
export default function Calendar({ embedded = false }: { embedded?: boolean } = {}) {
  // When embedded, defer to the host page's document title (Sessions
  // sets 'Booking Agent - ...' already). Always call the hook —
  // rules-of-hooks — but pick a title that won't fight the host's.
  useDocumentTitle(embedded ? 'Booking Agent - Checkmark Workspace' : 'Calendar - Checkmark Workspace')
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
            googleEventId: evt.google_event_id,
            googleSyncStatus: evt.google_sync_status,
            googleSyncError: evt.google_sync_error,
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
  // 2026-05-07 (Lean A) — clicking a week-grid booking block opens the
  // shared BookingDetailModal. State is page-local since the side
  // CalendarDayCard manages its own modal independently.
  const [detailBooking, setDetailBooking] = useState<BookingDetail | null>(null)
  // PR E — when admin clicks "Edit" inside the detail modal, hand off
  // to CreateBookingModal in edit mode (`editSessionId`). null when
  // not editing.
  const [editSessionId, setEditSessionId] = useState<string | null>(null)
  // 2026-05-17 — admin delete flow. Single state object carries the
  // session id + a human label (date/time/client) for the dialog's
  // prompt copy. Recurring-vs-single scope detection happens inside
  // the dialog. Triggered by EITHER the Delete pill in
  // BookingDetailModal OR the right-click context menu on the
  // week-grid booking blocks.
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)
  // Context menu for right-click on a week-grid booking. Tracks the
  // booking + screen coords so the menu floats wherever the user
  // clicked. Closes on Escape, outside click, or after picking an
  // action.
  const [contextMenu, setContextMenu] = useState<{ booking: CalendarBooking; x: number; y: number } | null>(null)
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  // Close the context menu on outside click / Escape so it doesn't
  // linger after the user moves on.
  useEffect(() => {
    if (!contextMenu) return
    const onPointer = () => setContextMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [contextMenu])

  // Build the prompt label for the delete dialog from a CalendarBooking.
  // Used by both the right-click menu and the modal's Delete pill.
  const bookingLabel = (b: { client: string; date: string; startTime: string; endTime: string }): string => {
    const dt = new Date(`${b.date}T00:00:00`)
    const dateLabel = Number.isNaN(dt.getTime())
      ? b.date
      : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return `${b.client} · ${dateLabel} · ${b.startTime}–${b.endTime}`
  }

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
    // Embedded mode drops the page-level `max-w-6xl mx-auto` so the
    // calendar fills the host's right pane (Sessions tab container)
    // and lets that container own width constraints. animate-fade-in
    // is harmless either way — running fades on tab swap reads as a
    // nice transition, not noise.
    <div className={embedded ? 'animate-fade-in' : 'max-w-6xl mx-auto animate-fade-in'}>
      {showBooking && <CreateBookingModal onClose={() => { setShowBooking(false); setBookingPrefillDate(''); setBookingPrefillTime(''); void refetch() }} prefillDate={bookingPrefillDate} prefillTime={bookingPrefillTime} />}
      {editSessionId && (
        <CreateBookingModal
          editSessionId={editSessionId}
          onClose={() => { setEditSessionId(null); void refetch() }}
        />
      )}
      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          onClose={() => setDetailBooking(null)}
          onEdit={() => {
            const id = detailBooking.id
            setDetailBooking(null)
            setEditSessionId(id)
          }}
          onDelete={() => {
            const id = detailBooking.id
            const label = bookingLabel(detailBooking)
            setDetailBooking(null)
            setDeleteTarget({ id, label })
          }}
          onStatusChanged={() => { setDetailBooking(null); void refetch() }}
        />
      )}
      {deleteTarget && (
        <DeleteBookingDialog
          sessionId={deleteTarget.id}
          label={deleteTarget.label}
          onClose={() => setDeleteTarget(null)}
          onDeleted={({ scope, deletedCount, syncWarning }) => {
            setDeleteTarget(null)
            const msg =
              scope === 'future'
                ? `Deleted ${deletedCount} booking${deletedCount === 1 ? '' : 's'}.`
                : 'Booking deleted.'
            toast(syncWarning ? `${msg} ${syncWarning}` : msg, syncWarning ? 'error' : 'success')
            void refetch()
          }}
        />
      )}
      {contextMenu && isAdmin && (
        <div
          role="menu"
          aria-label={`Actions for ${contextMenu.booking.client}`}
          // stopPropagation so the outside-pointerdown handler in
          // the useEffect doesn't immediately re-close the menu.
          onPointerDown={(e) => e.stopPropagation()}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-[180px] bg-surface border border-border rounded-xl shadow-xl py-1 animate-fade-in"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setDetailBooking(contextMenu.booking)
              setContextMenu(null)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-text hover:bg-surface-hover transition-colors"
          >
            View details
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const id = contextMenu.booking.id
              const label = bookingLabel(contextMenu.booking)
              setContextMenu(null)
              setEditSessionId(id)
              void label
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-text hover:bg-surface-hover transition-colors"
          >
            Edit booking
          </button>
          <div className="my-1 border-t border-border" aria-hidden="true" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const id = contextMenu.booking.id
              const label = bookingLabel(contextMenu.booking)
              setContextMenu(null)
              setDeleteTarget({ id, label })
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            Delete booking…
          </button>
        </div>
      )}
      {/* Header — embedded mode drops the page H1 (Sessions' PageHeader
          already says "Booking") but keeps the week-nav chevrons +
          status row on the right since they're calendar-specific
          controls, not page chrome. */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {!embedded && (
            <h1 className="text-[28px] font-extrabold tracking-tight text-text">Calendar</h1>
          )}
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
              <div className="grid grid-cols-[36px_repeat(7,1fr)] border-b border-border">
                <div />
                {WEEK.map((wd) => {
                  const isActualToday = wd.key === TODAY_KEY
                  const isSelected = wd.key === selectedDate
                  return (
                    <button
                      key={wd.key}
                      onClick={() => setSelectedDate(wd.key)}
                      className={`text-center py-2 border-l border-border transition-all ${isSelected ? 'bg-gold/[0.08]' : isActualToday ? 'bg-gold/[0.03]' : 'hover:bg-white/[0.02]'}`}
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
                  <div key={hour} className="absolute left-0 right-0 grid grid-cols-[36px_repeat(7,1fr)] h-[48px] border-b border-border" style={{ top: (hour - 7) * 48 }}>
                    <div className="text-[9px] text-text-light font-medium pr-2 text-right pt-0.5">
                      {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                    </div>
                    {WEEK.map((wd, di) => {
                      const isSel = wd.key === selectedDate
                      return (
                        <div key={di} className={`border-l border-border group/cell relative ${isSel ? 'bg-gold/[0.03]' : ''}`}>
                          {/* +Book hover affordance — sits at z-10 so it's
                              below booking blocks (z-30). When a cell is
                              already booked, the booking block intercepts
                              the hover + click; this button only surfaces
                              on truly-empty cells. */}
                          <button onClick={() => { setBookingPrefillDate(wd.key); setBookingPrefillTime(`${hour.toString().padStart(2,'0')}:00`); setShowBooking(true) }} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity z-10">
                            <span className="flex items-center gap-0.5 text-[9px] text-gold bg-surface/90 border border-gold/20 rounded px-1.5 py-0.5">
                              <Plus size={8} />Book
                            </span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ))}

                {/* Booking blocks — positioned within each day column
                    via overlap-aware lane math (PR E). Bookings that
                    share a time slot fan out side-by-side instead of
                    stacking. Z-index is z-30 — above the +Book hover
                    button (z-10) so a click on a booking always lands
                    on the booking, never on the empty-cell affordance
                    underneath. */}
                {WEEK.map((wd, dayIndex) => {
                  const dayBookings = bookingsByDate[wd.key] ?? []
                  const laned = assignBookingLanes(dayBookings)
                  return laned.map(({ booking: b, lane, groupSize }) => {
                    const startMin = timeToMinutes(b.startTime)
                    const endMin = timeToMinutes(b.endTime)
                    const gridStart = 7 * 60
                    const topPx = ((startMin - gridStart) / 60) * 48
                    const heightPx = ((endMin - startMin) / 60) * 48
                    // Day column width within the 7-column grid.
                    const colWidth = `((100% - 36px) / 7)`
                    const colLeft = `(36px + ${colWidth} * ${dayIndex})`
                    // Lane width within this day's column. groupSize=1
                    // collapses to the full column.
                    const laneWidth = `(${colWidth} / ${groupSize})`
                    const laneLeft = `(${colLeft} + ${laneWidth} * ${lane})`

                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setDetailBooking(b)}
                        onContextMenu={(e) => {
                          // Only admins see the context menu — members just
                          // get the default browser menu (no admin actions
                          // to surface). Skips preventDefault for non-admins
                          // so they keep the native right-click experience.
                          if (!isAdmin) return
                          e.preventDefault()
                          e.stopPropagation()
                          setContextMenu({ booking: b, x: e.clientX, y: e.clientY })
                        }}
                        title={`${b.client} · ${formatTime12(b.startTime)}–${formatTime12(b.endTime)}${isAdmin ? ' · Right-click for actions' : ''}`}
                        className="absolute calendar-booking-block px-1.5 py-0.5 overflow-hidden text-left cursor-pointer z-30 hover:ring-2 hover:ring-gold/50 hover:z-40 transition-all focus-ring"
                        style={{
                          top: topPx + 1,
                          height: Math.max(heightPx - 2, 18),
                          left: `calc(${laneLeft} + 1px)`,
                          width: `calc(${laneWidth} - 2px)`,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {b.status === 'Confirmed' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                          <p className="text-[10px] font-medium text-gold truncate leading-tight">{b.client}</p>
                        </div>
                        {heightPx > 28 && <p className="text-[8px] text-text-muted truncate leading-tight">{b.assignee}</p>}
                        {heightPx > 42 && groupSize === 1 && (
                          <p className="text-[8px] text-text-light truncate leading-tight">{formatTime12(b.startTime)}–{formatTime12(b.endTime)}</p>
                        )}
                      </button>
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
