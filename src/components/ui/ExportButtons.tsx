import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'

/**
 * ExportButtons — reusable CSV + PDF download pair.
 *
 * One component for every admin-table export surface (Members, Clock
 * Data, Sessions, Tasks, …). Pages declare a `columns` mapping over
 * their row type and pass the rows in; the component handles CSV
 * serialization in-process and lazy-loads jsPDF only when the user
 * actually clicks Export PDF (keeps the heavy PDF lib out of the
 * initial bundle).
 *
 * Visual chrome matches the canonical Button primitive — small ghost
 * buttons that sit at the top-right of admin tables, with a unified
 * `Export ▾` segmented look (CSV on the left, PDF on the right).
 *
 * Accessibility:
 * - Each button has an aria-label that includes the row count.
 * - Disabled state ships a tooltip explaining why (zero rows).
 * - Spinner state replaces the icon and disables the button while a
 *   download is in-flight.
 *
 * Performance:
 * - CSV path is synchronous + dependency-free.
 * - PDF path lazy-imports `jspdf` + `jspdf-autotable` on click, so
 *   the ~150KB bundle is paid only by admins who actually export.
 *
 * Security:
 * - All values are coerced to strings client-side before being
 *   written into Blobs. No HTML / script injection surface.
 * - Filenames are sanitized to a whitelist of [a-z0-9-_] before
 *   being handed to `URL.createObjectURL` + the anchor download.
 */

export type ExportCellValue = string | number | boolean | null | undefined

export type ExportColumn<T> = {
  /** Column header shown in both CSV row 1 and the PDF table head. */
  header: string
  /** Per-row cell value. Booleans render as "Yes" / "No". Null/undefined → empty. */
  value: (row: T) => ExportCellValue
  /** Optional preferred PDF column width in mm. Auto if omitted. */
  pdfWidth?: number
}

export interface ExportButtonsProps<T> {
  /** Base filename without extension, e.g. "members" → "members-2026-05-15.csv". */
  filename: string
  /** Column mapping over the row type. */
  columns: ExportColumn<T>[]
  /** Source rows. */
  rows: T[]
  /** PDF document title. Defaults to a humanized filename. */
  title?: string
  /** Subtitle beneath the PDF title. Defaults to "Generated <date> — N records". */
  pdfSubtitle?: string
  /** Restrict to a single format. Default: ['csv', 'pdf']. */
  formats?: Array<'csv' | 'pdf'>
  /** Disable both buttons (e.g. while data is loading). */
  disabled?: boolean
  /** Optional className for the wrapper (alignment overrides etc.). */
  className?: string
}

// ─── helpers ────────────────────────────────────────────────────────

function coerce(value: ExportCellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

// RFC 4180 CSV serialization. Wraps fields containing comma, quote,
// or newline in double quotes; doubles up any embedded quotes; uses
// CRLF line endings so Excel + Sheets both parse cleanly.
function toCsv<T>(columns: ExportColumn<T>[], rows: T[]): string {
  const escape = (raw: string) => {
    if (/[",\r\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
    return raw
  }
  const headerLine = columns.map((c) => escape(c.header)).join(',')
  const bodyLines = rows.map((row) =>
    columns.map((c) => escape(coerce(c.value(row)))).join(','),
  )
  return [headerLine, ...bodyLines].join('\r\n')
}

// Whitelist to avoid odd filenames (e.g. user-supplied dates with
// slashes). Final filename is `<sanitized>-<yyyy-mm-dd>.<ext>`.
function safeFilename(base: string): string {
  return base.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'export'
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function humanize(filename: string): string {
  return filename
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// ─── component ──────────────────────────────────────────────────────

export default function ExportButtons<T>({
  filename,
  columns,
  rows,
  title,
  pdfSubtitle,
  formats = ['csv', 'pdf'],
  disabled = false,
  className,
}: ExportButtonsProps<T>) {
  const [pdfBusy, setPdfBusy] = useState(false)
  const isEmpty = rows.length === 0
  const isDisabled = disabled || isEmpty
  const reasonDisabled = isEmpty ? 'No rows to export yet' : undefined

  const handleCsv = () => {
    if (isDisabled) return
    // BOM prefix so Excel auto-detects UTF-8 instead of mojibake.
    const csv = '﻿' + toCsv(columns, rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    triggerDownload(blob, `${safeFilename(filename)}-${todayIso()}.csv`)
  }

  const handlePdf = async () => {
    if (isDisabled || pdfBusy) return
    setPdfBusy(true)
    try {
      // Lazy-import keeps jsPDF + autotable out of the initial bundle.
      // Admins who never click Export PDF never pay the ~150KB cost.
      const [{ default: jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const autoTable = autoTableModule.default
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
      const docTitle = title ?? humanize(filename)
      const subtitle =
        pdfSubtitle ?? `Generated ${todayIso()} — ${rows.length} ${rows.length === 1 ? 'record' : 'records'}`

      // Title + subtitle band — gold underline matches the dashboard's
      // brand chrome without depending on the live theme tokens (PDF
      // renders standalone, so colors are hardcoded to the canonical
      // brand-gold + neutral palette).
      doc.setFontSize(16)
      doc.setTextColor(17)
      doc.text(docTitle, 14, 16)
      doc.setFontSize(10)
      doc.setTextColor(110)
      doc.text(subtitle, 14, 22)
      doc.setDrawColor(232, 191, 79)
      doc.setLineWidth(0.6)
      doc.line(14, 25, 270, 25)

      autoTable(doc, {
        head: [columns.map((c) => c.header)],
        body: rows.map((row) => columns.map((c) => coerce(c.value(row)))),
        startY: 30,
        styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' },
        headStyles: { fillColor: [232, 191, 79], textColor: 17, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: Object.fromEntries(
          columns
            .map((c, i) => (c.pdfWidth ? [i, { cellWidth: c.pdfWidth }] : null))
            .filter((entry): entry is [number, { cellWidth: number }] => entry !== null),
        ),
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages()
          const pageNumber = data.pageNumber
          doc.setFontSize(8)
          doc.setTextColor(140)
          doc.text(
            `${safeFilename(filename)} · Page ${pageNumber} of ${pageCount}`,
            14,
            doc.internal.pageSize.getHeight() - 8,
          )
        },
      })

      doc.save(`${safeFilename(filename)}-${todayIso()}.pdf`)
    } catch (err) {
      // Surface the failure to the console — admin pages don't have a
      // shared toast context here, and a hard throw would lose the
      // user's place. Caller pages can hoist toast via try/catch on a
      // future onError callback if needed.
      console.error('[ExportButtons] PDF export failed', err)
      window.alert(
        err instanceof Error
          ? `Could not generate PDF — ${err.message}`
          : 'Could not generate PDF.',
      )
    } finally {
      setPdfBusy(false)
    }
  }

  const baseBtn =
    'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors focus-ring whitespace-nowrap'
  const enabledBtn =
    'bg-surface-alt text-text border border-border hover:bg-surface-hover hover:border-gold/40'
  const disabledBtn = 'bg-surface-alt/40 text-text-light/60 border border-border/40 cursor-not-allowed'

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className ?? ''}`}
      role="group"
      aria-label="Export table data"
    >
      {formats.includes('csv') && (
        <button
          type="button"
          onClick={handleCsv}
          disabled={isDisabled}
          title={reasonDisabled ?? `Download ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} as CSV`}
          aria-label={`Export ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} as CSV`}
          className={`${baseBtn} ${isDisabled ? disabledBtn : enabledBtn}`}
        >
          <FileSpreadsheet size={13} aria-hidden="true" />
          CSV
        </button>
      )}
      {formats.includes('pdf') && (
        <button
          type="button"
          onClick={() => void handlePdf()}
          disabled={isDisabled || pdfBusy}
          title={reasonDisabled ?? `Download ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} as PDF`}
          aria-label={`Export ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} as PDF`}
          className={`${baseBtn} ${isDisabled || pdfBusy ? disabledBtn : enabledBtn}`}
        >
          {pdfBusy ? (
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          ) : (
            <FileText size={13} aria-hidden="true" />
          )}
          PDF
        </button>
      )}
      {/* Tiny "Download" affordance icon to anchor the group visually
          next to the table — gold accent so it reads as part of the
          dashboard chrome, not a foreign control. */}
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gold/10 text-gold/70 ml-0.5"
      >
        <Download size={12} />
      </span>
    </div>
  )
}
