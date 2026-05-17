import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, Loader2, Inbox } from 'lucide-react'
import { fetchAdminClockEntries, timeClockKeys, type AdminClockEntry } from '../../lib/queries/timeClock'
import {
  Select,
  ExportButtons,
  toExportColumns,
  visibleColumns,
  type TableColumn,
} from '../ui'
import type { TeamMember } from '../../types'

const ALL_MEMBERS = '__all__' as const

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (remainder === 0) return `${hours}h`
  return `${hours}h ${remainder}m`
}

// ─── Shift history columns — single source of truth ─────────────
//
// Same pattern as the Members roster: one `TableColumn<T>[]` powers
// BOTH the visible `<thead>` / `<td>` AND the CSV/PDF export, so a
// header rename or a value-format change flows to both surfaces in
// lockstep — no parallel arrays to keep in sync.
//
// The Duration column is split: the visible cell shows the humanized
// "Xh Ym" string; the CSV/PDF includes both the raw minute count
// (single source of truth for payroll formulas) AND the humanized
// string (so spreadsheets stay readable for non-technical reviewers).
const clockColumns: TableColumn<AdminClockEntry>[] = [
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
    key: 'Clock_in',
    header: 'Clock In',
    render: (entry) => (
      <span className="text-[12px] text-text-muted tabular-nums whitespace-nowrap">
        {formatDateTime(entry.clocked_in_at)}
      </span>
    ),
    exportValue: (e) => formatDateTime(e.clocked_in_at),
  },
  {
    key: 'Clock_Out',
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
  // Export-only — the visible table shows only the humanized form
  // (next column), but exports include the raw minute count so
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
    key: 'notes',
    header: 'Notes',
    render: (entry) => (
      <span className="text-[12px] text-text-light max-w-[280px] inline-block">
        <span className="line-clamp-2">{entry.notes ?? ''}</span>
      </span>
    ),
    exportValue: (e) => e.notes ?? '',
  },
]
const clockVisibleColumns = visibleColumns(clockColumns)

export default function ClockDataSection({ members }: { members: TeamMember[] }) {
  const [memberFilter, setMemberFilter] = useState<string>(ALL_MEMBERS)

  const memberId = memberFilter === ALL_MEMBERS ? null : memberFilter

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: timeClockKeys.adminEntries(memberId),
    queryFn: () => fetchAdminClockEntries(memberId, 200),
    staleTime: 30_000,
  })

  const memberOptions = useMemo(
    () =>
      [...members]
        .filter((m) => m.display_name)
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [members],
  )

  // ExportButtons columns are DERIVED from the same `clockColumns`
  // array that powers the visible table above. Rename a header in
  // `clockColumns` → both surfaces update in lockstep, no parallel
  // arrays to keep in sync. The export reflects the active member
  // filter (`entries` is already filter-scoped by `memberId` in the
  // query key).
  const filteredMemberName =
    memberId === null
      ? null
      : (memberOptions.find((m) => m.id === memberId)?.display_name ?? null)
  const exportFilename = filteredMemberName
    ? `shift-history-${filteredMemberName}`
    : 'shift-history'
  const exportTitle = filteredMemberName
    ? `Shift History — ${filteredMemberName}`
    : 'Shift History — All members'

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Clock size={18} className="text-gold" aria-hidden="true" />
            Shift history
          </h2>
          <p className="text-text-muted text-[12px] mt-0.5">
            Most recent {entries.length} {entries.length === 1 ? 'shift' : 'shifts'} for the team. Open shifts show as
            <span className="mx-1 inline-flex items-center gap-1 text-emerald-300 font-semibold">on shift</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="min-w-[200px]">
            <Select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              aria-label="Filter shifts by member"
            >
              <option value={ALL_MEMBERS}>All members</option>
              {memberOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.display_name}</option>
              ))}
            </Select>
          </div>
          <ExportButtons
            filename={exportFilename}
            title={exportTitle}
            columns={toExportColumns(clockColumns)}
            rows={entries}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-300">
          Failed to load shifts. {error instanceof Error ? error.message : ''}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-muted">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox size={28} className="text-text-light mb-2" aria-hidden="true" />
          <p className="text-[13px] text-text-muted">No shifts recorded yet.</p>
          <p className="text-[12px] text-text-light mt-1">
            Members clock in and out from the header button — shifts will appear here once they do.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-surface-alt text-[10px] uppercase tracking-wider text-text-muted">
              <tr>
                {clockVisibleColumns.map((col) => (
                  <th key={col.key} className={`py-2 px-3 font-semibold ${col.thClassName ?? ''}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.entry_id}
                  className="border-t border-border hover:bg-surface-hover transition-colors"
                >
                  {clockVisibleColumns.map((col) => (
                    <td key={col.key} className={`py-2 px-3 text-[13px] ${col.tdClassName ?? ''}`}>
                      {col.render!(entry)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
