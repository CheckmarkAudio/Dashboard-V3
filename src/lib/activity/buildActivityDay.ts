// Member Activity — pure day builder (PR2).
//
// Consumes PR1's persisted presence contract (PresenceSession) plus the
// day's activity events and the member's scheduled window, and returns a
// UI-ready day model that PR3's widget renders WITHOUT re-solving any
// date/interval math.
//
// Design rules (per the Claude PR2 handoff):
//   - Pure + sync. No IO, no `Date.now()` hidden inside — the caller
//     injects `now` so tests are deterministic and open sessions have a
//     single, explicit end.
//   - A presence session is the active interval [started_at, ended_at ?? now].
//   - All intervals are clipped to the requested local day.
//   - Overlapping / adjacent active intervals are merged so active time is
//     never double-counted.
//   - Presence is unioned with "action bracketing": an activity event proves
//     the member was active at that moment, so each event contributes a small
//     interval even if it lands outside a presence session.
//
// This module intentionally imports PresenceSession as a TYPE ONLY, so it
// never pulls the Supabase client into the pure/test path.

import type { PresenceSession } from '../queries/presence'
import {
  clipInterval,
  mergeIntervals,
  subtractIntervals,
  totalMinutes,
  type Interval,
} from '../time/intervals.ts'

export { clipInterval, mergeIntervals, totalMinutes } from '../time/intervals.ts'

// ─── Public types ────────────────────────────────────────────────────

/** Activity marker categories the widget knows how to draw. */
export type ActivityEventType =
  | 'task'
  | 'session'
  | 'upload'
  | 'video'
  | 'notification'
  | 'other'

/** One thing the member did, already normalized from its source row. */
export interface ActivityEvent {
  id: string
  /** ISO timestamp of when it happened. */
  at: string
  type: ActivityEventType
  /** Short human label, e.g. `completed "Bounce final vocal comp"`. */
  label: string
  /** Raw source discriminator it came from (flywheel source_type, etc.). */
  sourceType: string
}

/** A scheduled work window for the member on the target day (ISO bounds). */
export interface ScheduledWindow {
  start: string
  end: string
}

/** Colored presence segment. `on` = present within schedule, `late` = the
 *  head of a late arrival, `off` = present outside the scheduled window. */
export type SegmentKind = 'on' | 'late' | 'off'

export interface ActivitySegment {
  start: string
  end: string
  kind: SegmentKind
}

export interface ActivityMarker {
  id: string
  at: string
  type: ActivityEventType
  label: string
}

export interface ActivityTotals {
  tasks: number
  sessions: number
  uploads: number
  videos: number
  notifications: number
  other: number
}

export interface ActivityDayModel {
  /** Effective work windows after approved time off has been subtracted. */
  scheduledWindows: ScheduledWindow[]
  /**
   * Compatibility display envelope from first start to last end.
   * Consumers that show schedule detail should use `scheduledWindows`.
   */
  scheduledWindow: ScheduledWindow | null
  /** Presence classified against the schedule, sorted by start. */
  segments: ActivitySegment[]
  /** Activity events on the day, sorted by time. */
  markers: ActivityMarker[]
  totals: ActivityTotals
  /** Minutes the member was active (merged presence ∪ event brackets). */
  activeMinutes: number
  /** First active moment on the day, or null. */
  firstActiveAt: string | null
  /** True when the first in-schedule activity started past the grace. */
  lateArrival: boolean
  /** How many minutes late the arrival was (0 when not late / no schedule). */
  minutesLate: number
}

export interface BuildActivityDayInput {
  presenceSessions: PresenceSession[]
  events: ActivityEvent[]
  /** The member's scheduled windows overlapping the day (may be empty). */
  scheduledWindows: ScheduledWindow[]
  /** Local midnight of the target day. */
  dayStart: Date
  /** Exclusive end of the day. Defaults to dayStart + 24h. */
  dayEnd?: Date
  /** Injected "now" — open sessions end here; markers/segments never exceed it. */
  now: Date
  /** Minutes past scheduled start still counted on-time. Default 15. */
  lateGraceMinutes?: number
  /** Visible width of the "late" head segment in minutes. Default 15. */
  lateSegmentMinutes?: number
  /** Half-width (minutes) of the interval an event brackets. Default 2. */
  eventBracketMinutes?: number
}

const MINUTE_MS = 60_000

/**
 * Split one active interval against a scheduled window into `on` (inside)
 * and `off` (outside) pieces. Late colouring is applied later, once we
 * know which piece is the day's first in-schedule activity.
 */
function classifyAgainstWindows(
  iv: Interval,
  windows: Interval[],
): { start: number; end: number; kind: SegmentKind }[] {
  if (windows.length === 0) {
    return [{ start: iv.start, end: iv.end, kind: 'off' }]
  }

  const parts: { start: number; end: number; kind: SegmentKind }[] = []
  for (const window of windows) {
    const overlap = clipInterval(iv, window.start, window.end)
    if (overlap) parts.push({ ...overlap, kind: 'on' })
  }
  for (const off of subtractIntervals([iv], windows)) {
    parts.push({ ...off, kind: 'off' })
  }
  return parts.sort((a, b) => a.start - b.start)
}

// ─── Event mapping ───────────────────────────────────────────────────

/** Map a raw source discriminator to a marker category. */
export function activityTypeFromSource(sourceType: string): ActivityEventType {
  switch (sourceType) {
    case 'task':
    case 'checklist':
      return 'task'
    case 'session':
      return 'session'
    case 'media_upload':
      return 'upload'
    case 'deliverable':
      return 'video'
    default:
      return 'other'
  }
}

// ─── Builder ─────────────────────────────────────────────────────────

export function buildActivityDay(input: BuildActivityDayInput): ActivityDayModel {
  const {
    presenceSessions,
    events,
    scheduledWindows,
    dayStart,
    now,
    lateGraceMinutes = 15,
    lateSegmentMinutes = 15,
    eventBracketMinutes = 2,
  } = input

  const dayStartMs = dayStart.getTime()
  const dayEndMs = (input.dayEnd ?? new Date(dayStartMs + 24 * 60 * MINUTE_MS)).getTime()
  const nowMs = now.getTime()
  // Never let anything on the day extend past "now" (a day in progress).
  const dayHi = Math.min(dayEndMs, Math.max(nowMs, dayStartMs))

  // 1. Presence → active intervals, clipped to the day (open → now).
  const presenceIntervals: Interval[] = []
  for (const s of presenceSessions) {
    const start = Date.parse(s.started_at)
    const rawEnd = s.ended_at ? Date.parse(s.ended_at) : nowMs
    if (Number.isNaN(start) || Number.isNaN(rawEnd)) continue
    const clipped = clipInterval({ start, end: rawEnd }, dayStartMs, dayHi)
    if (clipped) presenceIntervals.push(clipped)
  }

  // 2. Same-day events → markers (+ action-bracketing intervals).
  const bracketMs = eventBracketMinutes * MINUTE_MS
  const markers: ActivityMarker[] = []
  const eventIntervals: Interval[] = []
  const totals: ActivityTotals = {
    tasks: 0, sessions: 0, uploads: 0, videos: 0, notifications: 0, other: 0,
  }
  for (const ev of events) {
    const at = Date.parse(ev.at)
    if (Number.isNaN(at) || at < dayStartMs || at >= dayEndMs || at > dayHi) continue
    markers.push({ id: ev.id, at: ev.at, type: ev.type, label: ev.label })
    tallyTotal(totals, ev.type)
    const clipped = clipInterval(
      { start: at - bracketMs, end: at + bracketMs },
      dayStartMs,
      dayHi,
    )
    if (clipped) eventIntervals.push(clipped)
  }
  markers.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

  // 3. Active time = merge(presence ∪ event brackets).
  const activeIntervals = mergeIntervals([...presenceIntervals, ...eventIntervals])
  const activeMinutes = totalMinutes(activeIntervals)
  const firstActive = activeIntervals[0]
  const firstActiveMs = firstActive ? firstActive.start : null

  // 4. Keep the effective scheduled windows distinct. Approved time off can
  // split a day, and collapsing the pieces would falsely mark the gap as work.
  const scheduleIntervals = parseScheduledWindows(scheduledWindows, dayStartMs, dayEndMs)
  const firstWindow = scheduleIntervals[0] ?? null
  const lastWindow = scheduleIntervals[scheduleIntervals.length - 1] ?? null
  const displayWindow = firstWindow && lastWindow
    ? { start: firstWindow.start, end: lastWindow.end }
    : null

  // 5. Classify active intervals against the schedule.
  const rawSegments: { start: number; end: number; kind: SegmentKind }[] = []
  for (const iv of activeIntervals) {
    rawSegments.push(...classifyAgainstWindows(iv, scheduleIntervals))
  }
  rawSegments.sort((a, b) => a.start - b.start)

  // 6. Late arrival — the earliest in-schedule ("on") segment whose start is
  //    past the grace gets a `late` head (up to lateSegmentMinutes).
  let lateArrival = false
  let minutesLate = 0
  if (firstWindow) {
    const firstOn = rawSegments.find((s) => s.kind === 'on')
    if (firstOn) {
      const lateThreshold = firstWindow.start + lateGraceMinutes * MINUTE_MS
      if (firstOn.start > lateThreshold) {
        lateArrival = true
        minutesLate = Math.round((firstOn.start - firstWindow.start) / MINUTE_MS)
        const headEnd = Math.min(firstOn.end, firstOn.start + lateSegmentMinutes * MINUTE_MS)
        firstOn.kind = 'late'
        if (headEnd < firstOn.end) {
          rawSegments.push({ start: headEnd, end: firstOn.end, kind: 'on' })
          firstOn.end = headEnd
          rawSegments.sort((a, b) => a.start - b.start)
        }
      }
    }
  }

  const segments: ActivitySegment[] = rawSegments.map((s) => ({
    start: new Date(s.start).toISOString(),
    end: new Date(s.end).toISOString(),
    kind: s.kind,
  }))

  return {
    scheduledWindows: scheduleIntervals.map((window) => ({
      start: new Date(window.start).toISOString(),
      end: new Date(window.end).toISOString(),
    })),
    scheduledWindow: displayWindow
      ? {
          start: new Date(displayWindow.start).toISOString(),
          end: new Date(displayWindow.end).toISOString(),
        }
      : null,
    segments,
    markers,
    totals,
    activeMinutes,
    firstActiveAt: firstActiveMs != null ? new Date(firstActiveMs).toISOString() : null,
    lateArrival,
    minutesLate,
  }
}

function tallyTotal(totals: ActivityTotals, type: ActivityEventType): void {
  switch (type) {
    case 'task': totals.tasks++; break
    case 'session': totals.sessions++; break
    case 'upload': totals.uploads++; break
    case 'video': totals.videos++; break
    case 'notification': totals.notifications++; break
    default: totals.other++; break
  }
}

/** Parse, clip, and merge the day's effective scheduled windows. */
function parseScheduledWindows(
  windows: ScheduledWindow[],
  lo: number,
  hi: number,
): Interval[] {
  const intervals: Interval[] = []
  for (const w of windows) {
    const ws = Date.parse(w.start)
    const we = Date.parse(w.end)
    if (Number.isNaN(ws) || Number.isNaN(we) || we <= ws) continue
    const clipped = clipInterval({ start: ws, end: we }, lo, hi)
    if (!clipped) continue
    intervals.push(clipped)
  }
  return mergeIntervals(intervals)
}
