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
  Send,
  User as UserIcon,
} from 'lucide-react'
import FloatingDetailModal from '../FloatingDetailModal'
import { useToast } from '../Toast'
import { useAuth } from '../../contexts/AuthContext'
import { completeAssignedTask } from '../../lib/queries/assignments'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import { submitTaskTransferRequest, taskReassignKeys } from '../../lib/queries/taskReassign'
import type { AssignedTask } from '../../types/assignments'
import { FLYWHEEL_STAGES, type FlywheelStage } from './requests/formAtoms'

/**
 * TaskDetailModal — info view for a single assigned task (PR #25).
 *
 * Replaces the "click anywhere on the row → complete" pattern from
 * PR #11 with monday-style behavior: click the checkbox to complete,
 * click the task body to open this modal. The modal surfaces fields
 * that don't fit in the row layout — description, "Date added"
 * (= `created_at`), flywheel stage, batch origin, completion
 * metadata, scope, and assignee.
 *
 * Completion can also be toggled from inside the modal so the admin
 * / member doesn't need to close it just to flip the checkbox.
 *
 * `can_complete` is computed server-side and already branches on
 * scope (see PR #14) — we reuse it here verbatim to disable the
 * completion action for users who can't act on the task.
 */

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

  // ─── Hand-off / transfer flow ──────────────────────────────────
  // Symmetric to the existing "Request to take" peer flow: the
  // current owner offers the task to a specific teammate; the
  // teammate accepts/declines. Reason is required (per user spec —
  // "nobody loses track of the reason and admin can view it later").
  // Visual pattern mirrors the forum quick-reply: rounded text input,
  // dim secondary action on the left, Cancel + filled Send on the
  // right, keyboard hint below.
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferReason, setTransferReason] = useState('')

  const teamMembersQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
    staleTime: 60_000,
    enabled: transferOpen,
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
      setTransferOpen(false)
      setTransferTargetId('')
      setTransferReason('')
      onClose()
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Could not send transfer.', 'error')
    },
  })

  // Forum-style keyboard shortcuts inside the composer.
  useEffect(() => {
    if (!transferOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setTransferOpen(false)
        setTransferTargetId('')
        setTransferReason('')
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (transferTargetId && transferReason.trim() && !transferMutation.isPending) {
          transferMutation.mutate()
        }
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [transferOpen, transferTargetId, transferReason, transferMutation])

  // Only show "Hand off to…" when the task is the current user's own
  // active member-scope task. Studio rows have no single owner; the
  // RPC would reject anyway. Hidden for completed tasks since the
  // server rejects those too.
  const canTransfer =
    !done &&
    task.scope === 'member' &&
    Boolean(profile?.id) &&
    task.assigned_to === profile?.id

  const transferReady = Boolean(transferTargetId && transferReason.trim())

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
        transferOpen ? (
          // Inline forum-quick-reply-style composer. Replaces the
          // default footer while the user is composing the offer so
          // the modal stays compact (no second floating dialog
          // stacked on top of this one).
          <div className="px-4 py-3 border-t border-border bg-surface-alt/40 rounded-b-[18px] space-y-2">
            <div className="flex items-start gap-2">
              <ArrowRightLeft size={12} className="text-gold mt-1 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-text">Hand off this task</p>
                <p className="text-[11px] text-text-light mt-0.5">
                  Pick a teammate and add a quick reason. They accept or decline; admins are notified once it's accepted.
                </p>
              </div>
            </div>
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
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] placeholder:text-text-light focus:border-gold focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setTransferOpen(false)
                  setTransferTargetId('')
                  setTransferReason('')
                }}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-text-muted hover:text-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => transferMutation.mutate()}
                disabled={!transferReady || transferMutation.isPending}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${
                  !transferReady
                    ? 'bg-surface-alt text-text-light border border-border cursor-not-allowed'
                    : 'bg-gold text-black hover:bg-gold-muted shadow-[0_4px_12px_rgba(214,170,55,0.18)]'
                } disabled:opacity-50`}
              >
                <Send size={12} aria-hidden="true" />
                {transferMutation.isPending ? 'Sending…' : 'Send'}
              </button>
            </div>
            <p className="text-[10px] text-text-light/70 pt-0.5">
              ⌘/Ctrl + Enter to send · Esc to cancel
            </p>
          </div>
        ) : (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border bg-surface-alt/40 rounded-b-[18px]">
          <p className="text-[11px] text-text-light">
            {task.can_complete
              ? done
                ? 'You can mark this incomplete.'
                : 'Ready to check off.'
              : 'Read-only — only the assignee or an admin can change this.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:text-text"
            >
              Close
            </button>
            {canTransfer && (
              <button
                type="button"
                onClick={() => setTransferOpen(true)}
                title="Offer this task to another teammate"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold text-gold/80 hover:text-gold hover:bg-gold/10 transition-colors"
              >
                <ArrowRightLeft size={12} aria-hidden="true" />
                Hand off to…
              </button>
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
          {stage && (
            <StagePill stage={stage} />
          )}
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
          <p className="text-[11px] text-text-light">
            {originLabel}
          </p>
        </div>
      </div>
    </FloatingDetailModal>
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
