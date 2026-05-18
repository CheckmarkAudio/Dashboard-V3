import type { TableColumn } from '../../components/ui'
import type { RecentSessionInfo } from '../queries/memberProfile'

/**
 * Shared `TableColumn<RecentSessionInfo>[]` for CSV/PDF exports from
 * the Session History widget on the Members → Activity page (and any
 * future session-list surface that wants the same schema).
 *
 * Today every descriptor is export-only — the widget body uses a
 * rich `CanonicalRow` layout (colored circle icon + bold title +
 * muted meta + right-side date pill), not a basic `<table>`. The
 * descriptors still live in one shared module so:
 *   1. Future session-list surfaces (e.g. a full `/admin/sessions`
 *      table when that page is scoped) reuse the same export schema.
 *   2. If a header rename or a new column is needed, it happens in
 *      ONE file and propagates to every surface using
 *      `toExportColumns(sessionColumns)`.
 *   3. When a structured `<table>` view of sessions lands, each
 *      descriptor just gets a `render` function and the same array
 *      drives both surfaces.
 *
 * Note: `RecentSessionInfo` is the narrow shape returned by
 * `useMemberAdminSessions` (memberProfile.ts). A future surface that
 * needs to export richer session fields (client_name, session_type,
 * etc.) would build a separate `fullSessionColumns` over the full
 * `sessions` table shape — the two shouldn't be conflated.
 */

function formatDateLong(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatStatus(status: string | null): string {
  if (!status) return ''
  // Title-case the raw status enum values (`confirmed`, `scheduled`,
  // `cancelled`, `in_progress`) so the CSV/PDF is human-readable.
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export const sessionColumns: TableColumn<RecentSessionInfo>[] = [
  { key: 'date', header: 'Date', exportValue: (s) => formatDateLong(s.sessionDate) },
  { key: 'start_time', header: 'Start Time', exportValue: (s) => s.startTime ?? '' },
  { key: 'title', header: 'Title', exportValue: (s) => s.title },
  { key: 'room', header: 'Room', exportValue: (s) => s.room ?? '' },
  { key: 'status', header: 'Status', exportValue: (s) => formatStatus(s.status) },
]
