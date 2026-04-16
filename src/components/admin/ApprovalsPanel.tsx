import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useAdminOverviewContext } from '../../contexts/AdminOverviewContext'
import { useToast } from '../Toast'
import { Badge, Button, Input, Modal } from '../ui'
import type { PendingTaskEdit } from '../../hooks/useChecklist'
import type { EnrichedApprovalRequest } from '../../domain/dashboard/adminOverview'
import {
  Check, X, Clock, Plus, Pencil, Trash2, Loader2, CheckCircle2, Layers,
} from 'lucide-react'

/**
 * Phase 5.3 — Admin Approval Queue.
 *
 * Lists all PENDING task_edit_requests scoped to the admin's team,
 * joined with the requesting member's display name, so an admin can
 * approve or reject them. Approvals call the `approve_task_edit_request`
 * RPC (SECURITY DEFINER, installed in Phase 5.1) which applies the
 * change to the checklist instance and optionally mirrors the change
 * back to the source `report_templates.fields` JSONB. Rejections update
 * the row directly via RLS (admins can UPDATE task_edit_requests).
 *
 * This component is embedded in the Dashboard's TeamPulseTab for now.
 * Phase 5.4 will also render it inside the new admin Hub's Approvals tab.
 */

type EnrichedRequest = EnrichedApprovalRequest

export default function ApprovalsPanel() {
  const { isAdmin } = useAuth()
  const { toast } = useToast()
  const { approvalRequests, loading, refetch } = useAdminOverviewContext()
  const [busyId, setBusyId] = useState<string | null>(null)
  // Per-row template sync toggle — defaults to true (mirror change to template).
  const [applyToTemplate, setApplyToTemplate] = useState<Record<string, boolean>>({})
  const [rejectTarget, setRejectTarget] = useState<EnrichedRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const requests = approvalRequests

  const handleApprove = async (req: EnrichedRequest) => {
    setBusyId(req.id)
    const sync = applyToTemplate[req.id] !== false
    const { error } = await supabase.rpc('approve_task_edit_request', {
      p_request_id: req.id,
      p_apply_to_template: sync,
    })

    if (error) {
      console.error('[ApprovalsPanel] approve failed:', error)
      toast(error.message || 'Approve failed', 'error')
      setBusyId(null)
      return
    }

    toast(sync ? 'Approved and updated template' : 'Approved — instance only')
    await refetch()
    setBusyId(null)
  }

  const openReject = (req: EnrichedRequest) => {
    setRejectTarget(req)
    setRejectReason('')
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    setRejecting(true)
    const { error } = await supabase
      .from('task_edit_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reject_reason: rejectReason.trim() || null,
      })
      .eq('id', rejectTarget.id)
    setRejecting(false)
    if (error) {
      console.error('[ApprovalsPanel] reject failed:', error)
      toast(error.message || 'Reject failed', 'error')
      return
    }
    toast('Request rejected')
    await refetch()
    setRejectTarget(null)
    setRejectReason('')
  }

  // Group requests by requester for readability (one card per member).
  const groupedByRequester = useMemo(() => {
    const map = new Map<string, { name: string; rows: EnrichedRequest[] }>()
    for (const r of requests) {
      const existing = map.get(r.requested_by)
      if (existing) existing.rows.push(r)
      else map.set(r.requested_by, { name: r.requester_display_name, rows: [r] })
    }
    return Array.from(map.values())
  }, [requests])

  if (!isAdmin) return null

  return (
    <section className="bg-surface rounded-2xl border border-border p-5 shadow-sm">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-gold" aria-hidden="true" />
          <h2 className="font-semibold text-sm">Pending approvals</h2>
          {requests.length > 0 && (
            <Badge variant="warning" size="sm">{requests.length}</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refetch()} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : 'Refresh'}
        </Button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-10" role="status" aria-live="polite">
          <Loader2 size={18} className="animate-spin text-gold" aria-hidden="true" />
          <span className="sr-only">Loading approvals…</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-text-muted py-6">
          <CheckCircle2 size={16} className="text-emerald-400" aria-hidden="true" />
          <span>No pending edits. Everyone's caught up.</span>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByRequester.map(({ name, rows }) => (
            <div key={name} className="space-y-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                {name} · {rows.length} request{rows.length === 1 ? '' : 's'}
              </p>
              <ul className="space-y-2">
                {rows.map(req => {
                  const isBusy = busyId === req.id
                  const sync = applyToTemplate[req.id] !== false

                  return (
                    <li
                      key={req.id}
                      className="border border-border rounded-xl p-3 flex flex-col gap-3 bg-surface-alt/40"
                    >
                      <div className="flex items-start gap-2 flex-wrap">
                        <ChangeIcon type={req.change_type} />
                        <div className="flex-1 min-w-0">
                          <ChangeSummary req={req} />
                          <p className="text-[11px] text-text-light mt-0.5">
                            {req.instance_frequency ?? 'checklist'} · {req.instance_date ?? 'unknown date'} ·{' '}
                            {req.proposed_category ?? '—'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="flex items-center gap-1.5 text-[11px] text-text-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sync}
                            onChange={e =>
                              setApplyToTemplate(prev => ({ ...prev, [req.id]: e.target.checked }))
                            }
                          />
                          <Layers size={11} aria-hidden="true" />
                          Update source template so next cycle persists
                        </label>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openReject(req)}
                            disabled={isBusy}
                            iconLeft={<X size={12} aria-hidden="true" />}
                          >
                            Reject
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleApprove(req)}
                            loading={isBusy}
                            iconLeft={!isBusy ? <Check size={12} aria-hidden="true" /> : undefined}
                          >
                            Approve
                          </Button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectReason('') }}
        title="Reject this request"
        description="Optionally include a short reason the member will see on their pending queue."
        size="sm"
        locked={rejecting}
      >
        {rejectTarget && (
          <div className="space-y-3">
            <div className="text-xs text-text-muted p-3 rounded-lg border border-border bg-surface-alt/40">
              <ChangeSummary req={rejectTarget} />
            </div>
            <Input
              label="Reason (optional)"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. This overlaps with the weekly list"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setRejectTarget(null); setRejectReason('') }}
                disabled={rejecting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={submitReject}
                loading={rejecting}
              >
                Reject request
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}

// ─── Presentational helpers ──────────────────────────────────────────

function ChangeIcon({ type }: { type: PendingTaskEdit['change_type'] }) {
  if (type === 'add') return <Plus size={14} className="text-emerald-400 mt-0.5 shrink-0" aria-hidden="true" />
  if (type === 'rename') return <Pencil size={14} className="text-sky-400 mt-0.5 shrink-0" aria-hidden="true" />
  return <Trash2 size={14} className="text-red-400 mt-0.5 shrink-0" aria-hidden="true" />
}

function ChangeSummary({ req }: { req: PendingTaskEdit }) {
  if (req.change_type === 'add') {
    return (
      <p className="text-sm text-text">
        Add <strong>{req.proposed_text}</strong>
        {req.proposed_category && <span className="text-text-muted"> · {req.proposed_category}</span>}
      </p>
    )
  }
  if (req.change_type === 'rename') {
    return (
      <p className="text-sm text-text">
        Rename <strong className="line-through text-text-light">{req.previous_text}</strong>
        {' → '}
        <strong>{req.proposed_text}</strong>
      </p>
    )
  }
  return (
    <p className="text-sm text-text">
      Delete <strong className="line-through text-text-light">{req.previous_text}</strong>
    </p>
  )
}
