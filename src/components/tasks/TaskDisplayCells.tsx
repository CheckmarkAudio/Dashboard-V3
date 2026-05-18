import { Fragment } from 'react'
import { visibleColumns } from '../ui'
import { taskExportColumns } from '../../lib/columns/taskColumns'
import type { AssignedTask } from '../../types/assignments'

/**
 * Render the display cells for a single task — the visible-row half
 * of the shared `taskExportColumns` array.
 *
 * One small component used inside `TaskRow` (AssignAdmin) and
 * `StudioTaskRow` (StudioTasksPane). The interactive controls
 * (completion checkbox, edit / delete buttons, confirm-delete pill)
 * STAY hardcoded in their respective row components — those carry
 * row-level state (selectMode, isSelected, confirmDelete, mutations)
 * that doesn't belong in the descriptor pattern.
 *
 * This split is the "narrow descriptor + fat interactive shell"
 * pattern: descriptors own data display + export; row components own
 * interaction. Renaming a header or restyling a cell ripples to
 * BOTH visible rows AND the CSV/PDF; tweaking a checkbox handler
 * stays a local row-component concern.
 *
 * Renders are skipped when the descriptor's `render` returns null
 * so cells with no data (e.g. tasks with no due_date or no
 * recurrence_spec) collapse rather than producing empty pill chrome.
 */
export function TaskDisplayCells({ task }: { task: AssignedTask }) {
  return (
    <>
      {visibleColumns(taskExportColumns).map((col) => {
        const node = col.render!(task)
        if (node === null || node === undefined || node === false) return null
        return <Fragment key={col.key}>{node}</Fragment>
      })}
    </>
  )
}
