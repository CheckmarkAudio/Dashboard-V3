// Phase 5.5 — Week-view calendar data loader.
//
// Aggregates everything time-sensitive for a given week into a flat
// CalendarEvent[] that CalendarWeek knows how to render: sessions,
// team meetings (sessions with session_type='meeting'), and the
// weekly schedule-templates day labels as all-day pills.

import { supabase } from './supabase'
import { addDays, startOfWeek } from './time'
import { localDateKey } from './dates'
import type { CalendarEvent } from '../types'

export interface LoadWeekEventsOptions {
  /** Monday of the week we want. If omitted, uses the current week. */
  weekStart?: Date
  /**
   * Scope the fetch:
   *   - a member id → only that member's sessions + schedule focus entries
   *   - 'team'      → everyone on the team (admin view)
   */
  scope?: 'team' | string
}

export interface LoadWeekEventsResult {
  events: CalendarEvent[]
  weekStart: Date
  weekEnd: Date
}

/**
 * Pull one week of calendar events from Supabase. All queries run in
 * parallel. Caller-side filtering for 'member_id' scoping because
 * `sessions` doesn't have a direct intern linkage column — we match on
 * `created_by` as a best-effort proxy for now.
 */
export async function loadWeekEvents({
  weekStart: weekStartArg,
  scope = 'team',
}: LoadWeekEventsOptions = {}): Promise<LoadWeekEventsResult> {
  const weekStart = startOfWeek(weekStartArg ?? new Date())
  const weekEnd = addDays(weekStart, 6)
  const weekStartYMD = localDateKey(weekStart)
  const weekEndYMD = localDateKey(weekEnd)

  // Fetch sessions + schedule templates + member list (for names in
  // merged team view) in parallel.
  const [sessionsRes, schedulesRes, membersRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, project_id, client_name, session_date, start_time, end_time, session_type, status, room, notes, created_by')
      .gte('session_date', weekStartYMD)
      .lte('session_date', weekEndYMD)
      .order('session_date')
      .order('start_time'),
    supabase
      .from('team_schedule_templates')
      .select('id, intern_id, day_of_week, focus_areas'),
    supabase
      .from('team_members')
      .select('id, display_name'),
  ])

  if (sessionsRes.error) {
    console.error('[calendar] sessions query:', sessionsRes.error)
  }
  if (schedulesRes.error) {
    console.error('[calendar] schedule templates query:', schedulesRes.error)
  }

  const memberNameById = new Map<string, string>()
  for (const m of (membersRes.data ?? []) as Array<{ id: string; display_name: string }>) {
    memberNameById.set(m.id, m.display_name)
  }

  const events: CalendarEvent[] = []

  // ─── Sessions & meetings ───────────────────────────────────────────
  for (const s of (sessionsRes.data ?? []) as Array<{
    id: string
    client_name: string | null
    session_date: string
    start_time: string
    end_time: string
    session_type: 'recording' | 'mixing' | 'lesson' | 'meeting'
    status: 'confirmed' | 'pending' | 'cancelled'
    room: string | null
    created_by: string | null
  }>) {
    if (s.status === 'cancelled') continue
    // Member-scoped filter: skip sessions the member isn't tied to.
    if (scope !== 'team' && s.created_by !== scope) continue
    events.push({
      id: `session:${s.id}`,
      kind: s.session_type === 'meeting' ? 'meeting' : 'session',
      title: s.client_name
        ? `${labelForType(s.session_type)} · ${s.client_name}`
        : labelForType(s.session_type),
      date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      member_id: s.created_by,
      member_name: s.created_by ? (memberNameById.get(s.created_by) ?? null) : null,
      href: '/sessions',
      subtitle: s.room,
    })
  }

  // ─── Weekly schedule focus areas (all-day overlay) ─────────────────
  // `day_of_week` is 1..7 starting Monday in this schema (matches startOfWeek).
  for (const row of (schedulesRes.data ?? []) as Array<{
    id: string
    intern_id: string | null
    day_of_week: number
    focus_areas: string[] | null
  }>) {
    if (!row.focus_areas || row.focus_areas.length === 0) continue
    if (scope !== 'team' && row.intern_id !== scope) continue
    const dayIdx = Math.max(0, Math.min(6, (row.day_of_week ?? 1) - 1))
    const date = localDateKey(addDays(weekStart, dayIdx))
    events.push({
      id: `schedule:${row.id}`,
      kind: 'schedule_focus',
      title: row.focus_areas.join(' · '),
      date,
      start_time: null,
      end_time: null,
      member_id: row.intern_id,
      member_name: row.intern_id ? (memberNameById.get(row.intern_id) ?? null) : null,
      href: '/schedule',
    })
  }

  return { events, weekStart, weekEnd }
}

function labelForType(t: 'recording' | 'mixing' | 'lesson' | 'meeting'): string {
  switch (t) {
    case 'recording': return 'Recording'
    case 'mixing':    return 'Mixing'
    case 'lesson':    return 'Lesson'
    case 'meeting':   return 'Meeting'
  }
}
