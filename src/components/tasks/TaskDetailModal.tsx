import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  Building2,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Edit2,
  Send,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react'
import FloatingDetailModal from '../FloatingDetailModal'
import { useToast } from '../Toast'
import { useAuth } from '../../contexts/AuthContext'
import { completeAssignedTask } from '../../lib/queries/assignments'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import {
  submitTaskDeleteRequest,
  submitTaskEditRequest,
  taskRequestKeys,
  type ProposedTaskEdit,
} from '../../lib/queries/taskRequests'
import { submitTaskTransferRequest, taskReassignKeys } from '../../lib/queries/taskReassign'
import type { AssignedTask } from '../../types/assignments'
import { FLYWHEEL_STAGES, type FlywheelStage } from './requests/formAtoms'

/**
 * TaskDetailModal — info view for a single assigned task (PR #25).
 *
 * Click checkbox → complete; click row body → opens this modal.
 * Surfaces fields that don't fit in the row (description, "Date
 * added", flywheel stage, batch origin, completion metadata, scope,
 * assignee). Completion can also be toggled from inside.
 *
 * Member-only request actions (only on the user's own active
 * member-scope tasks):
 *   - "Hand off to..." → ask a teammate to take this task (peer
 *     approval; admin notified after acceptance)
 *   - "Request delete" → ask an admin to delete this task
 *
 * Both entry points are SMALL ICON buttons in the footer (rose
 * Trash + gold ArrowRightLeft) and both open the SAME forum-quick-
 * reply-style inline composer pattern: tight one-line header,
 * compact inputs, Cancel + filled Send button + ⌘/Ctrl+Enter & Esc
 * shortcuts. Composers replace the standard footer to keep the
 * modal compact (no second floating dialog stacked on top).
 *
 * `can_complete` is computed server-side and already branches on
 * scope (PR #14) — reused verbatim to disable the completion action
 * for users who can't act on the task.
 */

type Compose = null | 'transfer' | 'delete' | 'edit'

export default function TaskDetailModal({
  task,
  onClose,
}: {
  task: AssignedTask
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  // ─── Mark complete (existing) ───────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: () => completeAssignedTask(task.id, !task.is_completed),
    onSuccess: () => {
      toast(task.is_completed ? 'Marked incomplete' : 'Marked complete', 'success')
      void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['team-assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Update failed', 'error')
    },
  })

  const done = task.is_completed
  const stage = FLYWHEEL_STAGES.find((s) => s.key === task.category) ?? null

  // ─── Composer state — single state machine for all flows ────────
  // Only one composer can be open at a time; opening one auto-closes
  // the others so the footer never tries to render two side by side.
  const [compose, setCompose] = useState<Compose>(null)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  // Edit fields pre-fill from the current task on open. Diff vs. these
  // current values determines what goes in `proposed`.
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDescription, setEditDescription] = useState(task.description ?? '')
  const [editDueDate, setEditDueDate] = useState(task.due_date ?? '')
  const [editCategory, setEditCategory] = useState<string>(task.category ?? '')
  const [editReason, setEditReason] = useState('')

  const openEdit = () => {
    setEditTitle(task.title)
    setEditDescription(task.description ?? '')
    setEditDueDate(task.due_date ?? '')
    setEditCategory(task.category ?? '')
    setEditReason('')
    setCompose('edit')
  }

  const closeCompose = () => {
    setCompose(null)
    setTransferTargetId('')
    setTransferReason('')
    setDeleteReason('')
    setEditReason('')
  }

  // ─── Hand-off / transfer flow ──────────────────────────────────
  // Symmetric to "Request to take": current owner offers task to a
  // specific teammate; teammate accepts/declines. Reason required.
  // Admin gets a passive notification AFTER acceptance.
  const teamMembersQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
    staleTime: 60_000,
    enabled: compose === 'transfer',
  })
  const eligibleTargets = useMemo(() => {
    const all = teamMembersQuery.data ?? []
    return all.filter(
      (m) =>
        m.id !== profile?.id &&
        (m.status?.toLowerCase() ?? 'active') !== 'inactive',
    )
  }, [teamMembersQuery.data, profile?.id])

  const transferMutation = useMutation({
    mutationFn: () =>
      submitTaskTransferRequest(task.id, transferTargetId, transferReason.trim()),
    onSuccess: () => {
      const targetName =
        eligibleTargets.find((m) => m.id === transferTargetId)?.display_name ??
        'your teammate'
      toast(`Transfer offer sent to ${targetName}.`, 'success')
      void queryClient.invalidateQueries({ queryKey: taskReassignKeys.all })
      closeCompose()
      onClose()
    },
    onError: (err) => {
      handleStaleTaskError(err, 'Could not send transfer.')
    },
  })

  // ─── Request delete flow ────────────────────────────────────────
  // Member asks admin to delete; admin approves via the existing
  // PendingTaskRequestsWidget. Reason optional (delete is a smaller
  // ask than transfer; admins can decline if context is missing).
  const requestDeleteMutation = useMutation({
    mutationFn: () => submitTaskDeleteRequest(task.id, deleteReason.trim() || null),
    onSuccess: () => {
      toast('Delete request sent — waiting for admin approval.', 'success')
      void queryClient.invalidateQueries({ queryKey: taskRequestKeys.mine() })
      void queryClient.invalidateQueries({ queryKey: taskRequestKeys.pending() })
      closeCompose()
      onClose()
    },
    onError: (err) => {
      handleStaleTaskError(err, 'Could not submit delete request.')
    },
  })

  // ─── Request edit flow ──────────────────────────────────────────
  // Member proposes changes to title/description/due/category. Only
  // fields that differ from current go in `proposed` — server applies
  // the diff at approve time. Same approve_task_request dispatcher.
  const editProposed = useMemo<ProposedTaskEdit>(() => {
    const out: ProposedTaskEdit = {}
    const trimmedTitle = editTitle.trim()
    if (trimmedTitle.length > 0 && trimmedTitle !== task.title) {
      out.title = trimmedTitle
    }
    const desc = editDescription.trim()
    const currentDesc = (task.description ?? '').trim()
    if (desc !== currentDesc) {
      out.description = desc.length === 0 ? null : desc
    }
    const due = editDueDate.trim()
    const currentDue = task.due_date ?? ''
    if (due !== currentDue) {
      out.due_date = due.length === 0 ? null : due
    }
    const currentCat = task.category ?? ''
    if (editCategory !== currentCat) {
      out.category = editCategory.length === 0 ? null : editCategory
    }
    return out
  }, [editTitle, editDescription, editDueDate, editCategory, task.title, task.description, task.due_date, task.category])

  const editHasChanges = Object.keys(editProposed).length > 0

  const requestEditMutation = useMutation({
    mutationFn: () => submitTaskEditRequest(task.id, editProposed, editReason.trim() || null),
    onSuccess: () => {
      toast('Edit request sent — waiting for admin approval.', 'success')
      void queryClient.invalidateQueries({ queryKey: taskRequestKeys.mine() })
      void queryClient.invalidateQueries({ queryKey: taskRequestKeys.pending() })
      closeCompose()
      onClose()
    },
    onError: (err) => {
      handleStaleTaskError(err, 'Could not submit edit request.')
    },
  })

  // Shared error handler — when the server reports the task is gone
  // (admin direct-delete from /admin/templates raced our request),
  // refresh local caches + close the modal with a friendly message
  // instead of the scary raw 'task not found'. Realtime should usually
  // beat us to it (PR added pub for assigned_tasks 2026-05-02), but
  // this defensive path catches any cache-race window.
  function handleStaleTaskError(err: unknown, fallbackMsg: string) {
    const message = err instanceof Error ? err.message : ''
    if (message.toLowerCase().includes('task not found')) {
      toast('This task was already removed by an admin.', 'success')
      void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['team-assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
      closeCompose()
      onClose()
      return
    }
    toast(message || fallbackMsg, 'error')
  }

  // Forum-style keyboard shortcuts inside any open composer. Capture
  // phase so we beat react-modal/escape-handlers higher in the tree.
  const transferReady = Boolean(transferTargetId && transferReason.trim())
  useEffect(() => {
    if (!compose) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeCompose()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (compose === 'transfer' && transferReady && !transferMutation.isPending) {
          transferMutation.mutate()
        } else if (compose === 'delete' && !requestDeleteMutation.isPending) {
          requestDeleteMutation.mutate()
        } else if (compose === 'edit' && editHasChanges && !requestEditMutation.isPending) {
          requestEditMutation.mutate()
        }
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [compose, transferReady, editHasChanges, transferMutation, requestDeleteMutation, requestEditMutation])

  // Member-only entry points: own active member-scope tasks. Server
  // RPCs enforce the same rules.
  const canRequest =
    !done &&
    task.scope === 'member' &&
    Boolean(profile?.id) &&
    task.assigned_to === profile?.id

  const originLabel = (() => {
    if (task.source_type === 'daily_checklist') return 'Daily checklist'
    if (task.source_type === 'custom') return 'Assigned directly'
    if (task.batch?.title) return `from ${task.batch.title}`
    return 'No batch origin'
  })()

  return (
    <FloatingDetailModal
      onClose={onClose}
      eyebrow={done ? 'Completed task' : task.scope === 'studio' ? 'Studio task' : 'Your task'}
      title={task.title}
      maxWidth={560}
      ariaLabel="Task details"
      footer={
        compose === 'transfer' ? (
          <ComposerShell
            tone="gold"
            icon={<ArrowRightLeft size={11} aria-hidden="true" />}
            label="Hand off to a teammate"
            shortcutHint
            onCancel={closeCompose}
            onSend={() => transferMutation.mutate()}
            sendDisabled={!transferReady || transferMutation.isPending}
            sendLabel={transferMutation.isPending ? 'Sending…' : 'Send'}
          >
            <select
              value={transferTargetId}
              onChange={(e) => setTransferTargetId(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-[13px] focus:border-gold focus:outline-none"
              autoFocus
            >
              <option value="">
                {teamMembersQuery.isLoading ? 'Loading teammates…' : 'Choose a teammate…'}
              </option>
              {eligibleTargets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                  {m.position ? ` · ${m.position.replace(/_/g, ' ')}` : ''}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="Reason for the hand-off (required)"
              maxLength={500}
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-[13px] placeholder:text-text-light focus:border-gold focus:outline-none"
            />
          </ComposerShell>
        ) : compose === 'delete' ? (
          <ComposerShell
            tone="rose"
            icon={<Trash2 size={11} aria-hidden="true" />}
            label="Ask admin to delete this task"
            shortcutHint
            onCancel={closeCompose}
            onSend={() => requestDeleteMutation.mutate()}
            sendDisabled={requestDeleteMutation.isPending}
            sendLabel={requestDeleteMutation.isPending ? 'Sending…' : 'Send'}
          >
            <input
              type="text"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Reason (optional, helps the admin decide)"
              maxLength={500}
              autoFocus
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-[13px] placeholder:text-text-light focus:border-rose-400/60 focus:outline-none"
            />
          </ComposerShell>
        ) : compose === 'edit' ? (
          <ComposerShell
            tone="orange"
            icon={<Edit2 size={11} aria-hidden="true" />}
            label="Propose edits to this task"
            shortcutHint
            onCancel={closeCompose}
            onSend={() => requestEditMutation.mutate()}
            sendDisabled={!editHasChanges || requestEditMutation.isPending}
            sendLabel={
              requestEditMutation.isPending
                ? 'Sending…'
                : editHasChanges
                  ? 'Send'
                  : 'No changes'
            }
          >
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
              maxLength={200}
              aria-label="Title"
              autoFocus
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-[13px] placeholder:text-text-light focus:border-orange-400/60 focus:outline-none"
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              maxLength={1000}
              rows={2}
              aria-label="Description"
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-[13px] placeholder:text-text-light focus:border-orange-400/60 focus:outline-none resize-y min-h-[44px]"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                aria-label="Due date"
                className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-[13px] focus:border-orange-400/60 focus:outline-none"
              />
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                aria-label="Flywheel stage"
                className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-[13px] focus:border-orange-400/60 focus:outline-none"
              >
                <option value="">No stage</option>
                {FLYWHEEL_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Reason (optional, helps the admin decide)"
              maxLength={500}
              aria-label="Reason"
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-[13px] placeholder:text-text-light focus:border-orange-400/60 focus:outline-none"
            />
          </ComposerShell>
        ) : (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border bg-surface-alt/40 rounded-b-[18px]">
            <p className="text-[11px] text-text-light truncate">
              {task.can_complete
                ? done
                  ? 'You can mark this incomplete.'
                  : 'Ready to check off.'
                : 'Read-only — only the assignee or an admin can change this.'}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:text-text"
              >
                Close
              </button>
              {/* Member request actions — small pill buttons (icon +
                  label) so the action reads at a glance instead of
                  forcing the user to read tooltips. Trash = ask admin
                  to delete; Edit = propose changes; ArrowRightLeft =
                  hand off to a teammate. Click opens the matching
                  inline composer. */}
              {canRequest && (
                <>
                  <button
                    type="button"
                    onClick={() => setCompose('delete')}
                    aria-label="Request admin to delete this task"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-semibold text-rose-300 bg-rose-500/10 ring-1 ring-rose-500/25 hover:bg-rose-500/20 hover:text-rose-200 transition-colors focus-ring"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={openEdit}
                    aria-label="Propose edits to this task"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-semibold text-orange-300 bg-orange-500/10 ring-1 ring-orange-500/30 hover:bg-orange-500/20 transition-colors focus-ring"
                  >
                    <Edit2 size={12} aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompose('transfer')}
                    aria-label="Hand off this task to a teammate"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-semibold text-gold bg-gold/10 ring-1 ring-gold/25 hover:bg-gold/20 transition-colors focus-ring"
                  >
                    <ArrowRightLeft size={12} aria-hidden="true" />
                    Transfer
                  </button>
                </>
              )}
              {task.can_complete && (
                <button
                  type="button"
                  onClick={() => toggleMutation.mutate()}
                  disabled={toggleMutation.isPending}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold focus-ring disabled:opacity-40 ${
                    done
                      ? 'bg-surface-alt text-text-muted ring-1 ring-border hover:bg-surface-hover'
                      : 'bg-gold text-black hover:bg-gold-muted'
                  }`}
                >
                  {done ? (
                    <>
                      <Circle size={13} aria-hidden="true" />
                      {toggleMutation.isPending ? 'Updating…' : 'Mark incomplete'}
                    </>
                  ) : (
                    <>
                      <Check size={13} aria-hidden="true" />
                      {toggleMutation.isPending ? 'Completing…' : 'Mark complete'}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )
      }
    >
      <div className="space-y-4 px-4 py-3">
        {/* Badges row — Flywheel stage · Scope · Completed.
            PR #70 — `Required` chip retired sitewide; will return as
            an urgency mechanic later. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {stage && <StagePill stage={stage} />}
          {task.scope === 'studio' && (
            <Chip
              icon={<Building2 size={10} aria-hidden="true" />}
              label="Studio task"
              tone="cyan"
            />
          )}
          {done && (
            <Chip
              icon={<CheckCircle2 size={10} aria-hidden="true" />}
              label="Completed"
              tone="emerald"
            />
          )}
        </div>

        {/* Description */}
        {task.description ? (
          <section>
            <Label>Description</Label>
            <p className="text-[13px] text-text leading-relaxed mt-1 whitespace-pre-line">
              {task.description}
            </p>
          </section>
        ) : (
          <section>
            <Label>Description</Label>
            <p className="text-[12px] text-text-light italic mt-1">No description.</p>
          </section>
        )}

        {/* Meta grid — Date added + Due date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MetaRow
            icon={<CalendarIcon size={13} aria-hidden="true" />}
            label="Date added"
            value={formatDateTime(task.created_at)}
          />
          <MetaRow
            icon={<Clock size={13} aria-hidden="true" />}
            label="Due"
            value={task.due_date ? formatDate(task.due_date) : 'No due date'}
            muted={!task.due_date}
          />
          {task.assigned_to_name && (
            <MetaRow
              icon={<UserIcon size={13} aria-hidden="true" />}
              label="Assignee"
              value={task.assigned_to_name}
            />
          )}
          {done && task.completed_at && (
            <MetaRow
              icon={<CheckCircle2 size={13} aria-hidden="true" />}
              label="Completed at"
              value={formatDateTime(task.completed_at)}
            />
          )}
        </div>

        {/* Batch origin — subtle footer row */}
        <div className="pt-2 border-t border-border/60">
          <p className="text-[11px] text-text-light">{originLabel}</p>
        </div>
      </div>
    </FloatingDetailModal>
  )
}

// ─── Shared composer shell ───────────────────────────────────────
//
// Compact forum-quick-reply chrome reused by both Transfer + Request
// Delete. Single-line header (icon + label), body slot for the
// caller's inputs, Cancel + filled Send action row, optional
// keyboard-shortcut hint footer.
//
// Tight vertical rhythm by design — keeps the composer fully visible
// inside FloatingDetailModal's max-h on small viewports without
// pushing Send off-screen.

function ComposerShell({
  tone,
  icon,
  label,
  shortcutHint,
  onCancel,
  onSend,
  sendDisabled,
  sendLabel,
  children,
}: {
  // System-wide kind palette: rose=delete · gold=transfer · orange=edit.
  tone: 'gold' | 'rose' | 'orange'
  icon: React.ReactNode
  label: string
  shortcutHint?: boolean
  onCancel: () => void
  onSend: () => void
  sendDisabled: boolean
  sendLabel: string
  children: React.ReactNode
}) {
  const sendClass =
    tone === 'rose'
      ? 'bg-rose-500/80 text-white hover:brightness-110 shadow-[0_4px_12px_rgba(244,63,94,0.25)]'
      : tone === 'orange'
        ? 'bg-orange-500 text-black hover:bg-orange-400 shadow-[0_4px_12px_rgba(249,115,22,0.25)]'
        : 'bg-gold text-black hover:bg-gold-muted shadow-[0_4px_12px_rgba(214,170,55,0.18)]'
  const disabledClass = 'bg-surface-alt text-text-light border border-border cursor-not-allowed'
  const accentText =
    tone === 'rose' ? 'text-rose-300' : tone === 'orange' ? 'text-orange-300' : 'text-gold'
  const bgClass =
    tone === 'rose'
      ? 'bg-rose-500/[0.04]'
      : tone === 'orange'
        ? 'bg-orange-500/[0.05]'
        : 'bg-surface-alt/40'

  return (
    <div className={`px-4 py-2.5 border-t border-border rounded-b-[18px] space-y-1.5 ${bgClass}`}>
      <div className="flex items-center gap-1.5">
        <span className={`shrink-0 ${accentText}`}>{icon}</span>
        <p className="text-[12px] font-bold text-text truncate">{label}</p>
      </div>
      {children}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        {shortcutHint ? (
          <p className="text-[10px] text-text-light/70 truncate">
            ⌘/Ctrl + Enter to send · Esc to cancel
          </p>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-text-muted hover:text-text"
          >
            <X size={11} aria-hidden="true" />
            Cancel
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={sendDisabled}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-all disabled:opacity-50 ${
              sendDisabled ? disabledClass : sendClass
            }`}
          >
            <Send size={11} aria-hidden="true" />
            {sendLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Small presentational atoms ──────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-light">
      {children}
    </p>
  )
}

function MetaRow({
  icon,
  label,
  value,
  muted = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 mt-0.5 text-text-light">{icon}</span>
      <div className="min-w-0">
        <Label>{label}</Label>
        <p
          className={`text-[13px] mt-0.5 truncate ${
            muted ? 'text-text-light italic' : 'text-text'
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

function Chip({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode
  label: string
  tone: 'rose' | 'cyan' | 'emerald'
}) {
  const toneMap: Record<typeof tone, string> = {
    rose: 'bg-rose-500/15 text-rose-200 ring-rose-500/40',
    cyan: 'bg-cyan-500/15 text-cyan-200 ring-cyan-500/40',
    emerald: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/40',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ring-1 ${toneMap[tone]}`}
    >
      {icon}
      {label}
    </span>
  )
}

function StagePill({ stage }: { stage: (typeof FLYWHEEL_STAGES)[number] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold ring-1 ${stage.bg} ${stage.fg} ${stage.ring}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} aria-hidden="true" />
      {stage.label}
    </span>
  )
}

// ─── Formatters ──────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Keep the signature of FlywheelStage exported for any future caller
// that wants to pass a specific stage in from outside.
export type { FlywheelStage }
