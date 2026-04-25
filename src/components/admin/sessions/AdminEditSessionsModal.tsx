import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  Inbox,
  Loader2,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import { useToast } from '../../Toast'
import {
  adminDeleteSession,
  adminSessionKeys,
  adminUpdateSession,
  fetchAllSessions,
  type AdminSession,
} from '../../../lib/queries/adminSessions'
import { fetchTeamMembers, teamMemberKeys } from '../../../lib/queries/teamMembers'

/**
 * AdminEditSessionsModal — PR #43.
 *
 * Mirrors `AdminEditTasksModal` in shape. Lists every upcoming
 * session (toggle to include past) with click-to-expand rows.
 * Admin can edit date / time / room / client / engineer / status,
 * or delete outright. Reassigning an engineer fires a
 * `session_reassigned` notification to the new engineer. Deletes
 * best-effort notify the prior engineer before cascading.
 *
 * Overlap safety: the form surfaces a soft warning when the edited
 * time range collides with another session for the same engineer.
 * It's non-blocking — studios sometimes double-book intentionally.
 */
export default function AdminEditSessionsModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [includePast, setIncludePast] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [engineerFilter, setEngineerFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)

  const sessionsQuery = useQuery({
    queryKey: adminSessionKeys.list(includePast),
    queryFn: () => fetchAllSessions({ includePast }),
  })
  const membersQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })

  const sessions = sessionsQuery.data ?? []
  const members = membersQuery.data ?? []

  const engineerOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const s of sessions) {
      if (s.assigned_to && s.assigned_to_name) {
        seen.set(s.assigned_to, s.assigned_to_name)
      }
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [sessions])

  const visibleSessions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return sessions.filter((s) => {
      if (engineerFilter !== 'all' && s.assigned_to !== engineerFilter) return false
      if (term && !(s.client_name ?? '').toLowerCase().includes(term)) return false
      return true
    })
  }, [sessions, searchTerm, engineerFilter])

  return (
    <FloatingDetailModal
      title="Edit bookings"
      eyebrow={`${sessions.length} scheduled · click a row to edit`}
      onClose={onClose}
      maxWidth={720}
    >
      <div className="flex flex-col gap-3">
        {/* Filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[180px] relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by client name…"
              className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text placeholder:text-text-muted focus:outline-none focus:border-gold/50"
            />
          </div>
          <select
            value={engineerFilter}
            onChange={(e) => setEngineerFilter(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text focus:outline-none focus:border-gold/50"
          >
            <option value="all">All engineers</option>
            {engineerOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={includePast}
              onChange={(e) => setIncludePast(e.target.checked)}
              className="accent-gold"
            />
            Include past
          </label>
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
          {sessionsQuery.isLoading ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 size={18} className="animate-spin text-text-muted" />
            </div>
          ) : sessionsQuery.error ? (
            <div className="flex items-center gap-2 text-[13px] text-amber-300 py-4">
              <AlertCircle size={16} />
              <span>{(sessionsQuery.error as Error).message}</span>
            </div>
          ) : visibleSessions.length === 0 ? (
            <div className="py-10 flex flex-col items-center text-center">
              <Inbox size={18} className="text-text-muted" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text">No matching sessions.</p>
            </div>
          ) : (
            visibleSessions.map((session) => (
              <EditableSessionRow
                key={session.id}
                session={session}
                allSessions={sessions}
                members={members}
                isEditing={editingId === session.id}
                onOpenEdit={() => setEditingId(session.id)}
                onCancelEdit={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null)
                  toast('Session updated.', 'success')
                  void queryClient.invalidateQueries({ queryKey: adminSessionKeys.all })
                  // Touch viewer-side caches so /sessions + widgets refresh.
                  void queryClient.invalidateQueries({ queryKey: ['sessions'] })
                  void queryClient.invalidateQueries({ queryKey: ['member-overview-snapshot'] })
                }}
                onDeleted={() => {
                  setEditingId(null)
                  toast('Session cancelled.', 'success')
                  void queryClient.invalidateQueries({ queryKey: adminSessionKeys.all })
                  void queryClient.invalidateQueries({ queryKey: ['sessions'] })
                  void queryClient.invalidateQueries({ queryKey: ['member-overview-snapshot'] })
                }}
                onError={(err) => toast(err.message, 'error')}
              />
            ))
          )}
        </div>
      </div>
    </FloatingDetailModal>
  )
}

function formatSessionLabel(s: AdminSession): string {
  const date = new Date(s.session_date)
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const start = s.start_time.slice(0, 5)
  const end = s.end_time.slice(0, 5)
  return `${dateLabel} · ${start}–${end}`
}

function formatTime12(hm: string): string {
  const [h, m] = hm.split(':').map(Number)
  if (h === undefined || m === undefined) return hm
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`
}

// Returns true if s1 and s2 overlap in calendar time (same date +
// time ranges intersect). Used for the soft overlap warning.
function sessionsOverlap(a: {
  session_date: string; start_time: string; end_time: string
}, b: {
  session_date: string; start_time: string; end_time: string
}): boolean {
  if (a.session_date !== b.session_date) return false
  return a.start_time < b.end_time && b.start_time < a.end_time
}

function EditableSessionRow({
  session,
  allSessions,
  members,
  isEditing,
  onOpenEdit,
  onCancelEdit,
  onSaved,
  onDeleted,
  onError,
}: {
  session: AdminSession
  allSessions: AdminSession[]
  members: { id: string; display_name: string }[]
  isEditing: boolean
  onOpenEdit: () => void
  onCancelEdit: () => void
  onSaved: () => void
  onDeleted: () => void
  onError: (err: Error) => void
}) {
  const [clientName, setClientName] = useState(session.client_name ?? '')
  const [sessionDate, setSessionDate] = useState(session.session_date)
  const [startTime, setStartTime] = useState(session.start_time.slice(0, 5))
  const [endTime, setEndTime] = useState(session.end_time.slice(0, 5))
  const [room, setRoom] = useState(session.room ?? '')
  const [assignedTo, setAssignedTo] = useState(session.assigned_to ?? '')
  const [status, setStatus] = useState(session.status)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof adminUpdateSession>[1] = {}
      if (clientName !== (session.client_name ?? '')) {
        if (!clientName) payload.clearClientName = true
        else payload.client_name = clientName
      }
      if (sessionDate !== session.session_date) payload.session_date = sessionDate
      if (`${startTime}:00` !== session.start_time) payload.start_time = startTime
      if (`${endTime}:00` !== session.end_time) payload.end_time = endTime
      if (room !== (session.room ?? '')) {
        if (!room) payload.clearRoom = true
        else payload.room = room
      }
      if (assignedTo !== (session.assigned_to ?? '')) {
        if (!assignedTo) payload.clearAssignedTo = true
        else payload.assigned_to = assignedTo
      }
      if (status !== session.status) payload.status = status
      return adminUpdateSession(session.id, payload)
    },
    onSuccess: onSaved,
    onError: (err: Error) => onError(err),
  })

  const deleteMutation = useMutation({
    mutationFn: () => adminDeleteSession(session.id),
    onSuccess: onDeleted,
    onError: (err: Error) => onError(err),
  })

  const overlapWarning = useMemo(() => {
    if (!isEditing) return null
    const draft = {
      session_date: sessionDate,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
    }
    if (startTime >= endTime) return 'End time must be after start time.'
    const targetEngineer = assignedTo
    if (!targetEngineer) return null
    const conflict = allSessions.find(
      (other) =>
        other.id !== session.id &&
        other.assigned_to === targetEngineer &&
        sessionsOverlap(draft, other),
    )
    if (!conflict) return null
    return `${conflict.assigned_to_name ?? 'That engineer'} already has "${conflict.client_name ?? 'a session'}" ${formatSessionLabel(conflict)}.`
  }, [isEditing, sessionDate, startTime, endTime, assignedTo, allSessions, session.id])

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={onOpenEdit}
        className="w-full text-left grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-3 py-2 rounded-xl border border-transparent hover:bg-white/[0.03] hover:border-white/[0.08] transition-all"
      >
        <CalendarIcon size={14} className="text-gold/70 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text truncate">
            {session.client_name ?? 'Session'}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-light flex-wrap">
            <span>{formatSessionLabel(session)}</span>
            {session.room && <span>· {session.room}</span>}
            {session.assigned_to_name && (
              <span className="inline-flex items-center gap-1">
                <Users size={10} />
                {session.assigned_to_name}
              </span>
            )}
          </div>
        </div>
        <span className="shrink-0 text-[11px] uppercase tracking-wider text-text-light/80 mt-[2px]">
          {session.status}
        </span>
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-gold uppercase">
          Editing
        </span>
        <button
          type="button"
          onClick={onCancelEdit}
          className="inline-flex items-center justify-center p-1 rounded-md text-text-muted hover:text-text hover:bg-white/[0.04]"
          aria-label="Cancel"
        >
          <X size={13} />
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Client</label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Client name"
          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-border text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:border-gold/50"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Date</label>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text focus:outline-none focus:border-gold/50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Start</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text focus:outline-none focus:border-gold/50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">End</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text focus:outline-none focus:border-gold/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Room</label>
          <input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="e.g. Room A"
            className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text placeholder:text-text-muted focus:outline-none focus:border-gold/50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Engineer</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text focus:outline-none focus:border-gold/50"
          >
            <option value="">— Unassigned —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text focus:outline-none focus:border-gold/50"
        >
          <option value="scheduled">Scheduled</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {overlapWarning && (
        <div className="rounded-lg ring-1 ring-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-start gap-2 text-[12px] text-amber-200">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{overlapWarning}</span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !clientName.trim() || startTime >= endTime}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold bg-gradient-to-b from-gold to-gold-muted text-black hover:brightness-105 disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Check size={13} strokeWidth={3} />
          )}
          Save
        </button>
        <button
          type="button"
          onClick={onCancelEdit}
          className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-[12px] font-semibold bg-white/[0.04] text-text-light hover:text-text hover:bg-white/[0.08]"
        >
          Cancel
        </button>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[12px] font-semibold text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
            title="Cancel this booking"
          >
            <Trash2 size={12} />
            Delete
          </button>
        ) : (
          <button
            type="button"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[12px] font-bold bg-rose-500/80 text-white hover:brightness-110 disabled:opacity-50"
          >
            {deleteMutation.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : null}
            Confirm
          </button>
        )}
      </div>

      {session.start_time && session.end_time && (
        <p className="text-[10px] text-text-muted">
          Originally {formatTime12(session.start_time.slice(0, 5))} – {formatTime12(session.end_time.slice(0, 5))}
        </p>
      )}
    </div>
  )
}
