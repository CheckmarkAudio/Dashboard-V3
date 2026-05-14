// PR — Members admin per-row activity drawer.
//
// User ask (2026-05-13): "lets do D. Members admin per-row activity
// drawer first" — clicking a member row in TeamManager should open a
// side drawer showing booking history + task completions + clock data
// without leaving the Members page.
//
// Mirrors the existing Add Member slide-over chrome (right edge,
// max-w-xl, backdrop blur, ESC + backdrop click to dismiss) so the
// page only ever has ONE drawer pattern. Sections reuse the
// StatsSidebar `<ListCard>` shape so the drawer feels like a deeper
// version of what's on the public profile.

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Clock3,
  Inbox,
  Loader2,
  X,
} from 'lucide-react'
import {
  useMemberAdminCompletedTasks,
  useMemberAdminSessions,
  useMemberClockEntries,
  useMemberStats,
} from '../../lib/queries/memberProfile'
import type { TeamMember } from '../../types'
import type { AdminClockEntry } from '../../lib/queries/timeClock'

interface MemberActivityDrawerProps {
  member: TeamMember | null
  onClose: () => void
}

// History limits for the drawer. Larger than the profile sidebar's
// hard 5 cap, but still bounded so the drawer stays glanceable and
// the queries don't pull a year of data on every open.
const HISTORY_LIMIT = 20

export default function MemberActivityDrawer({ member, onClose }: MemberActivityDrawerProps) {
  // ESC-to-dismiss. Bound on the document so it works no matter what
  // inside the drawer has focus (mirrors the Add Member form's
  // implicit close on backdrop click).
  useEffect(() => {
    if (!member) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [member, onClose])

  if (!member) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-xl bg-surface border-l border-border shadow-2xl flex flex-col animate-slide-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-activity-drawer-title"
      >
        <DrawerHeader member={member} onClose={onClose} />
        <DrawerBody member={member} />
        <DrawerFooter member={member} />
      </aside>
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────

function DrawerHeader({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const initial = member.display_name?.charAt(0)?.toUpperCase() ?? '?'
  const positionLabel = member.position
    ? member.position.replace(/_/g, ' ')
    : null
  const isInactive = member.status === 'inactive'

  return (
    <div className="px-6 py-4 border-b border-border shrink-0 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-12 h-12 rounded-full bg-surface-alt border-[2px] border-white/12 text-gold flex items-center justify-center text-[16px] font-bold shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <h2
            id="member-activity-drawer-title"
            className="font-semibold text-base text-text truncate"
          >
            {member.display_name}
          </h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {positionLabel && (
              <span className="text-[11px] text-text-muted capitalize">
                {positionLabel}
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
                  isInactive ? 'bg-text-light' : 'bg-emerald-400'
                }`}
                aria-hidden="true"
              />
              {isInactive ? 'Inactive' : 'Active'}
            </span>
          </div>
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              className="block text-[11px] text-text-light truncate hover:text-gold transition-colors mt-1"
              title={`Email ${member.display_name}`}
            >
              {member.email}
            </a>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close activity drawer"
        className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors focus-ring shrink-0"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

// ─── Body ────────────────────────────────────────────────────────

function DrawerBody({ member }: { member: TeamMember }) {
  const stats = useMemberStats(member.id)
  const sessions = useMemberAdminSessions(member.id, HISTORY_LIMIT)
  const tasks = useMemberAdminCompletedTasks(member.id, HISTORY_LIMIT)
  const clockEntries = useMemberClockEntries(member.id, HISTORY_LIMIT)

  // Quick-win "hours this week" derived from the loaded shifts so we
  // don't add a new RPC for a single number. We sum minutes for any
  // shift whose clocked_in_at is within the last 7 days; open shifts
  // count their elapsed-so-far minutes.
  const hoursThisWeek = computeHoursThisWeek(clockEntries.data ?? [])

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
      {/* Stats strip — three quick KPIs in a row, matching the
          StatsSidebar tone but laid out horizontally since the
          drawer has more lateral room than the profile sidebar. */}
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

// ─── Footer ──────────────────────────────────────────────────────

function DrawerFooter({ member }: { member: TeamMember }) {
  return (
    <div className="px-6 py-3 border-t border-border shrink-0 flex items-center justify-between gap-2">
      <p className="text-[11px] text-text-light">
        Last 20 records per section · Live on every open
      </p>
      <Link
        to={`/profile/${member.id}`}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gold hover:text-gold/80 transition-colors"
      >
        View public profile
        <ChevronRight size={12} aria-hidden="true" />
      </Link>
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
        <ul className="divide-y divide-border/40 max-h-[320px] overflow-y-auto">
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

/**
 * Sums minutes from shifts in the last 7 days. Closed shifts use
 * `duration_minutes` from the RPC; open shifts count elapsed-so-far
 * so a member currently on the clock contributes accurately.
 */
function computeHoursThisWeek(entries: AdminClockEntry[]): string {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  let totalMinutes = 0
  for (const entry of entries) {
    const startedAt = Date.parse(entry.clocked_in_at)
    if (Number.isNaN(startedAt) || startedAt < cutoff) continue
    if (entry.duration_minutes !== null && entry.duration_minutes !== undefined) {
      totalMinutes += entry.duration_minutes
    } else {
      // Open shift — count minutes from clock-in to now.
      totalMinutes += Math.max(0, Math.floor((Date.now() - startedAt) / 60_000))
    }
  }
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = totalMinutes / 60
  // Show one decimal for partial hours, no decimal for round numbers.
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
}

