import type { TableColumn } from '../../components/ui'
import type { AdminSession } from '../queries/adminSessions'

/**
 * Shared `TableColumn<AdminSession>[]` for CSV/PDF exports of the
 * full admin sessions/bookings table. Driven by `fetchAllSessions`
 * (the `admin_list_all_sessions` RPC), so columns mirror the full
 * row shape — not the trimmed `RecentSessionInfo` used by the
 * Members → Activity widget (that one stays in
 * `sessionColumns.tsx`).
 *
 * Today every descriptor is export-only — the visible `/sessions`
 * page has its own purpose-built table UI (status pill popovers,
 * inline edit affordances, etc.) that's intentionally NOT iterated
 * from a descriptor list. The shared module still earns its keep
 * because:
 *   1. Future admin-side session surfaces (BusinessHealth analytics
 *      rollup, a per-member Sessions widget on the Activity carousel,
 *      etc.) can reuse the exact same export schema by importing
 *      this array.
 *   2. If a header rename or new column is needed, it happens in ONE
 *      file and propagates to every CSV/PDF download.
 *
 * Field choices favor downstream usability — date + start/end times
 * are exported as separate readable strings (good for sorting in
 * spreadsheets), with Duration as a derived humanized total alongside
 * the raw minute count (single source of truth for payroll formulas
 * + human-readable for non-technical reviewers).
 */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  // Sessions store session_date as 'YYYY-MM-DD'. Append T00:00:00 so
  // the Date constructor interprets it as local-time midnight (without
  // the suffix some browsers treat it as UTC and shift the date in
  // Mountain time evenings — same lesson as PR #c6c5bf6).
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.valueOf())) return iso
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatTime(hms: string | null | undefined): string {
  if (!hms) return ''
  // sessions.start_time / end_time = 'HH:mm:ss'. Strip seconds + show
  // as 12-hour clock to match the rest of the app's time labels.
  const [hh = '00', mm = '00'] = hms.split(':')
  const h = Number(hh)
  if (Number.isNaN(h)) return hms
  const hour12 = ((h + 11) % 12) + 1
  const ampm = h < 12 ? 'AM' : 'PM'
  return `${hour12}:${mm} ${ampm}`
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return ''
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function durationMinutes(s: AdminSession): number | null {
  if (!s.start_time || !s.end_time) return null
  const parse = (t: string) => {
    const [hh = '0', mm = '0', ss = '0'] = t.split(':')
    return Number(hh) * 60 + Number(mm) + Number(ss) / 60
  }
  const total = Math.round(parse(s.end_time) - parse(s.start_time))
  return Number.isFinite(total) ? total : null
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return ''
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (remainder === 0) return `${hours}h`
  return `${hours}h ${remainder}m`
}

function formatStatus(status: string | null | undefined): string {
  if (!status) return ''
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export const adminSessionColumns: TableColumn<AdminSession>[] = [
  { key: 'date', header: 'Date', exportValue: (s) => formatDate(s.session_date) },
  { key: 'start_time', header: 'Start Time', exportValue: (s) => formatTime(s.start_time) },
  { key: 'end_time', header: 'End Time', exportValue: (s) => formatTime(s.end_time) },
  // Export-only synthetic — raw minute count alongside humanized
  // string. Lets payroll spreadsheets sum directly while humans get
  // the readable "1h 30m" view.
  {
    key: 'duration_minutes',
    header: 'Duration (minutes)',
    exportValue: (s) => durationMinutes(s) ?? '',
  },
  {
    key: 'duration',
    header: 'Duration',
    exportValue: (s) => formatDuration(durationMinutes(s)),
  },
  {
    key: 'client',
    header: 'Client',
    exportValue: (s) => s.client_name ?? '',
  },
  {
    key: 'session_type',
    header: 'Type',
    exportValue: (s) => s.session_type ?? '',
  },
  { key: 'room', header: 'Room', exportValue: (s) => s.room ?? '' },
  { key: 'status', header: 'Status', exportValue: (s) => formatStatus(s.status) },
  {
    key: 'assigned_to',
    header: 'Assigned To',
    exportValue: (s) => s.assigned_to_name ?? '',
  },
  { key: 'notes', header: 'Notes', exportValue: (s) => s.notes ?? '' },
  {
    key: 'google_synced',
    header: 'Google Synced',
    exportValue: (s) => (s.google_event_id ? 'Yes' : 'No'),
  },
  {
    key: 'created_at',
    header: 'Created At',
    exportValue: (s) => formatDateTime(s.created_at),
  },
]
