import { Link } from 'react-router-dom'
import type { TableColumn } from '../../components/ui'
import type { AdminClockEntry } from '../queries/timeClock'

/**
 * Shared `TableColumn<AdminClockEntry>[]` for both the visible Shift
 * History table AND the CSV/PDF exports across every admin clock
 * surface — the main Members → Clock Data tab (`ClockDataSection`)
 * and the Members → Activity → Clock widget on the same page.
 *
 * Both surfaces drive their `<thead>` / `<td>` AND their
 * `<ExportButtons>` from this one array, so renaming a header,
 * changing a cell transformation, or adding a column updates BOTH
 * surfaces (and the CSV/PDF too) in lockstep — no parallel arrays to
 * drift.
 *
 * Two helper transforms are baked in alongside the descriptors:
 *
 *   - `formatDateTime()`: "May 17, 11:45 PM" — short, human-readable.
 *     Used by Clock In / Clock Out cells + exports.
 *   - `formatDuration()`: humanized "Xh Ym". Visible table shows only
 *     this; the export also surfaces the raw minute count alongside
 *     so payroll spreadsheets can sum directly.
 *   - `parseClockNotes()`: regex-extracts the "Went well: …" and
 *     "To improve: …" halves of the flat `notes` column written by
 *     `SelfReportModal`. Read-only at render/export time; zero schema
 *     migration. Legacy/unformatted notes fall back into the Went
 *     Well column so historical data stays visible.
 */

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (remainder === 0) return `${hours}h`
  return `${hours}h ${remainder}m`
}

/**
 * Pull the "Went Well" + "To Improve" halves out of the flat `notes`
 * string. SelfReportModal (clock-out flow) collects two reflection
 * fields and flattens them into one notes string for storage:
 *
 *   "Went well: <text>\n\nTo improve: <text>"   (both filled)
 *   "Went well: <text>"                         (only wentWell)
 *   "To improve: <text>"                        (only toImprove)
 *
 * Fallback: legacy/unformatted notes with neither marker get dropped
 * into the Went Well column whole rather than being hidden, so
 * historical data stays visible in both surfaces.
 */
export function parseClockNotes(notes: string | null): { wentWell: string; toImprove: string } {
  if (!notes) return { wentWell: '', toImprove: '' }
  const trimmed = notes.trim()
  if (!trimmed) return { wentWell: '', toImprove: '' }

  const wentMatch = trimmed.match(/(?:^|\n)Went well:\s*([\s\S]*?)(?=\n\nTo improve:|$)/)
  const improveMatch = trimmed.match(/(?:^|\n)To improve:\s*([\s\S]*?)$/)

  const wentWell = (wentMatch?.[1] ?? '').trim()
  const toImprove = (improveMatch?.[1] ?? '').trim()

  if (!wentWell && !toImprove) {
    return { wentWell: trimmed, toImprove: '' }
  }

  return { wentWell, toImprove }
}

export const clockColumns: TableColumn<AdminClockEntry>[] = [
  {
    key: 'member',
    header: 'Member',
    render: (entry) => (
      <Link
        to={`/profile/${entry.member_id}`}
        className="text-text hover:text-gold transition-colors"
      >
        {entry.member_name}
      </Link>
    ),
    exportValue: (e) => e.member_name,
  },
  {
    key: 'clock_in',
    header: 'Clock In',
    render: (entry) => (
      <span className="text-[12px] text-text-muted tabular-nums whitespace-nowrap">
        {formatDateTime(entry.clocked_in_at)}
      </span>
    ),
    exportValue: (e) => formatDateTime(e.clocked_in_at),
  },
  {
    key: 'clock_out',
    header: 'Clock Out',
    render: (entry) => {
      const isOpen = entry.clocked_out_at === null
      return (
        <span className="text-[12px] tabular-nums whitespace-nowrap">
          {isOpen ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              On shift
            </span>
          ) : (
            <span className="text-text-muted">{formatDateTime(entry.clocked_out_at!)}</span>
          )}
        </span>
      )
    },
    exportValue: (e) => (e.clocked_out_at === null ? 'On shift' : formatDateTime(e.clocked_out_at)),
  },
  // Export-only — visible table shows only humanized Duration (next
  // column); export includes the raw minute count alongside so
  // payroll spreadsheets can sum directly.
  {
    key: 'duration_minutes',
    header: 'Duration (minutes)',
    exportValue: (e) => e.duration_minutes ?? '',
  },
  {
    key: 'duration',
    header: 'Duration',
    render: (entry) => (
      <span className="text-[12px] tabular-nums text-text-muted whitespace-nowrap">
        {formatDuration(entry.duration_minutes)}
      </span>
    ),
    exportValue: (e) => formatDuration(e.duration_minutes),
  },
  {
    key: 'went_well',
    header: 'Went Well',
    render: (entry) => (
      <span className="text-[12px] text-text-light max-w-[220px] inline-block">
        <span className="line-clamp-2">{parseClockNotes(entry.notes).wentWell}</span>
      </span>
    ),
    exportValue: (e) => parseClockNotes(e.notes).wentWell,
  },
  {
    key: 'to_improve',
    header: 'To Improve',
    render: (entry) => (
      <span className="text-[12px] text-text-light max-w-[220px] inline-block">
        <span className="line-clamp-2">{parseClockNotes(entry.notes).toImprove}</span>
      </span>
    ),
    exportValue: (e) => parseClockNotes(e.notes).toImprove,
  },
]
