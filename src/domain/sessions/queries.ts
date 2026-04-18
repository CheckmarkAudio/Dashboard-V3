import { supabase } from '../../lib/supabase'
import { localDateKey } from '../../lib/dates'

/**
 * Session category labels surfaced on the Sessions page filter tabs.
 * The DB `session_type` enum is narrower (`recording`, `mixing`, `lesson`,
 * `meeting`) than the business categories a studio admin thinks in
 * (Engineer / Consult / Trailing / Music Lesson / Education), so we map
 * here and keep the UI labels stable even as the DB enum grows.
 */
export type SessionCategory =
  | 'Engineer'
  | 'Consult'
  | 'Trailing'
  | 'Music Lesson'
  | 'Education'

export interface SessionListItem {
  id: string
  client: string
  description: string
  date: string
  startTime: string
  endTime: string
  engineer: string
  studio: string
  /** UI status label: 'Confirmed' | 'Pending' | 'Cancelled' | 'Completed' */
  status: string
  category: SessionCategory
  sessionType: string
  rawStatus: string
}

function categoryFromSessionType(sessionType: string): SessionCategory {
  switch (sessionType) {
    case 'recording':
    case 'mixing':
      return 'Engineer'
    case 'lesson':
      return 'Music Lesson'
    case 'meeting':
      return 'Consult'
    default:
      return 'Engineer'
  }
}

function descriptionFromRow(row: { session_type: string; notes: string | null }): string {
  if (row.notes && row.notes.trim().length > 0) return row.notes.trim()
  switch (row.session_type) {
    case 'recording': return 'Recording session'
    case 'mixing':    return 'Mixing session'
    case 'lesson':    return 'Music lesson'
    case 'meeting':   return 'Team meeting'
    default:          return 'Studio session'
  }
}

function titleCaseStatus(raw: string): string {
  return raw.length === 0 ? raw : raw[0]!.toUpperCase() + raw.slice(1)
}

/**
 * Load sessions from today forward plus up to 30 days of history so the
 * Sessions page shows the useful working window (recent + upcoming) with
 * a single paginated query. Caller can filter by category in the UI.
 */
export async function loadSessionsWindow(): Promise<SessionListItem[]> {
  const today = localDateKey()
  // Look back 30 days so recently completed/cancelled sessions stay visible.
  const lookback = new Date()
  lookback.setDate(lookback.getDate() - 30)
  const lookbackYMD = localDateKey(lookback)

  const [sessionsRes, membersRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, client_name, session_date, start_time, end_time, session_type, status, room, notes, created_by, assigned_to')
      .gte('session_date', lookbackYMD)
      .order('session_date', { ascending: false })
      .order('start_time', { ascending: true })
      .limit(200),
    supabase
      .from('team_members')
      .select('id, display_name'),
  ])

  if (sessionsRes.error) throw sessionsRes.error

  const nameById = new Map<string, string>()
  for (const m of (membersRes.data ?? []) as Array<{ id: string; display_name: string }>) {
    nameById.set(m.id, m.display_name)
  }

  const items = (sessionsRes.data ?? []) as Array<{
    id: string
    client_name: string | null
    session_date: string
    start_time: string
    end_time: string
    session_type: string
    status: string
    room: string | null
    notes: string | null
    created_by: string | null
    assigned_to: string | null
  }>

  // Upcoming first (today and after, ascending), then past (descending).
  const upcoming = items
    .filter((row) => row.session_date >= today)
    .sort((a, b) => (a.session_date + a.start_time).localeCompare(b.session_date + b.start_time))
  const past = items
    .filter((row) => row.session_date < today)
    .sort((a, b) => (b.session_date + b.start_time).localeCompare(a.session_date + a.start_time))

  return [...upcoming, ...past].map((row) => {
    // Prefer the explicit assignee for the "Engineer" column. Fall back
    // to `created_by` for legacy rows booked before `assigned_to` existed
    // so old sessions still show a name instead of "Unassigned".
    const workingMember = row.assigned_to ?? row.created_by
    return {
      id: row.id,
      client: row.client_name ?? 'Studio session',
      description: descriptionFromRow(row),
      date: row.session_date,
      startTime: row.start_time,
      endTime: row.end_time,
      engineer: workingMember ? (nameById.get(workingMember) ?? 'Unassigned') : 'Unassigned',
      studio: row.room ?? 'TBD',
      status: titleCaseStatus(row.status),
      category: categoryFromSessionType(row.session_type),
      sessionType: row.session_type,
      rawStatus: row.status,
    }
  })
}

/**
 * Check whether any non-cancelled session overlaps the given window in
 * the given room. Used by the booking modal to warn before committing a
 * double-book. Returns the first conflicting row (or null). We do the
 * overlap math in SQL so we don't have to pull the full day's schedule
 * client-side, and filter out cancelled rows so a cancellation doesn't
 * lock out the slot.
 */
export interface SessionConflict {
  id: string
  client_name: string | null
  start_time: string
  end_time: string
  room: string | null
}

export async function findSessionConflict(input: {
  sessionDate: string
  startTime: string
  endTime: string
  room: string
  /** Exclude this session id from conflict lookup (used when editing). */
  excludeId?: string | null
}): Promise<SessionConflict | null> {
  // Postgres time comparison: two ranges overlap iff a.start < b.end AND a.end > b.start.
  const startHM = input.startTime.length === 5 ? `${input.startTime}:00` : input.startTime
  const endHM = input.endTime.length === 5 ? `${input.endTime}:00` : input.endTime

  let q = supabase
    .from('sessions')
    .select('id, client_name, start_time, end_time, room')
    .eq('session_date', input.sessionDate)
    .eq('room', input.room)
    .neq('status', 'cancelled')
    .lt('start_time', endHM)
    .gt('end_time', startHM)
    .limit(1)

  if (input.excludeId) q = q.neq('id', input.excludeId)

  const { data, error } = await q
  if (error) throw error
  const row = data?.[0]
  return row ? (row as SessionConflict) : null
}
