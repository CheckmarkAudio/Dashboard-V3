import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import CreateBookingModal from '../components/CreateBookingModal'
import type { StudioSpace } from '../contexts/TaskContext'
import CalendarDayCard from '../components/calendar/CalendarDayCard'
import MiniMonthPicker from '../components/calendar/MiniMonthPicker'
import BookingDetailModal, { type BookingDetail } from '../components/calendar/BookingDetailModal'
import DeleteBookingDialog from '../components/calendar/DeleteBookingDialog'
import ScheduleRequestModal, { type ScheduleRequestModalProps } from '../components/schedule/ScheduleRequestModal'
import MemberAvatar from '../components/members/MemberAvatar'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { loadWeekEvents } from '../lib/calendar'
import { addDays, startOfWeek } from '../lib/time'
import { localDateKey } from '../lib/dates'
import { fetchTeamMembers, teamMemberKeys } from '../lib/queries/teamMembers'
import { useTeamSchedule } from '../lib/schedule/useTeamSchedule'
import { useStudioHours } from '../lib/schedule/useStudioHours'
import { sessionTypeColor } from '../lib/calendar/sessionColors'
import { useTeamMemberColors } from '../lib/calendar/useTeamMemberColors'
import { resolveScheduleColor } from '../lib/calendar/teamScheduleColors'
import TeamScheduleGrid from '../components/calendar/TeamScheduleGrid'
import { ChevronLeft, ChevronRight, Plus, AlertCircle, Loader2, CalendarRange, Filter } from 'lucide-react'

// 2026-05-26 — Member pills on the calendar header display first names
// only (per user direction "filter title easy to see"). Display names
// are usually two words ("Bridget Reinhard"); a few are placeholders
// like "Studio Intern" where the first token is still meaningful. Keep
// it dead simple: split on whitespace, take the head, fall back to the
// full string if the split somehow yields nothing.
function firstName(displayName: string | null | undefined): string {
  if (!displayName) return 'Member'
  const head = displayName.trim().split(/\s+/)[0]
  return head || displayName
}

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
  // Schedule-request modal state. Opened via the header "Request
  // schedule" button (2026-07-28 — the empty-cell right-click variant
  // was removed along with the old shared hour-grid; the Team Schedule
  // tab no longer has per-hour cells to right-click, see
  // TeamScheduleGrid.tsx).
  const [scheduleRequest, setScheduleRequest] = useState<ScheduleRequestModalProps['prefill'] | true | null>(null)
  const { isAdmin, profile } = useAuth()
  const { toast } = useToast()

  // Close the booking context menu on outside click / Escape so it
  // doesn't linger after the user moves on.
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
  //
  // 2026-07-24 — Studio filter (Bookings tab). Director ask: an easy
  // way to toggle between Studio A / Studio B / off-site bookings and
  // see at a glance which room has what booked, so Studio B doesn't
  // sit empty unnoticed and double-bookings are obvious. `booking.studio`
  // already carries the raw `sessions.room` value (see lib/calendar.ts's
  // `subtitle: s.room` mapping) — this was previously never read by the
  // view layer at all. null = "All studios".
  const [selectedStudio, setSelectedStudio] = useState<string | null>(null)
  const studioFilterActive = selectedStudio !== null
  const KNOWN_STUDIO_SPACES: readonly StudioSpace[] = ['Studio A', 'Studio B', 'External Location', 'Virtual Session']
  function asStudioSpace(value: string | null): StudioSpace | undefined {
    return value && (KNOWN_STUDIO_SPACES as readonly string[]).includes(value)
      ? (value as StudioSpace)
      : undefined
  }

  // Per-studio booking counts for the CURRENT visible week (bookings
  // is already scoped to weekOffset via loadWeekEvents) — surfaced as
  // a badge per pill so a thin Studio B week is visible without
  // clicking into it.
  const studioCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const b of bookings) {
      if (b.status === 'Cancelled') continue
      counts[b.studio] = (counts[b.studio] ?? 0) + 1
    }
    return counts
  }, [bookings])

  // Known rooms first (matches CreateBookingModal's STUDIOS order), then
  // any other value actually seen on a booking this week (e.g. a legacy
  // or unusual room string) so the filter never silently hides bookings.
  const studioFilterOptions = useMemo(() => {
    const known = ['Studio A', 'Studio B', 'External Location', 'Virtual Session']
    const seen = new Set(Object.keys(studioCounts))
    const extra = [...seen].filter((s) => !known.includes(s)).sort()
    return [...known.filter((s) => seen.has(s)), ...extra]
  }, [studioCounts])

  const bookingsByDate = useMemo(() => {
    const map: Record<string, CalendarBooking[]> = {}
    for (const b of bookings) {
      if (b.status === 'Cancelled') continue
      if (studioFilterActive && b.studio !== selectedStudio) continue
      const group = map[b.date] ?? []
      group.push(b)
      map[b.date] = group
    }
    return map
  }, [bookings, selectedStudio, studioFilterActive])

  // ─── Scheduler overlay (PR 2 of scheduler series) ────────────────
  // Fetches every team member's recurring + one-off (approved) blocks
  // for the visible week and renders them as translucent sage/teal
  // panels behind the booking blocks. Pure read-only layer — clicks
  // pass through to the booking blocks / +Book affordance underneath.
  // Per user: schedule color should "look different than bookings and
  // more translucent" so the warm-gold booking blocks stay the eye's
  // primary focus.
  const scheduleRange = useMemo(() => {
    // WEEK[0] is Monday of the viewed week; reuse the same date keys
    // the week-grid renders so block placement stays in sync.
    const from = WEEK[0]?.key ?? localDateKey()
    const to = WEEK[6]?.key ?? from
    return { from, to }
  }, [WEEK])

  // includePending=false — pending member proposals don't render on
  // the team-wide calendar; they wait for admin approval. Approved
  // blocks and recurring rules flow through normally.
  const { expanded: scheduleExpanded } = useTeamSchedule({
    range: scheduleRange,
    includePending: false,
  })

  // Member name map for tooltips. Cached at the page level — every
  // booking / schedule block reuses one cache entry.
  const { data: teamMembers = [] } = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
    staleTime: 60_000,
  })
  // 2026-05-26 (PR C) — reverse lookup: display_name → full member
  // object. Bookings carry the assignee as a plain string (the join
  // doesn't surface member_id on the booking row), so to drop an
  // avatar inside the block we resolve the name back to a member we
  // already have cached. Misses (e.g. an admin renamed a member
  // after the booking landed) gracefully fall back to no avatar.
  const memberByName = useMemo(() => {
    const map = new Map<string, (typeof teamMembers)[number]>()
    for (const m of teamMembers) {
      if (m.display_name) map.set(m.display_name, m)
    }
    return map
  }, [teamMembers])

  // 2026-05-27 — Avatar-derived calendar colors. Each member's
  // shift block tints to the dominant color sampled from their
  // profile picture (Checkmark's gold mic → gold blocks, etc).
  // Cache lives at module scope keyed by avatar URL, so a re-upload
  // triggers a fresh sample on the next read. Members without an
  // avatar fall back to a stable hashed-palette color.
  const teamMemberColors = useTeamMemberColors(teamMembers)

  // 2026-05-23 — per-member filter pills at the top of the page.
  // Single-select model: null = show all members (the default —
  // preserves existing behavior), one id = show only that member's
  // hours. Bookings stay unfiltered: they belong to clients, not
  // staff. Clicking the active member's pill toggles back to All.
  // User direction: "lets make the filter a toggle instead of
  // selecting multiple at once for the calendar filter."
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const memberFilterActive = selectedMemberId !== null

  // 2026-05-27 — Per Bridget: "can the icons be more greyed out and
  // when you hover over them they light up..." — that grayscale-
  // until-hover treatment lived in the old shared hour-grid overlay,
  // removed 2026-07-28 in favor of TeamScheduleGrid.tsx, where every
  // member has an always-visible, always-distinguishable color (see
  // docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md "Locked decisions" — whether
  // a hover-highlight interaction should be layered back on top is an
  // open question for the director, not decided here).

  // Sort active members alphabetically for the pill row. Inactive
  // members are dropped — they shouldn't show as filter targets.
  const memberPillRow = useMemo(
    () =>
      [...teamMembers]
        .filter((m) => m.display_name && m.status !== 'inactive')
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [teamMembers],
  )

  function selectMember(memberId: string) {
    // Click the active member's pill → toggle back to All. Click any
    // other member → switch to just that one.
    setSelectedMemberId((prev) => (prev === memberId ? null : memberId))
  }

  // Apply the member filter before bucketing by date so the cell-
  // render math works against the already-narrowed set.
  const filteredScheduleExpanded = useMemo(() => {
    if (!memberFilterActive) return scheduleExpanded
    return scheduleExpanded.filter((s) => s.member_id === selectedMemberId)
  }, [scheduleExpanded, selectedMemberId, memberFilterActive])

  // Bucket schedule entries by local date string (YYYY-MM-DD) so the
  // week-grid render can pull each day's list inline without re-
  // scanning the full array per cell. A one-off block carries a
  // single starts_at/ends_at span rather than one row per day, so a
  // multi-day entry (most commonly time off) is bucketed into EVERY
  // day it overlaps, not just its start day.
  function bucketByDate(entries: typeof scheduleExpanded): Record<string, typeof scheduleExpanded> {
    const map: Record<string, typeof scheduleExpanded> = {}
    for (const s of entries) {
      const startKey = localDateKey(new Date(s.starts_at))
      const endExclusive = new Date(s.ends_at)
      endExclusive.setMilliseconds(endExclusive.getMilliseconds() - 1)
      const endKey = localDateKey(endExclusive)
      for (const wd of WEEK) {
        if (wd.key < startKey || wd.key > endKey) continue
        const group = map[wd.key] ?? []
        group.push(s)
        map[wd.key] = group
      }
    }
    return map
  }

  // Work shifts render as the existing avatar-segment wash. Time off
  // renders separately (see below) so it never reads as a work shift.
  const schedulesByDate = useMemo(
    () => bucketByDate(filteredScheduleExpanded.filter((s) => s.kind !== 'time_off')),
    [filteredScheduleExpanded],
  )
  const timeOffByDate = useMemo(
    () => bucketByDate(filteredScheduleExpanded.filter((s) => s.kind === 'time_off')),
    [filteredScheduleExpanded],
  )

  // 2026-07-24 — Bookings and the team-schedule overlay used to share
  // one week grid gated by a "Schedule" visibility toggle. Per director
  // direction, they're now separate tabs within the Calendar page: the
  // synced booking calendar is the default/main view, and the team's
  // work-shift schedule (still the pre-existing look — a visual revamp
  // is deferred) lives on its own tab so the two don't compete for the
  // same grid.
  const [activeTab, setActiveTab] = useState<'bookings' | 'schedule'>('bookings')

  // 2026-05-23 — Studio hours of operation overlay (Apple-Calendar-
  // style frame). Per-weekday rows from studio_hours_of_operation
  // drive a gold/8% wash for OPEN hours + a soft grey dim for CLOSED
  // hours (and full-day grey for closed days like Sun/Mon by default).
  // The member-schedule chips and gold booking blocks then nest
  // visibly INSIDE the gold band, which reads as "the studio is
  // open during this window."
  const { byWeekday: studioHoursByWeekday } = useStudioHours()
  // Grid math constants — kept in sync with the HOURS render below.
  // GRID_START_HOUR = first visible hour (7am); GRID_END_HOUR = first
  // hour OFF the bottom of the grid (20=8pm). 48px per hour row.
  const GRID_START_HOUR = 7
  const GRID_END_HOUR = 20
  const HOUR_PX = 48

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {showBooking && (
        <CreateBookingModal
          onClose={() => { setShowBooking(false); setBookingPrefillDate(''); setBookingPrefillTime(''); void refetch() }}
          prefillDate={bookingPrefillDate}
          prefillTime={bookingPrefillTime}
          prefillStudio={asStudioSpace(selectedStudio)}
        />
      )}
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

      {/* Schedule-request modal. Driven by `scheduleRequest`:
            true       → open with no prefill (header pill flow)
            {prefill}  → open with day/time prefilled (cell menu flow)
            null       → closed */}
      {scheduleRequest && profile?.id && (
        <ScheduleRequestModal
          memberId={profile.id}
          prefill={scheduleRequest === true ? undefined : scheduleRequest}
          onClose={() => setScheduleRequest(null)}
          onSubmitted={() => setScheduleRequest(null)}
        />
      )}

      {/* 2026-05-26 — Restructured header per user feedback: title +
          filter pills + Schedule + Request schedule all on a single
          row; week navigation moved INTO the week-grid box below.
          Filter pills use first names (not full display_name) and a
          Filter icon replaces the "SHOW" subtext so the row reads as
          "click any name to filter" without needing a verbal hint.
          Wrap behavior: on narrow viewports the right-side controls
          drop to a new row beneath the title block. */}
      <div className="flex items-center justify-between gap-x-4 gap-y-2 mb-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
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
          {/* Member filter pills — inline with title. Renders only when
              there's more than one staffer AND the schedule layer is on
              (the pills filter the schedule overlay; with it hidden the
              filter would have nothing to do). Filter icon leads the
              row instead of a "SHOW" word so the affordance reads at a
              glance. */}
          {memberPillRow.length > 1 && activeTab === 'schedule' && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-text-muted" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setSelectedMemberId(null)}
                aria-pressed={!memberFilterActive}
                title="Show every member's schedule"
                className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                  !memberFilterActive
                    ? 'bg-gold/15 text-gold border-gold/40'
                    : 'bg-surface-alt text-text-muted border-border hover:text-text'
                }`}
              >
                All
                <span className="opacity-70">{memberPillRow.length}</span>
              </button>
              {/* 2026-07-28 — Pills now use the SAME locked/avatar
                  color as that member's row on the grid below (via
                  `resolveScheduleColor`), replacing the shared purple
                  active-state — so a pill and its row read as the
                  same identity at a glance. */}
              {memberPillRow.map((m) => {
                const isOn = selectedMemberId === m.id
                const c = resolveScheduleColor(m, teamMemberColors)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMember(m.id)}
                    aria-pressed={isOn}
                    title={isOn ? `Back to all members` : `Show only ${m.display_name}`}
                    style={isOn ? { backgroundColor: c.bg, borderColor: c.border, color: c.accent } : undefined}
                    className={`inline-flex items-center gap-1.5 h-7 pl-0.5 pr-2.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                      isOn
                        ? ''
                        : memberFilterActive
                          ? 'bg-surface-alt/60 text-text-light border-border/60 opacity-60 hover:opacity-100 hover:text-text'
                          : 'bg-surface-alt text-text-muted border-border hover:text-text'
                    }`}
                  >
                    <MemberAvatar member={m} size="xs" />
                    <span className="truncate max-w-[88px]">{firstName(m.display_name)}</span>
                  </button>
                )
              })}
            </div>
          )}
          {/* Studio filter pills — inline with title, Bookings tab
              only. Sky accent (distinct from the purple member-filter
              pills on the Team Schedule tab) since this filters a
              different axis (room, not person). Only rendered when
              there's more than one distinct room booked this week —
              a single-studio week has nothing to filter. */}
          {studioFilterOptions.length > 1 && activeTab === 'bookings' && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-text-muted" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setSelectedStudio(null)}
                aria-pressed={!studioFilterActive}
                title="Show every studio's bookings"
                className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                  !studioFilterActive
                    ? 'bg-sky-700/15 text-sky-100 border-sky-500/30'
                    : 'bg-surface-alt text-text-muted border-border hover:text-text'
                }`}
              >
                All
                <span className="opacity-70">
                  {Object.values(studioCounts).reduce((sum, n) => sum + n, 0)}
                </span>
              </button>
              {studioFilterOptions.map((studio) => {
                const isOn = selectedStudio === studio
                const count = studioCounts[studio] ?? 0
                return (
                  <button
                    key={studio}
                    type="button"
                    onClick={() => setSelectedStudio((prev) => (prev === studio ? null : studio))}
                    aria-pressed={isOn}
                    title={isOn ? 'Back to all studios' : `Show only ${studio}`}
                    className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                      isOn
                        ? 'bg-sky-700/15 text-sky-100 border-sky-500/40 ring-1 ring-sky-500/20'
                        : studioFilterActive
                          ? 'bg-surface-alt/60 text-text-light border-border/60 opacity-60 hover:opacity-100 hover:text-text'
                          : 'bg-surface-alt text-text-muted border-border hover:text-text'
                    }`}
                  >
                    <span className="truncate max-w-[96px]">{studio}</span>
                    <span className="opacity-70">{count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          {/* 2026-07-24 — Bookings vs. Team Schedule tab switcher.
              Replaces the old "Schedule" visibility toggle: the two
              views no longer share one grid, so this is a real tab,
              not a layer on/off switch. Bookings is the default.
              2026-07-28 — director: "make the toggle extremely easy
              to notice" / "super noticeable like your preview." Both
              segments share one solid gold-fill active state, now
              sized up (bigger padding, bigger text, a soft shadow on
              the active pill) to match the weight of the approved
              mockup rather than blending into the surrounding
              toolbar row. */}
          <div role="tablist" aria-label="Calendar view" className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-alt border border-border">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'bookings'}
              onClick={() => setActiveTab('bookings')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold transition-colors ${
                activeTab === 'bookings'
                  ? 'bg-gold text-[#241d08] shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Bookings
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'schedule'}
              onClick={() => setActiveTab('schedule')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold transition-colors ${
                activeTab === 'schedule'
                  ? 'bg-gold text-[#241d08] shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <CalendarRange size={15} aria-hidden="true" />
              <span>Team Schedule</span>
              {filteredScheduleExpanded.length > 0 && (
                <span className="opacity-70">{filteredScheduleExpanded.length}</span>
              )}
            </button>
          </div>
          {activeTab === 'schedule' && profile?.id && (
            <button
              type="button"
              onClick={() => setScheduleRequest(true)}
              title="Set weekly schedule, request a one-time change, or see time-off status"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-border bg-surface-alt text-text-muted hover:text-gold hover:border-gold/40 transition-colors"
            >
              <Plus size={11} aria-hidden="true" />
              <span>Request schedule</span>
            </button>
          )}
        </div>
      </div>

      {/* 2-column layout — matched height. Left column stacks the
          mini month-picker (added 2026-05-26) above the shared
          CalendarDayCard (PR #22). Right column is the week grid
          unique to this page. */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3 items-stretch">

        {/* ── Left column: Today card stretches to fill, mini-month
            anchored at the bottom ──
            2026-05-26 — Bridget's review feedback: "anchor the monthly
            calendar snapshot at the bottom and stretch the today
            calendar out to fit the space between it... even if the
            today calendar isn't full." Outer `h-full` + `flex-1` on
            the Today card pin the picker at the bottom and let the
            card expand to fill whatever vertical space the week grid
            on the right is consuming. `min-h-0` keeps the flex math
            from over-sizing when the card has more content than the
            available space. */}
        <div className="flex flex-col gap-3 h-full">
          <CalendarDayCard
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            className="flex-1 min-h-0"
          />
          <MiniMonthPicker
            selectedDate={selectedDate}
            onSelectDate={(key) => {
              // Jumping to a day in any visible month must also slide
              // the week grid to that day's week. Compute the offset
              // between today's Monday and the target's Monday in
              // 7-day units. No clamp here — unlike the prev/next
              // chevrons (which guard against accidental over-paging),
              // an explicit date-grid click is unambiguous user intent.
              const today = new Date()
              today.setHours(12, 0, 0, 0)
              const todayMonday = new Date(today)
              todayMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
              const [y, m, d] = key.split('-').map(Number)
              const target = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
              const targetMonday = new Date(target)
              targetMonday.setDate(target.getDate() - ((target.getDay() + 6) % 7))
              const diffMs = targetMonday.getTime() - todayMonday.getTime()
              const offset = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
              setWeekOffset(offset)
              setSelectedDate(key)
            }}
          />
        </div>

        {/* ── Right column: This Week grid ── */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {/* 2026-05-26 — Week-nav lives INSIDE the grid card now (per
              user feedback: "put the [this week] and date ranges shown
              in image two on the actual calendar box"). Chevrons +
              "This Week" link reset to today's week; the date-range
              label sits to the right. */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-text-muted">
            <button
              type="button"
              onClick={() => { if (weekOffset > -1) setWeekOffset(weekOffset - 1) }}
              className={`p-1 rounded hover:bg-surface-hover transition-colors ${weekOffset <= -1 ? 'opacity-30 cursor-not-allowed' : ''}`}
              aria-label="Previous week"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="text-[13px] font-bold text-gold hover:underline"
              title="Jump to this week"
            >
              {weekLabel}
            </button>
            <button
              type="button"
              onClick={() => { if (weekOffset < 3) setWeekOffset(weekOffset + 1) }}
              className={`p-1 rounded hover:bg-surface-hover transition-colors ${weekOffset >= 3 ? 'opacity-30 cursor-not-allowed' : ''}`}
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </button>
            <span className="text-[12px] text-text-light ml-1">{weekStart} – {weekEnd}</span>
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

              {/* Time rows with inline booking blocks. Bookings-tab
                  only (2026-07-28) — the Team Schedule tab now renders
                  its own member-rows layout below instead of sharing
                  this hour grid, per the director-approved redesign
                  (docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md). Bookings'
                  Google-Calendar-style grid is explicitly unchanged. */}
              {activeTab === 'bookings' && (
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
                        <div
                          key={di}
                          className={`border-l border-border group/cell relative ${isSel ? 'bg-gold/[0.03]' : ''}`}
                        >
                          {/* +Book hover affordance — sits at z-10 so it's
                              below booking blocks (z-30). When a cell is
                              already booked, the booking block intercepts
                              the hover + click; this button only surfaces
                              on truly-empty cells. Bookings-tab only
                              (2026-07-24) — creating a booking from the
                              Team Schedule tab doesn't make sense now
                              that the two views are separate. */}
                          {activeTab === 'bookings' && (
                            <button onClick={() => { setBookingPrefillDate(wd.key); setBookingPrefillTime(`${hour.toString().padStart(2,'0')}:00`); setShowBooking(true) }} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity z-10">
                              <span className="flex items-center gap-0.5 text-[9px] text-gold bg-surface/90 border border-gold/20 rounded px-1.5 py-0.5">
                                <Plus size={8} />Book
                              </span>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}

                {/* 2026-05-23 — Studio hours-of-operation overlay
                    (Apple-Calendar-style "open hours" frame). Per
                    weekday, a soft gold/8% wash paints the OPEN hour
                    range; closed hours + closed days get a subtle
                    grey dim so admins see at a glance "this is when
                    the studio is open." Renders FIRST in source so
                    later layers (schedule chips z-0 + bookings z-30)
                    nest visibly on top. pointer-events-none — clicks
                    pass through to the +Book affordance. */}
                {WEEK.map((wd, dayIndex) => {
                  const weekday = new Date(`${wd.key}T12:00:00`).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
                  const studioRow = studioHoursByWeekday[weekday]
                  const colWidth = `((100% - 36px) / 7)`
                  const colLeft = `(36px + ${colWidth} * ${dayIndex})`
                  const isClosedDay = !studioRow || !studioRow.active
                  const gridHeightPx = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX // 13 * 48 = 624
                  if (isClosedDay) {
                    // Whole column dim — studio is closed this day.
                    return (
                      <div
                        key={`closed-${wd.key}`}
                        aria-hidden="true"
                        className="absolute pointer-events-none z-0 bg-black/[0.04]"
                        style={{
                          top: 0,
                          height: gridHeightPx,
                          left: `calc(${colLeft})`,
                          width: `calc(${colWidth})`,
                        }}
                      />
                    )
                  }
                  // Open day — clip open band to the visible grid,
                  // paint the closed sub-bands (above open, below
                  // close) as dim grey.
                  const openMin = timeToMinutes(studioRow.open_time)
                  const closeMin = timeToMinutes(studioRow.close_time)
                  const gridStartMin = GRID_START_HOUR * 60
                  const gridEndMin = GRID_END_HOUR * 60
                  const visOpenMin = Math.max(openMin, gridStartMin)
                  const visCloseMin = Math.min(closeMin, gridEndMin)
                  const openTopPx = ((visOpenMin - gridStartMin) / 60) * HOUR_PX
                  const openHeightPx = Math.max(0, ((visCloseMin - visOpenMin) / 60) * HOUR_PX)
                  // Off-hours strips (before open + after close, both
                  // clipped to the visible grid).
                  const beforeOpenPx = Math.max(0, openTopPx)
                  const afterClosePx = Math.max(0, gridHeightPx - openTopPx - openHeightPx)
                  return (
                    <div key={`studio-${wd.key}`} aria-hidden="true" className="contents">
                      {beforeOpenPx > 0 && (
                        <div
                          className="absolute pointer-events-none z-0 bg-black/[0.04]"
                          style={{
                            top: 0,
                            height: beforeOpenPx,
                            left: `calc(${colLeft})`,
                            width: `calc(${colWidth})`,
                          }}
                        />
                      )}
                      {openHeightPx > 0 && (
                        <div
                          className="absolute pointer-events-none z-0 bg-gold/[0.08]"
                          title={`Studio open ${studioRow.open_time.slice(0, 5)}–${studioRow.close_time.slice(0, 5)}`}
                          style={{
                            top: openTopPx,
                            height: openHeightPx,
                            left: `calc(${colLeft})`,
                            width: `calc(${colWidth})`,
                          }}
                        />
                      )}
                      {afterClosePx > 0 && (
                        <div
                          className="absolute pointer-events-none z-0 bg-black/[0.04]"
                          style={{
                            top: openTopPx + openHeightPx,
                            height: afterClosePx,
                            left: `calc(${colLeft})`,
                            width: `calc(${colWidth})`,
                          }}
                        />
                      )}
                    </div>
                  )
                })}

                {/* Booking blocks — positioned within each day column
                    via overlap-aware lane math (PR E). Bookings that
                    share a time slot fan out side-by-side instead of
                    stacking. Z-index is z-30 — above the +Book hover
                    button (z-10) so a click on a booking always lands
                    on the booking, never on the empty-cell affordance
                    underneath. Only renders on the Bookings tab
                    (2026-07-24 — split out from the Team Schedule
                    tab so the two views don't overlay each other). */}
                {activeTab === 'bookings' && WEEK.map((wd, dayIndex) => {
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

                    // 2026-05-26 (PR B) — pastel block fill per session
                    // type. The legacy `.calendar-booking-block` CSS
                    // (gold-tinted, brand-uniform) is replaced with the
                    // sessionTypeColor mapping so engineering reads as
                    // mint, music_lesson as violet, etc. Status dot +
                    // gold hover ring preserved as accents.
                    const color = sessionTypeColor(b.type)
                    // 2026-05-26 (PR C) — resolve the assignee name
                    // back to a team_member so we can drop their
                    // avatar inside the block. Misses fall back to
                    // text-only (existing behavior).
                    const assigneeMember = memberByName.get(b.assignee)
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setDetailBooking(b)}
                        onContextMenu={(e) => {
                          if (!isAdmin) return
                          e.preventDefault()
                          e.stopPropagation()
                          setContextMenu({ booking: b, x: e.clientX, y: e.clientY })
                        }}
                        title={`${b.client} · ${formatTime12(b.startTime)}–${formatTime12(b.endTime)} · ${b.assignee}${isAdmin ? ' · Right-click for actions' : ''}`}
                        className={`absolute ${color.bg} ${color.border} border rounded-md px-1.5 py-0.5 overflow-hidden text-left cursor-pointer z-30 hover:ring-2 hover:ring-gold/50 hover:z-40 transition-all focus-ring`}
                        style={{
                          top: topPx + 1,
                          height: Math.max(heightPx - 2, 18),
                          left: `calc(${laneLeft} + 1px)`,
                          width: `calc(${laneWidth} - 2px)`,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {b.status === 'Confirmed' && <span className={`w-1.5 h-1.5 rounded-full ${color.accent} shrink-0`} />}
                          <p className={`text-[10px] font-semibold ${color.text} truncate leading-tight`}>{b.client}</p>
                        </div>
                        {heightPx > 28 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {assigneeMember && (
                              <span className="shrink-0">
                                <MemberAvatar member={assigneeMember} size="xs" />
                              </span>
                            )}
                            <p className="text-[8px] text-text-muted truncate leading-tight">{b.assignee}</p>
                          </div>
                        )}
                        {heightPx > 56 && groupSize === 1 && (
                          <p className="text-[8px] text-text-light truncate leading-tight mt-0.5">{formatTime12(b.startTime)}–{formatTime12(b.endTime)}</p>
                        )}
                      </button>
                    )
                  })
                })}
              </div>
              )}

              {activeTab === 'schedule' && (
                <TeamScheduleGrid
                  weekDays={WEEK}
                  members={memberFilterActive ? memberPillRow.filter((m) => m.id === selectedMemberId) : memberPillRow}
                  schedulesByDate={schedulesByDate}
                  timeOffByDate={timeOffByDate}
                  teamMemberColors={teamMemberColors}
                  gridStartHour={GRID_START_HOUR}
                  gridEndHour={GRID_END_HOUR}
                  selectedDate={selectedDate}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
