import type { TableColumn } from '../../components/ui'
import type { RecentTaskInfo } from '../queries/memberProfile'

/**
 * Shared `TableColumn<RecentTaskInfo>[]` for CSV/PDF exports from the
 * Task Completion widget on the Members → Activity page.
 *
 * Distinct from `taskExportColumns` (in `taskColumns.tsx`) because
 * `RecentTaskInfo` is a deliberately narrow shape returned by
 * `useMemberAdminCompletedTasks` (just `taskId`, `title`,
 * `completedAt`, `relativeLabel`) — not the full `AssignedTask` the
 * other admin task surfaces export. Conflating the two would force
 * every member-activity task export to either include unused
 * fields (empty columns) or carry custom skips.
 *
 * If a future Tasks rollup surface wants to export the FULL task
 * shape with assignee, scope, recurrence, etc., it should consume
 * `taskExportColumns` instead.
 */

function formatDateTime(iso: string): string {
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

export const memberTaskCompletionColumns: TableColumn<RecentTaskInfo>[] = [
  { key: 'title', header: 'Title', exportValue: (t) => t.title },
  { key: 'completed_at', header: 'Completed At', exportValue: (t) => formatDateTime(t.completedAt) },
  { key: 'completed_relative', header: 'Completed (relative)', exportValue: (t) => t.relativeLabel },
]
