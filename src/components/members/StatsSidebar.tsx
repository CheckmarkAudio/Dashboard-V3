import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Inbox,
  Loader2,
  Trophy,
} from 'lucide-react'
import {
  useMemberRecentCompletedTasks,
  useMemberRecentSessions,
  useMemberStats,
} from '../../lib/queries/memberProfile'
import type { TeamMember } from '../../types'

/**
 * Stats sidebar shown to the right of a profile's main column.
 *
 * Sections (top → bottom):
 *   1. Stats — Member since, Sessions this month, Tasks done · 7d
 *   2. Recent Sessions — last 5 sessions assigned to the member
 *   3. Recent Task Completions — last 5 completed tasks
 *   4. Achievements placeholder (Tier 2 future)
 *
 * Each query lives behind react-query so cache is shared with any
 * future surface that wants the same data.
 */

interface StatsSidebarProps {
  member: TeamMember
}

export default function StatsSidebar({ member }: StatsSidebarProps) {
  const stats = useMemberStats(member.id)
  const recentSessions = useMemberRecentSessions(member.id)
  const recentTasks = useMemberRecentCompletedTasks(member.id)

  const memberSince = useMemo(() => {
    if (!member.created_at) return null
    const created = new Date(member.created_at)
    if (Number.isNaN(created.getTime())) return null
    const month = created.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)))
    let tenure: string
    if (days < 30) tenure = `${days} day${days === 1 ? '' : 's'}`
    else if (days < 365) {
      const months = Math.floor(days / 30)
      tenure = `${months} month${months === 1 ? '' : 's'}`
    } else {
      const years = Math.floor(days / 365)
      const remMonths = Math.floor((days % 365) / 30)
      tenure = remMonths === 0
        ? `${years} year${years === 1 ? '' : 's'}`
        : `${years}y ${remMonths}mo`
    }
    return { month, tenure }
  }, [member.created_at])

  return (
    <aside className="space-y-4">
      {/* Stats card */}
      <div className="rounded-xl border border-border bg-surface-alt/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-alt/60">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-text-light">
            Stats
          </p>
        </div>
        <ul className="divide-y divide-border/40">
          {memberSince && (
            <StatRow
              icon={<Clock3 size={14} className="text-text-light" aria-hidden="true" />}
              label="Member since"
              value={memberSince.month}
              subValue={memberSince.tenure}
            />
          )}
          <StatRow
            icon={<CalendarCheck2 size={14} className="text-text-light" aria-hidden="true" />}
            label="Sessions this month"
            value={
              stats.isLoading ? <InlineSpinner /> :
              stats.error ? '—' :
              String(stats.data?.sessionsThisMonth ?? 0)
            }
          />
          <StatRow
            icon={<ClipboardCheck size={14} className="text-text-light" aria-hidden="true" />}
            label="Tasks done · 7d"
            value={
              stats.isLoading ? <InlineSpinner /> :
              stats.error ? '—' :
              String(stats.data?.tasksCompletedThisWeek ?? 0)
            }
          />
        </ul>
      </div>

      {/* Recent Sessions card — last 5 non-cancelled sessions
          assigned to this member, newest first. Click jumps to
          /sessions where the existing highlight pattern flashes
          the row. */}
      <ListCard
        title="Recent sessions"
        icon={<Briefcase size={12} className="text-gold/70" aria-hidden="true" />}
        loading={recentSessions.isLoading}
        empty={
          !recentSessions.isLoading &&
          (recentSessions.data?.length ?? 0) === 0
        }
        emptyLabel="No sessions on record yet."
      >
        {recentSessions.data?.map((s) => (
          <li key={s.sessionId} className="px-4 py-2 hover:bg-surface-alt/60 transition-colors">
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
                <p className="text-[12px] font-medium text-text truncate">{s.title}</p>
                <span className="text-[10px] text-text-light tabular-nums shrink-0">{s.dateLabel}</span>
              </div>
              {s.room && (
                <p className="text-[11px] text-text-light truncate">{s.room}</p>
              )}
            </Link>
          </li>
        ))}
      </ListCard>

      {/* Recent Task Completions card — last 5 tasks the member
          completed, newest first. No deep-link target yet (the
          tasks page doesn't yet support per-task highlight); the
          relative time + title is enough for a glanceable
          activity feed. */}
      <ListCard
        title="Recent task completions"
        icon={<CheckCircle2 size={12} className="text-gold/70" aria-hidden="true" />}
        loading={recentTasks.isLoading}
        empty={
          !recentTasks.isLoading &&
          (recentTasks.data?.length ?? 0) === 0
        }
        emptyLabel="No completed tasks yet."
      >
        {recentTasks.data?.map((t) => (
          <li key={t.taskId} className="px-4 py-2 hover:bg-surface-alt/60 transition-colors">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-medium text-text truncate" title={t.title}>{t.title}</p>
              <span className="text-[10px] text-text-light tabular-nums shrink-0">{t.relativeLabel}</span>
            </div>
          </li>
        ))}
      </ListCard>

      {/* Achievements placeholder (real in Tier 2). Showing the shape
          now so the layout reads as "this is intentional" instead of
          "missing section." */}
      <div className="rounded-xl border border-border border-dashed bg-surface-alt/20 px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Trophy size={14} className="text-gold/60" aria-hidden="true" />
          <p className="text-[11px] font-semibold tracking-wider uppercase text-text-light">
            Achievements
          </p>
        </div>
        <p className="text-[12px] text-text-light italic">
          Coming soon — first booking, 100 tasks, anniversaries, and more.
        </p>
      </div>
    </aside>
  )
}

// ─── Bits ─────────────────────────────────────────────────────────

function StatRow({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  subValue?: string
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-text-muted">{label}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[13px] font-semibold text-text tabular-nums">{value}</p>
        {subValue && (
          <p className="text-[10px] text-text-light tabular-nums">{subValue}</p>
        )}
      </div>
    </li>
  )
}

/**
 * Generic "card with a titled header + scrollable list" used by the
 * Recent Sessions + Recent Task Completions sidebar sections.
 * Handles the loading / empty fallbacks so each consumer just maps
 * its rows.
 */
function ListCard({
  title,
  icon,
  loading,
  empty,
  emptyLabel,
  children,
}: {
  title: string
  icon: React.ReactNode
  loading: boolean
  empty: boolean
  emptyLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-alt/60 flex items-center gap-2">
        {icon}
        <p className="text-[11px] font-semibold tracking-wider uppercase text-text-light">
          {title}
        </p>
      </div>
      {loading ? (
        <div className="px-4 py-6 flex items-center justify-center text-text-light">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        </div>
      ) : empty ? (
        <div className="px-4 py-5 flex flex-col items-center text-center text-text-light">
          <Inbox size={16} className="mb-1.5" aria-hidden="true" />
          <p className="text-[11px] italic">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/40 max-h-[260px] overflow-y-auto">
          {children}
        </ul>
      )}
    </div>
  )
}

function InlineSpinner() {
  return (
    <span className="inline-flex">
      <Loader2 size={11} className="animate-spin text-text-light" aria-hidden="true" />
    </span>
  )
}
