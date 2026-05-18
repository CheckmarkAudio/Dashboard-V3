import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Loader2, Inbox } from 'lucide-react'
import { fetchAdminClockEntries, timeClockKeys } from '../../lib/queries/timeClock'
import { Select, ExportButtons, toExportColumns, visibleColumns } from '../ui'
import { clockColumns } from '../../lib/columns/clockColumns'
import type { TeamMember } from '../../types'

const ALL_MEMBERS = '__all__' as const
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
