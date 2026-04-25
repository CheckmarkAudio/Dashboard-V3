import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Calendar as CalendarIcon, CheckSquare, Inbox, Loader2 } from 'lucide-react'
import {
  adminLogKeys,
  fetchRecentAssignments,
  type RecentAssignmentRow,
} from '../../../lib/queries/adminLogs'

/**
 * AdminAssignLogWidget — PR #44.
 *
 * Recent activity feed: who got assigned what, when. Per the user
 * sketch each row is 3 columns:
 *   - title (truncated to one line)
 *   - assignee as "First L." (e.g. "Bridget R")
 *   - target date as "Today" or "Apr 25"
 *
 * Lives in col 2 of the Assign page, right under the Assign widget.
 * Interleaves tasks + sessions by recency (driven server-side via
 * `admin_recent_assignments`).
 */
export default function AdminAssignLogWidget() {
  const query = useQuery({
    queryKey: adminLogKeys.recentAssignments(30),
    queryFn: () => fetchRecentAssignments(30),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const rows = query.data ?? []

  return (
    <div className="flex flex-col h-full min-h-0">
      {query.isLoading ? (
        <div className="flex-1 flex items-center justify-center text-text-muted py-6">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : query.error ? (
        <div className="flex items-start gap-2 text-[12px] text-amber-300 px-1 py-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{(query.error as Error).message}</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6 text-text-light">
          <Inbox size={18} className="mb-2" aria-hidden="true" />
          <p className="text-[13px] text-text">No recent assignments.</p>
          <p className="text-[11px] mt-0.5">Tasks and bookings will surface here as you send them.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
          {rows.map((row) => (
            <LogRow key={`${row.kind}-${row.ref_id}-${row.assignee_id}`} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

function LogRow({ row }: { row: RecentAssignmentRow }) {
  const Icon = row.kind === 'task' ? CheckSquare : CalendarIcon
  const initialed = formatAssigneeName(row.assignee_name)
  const due = formatTargetDate(row.target_date)
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.025] transition-colors">
      <Icon
        size={12}
        className={row.kind === 'task' ? 'text-gold/60 shrink-0' : 'text-cyan-400/70 shrink-0'}
        aria-hidden="true"
      />
      <p className="text-[12px] text-text truncate">{row.title}</p>
      <span className="text-[11px] text-text-light whitespace-nowrap tabular-nums">
        {initialed}
      </span>
      <span
        className={`text-[11px] tabular-nums whitespace-nowrap ${
          due ? 'text-text-light' : 'text-text-light/30'
        }`}
      >
        {due ?? '—'}
      </span>
    </div>
  )
}

// "Bridget Reinhard" → "Bridget R". Strips middle names; falls back
// to the raw name if it can't split.
function formatAssigneeName(name: string | null): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!
  const first = parts[0]!
  const lastInitial = parts[parts.length - 1]![0] ?? ''
  return lastInitial ? `${first} ${lastInitial}` : first
}

// "Today" if same day; otherwise "Mon DD" short format.
function formatTargetDate(date: string | null): string | null {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  if (isToday) return 'Today'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
