import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Inbox, ChevronDown, AlertTriangle, ExternalLink, RefreshCcw } from 'lucide-react'
import {
  fetchSupportReports,
  setSupportReportStatus,
  supportReportKeys,
  type SupportReport,
  type SupportStatus,
  type SupportSeverity,
} from '../../lib/queries/supportReports'
import { useToast } from '../Toast'

/**
 * Admin triage list for the Feedback button (support_reports). Reads the
 * team-scoped reports, lets admins filter by status and move a report
 * through open → in progress → resolved / dismissed via the
 * set_support_report_status RPC. Lives as a section in AdminSettings.
 */

const STATUS_META: Record<SupportStatus, { label: string; dot: string; chip: string }> = {
  open:        { label: 'Open',        dot: 'bg-blue-400',    chip: 'text-blue-300 bg-blue-400/10 border-blue-400/30' },
  in_progress: { label: 'In progress', dot: 'bg-amber-400',   chip: 'text-amber-300 bg-amber-400/10 border-amber-400/30' },
  resolved:    { label: 'Resolved',    dot: 'bg-emerald-400', chip: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30' },
  dismissed:   { label: 'Dismissed',   dot: 'bg-text-light',  chip: 'text-text-light bg-surface-alt border-border' },
}
const STATUS_ORDER: SupportStatus[] = ['open', 'in_progress', 'resolved', 'dismissed']

const SEVERITY_META: Record<SupportSeverity, string> = {
  Low:      'text-text-muted bg-surface-alt border-border',
  Medium:   'text-sky-300 bg-sky-400/10 border-sky-400/30',
  High:     'text-amber-300 bg-amber-400/10 border-amber-400/30',
  Critical: 'text-rose-300 bg-rose-400/10 border-rose-400/30',
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

type Filter = 'all' | SupportStatus

function StatusMenu({ report, disabled }: { report: SupportReport; disabled: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const mutation = useMutation({
    mutationFn: (status: SupportStatus) => setSupportReportStatus(report.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supportReportKeys.all })
      toast('Status updated.', 'success')
    },
    onError: () => toast('Could not update status.', 'error'),
  })
  const meta = STATUS_META[report.status]
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || mutation.isPending}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${meta.chip} disabled:opacity-50`}
      >
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-1 z-20 w-40 rounded-lg border border-border bg-surface shadow-lg py-1">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setOpen(false); if (s !== report.status) mutation.mutate(s) }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-surface-hover ${s === report.status ? 'text-text font-semibold' : 'text-text-muted'}`}
              >
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_META[s].dot}`} />
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ReportCard({ report }: { report: SupportReport }) {
  const dimmed = report.status === 'resolved' || report.status === 'dismissed'
  return (
    <div className={`rounded-xl border border-border bg-surface-alt/40 p-4 ${dimmed ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-text break-words">{report.description}</p>
          <p className="text-[12px] text-text-light mt-0.5">
            {report.reporter ?? 'Unknown'} · {relativeTime(report.created_at)}
          </p>
        </div>
        <StatusMenu report={report} disabled={false} />
      </div>

      {report.what_tried && (
        <p className="text-[13px] text-text-muted mt-2 whitespace-pre-wrap break-words">{report.what_tried}</p>
      )}

      <div className="flex items-center flex-wrap gap-2 mt-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${SEVERITY_META[report.severity]}`}>
          {report.severity === 'Critical' && <AlertTriangle size={11} />}
          {report.severity}
        </span>
        {report.page_url && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-surface text-[11px] text-text-muted font-mono">
            <ExternalLink size={11} /> {report.page_url}
          </span>
        )}
      </div>
    </div>
  )
}

export default function FeedbackReportsPanel() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: supportReportKeys.list(),
    queryFn: fetchSupportReports,
  })
  const [filter, setFilter] = useState<Filter>('open')

  const reports = data ?? []
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: reports.length, open: 0, in_progress: 0, resolved: 0, dismissed: 0 }
    for (const r of reports) c[r.status] += 1
    return c
  }, [reports])
  const visible = filter === 'all' ? reports : reports.filter((r) => r.status === filter)

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'dismissed', label: 'Dismissed' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold">Feedback</h2>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text disabled:opacity-50"
        >
          <RefreshCcw size={13} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
      <p className="text-[13px] text-text-muted mb-4">
        Reports submitted from the Feedback button across the app. Move each through open → in progress → resolved.
      </p>

      <div className="flex items-center flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={[
              'px-3 h-8 rounded-lg text-[13px] font-semibold transition-all',
              filter === f.key ? 'bg-gold text-black' : 'bg-surface-alt text-text-muted border border-border hover:text-text',
            ].join(' ')}
          >
            {f.label} <span className="tabular-nums opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-[13px] text-text-light py-8 text-center">Loading reports…</p>
      ) : isError ? (
        <p className="text-[13px] text-rose-300 py-8 text-center">Couldn't load reports. Try refresh.</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Inbox size={20} className="text-text-light" />
          <p className="text-[13px] text-text-muted">
            {filter === 'all' ? 'No feedback yet.' : `No ${filter === 'in_progress' ? 'in-progress' : filter} reports.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((r) => <ReportCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  )
}
