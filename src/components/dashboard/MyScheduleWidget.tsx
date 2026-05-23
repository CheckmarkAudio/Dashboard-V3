import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarRange,
  Loader2,
  Plus,
  Clock as ClockIcon,
  Send,
  X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../Toast'
import { Button, Input } from '../ui'
import {
  endOfWeek,
  startOfWeek,
  toLocalDateString,
} from '../../lib/schedule/expand'
import { useTeamSchedule } from '../../lib/schedule/useTeamSchedule'
import {
  requestScheduleBlock,
  withdrawScheduleRequest,
} from '../../lib/schedule/mutations'
import {
  fetchTeamMembers,
  teamMemberKeys,
} from '../../lib/queries/teamMembers'
import type { ExpandedSchedule } from '../../types'

/**
 * Personal weekly schedule with a toggle to see the whole team's
 * schedule. Members can also propose a schedule block from here —
 * "Request schedule block" opens a modal that writes a pending row
 * into `team_schedule_blocks`. Admin reviews from Members → Work
 * Scheduler (PR 1).
 *
 * Layout: header (mode toggle + Request button) → 7-day list. Each
 * day shows the day name + a list of blocks (member name + time
 * range). My-mode also surfaces "Pending request" rows so the
 * member can see + withdraw what's in flight.
 */
type Mode = 'mine' | 'team'

export default function MyScheduleWidget() {
  const { profile } = useAuth()
  const [mode, setMode] = useState<Mode>('mine')
  const [showModal, setShowModal] = useState(false)

  // Always pin to the current week. A future PR could add a chevron
  // navigator, but the user asked for "your schedule snapshot" on
  // Overview — surfacing this week keeps the widget compact + at-a-
  // glance, which is the whole point.
  const weekStart = useMemo(() => startOfWeek(new Date()), [])
  const range = useMemo(
    () => ({
      from: toLocalDateString(weekStart),
      to: toLocalDateString(endOfWeek(weekStart)),
    }),
    [weekStart],
  )

  const myId = profile?.id ?? ''

  // includePending=true ONLY for my-mode (so the member sees their
  // own pending requests inline). Team-mode hides pending — those
  // belong to other people's eyes only until approved.
  const { expanded, pendingBlocks, loading, refresh } = useTeamSchedule({
    range,
    memberId: mode === 'mine' && myId ? myId : undefined,
    includePending: mode === 'mine',
  })

  // Member names for team-mode rows. Cached; same key as the rest of
  // the app.
  const { data: teamMembers = [] } = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
    staleTime: 60_000,
  })
  const memberNameById = useMemo(() => {
    const map = new Map<string, string>()
    teamMembers.forEach((m) => map.set(m.id, m.display_name || 'Member'))
    return map
  }, [teamMembers])

  // Bucket by date for a 7-day stacked list. Always render all 7
  // days even when empty — "Tue · nothing scheduled" reads as a clear
  // statement, blank gaps look broken.
  const days = useMemo(() => {
    const out: { key: string; date: Date; entries: ExpandedSchedule[] }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      out.push({ key: toLocalDateString(d), date: d, entries: [] })
    }
    const byKey = new Map(out.map((d) => [d.key, d]))
    for (const e of expanded) {
      const key = toLocalDateString(new Date(e.starts_at))
      const bucket = byKey.get(key)
      if (bucket) bucket.entries.push(e)
    }
    // Pending blocks (my-mode only) are already in `expanded` since
    // we passed includePending=true.
    return out
  }, [expanded, weekStart])

  const headerLabel = useMemo(() => {
    const end = endOfWeek(weekStart)
    const sLabel = weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })
    const eLabel = end.toLocaleDateString([], { month: 'short', day: 'numeric' })
    return `${sLabel} – ${eLabel}`
  }, [weekStart])

  return (
    <div className="h-full flex flex-col">
      {/* Header: title row + mode toggle + Request button */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarRange size={14} className="text-purple-300 shrink-0" aria-hidden="true" />
          <span className="text-[11px] text-text-light truncate">{headerLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="inline-flex bg-surface-alt rounded-md p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setMode('mine')}
              aria-pressed={mode === 'mine'}
              className={`px-2 py-0.5 rounded transition-colors ${
                mode === 'mine' ? 'bg-surface text-gold shadow-sm font-semibold' : 'text-text-muted hover:text-text'
              }`}
            >
              Mine
            </button>
            <button
              type="button"
              onClick={() => setMode('team')}
              aria-pressed={mode === 'team'}
              className={`px-2 py-0.5 rounded transition-colors ${
                mode === 'team' ? 'bg-surface text-gold shadow-sm font-semibold' : 'text-text-muted hover:text-text'
              }`}
            >
              Team
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            aria-label="Request schedule block"
            title="Request a schedule block (admin approves)"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-border bg-surface-alt text-text-muted hover:text-gold hover:border-gold/40 transition-colors"
          >
            <Plus size={11} aria-hidden="true" />
            Request
          </button>
        </div>
      </div>

      {/* 7-day stacked list */}
      <div className="flex-1 overflow-y-auto pr-0.5">
        {loading ? (
          <div className="h-24 flex items-center justify-center text-text-muted">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          </div>
        ) : (
          <div className="space-y-1">
            {days.map((d) => (
              <DayRow
                key={d.key}
                date={d.date}
                entries={d.entries}
                mode={mode}
                memberNameById={memberNameById}
                onWithdraw={async (id) => {
                  await withdrawScheduleRequest(id)
                  await refresh()
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pending-summary footer (only when in my-mode and there's
          something in flight). Quick recap so the member knows they
          have a proposal waiting. */}
      {mode === 'mine' && pendingBlocks.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border text-[10px] text-text-muted">
          {pendingBlocks.length} pending {pendingBlocks.length === 1 ? 'request' : 'requests'} awaiting admin review
        </div>
      )}

      {showModal && myId && (
        <RequestModal
          memberId={myId}
          onClose={() => setShowModal(false)}
          onCreated={async () => {
            setShowModal(false)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

// ─── One day row ───────────────────────────────────────────────────

function DayRow({
  date,
  entries,
  mode,
  memberNameById,
  onWithdraw,
}: {
  date: Date
  entries: ExpandedSchedule[]
  mode: Mode
  memberNameById: Map<string, string>
  onWithdraw: (id: string) => Promise<void>
}) {
  const dayName = date.toLocaleDateString([], { weekday: 'short' })
  const dayNum = date.toLocaleDateString([], { day: 'numeric' })
  const isToday = toLocalDateString(date) === toLocalDateString(new Date())
  return (
    <div className={`flex items-start gap-2 px-2 py-1.5 rounded-md ${isToday ? 'bg-gold/[0.05]' : ''}`}>
      <div className="w-9 shrink-0 text-center">
        <p className={`text-[10px] uppercase font-semibold ${isToday ? 'text-gold' : 'text-text-muted'}`}>
          {dayName}
        </p>
        <p className={`text-[11px] ${isToday ? 'text-gold' : 'text-text-light'}`}>{dayNum}</p>
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        {entries.length === 0 ? (
          <p className="text-[10px] text-text-light italic pt-0.5">—</p>
        ) : (
          entries.map((e) => (
            <ScheduleChip
              key={e.key}
              entry={e}
              mode={mode}
              memberName={memberNameById.get(e.member_id) ?? 'Member'}
              onWithdraw={onWithdraw}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ScheduleChip({
  entry,
  mode,
  memberName,
  onWithdraw,
}: {
  entry: ExpandedSchedule
  mode: Mode
  memberName: string
  onWithdraw: (id: string) => Promise<void>
}) {
  const starts = new Date(entry.starts_at)
  const ends = new Date(entry.ends_at)
  const time = `${starts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${ends.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  const isPending = entry.status === 'pending'
  return (
    <div
      className={[
        'flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px]',
        isPending
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
          : 'border-purple-500/25 bg-purple-500/10 text-purple-100',
      ].join(' ')}
    >
      <ClockIcon size={10} className="opacity-70 shrink-0" aria-hidden="true" />
      <span className="font-medium truncate">{time}</span>
      {mode === 'team' && (
        <span className="opacity-70 truncate">· {memberName}</span>
      )}
      {isPending && (
        <span className="ml-auto inline-flex items-center gap-1 pl-1">
          <span className="text-[9px] uppercase tracking-wider opacity-80">Pending</span>
          {entry.source === 'block' && (
            <button
              type="button"
              onClick={() => onWithdraw(entry.source_id)}
              aria-label="Withdraw request"
              title="Withdraw this request"
              className="text-amber-200/80 hover:text-rose-200 transition-colors"
            >
              <X size={10} aria-hidden="true" />
            </button>
          )}
        </span>
      )}
    </div>
  )
}

// ─── Request modal ─────────────────────────────────────────────────

function RequestModal({
  memberId,
  onClose,
  onCreated,
}: {
  memberId: string
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const { toast } = useToast()
  const today = useMemo(() => toLocalDateString(new Date()), [])
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('18:00')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (endTime <= startTime) {
      toast('End time must be after start time', 'error')
      return
    }
    setSubmitting(true)
    try {
      // Local wall-clock → ISO timestamptz (browser TZ matches studio
      // for the team in practice).
      const starts = new Date(`${date}T${startTime}:00`)
      const ends = new Date(`${date}T${endTime}:00`)
      await requestScheduleBlock({
        member_id: memberId,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        note: note.trim() || null,
      })
      toast('Schedule request sent — admin will review', 'success')
      await onCreated()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send request', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Request schedule block">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md bg-surface rounded-2xl border border-border shadow-2xl p-5 space-y-4 animate-fade-in"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-text">Request schedule block</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Admin will review + approve. Withdraw anytime before they do.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-text-muted hover:text-text"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={today} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Start</label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">End</label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Reason (optional)</label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Cover for Sara, extra mixing time"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" type="submit" disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Send size={12} className="mr-1" />}
            Send request
          </Button>
        </div>
      </form>
    </div>
  )
}
