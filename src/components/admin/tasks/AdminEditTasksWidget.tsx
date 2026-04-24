import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Pencil } from 'lucide-react'
import { adminTaskKeys, fetchAllAssignedTasks } from '../../../lib/queries/adminTasks'
import AdminEditTasksModal from './AdminEditTasksModal'

/**
 * AdminEditTasksWidget — PR #40.
 *
 * Placed under the Assign widget on /admin/templates. Shows a count of
 * in-flight tasks + a button to open the full Edit Tasks modal. The
 * modal lists every team task with click-to-edit rows (title,
 * description, stage, due date). Edits fire `admin_update_assigned_task`
 * and the assignee gets a `task_edited` notification.
 */
export default function AdminEditTasksWidget() {
  const [open, setOpen] = useState(false)
  // Fetch just the count on widget body; modal does its own fetch
  // with includeCompleted controls.
  const countQuery = useQuery({
    queryKey: adminTaskKeys.list(false),
    queryFn: () => fetchAllAssignedTasks({ includeCompleted: false }),
    // Widget is only rendered on the Assign page — no need for
    // aggressive refetch. Modal will refetch on open anyway.
    staleTime: 30_000,
  })
  const openCount = countQuery.data?.length ?? 0

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-start justify-center gap-3 px-2">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-gold/70 uppercase">
            In flight
          </p>
          <p className="mt-1 text-[36px] leading-none font-light tracking-[-0.03em] text-text tabular-nums">
            {countQuery.isLoading ? '–' : openCount}
          </p>
          <p className="mt-1 text-[12px] text-text-muted">
            {openCount === 1 ? 'open task across the team' : 'open tasks across the team'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold bg-gradient-to-b from-gold to-gold-muted text-black hover:brightness-105 transition-all shadow-[0_6px_14px_rgba(214,170,55,0.25)]"
        >
          <Pencil size={14} strokeWidth={2.5} />
          Edit Tasks
          <ArrowRight size={14} strokeWidth={2.5} />
        </button>
      </div>

      {open && <AdminEditTasksModal onClose={() => setOpen(false)} />}
    </div>
  )
}
