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
      .select('id, client_name, session_date, start_time, end_time, session_type, status, room, notes, created_by')
      .gte('session_date', lookbackYMD)
      .order('session_date', { ascending: false })
      .order('start_time', { ascending: true })
      .limit(200),
    supabase
      .from('intern_users')
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
  }>

  // Upcoming first (today and after, ascending), then past (descending).
  const upcoming = items
    .filter((row) => row.session_date >= today)
    .sort((a, b) => (a.session_date + a.start_time).localeCompare(b.session_date + b.start_time))
  const past = items
    .filter((row) => row.session_date < today)
    .sort((a, b) => (b.session_date + b.start_time).localeCompare(a.session_date + a.start_time))

  return [...upcoming, ...past].map((row) => ({
    id: row.id,
    client: row.client_name ?? 'Studio session',
    description: descriptionFromRow(row),
    date: row.session_date,
    startTime: row.start_time,
    endTime: row.end_time,
    engineer: row.created_by ? (nameById.get(row.created_by) ?? 'Unassigned') : 'Unassigned',
    studio: row.room ?? 'TBD',
    status: titleCaseStatus(row.status),
    category: categoryFromSessionType(row.session_type),
    sessionType: row.session_type,
    rawStatus: row.status,
  }))
}
