import type { ReactNode } from 'react'
import type { ExportColumn } from './ExportButtons'

/**
 * TableColumn — single source of truth for an admin-table column.
 *
 * The visible `<thead>` / `<td>` AND the `<ExportButtons>` array are
 * both derived from the same `TableColumn<T>[]` so that renaming a
 * header, adding a column, or changing a cell's transformation
 * updates BOTH the on-screen table AND the CSV/PDF download in
 * lockstep. No more parallel arrays drifting apart over time.
 *
 * Three column shapes are supported:
 *
 *   1. **Both surfaces** — declare `header` + `render` + `exportValue`.
 *      The visible cell renders the JSX; the CSV/PDF gets the plain
 *      value under the same header text. (Job Title, Status, etc.)
 *
 *   2. **Visible only** — declare `header` + `render` and OMIT
 *      `exportValue`. The column appears in the table but is skipped
 *      by exports. Used for combined cells (e.g. avatar+name+email)
 *      and chrome-only columns (e.g. the 3-dot Actions menu).
 *
 *   3. **Export only** — declare `header` + `exportValue` and OMIT
 *      `render`. The column appears in the CSV/PDF but not in the
 *      visible table. Used when the visible table collapses several
 *      fields into one cell but the export wants them broken apart
 *      (e.g. Name + Email + Phone as three CSV columns even though
 *      the table shows them in a single Member cell).
 *
 * The `key` is a stable identifier used for React reconciliation —
 * keep it unique per page.
 */
export type TableColumn<T> = {
  /** Stable React key per column. */
  key: string
  /** Column label. Used as `<th>` text AND as the CSV/PDF header. */
  header: string
  /** Visible cell JSX. Omit for export-only columns. */
  render?: (row: T) => ReactNode
  /** CSV/PDF cell value. Omit for visible-only columns. */
  exportValue?: (row: T) => string | number | boolean | null | undefined
  /** Optional extra className for the `<th>` (e.g. `sr-only` for Actions). */
  thClassName?: string
  /** Optional extra className for the `<td>`. */
  tdClassName?: string
  /** Optional preferred PDF column width in mm. */
  pdfWidth?: number
}

/**
 * Filter a TableColumn[] down to the columns that should appear in
 * the visible table (have a `render`). Use this when iterating
 * `<thead>` / `<td>` cells.
 */
export function visibleColumns<T>(columns: TableColumn<T>[]): TableColumn<T>[] {
  return columns.filter((c): c is TableColumn<T> & { render: NonNullable<TableColumn<T>['render']> } => Boolean(c.render))
}

/**
 * Derive the `ExportColumn<T>[]` array consumed by `<ExportButtons>`
 * from a `TableColumn<T>[]`. Skips visible-only columns. Preserves
 * declaration order so the CSV columns appear in the same order they
 * sit in the source array.
 *
 *   <ExportButtons columns={toExportColumns(memberColumns)} rows={filtered} />
 */
export function toExportColumns<T>(columns: TableColumn<T>[]): ExportColumn<T>[] {
  return columns
    .filter((c): c is TableColumn<T> & { exportValue: NonNullable<TableColumn<T>['exportValue']> } => c.exportValue !== undefined)
    .map((c) => ({
      header: c.header,
      value: c.exportValue,
      pdfWidth: c.pdfWidth,
    }))
}
