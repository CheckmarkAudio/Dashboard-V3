import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'
import { Button, Modal, Select } from '../ui'
import type { TeamMember } from '../../types'
import { Send, AlertTriangle, CheckCircle2 } from 'lucide-react'

type TargetMode = 'all_interns' | 'position' | 'specific'

interface PublishChecklistModalProps {
  open: boolean
  onClose: () => void
  /** Total number of items on the admin's current daily instance. Shown in the modal summary. */
  sourceItemCount: number
  /** Number of distinct categories on the admin's current instance (one template per category). */
  sourceCategoryCount: number
  /** Called after a successful publish so the parent can refresh its data. */
  onPublished?: () => void
}

interface PublishResult {
  target_count: number
  items_added: number
  template_count: number
}

/**
 * Phase 5.1.5 — lets an admin publish their own daily checklist to other
 * team members. Wraps the `publish_daily_checklist` RPC which snapshots
 * each category to a `report_templates` row, upserts `task_assignments`
 * for every target, and regenerates each target's today-daily instance.
 *
 * Merge (default): skips items the target already has — preserves their
 * completion state. Replace: wipes the matching category first. The
 * Replace toggle is gated behind an explicit click + a warning chip.
 *
 * Usage:
 *   <PublishChecklistModal
 *     open={publishOpen}
 *     onClose={() => setPublishOpen(false)}
 *     sourceItemCount={daily.totalCount}
 *     sourceCategoryCount={Object.keys(daily.grouped).length}
 *     onPublished={reloadDashboard}
 *   />
 */
export default function PublishChecklistModal({
  open,
  onClose,
  sourceItemCount,
  sourceCategoryCount,
  onPublished,
}: PublishChecklistModalProps) {
  const { toast } = useToast()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [mode, setMode] = useState<TargetMode>('all_interns')
  const [positionValue, setPositionValue] = useState('intern')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [replace, setReplace] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load team members whenever the modal opens so the "specific" picker
  // has current data. Skip when closed to avoid a wasted query.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingMembers(true)
    ;(async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, display_name, email, position, role, status')
        .eq('status', 'active')
        .order('display_name')
      if (cancelled) return
      if (error) {
        console.error('[PublishChecklistModal] Failed to load members:', error)
        toast('Failed to load team members', 'error')
      } else {
        setMembers((data ?? []) as TeamMember[])
      }
      setLoadingMembers(false)
    })()
    return () => { cancelled = true }
  }, [open, toast])

  // Reset form state every time the modal opens — don't carry stale
  // selections between uses.
  useEffect(() => {
    if (!open) return
    setMode('all_interns')
    setPositionValue('intern')
    setSelectedIds(new Set())
    setReplace(false)
  }, [open])

  // Positions derived from the actual team — only show positions that
  // somebody currently has, plus 'intern' as a sensible default.
  const positions = useMemo(() => {
    const set = new Set<string>()
    for (const m of members) {
      if (m.position) set.add(m.position)
    }
    if (set.size === 0) set.add('intern')
    return Array.from(set).sort()
  }, [members])

  const handleToggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Preview text so the admin sees exactly what will happen before clicking Publish.
  const previewText = useMemo(() => {
    if (mode === 'all_interns') {
      const n = members.filter(m => m.position === 'intern').length
      return `Will push to ${n} intern${n === 1 ? '' : 's'}.`
    }
    if (mode === 'position') {
      const n = members.filter(m => m.position === positionValue).length
      return `Will push to ${n} member${n === 1 ? '' : 's'} with position "${positionValue}".`
    }
    const n = selectedIds.size
    return `Will push to ${n} selected member${n === 1 ? '' : 's'}.`
  }, [mode, positionValue, selectedIds, members])

  const handlePublish = async () => {
    if (sourceItemCount === 0) {
      toast('Your daily checklist is empty — nothing to publish', 'error')
      return
    }
    if (mode === 'specific' && selectedIds.size === 0) {
      toast('Pick at least one team member', 'error')
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase.rpc('publish_daily_checklist', {
      p_target_mode: mode,
      p_target_position: mode === 'position' ? positionValue : null,
      p_target_ids: mode === 'specific' ? Array.from(selectedIds) : [],
      p_replace: replace,
    })

    if (error) {
      console.error('[PublishChecklistModal] Publish failed:', error)
      toast(error.message || 'Failed to publish checklist', 'error')
      setSubmitting(false)
      return
    }

    const result = (data ?? {}) as Partial<PublishResult>
    const targetCount = result.target_count ?? 0
    const itemsAdded = result.items_added ?? 0

    if (targetCount === 0) {
      toast('No eligible members found — nothing was published', 'error')
    } else {
      toast(
        `Published ${itemsAdded} item${itemsAdded === 1 ? '' : 's'} to ${targetCount} member${targetCount === 1 ? '' : 's'}`,
      )
      onPublished?.()
      onClose()
    }
    setSubmitting(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Publish today's tasks to the team"
      description={`Push your ${sourceItemCount}-item daily checklist as ${sourceCategoryCount} template${sourceCategoryCount === 1 ? '' : 's'} and regenerate today's list for the selected members.`}
      size="lg"
      locked={submitting}
    >
      <div className="space-y-5">
        {/* Mode picker */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-text mb-2">Apply to</legend>
          <label className="flex items-start gap-2 p-3 rounded-xl border border-border bg-surface-alt/40 cursor-pointer has-[:checked]:border-gold has-[:checked]:bg-gold/5 transition-colors">
            <input
              type="radio"
              className="mt-1"
              checked={mode === 'all_interns'}
              onChange={() => setMode('all_interns')}
            />
            <div>
              <p className="text-sm font-medium text-text">Every intern</p>
              <p className="text-xs text-text-muted">All active team members whose position is "intern".</p>
            </div>
          </label>

          <label className="flex items-start gap-2 p-3 rounded-xl border border-border bg-surface-alt/40 cursor-pointer has-[:checked]:border-gold has-[:checked]:bg-gold/5 transition-colors">
            <input
              type="radio"
              className="mt-1"
              checked={mode === 'position'}
              onChange={() => setMode('position')}
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-text">Every team member with position</p>
              <p className="text-xs text-text-muted">Pushes to everyone sharing the same role.</p>
              {mode === 'position' && (
                <div className="mt-2">
                  <Select
                    aria-label="Position"
                    value={positionValue}
                    onChange={e => setPositionValue(e.target.value)}
                  >
                    {positions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </label>

          <label className="flex items-start gap-2 p-3 rounded-xl border border-border bg-surface-alt/40 cursor-pointer has-[:checked]:border-gold has-[:checked]:bg-gold/5 transition-colors">
            <input
              type="radio"
              className="mt-1"
              checked={mode === 'specific'}
              onChange={() => setMode('specific')}
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-text">Specific members</p>
              <p className="text-xs text-text-muted">Pick exactly who receives the list.</p>
              {mode === 'specific' && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border bg-surface divide-y divide-border/50">
                  {loadingMembers ? (
                    <p className="p-3 text-xs text-text-muted">Loading members…</p>
                  ) : members.length === 0 ? (
                    <p className="p-3 text-xs text-text-muted">No active team members.</p>
                  ) : (
                    members.map(m => (
                      <label key={m.id} className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-surface-hover">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(m.id)}
                          onChange={() => handleToggleMember(m.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text truncate">{m.display_name}</p>
                          <p className="text-[10px] text-text-light truncate">{m.email ?? ''} · {m.position ?? 'member'}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </label>
        </fieldset>

        {/* Merge vs Replace */}
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-text cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={replace}
              onChange={e => setReplace(e.target.checked)}
            />
            <div>
              <p className="font-medium flex items-center gap-1.5">
                {replace ? (
                  <AlertTriangle size={14} className="text-red-400" aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={14} className="text-emerald-400" aria-hidden="true" />
                )}
                {replace ? 'Replace the member\u2019s list' : 'Merge with member\u2019s existing list (recommended)'}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {replace
                  ? "Wipes the member's items for any matching category before regenerating. Loses their completion state. Only use when the admin list is the single source of truth."
                  : "Adds any new items, skips duplicates, and preserves everything the member has already completed."}
              </p>
            </div>
          </label>
        </div>

        {/* Preview summary */}
        <div className="rounded-xl border border-border bg-surface-alt/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-light">Preview</p>
          <p className="text-sm text-text mt-1">{previewText}</p>
          <p className="text-xs text-text-muted mt-0.5">
            {sourceCategoryCount} template{sourceCategoryCount === 1 ? '' : 's'} will be created or updated.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handlePublish}
            loading={submitting}
            iconLeft={!submitting ? <Send size={16} aria-hidden="true" /> : undefined}
          >
            Publish
          </Button>
        </div>
      </div>
    </Modal>
  )
}
