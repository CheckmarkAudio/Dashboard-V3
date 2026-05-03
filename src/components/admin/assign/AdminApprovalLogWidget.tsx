import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Ban, Check, Edit2, Inbox, Loader2, Trash2, X } from 'lucide-react'
import {
  adminLogKeys,
  fetchRecentApprovals,
  type RecentApprovalRow,
} from '../../../lib/queries/adminLogs'

/**
 * AdminApprovalLogWidget — PR #45.
 *
 * Recent approval/decline history. Lives in col 1 of the Assign
 * page between Task Requests (top) and Edit (bottom). Per the user
 * spec: surfaces BOTH approvals and rejections, labelled by outcome
 * so admins can see at a glance what they processed.
 *
 * Each row: green ✓ approved or rose ✕ declined icon · title
 * (1-line truncated) · requester name "First L." · resolved-at
 * relative time. If the row is rejected with a reviewer note, the
 * note shows on a second line.
 */
export default function AdminApprovalLogWidget() {
  const query = useQuery({
    queryKey: adminLogKeys.recentApprovals(30),
    queryFn: () => fetchRecentApprovals(30),
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
          <p className="text-[13px] text-text">Nothing resolved yet.</p>
          <p className="text-[11px] mt-0.5">Approved + declined task requests show up here.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
          {rows.map((row) => (
            <ApprovalRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

function ApprovalRow({ row }: { row: RecentApprovalRow }) {
  const isApproved = row.status === 'approved'
  const isCancelled = row.status === 'cancelled'
  const isDeleteApproved = isApproved && row.kind === 'delete'
  const isEditApproved = isApproved && row.kind === 'edit'
  // Outcome-specific icon so the row reads at a glance:
  //   - approved create  → emerald check
  //   - approved delete  → rose Trash2 ("Deleted" tag)
  //   - approved edit    → orange Edit2 ("Edited" tag)
  //   - rejected (any)   → rose X
  //   - cancelled (any)  → muted Ban ("Cancelled" tag) — withdrawn by requester
  const Icon = isCancelled
    ? Ban
    : !isApproved
      ? X
      : isDeleteApproved
        ? Trash2
        : isEditApproved
          ? Edit2
          : Check
  const iconClass = isCancelled
    ? 'text-text-light/60 shrink-0'
    : !isApproved
      ? 'text-rose-400/80 shrink-0'
      : isDeleteApproved
        ? 'text-rose-400/90 shrink-0'
        : isEditApproved
          ? 'text-orange-300 shrink-0'
          : 'text-emerald-400/80 shrink-0'
  const initialed = formatRequesterName(row.requester_name)
  const when = formatRelative(row.resolved_at)
  const dimmedRow = isCancelled
  return (
    <div
      className={`px-2 py-1.5 rounded-lg hover:bg-white/[0.025] transition-colors ${
        dimmedRow ? 'opacity-70' : ''
      }`}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2">
        <Icon size={12} className={iconClass} aria-hidden="true" strokeWidth={3} />
        <p className="text-[12px] text-text truncate">
          {isDeleteApproved && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-rose-300 mr-1.5">
              Deleted
            </span>
          )}
          {isEditApproved && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-orange-300 mr-1.5">
              Edited
            </span>
          )}
          {isCancelled && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-light/70 mr-1.5">
              Cancelled
            </span>
          )}
          {row.title}
        </p>
        <span className="text-[11px] text-text-light whitespace-nowrap">{initialed}</span>
        <span className="text-[10px] text-text-light/70 whitespace-nowrap">{when}</span>
      </div>
      {!isApproved && !isCancelled && row.reviewer_note && (
        <p className="ml-5 mt-0.5 text-[11px] italic text-rose-300/70 line-clamp-2">
          “{row.reviewer_note}”
        </p>
      )}
    </div>
  )
}

function formatRequesterName(name: string | null): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!
  const first = parts[0]!
  const lastInitial = parts[parts.length - 1]![0] ?? ''
  return lastInitial ? `${first} ${lastInitial}` : first
}

// "now" / "5m" / "3h" / "2d" / "Apr 25"
function formatRelative(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const min = Math.round(diffMs / 60_000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d`
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
