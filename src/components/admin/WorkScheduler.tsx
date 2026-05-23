import { useMemo, useState } from 'react'
import {
  CalendarRange, Loader2, Inbox, Plus, Trash2, Check, X as XIcon, Clock as ClockIcon,
} from 'lucide-react'
import { Select, Button, Input } from '../ui'
import { useTeamSchedule } from '../../lib/schedule/useTeamSchedule'
import {
  approveBlock,
  createBlockAsAdmin,
  createRecurring,
  deleteBlock,
  deleteRecurring,
  denyBlock,
} from '../../lib/schedule/mutations'
import {
  endOfWeek,
  formatTimeRange,
  startOfWeek,
  toLocalDateString,
  weekdayLabel,
} from '../../lib/schedule/expand'
import { STUDIO_WORK_WEEK, type TeamMember, type Weekday } from '../../types'
import { useToast } from '../Toast'

/**
 * Members → Work Scheduler section.
 *
 * Three stacked panels, in priority order:
 *
 *   1. **Pending requests** — member-proposed blocks waiting for
 *      admin review. Approve / Deny inline (optional reviewer note).
 *      Only renders when there's at least one pending row.
 *   2. **Recurring weekly schedule** — the canonical hours grid.
 *      Add-row form defaults to studio's Tue–Sat work week.
 *   3. **Upcoming one-off blocks** — overrides + coverage shifts
 *      for the visible week. Week-navigator at the top scopes
 *      what's shown (and the blocks fetch).
 *
 * A single member-filter dropdown gates all three. Defaults to "All
 * members" so admins see the whole-team picture at a glance.
 */
interface WorkSchedulerProps {
  members: TeamMember[]
  adminId: string
}

const ALL_MEMBERS = '__all__' as const

export default function WorkScheduler({ members, adminId }: WorkSchedulerProps) {
  const [memberFilter, setMemberFilter] = useState<string>(ALL_MEMBERS)
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => startOfWeek(new Date()))

  const memberOptions = useMemo(
    () =>
      [...members]
        .filter((m) => m.display_name && m.status !== 'inactive')
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [members],
  )

  const memberById = useMemo(() => {
    const map = new Map<string, TeamMember>()
    members.forEach((m) => map.set(m.id, m))
    return map
  }, [members])

  const memberId = memberFilter === ALL_MEMBERS ? undefined : memberFilter
  const range = useMemo(
    () => ({
      from: toLocalDateString(weekAnchor),
      to: toLocalDateString(endOfWeek(weekAnchor)),
    }),
    [weekAnchor],
  )

  const { recurring, blocks, pendingBlocks, loading, error, refresh } = useTeamSchedule({
    range,
    memberId,
    includePending: true,
  })

  // Pending block review (separate from main blocks list since we
  // also want to show pending outside the current week — they're
  // not week-scoped, just waiting). Pull recent pending across all
  // ranges by fetching without range filter... actually
  // useTeamSchedule already returns pendingBlocks within range. For
  // PR 1 that's good enough; if a request reaches >1wk out we'll
  // widen the fetch later.
  const filteredRecurring = useMemo(() => {
    return [...recurring].sort((a, b) => {
      if (a.member_id !== b.member_id) {
        const an = memberById.get(a.member_id)?.display_name ?? ''
        const bn = memberById.get(b.member_id)?.display_name ?? ''
        return an.localeCompare(bn)
      }
      return a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)
    })
  }, [recurring, memberById])

  const oneOffBlocks = useMemo(() => {
    return blocks
      .filter((b) => b.status === 'approved')
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }, [blocks])

  const weekLabel = useMemo(() => {
    const end = endOfWeek(weekAnchor)
    const startLabel = weekAnchor.toLocaleDateString([], { month: 'short', day: 'numeric' })
    const endLabel = end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    return `${startLabel} – ${endLabel}`
  }, [weekAnchor])

  function shiftWeek(deltaWeeks: number) {
    const next = new Date(weekAnchor)
    next.setDate(next.getDate() + deltaWeeks * 7)
    setWeekAnchor(startOfWeek(next))
  }

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CalendarRange size={18} className="text-gold" aria-hidden="true" />
            Work Scheduler
          </h2>
          <p className="text-text-muted text-[12px] mt-0.5">
            Studio work week is <span className="font-semibold text-text">Tue–Sat</span>.
            Set recurring hours per member; add one-off blocks for coverage or schedule changes.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1 bg-surface-alt rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => shiftWeek(-1)}
              className="px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface transition-colors"
              aria-label="Previous week"
            >
              ‹
            </button>
            <span className="px-2 text-[12px] text-text font-semibold">{weekLabel}</span>
            <button
              type="button"
              onClick={() => shiftWeek(1)}
              className="px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface transition-colors"
              aria-label="Next week"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setWeekAnchor(startOfWeek(new Date()))}
              className="ml-1 px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface transition-colors"
            >
              This week
            </button>
          </div>
          <div className="min-w-[200px]">
            <Select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              aria-label="Filter schedule by member"
            >
              <option value={ALL_MEMBERS}>All members</option>
              {memberOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.display_name}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-300">
          Failed to load schedule. {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-6 text-text-muted">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        </div>
      )}

      {/* ── Pending requests panel (only when something to review) ── */}
      {pendingBlocks.length > 0 && (
        <PendingRequestsPanel
          blocks={pendingBlocks}
          memberById={memberById}
          adminId={adminId}
          onChange={refresh}
        />
      )}

      {/* ── Recurring weekly schedule ── */}
      <RecurringPanel
        rows={filteredRecurring}
        memberOptions={memberOptions}
        memberById={memberById}
        memberFilter={memberFilter}
        adminId={adminId}
        onChange={refresh}
      />

      {/* ── One-off blocks for the visible week ── */}
      <OneOffPanel
        blocks={oneOffBlocks}
        memberOptions={memberOptions}
        memberById={memberById}
        memberFilter={memberFilter}
        adminId={adminId}
        weekStart={weekAnchor}
        onChange={refresh}
      />
    </div>
  )
}

// ─── Pending requests ──────────────────────────────────────────────

function PendingRequestsPanel({
  blocks,
  memberById,
  adminId,
  onChange,
}: {
  blocks: import('../../types').ScheduleBlock[]
  memberById: Map<string, TeamMember>
  adminId: string
  onChange: () => Promise<void>
}) {
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleApprove(id: string) {
    setBusyId(id)
    try {
      await approveBlock(id, adminId)
      toast('Schedule request approved', 'success')
      await onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to approve', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeny(id: string) {
    setBusyId(id)
    try {
      await denyBlock(id, adminId)
      toast('Schedule request denied', 'success')
      await onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to deny', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Inbox size={16} className="text-amber-300" aria-hidden="true" />
        <h3 className="text-sm font-bold text-text">
          Pending requests ({blocks.length})
        </h3>
      </div>
      <div className="space-y-2">
        {blocks.map((b) => {
          const member = memberById.get(b.member_id)
          const starts = new Date(b.starts_at)
          const ends = new Date(b.ends_at)
          return (
            <div
              key={b.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface border border-border"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-text truncate">
                  {member?.display_name ?? b.member_id}
                </div>
                <div className="text-[11px] text-text-muted">
                  {starts.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                  · {starts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  {' – '}
                  {ends.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  {b.note ? ` · ${b.note}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeny(b.id)}
                  disabled={busyId === b.id}
                  aria-label="Deny request"
                >
                  <XIcon size={14} className="text-rose-300" />
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleApprove(b.id)}
                  disabled={busyId === b.id}
                >
                  {busyId === b.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span className="ml-1">Approve</span>
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Recurring panel ───────────────────────────────────────────────

function RecurringPanel({
  rows,
  memberOptions,
  memberById,
  memberFilter,
  adminId,
  onChange,
}: {
  rows: import('../../types').ScheduleRecurring[]
  memberOptions: TeamMember[]
  memberById: Map<string, TeamMember>
  memberFilter: string
  adminId: string
  onChange: () => Promise<void>
}) {
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setBusyId(id)
    try {
      await deleteRecurring(id)
      toast('Recurring rule removed', 'success')
      await onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="border border-border bg-surface-alt/40 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <ClockIcon size={14} className="text-gold" aria-hidden="true" />
            Recurring weekly hours
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            Default canonical schedule. New rules default to Tue–Sat.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} className="mr-1" />
          Add rule
        </Button>
      </div>

      {showForm && (
        <RecurringForm
          memberOptions={memberOptions}
          defaultMemberId={memberFilter !== ALL_MEMBERS ? memberFilter : ''}
          adminId={adminId}
          onCancel={() => setShowForm(false)}
          onCreated={async () => {
            setShowForm(false)
            await onChange()
          }}
        />
      )}

      {rows.length === 0 ? (
        <div className="text-center py-6 text-[12px] text-text-muted">
          No recurring rules yet. Click <span className="font-semibold text-text">Add rule</span> to set canonical hours.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <table className="w-full text-left">
            <thead className="bg-surface-alt text-[10px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="py-2 px-3 font-semibold">Member</th>
                <th className="py-2 px-3 font-semibold">Day</th>
                <th className="py-2 px-3 font-semibold">Hours</th>
                <th className="py-2 px-3 font-semibold">Note</th>
                <th className="py-2 px-3 font-semibold w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const member = memberById.get(r.member_id)
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-surface-hover transition-colors">
                    <td className="py-2 px-3 text-[13px] text-text">{member?.display_name ?? r.member_id}</td>
                    <td className="py-2 px-3 text-[13px] text-text-muted">{weekdayLabel(r.weekday, 'long')}</td>
                    <td className="py-2 px-3 text-[13px] text-text">{formatTimeRange(r.start_time, r.end_time)}</td>
                    <td className="py-2 px-3 text-[12px] text-text-muted">{r.note ?? '—'}</td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        disabled={busyId === r.id}
                        aria-label="Remove rule"
                        className="text-text-muted hover:text-rose-300 disabled:opacity-50"
                      >
                        {busyId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function RecurringForm({
  memberOptions,
  defaultMemberId,
  adminId,
  onCancel,
  onCreated,
}: {
  memberOptions: TeamMember[]
  defaultMemberId: string
  adminId: string
  onCancel: () => void
  onCreated: () => Promise<void>
}) {
  const { toast } = useToast()
  const [memberId, setMemberId] = useState(defaultMemberId || memberOptions[0]?.id || '')
  const [weekdays, setWeekdays] = useState<Set<Weekday>>(new Set(STUDIO_WORK_WEEK))
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('18:00')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function toggleWeekday(w: Weekday) {
    setWeekdays((prev) => {
      const next = new Set(prev)
      if (next.has(w)) next.delete(w)
      else next.add(w)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!memberId || weekdays.size === 0) {
      toast('Pick a member + at least one weekday', 'error')
      return
    }
    if (endTime <= startTime) {
      toast('End time must be after start time', 'error')
      return
    }
    setSubmitting(true)
    try {
      // One row per selected weekday. Studio's Tue–Sat default
      // creates 5 rows in one go.
      await Promise.all(
        Array.from(weekdays).map((w) =>
          createRecurring(
            {
              member_id: memberId,
              weekday: w,
              start_time: startTime,
              end_time: endTime,
              note: note.trim() || null,
            },
            adminId,
          ),
        ),
      )
      toast(`Added ${weekdays.size} recurring ${weekdays.size === 1 ? 'rule' : 'rules'}`, 'success')
      await onCreated()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 p-3 rounded-lg border border-border bg-surface space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Member</label>
          <Select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {memberOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </Select>
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
        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">
          Weekdays <span className="text-text-light">(Tue–Sat is the studio default)</span>
        </label>
        <div className="flex items-center gap-1">
          {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((w) => {
            const active = weekdays.has(w)
            const isStudioDay = STUDIO_WORK_WEEK.includes(w)
            return (
              <button
                key={w}
                type="button"
                onClick={() => toggleWeekday(w)}
                aria-pressed={active}
                className={[
                  'flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors border',
                  active
                    ? 'bg-gold text-black border-gold'
                    : isStudioDay
                      ? 'bg-surface-alt text-text-muted border-border hover:text-text'
                      : 'bg-transparent text-text-light border-border/60 hover:text-text-muted',
                ].join(' ')}
              >
                {weekdayLabel(w)}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Note (optional)</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Closing shift" />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} type="button">Cancel</Button>
        <Button variant="primary" size="sm" type="submit" disabled={submitting}>
          {submitting && <Loader2 size={14} className="animate-spin mr-1" />}
          Save
        </Button>
      </div>
    </form>
  )
}

// ─── One-off blocks ────────────────────────────────────────────────

function OneOffPanel({
  blocks,
  memberOptions,
  memberById,
  memberFilter,
  adminId,
  weekStart,
  onChange,
}: {
  blocks: import('../../types').ScheduleBlock[]
  memberOptions: TeamMember[]
  memberById: Map<string, TeamMember>
  memberFilter: string
  adminId: string
  weekStart: Date
  onChange: () => Promise<void>
}) {
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setBusyId(id)
    try {
      await deleteBlock(id)
      toast('Block removed', 'success')
      await onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="border border-border bg-surface-alt/40 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-text">One-off blocks (this week)</h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            Coverage, special shifts, schedule overrides. Renders on top of recurring hours.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} className="mr-1" />
          Add block
        </Button>
      </div>

      {showForm && (
        <OneOffForm
          memberOptions={memberOptions}
          defaultMemberId={memberFilter !== ALL_MEMBERS ? memberFilter : ''}
          adminId={adminId}
          weekStart={weekStart}
          onCancel={() => setShowForm(false)}
          onCreated={async () => {
            setShowForm(false)
            await onChange()
          }}
        />
      )}

      {blocks.length === 0 ? (
        <div className="text-center py-6 text-[12px] text-text-muted">
          No one-off blocks this week.
        </div>
      ) : (
        <div className="space-y-1.5">
          {blocks.map((b) => {
            const member = memberById.get(b.member_id)
            const starts = new Date(b.starts_at)
            const ends = new Date(b.ends_at)
            return (
              <div
                key={b.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface border border-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-text truncate">
                    {member?.display_name ?? b.member_id}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {starts.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                    · {starts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    {' – '}
                    {ends.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    {b.note ? ` · ${b.note}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(b.id)}
                  disabled={busyId === b.id}
                  aria-label="Remove block"
                  className="text-text-muted hover:text-rose-300 disabled:opacity-50"
                >
                  {busyId === b.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function OneOffForm({
  memberOptions,
  defaultMemberId,
  adminId,
  weekStart,
  onCancel,
  onCreated,
}: {
  memberOptions: TeamMember[]
  defaultMemberId: string
  adminId: string
  weekStart: Date
  onCancel: () => void
  onCreated: () => Promise<void>
}) {
  const { toast } = useToast()
  const [memberId, setMemberId] = useState(defaultMemberId || memberOptions[0]?.id || '')
  const [date, setDate] = useState(toLocalDateString(weekStart))
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('18:00')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!memberId || !date) {
      toast('Pick a member + a date', 'error')
      return
    }
    if (endTime <= startTime) {
      toast('End time must be after start time', 'error')
      return
    }
    setSubmitting(true)
    try {
      // Convert local wall-clock date+time into ISO timestamptz. The
      // browser's TZ matches the studio's in practice.
      const starts = new Date(`${date}T${startTime}:00`)
      const ends = new Date(`${date}T${endTime}:00`)
      await createBlockAsAdmin(
        {
          member_id: memberId,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          note: note.trim() || null,
          status: 'approved',
        },
        adminId,
      )
      toast('One-off block added', 'success')
      await onCreated()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 p-3 rounded-lg border border-border bg-surface space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Member</label>
          <Select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {memberOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Note (optional)</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Covering for Sara" />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} type="button">Cancel</Button>
        <Button variant="primary" size="sm" type="submit" disabled={submitting}>
          {submitting && <Loader2 size={14} className="animate-spin mr-1" />}
          Save
        </Button>
      </div>
    </form>
  )
}
