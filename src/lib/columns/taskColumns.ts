import type { TableColumn } from '../../components/ui'
import type { AssignedTask } from '../../types/assignments'

/**
 * Shared `TableColumn<AssignedTask>[]` for CSV/PDF exports across
 * every admin task surface — Members > Per-member tasks, Studio Tasks
 * pane, and eventually the Tasks history / analytics surfaces.
 *
 * These are EXPORT-ONLY descriptors today: every entry has an
 * `exportValue` but no `render`. The visible task surfaces use rich
 * custom row components (`TaskRow`, `StudioTaskRow`) rather than a
 * basic `<table>`, so the export columns and the visible rows
 * intentionally have different shapes. The descriptors still live in
 * one place so:
 *   1. New task surfaces (BusinessHealth analytics, etc.) can reuse
 *      the exact same export schema without re-inventing it.
 *   2. If a header rename or a new column is needed, it happens in
 *      ONE file and propagates to every surface using
 *      `toExportColumns(taskExportColumns)`.
 *   3. When/if a structured `<table>` view of tasks is added in the
 *      future, each descriptor just gets a `render` function and the
 *      same array drives both surfaces (the canonical drift-proof
 *      pattern from `TableColumn<T>`).
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

export const taskExportColumns: TableColumn<AssignedTask>[] = [
  { key: 'title', header: 'Title', exportValue: (t) => t.title },
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
  { key: 'due_date', header: 'Due Date', exportValue: (t) => formatDate(t.due_date) },
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
  {
    key: 'recurrence',
    header: 'Recurrence',
    exportValue: (t) => formatRecurrence(t.recurrence_spec),
  },
]
