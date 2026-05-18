import { Calendar as CalendarIcon, Repeat } from 'lucide-react'
import type { TableColumn } from '../../components/ui'
import type { AssignedTask } from '../../types/assignments'

/**
 * Shared `TableColumn<AssignedTask>[]` for BOTH CSV/PDF exports AND
 * the visible task-row display cells across every admin task
 * surface — AssignAdmin per-member task pane (`TaskRow`),
 * StudioTasksPane (`StudioTaskRow`), and the BusinessHealth all-team
 * task history export.
 *
 * Each descriptor is one of three shapes:
 *
 *   - **Both surfaces** (`render` + `exportValue`): the cell appears
 *     in the visible task row AND in the CSV/PDF. Rename the header,
 *     change the formatting, or restyle the visible cell — both
 *     surfaces update in lockstep. Used for `title`, `due_date`, and
 *     `recurrence`, which are the three cells that actually show up
 *     in `TaskRow` / `StudioTaskRow` today.
 *
 *   - **Export only** (`exportValue` only): the field appears in the
 *     CSV/PDF but not in the visible row. Used for fields the rich
 *     interactive row doesn't display today (description, scope,
 *     studio_space when in the per-member context, completed_at,
 *     created_at, source, category) but that admins still want in
 *     offline spreadsheets.
 *
 *   - **Visible only** (`render` only): a cell that shows in the row
 *     but doesn't need to be in the CSV. None today, but the type
 *     allows it for future things like an inline "open detail"
 *     affordance.
 *
 * Interactive controls (completion checkbox, edit/delete buttons,
 * confirm-delete pill) intentionally stay HARDCODED inside their
 * respective row components — they're UI controls with row-level
 * state (selectMode, isSelected, confirmDelete, mutation callbacks),
 * not data display. Trying to push those into descriptors would make
 * the descriptor type carry mountains of context. The split:
 * descriptors own display + export; row components own interaction.
 *
 * Column choices favor downstream usability — separate raw ISO
 * timestamps for spreadsheet sorting alongside human-readable date
 * strings; explicit Yes/No for booleans; pretty labels for enum-like
 * fields.
 */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
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

function formatScope(scope: AssignedTask['scope']): string {
  return scope === 'studio' ? 'Studio' : 'Member'
}

function formatSource(source: AssignedTask['source_type']): string {
  switch (source) {
    case 'custom':
      return 'Custom'
    case 'template_full':
      return 'Template (full)'
    case 'template_partial':
      return 'Template (partial)'
    case 'daily_checklist':
      return 'Daily checklist'
    default:
      return source
  }
}

function formatRecurrence(spec: AssignedTask['recurrence_spec']): string {
  if (!spec) return ''
  const interval = spec.interval ?? 1
  if (interval === 1) return spec.frequency
  return `every ${interval} ${spec.frequency}`
}

// Short due-date formatter used by the visible row pill (e.g. "May
// 17"). CSV uses the longer `formatDate()` above ("May 17, 2026") so
// spreadsheets that span years stay unambiguous.
function formatDueShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const taskExportColumns: TableColumn<AssignedTask>[] = [
  {
    key: 'title',
    header: 'Title',
    // Visible cell — matches the prior inline JSX in TaskRow +
    // StudioTaskRow exactly. flex-1 makes it fill remaining row
    // width; truncate keeps long titles from breaking layout;
    // line-through styling on completed tasks is the single source
    // of truth for "this is done" visual semantics now.
    render: (t) => (
      <span
        className={`flex-1 min-w-0 text-[13px] truncate ${
          t.is_completed ? 'line-through text-text-light' : 'text-text'
        }`}
      >
        {t.title}
      </span>
    ),
    exportValue: (t) => t.title,
  },
  { key: 'description', header: 'Description', exportValue: (t) => t.description ?? '' },
  { key: 'scope', header: 'Scope', exportValue: (t) => formatScope(t.scope) },
  {
    key: 'studio_space',
    header: 'Studio Space',
    exportValue: (t) => t.studio_space ?? '',
  },
  {
    key: 'assigned_to',
    header: 'Assigned To',
    exportValue: (t) => t.assigned_to_name ?? '',
  },
  { key: 'category', header: 'Category', exportValue: (t) => t.category ?? '' },
  {
    key: 'recurrence',
    header: 'Recurrence',
    // Visible recurrence pill — only rendered when the task has a
    // recurrence_spec. StudioTaskRow showed this previously; TaskRow
    // didn't but will now (acceptable — surfaces the same data the
    // CSV already has, no UX regression).
    render: (t) =>
      t.recurrence_spec ? (
        <span className="text-[10px] text-gold/80 shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gold/10 ring-1 ring-gold/25 font-semibold uppercase tracking-wider">
          <Repeat size={10} aria-hidden="true" />
          {t.recurrence_spec.frequency}
        </span>
      ) : null,
    exportValue: (t) => formatRecurrence(t.recurrence_spec),
  },
  {
    key: 'due_date',
    header: 'Due Date',
    // Visible due-date pill — small, tabular nums, calendar icon.
    // Returns null when no due_date is set so the cell collapses
    // instead of rendering an empty pill (TaskDisplayCells skips
    // null renders to keep layout tight).
    render: (t) =>
      t.due_date ? (
        <span className="text-[10px] text-text-light tabular-nums shrink-0 inline-flex items-center gap-1">
          <CalendarIcon size={10} aria-hidden="true" />
          {formatDueShort(t.due_date)}
        </span>
      ) : null,
    exportValue: (t) => formatDate(t.due_date),
  },
  {
    key: 'required',
    header: 'Required',
    exportValue: (t) => (t.is_required ? 'Yes' : 'No'),
  },
  {
    key: 'completed',
    header: 'Completed',
    exportValue: (t) => (t.is_completed ? 'Yes' : 'No'),
  },
  {
    key: 'completed_at',
    header: 'Completed At',
    exportValue: (t) => formatDateTime(t.completed_at),
  },
  {
    key: 'created_at',
    header: 'Created At',
    exportValue: (t) => formatDateTime(t.created_at),
  },
  { key: 'source', header: 'Source', exportValue: (t) => formatSource(t.source_type) },
]
