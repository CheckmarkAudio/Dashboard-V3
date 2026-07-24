import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarRange,
  Loader2,
  Plus,
  Clock as ClockIcon,
  Palmtree,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../Toast'
import {
  endOfWeek,
  formatTimeRange,
  startOfWeek,
  toLocalDateString,
  weekdayLabel,
} from '../../lib/schedule/expand'
import { useTeamSchedule } from '../../lib/schedule/useTeamSchedule'
import {
  requestRecurringDeletion,
  withdrawRecurringDeletionRequest,
  withdrawRecurringRequest,
  withdrawScheduleRequest,
} from '../../lib/schedule/mutations'
import {
  fetchTeamMembers,
  teamMemberKeys,
} from '../../lib/queries/teamMembers'
import ScheduleRequestModal from '../schedule/ScheduleRequestModal'
import type { ExpandedSchedule, ScheduleRecurring } from '../../types'

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
  const { expanded, recurring, pendingBlocks, pendingRecurring, recurringDeletionRequests, loading, refresh } = useTeamSchedule({
    range,
    memberId: mode === 'mine' && myId ? myId : undefined,
    includePending: mode === 'mine',
  })

  // My own approved recurring rules — surfaced in a "My weekly hours"
  // strip beneath the 7-day list so the member sees their canonical
  // schedule + can request removal of any rule with an X button. We
  // only show this in Mine mode (team-mode swap doesn't need the
  // edit affordances).
  const myApprovedRecurring = useMemo(() => {
    if (mode !== 'mine' || !myId) return [] as ScheduleRecurring[]
    return recurring
      .filter((r) => r.member_id === myId && r.status === 'approved' && r.active)
      .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
  }, [recurring, mode, myId])

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
    // A one-off block (e.g. a multi-day time-off request) carries a
    // single starts_at/ends_at span, not one row per day — bucket it
    // into every visible day it overlaps, not just its start day, or
    // a 3-day time-off request would only appear to cover day 1.
    for (const e of expanded) {
      const entryStart = toLocalDateString(new Date(e.starts_at))
      const entryEndInclusive = new Date(e.ends_at)
      entryEndInclusive.setMilliseconds(entryEndInclusive.getMilliseconds() - 1)
      const entryEnd = toLocalDateString(entryEndInclusive)
      for (const d of out) {
        if (d.key >= entryStart && d.key <= entryEnd) d.entries.push(e)
      }
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
            aria-label="Open schedule request options"
            title="Set weekly schedule, request one-time change, or see time-off status"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-border bg-surface-alt text-text-muted hover:text-gold hover:border-gold/40 transition-colors"
          >
            <Plus size={11} aria-hidden="true" />
            Request schedule
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
                onWithdrawBlock={async (id) => {
                  await withdrawScheduleRequest(id)
                  await refresh()
                }}
                onWithdrawRecurring={async (id) => {
                  await withdrawRecurringRequest(id)
                  await refresh()
                }}
              />
            ))}
          </div>
        )}

        {/* My approved recurring rules — only in Mine mode. Lets the
            member request removal of an approved rule (admin confirms)
            and undo a pending-deletion before admin acts. Mirrors the
            admin Work Scheduler's recurring table at member scale. */}
        {mode === 'mine' && myApprovedRecurring.length > 0 && (
          <MyRecurringStrip
            rules={myApprovedRecurring}
            onChange={refresh}
          />
        )}
      </div>

      {/* Pending-summary footer (only when in my-mode and there's
          something in flight). Quick recap so the member knows they
          have a proposal waiting. */}
      {mode === 'mine' && (pendingBlocks.length + pendingRecurring.length + recurringDeletionRequests.filter((r) => r.member_id === myId).length) > 0 && (
        <div className="mt-2 pt-2 border-t border-border text-[10px] text-text-muted">
          {pendingBlocks.length + pendingRecurring.length + recurringDeletionRequests.filter((r) => r.member_id === myId).length} pending {(pendingBlocks.length + pendingRecurring.length + recurringDeletionRequests.filter((r) => r.member_id === myId).length) === 1 ? 'request' : 'requests'} awaiting admin review
        </div>
      )}

      {showModal && myId && (
        <ScheduleRequestModal
          memberId={myId}
          onClose={() => setShowModal(false)}
          onSubmitted={async () => {
            setShowModal(false)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

// ─── My approved recurring rules ───────────────────────────────────
// Compact horizontal list rendered under the 7-day stack in Mine mode.
// Each rule shows weekday + time + an action button: X to request
// removal (clean approved rule) or Undo to cancel a pending-deletion
// request before admin acts.
function MyRecurringStrip({
  rules,
  onChange,
}: {
  rules: ScheduleRecurring[]
  onChange: () => Promise<void>
}) {
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleDeleteRequest(id: string) {
    if (!confirm('Ask admin to remove this rule from your schedule?')) return
    setBusyId(id)
    try {
      await requestRecurringDeletion(id, null)
      toast('Removal request sent — admin will review', 'success')
      await onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to request removal', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function handleUndo(id: string) {
    setBusyId(id)
    try {
      await withdrawRecurringDeletionRequest(id)
      toast('Removal request withdrawn', 'success')
      await onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to withdraw', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-text-muted px-2 mb-1.5">
        My weekly hours
      </p>
      <div className="flex flex-wrap gap-1 px-1">
        {rules.map((r) => {
          const pendingDelete = r.pending_deletion
          return (
            <div
              key={r.id}
              className={[
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px]',
                pendingDelete
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
                  : 'border-purple-500/20 bg-purple-700/10 text-purple-100',
              ].join(' ')}
              title={pendingDelete ? 'Removal pending admin review' : undefined}
            >
              <span className="font-semibold">{weekdayLabel(r.weekday)}</span>
              <span className="opacity-70">{formatTimeRange(r.start_time, r.end_time)}</span>
              {pendingDelete ? (
                <button
                  type="button"
                  onClick={() => handleUndo(r.id)}
                  disabled={busyId === r.id}
                  aria-label="Undo removal request"
                  title="Undo removal request"
                  className="text-rose-200/80 hover:text-rose-100 transition-colors disabled:opacity-50"
                >
                  {busyId === r.id ? <Loader2 size={10} className="animate-spin" /> : <Undo2 size={10} />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDeleteRequest(r.id)}
                  disabled={busyId === r.id}
                  aria-label="Request to remove this rule"
                  title="Request to remove"
                  className="text-purple-200/70 hover:text-rose-200 transition-colors disabled:opacity-50"
                >
                  {busyId === r.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── One day row ───────────────────────────────────────────────────

function DayRow({
  date,
  entries,
  mode,
  memberNameById,
  onWithdrawBlock,
  onWithdrawRecurring,
}: {
  date: Date
  entries: ExpandedSchedule[]
  mode: Mode
  memberNameById: Map<string, string>
  onWithdrawBlock: (id: string) => Promise<void>
  onWithdrawRecurring: (id: string) => Promise<void>
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
              onWithdrawBlock={onWithdrawBlock}
              onWithdrawRecurring={onWithdrawRecurring}
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
  onWithdrawBlock,
  onWithdrawRecurring,
}: {
  entry: ExpandedSchedule
  mode: Mode
  memberName: string
  onWithdrawBlock: (id: string) => Promise<void>
  onWithdrawRecurring: (id: string) => Promise<void>
}) {
  const starts = new Date(entry.starts_at)
  const ends = new Date(entry.ends_at)
  const isTimeOff = entry.kind === 'time_off'
  // Time off is stored as a full-day span (00:00 -> next-day 00:00),
  // so a literal time-of-day readout ("12:00 AM - 12:00 AM") would be
  // confusing here — the day itself is already the unit shown by this
  // chip's position in the 7-day list.
  const time = isTimeOff
    ? (entry.note ?? 'All day')
    : `${starts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${ends.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  const isPending = entry.status === 'pending'
  return (
    <div
      className={[
        'flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px]',
        isPending
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
          : isTimeOff
            ? 'border-sky-500/30 bg-sky-500/10 text-sky-100'
            : 'border-purple-500/20 bg-purple-700/10 text-purple-100',
      ].join(' ')}
    >
      {isTimeOff ? (
        <Palmtree size={10} className="opacity-70 shrink-0" aria-hidden="true" />
      ) : (
        <ClockIcon size={10} className="opacity-70 shrink-0" aria-hidden="true" />
      )}
      {isTimeOff && <span className="font-semibold shrink-0">Time off</span>}
      <span className="font-medium truncate">{time}</span>
      {mode === 'team' && (
        <span className="opacity-70 truncate">· {memberName}</span>
      )}
      {isPending && (
        <span className="ml-auto inline-flex items-center gap-1 pl-1">
          <span className="text-[9px] uppercase tracking-wider opacity-80">
            {entry.source === 'recurring' ? 'Pending weekly' : 'Pending'}
          </span>
          <button
            type="button"
            onClick={() =>
              entry.source === 'block'
                ? onWithdrawBlock(entry.source_id)
                : onWithdrawRecurring(entry.source_id)
            }
            aria-label="Withdraw request"
            title="Withdraw this request"
            className="text-amber-200/80 hover:text-rose-200 transition-colors"
          >
            <X size={10} aria-hidden="true" />
          </button>
        </span>
      )}
    </div>
  )
}

// In-file RequestModal removed 2026-05-23 — replaced by the shared
// ScheduleRequestModal under src/components/schedule which adds the
// "Recurring weekly" tab and is reused by the Calendar page entry
// points (header pill + right-click cell context menu).
