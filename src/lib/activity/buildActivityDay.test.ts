// Pure unit tests for the Member Activity day builder.
//
// Uses Node's built-in test runner (no extra deps) — run with:
//   node --test src/lib/activity/
// Node 24 strips the TypeScript types natively. The module under test
// imports PresenceSession as a type only, so nothing here pulls in the
// Supabase client.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildActivityDay,
  clipInterval,
  mergeIntervals,
  totalMinutes,
  activityTypeFromSource,
  type ActivityEvent,
  type ScheduledWindow,
} from './buildActivityDay.ts'

import type { PresenceSession } from '../queries/presence.ts'

// ─── Fixtures — a fixed target day, TZ-independent (all absolute ms) ──

const Y = 2026
const MO = 6 // July (0-indexed)
const D = 13
const dayStart = new Date(Y, MO, D, 0, 0, 0, 0)
const now = new Date(Y, MO, D, 14, 40, 0, 0)

/** ISO instant for a wall-clock time on the target day. */
function iso(h: number, m = 0): string {
  return new Date(Y, MO, D, h, m, 0, 0).toISOString()
}
/** ISO instant relative to the target day (dayOffset days). */
function isoOn(dayOffset: number, h: number, m = 0): string {
  return new Date(Y, MO, D + dayOffset, h, m, 0, 0).toISOString()
}

function sess(started: string, ended: string | null): PresenceSession {
  return {
    id: `s-${started}`,
    member_id: 'm1',
    team_id: 't1',
    started_at: started,
    last_seen_at: ended ?? started,
    ended_at: ended,
    source: 'heartbeat',
  }
}

function ev(id: string, at: string, type: ActivityEvent['type'], sourceType = type): ActivityEvent {
  return { id, at, type, label: `${type} ${id}`, sourceType }
}

const schedule: ScheduledWindow[] = [{ start: iso(10), end: iso(18) }]

function build(partial: Partial<Parameters<typeof buildActivityDay>[0]>) {
  return buildActivityDay({
    presenceSessions: [],
    events: [],
    scheduledWindows: schedule,
    dayStart,
    now,
    ...partial,
  })
}

// ─── clipInterval ────────────────────────────────────────────────────

test('clipInterval clips to bounds', () => {
  assert.deepEqual(clipInterval({ start: 5, end: 20 }, 10, 15), { start: 10, end: 15 })
})
test('clipInterval returns null when fully outside', () => {
  assert.equal(clipInterval({ start: 0, end: 5 }, 10, 20), null)
})
test('clipInterval returns null for zero-length / inverted', () => {
  assert.equal(clipInterval({ start: 10, end: 10 }, 0, 20), null)
  assert.equal(clipInterval({ start: 15, end: 5 }, 0, 20), null)
})

// ─── mergeIntervals ──────────────────────────────────────────────────

test('mergeIntervals merges overlapping', () => {
  assert.deepEqual(
    mergeIntervals([{ start: 0, end: 10 }, { start: 5, end: 15 }]),
    [{ start: 0, end: 15 }],
  )
})
test('mergeIntervals merges adjacent (touching) intervals', () => {
  assert.deepEqual(
    mergeIntervals([{ start: 0, end: 10 }, { start: 10, end: 20 }]),
    [{ start: 0, end: 20 }],
  )
})
test('mergeIntervals keeps disjoint intervals and sorts unsorted input', () => {
  assert.deepEqual(
    mergeIntervals([{ start: 30, end: 40 }, { start: 0, end: 10 }]),
    [{ start: 0, end: 10 }, { start: 30, end: 40 }],
  )
})
test('totalMinutes does not double-count overlaps', () => {
  const a = { start: 0, end: 60 * 60_000 } // 60 min
  const b = { start: 30 * 60_000, end: 90 * 60_000 } // overlaps → union 90 min
  assert.equal(totalMinutes([a, b]), 90)
})

// ─── activityTypeFromSource ──────────────────────────────────────────

test('activityTypeFromSource maps known source types', () => {
  assert.equal(activityTypeFromSource('task'), 'task')
  assert.equal(activityTypeFromSource('checklist'), 'task')
  assert.equal(activityTypeFromSource('session'), 'session')
  assert.equal(activityTypeFromSource('media_upload'), 'upload')
  assert.equal(activityTypeFromSource('deliverable'), 'video')
  assert.equal(activityTypeFromSource('review'), 'other')
})

// ─── Open sessions end at injected now ───────────────────────────────

test('open session is treated as ending at now', () => {
  const m = build({ presenceSessions: [sess(iso(10), null)] })
  assert.equal(m.activeMinutes, 280) // 10:00 → 14:40
  assert.equal(m.firstActiveAt, iso(10))
  // Ends at now, not at day end.
  assert.equal(m.segments.at(-1)?.end, now.toISOString())
})

// ─── Day-boundary clipping ───────────────────────────────────────────

test('session spanning into the day is clipped to day start', () => {
  const m = build({ presenceSessions: [sess(isoOn(-1, 22), iso(9))] })
  assert.equal(m.segments[0].start, dayStart.toISOString())
  assert.equal(m.segments[0].end, iso(9))
})
test('session entirely on another day is excluded', () => {
  const m = build({ presenceSessions: [sess(isoOn(1, 9), isoOn(1, 17))] })
  assert.equal(m.segments.length, 0)
  assert.equal(m.activeMinutes, 0)
  assert.equal(m.firstActiveAt, null)
})

// ─── Idle sessions are not merged ────────────────────────────────────

test('two idle-separated sessions stay separate and sum active time', () => {
  const m = build({
    presenceSessions: [sess(iso(10), iso(11)), sess(iso(12), iso(13))],
  })
  const onSegs = m.segments.filter((s) => s.kind === 'on')
  assert.equal(onSegs.length, 2)
  assert.equal(m.activeMinutes, 120)
})

// ─── On-schedule classification + grace ──────────────────────────────

test('arrival within grace is fully on-schedule (no late)', () => {
  const m = build({ presenceSessions: [sess(iso(10, 5), iso(13))] }) // 5 min late ≤ 15
  assert.equal(m.lateArrival, false)
  assert.equal(m.minutesLate, 0)
  assert.ok(m.segments.every((s) => s.kind === 'on'))
})

test('late arrival gets a late head then on tail', () => {
  const m = build({ presenceSessions: [sess(iso(10, 20), iso(13))] }) // 20 min late > 15
  assert.equal(m.lateArrival, true)
  assert.equal(m.minutesLate, 20)
  const late = m.segments.find((s) => s.kind === 'late')
  assert.ok(late, 'expected a late segment')
  assert.equal(late?.start, iso(10, 20))
  assert.equal(late?.end, iso(10, 35)) // 15-min head
  assert.ok(m.segments.some((s) => s.kind === 'on'))
})

// ─── Off-schedule ────────────────────────────────────────────────────

test('activity before the scheduled window is off-schedule', () => {
  const m = build({ presenceSessions: [sess(iso(9), iso(9, 30))] })
  assert.equal(m.segments.length, 1)
  assert.equal(m.segments[0].kind, 'off')
})

test('no scheduled window makes all active time off-schedule', () => {
  const m = build({
    scheduledWindows: [],
    presenceSessions: [sess(iso(10), iso(11))],
  })
  assert.equal(m.scheduledWindow, null)
  assert.equal(m.lateArrival, false)
  assert.equal(m.segments[0].kind, 'off')
})

// ─── Event bracketing, markers, totals ───────────────────────────────

test('an event with no presence still creates a small active interval', () => {
  const m = build({
    presenceSessions: [],
    events: [ev('u1', iso(11, 30), 'upload', 'media_upload')],
    eventBracketMinutes: 2,
  })
  assert.equal(m.markers.length, 1)
  assert.equal(m.totals.uploads, 1)
  assert.equal(m.activeMinutes, 4) // ±2 min bracket
})

test('markers are sorted by time and totals tallied by type', () => {
  const m = build({
    presenceSessions: [sess(iso(10), null)],
    events: [
      ev('t1', iso(12, 15), 'task'),
      ev('s1', iso(12, 50), 'session'),
      ev('t2', iso(10, 40), 'task'),
      ev('v1', iso(13, 55), 'video', 'deliverable'),
    ],
  })
  assert.deepEqual(m.markers.map((x) => x.id), ['t2', 't1', 's1', 'v1'])
  assert.equal(m.totals.tasks, 2)
  assert.equal(m.totals.sessions, 1)
  assert.equal(m.totals.videos, 1)
})

test('events outside the day are dropped from markers and totals', () => {
  const m = build({
    events: [
      ev('yesterday', isoOn(-1, 12), 'task'),
      ev('future', isoOn(1, 12), 'task'),
    ],
  })
  assert.equal(m.markers.length, 0)
  assert.equal(m.totals.tasks, 0)
})

test('events after now are dropped (day in progress)', () => {
  const m = build({ events: [ev('later', iso(15, 30), 'task')] }) // now is 14:40
  assert.equal(m.markers.length, 0)
})
