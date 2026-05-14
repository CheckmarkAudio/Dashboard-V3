// PR — Members admin "Activity" left-rail section.
//
// User asked for the per-member activity history to live as a left-
// rail section alongside Roster + Clock Data instead of a per-row
// drawer (which we shipped in #179 then moved here at user request).
// Same data — sessions / tasks / clock — just rendered into the
// right-pane instead of a 480px slide-over.
//
// Mirrors `ClockDataSection`'s shape: a section header with a
// member-picker dropdown, then a scrollable body. Picker defaults
// to the first active member alphabetically so the page renders
// useful content the moment the user clicks "Activity" — no empty
// "pick a member" landing screen.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Briefcase,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Clock3,
  Inbox,
  Loader2,
} from 'lucide-react'
import {
  useMemberAdminCompletedTasks,
  useMemberAdminSessions,
  useMemberClockEntries,
  useMemberStats,
} from '../../lib/queries/memberProfile'
import { Select } from '../ui'
import type { TeamMember } from '../../types'
import type { AdminClockEntry } from '../../lib/queries/timeClock'

const HISTORY_LIMIT = 20

export default function MemberActivitySection({ members }: { members: TeamMember[] }) {
  const memberOptions = useMemo(
    () =>
      [...members]
        .filter((m) => m.display_name)
        .sort((a, b) => {
          // Active members first, then alpha within each bucket.
          const aActive = (a.status ?? 'active') === 'active'
          const bActive = (b.status ?? 'active') === 'active'
          if (aActive !== bActive) return aActive ? -1 : 1
          return a.display_name.localeCompare(b.display_name)
        }),
    [members],
  )

  const [memberId, setMemberId] = useState<string>(() => memberOptions[0]?.id ?? '')

  const member = useMemo(
    () => memberOptions.find((m) => m.id === memberId) ?? null,
    [memberOptions, memberId],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity size={18} className="text-gold" aria-hidden="true" />
            Activity
          </h2>
          <p className="text-text-muted text-[12px] mt-0.5">
            Recent sessions, completed tasks, and shifts for one member at a glance.
          </p>
        </div>
        <div className="min-w-[220px]">
          <Select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            aria-label="Choose member to view activity"
          >
            {memberOptions.length === 0 && <option value="">No members</option>}
            {memberOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
                {m.status === 'inactive' ? ' · inactive' : ''}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {member ? (
        <ActivityBody member={member} />
      ) : (
        <div className="rounded-xl border border-border bg-surface-alt/40 px-4 py-12 flex flex-col items-center text-center">
          <Inbox size={20} className="text-text-light mb-2" aria-hidden="true" />
          <p className="text-[13px] text-text-muted">No team members yet.</p>
          <p className="text-[11px] text-text-light mt-1">
            Add members from the Roster tab to see their activity here.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Body ────────────────────────────────────────────────────────

function ActivityBody({ member }: { member: TeamMember }) {
  const stats = useMemberStats(member.id)
  const sessions = useMemberAdminSessions(member.id, HISTORY_LIMIT)
  const tasks = useMemberAdminCompletedTasks(member.id, HISTORY_LIMIT)
  const clockEntries = useMemberClockEntries(member.id, HISTORY_LIMIT)

  const hoursThisWeek = computeHoursThisWeek(clockEntries.data ?? [])

  return (
    <div className="space-y-4">
      {/* Member chip — confirms which member's activity is in view
          and gives a one-tap path to the public profile (admins
          often want to jump from "scan their last week" to "open
          their full profile"). */}
      <Link
        to={`/profile/${member.id}`}
        className="flex items-center gap-3 rounded-xl border border-border bg-surface-alt/40 px-4 py-3 hover:bg-surface-alt/60 transition-colors group"
      >
        <div className="w-10 h-10 rounded-full bg-surface-alt border-[2px] border-white/12 text-gold flex items-center justify-center text-[14px] font-bold shrink-0">
          {member.display_name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-text group-hover:text-gold transition-colors truncate">
            {member.display_name}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {member.position && (
              <span className="text-[11px] text-text-muted capitalize">
                {member.position.replace(/_/g, ' ')}
              </span>
            )}
            {member.role === 'admin' && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold">
                Admin
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-light">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  (member.status ?? 'active') === 'active' ? 'bg-emerald-400' : 'bg-text-light'
                }`}
                aria-hidden="true"
              />
              {(member.status ?? 'active') === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        <ChevronRight
          size={16}
          className="text-text-light group-hover:text-gold transition-colors"
          aria-hidden="true"
        />
      </Link>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          icon={<CalendarCheck2 size={14} className="text-gold/80" aria-hidden="true" />}
          label="Sessions · MTD"
          value={
            stats.isLoading ? <InlineSpinner /> :
            stats.error ? '—' :
            String(stats.data?.sessionsThisMonth ?? 0)
          }
        />
        <StatTile
          icon={<ClipboardCheck size={14} className="text-gold/80" aria-hidden="true" />}
          label="Tasks · 7d"
          value={
            stats.isLoading ? <InlineSpinner /> :
            stats.error ? '—' :
            String(stats.data?.tasksCompletedThisWeek ?? 0)
          }
        />
        <StatTile
          icon={<Clock3 size={14} className="text-gold/80" aria-hidden="true" />}
          label="Hours · 7d"
          value={
            clockEntries.isLoading ? <InlineSpinner /> :
            clockEntries.error ? '—' :
            hoursThisWeek
          }
        />
      </div>

      <ListSection
        title="Booking history"
        icon={<Briefcase size={12} className="text-gold/70" aria-hidden="true" />}
        loading={sessions.isLoading}
        error={sessions.error}
        empty={!sessions.isLoading && (sessions.data?.length ?? 0) === 0}
        emptyLabel="No sessions on record yet."
        countLabel={
          sessions.data && sessions.data.length > 0
            ? `${sessions.data.length} most recent`
            : undefined
        }
      >
        {sessions.data?.map((s) => (
          <li key={s.sessionId} className="px-4 py-2.5 hover:bg-surface-alt/60 transition-colors">
            <Link
              to="/sessions"
              className="block min-w-0"
              title={`${s.title} · ${s.dateLabel}${s.room ? ` · ${s.room}` : ''}`}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('highlight-session', { detail: { sessionId: s.sessionId } }),
                )
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-medium text-text truncate">{s.title}</p>
                <span className="text-[11px] text-text-light tabular-nums shrink-0">{s.dateLabel}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {s.room && (
                  <span className="text-[11px] text-text-muted truncate">{s.room}</span>
                )}
                {s.status && s.status !== 'scheduled' && (
                  <span className="text-[10px] uppercase tracking-wider text-text-light">
                    {s.status}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ListSection>

      <ListSection
        title="Task completions"
        icon={<CheckCircle2 size={12} className="text-gold/70" aria-hidden="true" />}
        loading={tasks.isLoading}
        error={tasks.error}
        empty={!tasks.isLoading && (tasks.data?.length ?? 0) === 0}
        emptyLabel="No completed tasks yet."
        countLabel={
          tasks.data && tasks.data.length > 0
            ? `${tasks.data.length} most recent`
            : undefined
        }
      >
        {tasks.data?.map((t) => (
          <li key={t.taskId} className="px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-medium text-text truncate" title={t.title}>{t.title}</p>
              <span className="text-[11px] text-text-light tabular-nums shrink-0">{t.relativeLabel}</span>
            </div>
          </li>
        ))}
      </ListSection>

      <ListSection
        title="Clock data"
        icon={<Clock size={12} className="text-gold/70" aria-hidden="true" />}
        loading={clockEntries.isLoading}
        error={clockEntries.error}
        empty={!clockEntries.isLoading && (clockEntries.data?.length ?? 0) === 0}
        emptyLabel="No shifts recorded yet."
        countLabel={
          clockEntries.data && clockEntries.data.length > 0
            ? `${clockEntries.data.length} most recent`
            : undefined
        }
      >
        {clockEntries.data?.map((e) => (
          <ClockEntryRow key={e.entry_id} entry={e} />
        ))}
      </ListSection>
    </div>
  )
}

// ─── Tiles + sections ────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt/40 px-3 py-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <p className="text-[10px] uppercase tracking-wider text-text-light font-semibold">
          {label}
        </p>
      </div>
      <p className="text-[18px] font-bold text-text tabular-nums leading-none">
        {value}
      </p>
    </div>
  )
}

function ListSection({
  title,
  icon,
  loading,
  error,
  empty,
  emptyLabel,
  countLabel,
  children,
}: {
  title: string
  icon: React.ReactNode
  loading: boolean
  error: unknown
  empty: boolean
  emptyLabel: string
  countLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-alt/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-[11px] font-semibold tracking-wider uppercase text-text-light">
            {title}
          </p>
        </div>
        {countLabel && (
          <p className="text-[10px] text-text-light tabular-nums">{countLabel}</p>
        )}
      </div>
      {error ? (
        <div className="px-4 py-4 text-[12px] text-rose-300">
          Failed to load. {error instanceof Error ? error.message : ''}
        </div>
      ) : loading ? (
        <div className="px-4 py-6 flex items-center justify-center text-text-light">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        </div>
      ) : empty ? (
        <div className="px-4 py-5 flex flex-col items-center text-center text-text-light">
          <Inbox size={16} className="mb-1.5" aria-hidden="true" />
          <p className="text-[11px] italic">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/40 max-h-[360px] overflow-y-auto">
          {children}
        </ul>
      )}
    </div>
  )
}

function ClockEntryRow({ entry }: { entry: AdminClockEntry }) {
  const isOpen = entry.clocked_out_at === null
  return (
    <li className="px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-text">
          {formatDateTime(entry.clocked_in_at)}
          <ChevronRight size={11} className="inline mx-1 text-text-light" aria-hidden="true" />
          {isOpen ? (
            <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-wider align-middle">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              On shift
            </span>
          ) : (
            <span className="text-text-muted">{formatDateTime(entry.clocked_out_at!)}</span>
          )}
        </p>
        <span className="text-[11px] text-text-light tabular-nums shrink-0">
          {formatDuration(entry.duration_minutes)}
        </span>
      </div>
      {entry.notes && (
        <p className="text-[11px] text-text-light line-clamp-2 mt-0.5">
          {entry.notes}
        </p>
      )}
    </li>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────

function InlineSpinner() {
  return (
    <span className="inline-flex">
      <Loader2 size={14} className="animate-spin text-text-light" aria-hidden="true" />
    </span>
  )
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (remainder === 0) return `${hours}h`
  return `${hours}h ${remainder}m`
}

function computeHoursThisWeek(entries: AdminClockEntry[]): string {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  let totalMinutes = 0
  for (const entry of entries) {
    const startedAt = Date.parse(entry.clocked_in_at)
    if (Number.isNaN(startedAt) || startedAt < cutoff) continue
    if (entry.duration_minutes !== null && entry.duration_minutes !== undefined) {
      totalMinutes += entry.duration_minutes
    } else {
      totalMinutes += Math.max(0, Math.floor((Date.now() - startedAt) / 60_000))
    }
  }
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = totalMinutes / 60
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
}
