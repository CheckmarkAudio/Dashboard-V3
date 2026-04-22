import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Calendar, Check, Clock, Loader2, UserCircle2 } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import { useToast } from '../../Toast'
import {
  assignSession,
  fetchAssignableSessions,
  findEngineerConflict,
  type AssignableSession,
  type EngineerSessionConflict,
} from '../../../domain/sessions/queries'
import { fetchTeamMembers, teamMemberKeys } from '../../../lib/queries/teamMembers'

/**
 * SessionAssignModal — admin picks a session + an engineer, we write
 * `sessions.assigned_to` and fire a notification to the engineer via
 * the `assign_session` RPC (atomic).
 *
 * Handles both "assign unassigned session" and "reassign an assigned
 * session" with one flow. The session row shows current assignee
 * inline and the picker just reflects that; if the admin changes the
 * selection and hits Confirm, the RPC figures out whether it's a new
 * assignment or a reassignment and sends the right notification type.
 *
 * Window: upcoming only (next 30 days) by default. "Show past" toggle
 * extends to -30 days so an admin can fix historical assignments too.
 */

export default function SessionAssignModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [includePast, setIncludePast] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedEngineerId, setSelectedEngineerId] = useState<string | null>(null)

  const sessionsQuery = useQuery({
    queryKey: ['assignable-sessions', includePast] as const,
    queryFn: () => fetchAssignableSessions({ includePast }),
  })

  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })

  const sessions = sessionsQuery.data ?? []
  const team = teamQuery.data ?? []
  const activeTeam = useMemo(
    () => team.filter((m) => m.status?.toLowerCase() !== 'inactive'),
    [team],
  )

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null

  // When a session is picked, seed the engineer selector with whoever
  // is currently assigned so "Confirm" is a no-op until the admin
  // actually changes something.
  function handleSessionClick(sessionId: string) {
    const row = sessions.find((s) => s.id === sessionId)
    setSelectedSessionId(sessionId)
    setSelectedEngineerId(row?.assignedTo ?? null)
  }

  // ─── Engineer conflict detection (PR #15) ──────────────────────────
  // Warn (don't block) when the selected engineer already has another
  // session overlapping the target slot. Runs whenever the engineer
  // or session selection changes. If admin still wants to proceed,
  // the Confirm button stays enabled — studios sometimes legitimately
  // double-book as a deliberate scheduling move.
  const conflictQuery = useQuery<EngineerSessionConflict | null>({
    queryKey: [
      'engineer-conflict',
      selectedSessionId,
      selectedEngineerId,
    ] as const,
    queryFn: () => {
      if (!selectedSession || !selectedEngineerId) return Promise.resolve(null)
      // Same-engineer "conflict" with the session itself is excluded.
      if (selectedSession.assignedTo === selectedEngineerId) return Promise.resolve(null)
      return findEngineerConflict({
        assigneeId: selectedEngineerId,
        sessionDate: selectedSession.sessionDate,
        startTime: selectedSession.startTime,
        endTime: selectedSession.endTime,
        excludeSessionId: selectedSession.id,
      })
    },
    enabled: Boolean(selectedSession && selectedEngineerId),
    // Conflict state doesn't change between clicks — no auto-refetch.
    staleTime: 60_000,
  })
  const conflict = conflictQuery.data ?? null

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSessionId || !selectedEngineerId) {
        throw new Error('Pick a session and an engineer first.')
      }
      return assignSession(selectedSessionId, selectedEngineerId)
    },
    onSuccess: (result) => {
      if (!result.changed) {
        toast('No change — engineer was already assigned.', 'success')
        return
      }
      toast(
        result.is_reassign
          ? 'Session reassigned. Engineer notified.'
          : 'Session assigned. Engineer notified.',
        'success',
      )
      // Invalidate session surfaces so the Sessions page + Calendar
      // reflect the new assignee on next render.
      void queryClient.invalidateQueries({ queryKey: ['assignable-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['calendar'] })
      // Assignee's notifications widget refreshes next tick.
      void queryClient.invalidateQueries({ queryKey: ['assignment-notifications'] })
      onClose()
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Assignment failed', 'error')
    },
  })

  const canConfirm =
    Boolean(selectedSessionId) &&
    Boolean(selectedEngineerId) &&
    !assignMutation.isPending &&
    selectedEngineerId !== selectedSession?.assignedTo

  return (
    <FloatingDetailModal
      onClose={onClose}
      eyebrow="Bookings · Sessions"
      title="Assign a session"
      maxWidth={720}
      ariaLabel="Assign a booked session to an engineer"
      footer={
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border bg-surface-alt/40 rounded-b-[18px]">
          <p className="text-[11px] text-text-light">
            {selectedSession ? (
              <>
                {selectedSession.assignedToName
                  ? `Currently: ${selectedSession.assignedToName}`
                  : 'Currently unassigned'}
              </>
            ) : (
              'Pick a session to continue'
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => assignMutation.mutate()}
              disabled={!canConfirm}
              className="px-4 py-2 rounded-xl bg-gold text-black text-[13px] font-bold hover:bg-gold-muted focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {assignMutation.isPending ? 'Assigning…' : 'Confirm'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 px-4 py-3">
        {/* Session list ─────────────────────────────────────────── */}
        <section>
          <header className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-light">
              Sessions
              {!sessionsQuery.isLoading && (
                <span className="ml-2 text-text-light/70">· {sessions.length}</span>
              )}
            </h3>
            <label className="inline-flex items-center gap-2 text-[11px] text-text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includePast}
                onChange={(e) => setIncludePast(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border-light bg-surface text-gold focus-ring"
              />
              Show past (30 days)
            </label>
          </header>

          <div className="rounded-xl border border-border bg-surface-alt/40 max-h-72 overflow-y-auto divide-y divide-border">
            {sessionsQuery.isLoading ? (
              <div className="flex items-center justify-center py-10 text-text-light">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-text-light">
                No sessions in this window.
              </div>
            ) : (
              sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  active={selectedSessionId === s.id}
                  onClick={() => handleSessionClick(s.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Engineer picker — only once a session is selected ─────── */}
        {selectedSession && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-light mb-2">
              Engineer
            </h3>
            <div className="rounded-xl border border-border bg-surface-alt/40 max-h-44 overflow-y-auto divide-y divide-border">
              {teamQuery.isLoading ? (
                <div className="flex items-center justify-center py-6 text-text-light">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              ) : (
                activeTeam.map((m) => {
                  const picked = selectedEngineerId === m.id
                  const isCurrent = selectedSession.assignedTo === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedEngineerId(m.id)}
                      className={`w-full px-3 py-2 flex items-center gap-3 text-left text-sm transition-colors ${
                        picked ? 'bg-gold/10 text-text' : 'text-text-muted hover:bg-surface-hover'
                      }`}
                    >
                      <span
                        className={`shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center ${
                          picked ? 'bg-gold text-black' : 'bg-surface border border-border-light'
                        }`}
                        aria-hidden="true"
                      >
                        {picked && <Check size={12} strokeWidth={3} />}
                      </span>
                      <UserCircle2 size={16} className="text-text-light" aria-hidden="true" />
                      <span className="flex-1 truncate">{m.display_name}</span>
                      {m.position && (
                        <span className="text-[10px] uppercase tracking-wider text-text-light">
                          {m.position}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[10px] uppercase tracking-wider text-gold font-bold">
                          Current
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>

            {/* Conflict warning — surfaces when the selected engineer
                already has an overlapping session. Non-blocking: admin
                can still Confirm (rare but sometimes intentional). */}
            {conflict && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2.5 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/40 px-3 py-2.5"
              >
                <AlertTriangle size={14} className="text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-[12px] leading-snug">
                  <p className="text-amber-200 font-semibold">
                    Schedule conflict
                  </p>
                  <p className="text-amber-100/90 mt-0.5">
                    This engineer already has "{conflict.client_name ?? 'a session'}" at{' '}
                    {formatTime(conflict.start_time)}–{formatTime(conflict.end_time)}
                    {conflict.room ? ` in ${conflict.room}` : ''}. You can still proceed.
                  </p>
                </div>
              </div>
            )}
            {conflictQuery.isFetching && selectedEngineerId && (
              <p className="mt-2 text-[11px] text-text-light">Checking engineer schedule…</p>
            )}
          </section>
        )}
      </div>
    </FloatingDetailModal>
  )
}

function SessionRow({
  session,
  active,
  onClick,
}: {
  session: AssignableSession
  active: boolean
  onClick: () => void
}) {
  const date = new Date(`${session.sessionDate}T00:00:00`)
  const dayLabel = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const startLabel = formatTime(session.startTime)
  const endLabel = formatTime(session.endTime)
  const client = session.clientName?.trim() || 'Studio session'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3 py-2.5 flex items-start gap-3 text-left transition-colors ${
        active ? 'bg-gold/10' : 'hover:bg-surface-hover'
      }`}
      aria-pressed={active}
    >
      <div className="shrink-0 mt-0.5">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            active ? 'bg-gold text-black' : 'bg-surface ring-1 ring-border-light text-text-light'
          }`}
          aria-hidden="true"
        >
          <Calendar size={14} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-semibold text-text truncate">{client}</p>
          <span className="text-[10px] uppercase tracking-wider text-text-light">
            {session.sessionType}
          </span>
          {session.status && (
            <span className="text-[10px] uppercase tracking-wider text-text-light/80">
              · {session.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-text-light mt-0.5">
          <span>{dayLabel}</span>
          <span className="inline-flex items-center gap-1">
            <Clock size={10} />
            {startLabel}–{endLabel}
          </span>
          {session.room && <span>· {session.room}</span>}
        </div>
        <p className="text-[11px] mt-0.5">
          {session.assignedToName ? (
            <span className="text-text-muted">
              Assigned to <span className="text-text font-medium">{session.assignedToName}</span>
            </span>
          ) : (
            <span className="text-amber-300/90 font-medium">Unassigned</span>
          )}
        </p>
      </div>
    </button>
  )
}

function formatTime(hms: string): string {
  // 'HH:MM:SS' → '3:30pm'
  const [h = '0', m = '0'] = hms.split(':')
  const hour = Number(h)
  const minute = Number(m)
  const period = hour >= 12 ? 'pm' : 'am'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const mm = minute.toString().padStart(2, '0')
  return `${displayHour}:${mm}${period}`
}
